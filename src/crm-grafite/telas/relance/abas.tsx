"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useCRM } from "@/components/crm/provider";
import { dataHora } from "@/lib/crm/format";
import type { CampanhaReciclador, IncidenteReciclador, ItemFilaReciclador, OptOutRegistro, ResultadoImportacaoCsv } from "@/domain/reciclador-types";
import Link from "@/crm-grafite/link";
import {
  Button,
  Checkbox,
  Dialog,
  EmptyState,
  Icon,
  Input,
  NoResults,
  Panel,
  SegmentedControl,
  Select,
  SidePanel,
  Switch,
  Table,
  Tag,
  Textarea,
  classesBotao,
  useToast,
  type Coluna,
} from "../../ui";
import { EstadoSalvar, useEnvio } from "../base-demais/tela";
import { salvarModeloEmber } from "../agentes/fonte";
import { criarCampanha, importarCsv, naoContatar, processarLote, salvarCampanha, simular, type DetalheRelance } from "./fonte";
import {
  DECISAO,
  ETAPAS_RELANCE,
  FILTROS_FILA,
  INCIDENTE,
  LIMITES_ENVIO,
  MODELOS_EMBER,
  MOTIVO_OPTOUT,
  STATUS_ITEM,
  TOM_ITEM,
  configDe,
  contarPorStatus,
  corpoCriar,
  corpoSalvar,
  filtrarFila,
  fonteLida,
  motivoSemLote,
  motivoSemSimular,
  nomeEtapa,
  novaInicial,
  semSigla,
  temasDoTexto,
  textoImportacao,
  textoSimulacao,
  textoTick,
  validarConfig,
  validarNaoContatar,
  validarNova,
  type ConfigRelance,
  type ErrosConfig,
  type ErrosNova,
  type FiltroFila,
  type NovaCampanha,
  type Aviso,
} from "./relance-logica";

const quando = (iso: string | null | undefined) => (iso && !Number.isNaN(Date.parse(iso)) ? dataHora(iso) : "—");

function NotaAviso({ aviso }: { aviso: Aviso }) {
  if (!aviso) return <p className="v4-sr" role="status" aria-live="polite" />;
  const cls = aviso.tom === "erro" ? " v4-nota--erro" : aviso.tom === "atencao" ? " v4-nota--atencao" : "";
  return (
    <p className={`v4-nota${cls}`} role={aviso.tom === "erro" ? "alert" : "status"}>
      <Icon name={aviso.tom === "erro" ? "erro" : aviso.tom === "atencao" ? "alerta" : "sucesso"} />
      <span>{aviso.texto}</span>
    </p>
  );
}

// ───────────────────────── Fila ─────────────────────────

