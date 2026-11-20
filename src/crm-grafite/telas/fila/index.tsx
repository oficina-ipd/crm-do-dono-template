"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useCRM } from "@/components/crm/provider";
import { Button, ButtonLink, EmptyState, FaixaTopo, KeyHint, Panel, Tag } from "../../ui";
import {
  contarItens,
  esperandoHa,
  itensEmOrdem,
  montarFila,
  prazoDoHandoff,
  quandoMensagem,
  rotuloParada,
  rotuloTarefaFila,
  totalEsperando,
  type HandoffFila,
  type ParadaFila,
  type TarefaFila,
} from "./logica";
import { ResumoDiaVista } from "./resumo";
import { resumoDoDia } from "./resumo-logica";
import { useTecladoFila } from "./use-teclado-fila";
import "../../styles/telas/fila.css";

type PropsItem = ReturnType<ReturnType<typeof useTecladoFila>["propsDoItem"]>;

function ItemHandoff({ h, agora, nomeRobo, props }: { h: HandoffFila; agora: Date; nomeRobo: string; props: PropsItem }) {
  const prazo = prazoDoHandoff(h.slaAte, agora);
  const tituloId = `fila-${h.id}`;
  const meta = [h.empresa, h.nota != null ? `nota ${h.nota}` : null, esperandoHa(h.desde, agora)].filter(Boolean).join(" · ");
  return (
    <li className="v4-fila__li">
      <article className="v4-fila__item v4-fila__item--handoff" aria-labelledby={tituloId} aria-keyshortcuts="Enter" {...props}>
        <div className="v4-fila__conteudo">
          <div className="v4-fila__topo">
            <h3 id={tituloId} className="v4-fila__nome">
              {h.nome}
            </h3>
            <Tag tom="suavez" icon="assumir">
              Precisa de você
            </Tag>
            <Tag tom={prazo.tom} icon="relogio">
              {prazo.texto}
            </Tag>
          </div>
          <p className="v4-fila__meta">{meta.charAt(0).toLocaleUpperCase("pt-BR") + meta.slice(1)}</p>
          <dl className="v4-fila__fatos">
            <div>
              <dt>Motivo</dt>
              <dd className={h.motivo ? undefined : "is-vazio"}>{h.motivo ?? `${nomeRobo} não registrou o motivo.`}</dd>
            </div>
          </dl>
          {h.ultimaMensagem && (
            <p className="v4-fila__ultima">
              <span className="v4-fila__ultima-quem">
                Última mensagem · {h.ultimaMensagem.quem}, {quandoMensagem(h.ultimaMensagem.em, agora)}:
              </span>{" "}
              <span className="v4-fila__ultima-texto">“{h.ultimaMensagem.texto}”</span>
            </p>
          )}
        </div>
        <div className="v4-fila__acoes">
          <ButtonLink href={h.href} variant="secondary" icon="conversas">
            Abrir conversa<span className="v4-sr"> com {h.nome}</span>
          </ButtonLink>
        </div>
      </article>
    </li>
  );
}

function ItemTarefa({
  t,
  agora,
  podeEscrever,
  aoConcluir,
  aoReabrir,
  props,
}: {
  t: TarefaFila;
  agora: Date;
  podeEscrever: boolean;
  aoConcluir: () => Promise<unknown>;
  aoReabrir: () => Promise<unknown>;
  props: PropsItem;
}) {
  const r = rotuloTarefaFila(t, agora);
  const tituloId = `fila-${t.id}`;
  return (
    <li className="v4-fila__li">
      <article
        className={["v4-fila__item v4-fila__item--tarefa", t.feita ? "is-feita" : ""].filter(Boolean).join(" ")}
        aria-labelledby={tituloId}
        aria-keyshortcuts={t.href ? "Enter" : undefined}
        {...props}
      >
        <div className="v4-fila__conteudo">
          <div className="v4-fila__topo">
            <h3 id={tituloId} className="v4-fila__nome">
              {t.titulo}
            </h3>
            {t.feita ? (
              <Tag tom="sucesso" icon="sucesso">
                Concluída
              </Tag>
            ) : (
              <Tag tom={r.atrasada ? "erro" : "neutro"} icon={r.atrasada ? "alerta" : "relogio"}>
                {r.texto}
              </Tag>
            )}
          </div>
          <p className="v4-fila__meta">{t.contato?.nome ?? "Pessoa não encontrada"}</p>
        </div>
        <div className="v4-fila__acoes">
          {podeEscrever &&
            (t.feita ? (
              <Button variant="ghost" icon="devolver" busyLabel="Reabrindo" onClick={aoReabrir}>
                Reabrir<span className="v4-sr"> {t.titulo}</span>
              </Button>
            ) : (
              <Button variant="secondary" icon="check" busyLabel="Concluindo" onClick={aoConcluir}>
                Concluir<span className="v4-sr"> {t.titulo}</span>
              </Button>
            ))}
          {t.href && (
            <ButtonLink href={t.href} variant="ghost" icon="pessoas">
              Abrir ficha<span className="v4-sr"> de {t.contato?.nome}</span>
            </ButtonLink>
          )}
        </div>
      </article>
    </li>
  );
}

