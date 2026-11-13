"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCRM } from "@/components/crm/provider";
import { dataHora } from "@/lib/crm/format";
import type { ContatoCompleto } from "@/domain/types";
import Link, { useRouter } from "@/crm-grafite/link";
import { Button, ButtonLink, EmptyState, Icon, Panel, SearchInput, Select, Skeleton, SkeletonGroup, Table, Tag, useToast, type Coluna } from "../../ui";
import { armazenamentoDaSessao, chaveRascunho, guardarRascunho } from "../../ui/rascunho";
import { CabecalhoTela, TelaV4 } from "../base-demais/tela";
import {
  DECISAO,
  ORIGEM_DECISAO,
  RODAVEIS,
  buscarContatos,
  contextoPara,
  lerResultado,
  linhasAgentes,
  motivoNaoRoda,
  nomeAgente,
  oportunidadeAberta,
  ordenarSugestoes,
  textoTick,
  type DecisaoAgente,
  type LeituraResultado,
  type LinhaAgente,
  type SlugRodavel,
  type SugestaoPilot,
} from "./agentes-logica";
import { executarAgente, lerDecisoes, lerIa, lerSugestoesPilot, lerWhatsapp, rodarTickPilot, type EstadoIa, type EstadoWhatsapp } from "./fonte";
import "../../styles/telas/agentes.css";

type Dados = {
  ia: EstadoIa | null;
  whatsapp: EstadoWhatsapp | null;
  sugestoes: SugestaoPilot[] | null;
  decisoes: DecisaoAgente[] | null;
  falhas: string[];
};

const quando = (iso: string) => (Number.isNaN(Date.parse(iso)) ? "—" : dataHora(iso));

/**
 * Agentes: a fila de sugestões do Pilot abre a tela; rodar um agente sobre um contato fica ao
 * lado; os sete agentes ficam numa tabela de uma linha por agente, dizendo como cada um trabalha
 * de verdade neste CRM. Nada aqui envia mensagem ao contato.
 */