export function AbaFila({
  detalhe,
  emergenciaGeral,
  gestor,
  aviso,
  setAviso,
  ciclo,
  setCiclo,
  ultimoLote,
  setUltimoLote,
  executarAcao,
  aoMudar,
}: {
  detalhe: DetalheRelance;
  emergenciaGeral: boolean;
  gestor: boolean;
  aviso: Aviso;
  setAviso: (a: Aviso) => void;
  ciclo: boolean;
  setCiclo: (v: boolean) => void;
  ultimoLote: string | null;
  setUltimoLote: (v: string | null) => void;
  executarAcao: (acao: "ativar" | "pausar" | "retomar_emergencia" | "sincronizar_crm") => Promise<void>;
  aoMudar: () => Promise<void>;
}) {
  const { contato } = useCRM();
  const { campanha, itens, metricas } = detalhe;
  const [filtro, setFiltro] = useState<FiltroFila>("todos");
  const [aberto, setAberto] = useState<ItemFilaReciclador | null>(null);
  const [ignorarJanela, setIgnorarJanela] = useState(false);
  const [ativando, setAtivando] = useState(false);
  const contagem = contarPorStatus(itens);
  const visiveis = filtrarFila(itens, filtro);
  const semSimular = motivoSemSimular(campanha.status, itens, emergenciaGeral);
  const semLote = motivoSemLote(campanha.status, emergenciaGeral);
  const emEmergencia = emergenciaGeral || campanha.status === "emergencia";

  async function simularAgora() {
    try {
      const r = await simular(campanha.id, 3);
      setAviso(textoSimulacao({ processados: r.processados, avisoLlm: r.avisoLlm ? semSigla(r.avisoLlm) : null }));
      if (r.processados > 0) setFiltro("simulado");
    } catch (e) {
      setAviso({ tom: "erro", texto: `A simulação não terminou: ${e instanceof Error ? e.message : "tente de novo."} Nenhuma mensagem foi enviada.` });
    }
    await aoMudar();
  }

  async function loteAgora() {
    try {
      const r = await processarLote(campanha.id, ignorarJanela);
      setUltimoLote(r.executadoEm);
      if (r.pausadaPorIncidente) setCiclo(false);
      setAviso(textoTick(r));
    } catch (e) {
      setAviso({ tom: "erro", texto: `O lote não rodou: ${e instanceof Error ? e.message : "tente de novo."}` });
    }
    await aoMudar();
  }

  const colunas: Coluna<ItemFilaReciclador>[] = [
    {
      id: "pessoa",
      titulo: "Pessoa",
      celula: (i) => (
        <span className="v4-rel__pessoa">
          <span className="v4-t-medium">{i.nomeContato}</span>
          <span className="v4-t-meta">{i.empresa || "Sem empresa"}</span>
        </span>
      ),
    },
    { id: "tel", titulo: "WhatsApp", celula: (i) => <span className="v4-num">{i.telefoneMascarado}</span> },
    { id: "etapa", titulo: "Etapa", celula: (i) => nomeEtapa(i.etapaAtual) },
    { id: "status", titulo: "Situação", celula: (i) => <Tag tom={TOM_ITEM[i.status]}>{STATUS_ITEM[i.status]}</Tag> },
    { id: "decisao", titulo: "O Ember", celula: (i) => (i.decisao ? DECISAO[i.decisao] ?? i.decisao : <span className="v4-t-3">Ainda não leu</span>) },
    {
      id: "resultado",
      titulo: "Resultado",
      celula: (i) => {
        const r = [i.respondeuEm ? "Respondeu" : null, i.avancouEtapa ? "Avançou" : null, i.virouVenda ? "Venda" : null].filter(Boolean);
        return r.length ? r.join(" · ") : <span className="v4-t-3">—</span>;
      },
    },
    { id: "quando", titulo: "Avaliado", celula: (i) => <span className="v4-tabular">{quando(i.processadoEm)}</span> },
    {
      id: "acao",
      titulo: "Detalhes",
      celula: (i) => (
        <Button size="sm" variant="ghost" iconEnd="chevronDireita" onClick={() => setAberto(i)}>
          Ver<span className="v4-sr"> o que o Ember leu e escreveu para {i.nomeContato}</span>
        </Button>
      ),
    },
  ];

  const c = aberto ? contato(aberto.contatoId) : null;

  return (
    <div className="v4-rel__fila">
      <Panel
        titulo={itens.length === 0 ? "Fila vazia" : `Fila · ${itens.length} ${itens.length === 1 ? "contato" : "contatos"}`}
        semRecuo
        acoes={
          gestor && (
            <Button variant="primary" icon="relance" onClick={simularAgora} disabled={Boolean(semSimular)} busyLabel="Simulando">
              Simular até 3 contatos
            </Button>
          )
        }
      >
        <div className="v4-rel__barra">
          {gestor && (
            <div className="v4-rel__controles" role="group" aria-label="Controles da campanha">
              {campanha.status === "emergencia" ? null : campanha.status === "ativa" ? (
                <Button variant="secondary" icon="cadeado" onClick={() => executarAcao("pausar")} busyLabel="Pausando">
                  Pausar campanha
                </Button>
              ) : (
                <Button variant="secondary" icon="enviar" disabled={emEmergencia || campanha.status === "concluida"} onClick={() => setAtivando(true)}>
                  Ativar envio automático
                </Button>
              )}
              <Button variant="secondary" icon="relance" disabled={Boolean(semLote)} onClick={loteAgora} busyLabel="Processando lote">
                Processar lote agora
              </Button>
              <Button variant="ghost" icon="recarregar" onClick={() => executarAcao("sincronizar_crm")} busyLabel="Buscando no CRM">
                Puxar contatos do CRM
              </Button>
            </div>
          )}
          {gestor && (
            <div className="v4-rel__controles">
              <Switch
                checked={ciclo}
                disabled={Boolean(semLote)}
                onChange={setCiclo}
                label="Rodar um lote por minuto enquanto esta tela estiver aberta"
                stateText={["Ligado", "Desligado"]}
              />
              <Checkbox label="No lote manual, ignorar o horário permitido" checked={ignorarJanela} onChange={(e) => setIgnorarJanela(e.target.checked)} />
            </div>
          )}
          <p className="v4-t-meta">
            Ritmo: até {campanha.freios.maxPorHora} por hora e {campanha.freios.maxPorDia} por dia, das {campanha.freios.janelaInicioHora}h às{" "}
            {campanha.freios.janelaFimHora}h{campanha.freios.apenasDiasUteis ? ", só em dias úteis" : ""}.{ultimoLote ? ` Último lote: ${quando(ultimoLote)}.` : ""}
            {gestor && semSimular ? ` ${semSimular}` : ""}
            {gestor && !semSimular && semLote ? ` ${semLote}` : ""}
          </p>
          <NotaAviso aviso={aviso} />
          {metricas.motivosBloqueio.length > 0 && (
            <p className="v4-t-meta">
              Por que o Ember segurou: {metricas.motivosBloqueio.map((m) => `${semSigla(m.motivo)} (${m.contagem})`).join(" · ")}
            </p>
          )}
          {itens.length > 0 && (
            <SegmentedControl
              label="Mostrar na fila"
              value={filtro}
              onChange={(v) => setFiltro(v as FiltroFila)}
              options={FILTROS_FILA.filter((f) => f.value === "todos" || contagem[f.value] > 0 || f.value === filtro).map((f) => ({ value: f.value, label: f.label, count: contagem[f.value] }))}
            />
          )}
        </div>
        <Table
          rotulo="Fila da campanha"
          linhas={visiveis}
          colunas={colunas}
          chave={(i) => i.id}
          vazio={
            itens.length > 0 ? (
              <NoResults titulo="Ninguém nesta situação" texto="Troque o filtro para ver o resto da fila." aoLimpar={() => setFiltro("todos")} />
            ) : (
              <EmptyState
                titulo="A fila está vazia"
                texto={gestor ? "Use Puxar contatos do CRM para trazer quem está parado e tem histórico, ou importe uma lista com contexto." : "O dono adiciona os contatos da campanha."}
              />
            )
          }
        />
      </Panel>

      <SidePanel open={Boolean(aberto)} onClose={() => setAberto(null)} title={aberto ? `O que o Ember leu · ${aberto.nomeContato}` : "Detalhes"}>
        {aberto && (
          <div className="v4-rel__auditoria">
            <dl className="v4-fatos">
              <dt>Situação</dt>
              <dd>
                {STATUS_ITEM[aberto.status]}
                {aberto.decisao && ` · ${DECISAO[aberto.decisao] ?? aberto.decisao}`}
              </dd>
              <dt>Motivo</dt>
              <dd>{aberto.motivo ? semSigla(aberto.motivo) : "Aguardando o Ember."}</dd>
              <dt>Leu</dt>
              <dd>{aberto.fontesLidas.map(fonteLida).join(" · ") || "Nada ainda."}</dd>
              <dt>Gancho</dt>
              <dd>{aberto.ganchoIdentificado || "Nenhum."}</dd>
              <dt>Etapa</dt>
              <dd>
                {nomeEtapa(aberto.etapaInicial)}
                {aberto.etapaAtual !== aberto.etapaInicial && ` → ${nomeEtapa(aberto.etapaAtual)}`}
              </dd>
              <dt>Na fila desde</dt>
              <dd className="v4-tabular">{quando(aberto.criadoEm)}</dd>
              <dt>Avaliado</dt>
              <dd className="v4-tabular">{quando(aberto.processadoEm)}</dd>
              <dt>Respondeu</dt>
              <dd className="v4-tabular">{quando(aberto.respondeuEm)}</dd>
              <dt>Resultado</dt>
              <dd>{[aberto.avancouEtapa ? "Avançou no funil" : null, aberto.virouVenda ? "Virou venda" : null].filter(Boolean).join(" · ") || "—"}</dd>
              <dt>Entrega</dt>
              <dd>{aberto.messageIdWhatsapp ? `Enviado pelo WhatsApp${aberto.providerWhatsapp ? ` (${aberto.providerWhatsapp})` : ""}` : "Não enviado"}</dd>
              <dt>Modelo de IA</dt>
              <dd>{aberto.modeloUsado ?? "—"}</dd>
              <dt>Custo de IA</dt>
              <dd className="v4-tabular">{aberto.custoTokens > 0 ? `${aberto.custoTokens.toLocaleString("pt-BR")} tokens` : "—"}</dd>
            </dl>
            <div className="v4-rel__bloco">
              <h3 className="v4-t-ui v4-t-strong">Contexto lido</h3>
              <p className="v4-texto-longo v4-t-2">{aberto.contextoExtraido || "Ainda não lido."}</p>
            </div>
            {aberto.mensagemGerada && (
              <div className="v4-rel__bloco">
                <h3 className="v4-t-ui v4-t-strong">{aberto.status === "enviado" ? "Mensagem enviada" : "Texto que o Ember mandaria (não enviado)"}</h3>
                <blockquote className="v4-rel__mensagem">{aberto.mensagemGerada}</blockquote>
              </div>
            )}
            {c && (
              <div className="v4-form__acoes">
                <Link className="v4-link" href={`/conversas?c=${encodeURIComponent(c.id)}`}>
                  Abrir conversa
                </Link>
                <Link className="v4-link" href={`/contatos/${encodeURIComponent(c.id)}`}>
                  Abrir ficha
                </Link>
              </div>
            )}
          </div>
        )}
      </SidePanel>

      <Dialog
        open={ativando}
        onClose={() => setAtivando(false)}
        title="Ativar o envio automático?"
        description={`Com a campanha ativa, a cada lote o Ember envia a primeira mensagem sozinho para quem ele decidir abordar: até ${campanha.freios.maxPorHora} por hora e ${campanha.freios.maxPorDia} por dia, das ${campanha.freios.janelaInicioHora}h às ${campanha.freios.janelaFimHora}h. Sem chave de IA ou sem WhatsApp, nada sai. Dá para pausar ou parar a qualquer momento.`}
        footer={({ fechar }) => (
          <>
            <Button variant="secondary" onClick={fechar}>
              Continuar em rascunho
            </Button>
            <Button
              variant="primary"
              icon="enviar"
              busyLabel="Ativando"
              onClick={async () => {
                await executarAcao("ativar");
                setAtivando(false);
              }}
            >
              Ativar envio
            </Button>
          </>
        )}
      >
        <p className="v4-t-meta">Simular antes mostra o que o Ember escreveria, sem enviar nada.</p>
      </Dialog>
    </div>
  );
}

