"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useCRM } from "@/components/crm/provider";
import { avisoAssumir, primeiroNome } from "@/domain/rules";
import type { ContatoCompleto, Ocorrencia } from "@/domain/types";
import { Button, CallEvent, Checkbox, DaySeparator, Dialog, EmptyState, Select, Textarea, type ItemMenu } from "../../ui";
import { Composer } from "../../ui/conversa";
import { proximoAnuncio } from "../../ui/anuncio";
import { useAlturaNoPai } from "../../ui/flutuante";
import { chaveRascunho } from "../../ui/rascunho";
import {
  condutorDe,
  eventosDaConversa,
  janelaRecente,
  montarBlocos,
  motivoBloqueioComposer,
  PAGINA_CONVERSA,
  type BlocoThread,
  type NomesConversa,
} from "./modelo";
import { Balao, BarraDePosse } from "./posse";

export const LIMITE_MENSAGEM = 4096;

const Bloco = memo(function Bloco({ bloco }: { bloco: BlocoThread }) {
  return (
    <div className="v4-cv-bloco">
      {bloco.primeiroDoDia && <DaySeparator rotulo={bloco.rotulo} />}
      {bloco.itens.map((it) =>
        it.tipo === "ligacao" ? (
          <div key={it.chave} className="v4-cv-ligacao">
            <CallEvent segundos={it.segundos} hora={it.hora} quem={it.quem} />
            {it.resumo && (
              <details className="v4-cv-transcricao">
                <summary>Resumo da ligação</summary>
                <p className="v4-t-ui">{it.resumo}</p>
              </details>
            )}
          </div>
        ) : (
          <Balao key={it.chave} direcao={it.direcao} autor={it.autor} hora={it.hora} agrupada={it.agrupada}>
            {it.texto}
          </Balao>
        ),
      )}
    </div>
  );
});

/** Nomes usados nos balões e na barra (robô do config, operadores, "Você"). */
export function useNomesConversa(): NomesConversa {
  const { estado, operador } = useCRM();
  return useMemo(() => ({ nomeRobo: estado.config.nomeRobo, operadores: estado.operadores, euId: operador?.id ?? null }), [estado.config.nomeRobo, estado.operadores, operador?.id]);
}

/**
 * A conversa (a mesma peça em Conversas e na Ficha): rolagem própria ancorada na última mensagem,
 * "carregar anteriores" sem perder o ponto de leitura, separador por dia, ligações, barra de posse
 * e campo de resposta. Enviar só quando você conduz; assumir mostra antes o aviso que o contato recebe.
 */
