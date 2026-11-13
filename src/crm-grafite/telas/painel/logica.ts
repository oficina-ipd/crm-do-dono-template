/**
 * Painel de entrada (grade bento) · regras PURAS: período e comparação, o modelo de cada cartão
 * a partir do EstadoCRM, textos e formatos. Sem React e sem relógio escondido (tudo recebe
 * `agora`), para o teste controlar. Dias e meses no horário local do navegador, como o resto do
 * template (Fila, Resultados, Origem).
 *
 * Regras de honestidade: número que o estado não tem não aparece (nada de "meta" de vendas ou de
 * receita, que o template não tem; e-mail sem medição de entrega e abertura); falta de base vira
 * texto ("sem dado ainda"), nunca zero. A comparação é sempre a MESMA medida no MESMO trecho do
 * período anterior (ontem até esta hora, os 7 dias anteriores, o mês passado até o mesmo dia).
 */
import { ETAPAS, ETAPAS_CLIENTE, etapaDe, indiceEtapa } from "@/domain/funil";
import { formatarReais, primeiroNome } from "@/domain/rules";
import type { EstadoCRM, EtapaId, Mensagem } from "@/domain/types";
import { hrefConversa, hrefFicha, montarFila } from "../fila/logica";

export const SEM_DADO = "sem dado ainda";

const DIA_MS = 86_400_000;
const HORA_MS = 3_600_000;

// ───────────────────────── Formatos ─────────────────────────

const fmtInt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const fmtDec = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const fmtHora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** 1.261 · 12. */
export function inteiro(n: number): string {
  return fmtInt.format(n);
}

/** 0,4 · 2 · 1,5. */
export function decimal(n: number): string {
  return fmtDec.format(n);
}

/** R$ 1.997 (valores do template estão em reais). */
export function reais(v: number): string {
  return formatarReais(v);
}

export const plural = (n: number, um: string, varios: string) => `${inteiro(n)} ${n === 1 ? um : varios}`;

/** "41%" de `parte` sobre `total`; null quando não há base. */
export function porcento(parte: number | null | undefined, total: number | null | undefined): string | null {
  if (parte == null || total == null || total <= 0) return null;
  const p = (parte / total) * 100;
  return `${p > 0 && p < 1 ? "<1" : fmtInt.format(Math.round(p))}%`;
}

/** 18 min · 2 h 10 min · 1 d 3 h. */
export function duracaoDeMinutos(min: number): string {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m} min`;
  if (m < 1440) {
    const r = m % 60;
    return r ? `${Math.floor(m / 60)} h ${r} min` : `${Math.floor(m / 60)} h`;
  }
  const h = Math.floor((m % 1440) / 60);
  return h ? `${Math.floor(m / 1440)} d ${h} h` : `${Math.floor(m / 1440)} d`;
}

/** 12 s · 1 min 20 s · 2 h 5 min. */
export function duracaoDeSegundos(seg: number): string {
  const s = Math.max(0, Math.round(seg));
  if (s < 60) return `${s} s`;
  if (s < 3600) {
    const r = s % 60;
    return r ? `${Math.floor(s / 60)} min ${r} s` : `${Math.floor(s / 60)} min`;
  }
  return duracaoDeMinutos(s / 60);
}

/** "12:30" (hora local). */
export function hora(iso: string): string {
  return fmtHora.format(new Date(iso));
}

const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "Sexta, 13 de nov" (data da faixa do topo). */
export function dataDaFaixa(iso: string): string {
  const d = new Date(iso);
  return `${DIAS_SEMANA[d.getDay()]}, ${d.getDate()} de ${MESES_CURTOS[d.getMonth()]}`;
}

/** Saudação pela hora local: bom dia das 5h às 11h59, boa tarde até 17h59, boa noite no resto. */
export function saudacao(iso: string): string {
  const h = new Date(iso).getHours();
  return h >= 5 && h < 12 ? "Bom dia" : h >= 12 && h < 18 ? "Boa tarde" : "Boa noite";
}

/** "13 nov" de uma chave AAAA-MM-DD. */
export function diaMes(chave: string): string {
  const [, m, d] = chave.split("-");
  return `${Number(d)} ${MESES_CURTOS[Number(m) - 1] ?? ""}`.trim();
}

/** "há 5 min", "há 3 h", "há 2 d". */
export function haQuanto(iso: string, agora: Date): string {
  const ms = agora.getTime() - Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  const min = Math.max(0, Math.floor(ms / 60_000));
  if (min < 1) return "agora há pouco";
  if (min < 60) return `há ${min} min`;
  if (min < 1440) return `há ${Math.floor(min / 60)} h`;
  return `há ${Math.floor(min / 1440)} d`;
}

/** Tempo de espera que anda: "49 s", "12 min 49 s", "3 h 12 min". Sem segundos, arredonda para o minuto. */
export function esperaViva(desde: string, agora: Date, comSegundos: boolean): string {
  const s = Math.max(0, Math.floor((agora.getTime() - Date.parse(desde)) / 1000));
  if (!Number.isFinite(s)) return "";
  if (s >= 3600) return duracaoDeMinutos(s / 60);
  if (!comSegundos) return s < 60 ? "menos de 1 min" : `${Math.floor(s / 60)} min`;
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s`;
}

/** Altura da barra (0 a 100): proporcional ao maior, com um mínimo visível; zero fica um toco. */
export function alturaDaBarra(valor: number, max: number, minimo = 16): number {
  if (valor <= 0 || max <= 0) return 4;
  return Math.round(minimo + (valor / max) * (100 - minimo));
}

// ───────────────────────── Dias locais ─────────────────────────