// ───────────────────────── Incidentes ─────────────────────────

export function AbaIncidentes({ incidentes }: { incidentes: IncidenteReciclador[] }) {
  return (
    <Panel titulo="Incidentes" semRecuo>
      <Table
        rotulo="Incidentes da campanha e gerais, do mais novo ao mais antigo"
        linhas={incidentes}
        chave={(x) => x.id}
        colunas={[
          {
            id: "tipo",
            titulo: "O que houve",
            celula: (x) => <Tag tom={x.tipo === "rate_limit" || x.tipo === "sem_llm" ? "atencao" : "erro"}>{INCIDENTE[x.tipo] ?? x.tipo}</Tag>,
          },
          { id: "quando", titulo: "Quando", celula: (x) => <span className="v4-tabular">{quando(x.em)}</span> },
          { id: "onde", titulo: "Onde", celula: (x) => (x.campanhaId ? "Nesta campanha" : "Todas as campanhas") },
          { id: "detalhe", titulo: "Detalhe", quebrar: true, celula: (x) => semSigla(x.detalhe) },
        ]}
        vazio={<p className="v4-t-meta">Nenhum incidente registrado. Se o WhatsApp cair ou o limite estourar, o Ember pausa a campanha e registra aqui.</p>}
      />
    </Panel>
  );
}