export function TelaAgentes() {
  const { estado, operador } = useCRM();
  const toast = useToast();
  const robo = estado.config.nomeRobo || "Cláudio";
  const gestor = operador?.papel === "dono";
  const podeAgir = Boolean(operador) && operador?.papel !== "leitura";
  const [dados, setDados] = useState<Dados | null>(null);
  const [tick, setTick] = useState<{ texto: string; avisos: string[] } | null>(null);
  const seq = useRef(0);

  const carregar = useCallback(async () => {
    const meu = ++seq.current;
    const [ia, wpp, sug, dec] = await Promise.allSettled([lerIa(), lerWhatsapp(), lerSugestoesPilot(), lerDecisoes(30)]);
    if (meu !== seq.current) return;
    const falhas: string[] = [];
    if (ia.status === "rejected") falhas.push("a conexão com a IA");
    if (sug.status === "rejected") falhas.push("as sugestões do Pilot");
    if (dec.status === "rejected") falhas.push("o registro de decisões");
    setDados({
      ia: ia.status === "fulfilled" ? ia.value : null,
      whatsapp: wpp.status === "fulfilled" ? wpp.value : null,
      sugestoes: sug.status === "fulfilled" ? sug.value : null,
      decisoes: dec.status === "fulfilled" ? dec.value : null,
      falhas,
    });
  }, []);
  useEffect(() => {
    void carregar();
  }, [carregar]);

  const automaticas = dados?.decisoes?.filter((d) => d.origem === "auto-atendimento") ?? [];
  const linhas = useMemo(
    () =>
      linhasAgentes(
        {
          iaConectada: dados?.ia ? dados.ia.configurada : null,
          whatsappConectado: dados?.whatsapp ? dados.whatsapp.conectado : null,
          decisoesAutomaticas: automaticas.length,
          ultimaAutomatica: automaticas[0] ? quando(automaticas[0].em) : null,
        },
        robo,
      ),
    [dados, automaticas, robo],
  );

  if (!dados) return <AgentesCarregando />;

  const fila = ordenarSugestoes(dados.sugestoes ?? []);

  async function pedirSugestoes() {
    try {
      const r = await rodarTickPilot();
      setTick(textoTick(r));
      await carregar();
    } catch (e) {
      toast.avisar({ tom: "erro", titulo: "O Pilot não rodou", texto: `${e instanceof Error ? e.message : "Tente de novo."} Nada foi enviado.` });
    }
  }

  return (
    <TelaV4 area="agentes">
      <CabecalhoTela
        titulo="Agentes"
        meta={dados.sugestoes == null ? undefined : fila.length === 0 ? "Nenhuma sugestão para revisar" : `${fila.length} ${fila.length === 1 ? "sugestão para revisar" : "sugestões para revisar"}`}
        acoes={
          gestor && (
            <Button icon="recarregar" onClick={pedirSugestoes} busyLabel="O Pilot está procurando">
              Pedir sugestões ao Pilot
            </Button>
          )
        }
      />
      {dados.ia && !dados.ia.configurada && (
        <p className="v4-nota v4-nota--atencao">
          <Icon name="alerta" />
          <span>
            Sem chave de IA conectada: os agentes usam regras locais, mais simples, e o Ember não roda.{" "}
            {gestor ? (
              <Link className="v4-link" href="/config/integrar">
                Conectar a IA em Integração
              </Link>
            ) : (
              "Peça ao dono para conectar em Integração."
            )}
          </span>
        </p>
      )}
      {dados.falhas.length > 0 && (
        <p className="v4-nota v4-nota--erro" role="alert">
          <Icon name="erro" />
          <span>Não deu para ler {dados.falhas.join(", ")}. O resto da tela está atualizado.</span>
          <Button size="sm" variant="ghost" icon="recarregar" onClick={carregar}>
            Tentar de novo
          </Button>
        </p>
      )}
      {tick && (
        <div className="v4-ag__tick" role="status">
          <p className="v4-nota">
            <Icon name="info" />
            <span>{tick.texto}</span>
          </p>
          {tick.avisos.map((a) => (
            <p key={a} className="v4-nota v4-nota--atencao">
              <Icon name="alerta" />
              <span>{a}</span>
            </p>
          ))}
        </div>
      )}

      <div className="v4-grade v4-grade--lado">
        <Panel elevado titulo={`Sugestões para revisar${fila.length ? ` (${fila.length})` : ""}`}>
          <p className="v4-t-meta">Follow-ups que o Pilot preparou para quem parou de responder. Nada foi enviado: você leva o texto para a conversa e decide.</p>
          {dados.sugestoes == null ? (
            <p className="v4-t-meta">As sugestões não carregaram.</p>
          ) : fila.length === 0 ? (
            <EmptyState
              titulo="Nada esperando revisão"
              texto={
                gestor
                  ? "Quando o Pilot encontrar alguém parado entre 1 e 14 dias, a sugestão aparece aqui. Use Pedir sugestões ao Pilot para procurar agora."
                  : "Quando o Pilot encontrar alguém parado entre 1 e 14 dias, a sugestão aparece aqui."
              }
            />
          ) : (
            <ul className="v4-sug" aria-label="Sugestões do Pilot">
              {fila.map((s) => (
                <SugestaoItem key={s.id} s={s} podeAgir={podeAgir} />
              ))}
            </ul>
          )}
          <Decisoes decisoes={dados.decisoes} robo={robo} />
        </Panel>

        <RodarAgente podeAgir={podeAgir} />
      </div>

      <Panel titulo="Os agentes" semRecuo>
        <TabelaAgentes linhas={linhas} />
        <div className="v4-ag__rodape">
          <p className="v4-t-meta">
            {robo} nunca fala preço, desconto ou parcela: isso é sempre com uma pessoa. O Ledger nunca fica automático e nunca cobra. Quem instalou o CRM
            decide, no servidor, se {robo} e o Pilot podem enviar sozinhos; sem isso, nenhum agente manda mensagem.
          </p>
          <ButtonLink href="/relance" variant="ghost" size="sm" iconEnd="chevronDireita">
            Abrir Relance (campanhas do Ember)
          </ButtonLink>
        </div>
      </Panel>
    </TelaV4>
  );
}

function AgentesCarregando() {
  return (
    <TelaV4 area="agentes">
      <SkeletonGroup label="Carregando agentes" comoTitulo>
        <div className="v4-esq" aria-hidden="true">
          <div className="v4-esq__head">
            <Skeleton forma="title" largura={20} />
          </div>
          <div className="v4-grade v4-grade--lado">
            <div className="v4-esq__painel">
              <Skeleton forma="title" largura={40} />
              {[0, 1, 2].map((i) => (
                <div key={i} className="v4-esq__item">
                  <Skeleton largura={50} />
                  <Skeleton largura={90} />
                  <Skeleton forma="control" largura={40} />
                </div>
              ))}
            </div>
            <div className="v4-esq__painel">
              <Skeleton forma="title" largura={60} />
              <Skeleton forma="control" largura={100} />
              <Skeleton forma="control" largura={100} />
            </div>
          </div>
          <div className="v4-esq__painel">
            <Skeleton forma="title" largura={30} />
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="v4-esq__linha">
                <Skeleton largura={([60, 40, 70, 50, 60] as const)[i]} />
              </div>
            ))}
          </div>
        </div>
      </SkeletonGroup>
    </TelaV4>
  );
}

