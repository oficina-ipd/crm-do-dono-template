/**
 * Ficha · histórico 360 da pessoa. Regras PURAS (sem React, sem rede), portadas do IPD
 * (`lib/pessoa-360`: eventos, normalizar, resumo) para o que o CRM do dono guarda de um contato:
 * mensagens, ligações, e-mails, propostas, pagamentos, movimentos de etapa, tarefas, notas e
 * ocorrências. O que o template não guarda (visita ao site, abertura e clique de e-mail, portal,
 * compras de checkout, vínculo com outras bases) não aparece nem vira zero.
 *
 * Datas: o dia e a hora seguem o fuso do navegador; `tz` fixa o fuso (testes e quem quiser fixar).
 * Testes: tests/unit/grafite-ficha-360.test.ts (rodam com TZ=America/Sao_Paulo e TZ=UTC).
 */
import { etapaDe } from "@/domain/funil";
import { formatarReais, primeiroNome } from "@/domain/rules";
import type { ContatoCompleto, EstadoCRM, Mensagem } from "@/domain/types";
import { nomeDoOperador, type NomesConversa } from "../conversas/modelo";
import { autorDoMovimento } from "./modelo";

// ───────── Tipos e filtros ─────────

export const TIPOS_360 = ["conversa", "ligacao", "email", "proposta", "pagamento", "etapa", "tarefa", "nota", "ocorrencia"] as const;
export type Tipo360 = (typeof TIPOS_360)[number];

export const FILTROS_360 = ["tudo", "conversas", "emails", "propostas", "pagamentos", "crm"] as const;
export type Filtro360 = (typeof FILTROS_360)[number];

export const ROTULO_FILTRO_360: Record<Filtro360, string> = {
  tudo: "Tudo",
  conversas: "Conversas",
  emails: "E-mails",
  propostas: "Propostas",
  pagamentos: "Pagamentos",
  crm: "CRM",
};

/** Que tipos de evento cada filtro mostra. */
export const TIPOS_DO_FILTRO: Record<Filtro360, readonly Tipo360[]> = {
  tudo: TIPOS_360,
  conversas: ["conversa", "ligacao"],
  emails: ["email"],
  propostas: ["proposta"],
  pagamentos: ["pagamento"],
  crm: ["etapa", "tarefa", "nota", "ocorrencia"],
};

export const ROTULO_TIPO_360: Record<Tipo360, string> = {
  conversa: "Conversa",
  ligacao: "Ligação",
  email: "E-mail",
  proposta: "Proposta",
  pagamento: "Pagamento",
  etapa: "Etapa",
  tarefa: "Tarefa",
  nota: "Nota",
  ocorrencia: "Ocorrência",
};

/** Filtros da linha do tempo antiga (`?mostrar=mensagem` etc.) continuam abrindo no lugar certo. */
const FILTRO_ANTIGO: Record<string, Filtro360> = { mensagem: "conversas", ligacao: "conversas", nota: "crm", movimento: "crm", tarefa: "crm" };

export function filtro360Valido(v: unknown): Filtro360 {
  const s = String(v ?? "");
  if ((FILTROS_360 as readonly string[]).includes(s)) return s as Filtro360;
  return FILTRO_ANTIGO[s] ?? "tudo";
}

export type TomEstado = "neutro" | "bom" | "atencao" | "erro";

export interface Evento360 {
  /** Estável: `<fonte>:<chave>`. */
  id: string;
  tipo: Tipo360;
  /** ISO em UTC com milissegundos. */
  quando: string;
  titulo: string;
  /** Linhas que aparecem ao abrir o evento. */
  detalhe: string[];
  /** De onde veio, em palavras ("WhatsApp", "Telefone", "E-mail", "CRM"…). */
  origem: string;
  /** Situação do evento, quando ele tem uma ("Sem resposta no dia", "Pago", "Atrasada"). */
  estado: { rotulo: string; tom: TomEstado } | null;
}