// ───────────────────────── Nova campanha ─────────────────────────

export function FormNova({ modeloPadrao, aoCriar, aoCancelar }: { modeloPadrao: string; aoCriar: (id: string) => Promise<void>; aoCancelar?: () => void }) {
  const robo = useCRM().estado.config.nomeRobo || "Cláudio";
  const [n, setN] = useState<NovaCampanha>(novaInicial);
  const [erros, setErros] = useState<ErrosNova>({});
  const [tentou, setTentou] = useState(false);
  const { estado, enviar, editar } = useEnvio();

  function mudar(x: NovaCampanha) {
    setN(x);
    editar();
    if (tentou) setErros(validarNova(x));
  }

  async function criar(e: FormEvent) {
    e.preventDefault();
    setTentou(true);
    const v = validarNova(n);
    setErros(v);
    if (Object.keys(v).length > 0) return;
    let id = "";
    const ok = await enviar(async () => {
      try {
        id = (await criarCampanha(corpoCriar(n, modeloPadrao))).id;
        return { ok: true };
      } catch (err) {
        return { ok: false, erro: err instanceof Error ? err.message : "tente de novo." };
      }
    });
    if (ok && id) await aoCriar(id);
  }

  const nErros = Object.keys(erros).length;
  return (
    <form className="v4-form" onSubmit={criar} noValidate>
      <fieldset className="v4-form__grupo">
        <legend>Campanha</legend>
        <div className="v4-form__campos">
          <Input label="Nome da campanha" required maxLength={120} placeholder="Ex.: Briefings parados de outubro" value={n.nome} error={erros.nome} onChange={(e) => mudar({ ...n, nome: e.target.value })} />
          <Input
            label="Objetivo em uma frase"
            required
            maxLength={2000}
            placeholder="Ex.: retomar quem já contou a dor e oferecer uma conversa de 15 minutos"
            value={n.objetivo}
            error={erros.objetivo}
            onChange={(e) => mudar({ ...n, objetivo: e.target.value })}
          />
        </div>
      </fieldset>
      <fieldset className="v4-form__grupo">
        <legend>Quem entra</legend>
        <div className="v4-checks" role="group" aria-label="Etapas que entram">
          {ETAPAS_RELANCE.map((et) => (
            <Checkbox
              key={et.id}
              label={et.label}
              checked={n.etapas.includes(et.id)}
              onChange={(e) => mudar({ ...n, etapas: e.target.checked ? [...n.etapas, et.id] : n.etapas.filter((x) => x !== et.id) })}
            />
          ))}
        </div>
        {erros.etapas && (
          <p className="v4-field__error">
            <Icon name="alerta" />
            <span>{erros.etapas}</span>
          </p>
        )}
        <div className="v4-form__campos">
          <Input
            label="Parado no CRM há pelo menos"
            required
            inputMode="numeric"
            value={n.horasParadoMin}
            error={erros.horasParadoMin}
            help="Em horas. 72 horas são 3 dias."
            onChange={(e) => mudar({ ...n, horasParadoMin: e.target.value })}
          />
        </div>
        <div className="v4-checks v4-checks--coluna">
          <Checkbox label="Deixar de fora quem não tem histórico, nota ou briefing" checked={n.apenasComContexto} onChange={(e) => mudar({ ...n, apenasComContexto: e.target.checked })} />
          <Checkbox label="Já trazer para a fila quem está parado no CRM" checked={n.popularDoCrm} onChange={(e) => mudar({ ...n, popularDoCrm: e.target.checked })} />
        </div>
      </fieldset>
      <fieldset className="v4-form__grupo">
        <legend>Quando a pessoa responder</legend>
        <div className="v4-form__campos">
          <Select
            label="Quem atende"
            value={n.entregarPara}
            onChange={(e) => mudar({ ...n, entregarPara: e.target.value as NovaCampanha["entregarPara"] })}
            options={[
              { value: "claudio", label: `${robo}, o robô de atendimento` },
              { value: "humano", label: "Uma pessoa da equipe" },
            ]}
          />
        </div>
        <div className="v4-checks v4-checks--coluna">
          {n.entregarPara === "claudio" && (
            <Checkbox label={`${robo} pode responder sozinho quando a pessoa voltar`} checked={n.autoResponderClaudio} onChange={(e) => mudar({ ...n, autoResponderClaudio: e.target.checked })} />
          )}
          <Checkbox label="Proibir preço, valor ou parcela na primeira mensagem" checked={n.proibirPreco} onChange={(e) => mudar({ ...n, proibirPreco: e.target.checked })} />
        </div>
        <p className="v4-t-meta">Conteúdo, tom e limites de envio começam com o padrão e você ajusta em Intenção e limites. A campanha nasce como rascunho.</p>
      </fieldset>
      <div className="v4-form__acoes">
        <Button type="submit" variant="primary" busy={estado.fase === "salvando"} busyLabel="Criando">
          Criar rascunho
        </Button>
        {aoCancelar && (
          <Button variant="ghost" onClick={aoCancelar}>
            Cancelar
          </Button>
        )}
        {nErros > 0 && estado.fase !== "salvando" ? (
          <p className="v4-salvar v4-salvar--erro" role="alert">
            <Icon name="alerta" />
            <span>{nErros === 1 ? "Um campo precisa de ajuste" : `${nErros} campos precisam de ajuste`}. Nada foi criado.</span>
          </p>
        ) : (
          <EstadoSalvar estado={estado} />
        )}
      </div>
    </form>
  );
}