function ItemParada({ p, props }: { p: ParadaFila; props: PropsItem }) {
  const tituloId = `fila-${p.id}`;
  return (
    <li className="v4-fila__li">
      <article className="v4-fila__item v4-fila__item--parada" aria-labelledby={tituloId} aria-keyshortcuts="Enter" {...props}>
        <div className="v4-fila__conteudo">
          <div className="v4-fila__topo">
            <h3 id={tituloId} className="v4-fila__nome">
              {p.nome}
            </h3>
            <Tag tom="atencao" icon="relogio">
              Parada
            </Tag>
          </div>
          <p className="v4-fila__meta">{rotuloParada(p)}</p>
        </div>
        <div className="v4-fila__acoes">
          <ButtonLink href={p.href} variant="secondary" icon="pessoas">
            Abrir ficha<span className="v4-sr"> de {p.nome}</span>
          </ButtonLink>
        </div>
      </article>
    </li>
  );
}

function Secao({
  id,
  titulo,
  n,
  suaVez,
  ajuda,
  vazio,
  rodape,
  children,
}: {
  id: string;
  titulo: string;
  n: number;
  suaVez?: boolean;
  ajuda: string;
  vazio: string;
  rodape?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="v4-fila__sec" aria-labelledby={`${id}-t`}>
      <div className="v4-fila__sec-head">
        <h2 id={`${id}-t`} className="v4-t-section v4-fila__sec-titulo">
          {titulo}
        </h2>
        <span className={["v4-fila__contagem", suaVez && n > 0 ? "is-suavez" : ""].filter(Boolean).join(" ")}>{contarItens(n)}</span>
      </div>
      {n > 0 ? (
        <>
          <p className="v4-fila__ajuda">{ajuda}</p>
          <ul className="v4-fila__lista">{children}</ul>
        </>
      ) : (
        <p className="v4-fila__sec-vazia">{vazio}</p>
      )}
      {rodape && <div className="v4-fila__sec-pe">{rodape}</div>}
    </section>
  );
}

/**
 * Fila: o que precisa de você abre a tela. Quem pediu uma pessoa (por prazo), depois tarefas de
 * hoje e atrasadas (concluir no lugar), depois oportunidades paradas além do prazo da etapa.
 * Cada item diz o que acontece no clique; nada aqui finge executar o que só navega. Resumo do dia
 * numa coluna estreita ao lado.
 */
