"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useCRM } from "@/components/crm/provider";
import { etapaDe } from "@/domain/funil";
import { dataHora, oportunidadePrincipal, proximasAcoes } from "@/domain/rules";
import type { Briefing, ContatoCompleto, Termometro } from "@/domain/types";
import { irPara, useRouter, useSearchParams } from "../../link";
import { Button, ButtonLink, Checkbox, Dialog, FaixaTopo, Icon, Input, Panel, SegmentedControl, Select, Tabs, Tag, Textarea } from "../../ui";
import { useAlturaNoPai } from "../../ui/flutuante";
import { FormNota, FormTarefa, MenuMoverEtapa, RevelarDado } from "../conversas/acoes";
import { PorQuePediu } from "../conversas/contexto";
import { ConversaTpl, useNomesConversa } from "../conversas/conversa";
import { condutorDe, haQuanto, horaCurta, mascararEmail, mascararTelefone, motivoDoHandoff, nomeDoOperador } from "../conversas/modelo";
import {
  camposNegocio,
  camposPreenchidos,
  contarPorTipo,
  filtroLinhaValido,
  metaDaFicha,
  montarLinhaDoTempo,
  ROTULO_FILTRO_LINHA,
  rotuloSalvar,
  TIPOS_EVENTO,
  validarBriefing,
  type EstadoSalvar,
  type FiltroLinha,
} from "./modelo";
import { destinoCurto, destinoVoltar, hrefConversaDe } from "./voltar";

function useSoLeitura() {
  const { operador } = useCRM();
  return !operador || operador.papel === "leitura";
}

// ───────── Cabeçalho (faixa do topo) ─────────

export function CabecalhoFicha({ c, de }: { c: ContatoCompleto; de: string | null }) {
  const { ligar } = useCRM();
  const soLeitura = useSoLeitura();
  const [tarefa, setTarefa] = useState(false);
  const volta = destinoVoltar(de);
  const o = oportunidadePrincipal(c.oportunidades);
  const temTelefone = Boolean(c.telefone.replace(/\D/g, ""));

  return (
    <>
      <FaixaTopo
        titulo={c.nome}
        contagem={
          <span className="v4-fi-quem">
            {c.handoffPendente ? <Tag tom="suavez">Precisa de você</Tag> : null}
            <span className="v4-fi-quem__texto">{metaDaFicha(c)}</span>
          </span>
        }
        inicio={
          <Button size="sm" variant="ghost" icon="chevronEsquerda" className="v4-fi-voltar" aria-label={volta.rotulo} onClick={() => irPara(volta.href)}>
            <span className="v4-fi-voltar__texto">{destinoCurto(volta.rotulo)}</span>
          </Button>
        }
      >
        <span className="v4-fi-acoes-grupo" role="group" aria-label="Ações da ficha">
          <ButtonLink href={hrefConversaDe(c.id, de)} variant="ghost">
            Abrir conversa
          </ButtonLink>
          {!soLeitura && (
            <Button variant="ghost" disabled={!temTelefone} title={temTelefone ? undefined : "Sem WhatsApp cadastrado"} onClick={() => ligar(c.id)}>
              Ligar
            </Button>
          )}
          {!soLeitura && (
            <Button variant="ghost" onClick={() => setTarefa(true)}>
              Criar tarefa
            </Button>
          )}
        </span>
        {!soLeitura && o && <MenuMoverEtapa oportunidade={o} comPerda size="md" />}
      </FaixaTopo>
      <Dialog open={tarefa} onClose={() => setTarefa(false)} title={`Nova tarefa para ${c.nome}`}>
        <FormTarefa contatoId={c.id} aoCancelar={() => setTarefa(false)} aoCriar={() => setTarefa(false)} />
      </Dialog>
    </>
  );
}

// ───────── Coluna principal: conversa + linha do tempo ─────────

