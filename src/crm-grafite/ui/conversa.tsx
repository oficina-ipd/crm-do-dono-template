"use client";

import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import { apagarRascunho, armazenamentoDaSessao, guardarRascunho, lerRascunho } from "./rascunho";
import { criarEnvioComposer } from "./composer-logica";
import { acaoDoBotaoAssumir } from "./posse-logica";
import { Button, IconButton } from "./button";
import { Icon } from "./icon";
import { Avatar } from "./marcadores";
import { DropdownMenu, type ItemMenu } from "./menu";
import { useIdV4 } from "./flutuante";

export type Autor = { tipo: "claudio" } | { tipo: "humano"; nome: string } | { tipo: "lead"; nome: string };
export type EstadoEnvio = "enviando" | "enviada" | "incerta" | "falhou";

const ROTULO_ESTADO: Record<EstadoEnvio, string> = {
  enviando: "Enviando",
  enviada: "Enviada",
  incerta: "Entrega não confirmada",
  falhou: "Não enviada",
};

export function nomeDoAutor(a: Autor): string {
  return a.tipo === "claudio" ? "Cláudio" : a.nome;
}

/** "Ligação · 12 min" (arredonda para cima; menos de 1 min vira "menos de 1 min"). */
export function rotuloLigacao(segundos: number): string {
  if (!Number.isFinite(segundos) || segundos <= 0) return "Ligação · não atendida";
  if (segundos < 60) return "Ligação · menos de 1 min";
  return `Ligação · ${Math.ceil(segundos / 60)} min`;
}

/**
 * Balão de mensagem. Entrada (lead) à esquerda; saída (Cláudio ou pessoa da equipe) à
 * direita, com o autor escrito. O estado de envio aparece em texto e ícone: enviando,
 * enviada, entrega não confirmada (incerta) e não enviada (com "Tentar de novo").
 */