export function TelaFila() {
  const { estado, agora: agoraIso, operador, despachar } = useCRM();
  const agora = useMemo(() => new Date(agoraIso), [agoraIso]);
  const podeEscrever = operador?.papel !== "leitura";
  const nomeRobo = estado.config.nomeRobo || "Cláudio";
  // tarefas concluídas nesta visita: continuam na lista, riscadas, com "Reabrir"
  const [mantidas, setMantidas] = useState<ReadonlySet<string>>(() => new Set());

  const fila = useMemo(() => montarFila(estado, agoraIso, mantidas), [estado, agoraIso, mantidas]);
  const resumo = useMemo(() => resumoDoDia(estado, agoraIso), [estado, agoraIso]);
  const itens = useMemo(() => itensEmOrdem(fila), [fila]);
  const destinos = useMemo(() => itens.map((i) => i.href), [itens]);
  const { raiz, propsDoItem } = useTecladoFila(destinos);
  const n = totalEsperando(fila);
  const vazia = itens.length === 0;

  const concluir = useCallback(
    async (t: TarefaFila, feita: boolean) => {
      if (feita) setMantidas((m) => new Set(m).add(t.tarefaId));
      const r = await despachar({ tipo: "concluirTarefa", tarefaId: t.tarefaId, feita }, feita ? `Tarefa concluída: ${t.titulo}` : `Tarefa reaberta: ${t.titulo}`);
      if (!r && feita)
        setMantidas((m) => {
          const x = new Set(m);
          x.delete(t.tarefaId);
          return x;
        });
      return r;
    },
    [despachar],
  );

  let indice = 0;
  const proximo = () => propsDoItem(indice++);

  return (
    <div data-v4-tela="fila" className="v4-tela v4-fila">
      <FaixaTopo titulo="Fila" contagem={n === 0 ? "nada esperando" : `${n} esperando`}>
        {!vazia && (
          <p className="v4-fila__teclas">
            <KeyHint teclas={["J"]} />
            <KeyHint teclas={["K"]} />
            <span>andam na fila,</span>
            <KeyHint teclas={["↵"]} />
            <span>abre o item</span>
          </p>
        )}
      </FaixaTopo>
      <div className="v4-fila__grade">
        <div className="v4-fila__principal" ref={raiz}>
          {vazia ? (
            <EmptyState
              nivel={2}
              titulo="Nada esperando por você"
              texto={`Ninguém pediu uma pessoa, não há tarefa para hoje nem atrasada e nenhuma oportunidade passou do prazo da etapa. Quando ${nomeRobo} pedir uma pessoa, aparece aqui primeiro.`}
              acoes={
                <>
                  <ButtonLink href="/conversas" variant="secondary" icon="conversas">
                    Ver conversas
                  </ButtonLink>
                  {podeEscrever && (
                    <ButtonLink href="/trabalho?nova=1" variant="ghost" icon="mais_">
                      Nova tarefa
                    </ButtonLink>
                  )}
                </>
              }
            />
          ) : (
            <>
              <Secao
                id="fila-handoffs"
                titulo="Precisa de uma pessoa agora"
                n={fila.handoffs.length}
                suaVez
                ajuda="Do prazo mais curto para o mais longo. Abrir conversa leva à conversa já aberta; assumir e responder é lá."
                vazio="Ninguém pediu uma pessoa agora."
              >
                {fila.handoffs.map((h) => (
                  <ItemHandoff key={h.id} h={h} agora={agora} nomeRobo={nomeRobo} props={proximo()} />
                ))}
              </Secao>
              <Secao
                id="fila-tarefas"
                titulo="Tarefas de hoje e atrasadas"
                n={fila.tarefas.length}
                ajuda={podeEscrever ? "Concluir grava na hora. Abrir ficha leva à pessoa." : "Abrir ficha leva à pessoa."}
                vazio="Nenhuma tarefa para hoje nem atrasada."
                rodape={
                  <ButtonLink href="/trabalho" variant="ghost" iconEnd="chevronDireita">
                    Próximas tarefas em Tarefas
                  </ButtonLink>
                }
              >
                {fila.tarefas.map((t) => (
                  <ItemTarefa
                    key={t.id}
                    t={t}
                    agora={agora}
                    podeEscrever={podeEscrever}
                    aoConcluir={() => concluir(t, true)}
                    aoReabrir={() => concluir(t, false)}
                    props={proximo()}
                  />
                ))}
              </Secao>
              <Secao
                id="fila-paradas"
                titulo="Oportunidades paradas"
                n={fila.paradas.length}
                ajuda="Passaram do prazo da etapa; quem passou mais vem primeiro. Abrir ficha leva à pessoa, para mover a etapa ou criar uma tarefa."
                vazio="Nenhuma oportunidade passou do prazo da etapa."
              >
                {fila.paradas.map((p) => (
                  <ItemParada key={p.id} p={p} props={proximo()} />
                ))}
              </Secao>
            </>
          )}
        </div>
        <aside className="v4-fila__lado" aria-label="Resumo do dia">
          <ResumoDiaVista resumo={resumo} nomeRobo={nomeRobo} />
        </aside>
      </div>
    </div>
  );
}