// ───────────────────────── Intenção e limites ─────────────────────────

type TextosNumero = Partial<Record<string, string>>;

export function AbaConfig({ campanha, gestor, modeloPadrao, aoSalvar }: { campanha: CampanhaReciclador; gestor: boolean; modeloPadrao: string; aoSalvar: () => Promise<void> }) {
  const robo = useCRM().estado.config.nomeRobo || "Cláudio";
  const [c, setC] = useState<ConfigRelance>(() => configDe(campanha));
  const [textos, setTextos] = useState<TextosNumero>({ temasProibidos: campanha.fontes.temasProibidos.join("\n") });
  const [erros, setErros] = useState<ErrosConfig>({});
  const [tentou, setTentou] = useState(false);
  const [padrao, setPadrao] = useState(false);
  const { estado, enviar, editar } = useEnvio();
  const modeloConhecido = MODELOS_EMBER.some((m) => m.value === c.cercas.modeloLlm);
  const [outroModelo, setOutroModelo] = useState(!modeloConhecido);

  function mudar(n: ConfigRelance, t: TextosNumero = textos) {
    setC(n);
    editar();
    if (tentou) setErros(validarConfig(n, t));
  }
  function numero(chave: string, bruto: string, aplicar: (v: number) => ConfigRelance) {
    const t = { ...textos, [chave]: bruto };
    setTextos(t);
    const v = Number(bruto.trim().replace(",", "."));
    mudar(Number.isFinite(v) && bruto.trim() !== "" ? aplicar(v) : c, t);
  }
  const t = (k: string, v: number) => textos[k] ?? String(v);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setTentou(true);
    const v = validarConfig(c, textos);
    setErros(v);
    if (Object.keys(v).length > 0) return;
    await enviar(async () => {
      try {
        await salvarCampanha(campanha.id, corpoSalvar(c));
      } catch (err) {
        return { ok: false, erro: err instanceof Error ? err.message : "tente de novo." };
      }
      if (padrao && c.cercas.modeloLlm.trim() !== modeloPadrao) {
        try {
          await salvarModeloEmber(c.cercas.modeloLlm.trim());
        } catch (err) {
          return { ok: false, parcial: "A campanha foi salva.", erro: `o modelo padrão não mudou (${err instanceof Error ? err.message : "erro no servidor"}).` };
        }
      }
      return { ok: true };
    });
    await aoSalvar();
  }

  const nErros = Object.keys(erros).length;

  return (
    <Panel titulo="Intenção e limites">
      <form className="v4-form" onSubmit={salvar} noValidate>
        {!gestor && <p className="v4-t-meta">Só o dono altera a campanha. Você vê o que está configurado.</p>}
        <fieldset className="v4-form__grupo" disabled={!gestor}>
          <legend>Campanha</legend>
          <div className="v4-form__campos">
            <Input label="Nome da campanha" required maxLength={120} value={c.nome} error={erros.nome} onChange={(e) => mudar({ ...c, nome: e.target.value })} />
            <Input label="Objetivo em uma frase" required maxLength={2000} value={c.objetivo} error={erros.objetivo} onChange={(e) => mudar({ ...c, objetivo: e.target.value })} />
          </div>
        </fieldset>

        <fieldset className="v4-form__grupo" disabled={!gestor}>
          <legend>Quem entra na fila</legend>
          <div className="v4-checks" role="group" aria-label="Etapas que entram">
            {ETAPAS_RELANCE.map((et) => (
              <Checkbox
                key={et.id}
                label={et.label}
                checked={c.filtro.etapas.includes(et.id)}
                onChange={(e) => mudar({ ...c, filtro: { ...c.filtro, etapas: e.target.checked ? [...c.filtro.etapas, et.id] : c.filtro.etapas.filter((x) => x !== et.id) } })}
              />
            ))}
          </div>
          {erros.etapas && (
            <p className="v4-field__error">
              <Icon name="alerta" />
              <span>{erros.etapas}</span>
            </p>
          )}
          <div className="v4-form__campos">
            <Input
              label="Parado no CRM há pelo menos"
              required
              inputMode="numeric"
              value={t("horasParadoMin", c.filtro.horasParadoMin)}
              error={erros.horasParadoMin}
              help="Em horas. 72 horas são 3 dias."
              onChange={(e) => numero("horasParadoMin", e.target.value, (v) => ({ ...c, filtro: { ...c.filtro, horasParadoMin: v } }))}
            />
          </div>
          <Checkbox
            label="Exigir contexto mínimo (conversa, nota ou briefing) para entrar na fila"
            checked={c.filtro.apenasComContexto}
            onChange={(e) => mudar({ ...c, filtro: { ...c.filtro, apenasComContexto: e.target.checked } })}
          />
        </fieldset>

        <fieldset className="v4-form__grupo" disabled={!gestor}>
          <legend>O que o Ember pode usar</legend>
          <div className="v4-checks">
            <Checkbox label="Ler o histórico de mensagens" checked={c.fontes.usarHistoricoMensagens} onChange={(e) => mudar({ ...c, fontes: { ...c.fontes, usarHistoricoMensagens: e.target.checked } })} />
            <Checkbox label="Ler notas e briefings" checked={c.fontes.usarNotas} onChange={(e) => mudar({ ...c, fontes: { ...c.fontes, usarNotas: e.target.checked } })} />
          </div>
          <div className="v4-form__campos">
            <Textarea
              label="Conteúdo real do seu negócio"
              rows={4}
              maxLength={16000}
              value={c.fontes.baseConteudo}
              help="Artigos, materiais, diagnósticos ou ideias que o Ember pode oferecer como gancho verdadeiro. Não invente resultados."
              onChange={(e) => mudar({ ...c, fontes: { ...c.fontes, baseConteudo: e.target.value } })}
            />
            <Textarea
              label="Novidades do mercado"
              rows={4}
              maxLength={5000}
              value={c.fontes.novidadesMercado}
              help="Opcional. Fatos concretos do setor que você mesmo informa (prazos, mudanças, sazonalidade)."
              onChange={(e) => mudar({ ...c, fontes: { ...c.fontes, novidadesMercado: e.target.value } })}
            />
          </div>
        </fieldset>

        <fieldset className="v4-form__grupo" disabled={!gestor}>
          <legend>Tom, cercas e destino</legend>
          <div className="v4-form__campos">
            <Textarea
              label="Tom da marca na abertura"
              required
              rows={3}
              maxLength={1000}
              value={c.cercas.tomMarca}
              error={erros.tomMarca}
              onChange={(e) => mudar({ ...c, cercas: { ...c.cercas, tomMarca: e.target.value } })}
            />
            <Textarea
              label="Temas ou palavras proibidas"
              rows={3}
              maxLength={4000}
              value={textos.temasProibidos ?? ""}
              help="Um por linha ou separados por vírgula."
              onChange={(e) => {
                const tt = { ...textos, temasProibidos: e.target.value };
                setTextos(tt);
                mudar({ ...c, fontes: { ...c.fontes, temasProibidos: temasDoTexto(e.target.value) } }, tt);
              }}
            />
          </div>
          <div className="v4-checks v4-checks--coluna">
            <Checkbox label="Proibir preço, valor ou parcela na primeira mensagem" checked={c.cercas.proibirPreco} onChange={(e) => mudar({ ...c, cercas: { ...c.cercas, proibirPreco: e.target.checked } })} />
          </div>
          <div className="v4-form__campos">
            <Select
              label="Quem atende quando a pessoa responde"
              value={c.cercas.entregarPara}
              onChange={(e) => mudar({ ...c, cercas: { ...c.cercas, entregarPara: e.target.value as ConfigRelance["cercas"]["entregarPara"] } })}
              options={[
                { value: "claudio", label: `${robo}, o robô de atendimento` },
                { value: "humano", label: "Uma pessoa da equipe" },
              ]}
            />
            <Select
              label="Modelo de IA do Ember nesta campanha"
              value={outroModelo ? "__outro" : c.cercas.modeloLlm}
              error={outroModelo ? undefined : erros.modeloLlm}
              onChange={(e) => {
                if (e.target.value === "__outro") {
                  setOutroModelo(true);
                  return;
                }
                setOutroModelo(false);
                mudar({ ...c, cercas: { ...c.cercas, modeloLlm: e.target.value } });
              }}
              options={[...MODELOS_EMBER.map((m) => ({ value: m.value, label: m.label })), { value: "__outro", label: "Outro modelo" }]}
              help={modeloPadrao ? `Padrão para novas campanhas: ${modeloPadrao}.` : undefined}
            />
            {outroModelo && (
              <Input
                label="Nome exato do modelo"
                required
                spellCheck={false}
                value={c.cercas.modeloLlm}
                error={erros.modeloLlm}
                help="Como aparece na conta da IA, por exemplo claude-sonnet-4-5."
                onChange={(e) => mudar({ ...c, cercas: { ...c.cercas, modeloLlm: e.target.value } })}
              />
            )}
          </div>
          <div className="v4-checks v4-checks--coluna">
            {c.cercas.entregarPara === "claudio" && (
              <Checkbox
                label={`${robo} pode responder sozinho quando a pessoa voltar`}
                checked={c.cercas.autoResponderClaudio}
                onChange={(e) => mudar({ ...c, cercas: { ...c.cercas, autoResponderClaudio: e.target.checked } })}
              />
            )}
            <Checkbox label="Usar este modelo também como padrão para novas campanhas" checked={padrao} onChange={(e) => setPadrao(e.target.checked)} />
          </div>
        </fieldset>

        <fieldset className="v4-form__grupo" disabled={!gestor}>
          <legend>Limites de envio</legend>
          <div className="v4-form__campos">
            {LIMITES_ENVIO.map((l) => (
              <Input
                key={l.chave}
                label={l.label}
                required
                inputMode="numeric"
                value={t(l.chave, c.freios[l.chave])}
                error={erros[l.chave]}
                help={l.ajuda ?? `De ${l.min} a ${l.max} ${l.unidade}.`}
                onChange={(e) => numero(l.chave, e.target.value, (v) => ({ ...c, freios: { ...c.freios, [l.chave]: v } }))}
              />
            ))}
          </div>
          <Checkbox label="Enviar só em dias úteis (segunda a sexta)" checked={c.freios.apenasDiasUteis} onChange={(e) => mudar({ ...c, freios: { ...c.freios, apenasDiasUteis: e.target.checked } })} />
          <p className="v4-t-meta">Limites baixos protegem o número de WhatsApp contra bloqueio. Quem pediu para parar nunca recebe, com qualquer limite.</p>
        </fieldset>

        {gestor && (
          <div className="v4-form__acoes">
            <Button type="submit" variant="primary" busy={estado.fase === "salvando"} busyLabel="Salvando">
              Salvar intenção e limites
            </Button>
            {nErros > 0 && estado.fase !== "salvando" ? (
              <p className="v4-salvar v4-salvar--erro" role="alert">
                <Icon name="alerta" />
                <span>{nErros === 1 ? "Um campo precisa de ajuste" : `${nErros} campos precisam de ajuste`}. Nada foi salvo.</span>
              </p>
            ) : (
              <EstadoSalvar estado={estado} />
            )}
          </div>
        )}
      </form>
    </Panel>
  );
}

