"use client";

/**
 * Balão e barra de posse com o NOME DO ROBÔ do template (`estado.config.nomeRobo`).
 * São os mesmos de `ui/conversa.tsx` (mesmas classes, mesmo comportamento), que hoje têm
 * "Cláudio" escrito no código. Quando o componente compartilhado aceitar `nomeRobo`, estes saem
 * (ver o relatório do porte).
 */
import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import { Avatar, Button, DropdownMenu, IconButton, type ItemMenu } from "../../ui";
import { useIdV4 } from "../../ui/flutuante";
import { acaoDoBotaoAssumir } from "../../ui/posse-logica";
import type { AutorBalao, CondutorTpl } from "./modelo";

/** Marcador do robô: neutro, com a inicial do nome configurado (nunca gradiente). */
export function MarcadorRobo({ nome, tamanho }: { nome: string; tamanho?: "sm" }) {
  return (
    <span aria-hidden="true" className={["v4-avatar", "v4-avatar--claudio", tamanho ? `v4-avatar--${tamanho}` : ""].filter(Boolean).join(" ")}>
      {(nome.trim()[0] ?? "R").toUpperCase()}
    </span>
  );
}

/** Balão: entrada (contato) à esquerda; saída (robô ou pessoa da equipe) à direita, com o autor escrito. */
export const Balao = memo(function Balao({
  direcao,
  autor,
  hora,
  agrupada,
  children,
}: {
  direcao: "in" | "out";
  autor: AutorBalao;
  hora: string;
  agrupada?: boolean;
  children: ReactNode;
}) {
  const cls = [
    "v4-bubble-row",
    direcao === "out" ? "v4-bubble-row--out" : "",
    autor.tipo === "robo" ? "v4-bubble-row--claudio" : "",
    agrupada ? "v4-bubble-row--grouped" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls}>
      {!agrupada ? (
        <span className="v4-bubble__author">
          {autor.tipo === "robo" && <MarcadorRobo nome={autor.nome} />}
          {autor.nome}
        </span>
      ) : (
        <span className="v4-sr">{autor.nome}</span>
      )}
      <div className="v4-bubble">{children}</div>
      <span className="v4-bubble__status">
        <time>{hora}</time>
      </span>
    </div>
  );
});

/**
 * Barra de posse, acima do campo de resposta. Um botão principal só: o robô (ou outra pessoa)
 * conduz → "Assumir" (com confirmação que mostra o aviso exato que o contato recebe); você
 * conduz → "Devolver ao <robô>". O resto fica no menu.
 */
export function BarraDePosse({
  condutor,
  nomeRobo,
  precisaDeVoce,
  avisoAutomatico,
  aoAssumir,
  aoDevolver,
  bloqueio,
  itensMenu = [],
}: {
  condutor: CondutorTpl;
  nomeRobo: string;
  precisaDeVoce?: boolean;
  /** Texto exato que o contato recebe ao assumir (avisoAssumir). */
  avisoAutomatico?: string;
  aoAssumir: () => Promise<boolean>;
  aoDevolver: () => Promise<boolean>;
  bloqueio?: string;
  itensMenu?: ItemMenu[];
}) {
  const [confirmando, setConfirmando] = useState(false);
  const bloqueioId = useIdV4("v4-posse-bloqueio");
  const confirmarId = useIdV4("v4-assumir");
  const travado = Boolean(bloqueio);
  const abertaEm = useRef(Date.now());
  const assumirRef = useRef<HTMLButtonElement>(null);
  const cancelar = () => {
    setConfirmando(false);
    assumirRef.current?.focus();
  };
  // Esc cancela a confirmação; escuta na captura para vir antes dos atalhos da tela.
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

  const voce = condutor.tipo === "voce";
  const quem = condutor.tipo === "robo" ? nomeRobo : condutor.tipo === "outro" ? condutor.nome : "Você";

  return (
    <div className={["v4-owner", precisaDeVoce && !voce ? "v4-owner--suavez" : ""].filter(Boolean).join(" ")} role="group" aria-label="Quem conduz a conversa">
      <span className="v4-owner__who">
        {condutor.tipo === "robo" ? <MarcadorRobo nome={nomeRobo} tamanho="sm" /> : <Avatar nome={quem} tamanho="sm" />}
        <span>
          <strong>{quem}</strong> está conduzindo
          {precisaDeVoce && !voce && <span> · pediu uma pessoa</span>}
        </span>
      </span>
      <span className="v4-owner__actions">
        {voce ? (
          <Button variant="secondary" icon="devolver" disabled={travado} aria-describedby={travado ? bloqueioId : undefined} onClick={aoDevolver}>
            Devolver ao {nomeRobo}
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
              const acao = acaoDoBotaoAssumir({ temAviso: Boolean(avisoAutomatico), confirmando, abertaHaMs: Date.now() - abertaEm.current });
              if (acao === "abrir-confirmacao") {
                abertaEm.current = Date.now();
                setConfirmando(true);
                return;
              }
              if (acao === "ignorar") return;
              if (await aoAssumir()) setConfirmando(false);
            }}
          >
            {confirmando ? "Assumir e enviar o aviso" : "Assumir"}
          </Button>
        )}
        {itensMenu.length > 0 && (
          <DropdownMenu
            label="Mais ações da conversa"
            lado="cima-fim"
            itens={itensMenu}
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
          <p className="v4-t-ui">
            Ao assumir, {condutor.tipo === "robo" ? `o ${nomeRobo} para de responder` : `a conversa sai de ${quem} e passa para você`} e o contato recebe este aviso. Confirme em “Assumir e
            enviar o aviso”.
          </p>
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