export function ConversaTpl({ c, modo = "tela", cabecalho }: { c: ContatoCompleto; modo?: "tela" | "embutida"; cabecalho?: ReactNode }) {
  const { despachar, operador, agora } = useCRM();
  const nomes = useNomesConversa();
  const nomeRobo = nomes.nomeRobo;
  const soLeitura = !operador || operador.papel === "leitura";

  const eventos = useMemo(() => eventosDaConversa(c.mensagens, c.ligacoes), [c.mensagens, c.ligacoes]);
  const [limite, setLimite] = useState(PAGINA_CONVERSA);
  const janela = janelaRecente(eventos.length, limite);
  const visiveis = useMemo(() => eventos.slice(janela.inicio), [eventos, janela.inicio]);
  const agoraMs = Date.parse(agora);
  const blocos = useMemo(() => montarBlocos(visiveis, { ...nomes, nomeContato: c.nome, agora: agoraMs }), [visiveis, nomes, c.nome, agoraMs]);

  // Rolagem ancorada no fim: desce sozinha só se a pessoa já estava no fim;
  // "carregar anteriores" mantém o ponto de leitura (soma a altura que entrou acima).
  const rolagem = useRef<HTMLDivElement>(null);
  const conteudo = useRef<HTMLDivElement>(null);
  const pertoDoFim = useRef(true);
  const alturaAntes = useRef<number | null>(null);
  const totalAntes = useRef(eventos.length);
  const [novas, setNovas] = useState(0);
  const [anuncio, setAnuncio] = useState("");

  useLayoutEffect(() => {
    const el = rolagem.current;
    const chegaram = eventos.length - totalAntes.current;
    totalAntes.current = eventos.length;
    if (!el) return;
    if (alturaAntes.current != null) {
      el.scrollTop += el.scrollHeight - alturaAntes.current;
      alturaAntes.current = null;
    } else if (pertoDoFim.current) {
      el.scrollTop = el.scrollHeight;
    } else if (chegaram > 0) {
      setNovas((v) => v + chegaram);
    }
    if (chegaram > 0) {
      const ultima = eventos[eventos.length - 1];
      if (ultima?.tipo === "msg" && ultima.m.autor === "contato") setAnuncio((a) => proximoAnuncio(a, `Nova mensagem de ${c.nome}`));
    }
  }, [eventos, c.nome]);

  // Enquanto a pessoa está no fim, cada mudança de altura (barra que cresce, blocos pintados) reancora.
  useEffect(() => {
    const el = rolagem.current;
    const dentro = conteudo.current;
    if (!el || !dentro || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (pertoDoFim.current && alturaAntes.current == null) el.scrollTop = el.scrollHeight;
    });
    ro.observe(dentro, { box: "border-box" });
    return () => ro.disconnect();
  }, []);

  const aoRolar = useCallback(() => {
    const el = rolagem.current;
    if (!el) return;
    pertoDoFim.current = el.scrollHeight - el.scrollTop - el.clientHeight < 96;
    if (pertoDoFim.current) setNovas(0);
  }, []);

  const irParaFim = useCallback(() => {
    const el = rolagem.current;
    if (!el) return;
    pertoDoFim.current = true;
    el.scrollTop = el.scrollHeight;
    setNovas(0);
    el.focus({ preventScroll: true });
  }, []);

  function carregarAnteriores() {
    alturaAntes.current = rolagem.current?.scrollHeight ?? null;
    const antes = janela.mostrando;
    setLimite((l) => l + PAGINA_CONVERSA);
    const depois = janelaRecente(eventos.length, limite + PAGINA_CONVERSA).mostrando;
    setAnuncio((a) => proximoAnuncio(a, `${depois - antes} mensagens anteriores carregadas`));
  }

  // ───── posse e envio ─────
  const condutor = condutorDe(c, nomes);
  const [ocorrencia, setOcorrencia] = useState(false);
  const [simular, setSimular] = useState(false);

  async function assumir(): Promise<boolean> {
    if (!operador) return false;
    const r = await despachar({ tipo: "assumirConversa", contatoId: c.id, operadorId: operador.id }, "Você está conduzindo a conversa");
    return r !== null;
  }
  async function devolver(): Promise<boolean> {
    if (!operador) return false;
    const r = await despachar({ tipo: "devolverConversa", contatoId: c.id, operadorId: operador.id }, `Conversa devolvida ao ${nomeRobo}`);
    return r !== null;
  }
  const aoEnviar = useCallback(
    async (texto: string) => {
      if (!operador) return false;
      pertoDoFim.current = true;
      const r = await despachar({ tipo: "enviarMensagem", contatoId: c.id, texto, operadorId: operador.id });
      return r !== null;
    },
    [despachar, operador, c.id],
  );

  const temDoRobo = c.mensagens.some((m) => m.autor === "robo" && !m.aviso);
  const itensMenu: ItemMenu[] = soLeitura
    ? []
    : [
        ...(condutor.tipo === "outro" ? [{ id: "devolver", label: `Devolver ao ${nomeRobo}`, icon: "devolver" as const, onSelect: () => void devolver() }] : []),
        { id: "ocorrencia", label: `Registrar ocorrência do ${nomeRobo}`, icon: "nota" as const, disabled: !temDoRobo, onSelect: () => setOcorrencia(true) },
        { id: "simular", label: "Testar: escrever como o contato", icon: "conversas" as const, onSelect: () => setSimular(true) },
      ];

  const dock = useAlturaNoPai("--v4-cv-dock-h");
  const vazia = eventos.length === 0;

  return (
    <section className={["v4-cv-conversa", modo === "embutida" ? "v4-cv-conversa--embutida" : ""].filter(Boolean).join(" ")} aria-label={`Conversa com ${c.nome}`}>
      {cabecalho}
      <div className="v4-cv-rolagem-wrap">
        <div ref={rolagem} className="v4-cv-rolagem" onScroll={aoRolar} tabIndex={0} role="log" aria-live="off" aria-label={`Mensagens com ${c.nome}`}>
          <div ref={conteudo}>
            {janela.temAnteriores ? (
              <div className="v4-cv-anteriores">
                <Button size="sm" variant="ghost" icon="chevronCima" onClick={carregarAnteriores}>
                  Carregar mensagens anteriores
                </Button>
                <span className="v4-t-meta v4-tabular">
                  Mostrando {janela.mostrando} de {eventos.length}
                </span>
              </div>
            ) : (
              !vazia && <p className="v4-cv-inicio v4-t-meta">Início da conversa</p>
            )}
            {vazia ? (
              <div className="v4-cv-vazia">
                <EmptyState centro titulo="Ainda não há mensagens" texto={`Quando o ${nomeRobo} ou o contato escreverem, a conversa aparece aqui.`} />
              </div>
            ) : (
              <div className="v4-thread v4-cv-thread">
                {blocos.map((b) => (
                  <Bloco key={b.chave} bloco={b} />
                ))}
              </div>
            )}
          </div>
        </div>
        {novas > 0 && (
          <div className="v4-cv-novas">
            <Button size="sm" variant="secondary" icon="chevronBaixo" onClick={irParaFim}>
              {novas === 1 ? "1 mensagem nova" : `${novas} mensagens novas`}
            </Button>
          </div>
        )}
      </div>
      <div className="v4-sr" aria-live="polite">
        {anuncio}
      </div>
      <div className="v4-dock" ref={dock}>
        <BarraDePosse
          condutor={condutor}
          nomeRobo={nomeRobo}
          precisaDeVoce={c.handoffPendente}
          avisoAutomatico={condutor.tipo !== "voce" && operador ? avisoAssumir(primeiroNome(c.nome), operador.nome) : undefined}
          aoAssumir={assumir}
          aoDevolver={devolver}
          bloqueio={soLeitura ? "Seu acesso é só de leitura: assumir e responder ficam com a equipe." : undefined}
          itensMenu={itensMenu}
        />
        <Composer
          key={c.id}
          limite={LIMITE_MENSAGEM}
          rotulo={`Responder a ${c.nome}`}
          chaveRascunho={chaveRascunho(c.id)}
          motivoBloqueio={motivoBloqueioComposer(condutor, nomeRobo, soLeitura)}
          placeholder="Escreva a resposta (⌘↵ envia)"
          aoEnviar={aoEnviar}
        />
      </div>
      {!soLeitura && (
        <>
          <DialogoOcorrencia aberto={ocorrencia} aoFechar={() => setOcorrencia(false)} c={c} nomeRobo={nomeRobo} />
          <DialogoSimular aberto={simular} aoFechar={() => setSimular(false)} c={c} nomeRobo={nomeRobo} roboConduz={condutor.tipo === "robo"} />
        </>
      )}
    </section>
  );
}