/** Chave AAAA-MM-DD do dia local de um instante. */
export function chaveDia(t: number | string | Date): string {
  const d = new Date(typeof t === "string" ? Date.parse(t) : t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function inicioDoDia(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Início do dia local `n` dias antes (n negativo vai para a frente). Calendário, não 24 h fixas. */
function diasAntes(t: number, n: number): number {
  const d = new Date(inicioDoDia(t));
  d.setDate(d.getDate() - n);
  return d.getTime();
}

/** Chaves dos dias locais de `de` até `ate` (inclusive). */
export function diasEntre(de: number, ate: number): string[] {
  const out: string[] = [];
  const fim = inicioDoDia(ate);
  const d = new Date(inicioDoDia(de));
  while (d.getTime() <= fim) {
    out.push(chaveDia(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

// ───────────────────────── Período e comparação ─────────────────────────

export const PERIODOS_PAINEL = ["hoje", "7d", "30d", "mes"] as const;
export type PeriodoPainel = (typeof PERIODOS_PAINEL)[number];
export const PERIODO_PADRAO: PeriodoPainel = "7d";

export const ROTULO_PERIODO: Record<PeriodoPainel, string> = { hoje: "Hoje", "7d": "7 dias", "30d": "30 dias", mes: "Mês atual" };

/** `?periodo=` da URL. Valor desconhecido ou ausente vira o padrão (7 dias). */
export function periodoValido(v: unknown): PeriodoPainel {
  return typeof v === "string" && (PERIODOS_PAINEL as readonly string[]).includes(v) ? (v as PeriodoPainel) : PERIODO_PADRAO;
}

/** Caminho com o período (o padrão não vai para a URL). */
export function hrefPeriodo(base: string, periodo: PeriodoPainel): string {
  return periodo === PERIODO_PADRAO ? base : `${base}?periodo=${periodo}`;
}

export type JanelaPainel = {
  periodo: PeriodoPainel;
  /** Início (inclusive) e fim (= agora, inclusive) do período, em ms. */
  inicio: number;
  fim: number;
  /** O mesmo trecho do período anterior (fim exclusivo; nunca passa de `inicio`). */
  anteriorInicio: number;
  anteriorFim: number;
  /** "hoje", "nos últimos 7 dias", "em novembro": para frases. */
  descricao: string;
  /** "ontem até esta hora", "os 7 dias anteriores", "outubro até o dia 12". */
  descricaoAnterior: string;
};

export function janelaDoPeriodo(periodo: PeriodoPainel, agoraIso: string): JanelaPainel {
  const agora = new Date(agoraIso);
  const fim = agora.getTime();
  let inicio: number;
  let anteriorInicio: number;
  let descricao: string;
  let descricaoAnterior: string;
  if (periodo === "mes") {
    inicio = new Date(agora.getFullYear(), agora.getMonth(), 1).getTime();
    anteriorInicio = new Date(agora.getFullYear(), agora.getMonth() - 1, 1).getTime();
    descricao = `em ${MESES[agora.getMonth()]}`;
    descricaoAnterior = `${MESES[new Date(anteriorInicio).getMonth()]} até o dia ${agora.getDate()}`;
  } else {
    const n = periodo === "hoje" ? 1 : periodo === "7d" ? 7 : 30;
    inicio = diasAntes(fim, n - 1);
    anteriorInicio = diasAntes(inicio, n);
    descricao = n === 1 ? "hoje" : `nos últimos ${n} dias`;
    descricaoAnterior = n === 1 ? "ontem até esta hora" : `os ${n} dias anteriores`;
  }
  // mesmo trecho: o tempo já decorrido no período, contado do início do anterior; nunca invade o atual
  const anteriorFim = Math.min(anteriorInicio + (fim - inicio), inicio);
  return { periodo, inicio, fim, anteriorInicio, anteriorFim, descricao, descricaoAnterior };
}

/** Em qual trecho da janela cai um instante. Fora dos dois (ou data inválida): null. */
export function trechoDe(iso: string | null | undefined, j: Pick<JanelaPainel, "inicio" | "fim" | "anteriorInicio" | "anteriorFim">): "atual" | "anterior" | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  if (t >= j.inicio && t <= j.fim) return "atual";
  if (t >= j.anteriorInicio && t < j.anteriorFim) return "anterior";
  return null;
}

/** Rótulo curto do período: "hoje", "7 dias", "30 dias", "novembro". */
export function periodoCurto(j: Pick<JanelaPainel, "periodo" | "descricao">): string {
  if (j.periodo === "hoje") return "hoje";
  if (j.periodo === "mes") return j.descricao.replace(/^em /, "");
  return j.periodo === "7d" ? "7 dias" : "30 dias";
}

/** Complemento da comparação: "nos 7 dias anteriores", "ontem até esta hora", "em outubro até o dia 12". */
export function noAnterior(j: Pick<JanelaPainel, "periodo" | "descricaoAnterior">): string {
  if (j.periodo === "hoje") return j.descricaoAnterior;
  if (j.periodo === "mes") return `em ${j.descricaoAnterior}`;
  return `n${j.descricaoAnterior}`;
}

export type Variacao = { direcao: "sobe" | "desce" | "igual"; delta: number; pct: number | null; anterior: number };

/** Comparação com o anterior; sem um dos números, null (a tela não inventa "0%"). */
export function variacao(atual: number | null | undefined, anterior: number | null | undefined): Variacao | null {
  if (atual == null || anterior == null || !Number.isFinite(atual) || !Number.isFinite(anterior)) return null;
  const delta = atual - anterior;
  return {
    direcao: delta > 0 ? "sobe" : delta < 0 ? "desce" : "igual",
    delta,
    pct: anterior === 0 ? null : Math.round((Math.abs(delta) / Math.abs(anterior)) * 100),
    anterior,
  };
}

export type TextoVariacao = { seta: "sobe" | "desce" | "igual"; mudanca: string; base: string };

/**
 * "25% a mais · eram 24 nos 7 dias anteriores"; anterior zero: "4 a mais · nenhum …". `zero` é a
 * palavra do anterior zerado, concordando com a medida ("nenhuma" venda, "nada" de receita).
 */
export function textoVariacao(v: Variacao | null, anterior: string, fmt: (n: number) => string = inteiro, zero = "nenhum"): TextoVariacao | null {
  if (!v) return null;
  const base = v.anterior === 0 ? `${zero} ${anterior}` : `${v.anterior === 1 || fmt !== inteiro ? "era" : "eram"} ${fmt(v.anterior)} ${anterior}`;
  if (v.direcao === "igual") return { seta: "igual", mudanca: "igual", base };
  const quanto = v.pct != null ? `${inteiro(v.pct)}%` : fmt(Math.abs(v.delta));
  return { seta: v.direcao, mudanca: `${quanto} ${v.direcao === "sobe" ? "a mais" : "a menos"}`, base };
}

/** Mediana; null sem valores. */
export function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const v = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(v.length / 2);
  return v.length % 2 ? v[meio] : (v[meio - 1] + v[meio]) / 2;
}

// ───────────────────────── Destinos ─────────────────────────

/** Cada número leva à tela que o compõe. A Fila mora em /fila (o Painel é a entrada). */
export const DESTINOS = {
  fila: "/fila",
  conversas: "/conversas",
  conversasPrecisa: "/conversas?filtro=precisa",
  conversasRobo: "/conversas?filtro=robo",
  tarefas: "/trabalho",
  funil: "/funil",
  resultados: "/placar",
} as const;

/** Resultados aceita 1, 7, 14 ou 30 dias: o mais próximo do período do Painel. */
export function hrefResultados(periodo: PeriodoPainel): string {
  const janela = periodo === "hoje" ? 1 : periodo === "7d" ? 7 : 30;
  return janela === 30 ? DESTINOS.resultados : `${DESTINOS.resultados}?janela=${janela}`;
}

/** Origem dos leads aceita 7, 14 ou 30 dias. */
export function hrefOrigem(periodo: PeriodoPainel): string {
  return `/demanda?dias=${periodo === "hoje" || periodo === "7d" ? 7 : 30}`;
}

// ───────────────────────── Vendas e receita (a regra do template) ─────────────────────────

type EstadoVendas = Pick<EstadoCRM, "movimentos" | "pagamentos">;

/**
 * Venda = oportunidade que chegou em "Pago" (movimento), a mesma regra de Resultados e da Fila.
 * Cada oportunidade conta uma vez por intervalo, no primeiro movimento para Pago dentro dele.
 */
function vendasEntre(e: EstadoVendas, de: number, ate: number, incluiFim = true): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of e.movimentos) {
    if (m.para !== "pago") continue;
    const t = Date.parse(m.em);
    if (!(t >= de && (incluiFim ? t <= ate : t < ate))) continue;
    const ja = out.get(m.oportunidadeId);
    if (ja == null || t < ja) out.set(m.oportunidadeId, t);
  }
  return out;
}

/** Receita = pagamentos com status pago, pela data do pagamento. */
function pagosEntre(e: EstadoVendas, de: number, ate: number, incluiFim = true) {
  return e.pagamentos.filter((p) => {
    if (p.status !== "pago" || !p.pagoEm) return false;
    const t = Date.parse(p.pagoEm);
    return t >= de && (incluiFim ? t <= ate : t < ate);
  });
}

export type VendasDoMes = {
  /** "novembro". */
  mes: string;
  dia: number;
  diasNoMes: number;
  /** "30/11". */
  ultimoDia: string;
  vendas: number;
  vendasHoje: number;
  /** Mesma medida no mês passado até o mesmo ponto. */
  vendasMesAnterior: number;
  /** "em outubro até o dia 13" (o trecho comparado). */
  noMesAnterior: string;
  receita: number;
  receitaMesAnterior: number;
  /** Receita média por pagamento pago no mês. null sem pagamento. */
  ticket: number | null;
  /** Vendas por dia até hoje. */
  ritmo: number;
  /** No ritmo atual, quantas vendas no fim do mês. */
  projecaoVendas: number;
  /** No ritmo atual, quanto de receita no fim do mês. null sem receita. */
  projecaoReceita: number | null;
  /** Do dia 1 até hoje. */
  porDia: Array<{ dia: string; vendas: number; receita: number }>;
};

export function vendasDoMes(e: EstadoVendas, agoraIso: string): VendasDoMes {
  const agora = new Date(agoraIso);
  const fim = agora.getTime();
  const j = janelaDoPeriodo("mes", agoraIso);
  const dia = agora.getDate();
  const diasNoMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
  const vendas = vendasEntre(e, j.inicio, fim);
  const pagos = pagosEntre(e, j.inicio, fim);
  const receita = pagos.reduce((s, p) => s + p.valor, 0);
  const dias = diasEntre(j.inicio, fim);
  const porDia = new Map(dias.map((d) => [d, { vendas: 0, receita: 0 }]));
  for (const t of vendas.values()) {
    const x = porDia.get(chaveDia(t));
    if (x) x.vendas += 1;
  }
  for (const p of pagos) {
    const x = porDia.get(chaveDia(p.pagoEm!));
    if (x) x.receita += p.valor;
  }
  const hoje0 = inicioDoDia(fim);
  const ritmo = vendas.size / dia;
  return {
    mes: MESES[agora.getMonth()],
    dia,
    diasNoMes,
    ultimoDia: `${String(diasNoMes).padStart(2, "0")}/${String(agora.getMonth() + 1).padStart(2, "0")}`,
    vendas: vendas.size,
    vendasHoje: [...vendas.values()].filter((t) => t >= hoje0).length,
    vendasMesAnterior: vendasEntre(e, j.anteriorInicio, j.anteriorFim, false).size,
    noMesAnterior: noAnterior(j),
    receita,
    receitaMesAnterior: pagosEntre(e, j.anteriorInicio, j.anteriorFim, false).reduce((s, p) => s + p.valor, 0),
    ticket: pagos.length ? receita / pagos.length : null,
    ritmo,
    projecaoVendas: Math.round(ritmo * diasNoMes),
    projecaoReceita: receita > 0 ? Math.round((receita / dia) * diasNoMes) : null,
    porDia: dias.map((d) => ({ dia: d, ...porDia.get(d)! })),
  };
}

/**
 * Frase do cartão do mês, sem meta: "faltam 17 dias, contando hoje" (o último dia diz "só resta
 * hoje", nunca "em 0 dias").
 */
export function diasQueRestam(dia: number, diasNoMes: number): string {
  const restam = Math.max(1, diasNoMes - dia + 1);
  return restam === 1 ? "só resta hoje" : `faltam ${plural(restam, "dia", "dias")}, contando hoje`;
}

// ───────────────────────── Conversas por dia ─────────────────────────

const conta = (m: Mensagem) => !m.aviso && m.texto.trim() !== "";

/**
 * Primeira mensagem de cada contato (o começo da conversa). O estado traz o histórico inteiro, então
 * "conversa nova no dia" é exata: a primeira mensagem do contato caiu naquele dia.
 */
function inicioDasConversas(mensagens: Mensagem[], ate: number): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of mensagens) {
    if (!conta(m)) continue;
    const t = Date.parse(m.em);
    if (!Number.isFinite(t) || t > ate) continue;
    const ja = out.get(m.contatoId);
    if (ja == null || t < ja) out.set(m.contatoId, t);
  }
  return out;
}

/** Conversas novas por dia, de `de` até `agora` (série completa, zero onde não houve). */
export function conversasNovasPorDia(mensagens: Mensagem[], de: number, agoraIso: string): Array<{ dia: string; novas: number }> {
  const fim = Date.parse(agoraIso);
  const dias = diasEntre(de, fim);
  const m = new Map(dias.map((d) => [d, 0]));
  for (const t of inicioDasConversas(mensagens, fim).values()) {
    const k = chaveDia(t);
    if (m.has(k)) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return dias.map((dia) => ({ dia, novas: m.get(dia) ?? 0 }));
}

export type ConversasHoje = {
  mensagens: number;
  /** Mensagens por hora local, da 0h até a hora atual. */
  porHora: number[];
  /** Conversas que começaram hoje. */
  novas: number;
  /** Contatos que escreveram hoje. */
  escreveram: number;
};

export function conversasDeHoje(mensagens: Mensagem[], agoraIso: string): ConversasHoje {
  const fim = Date.parse(agoraIso);
  const hoje0 = inicioDoDia(fim);
  const horas = Math.max(1, Math.min(24, new Date(fim).getHours() + 1));
  const porHora = Array.from({ length: horas }, () => 0);
  const escreveram = new Set<string>();
  let n = 0;
  for (const m of mensagens) {
    if (!conta(m)) continue;
    const t = Date.parse(m.em);
    if (!(t >= hoje0 && t <= fim)) continue;
    n += 1;
    const h = new Date(t).getHours();
    if (h < porHora.length) porHora[h] += 1;
    if (m.autor === "contato") escreveram.add(m.contatoId);
  }
  const novas = [...inicioDasConversas(mensagens, fim).values()].filter((t) => t >= hoje0).length;
  return { mensagens: n, porHora, novas, escreveram: escreveram.size };
}

// ───────────────────────── Abertura ─────────────────────────

export const DIAS_DA_ABERTURA = 30;

export type DiaDaAbertura = { dia: string; conversas: number; vendas: number };

export type Abertura = {
  saudacao: string;
  nome: string;
  /** Uma frase com números reais do mês (não é slogan). */
  resumo: string;
  valor: { rotulo: string; numero: number; href: string; variacao: TextoVariacao | null };
  dias: DiaDaAbertura[];
};

/** Legenda de um dia: "12 nov · 14 conversas novas · 1 venda". */
export function legendaDoDia(d: DiaDaAbertura): string {
  const partes = [diaMes(d.dia), d.conversas === 0 ? "nenhuma conversa nova" : plural(d.conversas, "conversa nova", "conversas novas")];
  if (d.vendas > 0) partes.push(plural(d.vendas, "venda", "vendas"));
  return partes.join(" · ");
}

export function montarAbertura(estado: Pick<EstadoCRM, "movimentos" | "pagamentos" | "mensagens">, agoraIso: string, nomeOperador: string): Abertura {
  const fim = Date.parse(agoraIso);
  const mes = vendasDoMes(estado, agoraIso);
  const j = janelaDoPeriodo("mes", agoraIso);
  const de = diasAntes(fim, DIAS_DA_ABERTURA - 1);
  const conversas = conversasNovasPorDia(estado.mensagens, Math.min(de, j.inicio), agoraIso);
  const novasNoMes = conversas.filter((x) => Date.parse(`${x.dia}T12:00:00`) >= j.inicio).reduce((a, x) => a + x.novas, 0);
  const vendasPorDia = new Map<string, number>();
  for (const t of vendasEntre(estado, de, fim).values()) vendasPorDia.set(chaveDia(t), (vendasPorDia.get(chaveDia(t)) ?? 0) + 1);
  const hoje = conversasDeHoje(estado.mensagens, agoraIso);
  return {
    saudacao: saudacao(agoraIso),
    nome: primeiroNome(nomeOperador.replace(/\([^)]*\)/g, " ")),
    resumo: `Em ${mes.mes}: ${plural(mes.vendas, "venda", "vendas")} e ${plural(novasNoMes, "conversa nova", "conversas novas")}. Hoje, ${
      hoje.escreveram === 0 ? "ninguém escreveu ainda" : plural(hoje.escreveram, "pessoa escreveu", "pessoas escreveram")
    }.`,
    valor: {
      rotulo: `Receita em ${mes.mes}`,
      numero: mes.receita,
      href: DESTINOS.resultados,
      // receita com receita, no mesmo trecho do mês anterior
      variacao: textoVariacao(variacao(mes.receita, mes.receitaMesAnterior), noAnterior(j), reais, "nada"),
    },
    dias: conversas.slice(-DIAS_DA_ABERTURA).map((d) => ({ dia: d.dia, conversas: d.novas, vendas: vendasPorDia.get(d.dia) ?? 0 })),
  };
}

// ───────────────────────── Gráfico do mês ─────────────────────────

export type MetricaDoGrafico = "receita" | "vendas" | "conversas";

export type SerieDoGrafico = {
  chave: MetricaDoGrafico;
  rotulo: string;
  titulo: string;
  /** Acumulado do mês: índice 0 = zero, índice d = fim do dia d. */
  acumulado: number[];
};

export function acumular(porDia: number[]): number[] {
  const out = [0];
  for (const v of porDia) out.push(out[out.length - 1] + v);
  return out;
}

export function valorDaMetrica(chave: MetricaDoGrafico, v: number): string {
  if (chave === "receita") return reais(Math.round(v));
  const n = Math.round(v);
  return chave === "vendas" ? plural(n, "venda", "vendas") : plural(n, "conversa", "conversas");
}

/** Séries do mês, sem linha de meta (o template não tem meta de receita, vendas ou conversas). */
export function seriesDoGrafico(mes: VendasDoMes, mensagens: Mensagem[], agoraIso: string): SerieDoGrafico[] {
  const inicio = janelaDoPeriodo("mes", agoraIso).inicio;
  const novas = conversasNovasPorDia(mensagens, inicio, agoraIso).map((x) => x.novas);
  return [
    { chave: "receita", rotulo: "Receita", titulo: "Receita no mês", acumulado: acumular(mes.porDia.map((x) => x.receita)) },
    { chave: "vendas", rotulo: "Vendas", titulo: "Vendas no mês", acumulado: acumular(mes.porDia.map((x) => x.vendas)) },
    { chave: "conversas", rotulo: "Conversas", titulo: "Conversas novas no mês", acumulado: acumular(novas) },
  ];
}

/** O que o gráfico diz no dia `dia` (1 a hoje): realizado até ali e projeção linear do mês. */
export function lerGrafico(s: SerieDoGrafico, dia: number, diasNoMes: number): { realizado: number; projecao: number } {
  const hoje = s.acumulado.length - 1;
  const d = Math.max(0, Math.min(hoje, dia));
  const ultimo = s.acumulado[hoje] ?? 0;
  return { realizado: s.acumulado[d] ?? 0, projecao: hoje > 0 ? (ultimo / hoje) * diasNoMes : 0 };
}

/** Dias marcados no eixo: o primeiro, os quartos do mês e o último. */
export function marcasDoEixo(diasNoMes: number): number[] {
  return [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(1 + f * (diasNoMes - 1)));
}

// ───────────────────────── Precisa de você ─────────────────────────

export const MAX_ESPERANDO = 3;

export type PessoaEsperando = { id: string; nome: string; empresa: string | null; desde: string; motivo: string | null };

export type Precisa = {
  /** As que esperam há mais tempo (até MAX_ESPERANDO), a mais antiga primeiro. */
  pessoas: PessoaEsperando[];
  /** Todas as que esperam uma pessoa. */
  total: number;
  tarefas: { atrasadas: number; paraHoje: number };
  paradas: { total: number; maiorEsperaMin: number | null };
};

/** O mesmo recorte da Fila: handoffs pendentes (motivo do movimento para Handoff), tarefas de hoje, paradas. */
export function montarPrecisa(estado: Parameters<typeof montarFila>[0], agoraIso: string): Precisa {
  const f = montarFila(estado, agoraIso);
  const agora = Date.parse(agoraIso);
  const abertas = f.tarefas.filter((t) => !t.feita);
  const atrasadas = abertas.filter((t) => t.venceEm && Date.parse(t.venceEm) < agora).length;
  return {
    pessoas: [...f.handoffs]
      .sort((a, b) => Date.parse(a.desde) - Date.parse(b.desde))
      .slice(0, MAX_ESPERANDO)
      .map((h) => ({ id: h.contatoId, nome: h.nome.trim() || "Contato sem nome", empresa: h.empresa, desde: h.desde, motivo: h.motivo })),
    total: f.handoffs.length,
    tarefas: { atrasadas, paraHoje: abertas.length - atrasadas },
    paradas: { total: f.paradas.length, maiorEsperaMin: f.paradas.length ? Math.max(...f.paradas.map((p) => p.minutos)) : null },
  };
}

export { hrefConversa, hrefFicha };

// ───────────────────────── Robô (Cláudio) ─────────────────────────

export type PainelRobo = {
  /** Contatos com mensagem do robô no período. */
  conversas: number;
  conversasAnterior: number;
  /** Das atendidas, quantas tiveram mensagem do contato no período. */
  responderam: number;
  primeiraResposta: { medianaSeg: number | null; respostas: number; anteriorMedianaSeg: number | null };
  /** Movimentos para a etapa Handoff no período (pedidos de pessoa) e de quantas pessoas vieram. */
  pedidos: number;
  pedidosAnterior: number;
  pessoas: number;
  /** Atendidas cuja oportunidade andou para a frente no período. */
  avancaram: number;
};

/** Movimento para a frente no funil: de uma etapa para outra de ordem maior (Perdido não conta). */
export function ehAvanco(m: { de: EtapaId | null; para: EtapaId }): boolean {
  if (!m.de || m.para === "perdido" || m.de === "perdido") return false;
  return indiceEtapa(m.para) > indiceEtapa(m.de);
}

/**
 * Tempos de primeira resposta do robô, em segundos: da mensagem do contato que abre um turno (a
 * anterior não era dele) até a resposta seguinte, se quem respondeu foi o robô. Turno respondido
 * por uma pessoa não entra. Separados pelo trecho em que o contato escreveu.
 */
export function temposDePrimeiraResposta(mensagens: Mensagem[], j: JanelaPainel): { atual: number[]; anterior: number[] } {
  const porContato = new Map<string, Mensagem[]>();
  for (const m of [...mensagens].filter(conta).sort((a, b) => Date.parse(a.em) - Date.parse(b.em))) {
    const l = porContato.get(m.contatoId) ?? [];
    l.push(m);
    porContato.set(m.contatoId, l);
  }
  const out = { atual: [] as number[], anterior: [] as number[] };
  for (const l of porContato.values()) {
    for (let i = 0; i < l.length; i += 1) {
      const m = l[i];
      if (m.autor !== "contato" || (i > 0 && l[i - 1].autor === "contato")) continue;
      const trecho = trechoDe(m.em, j);
      if (!trecho) continue;
      const resposta = l.slice(i + 1).find((x) => x.autor !== "contato");
      if (!resposta || resposta.autor !== "robo") continue;
      const seg = (Date.parse(resposta.em) - Date.parse(m.em)) / 1000;
      if (Number.isFinite(seg) && seg >= 0) out[trecho].push(seg);
    }
  }
  return out;
}

export function montarRobo(estado: Pick<EstadoCRM, "mensagens" | "movimentos" | "oportunidades">, j: JanelaPainel): PainelRobo {
  const atendidas = new Set<string>();
  const atendidasAnterior = new Set<string>();
  const escreveram = new Set<string>();
  for (const m of estado.mensagens) {
    if (!conta(m)) continue;
    const trecho = trechoDe(m.em, j);
    if (!trecho) continue;
    if (m.autor === "robo") (trecho === "atual" ? atendidas : atendidasAnterior).add(m.contatoId);
    else if (m.autor === "contato" && trecho === "atual") escreveram.add(m.contatoId);
  }
  const contatoDaOp = new Map(estado.oportunidades.map((o) => [o.id, o.contatoId]));
  const pedidos = estado.movimentos.filter((m) => m.para === "handoff" && trechoDe(m.em, j) === "atual");
  const avancaram = new Set(
    estado.movimentos.filter((m) => trechoDe(m.em, j) === "atual" && ehAvanco(m)).map((m) => contatoDaOp.get(m.oportunidadeId)),
  );
  const tempos = temposDePrimeiraResposta(estado.mensagens, j);
  const med = (v: number[]) => {
    const x = mediana(v);
    return x == null ? null : Math.round(x);
  };
  return {
    conversas: atendidas.size,
    conversasAnterior: atendidasAnterior.size,
    responderam: [...atendidas].filter((id) => escreveram.has(id)).length,
    primeiraResposta: { medianaSeg: med(tempos.atual), respostas: tempos.atual.length, anteriorMedianaSeg: med(tempos.anterior) },
    pedidos: pedidos.length,
    pedidosAnterior: estado.movimentos.filter((m) => m.para === "handoff" && trechoDe(m.em, j) === "anterior").length,
    pessoas: new Set(pedidos.map((m) => contatoDaOp.get(m.oportunidadeId) ?? m.oportunidadeId)).size,
    avancaram: [...atendidas].filter((id) => avancaram.has(id)).length,
  };
}

export type FaixaDeResposta = { rotulo: "rápido" | "ok" | "lento"; tom: "rapido" | "ok" | "lento"; fracao: number };

/** Mostrador: até 60 s é rápido, até 2 min ok, acima disso lento. O arco enche até 3 min. */
export function faixaDeResposta(seg: number): FaixaDeResposta {
  const fracao = Math.max(0, Math.min(1, seg / 180));
  if (seg <= 60) return { rotulo: "rápido", tom: "rapido", fracao };
  if (seg <= 120) return { rotulo: "ok", tom: "ok", fracao };
  return { rotulo: "lento", tom: "lento", fracao };
}

// ───────────────────────── Origem dos leads ─────────────────────────

export type PainelOrigem = { total: number; totalAnterior: number; origens: Array<{ chave: string; rotulo: string; total: number }> };

/** Contatos novos no período, por origem (o funil de entrada; sem funil cadastrado, pelo código). */
export function montarOrigem(estado: Pick<EstadoCRM, "contatos" | "funis">, j: JanelaPainel): PainelOrigem {
  const nomes = new Map(estado.funis.map((f) => [f.id, f.nome]));
  const m = new Map<string, number>();
  let total = 0;
  let totalAnterior = 0;
  for (const c of estado.contatos) {
    const t = trechoDe(c.criadoEm, j);
    if (t === "anterior") totalAnterior += 1;
    if (t !== "atual") continue;
    total += 1;
    const k = c.origem?.trim() || "";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return {
    total,
    totalAnterior,
    origens: [...m.entries()]
      .map(([k, n]) => ({ chave: k || "__sem", rotulo: k ? nomes.get(k) ?? k : "Sem origem", total: n }))
      .sort((a, b) => b.total - a.total || a.rotulo.localeCompare(b.rotulo, "pt-BR")),
  };
}

export type SegmentoDeOrigem = { chave: string; rotulo: string; total: number; pct: string; inicio: number; largura: number };

/** Barra empilhada (0 a 100), no máximo `max` partes; o resto vira "Outras". */
export function segmentosDeOrigem(origens: PainelOrigem["origens"], total: number, max = 6): SegmentoDeOrigem[] {
  if (total <= 0) return [];
  const topo = origens.slice(0, origens.length > max ? max - 1 : max).map((o) => ({ ...o }));
  const resto = origens.slice(topo.length);
  if (resto.length) topo.push({ chave: "__outras", rotulo: "Outras", total: resto.reduce((a, o) => a + o.total, 0) });
  let x = 0;
  return topo.map((o) => {
    const largura = (o.total / total) * 100;
    const s = { ...o, pct: porcento(o.total, total) ?? "0%", inicio: x, largura };
    x += largura;
    return s;
  });
}

// ───────────────────────── E-mails ─────────────────────────

export type PainelEmails = { enviados: number; enviadosAnterior: number; porQuem: Array<{ nome: string; total: number }> };

/**
 * E-mails escritos no CRM (`estado.emails`). O template registra o envio; entrega, abertura e
 * clique não são medidos, então esses números não existem aqui (a tela diz "sem medição").
 */
export function montarEmails(estado: Pick<EstadoCRM, "emails" | "operadores">, j: JanelaPainel): PainelEmails {
  const nomes = new Map(estado.operadores.map((o) => [o.id, primeiroNome(o.nome.replace(/\([^)]*\)/g, " "))]));
  const por = new Map<string, number>();
  let enviados = 0;
  let enviadosAnterior = 0;
  for (const e of estado.emails) {
    const t = trechoDe(e.em, j);
    if (t === "anterior") enviadosAnterior += 1;
    if (t !== "atual") continue;
    enviados += 1;
    const nome = (e.enviadoPor && nomes.get(e.enviadoPor)) || "Equipe";
    por.set(nome, (por.get(nome) ?? 0) + 1);
  }
  return {
    enviados,
    enviadosAnterior,
    porQuem: [...por.entries()].map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR")),
  };
}

// ───────────────────────── Funil ─────────────────────────

export type EtapaPainel = { id: EtapaId; nome: string; naEtapa: number; entraram: number; avancaram: number; paradas: number };

export type PainelFunil = {
  entradas: number;
  entradasAnterior: number;
  avancaram: number;
  avancaramAnterior: number;
  perdidas: number;
  perdidasAnterior: number;
  /** Em andamento agora: não perdidas e antes de Pago. */
  emAndamento: number;
  /** Paradas agora (o mesmo recorte da Fila). */
  paradas: number;
  etapas: EtapaPainel[];
};

export function montarFunil(estado: Parameters<typeof montarFila>[0], j: JanelaPainel, agoraIso: string): PainelFunil {
  const paradas = montarFila(estado, agoraIso).paradas;
  const entraram = new Map<EtapaId, Set<string>>();
  const avancaramDe = new Map<EtapaId, Set<string>>();
  const add = (m: Map<EtapaId, Set<string>>, k: EtapaId, id: string) => m.set(k, (m.get(k) ?? new Set()).add(id));
  const avancouAtual = new Set<string>();
  const avancouAnterior = new Set<string>();
  const perdidas = { atual: new Set<string>(), anterior: new Set<string>() };
  for (const m of estado.movimentos) {
    const t = trechoDe(m.em, j);
    if (!t) continue;
    if (m.para === "perdido") perdidas[t].add(m.oportunidadeId);
    const avanco = ehAvanco(m);
    if (t === "anterior") {
      if (avanco) avancouAnterior.add(m.oportunidadeId);
      continue;
    }
    if (m.para !== "perdido") add(entraram, m.para, m.oportunidadeId);
    if (avanco && m.de) {
      add(avancaramDe, m.de, m.oportunidadeId);
      avancouAtual.add(m.oportunidadeId);
    }
  }
  const vivas = estado.oportunidades.filter((o) => !o.perdida);
  const contar = <T,>(l: T[], k: (x: T) => string) => l.reduce((m, x) => m.set(k(x), (m.get(k(x)) ?? 0) + 1), new Map<string, number>());
  const naEtapa = contar(vivas, (o) => o.etapa);
  const paradasPor = contar(paradas, (p) => estado.oportunidades.find((o) => o.id === p.oportunidadeId)?.etapa ?? "");
  return {
    entradas: estado.oportunidades.filter((o) => trechoDe(o.criadaEm, j) === "atual").length,
    entradasAnterior: estado.oportunidades.filter((o) => trechoDe(o.criadaEm, j) === "anterior").length,
    avancaram: avancouAtual.size,
    avancaramAnterior: avancouAnterior.size,
    perdidas: perdidas.atual.size,
    perdidasAnterior: perdidas.anterior.size,
    emAndamento: vivas.filter((o) => !ETAPAS_CLIENTE.includes(o.etapa)).length,
    paradas: paradas.length,
    etapas: ETAPAS.filter((e) => e.id !== "perdido").map((e) => ({
      id: e.id,
      nome: e.nome,
      naEtapa: naEtapa.get(e.id) ?? 0,
      entraram: entraram.get(e.id)?.size ?? 0,
      avancaram: avancaramDe.get(e.id)?.size ?? 0,
      paradas: paradasPor.get(e.id) ?? 0,
    })),
  };
}

/** Etapas com o que mostrar e quantas ficaram de fora. */
export function etapasComMovimento(etapas: EtapaPainel[]): { visiveis: EtapaPainel[]; semMovimento: number } {
  const visiveis = etapas.filter((e) => e.naEtapa + e.entraram + e.avancaram + e.paradas > 0);
  return { visiveis, semMovimento: etapas.length - visiveis.length };
}

// ───────────────────────── Atividade recente ─────────────────────────

export const LIMITE_ATIVIDADE = 6;

export type LinhaDaAtividade = {
  id: string;
  em: string;
  icone: "cifrao" | "assumir" | "pessoas";
  titulo: string;
  detalhe: string;
  valor: string | null;
  estado: { texto: string; tom: "ok" | "espera" | "neutro" };
  href: string;
};

/**
 * Os últimos acontecimentos que o estado registra com hora: vendas (movimento para Pago, com o
 * valor pago da oportunidade), pedidos de pessoa (movimento para Handoff) e contatos novos.
 * Tarefa concluída não entra: o template não guarda quando a tarefa foi concluída.
 */
export function montarAtividade(
  estado: Pick<EstadoCRM, "movimentos" | "oportunidades" | "contatos" | "pagamentos" | "produtos" | "funis" | "config">,
  agoraIso: string,
  limite = LIMITE_ATIVIDADE,
): LinhaDaAtividade[] {
  const agora = new Date(agoraIso);
  const fim = agora.getTime();
  const ops = new Map(estado.oportunidades.map((o) => [o.id, o]));
  const contatos = new Map(estado.contatos.map((c) => [c.id, c]));
  const produtos = new Map(estado.produtos.map((p) => [p.id, p.nome]));
  const funis = new Map(estado.funis.map((f) => [f.id, f.nome]));
  const pessoa = (id: string | undefined) => {
    const n = (id && contatos.get(id)?.nome.trim()) || "";
    return n ? primeiroNome(n) : "Contato sem nome";
  };
  const valido = (iso: string) => {
    const t = Date.parse(iso);
    return Number.isFinite(t) && t <= fim;
  };
  // o pedido mais recente de quem ainda espera é o que está "esperando"
  const ultimo = new Map<string, { id: string; t: number }>();
  for (const m of estado.movimentos) {
    if (m.para !== "handoff" || !valido(m.em)) continue;
    const c = ops.get(m.oportunidadeId)?.contatoId;
    const t = Date.parse(m.em);
    if (c && (ultimo.get(c)?.t ?? -Infinity) < t) ultimo.set(c, { id: m.id, t });
  }
  const ultimoPedido = new Map([...ultimo].map(([c, x]) => [c, x.id]));
  const linhas: LinhaDaAtividade[] = [];
  for (const m of estado.movimentos) {
    if (!valido(m.em)) continue;
    const o = ops.get(m.oportunidadeId);
    const c = o?.contatoId;
    const ha = haQuanto(m.em, agora);
    if (m.para === "pago") {
      const pago = estado.pagamentos.filter((p) => p.oportunidadeId === m.oportunidadeId && p.status === "pago").reduce((s, p) => s + p.valor, 0);
      linhas.push({
        id: `venda-${m.id}`,
        em: m.em,
        icone: "cifrao",
        titulo: `Venda · ${pessoa(c)}`,
        detalhe: [o ? produtos.get(o.produtoId) : null, ha].filter(Boolean).join(" · "),
        valor: pago > 0 ? reais(pago) : null,
        estado: pago > 0 ? { texto: "paga", tom: "ok" } : { texto: "em Pago", tom: "neutro" },
        href: c ? hrefFicha(c) : DESTINOS.resultados,
      });
    } else if (m.para === "handoff") {
      const esperando = !!c && contatos.get(c)?.handoffPendente === true && ultimoPedido.get(c) === m.id;
      linhas.push({
        id: `pedido-${m.id}`,
        em: m.em,
        icone: "assumir",
        titulo: `Pediu uma pessoa · ${pessoa(c)}`,
        detalhe: [`${estado.config.nomeRobo} passou a conversa`, ha].join(" · "),
        valor: null,
        estado: esperando ? { texto: "esperando", tom: "espera" } : { texto: "pedido", tom: "neutro" },
        href: c ? hrefConversa(c) : DESTINOS.fila,
      });
    }
  }
  for (const c of estado.contatos) {
    if (!valido(c.criadoEm)) continue;
    linhas.push({
      id: `lead-${c.id}`,
      em: c.criadoEm,
      icone: "pessoas",
      titulo: `Contato novo · ${pessoa(c.id)}`,
      detalhe: [c.origem ? `via ${funis.get(c.origem) ?? c.origem}` : "sem origem", haQuanto(c.criadoEm, agora)].join(" · "),
      valor: null,
      estado: { texto: "novo", tom: "neutro" },
      href: hrefFicha(c.id),
    });
  }
  return linhas.sort((a, b) => Date.parse(b.em) - Date.parse(a.em) || a.id.localeCompare(b.id)).slice(0, limite);
}

/** Nome da etapa (para textos). */
export const nomeEtapa = (id: EtapaId) => etapaDe(id)?.nome ?? id;