// ───────────────────────── Importar ─────────────────────────

export function AbaImportar({ campanha, aoMudar }: { campanha: CampanhaReciclador; aoMudar: () => Promise<void> }) {
  const toast = useToast();
  const [csv, setCsv] = useState("");
  const [arquivo, setArquivo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoImportacaoCsv | null>(null);
  const { estado, enviar } = useEnvio();
  const bloqueada = campanha.status === "emergencia" || campanha.status === "concluida";

  async function lerArquivo(ev: ChangeEvent<HTMLInputElement>) {
    const f = ev.target.files?.[0];
    if (!f) return;
    setCsv(await f.text());
    setArquivo(f.name);
    setErro(null);
    setResultado(null);
    ev.target.value = "";
  }

  async function importar(e: FormEvent) {
    e.preventDefault();
    if (!csv.trim()) {
      setErro("Cole as linhas ou escolha um arquivo .csv antes de importar.");
      return;
    }
    let r: ResultadoImportacaoCsv | null = null;
    const ok = await enviar(async () => {
      try {
        r = await importarCsv(campanha.id, csv);
        return { ok: true };
      } catch (err) {
        return { ok: false, erro: err instanceof Error ? err.message : "tente de novo." };
      }
    });
    if (ok && r) {
      setResultado(r);
      setCsv("");
      setArquivo(null);
      toast.avisar({ tom: "sucesso", titulo: "Lista avaliada", texto: textoImportacao(r) });
      await aoMudar();
    }
  }

  return (
    <div className="v4-rel__fila">
      <Panel titulo="Importar lista com contexto">
        <form className="v4-form" onSubmit={importar} noValidate>
          <p className="v4-t-ui v4-t-2">
            Lista com história entra; lista fria, só com telefone, fica de fora. Cada linha precisa de contexto ou notas reais: é disso que o Ember tira o gancho.
            Quem pediu para não ser contatado é barrado.
          </p>
          <p className="v4-t-meta">
            Primeira linha (cabeçalho): <code className="v4-rel__codigo">nome,telefone,empresa,contexto,notas,etapa</code>. Use aspas quando o texto tiver vírgula.
          </p>
          <div className="v4-rel__arquivo">
            <label className={classesBotao({ variant: "secondary" })}>
              <span className="v4-btn__label">
                <Icon name="mais_" />
                Escolher arquivo .csv
              </span>
              <input className="v4-sr" type="file" accept=".csv,text/csv" onChange={lerArquivo} />
            </label>
            {arquivo && <span className="v4-t-meta">Arquivo: {arquivo}</span>}
          </div>
          <Textarea
            label="Linhas do CSV"
            rows={8}
            maxLength={200000}
            spellCheck={false}
            value={csv}
            error={erro ?? undefined}
            help="Ou cole aqui o conteúdo da planilha salva como CSV."
            onChange={(e) => {
              setCsv(e.target.value);
              setArquivo(null);
              if (erro) setErro(null);
            }}
          />
          <div className="v4-form__acoes">
            <Button type="submit" variant="primary" busy={estado.fase === "salvando"} busyLabel="Importando" disabled={bloqueada}>
              Importar para esta campanha
            </Button>
            {csv && (
              <Button
                variant="ghost"
                onClick={() => {
                  setCsv("");
                  setArquivo(null);
                }}
              >
                Limpar
              </Button>
            )}
            {bloqueada ? <p className="v4-t-meta">Campanha parada ou concluída não aceita importação.</p> : <EstadoSalvar estado={estado} />}
          </div>
        </form>
      </Panel>

      {resultado && (
        <Panel titulo="Resultado da importação" semRecuo>
          <dl className="v4-indicadores v4-rel__resultado" aria-label="Resumo da importação">
            <div>
              <dt>Linhas lidas</dt>
              <dd>{resultado.totalLinhas}</dd>
            </div>
            <div>
              <dt>Entraram na fila</dt>
              <dd>{resultado.importados}</dd>
            </div>
            <div>
              <dt>Sem contexto</dt>
              <dd>{resultado.rejeitadosSemContexto}</dd>
            </div>
            <div>
              <dt>Pediram para não ser contatados</dt>
              <dd>{resultado.rejeitadosOptOut}</dd>
            </div>
            <div>
              <dt>Telefone inválido</dt>
              <dd>{resultado.rejeitadosTelefoneInvalido}</dd>
            </div>
          </dl>
          <Table
            rotulo="Linhas que ficaram de fora e o motivo"
            linhas={resultado.detalhesRejeicao.map((r, i) => ({ ...r, k: `${r.linha}-${i}` }))}
            chave={(r) => r.k}
            colunas={[
              { id: "linha", titulo: "Linha", numerica: true, celula: (r) => <span className="v4-num">{r.linha}</span> },
              { id: "nome", titulo: "Contato", celula: (r) => r.nome || "—" },
              { id: "motivo", titulo: "Por que ficou de fora", quebrar: true, celula: (r) => semSigla(r.motivo) },
            ]}
            vazio={<p className="v4-t-meta">Nenhuma linha ficou de fora.</p>}
          />
        </Panel>
      )}
    </div>
  );
}

// ───────────────────────── Não contatar ─────────────────────────

export function AbaNaoContatar({ optOuts, podeAgir, aoMudar }: { optOuts: OptOutRegistro[]; podeAgir: boolean; aoMudar: () => Promise<void> }) {
  const [tel, setTel] = useState("");
  const [nome, setNome] = useState("");
  const [evid, setEvid] = useState("");
  const [erros, setErros] = useState<{ tel?: string; evid?: string }>({});
  const { estado, enviar, editar } = useEnvio();
  const [bloqueados, setBloqueados] = useState<number | null>(null);

  async function registrar(e: FormEvent) {
    e.preventDefault();
    const v = validarNaoContatar(tel, evid);
    setErros(v);
    if (v.tel || v.evid) return;
    let n = 0;
    const ok = await enviar(async () => {
      try {
        n = (await naoContatar({ telefone: tel.trim(), nomeContato: nome.trim() || undefined, evidencia: evid.trim() })).itensBloqueados ?? 0;
        return { ok: true };
      } catch (err) {
        return { ok: false, erro: err instanceof Error ? err.message : "tente de novo." };
      }
    });
    if (ok) {
      setTel("");
      setNome("");
      setEvid("");
      setBloqueados(n);
      await aoMudar();
    }
  }

  const lista = [...optOuts].sort((a, b) => b.registradoEm.localeCompare(a.registradoEm));

  return (
    <div className="v4-rel__fila">
      {podeAgir && (
        <Panel titulo="Registrar pedido de não contato">
          <form className="v4-form" onSubmit={registrar} noValidate>
            <p className="v4-t-ui v4-t-2">Vale para todas as campanhas do Ember. Se o número estiver esperando em alguma fila, ele é bloqueado na hora.</p>
            <div className="v4-form__campos">
              <Input
                label="Telefone com DDD"
                required
                type="tel"
                autoComplete="off"
                maxLength={30}
                placeholder="(11) 99999-9999"
                value={tel}
                error={erros.tel}
                onChange={(e) => {
                  setTel(e.target.value);
                  editar();
                }}
              />
              <Input label="Nome" maxLength={120} value={nome} help="Opcional." onChange={(e) => setNome(e.target.value)} />
              <Input
                label="De onde veio o pedido"
                required
                maxLength={1000}
                value={evid}
                error={erros.evid}
                help="Ex.: pediu para parar na conversa de 10/11."
                onChange={(e) => {
                  setEvid(e.target.value);
                  editar();
                }}
              />
            </div>
            <div className="v4-form__acoes">
              <Button type="submit" variant="secondary" busy={estado.fase === "salvando"} busyLabel="Registrando">
                Registrar não contato
              </Button>
              <EstadoSalvar estado={estado} />
              {estado.fase === "salvo" && bloqueados != null && bloqueados > 0 && (
                <p className="v4-t-meta">
                  {bloqueados} {bloqueados === 1 ? "item da fila foi bloqueado" : "itens da fila foram bloqueados"}.
                </p>
              )}
            </div>
          </form>
        </Panel>
      )}
      <Panel titulo={`Quem não pode ser contatado (${lista.length})`} semRecuo>
        <Table
          rotulo="Pedidos de não contato registrados, do mais novo ao mais antigo"
          linhas={lista}
          chave={(o) => o.id}
          colunas={[
            { id: "quem", titulo: "Pessoa", celula: (o) => o.nomeContato || <span className="v4-t-3">Sem nome</span> },
            { id: "tel", titulo: "WhatsApp", celula: (o) => <span className="v4-num">{o.telefoneMascarado}</span> },
            { id: "motivo", titulo: "Motivo", celula: (o) => MOTIVO_OPTOUT[o.motivo] ?? o.motivo },
            { id: "evid", titulo: "De onde veio", quebrar: true, celula: (o) => semSigla(o.evidencia) },
            { id: "em", titulo: "Registrado", celula: (o) => <span className="v4-tabular">{quando(o.registradoEm)}</span> },
            { id: "ate", titulo: "Vale até", celula: (o) => (o.expiraEm ? <span className="v4-tabular">{quando(o.expiraEm)}</span> : "Sem prazo") },
          ]}
          vazio={<p className="v4-t-meta">Nenhum pedido registrado. Quem pede para parar na conversa também entra aqui sozinho.</p>}
        />
      </Panel>
    </div>
  );
}