/** Marcar mensagens do robô como problema ou melhoria (vai para Ocorrências). */
function DialogoOcorrencia({ aberto, aoFechar, c, nomeRobo }: { aberto: boolean; aoFechar: () => void; c: ContatoCompleto; nomeRobo: string }) {
  const { despachar, operador } = useCRM();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [tipo, setTipo] = useState<Ocorrencia["tipo"]>("problema");
  const [porque, setPorque] = useState("");
  const doRobo = useMemo(() => c.mensagens.filter((m) => m.autor === "robo" && !m.aviso).slice(-20).reverse(), [c.mensagens]);
  const pronto = sel.size > 0 && porque.trim().length >= 3;

  useEffect(() => {
    if (!aberto) {
      setSel(new Set());
      setPorque("");
      setTipo("problema");
    }
  }, [aberto]);

  async function registrar() {
    const trechos = c.mensagens.filter((m) => sel.has(m.id)).map((m) => ({ autor: m.autor, texto: m.texto, em: m.em }));
    const r = await despachar(
      { tipo: "registrarOcorrencia", contatoId: c.id, tipoOcorrencia: tipo, descricao: porque.trim(), trechos, abertaPor: operador?.id ?? null },
      "Ocorrência registrada",
    );
    if (r) aoFechar();
  }

  return (
    <Dialog
      open={aberto}
      onClose={aoFechar}
      title={`Registrar ocorrência do ${nomeRobo}`}
      description={`Marque as mensagens do ${nomeRobo} que merecem revisão. Vai para Ocorrências; não muda o que o ${nomeRobo} faz agora.`}
      dirty={sel.size > 0 || porque.trim().length > 0}
      perda="a ocorrência que você começou"
      footer={({ fechar }) => (
        <>
          <Button variant="ghost" onClick={fechar}>
            Cancelar
          </Button>
          <Button variant="primary" disabled={!pronto} onClick={registrar}>
            Registrar
          </Button>
        </>
      )}
    >
      <fieldset className="v4-cv-ocorrencias">
        <legend className="v4-t-meta">Últimas mensagens do {nomeRobo}</legend>
        {doRobo.map((m) => (
          <Checkbox
            key={m.id}
            checked={sel.has(m.id)}
            onChange={(e) =>
              setSel((s) => {
                const n = new Set(s);
                if (e.target.checked) n.add(m.id);
                else n.delete(m.id);
                return n;
              })
            }
            label={m.texto.length > 140 ? `${m.texto.slice(0, 140)}…` : m.texto}
          />
        ))}
      </fieldset>
      <Select
        label="Tipo"
        value={tipo}
        onChange={(e) => setTipo(e.target.value as Ocorrencia["tipo"])}
        options={[
          { value: "problema", label: "Problema" },
          { value: "melhoria", label: "Melhoria" },
        ]}
      />
      <Textarea label="O que aconteceu e o que deveria ter acontecido" required value={porque} onChange={(e) => setPorque(e.target.value)} rows={3} maxLength={1000} help="Pelo menos 3 letras." />
    </Dialog>
  );
}