/** ISO canônico (UTC, milissegundos) ou null se a data não for válida. */
export function isoCanonico(v: unknown): string | null {
  if (typeof v !== "string" || !v) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/** Mais recente primeiro; no mesmo instante, id maior primeiro (ordem estável). */
export function compararEventos(a: Pick<Evento360, "quando" | "id">, b: Pick<Evento360, "quando" | "id">): number {
  if (a.quando !== b.quando) return a.quando < b.quando ? 1 : -1;
  if (a.id !== b.id) return a.id < b.id ? 1 : -1;
  return 0;
}

// ───────── Datas no fuso ─────────

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(chave: string, tz: string | undefined, opcoes: Intl.DateTimeFormatOptions, locale = "pt-BR"): Intl.DateTimeFormat {
  const k = `${chave}|${tz ?? ""}`;
  let f = fmtCache.get(k);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, { timeZone: tz, ...opcoes });
    fmtCache.set(k, f);
  }
  return f;
}

/** Chave AAAA-MM-DD do dia (no fuso) em que o instante cai. */
export function chaveDia(iso: string, tz?: string): string {
  return fmt("dia", tz, { year: "numeric", month: "2-digit", day: "2-digit" }, "en-CA").format(new Date(iso));
}

/** Hora cheia (0 a 23) no fuso. */
export function horaDoDia(iso: string, tz?: string): number {
  const h = Number(fmt("h", tz, { hour: "2-digit", hourCycle: "h23" }, "en-GB").format(new Date(iso)));
  return h === 24 ? 0 : h;
}