export const ChatBubble = memo(function ChatBubble({
  direcao,
  autor,
  hora,
  estado,
  aoTentarDeNovo,
  agrupada,
  children,
}: {
  direcao: "in" | "out";
  autor: Autor;
  hora: string;
  estado?: EstadoEnvio;
  aoTentarDeNovo?: () => unknown;
  /** Mesma pessoa em sequência: esconde o autor repetido. */
  agrupada?: boolean;
  children: ReactNode;
}) {
  const cls = [
    "v4-bubble-row",
    direcao === "out" ? "v4-bubble-row--out" : "",
    autor.tipo === "claudio" ? "v4-bubble-row--claudio" : "",
    agrupada ? "v4-bubble-row--grouped" : "",
    estado === "falhou" ? "is-failed" : "",
    estado === "incerta" ? "is-uncertain" : "",
    estado === "enviando" ? "is-sending" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const nome = nomeDoAutor(autor);
  return (
    <div className={cls}>
      {!agrupada ? (
        <span className="v4-bubble__author">
          {autor.tipo === "claudio" && <Avatar nome="Cláudio" claudio />}
          {nome}
        </span>
      ) : (
        <span className="v4-sr">{nome}</span>
      )}
      <div className="v4-bubble">{children}</div>
      <span className="v4-bubble__status">
        <time>{hora}</time>
        {estado && direcao === "out" && (
          <span className={`v4-bubble__state v4-bubble__state--${estado}`}>
            <Icon name={estado === "enviando" ? "relogio" : estado === "enviada" ? "check" : estado === "incerta" ? "alerta" : "erro"} />
            {ROTULO_ESTADO[estado]}
          </span>
        )}
        {estado === "falhou" && aoTentarDeNovo && (
          <Button size="sm" variant="ghost" icon="recarregar" onClick={aoTentarDeNovo}>
            Tentar de novo
          </Button>
        )}
      </span>
    </div>
  );
});

/** Ligação na linha do tempo da conversa. */
/** Sem a duração registrada (`segundos` nulo), diz só "Ligação". */
export function CallEvent({ segundos, hora, quem }: { segundos?: number | null; hora: string; quem?: string }) {
  return (
    <div className="v4-call">
      <Icon name="telefone" />
      <span>{segundos == null ? "Ligação" : rotuloLigacao(segundos)}</span>
      {quem && <span>· {quem}</span>}
      <time>· {hora}</time>
    </div>
  );
}

export function DaySeparator({ rotulo }: { rotulo: string }) {
  return (
    <div className="v4-daysep" role="separator" aria-label={rotulo}>
      <span aria-hidden="true">{rotulo}</span>
    </div>
  );
}

/**
 * Campo de resposta isolado: guarda o próprio texto, então digitar não redesenha a conversa.
 * ⌘Enter (ou Ctrl+Enter) envia; Enter quebra linha. `motivoBloqueio` desabilita e explica.
 * `aoEnviar` devolve true quando o envio foi aceito: só então o campo limpa.
 */
export const Composer = memo(function Composer({
  aoEnviar,
  limite = 4096,
  motivoBloqueio,
  rotulo = "Responder",
  placeholder = "Escreva a resposta",
  rascunhoInicial = "",
  chaveRascunho,
}: {
  aoEnviar: (texto: string) => Promise<boolean>;
  limite?: number;
  motivoBloqueio?: string;
  rotulo?: string;
  placeholder?: string;
  rascunhoInicial?: string;
  /** Guarda o rascunho na sessionStorage com esta chave (ex.: por conversa); limpa ao enviar. */
  chaveRascunho?: string;
}) {
  const id = useIdV4("v4-composer");
  const [texto, setTexto] = useState(rascunhoInicial);
  const chaveRef = useRef(chaveRascunho);
  chaveRef.current = chaveRascunho;
  // Depois de montar (sem divergir da renderização do servidor): recupera o rascunho desta conversa.
  useEffect(() => {
    if (!chaveRascunho) return;
    const salvo = lerRascunho(armazenamentoDaSessao(), chaveRascunho);
    if (salvo) setTexto((t) => (t ? t : salvo));
  }, [chaveRascunho]);
  const mudarTexto = (v: string) => {
    setTexto(v);
    if (chaveRef.current) guardarRascunho(armazenamentoDaSessao(), chaveRef.current, v);
  };
  const [enviando, setEnviando] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const n = texto.length;
  const passou = n > limite;
  const vazio = texto.trim().length === 0;
  const bloqueado = Boolean(motivoBloqueio);

  // Uma trava só para botão e ⌘Enter; lê sempre os valores atuais pelas refs.
  const atual = useRef({ texto, limite, bloqueado, aoEnviar });
  atual.current = { texto, limite, bloqueado, aoEnviar };
  const envio = useRef<ReturnType<typeof criarEnvioComposer> | null>(null);
  if (!envio.current) {
    envio.current = criarEnvioComposer({
      ler: () => atual.current.texto,
      limite: Infinity,
      bloqueado: () => atual.current.bloqueado || atual.current.texto.length > atual.current.limite,
      aoEnviar: (t) => atual.current.aoEnviar(t),
      aoMudarEnviando: (v) => {
        setEnviando(v);
        if (!v) ref.current?.focus();
      },
      aoLimpar: () => {
        setTexto("");
        if (chaveRef.current) apagarRascunho(armazenamentoDaSessao(), chaveRef.current);
      },
    });
  }
  const enviar = () => envio.current!.enviar();

  return (
    <form
      className="v4-composer"
      onSubmit={(e) => {
        e.preventDefault();
        void enviar();
      }}
    >
      <label htmlFor={id} className="v4-sr">
        {rotulo}
      </label>
      {bloqueado && (
        <p className="v4-composer__reason v4-t-ui" id={`${id}-motivo`}>
          <Icon name="info" />
          <span>{motivoBloqueio}</span>
        </p>
      )}
      <textarea
        ref={ref}
        id={id}
        className="v4-textarea"
        rows={1}
        value={texto}
        disabled={bloqueado}
        placeholder={bloqueado ? undefined : placeholder}
        aria-describedby={[bloqueado ? `${id}-motivo` : "", `${id}-conta`].filter(Boolean).join(" ")}
        aria-invalid={passou || undefined}
        onChange={(e) => mudarTexto(e.target.value)}
        onKeyDown={(e) => envio.current!.teclar(e)}
      />
      <div className="v4-composer__row">
        <span className="v4-composer__hint" aria-hidden="true">
          <kbd className="v4-kbd">⌘↵</kbd> envia · <kbd className="v4-kbd">↵</kbd> quebra linha
        </span>
        <span id={`${id}-conta`} className={["v4-composer__count", passou ? "is-over" : ""].filter(Boolean).join(" ")}>
          {passou ? `${n - limite} acima do limite` : `${n} de ${limite}`}
        </span>
        <Button type="submit" variant="primary" icon="enviar" busy={enviando} busyLabel="Enviando" disabled={bloqueado || vazio || passou}>
          Enviar
        </Button>
      </div>
    </form>
  );
});

export type Condutor = { tipo: "claudio" } | { tipo: "voce" } | { tipo: "outro"; nome: string };

/**
 * Barra de posse, acima do campo de resposta. Um botão principal só:
 * Cláudio (ou outra pessoa) conduz → "Assumir"; você conduz → "Devolver ao Cláudio".
 * Transferir para outra pessoa fica no menu. Antes de assumir, mostra o aviso automático
 * que o contato vai receber e pede confirmação.
 */
export function OwnershipBar({
  condutor,
  precisaDeVoce,
  avisoAutomatico,
  operadores = [],
  aoAssumir,
  aoDevolver,
  aoTransferir,
  confirmandoInicial = false,
  bloqueio,
  itensMenu = [],
}: {
  condutor: Condutor;
  /** Handoff pendente: a barra fica âmbar (a sua vez). */
  precisaDeVoce?: boolean;
  avisoAutomatico?: string;
  operadores?: Array<{ id: string; nome: string }>;
  aoAssumir: () => unknown;
  aoDevolver: () => unknown;
  aoTransferir?: (operadorId: string) => unknown;
  confirmandoInicial?: boolean;
  /** Ações indisponíveis (ex.: ligação com o Cláudio desligada): desabilita e diz por quê. */
  bloqueio?: string;
  /** Itens somados ao menu (ex.: devolver quando outra pessoa conduz). */
  itensMenu?: ItemMenu[];
}) {
  const [confirmando, setConfirmando] = useState(confirmandoInicial);
  const bloqueioId = useIdV4("v4-posse-bloqueio");
  const travado = Boolean(bloqueio);
  const itensTransferir: ItemMenu[] =
    aoTransferir && operadores.length > 0
      ? [
          { tipo: "rotulo", id: "rot", label: "Transferir para" },
          ...operadores.map((o) => ({ id: o.id, label: o.nome, icon: "transferir" as const, disabled: travado, onSelect: () => void aoTransferir(o.id) })),
        ]
      : [];
  const menu: ItemMenu[] = [
    ...itensTransferir,
    ...(itensTransferir.length && itensMenu.length ? [{ tipo: "separador" as const, id: "sep-extra" }] : []),
    ...itensMenu,
  ];
  const abertaEm = useRef(confirmandoInicial ? 0 : Date.now());
  const assumirRef = useRef<HTMLButtonElement>(null);
  // Cancelar (botão ou Esc) fecha a confirmação e devolve o foco a "Assumir", sem perdê-lo no <body>.
  const cancelar = () => {
    setConfirmando(false);
    assumirRef.current?.focus();
  };
  // Esc cancela a confirmação de qualquer ponto da página (ela não prende o foco). Escuta na
  // captura para vir antes dos atalhos da tela (que recolheriam o contexto) e marca o evento.
  useEffect(() => {
    if (!confirmando) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (document.querySelector("dialog[open], [role='menu']")) return;
      e.preventDefault();
      setConfirmando(false);
      assumirRef.current?.focus();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [confirmando]);
  const confirmarId = useIdV4("v4-assumir");
  const voce = condutor.tipo === "voce";
  const quem = condutor.tipo === "claudio" ? "Cláudio" : condutor.tipo === "outro" ? condutor.nome : "Você";

  return (
    <div
      className={["v4-owner", precisaDeVoce && !voce ? "v4-owner--suavez" : ""].filter(Boolean).join(" ")}
      role="group"
      aria-label="Quem conduz a conversa"
    >
      <span className="v4-owner__who">
        {condutor.tipo === "claudio" ? <Avatar nome="Cláudio" claudio tamanho="sm" /> : <Avatar nome={quem} tamanho="sm" />}
        <span>
          <strong>{quem}</strong> está conduzindo
          {precisaDeVoce && !voce && <span> · pediu uma pessoa</span>}
        </span>
      </span>
      <span className="v4-owner__actions">
        {voce ? (
          <Button variant="secondary" icon="devolver" disabled={travado} aria-describedby={travado ? bloqueioId : undefined} onClick={aoDevolver}>
            Devolver ao Cláudio
          </Button>
        ) : (
          <Button
            ref={assumirRef}
            variant="primary"
            icon="assumir"
            disabled={travado}
            aria-describedby={travado ? bloqueioId : undefined}
            aria-expanded={avisoAutomatico ? confirmando : undefined}
            aria-controls={avisoAutomatico ? confirmarId : undefined}
            onClick={async () => {
              const acao = acaoDoBotaoAssumir({
                temAviso: Boolean(avisoAutomatico),
                confirmando,
                abertaHaMs: Date.now() - abertaEm.current,
              });
              if (acao === "abrir-confirmacao") {
                abertaEm.current = Date.now();
                setConfirmando(true);
                return;
              }
              if (acao === "ignorar") return;
              // aoAssumir pode devolver false (falhou): a confirmação fica aberta
              const r = await aoAssumir();
              if (r !== false) setConfirmando(false);
            }}
          >
            {confirmando ? "Assumir e enviar o aviso" : "Assumir"}
          </Button>
        )}
        {menu.length > 0 && (
          <DropdownMenu
            label={itensTransferir.length ? "Transferir conversa" : "Mais ações da conversa"}
            lado="cima-fim"
            itens={menu}
            gatilho={(p) => (
              <IconButton
                ref={p.ref}
                icon="maisVertical"
                label="Mais ações da conversa"
                aria-haspopup={p["aria-haspopup"]}
                aria-expanded={p["aria-expanded"]}
                aria-controls={p["aria-controls"]}
                onClick={p.onClick}
                onKeyDown={p.onKeyDown}
              />
            )}
          />
        )}
      </span>
      {bloqueio && (
        <p className="v4-owner__reason v4-t-meta" id={bloqueioId}>
          {bloqueio}
        </p>
      )}
      {confirmando && avisoAutomatico && !voce && !travado && (
        <div className="v4-owner__confirm" id={confirmarId}>
          <p className="v4-t-ui">Ao assumir, o Cláudio para de responder e o contato recebe este aviso. Confirme em “Assumir e enviar o aviso”.</p>
          <blockquote className="v4-owner__quote v4-t-ui">{avisoAutomatico}</blockquote>
          <div className="v4-discard__actions">
            <Button variant="secondary" onClick={cancelar}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