/** Teste: escrever no lugar do contato (comando receberMensagem) para ver o robô responder. */
function DialogoSimular({ aberto, aoFechar, c, nomeRobo, roboConduz }: { aberto: boolean; aoFechar: () => void; c: ContatoCompleto; nomeRobo: string; roboConduz: boolean }) {
  const { despachar } = useCRM();
  const [texto, setTexto] = useState("");
  useEffect(() => {
    if (!aberto) setTexto("");
  }, [aberto]);
  return (
    <Dialog
      open={aberto}
      onClose={aoFechar}
      title={`Escrever como ${primeiroNome(c.nome)}`}
      description={
        roboConduz
          ? `Para testar o atendimento: a mensagem entra na conversa como se ${primeiroNome(c.nome)} tivesse escrito, e o ${nomeRobo} responde. Use só com dados de exemplo.`
          : `Para testar o atendimento: a mensagem entra na conversa como se ${primeiroNome(c.nome)} tivesse escrito. Uma pessoa conduz, então o ${nomeRobo} não responde. Use só com dados de exemplo.`
      }
      dirty={texto.trim().length > 0}
      perda="o texto que você escreveu"
      footer={({ fechar }) => (
        <>
          <Button variant="ghost" onClick={fechar}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            disabled={!texto.trim()}
            onClick={async () => {
              const r = await despachar({ tipo: "receberMensagem", contatoId: c.id, texto: texto.trim() });
              if (r) aoFechar();
            }}
          >
            Entrar na conversa
          </Button>
        </>
      )}
    >
      <Textarea label={`O que ${primeiroNome(c.nome)} escreve`} required rows={3} maxLength={2000} value={texto} onChange={(e) => setTexto(e.target.value)} />
    </Dialog>
  );
}