/** Leva o texto para o campo de resposta da conversa (rascunho da aba) e abre a conversa. Não envia. */
function useLevarParaConversa() {
  const router = useRouter();
  const toast = useToast();
  return (contatoId: string, texto: string) => {
    guardarRascunho(armazenamentoDaSessao(), chaveRascunho(contatoId), texto);
    toast.avisar({ tom: "info", titulo: "Texto no campo de resposta", texto: "Revise e envie na conversa. Nada foi enviado ainda." });
    router.push(`/conversas?c=${encodeURIComponent(contatoId)}`);
  };
}

function useCopiar() {
  const toast = useToast();
  return async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.avisar({ tom: "sucesso", titulo: "Texto copiado" });
    } catch {
      toast.avisar({ tom: "erro", titulo: "Não deu para copiar", texto: "Selecione o texto e copie à mão." });
    }
  };
}

function SugestaoItem({ s, podeAgir }: { s: SugestaoPilot; podeAgir: boolean }) {
  const { contato } = useCRM();
  const c = contato(s.contatoId);
  const levar = useLevarParaConversa();
  const copiar = useCopiar();
  return (
    <li className="v4-sug__item">
      <div className="v4-sug__topo">
        <Tag tom="info">Pilot</Tag>
        <span className="v4-t-strong">{c?.nome ?? s.nome}</span>
      </div>
      <p className="v4-t-meta">
        <span className="v4-tabular">{s.telefoneMascarado}</span> · parado há {s.diasParado} {s.diasParado === 1 ? "dia" : "dias"} · preparada {quando(s.criadaEm)}
      </p>
      <p className="v4-texto-longo">{s.texto}</p>
      <div className="v4-sug__acoes">
        {c && podeAgir && (
          <Button variant="secondary" icon="conversas" onClick={() => levar(c.id, s.texto)}>
            Levar para a conversa
          </Button>
        )}
        <Button variant="ghost" icon="nota" onClick={() => copiar(s.texto)}>
          Copiar texto
        </Button>
        {c && (
          <Link className="v4-link" href={`/contatos/${encodeURIComponent(c.id)}`}>
            Abrir ficha
          </Link>
        )}
      </div>
      {!c && <p className="v4-t-meta">Este contato não está nesta base do CRM; use o texto direto no WhatsApp.</p>}
    </li>
  );
}