/** A largura das abas vira --v4-fi-abas-w no painel, para o cabeçalho flutuante reservar o espaço. */
function useLarguraDasAbas() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const painel = ref.current;
    const abas = painel?.querySelector<HTMLElement>(".v4-tabs__list");
    if (!painel || !abas || typeof ResizeObserver === "undefined") return;
    const medir = () => painel.style.setProperty("--v4-fi-abas-w", `${Math.ceil(abas.getBoundingClientRect().width)}px`);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(abas);
    return () => {
      ro.disconnect();
      painel.style.removeProperty("--v4-fi-abas-w");
    };
  }, []);
  return ref;
}

export function ColunaPrincipal({ c }: { c: ContatoCompleto }) {
  const { estado } = useCRM();
  const nomes = useNomesConversa();
  const router = useRouter();
  const sp = useSearchParams();
  const aba = sp.get("aba") === "linha" ? "linha" : "conversa";
  const filtro = filtroLinhaValido(sp.get("mostrar") ?? "tudo");
  const linha = useMemo(() => montarLinhaDoTempo(c, { ...nomes, funis: estado.funis }), [c, nomes, estado.funis]);
  const contagem = useMemo(() => contarPorTipo(linha), [linha]);
  const eventos = useMemo(() => (filtro === "tudo" ? linha : linha.filter((e) => e.tipo === filtro)), [linha, filtro]);
  const painel = useLarguraDasAbas();
  const topo = useAlturaNoPai("--v4-cv-topo-h");

  function trocar(nome: string, valor: string | null) {
    const p = new URLSearchParams(sp.toString());
    if (valor == null) p.delete(nome);
    else p.set(nome, valor);
    const qs = p.toString();
    router.replace(`/contatos/${encodeURIComponent(c.id)}${qs ? `?${qs}` : ""}`);
  }

  const condutor = condutorDe(c, nomes);
  const quemConduz = condutor.tipo === "robo" ? `${nomes.nomeRobo} está conduzindo` : condutor.tipo === "voce" ? "Você está conduzindo" : `${condutor.nome} está conduzindo`;
  const subtitulo =
    aba === "linha"
      ? filtro === "tudo"
        ? `${linha.length} ${linha.length === 1 ? "registro" : "registros"}`
        : `${eventos.length} de ${linha.length} · ${ROTULO_FILTRO_LINHA[filtro]}`
      : `${quemConduz}${c.handoffPendente ? " · pediu uma pessoa" : ""}`;

  return (
    <section ref={painel} className="v4-fi-principal v4-panel v4-panel--up" aria-labelledby="v4-fi-painel-titulo">
      <div className="v4-conv__main-head v4-fi-topo" ref={topo}>
        <div className="v4-conv__who">
          <h2 id="v4-fi-painel-titulo" className="v4-t-section">
            {aba === "linha" ? "Linha do tempo" : "Conversa no WhatsApp"}
          </h2>
          <span className="v4-cv-subtitulo v4-t-meta">{subtitulo}</span>
        </div>
      </div>
      <Tabs
        label="Seções da ficha"
        value={aba}
        onChange={(v) => trocar("aba", v === "linha" ? "linha" : null)}
        tabs={[
          { id: "conversa", label: "Conversa" },
          { id: "linha", label: "Linha do tempo", count: linha.length },
        ]}
      >
        {(ativa) => (
          <>
            <div hidden={ativa !== "conversa"} className="v4-fi-aba">
              <ConversaTpl key={c.id} c={c} modo="embutida" />
            </div>
            <div hidden={ativa !== "linha"} className="v4-fi-aba">
              <div className="v4-fi-bloco v4-fi-linha">
                <SegmentedControl
                  label="Mostrar na linha do tempo"
                  value={filtro}
                  onChange={(v) => {
                    const f = filtroLinhaValido(v);
                    trocar("mostrar", f === "tudo" ? null : f);
                  }}
                  options={(["tudo", ...TIPOS_EVENTO] as FiltroLinha[]).map((f) => ({
                    value: f,
                    label: ROTULO_FILTRO_LINHA[f],
                    count: contagem[f],
                    disabled: f !== "tudo" && contagem[f] === 0,
                  }))}
                />
                {eventos.length === 0 ? (
                  <p className="v4-t-ui v4-t-2">{filtro === "tudo" ? "Nada registrado ainda." : `Nenhum registro de ${ROTULO_FILTRO_LINHA[filtro].toLowerCase()}.`}</p>
                ) : (
                  <ol className="v4-fi-eventos">
                    {eventos.map((e) => (
                      <li key={e.id} className={`v4-fi-evento v4-fi-evento--${e.tipo}`}>
                        <Icon name={e.tipo === "mensagem" ? "conversas" : e.tipo === "ligacao" ? "telefone" : e.tipo === "nota" ? "nota" : e.tipo === "tarefa" ? "tarefas" : "funil"} />
                        <div className="v4-fi-evento__corpo">
                          <p className="v4-t-ui v4-t-medium">{e.titulo}</p>
                          {e.texto && <p className="v4-t-ui v4-t-2 v4-fi-evento__texto">{e.texto}</p>}
                          <p className="v4-t-meta">
                            <time dateTime={e.em}>{dataHora(e.em)}</time>
                            {e.autor ? ` · ${e.autor}` : ""}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          </>
        )}
      </Tabs>
    </section>
  );
}

// ───────── Coluna lateral ─────────

export function PainelPorQue({ c }: { c: ContatoCompleto }) {
  const { estado, agora } = useCRM();
  const h = motivoDoHandoff(c, agora);
  if (!h) return null;
  return (
    <Panel titulo="Por que pediu uma pessoa">
      <PorQuePediu h={h} nomeRobo={estado.config.nomeRobo} />
    </Panel>
  );
}

export function ProximaAcao({ c }: { c: ContatoCompleto }) {
  const { despachar, agora } = useCRM();
  const soLeitura = useSoLeitura();
  const [criando, setCriando] = useState(false);
  const o = oportunidadePrincipal(c.oportunidades);
  const abertas = c.tarefas.filter((t) => !t.feita).sort((a, b) => (a.venceEm ?? "9999").localeCompare(b.venceEm ?? "9999"));
  const sugestoes = proximasAcoes(c, agora);
  const agoraMs = Date.parse(agora);

  return (
    <Panel titulo="Próxima ação">
      {o && !o.perdida && o.proximoPasso && <p className="v4-t-ui">{o.proximoPasso}</p>}
      {o ? (
        <p className="v4-t-meta">{o.perdida ? `Perdida em ${etapaDe(o.etapa)?.nome ?? o.etapa}${o.motivoPerda ? ` · ${o.motivoPerda}` : ""}` : `${etapaDe(o.etapa)?.nome ?? o.etapa} ${haQuanto(o.entrouNaEtapaEm, new Date(agora))}`}</p>
      ) : (
        <p className="v4-t-ui v4-t-2">Sem oportunidade aberta.</p>
      )}
      {abertas.length > 0 && (
        <ul className="v4-fi-tarefas" aria-label="Tarefas abertas">
          {abertas.map((t) => {
            const vencida = t.venceEm && Date.parse(t.venceEm) < agoraMs;
            return (
              <li key={t.id}>
                <Checkbox
                  checked={false}
                  disabled={soLeitura}
                  onChange={() => void despachar({ tipo: "concluirTarefa", tarefaId: t.id }, "Tarefa concluída")}
                  label={
                    <span className="v4-fi-tarefa">
                      <span>{t.texto}</span>
                      <span className="v4-t-meta">
                        {t.venceEm ? `${vencida ? "Venceu" : "Vence"} ${dataHora(t.venceEm)}` : "Sem data"}
                        {t.origem ? ` · ${t.origem}` : ""}
                      </span>
                    </span>
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
      {!soLeitura &&
        (criando ? (
          <FormTarefa contatoId={c.id} aoCancelar={() => setCriando(false)} aoCriar={() => setCriando(false)} />
        ) : (
          <div>
            <Button size="sm" variant="ghost" icon="mais_" onClick={() => setCriando(true)}>
              {abertas.length ? "Outra tarefa" : "Criar tarefa"}
            </Button>
          </div>
        ))}
      {sugestoes.length > 0 && (
        <details className="v4-fi-detalhes">
          <summary>Sugestões ({sugestoes.length})</summary>
          <ul className="v4-fi-lista">
            {sugestoes.map((s) => (
              <li key={s.titulo}>
                <p className="v4-t-ui">{s.titulo}</p>
                <p className="v4-t-meta">{s.porque}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Panel>
  );
}

const TERMOMETRO: Array<{ value: string; label: string }> = [
  { value: "", label: "Sem marca" },
  { value: "frio", label: "Frio" },
  { value: "morno", label: "Morno" },
  { value: "quente", label: "Quente" },
];

export function ContatoPainel({ c }: { c: ContatoCompleto }) {
  const { despachar } = useCRM();
  const nomes = useNomesConversa();
  const soLeitura = useSoLeitura();
  const [editando, setEditando] = useState(false);
  const condutor = condutorDe(c, nomes);
  const conduz = condutor.tipo === "robo" ? nomes.nomeRobo : condutor.tipo === "voce" ? "Você" : condutor.nome;

  return (
    <Panel
      titulo="Contato"
      acoes={
        !soLeitura ? (
          <Button size="sm" variant="ghost" icon="editar" onClick={() => setEditando(true)}>
            Editar
            <span className="v4-sr"> dados de {c.nome}</span>
          </Button>
        ) : undefined
      }
    >
      <dl className="v4-fi-dl">
        <div>
          <dt>Tipo</dt>
          <dd>{c.categoria === "cliente" ? "Cliente" : "Lead"}</dd>
        </div>
        <div>
          <dt>Conduz</dt>
          <dd>{conduz}</dd>
        </div>
        <div>
          <dt>WhatsApp</dt>
          <dd>{c.telefone.replace(/\D/g, "") ? <RevelarDado key={`${c.id}-tel`} rotulo="WhatsApp" mascarado={mascararTelefone(c.telefone)} completo={c.telefone} numero /> : <span className="v4-t-2">Sem WhatsApp</span>}</dd>
        </div>
        <div>
          <dt>E-mail</dt>
          <dd>{c.email ? <RevelarDado key={`${c.id}-email`} rotulo="E-mail" mascarado={mascararEmail(c.email)} completo={c.email} /> : <span className="v4-t-2">Sem e-mail</span>}</dd>
        </div>
      </dl>
      {soLeitura ? (
        c.termometro && <p className="v4-t-meta">Interesse: {c.termometro}</p>
      ) : (
        <div className="v4-fi-interesse">
          <span className="v4-t-meta">Interesse (a sua leitura; não muda a etapa)</span>
          <SegmentedControl
            label="Interesse"
            value={c.termometro ?? ""}
            onChange={(v) => void despachar({ tipo: "definirTermometro", contatoId: c.id, termometro: (v || null) as Termometro | null })}
            options={TERMOMETRO}
          />
        </div>
      )}
      {editando && <DialogoEditarContato c={c} aoFechar={() => setEditando(false)} />}
    </Panel>
  );
}

function DialogoEditarContato({ c, aoFechar }: { c: ContatoCompleto; aoFechar: () => void }) {
  const { despachar } = useCRM();
  const [f, setF] = useState({ nome: c.nome, telefone: c.telefone, email: c.email, empresa: c.empresa, segmento: c.segmento, cidade: c.cidade });
  const mexeu = Object.entries(f).some(([k, v]) => v !== (c as unknown as Record<string, string>)[k]);
  const campo = (k: keyof typeof f, label: string, type = "text", required = false) => (
    <Input label={label} type={type} required={required} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} maxLength={200} />
  );
  async function salvar(e?: FormEvent) {
    e?.preventDefault();
    const r = await despachar({ tipo: "salvarContato", contato: { id: c.id, ...f, nome: f.nome.trim(), telefone: f.telefone.trim() } }, "Dados salvos");
    if (r) aoFechar();
  }
  return (
    <Dialog
      open
      onClose={aoFechar}
      title={`Editar dados de ${c.nome}`}
      dirty={mexeu}
      perda="as alterações nos dados"
      footer={({ fechar }) => (
        <>
          <Button variant="ghost" onClick={fechar}>
            Cancelar
          </Button>
          <Button variant="primary" disabled={!f.nome.trim() || !f.telefone.trim() || !mexeu} onClick={() => salvar()}>
            Salvar
          </Button>
        </>
      )}
    >
      <form className="v4-cv-form" onSubmit={salvar}>
        {campo("nome", "Nome", "text", true)}
        {campo("telefone", "WhatsApp", "tel", true)}
        {campo("email", "E-mail", "email")}
        {campo("empresa", "Empresa")}
        {campo("segmento", "Segmento")}
        {campo("cidade", "Cidade")}
      </form>
    </Dialog>
  );
}

export function NegocioPainel({ c }: { c: ContatoCompleto }) {
  const { estado, despachar, operador } = useCRM();
  const soLeitura = useSoLeitura();
  const [nova, setNova] = useState(false);
  const ativos = estado.produtos.filter((p) => p.ativo);
  const [produtoId, setProdutoId] = useState(ativos[0]?.id ?? "");
  const campos = camposNegocio(c, estado);
  if (campos.length === 0 && soLeitura) return null;
  return (
    <Panel titulo="Negócio">
      {campos.length > 0 && (
        <dl className="v4-fi-dl">
          {campos.map((x) => (
            <div key={x.rotulo}>
              <dt>{x.rotulo}</dt>
              <dd className={x.numero ? "v4-tabular" : undefined}>{x.valor}</dd>
            </div>
          ))}
        </dl>
      )}
      {!soLeitura && ativos.length > 0 && (
        <div>
          <Button size="sm" variant="ghost" icon="mais_" onClick={() => setNova(true)}>
            Nova oportunidade
          </Button>
        </div>
      )}
      <Dialog
        open={nova}
        onClose={() => setNova(false)}
        title="Nova oportunidade"
        description="Uma pessoa pode ter várias oportunidades, uma por produto. A nova começa em Lead novo."
        footer={({ fechar }) => (
          <>
            <Button variant="ghost" onClick={fechar}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              disabled={!produtoId}
              onClick={async () => {
                const r = await despachar({ tipo: "criarOportunidade", contatoId: c.id, produtoId, por: operador?.id ?? "sistema" }, "Oportunidade criada em Lead novo");
                if (r) setNova(false);
              }}
            >
              Criar
            </Button>
          </>
        )}
      >
        <Select label="Produto" value={produtoId} onChange={(e) => setProdutoId(e.target.value)} options={ativos.map((p) => ({ value: p.id, label: p.nome }))} />
      </Dialog>
    </Panel>
  );
}

export function BriefingPainel({ c }: { c: ContatoCompleto }) {
  const { despachar, operador } = useCRM();
  const soLeitura = useSoLeitura();
  const o = oportunidadePrincipal(c.oportunidades);
  const [aberto, setAberto] = useState(false);
  const [estado, setEstado] = useState<EstadoSalvar>({ tipo: "parado" });
  const [f, setF] = useState<Briefing>(o?.briefing ?? { dor: "", meta: "", data: "" });
  const [mexeu, setMexeu] = useState(false);
  useEffect(() => {
    if (estado.tipo !== "salvo") return;
    const t = window.setTimeout(() => setEstado((e) => (e.tipo === "salvo" ? { tipo: "parado" } : e)), 6000);
    return () => window.clearTimeout(t);
  }, [estado]);
  if (!o) return null;
  const n = camposPreenchidos(o.briefing);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!o || estado.tipo === "salvando") return;
    const v = validarBriefing(f);
    if (!v.ok) return setEstado({ tipo: "falhou", erro: v.erro });
    setEstado({ tipo: "salvando" });
    const r = await despachar({ tipo: "salvarBriefing", oportunidadeId: o.id, briefing: v.briefing, por: operador?.id ?? "sistema" });
    if (!r) return setEstado({ tipo: "falhou", erro: "confira os campos e tente de novo." });
    setEstado({ tipo: "salvo", em: new Date().toISOString() });
    setMexeu(false);
  }

  return (
    <Panel
      titulo="Briefing"
      acoes={
        <Button size="sm" variant="ghost" iconEnd={aberto ? "chevronCima" : "chevronBaixo"} aria-expanded={aberto} aria-controls={`v4-fi-briefing-${c.id}`} onClick={() => setAberto((v) => !v)}>
          {aberto ? "Recolher" : "Mostrar"}
          <span className="v4-sr"> o briefing</span>
        </Button>
      }
    >
      {!aberto && (
        <p className="v4-t-meta">
          {n} de 3 preenchidos.{n < 3 ? " Com dor, meta e data, o card vai para Briefing feito." : ""}
        </p>
      )}
      <div id={`v4-fi-briefing-${c.id}`} hidden={!aberto}>
        {soLeitura ? (
          <dl className="v4-fi-dl">
            {(["dor", "meta", "data"] as const).map((k) => (
              <div key={k}>
                <dt>{k === "dor" ? "O que dói hoje" : k === "meta" ? "Meta" : "Até quando"}</dt>
                <dd>{o.briefing?.[k] || "—"}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <form className="v4-cv-form" onSubmit={salvar} onChange={() => setMexeu(true)}>
            <Textarea label="O que dói hoje (nas palavras do contato)" rows={3} maxLength={1000} value={f.dor} onChange={(e) => setF({ ...f, dor: e.target.value })} />
            <Textarea label="Meta (o que muda se resolver)" rows={3} maxLength={1000} value={f.meta} onChange={(e) => setF({ ...f, meta: e.target.value })} />
            <Input label="Até quando" placeholder="30/11" maxLength={40} value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} />
            <div className="v4-fi-salvar">
              <span className={["v4-t-meta", estado.tipo === "falhou" ? "v4-cv-erro" : ""].filter(Boolean).join(" ")} role={estado.tipo === "falhou" ? "alert" : "status"}>
                {estado.tipo === "parado" && mexeu ? "Alterações não salvas" : rotuloSalvar(estado, (iso) => horaCurta(iso))}
              </span>
              <Button type="submit" variant="secondary" busy={estado.tipo === "salvando"} busyLabel="Salvando o briefing">
                {estado.tipo === "falhou" ? "Tentar de novo" : "Salvar briefing"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Panel>
  );
}

export function NotasPainel({ c }: { c: ContatoCompleto }) {
  const { estado, operador } = useCRM();
  const soLeitura = useSoLeitura();
  const [criando, setCriando] = useState(false);
  const [todas, setTodas] = useState(false);
  const lista = [...c.notas].reverse();
  const notas = todas ? lista : lista.slice(0, 3);
  return (
    <Panel titulo="Notas" acoes={lista.length > 0 ? <span className="v4-t-meta v4-tabular">{lista.length}</span> : undefined}>
      {lista.length === 0 && !criando && <p className="v4-t-ui v4-t-2">Nenhuma nota ainda.</p>}
      {notas.map((n) => (
        <div key={n.id} className="v4-cv-nota">
          <p className="v4-t-ui v4-cv-nota__texto">{n.texto}</p>
          <p className="v4-t-meta">
            {n.autorId ? nomeDoOperador(estado.operadores, n.autorId, operador?.id) : "Sistema"} · {dataHora(n.em)}
          </p>
        </div>
      ))}
      {lista.length > 3 && (
        <div>
          <Button size="sm" variant="ghost" onClick={() => setTodas((v) => !v)}>
            {todas ? "Mostrar menos" : `Mostrar todas (${lista.length})`}
          </Button>
        </div>
      )}
      {!soLeitura &&
        (criando ? (
          <FormNota contatoId={c.id} aoCancelar={() => setCriando(false)} aoCriar={() => setCriando(false)} />
        ) : (
          <div>
            <Button size="sm" variant="ghost" icon="nota" onClick={() => setCriando(true)}>
              Adicionar nota
            </Button>
          </div>
        ))}
    </Panel>
  );
}