export const hora = (iso: string, tz?: string) => fmt("hm", tz, { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
export const diaHora = (iso: string, tz?: string) => fmt("dhm", tz, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
export const dataCurta = (iso: string, tz?: string) => fmt("data", tz, { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));

/** Agrupa (já ordenados do mais recente para o mais antigo) pelo dia do fuso. */
export function agruparPorDia(ev: Evento360[], tz?: string): Array<{ dia: string; eventos: Evento360[] }> {
  const grupos: Array<{ dia: string; eventos: Evento360[] }> = [];
  for (const e of ev) {
    const dia = chaveDia(e.quando, tz);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.dia === dia) ultimo.eventos.push(e);
    else grupos.push({ dia, eventos: [e] });
  }
  return grupos;
}

// ───────── Textos ─────────

export function cortar(t: string, n = 160): string {
  const s = t.replace(/\s+/g, " ").trim();
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/** "3 min 20 s", "45 s", "1 h 05 min". */
export function duracao(segundos: number): string {
  const s = Math.max(0, Math.round(segundos));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return s % 60 ? `${m} min ${s % 60} s` : `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`;
}

const vezes = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const estado = (rotulo: string, tom: TomEstado = "neutro") => ({ rotulo, tom });

// ───────── Montagem ─────────

export type Contexto360 = NomesConversa & {
  funis: Pick<EstadoCRM["funis"][number], "id" | "nome">[];
  produtos: Pick<EstadoCRM["produtos"][number], "id" | "nome">[];
  /** Agora (ISO): tarefa vencida vira "Atrasada". */
  agora: string;
  tz?: string;
};

function quemEscreveu(m: Mensagem, c: Pick<ContatoCompleto, "nome">, ctx: Contexto360): string {
  if (m.autor === "contato") return primeiroNome(c.nome) || "Contato";
  if (m.autor === "robo") return ctx.nomeRobo;
  return nomeDoOperador(ctx.operadores, m.operadorId, ctx.euId);
}

const ehNossa = (m: Pick<Mensagem, "autor">) => m.autor !== "contato";

/**
 * WhatsApp: um evento por dia de conversa (não um por mensagem). O título diz quem falou; dia só
 * com mensagens nossas fica "Sem resposta no dia". As últimas falas do dia vão no detalhe.
 * Aviso de troca de atendente vira evento próprio (assumiu / voltou para o robô).
 */
export function eventosDeConversa(c: Pick<ContatoCompleto, "nome" | "mensagens">, ctx: Contexto360): Evento360[] {
  const out: Evento360[] = [];
  const dias = new Map<string, Mensagem[]>();
  for (const m of c.mensagens) {
    const q = isoCanonico(m.em);
    if (!q) continue;
    if (m.aviso) {
      out.push({
        id: `aviso:${m.id}`,
        tipo: "conversa",
        quando: q,
        titulo: m.autor === "robo" ? `A conversa voltou para o ${ctx.nomeRobo}` : "Uma pessoa assumiu a conversa",
        detalhe: m.texto.trim() ? [cortar(m.texto, 400)] : [],
        origem: "CRM",
        estado: null,
      });
      continue;
    }
    const dia = chaveDia(q, ctx.tz);
    const lista = dias.get(dia);
    if (lista) lista.push(m);
    else dias.set(dia, [m]);
  }
  for (const [dia, doDia] of dias) {
    const cron = [...doDia].sort((a, b) => (a.em < b.em ? -1 : a.em > b.em ? 1 : 0));
    const dela = cron.filter((m) => !ehNossa(m)).length;
    const nossas = cron.length - dela;
    const robo = cron.filter((m) => m.autor === "robo").length;
    const titulo =
      nossas === 0
        ? `Escreveu no WhatsApp · ${vezes(dela, "mensagem", "mensagens")}`
        : dela === 0
          ? `Mandamos ${vezes(nossas, "mensagem", "mensagens")} no WhatsApp, sem resposta no dia`
          : `Conversa no WhatsApp · ${vezes(cron.length, "mensagem", "mensagens")}`;
    const ultimas = cron.slice(-4);
    const resumo =
      dela > 0 && nossas > 0
        ? `${dela} da pessoa, ${vezes(nossas, "nossa", "nossas")}${robo ? ` (${robo} do ${ctx.nomeRobo})` : ""}`
        : dela === 0 && robo
          ? `${robo} do ${ctx.nomeRobo}`
          : null;
    out.push({
      id: `conversa:${dia}`,
      tipo: "conversa",
      quando: isoCanonico(cron[cron.length - 1].em)!,
      titulo,
      detalhe: [
        resumo,
        cron.length === 5 ? "A primeira do dia está na aba Conversa." : cron.length > 5 ? `As ${cron.length - 4} primeiras do dia estão na aba Conversa.` : null,
        ...ultimas.map((m) => `${hora(m.em, ctx.tz)} · ${quemEscreveu(m, c, ctx)}: ${cortar(m.texto || "mensagem sem texto", 140)}`),
      ].filter((l): l is string => Boolean(l)),
      origem: "WhatsApp",
      estado: dela > 0 ? null : estado("Sem resposta no dia"),
    });
  }
  return out;
}

const ROTULO_METODO: Record<string, string> = { pix: "no Pix", cartao: "no cartão", boleto: "no boleto" };
const ESTADO_PAGAMENTO: Record<string, { rotulo: string; tom: TomEstado }> = {
  pendente: { rotulo: "Aguardando pagamento", tom: "atencao" },
  pago: { rotulo: "Pago", tom: "bom" },
  falhou: { rotulo: "Não passou", tom: "erro" },
  reembolsado: { rotulo: "Reembolsado", tom: "erro" },
};
const ESTADO_OCORRENCIA: Record<string, { rotulo: string; tom: TomEstado }> = {
  aberta: { rotulo: "Aberta", tom: "atencao" },
  "em análise": { rotulo: "Em análise", tom: "neutro" },
  resolvida: { rotulo: "Resolvida", tom: "bom" },
};

const nomeEtapa = (id: string) => etapaDe(id as never)?.nome ?? id;

/** Tudo o que o CRM guarda da pessoa, numa lista só, do mais recente para o mais antigo. */
export function montarHistorico(c: ContatoCompleto, ctx: Contexto360): Evento360[] {
  const ev: Evento360[] = [];
  const add = (e: Omit<Evento360, "quando" | "detalhe" | "estado"> & { quando: string | null | undefined; detalhe?: Array<string | null | undefined | false>; estado?: Evento360["estado"] }) => {
    const q = isoCanonico(e.quando);
    if (!q) return;
    ev.push({ ...e, quando: q, detalhe: (e.detalhe ?? []).filter((l): l is string => Boolean(l)), estado: e.estado ?? null });
  };
  const produtoDaOportunidade = (oportunidadeId: string) => {
    const o = c.oportunidades.find((x) => x.id === oportunidadeId);
    return o ? ctx.produtos.find((p) => p.id === o.produtoId)?.nome ?? null : null;
  };
  const varias = c.oportunidades.length > 1;

  // Entrada no CRM: se a primeira oportunidade nasceu no mesmo instante, as duas viram uma linha só
  const funil = ctx.funis.find((f) => f.id === c.origem)?.nome;
  const chegada = funil ? `Chegou pelo funil ${funil}` : "Chegou ao CRM";
  const criado = isoCanonico(c.criadoEm);
  const nascimento = c.movimentos.find((m) => m.de === null && isoCanonico(m.em) === criado);
  if (!nascimento) add({ id: `entrada:${c.id}`, tipo: "etapa", quando: c.criadoEm, titulo: chegada, origem: "CRM" });

  // WhatsApp
  ev.push(...eventosDeConversa(c, ctx));
  if (c.handoffPendente && c.handoffDesde) {
    const mov = [...c.movimentos].reverse().find((m) => m.para === "handoff" && m.motivo?.trim());
    add({
      id: `handoff:${c.id}`,
      tipo: "conversa",
      quando: c.handoffDesde,
      titulo: `O ${ctx.nomeRobo} pediu uma pessoa na conversa`,
      detalhe: [mov?.motivo ? `Motivo: ${cortar(mov.motivo, 200)}` : null],
      origem: ctx.nomeRobo,
      estado: estado("Esperando uma pessoa", "atencao"),
    });
  }

  // Ligações
  for (const l of c.ligacoes) {
    const titulo =
      l.resultado === "atendeu" ? `Ligação${l.duracaoSeg > 0 ? ` · ${duracao(l.duracaoSeg)}` : ""}` : l.resultado === "caixa postal" ? "Ligação caiu na caixa postal" : "Ligação não atendida";
    add({
      id: `ligacao:${l.id}`,
      tipo: "ligacao",
      quando: l.iniciouEm,
      titulo,
      detalhe: [
        l.resumo.trim() ? cortar(l.resumo, 400) : null,
        ...l.followups.slice(0, 3).map((f) => `Combinado: ${cortar(f.texto, 140)}${f.quando ? ` (${f.quando})` : ""}`),
        l.operadorId ? `Feita por ${nomeDoOperador(ctx.operadores, l.operadorId, ctx.euId)}` : null,
      ],
      origem: "Telefone",
      estado: l.resultado === "atendeu" && l.termometroVendedor ? estado(`Interesse ${l.termometroVendedor}`) : null,
    });
  }

  // E-mails (o CRM registra o envio; não mede abertura nem clique)
  for (const e of c.emails) {
    add({
      id: `email:${e.id}`,
      tipo: "email",
      quando: e.em,
      titulo: `E-mail enviado${e.assunto.trim() ? `: ${cortar(e.assunto, 110)}` : ""}`,
      detalhe: [e.texto.trim() ? cortar(e.texto, 400) : null, e.enviadoPor ? `Enviado por ${nomeDoOperador(ctx.operadores, e.enviadoPor, ctx.euId)}` : null],
      origem: "E-mail",
    });
  }

  // Propostas
  for (const p of c.propostas) {
    const produto = produtoDaOportunidade(p.oportunidadeId);
    add({ id: `proposta-criada:${p.id}`, tipo: "proposta", quando: p.criadaEm, titulo: `Proposta criada${produto ? `: ${produto}` : ""}`, detalhe: [p.texto.trim() ? cortar(p.texto, 400) : null], origem: "CRM" });
    add({ id: `proposta-enviada:${p.id}`, tipo: "proposta", quando: p.enviadaEm, titulo: `Proposta enviada por ${p.enviadaPor === "email" ? "e-mail" : "WhatsApp"}`, origem: "CRM" });
    add({ id: `proposta-aberta:${p.id}`, tipo: "proposta", quando: p.abertaEm, titulo: `Abriu a proposta${produto ? `: ${produto}` : ""}`, origem: "Proposta", estado: estado("Aberta", "bom") });
  }

  // Pagamentos (links criados no CRM e confirmação)
  for (const p of c.pagamentos) {
    const produto = produtoDaOportunidade(p.oportunidadeId);
    const partes = [produto, formatarReais(p.valor), ROTULO_METODO[p.metodo] ?? p.metodo].filter(Boolean);
    add({
      id: `pagamento:${p.id}`,
      tipo: "pagamento",
      quando: p.criadoEm,
      titulo: `Link de pagamento: ${partes.join(" · ")}`,
      detalhe: [p.status === "pendente" && p.expiraEm && isoCanonico(p.expiraEm) ? `Vale até ${diaHora(p.expiraEm, ctx.tz)}` : null],
      origem: "Pagamento",
      estado: ESTADO_PAGAMENTO[p.status] ?? null,
    });
    add({ id: `pagamento-pago:${p.id}`, tipo: "pagamento", quando: p.pagoEm, titulo: "Pagamento confirmado", detalhe: [partes.join(" · ")], origem: "Pagamento", estado: estado("Pago", "bom") });
  }

  // Etapas
  for (const m of c.movimentos) {
    const perda = m.para === "perdido";
    const motivo = m.motivo?.trim() ? cortar(m.motivo, 200) : null;
    const produto = varias ? produtoDaOportunidade(m.oportunidadeId) : null;
    add({
      id: `etapa:${m.id}`,
      tipo: "etapa",
      quando: m.em,
      titulo:
        m === nascimento
          ? chegada
          : perda
            ? `Oportunidade perdida${motivo ? `: ${motivo}` : ""}`
            : m.de === "perdido"
              ? `Reaberta em ${nomeEtapa(m.para)}`
              : m.de === null
                ? `Entrou em ${nomeEtapa(m.para)}`
                : `Foi para a etapa ${nomeEtapa(m.para)}`,
      detalhe: [
        m === nascimento ? `Entrou em ${nomeEtapa(m.para)}` : null,
        m.de && m.de !== "perdido" && !perda ? `Saiu de ${nomeEtapa(m.de)}` : perda && m.de ? `Estava em ${nomeEtapa(m.de)}` : null,
        !perda && motivo ? `Motivo: ${motivo}` : null,
        produto ? `Oportunidade de ${produto}` : null,
      ],
      origem: autorDoMovimento(m.por, ctx),
      estado: perda ? estado("Perdida", "erro") : null,
    });
  }

  // Tarefas (o CRM não guarda quando foi concluída: o estado diz se está feita)
  const agoraMs = Date.parse(ctx.agora);
  for (const t of c.tarefas) {
    const atrasada = !t.feita && t.venceEm && Date.parse(t.venceEm) < agoraMs;
    add({
      id: `tarefa:${t.id}`,
      tipo: "tarefa",
      quando: t.criadaEm,
      titulo: `Tarefa criada: ${cortar(t.texto, 110)}`,
      detalhe: [t.venceEm && isoCanonico(t.venceEm) ? `Vence em ${diaHora(t.venceEm, ctx.tz)}` : "Sem data", t.origem && t.origem !== "manual" ? `Veio de: ${t.origem}` : null],
      origem: "CRM",
      estado: t.feita ? estado("Concluída", "bom") : atrasada ? estado("Atrasada", "atencao") : estado("Aberta"),
    });
  }

  // Notas
  for (const n of c.notas) {
    const autor = n.autorId ? nomeDoOperador(ctx.operadores, n.autorId, ctx.euId) : "Sistema";
    const texto = n.texto.trim();
    add({
      id: `nota:${n.id}`,
      tipo: "nota",
      quando: n.em,
      titulo: `${autor === "Você" ? "Sua nota" : `Nota de ${autor}`}: ${cortar(texto, 90)}`,
      detalhe: [texto.length > 90 ? texto : null],
      origem: "CRM",
    });
  }

  // Ocorrências
  for (const o of c.ocorrencias) {
    const desc = o.descricao.trim();
    add({
      id: `ocorrencia:${o.id}`,
      tipo: "ocorrencia",
      quando: o.em,
      titulo: `${o.tipo === "problema" ? "Problema registrado" : "Melhoria sugerida"}: ${cortar(desc, 90)}`,
      detalhe: [desc.length > 90 ? desc : null, o.resposta?.trim() ? `Resposta: ${cortar(o.resposta, 300)}` : null, o.abertaPor ? `Registrada por ${nomeDoOperador(ctx.operadores, o.abertaPor, ctx.euId)}` : null],
      origem: "CRM",
      estado: ESTADO_OCORRENCIA[o.status] ?? null,
    });
  }

  return ev.sort(compararEventos);
}

export function filtrarHistorico(ev: Evento360[], f: Filtro360): Evento360[] {
  if (f === "tudo") return ev;
  const tipos = TIPOS_DO_FILTRO[f];
  return ev.filter((e) => tipos.includes(e.tipo));
}

export function contarPorFiltro(ev: Evento360[]): Record<Filtro360, number> {
  const n = Object.fromEntries(FILTROS_360.map((f) => [f, 0])) as Record<Filtro360, number>;
  for (const e of ev) for (const f of FILTROS_360) if (f === "tudo" || TIPOS_DO_FILTRO[f].includes(e.tipo)) n[f] += 1;
  return n;
}

/** Nota curta abaixo da lista, só quando explica algo que não está na tela. */
export const NOTA_DO_FILTRO: Partial<Record<Filtro360, string>> = {
  tudo: "Mensagens do mesmo dia viram uma linha só; a conversa inteira está na aba Conversa.",
  conversas: "Mensagens do mesmo dia viram uma linha só; a conversa inteira está na aba Conversa.",
  emails: "O CRM registra o envio. Abertura e clique não são medidos.",
};

// ───────── Resumo de comportamento ─────────

export type NivelEngajamento = "quente" | "morno" | "frio" | "sem_sinal";
export const DIAS_QUENTE = 7;
export const DIAS_MORNO = 30;
const DIA_MS = 86_400_000;

export const ROTULO_ENGAJAMENTO: Record<NivelEngajamento, string> = { quente: "Quente", morno: "Morno", frio: "Frio", sem_sinal: "Sem sinal ainda" };

export const REGRA_ENGAJAMENTO: string[] = [
  `Quente: a pessoa fez algo nos últimos ${DIAS_QUENTE} dias.`,
  `Morno: a última coisa que ela fez foi há mais de ${DIAS_QUENTE} e até ${DIAS_MORNO} dias.`,
  `Frio: não fez nada há mais de ${DIAS_MORNO} dias.`,
  "Conta o que a pessoa fez: escreveu no WhatsApp, abriu a proposta ou pagou.",
  "Mensagem, ligação e e-mail nossos não contam: o sinal é dela.",
];

export type Sinal = { quando: string; oQue: string };

export function maisRecente(sinais: Array<Sinal | null | undefined>): Sinal | null {
  let melhor: Sinal | null = null;
  for (const s of sinais) {
    if (!s || !Number.isFinite(Date.parse(s.quando))) continue;
    if (!melhor || Date.parse(s.quando) > Date.parse(melhor.quando)) melhor = s;
  }
  return melhor;
}

export function engajamento(ultima: Sinal | null, agora: Date): { nivel: NivelEngajamento; motivo: string } {
  if (!ultima) return { nivel: "sem_sinal", motivo: "Nenhuma atividade da pessoa registrada." };
  const passado = Math.max(0, agora.getTime() - Date.parse(ultima.quando));
  const dias = Math.floor(passado / DIA_MS);
  const ha = dias === 0 ? "nas últimas 24 horas" : dias === 1 ? "há 1 dia" : `há ${dias} dias`;
  const motivo = `Última atividade ${ha}: ${ultima.oQue}.`;
  // Corte pelo tempo exato (7 dias e 1 hora já é morno), não pelo número de dias arredondado.
  if (passado <= DIAS_QUENTE * DIA_MS) return { nivel: "quente", motivo };
  if (passado <= DIAS_MORNO * DIA_MS) return { nivel: "morno", motivo };
  return { nivel: "frio", motivo };
}

export type FaixaDia = "madrugada" | "manha" | "tarde" | "noite";
export const ROTULO_FAIXA: Record<FaixaDia, string> = { madrugada: "de madrugada", manha: "de manhã", tarde: "à tarde", noite: "à noite" };
export function faixaDaHora(h: number): FaixaDia {
  return h < 6 ? "madrugada" : h < 12 ? "manha" : h < 18 ? "tarde" : "noite";
}
/** Mínimo de vezes que ela escreveu para dizer em que horário costuma escrever. */
export const MIN_PARA_HORARIO = 3;

export type HorarioResposta = { tipo: "sem_sinal" } | { tipo: "poucas"; vezes: number } | { tipo: "variado"; vezes: number } | { tipo: "faixa"; faixa: FaixaDia; nela: number; vezes: number };
export type TempoResposta = { tipo: "sem_resposta" } | { tipo: "medido"; ms: number; respostas: number };

export interface ResumoComportamento {
  engajamento: { nivel: NivelEngajamento; motivo: string };
  ultimoContatoNosso: Sinal | null;
  ultimaAtividade: Sinal | null;
  /** Em que parte do dia ela costuma escrever (cada vez que ela volta a falar conta uma). */
  horario: HorarioResposta;
  /** Quanto ela costuma levar para responder uma mensagem nossa (valor do meio). */
  tempo: TempoResposta;
  /** Mensagens dos últimos 30 dias. */
  ultimos30: { dela: number; nossas: number };
  /** Mensagens nossas depois da última dela (ou todas, se ela nunca escreveu). */
  semResposta: number;
}

function mediana(v: number[]): number {
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** O resumo lê os mesmos dados da linha do tempo (o contato inteiro, em memória). */
export function resumoComportamento(c: Pick<ContatoCompleto, "mensagens" | "ligacoes" | "emails" | "propostas" | "pagamentos">, agoraIso: string, tz?: string): ResumoComportamento {
  const agora = new Date(agoraIso);
  const msgs = c.mensagens.filter((m) => !m.aviso && isoCanonico(m.em)).sort((a, b) => (a.em < b.em ? -1 : a.em > b.em ? 1 : 0));
  const ultimaDela = [...msgs].reverse().find((m) => !ehNossa(m));
  const ultimaNossa = [...msgs].reverse().find(ehNossa);
  const sinal = (quando: string | null | undefined, oQue: string): Sinal | null => {
    const q = isoCanonico(quando);
    return q ? { quando: q, oQue } : null;
  };
  const ultimaLigacao = c.ligacoes.reduce<string | null>((m, l) => (!m || l.iniciouEm > m ? l.iniciouEm : m), null);
  const ultimoEmail = c.emails.reduce<string | null>((m, e) => (!m || e.em > m ? e.em : m), null);
  const ultimaPropostaEnviada = c.propostas.reduce<string | null>((m, p) => (p.enviadaEm && (!m || p.enviadaEm > m) ? p.enviadaEm : m), null);
  const ultimaAbertura = c.propostas.reduce<string | null>((m, p) => (p.abertaEm && (!m || p.abertaEm > m) ? p.abertaEm : m), null);
  const ultimoPago = c.pagamentos.reduce<string | null>((m, p) => (p.pagoEm && (!m || p.pagoEm > m) ? p.pagoEm : m), null);

  const ultimaAtividade = maisRecente([sinal(ultimaDela?.em, "escreveu no WhatsApp"), sinal(ultimaAbertura, "abriu a proposta"), sinal(ultimoPago, "pagou")]);
  const ultimoContatoNosso = maisRecente([sinal(ultimaNossa?.em, "WhatsApp"), sinal(ultimaLigacao, "ligação"), sinal(ultimoEmail, "e-mail"), sinal(ultimaPropostaEnviada, "proposta enviada")]);

  // Cada vez que ela volta a falar (primeira mensagem dela depois de uma nossa, ou a primeira de todas)
  const voltas: string[] = [];
  const tempos: number[] = [];
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    if (ehNossa(m)) continue;
    const antes = msgs[i - 1];
    if (antes && !ehNossa(antes)) continue;
    voltas.push(m.em);
    if (antes) tempos.push(Math.max(0, Date.parse(m.em) - Date.parse(antes.em)));
  }
  let horario: HorarioResposta;
  if (voltas.length === 0) horario = { tipo: "sem_sinal" };
  else if (voltas.length < MIN_PARA_HORARIO) horario = { tipo: "poucas", vezes: voltas.length };
  else {
    const n: Record<FaixaDia, number> = { madrugada: 0, manha: 0, tarde: 0, noite: 0 };
    for (const q of voltas) n[faixaDaHora(horaDoDia(q, tz))] += 1;
    const ordem = (Object.entries(n) as Array<[FaixaDia, number]>).sort((a, b) => b[1] - a[1]);
    // Só diz "costuma" quando uma faixa tem mais da metade das vezes.
    horario = ordem[0][1] * 2 > voltas.length ? { tipo: "faixa", faixa: ordem[0][0], nela: ordem[0][1], vezes: voltas.length } : { tipo: "variado", vezes: voltas.length };
  }

  const desde = agora.getTime() - DIAS_MORNO * DIA_MS;
  const recentes = msgs.filter((m) => Date.parse(m.em) >= desde && Date.parse(m.em) <= agora.getTime());
  const ultimos30 = { dela: recentes.filter((m) => !ehNossa(m)).length, nossas: recentes.filter(ehNossa).length };
  const semResposta = msgs.filter((m) => ehNossa(m) && (!ultimaDela || m.em > ultimaDela.em)).length;

  return {
    engajamento: engajamento(ultimaAtividade, agora),
    ultimoContatoNosso,
    ultimaAtividade,
    horario,
    tempo: tempos.length ? { tipo: "medido", ms: mediana(tempos), respostas: tempos.length } : { tipo: "sem_resposta" },
    ultimos30,
    semResposta,
  };
}

/** "menos de 1 min", "cerca de 15 min", "cerca de 3 h", "cerca de 2 dias". */
export function textoTempo(ms: number): string {
  const min = Math.round(ms / 60_000);
  if (min < 1) return "menos de 1 min";
  if (min < 60) return `cerca de ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `cerca de ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "cerca de 1 dia" : `cerca de ${d} dias`;
}

export function textoHorario(h: HorarioResposta): string {
  if (h.tipo === "sem_sinal") return "sem sinal ainda";
  if (h.tipo === "poucas") return `${vezes(h.vezes, "conversa", "conversas")}: pouco para dizer`;
  if (h.tipo === "variado") return "em horários variados";
  return `${ROTULO_FAIXA[h.faixa]} (${h.nela} de ${h.vezes} vezes)`;
}

export function textoTempoResposta(t: TempoResposta): string {
  if (t.tipo === "sem_resposta") return "sem resposta ainda";
  return `${textoTempo(t.ms)} · ${vezes(t.respostas, "resposta", "respostas")}`;
}

/** Só aparece com duas ou mais mensagens nossas seguidas sem resposta. */
export function textoSemResposta(r: Pick<ResumoComportamento, "semResposta" | "horario">): string | null {
  if (r.semResposta < 2) return null;
  return r.horario.tipo === "sem_sinal" ? `${r.semResposta} mensagens nossas, nenhuma resposta` : `${r.semResposta} mensagens nossas desde a última dela`;
}

export function textoUltimos30(u: { dela: number; nossas: number }): string {
  if (u.dela === 0 && u.nossas === 0) return "nenhuma mensagem";
  return `${u.dela === 0 ? "nenhuma" : u.dela} dela, ${u.nossas === 0 ? "nenhuma" : u.nossas} ${u.nossas === 1 ? "nossa" : "nossas"}`;
}

// ───────── Identidade ─────────

export type LinhaIdentidade = { rotulo: string; valor: string; tipo: "texto" | "telefone" | "email" | "data" };

/**
 * Quem é a pessoa, só com o que o contato tem (aqui não há fusão com outras bases). Campo vazio
 * não aparece; WhatsApp e e-mail vêm completos e a tela mostra mascarado, com "Revelar".
 */
export function identidadeDaPessoa(c: Pick<ContatoCompleto, "nome" | "empresa" | "telefone" | "email" | "origem" | "criadoEm">, funis: Pick<EstadoCRM["funis"][number], "id" | "nome">[], tz?: string): LinhaIdentidade[] {
  const out: LinhaIdentidade[] = [];
  const add = (rotulo: string, v: string | null | undefined, tipo: LinhaIdentidade["tipo"] = "texto") => {
    if (v != null && v.trim()) out.push({ rotulo, valor: v.trim(), tipo });
  };
  add("Nome", c.nome);
  add("Empresa", c.empresa);
  if (c.telefone.replace(/\D/g, "")) add("WhatsApp", c.telefone, "telefone");
  add("E-mail", c.email, "email");
  add("Origem", funis.find((f) => f.id === c.origem)?.nome ?? c.origem);
  if (isoCanonico(c.criadoEm)) out.push({ rotulo: "No CRM desde", valor: c.criadoEm, tipo: "data" });
  return out;
}