function Decisoes({ decisoes, robo }: { decisoes: DecisaoAgente[] | null; robo: string }) {
  if (!decisoes) return null;
  return (
    <details className="v4-sug__historico">
      <summary>Últimas decisões automáticas ({decisoes.length})</summary>
      {decisoes.length === 0 ? (
        <p className="v4-t-meta v4-ag__semdecisao">
          Nenhuma decisão automática registrada. Elas aparecem quando {robo} atende sozinho ou o Pilot prepara um follow-up.
        </p>
      ) : (
        <ul>
          {decisoes.map((d) => (
            <li key={d.id} className="v4-t-ui">
              <span className="v4-t-medium">{DECISAO[d.decisao] ?? d.decisao}</span>
              <span className="v4-t-2">
                {" "}
                · {d.origem === "auto-atendimento" ? `${robo} (atendimento automático)` : ORIGEM_DECISAO[d.origem] ?? d.origem} ·{" "}
                <span className="v4-tabular">{d.telefone}</span> · {quando(d.em)}
              </span>
              <span className="v4-t-3"> · {d.motivo}</span>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

function RodarAgente({ podeAgir }: { podeAgir: boolean }) {
  const { contatos, agora, despachar, operador } = useCRM();
  const toast = useToast();
  const levar = useLevarParaConversa();
  const copiar = useCopiar();
  const [slug, setSlug] = useState<SlugRodavel>("scout");
  const [q, setQ] = useState("");
  const [escolhido, setEscolhido] = useState<ContatoCompleto | null>(null);
  const [fase, setFase] = useState<
    { fase: "ocioso" } | { fase: "rodando"; texto: string } | { fase: "pronto"; r: LeituraResultado; agente: string; contatoId: string } | { fase: "falhou"; texto: string }
  >({ fase: "ocioso" });
  const [criadas, setCriadas] = useState<Set<string>>(new Set());
  const [notaSalva, setNotaSalva] = useState(false);

  const achados = useMemo(() => (escolhido ? [] : buscarContatos(contatos, q)), [contatos, q, escolhido]);
  const motivo = escolhido ? motivoNaoRoda(slug, escolhido) : null;
  const nome = nomeAgente(slug);

  function reiniciar() {
    setFase({ fase: "ocioso" });
    setCriadas(new Set());
    setNotaSalva(false);
  }

  async function rodar() {
    if (!escolhido || motivo) return;
    reiniciar();
    setFase({ fase: "rodando", texto: `${nome} está lendo o que o CRM tem de ${escolhido.nome}. Pode levar até um minuto.` });
    try {
      const r = await executarAgente(slug, { contatoId: escolhido.id, oportunidadeId: oportunidadeAberta(escolhido)?.id, contexto: contextoPara(slug, escolhido, agora) });
      setFase({ fase: "pronto", r: lerResultado(slug, r), agente: nome, contatoId: escolhido.id });
    } catch (e) {
      setFase({ fase: "falhou", texto: `${e instanceof Error ? e.message : "Não foi possível rodar."} Nada foi enviado nem alterado.` });
    }
  }

  async function criarTarefa(texto: string, contatoId: string) {
    const ok = await despachar({ tipo: "criarTarefa", contatoId, texto, venceEm: null, origem: "scribe" }, "Tarefa criada.");
    if (ok) setCriadas((s) => new Set(s).add(texto));
  }

  async function salvarNota(texto: string, contatoId: string) {
    const ok = await despachar({ tipo: "adicionarNota", contatoId, texto, autorId: operador?.id ?? null }, "Briefing salvo como nota na ficha.");
    if (ok) setNotaSalva(true);
  }

  if (!podeAgir) {
    return (
      <Panel titulo="Rodar um agente">
        <p className="v4-t-meta">Seu acesso é só de leitura. Rodar um agente gasta créditos de IA; peça a alguém da equipe.</p>
      </Panel>
    );
  }

  return (
    <Panel titulo="Rodar um agente">
      <div className="v4-ag__rodar">
        <p className="v4-t-meta">O agente lê o que o CRM tem do contato e propõe. Nada é enviado ao contato.</p>
        <Select
          label="Agente"
          value={slug}
          onChange={(e) => {
            setSlug(e.target.value as SlugRodavel);
            reiniciar();
          }}
          options={RODAVEIS.map((s) => ({ value: s, label: `${nomeAgente(s)}: ${ROTULO_RODAR[s]}` }))}
        />
        <div className="v4-ag__lead">
          {escolhido ? (
            <div className="v4-ag__escolhido">
              <span className="v4-t-meta">Contato</span>
              <span className="v4-t-medium">
                {escolhido.nome}
                {escolhido.empresa && <span className="v4-t-2"> · {escolhido.empresa}</span>}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEscolhido(null);
                  setQ("");
                  reiniciar();
                }}
              >
                Trocar contato
              </Button>
            </div>
          ) : (
            <>
              <span className="v4-field__label" id="ag-lead-rotulo">
                Contato (nome, empresa ou telefone)
              </span>
              <SearchInput label="Buscar contato por nome, empresa ou telefone" value={q} onChange={setQ} placeholder="Ex.: Padaria" />
              <p className="v4-field__help">Digite ao menos 2 letras.</p>
              {achados.length > 0 && (
                <ul className="v4-ag__leads" aria-labelledby="ag-lead-rotulo">
                  {achados.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className="v4-ag__lead-opcao"
                        onClick={() => {
                          setEscolhido(c);
                          reiniciar();
                        }}
                      >
                        <span className="v4-t-medium">{c.nome}</span>
                        <span className="v4-t-meta">{[c.empresa, oportunidadeAberta(c) ? null : "sem oportunidade aberta"].filter(Boolean).join(" · ") || "Sem empresa"}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {q.trim().length >= 2 && achados.length === 0 && (
                <p className="v4-t-meta" role="status">
                  Nenhum contato com “{q.trim()}”.
                </p>
              )}
            </>
          )}
        </div>
        <div className="v4-form__acoes">
          <Button variant="primary" icon="agentes" onClick={rodar} disabled={!escolhido || Boolean(motivo)} busyLabel={`Rodando ${nome}`}>
            Rodar {nome}
          </Button>
        </div>
        {motivo && (
          <p className="v4-nota v4-nota--atencao">
            <Icon name="alerta" />
            <span>{motivo}</span>
          </p>
        )}

        {fase.fase === "ocioso" && <p className="v4-sr" role="status" aria-live="polite" />}
        {fase.fase === "rodando" && (
          <p className="v4-nota" role="status" aria-live="polite">
            <Icon name="relogio" />
            <span>{fase.texto}</span>
          </p>
        )}
        {fase.fase === "falhou" && (
          <div className="v4-ag__resultado" role="alert">
            <p className="v4-nota v4-nota--erro">
              <Icon name="erro" />
              <span>{fase.texto}</span>
            </p>
            <Button size="sm" variant="secondary" icon="recarregar" onClick={rodar}>
              Tentar de novo
            </Button>
          </div>
        )}
        {fase.fase === "pronto" && (
          <div className="v4-ag__resultado" role="status" aria-live="polite">
            <p className="v4-nota">
              <Icon name={fase.r.bloqueado ? "alerta" : "sucesso"} className={fase.r.bloqueado ? undefined : "v4-ag__ok"} />
              <span>
                {fase.r.titulo} <span className="v4-t-3">({fase.r.comIa ? "com IA" : "regras locais"})</span>
              </span>
            </p>
            {fase.r.linhas.length > 0 && (
              <dl className="v4-fatos">
                {fase.r.linhas.map((l) => (
                  <div key={l.rotulo} className="v4-ag__fato">
                    <dt>{l.rotulo}</dt>
                    <dd>{l.texto}</dd>
                  </div>
                ))}
              </dl>
            )}
            {fase.r.texto && (
              <>
                <blockquote className="v4-ag__texto">{fase.r.texto}</blockquote>
                <div className="v4-sug__acoes">
                  <Button variant="secondary" icon="conversas" onClick={() => levar(fase.contatoId, fase.r.texto ?? "")}>
                    Levar para a conversa
                  </Button>
                  <Button variant="ghost" icon="nota" onClick={() => copiar(fase.r.texto ?? "")}>
                    Copiar texto
                  </Button>
                </div>
              </>
            )}
            {fase.r.followups.length > 0 && (
              <ul className="v4-ag__followups" aria-label="Follow-ups propostos">
                {fase.r.followups.map((f) => (
                  <li key={f}>
                    <span>{f}</span>
                    {criadas.has(f) ? (
                      <span className="v4-ag__st v4-ag__st--ok">Tarefa criada</span>
                    ) : (
                      <Button size="sm" variant="ghost" icon="mais_" onClick={() => criarTarefa(f, fase.contatoId)}>
                        Criar tarefa
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {fase.r.briefing && (
              <>
                <p className="v4-texto-longo v4-ag__texto">{fase.r.briefing}</p>
                <div className="v4-sug__acoes">
                  {notaSalva ? (
                    <span className="v4-ag__st v4-ag__st--ok">Salvo como nota</span>
                  ) : (
                    <Button variant="secondary" icon="nota" onClick={() => salvarNota(fase.r.briefing ?? "", fase.contatoId)}>
                      Salvar como nota na ficha
                    </Button>
                  )}
                </div>
              </>
            )}
            {slug === "scribe" && fase.r.followups.length === 0 && !fase.r.bloqueado && (
              <p className="v4-t-meta">Nenhuma linha das notas virou tarefa (o Scribe só propõe o que já está escrito).</p>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}

const ROTULO_RODAR: Record<SlugRodavel, string> = {
  scout: "é hora de passar para uma pessoa?",
  pilot: "preparar um follow-up",
  scribe: "resumir notas e propor tarefas",
  eco: "briefing para a reunião",
};

function TabelaAgentes({ linhas }: { linhas: LinhaAgente[] }) {
  const colunas: Coluna<LinhaAgente>[] = [
    {
      id: "agente",
      titulo: "Agente",
      quebrar: true,
      celula: (a) => (
<span className="v4-t-medium">{a.nome}</span>
      ),
    },
    { id: "modo", titulo: "Como trabalha hoje", quebrar: true, celula: (a) => <span className="v4-ag__modo">{a.modo}</span> },
    {
      id: "estado",
      titulo: "Estado",
      quebrar: true,
      celula: (a) => (
        <span className="v4-ag__nome">
          <span>
            <Tag tom={a.estado.tom} icon={a.estado.tom === "sucesso" ? "sucesso" : a.estado.tom === "atencao" ? "alerta" : undefined}>
              {a.estado.rotulo}
            </Tag>
          </span>
          {a.estado.detalhe && <span className="v4-t-meta">{a.estado.detalhe}</span>}
          {a.href && (
            <Link className="v4-link v4-t-meta" href={a.href}>
              Ver campanhas no Relance
            </Link>
          )}
        </span>
      ),
    },
  ];
  return <Table rotulo="Os agentes e como cada um trabalha hoje" linhas={linhas} colunas={colunas} chave={(a) => a.slug} />;
}
