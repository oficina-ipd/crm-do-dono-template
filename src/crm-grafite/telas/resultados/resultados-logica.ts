/**
 * Resultados (antigo Relatórios/Placar): contas puras sobre o EstadoCRM do template.
 * Tudo sai de movimentos, pagamentos, contatos e mensagens. Nada é digitado à mão.
 * Taxa com menos de 10 entradas vira "amostra pequena", nunca um percentual enganoso.
 */
import { ETAPAS, indiceEtapa } from "@/domain/funil";
import type { Etapa, EstadoCRM, EtapaId } from "@/domain/types";

export type Intervalo = { inicio: string; fim: string };

export const JANELAS_RESULTADOS = [1, 7, 14, 30] as const;
export const AMOSTRA_MINIMA = 10;
const UM_DIA = 86_400_000;

export function rotuloJanela(n: number): string {
  return n === 1 ? "Hoje" : `${n} dias`;
}

export function textoJanela(n: number): string {
  return n === 1 ? "hoje" : `últimos ${n} dias`;
}

export function janelaValida(n: number): number {
  return (JANELAS_RESULTADOS as readonly number[]).includes(n) ? n : 30;
}

/** Início do dia (horário local) do instante dado. */
export function inicioDoDia(iso: string): number {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Últimos `dias` dias até agora, contando hoje (1 = só hoje). */
export function intervaloDias(dias: number, agora: string): Intervalo {
  const inicio = inicioDoDia(agora) - (Math.max(1, dias) - 1) * UM_DIA;
  return { inicio: new Date(inicio).toISOString(), fim: agora };
}

/** Intervalo do mesmo tamanho, logo antes do dado (para comparar). */
export function intervaloAnterior(i: Intervalo): Intervalo {
  const ini = Date.parse(i.inicio);
  const dias = Math.max(1, Math.round((inicioDoDia(i.fim) + UM_DIA - ini) / UM_DIA));
  return { inicio: new Date(ini - dias * UM_DIA).toISOString(), fim: new Date(ini - 1).toISOString() };
}

export function intervaloMes(agora: string): Intervalo {
  const d = new Date(agora);
  return { inicio: new Date(d.getFullYear(), d.getMonth(), 1).toISOString(), fim: agora };
}

export const dentro = (iso: string | null | undefined, i: Intervalo) => {
  if (!iso) return false;
  const t = Date.parse(iso);
  return t >= Date.parse(i.inicio) && t <= Date.parse(i.fim);
};

export function decimal(n: number, casas = 1): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: casas }).format(n);
}

// ───────────────────────── Hoje e no mês ─────────────────────────

export type Contagens = {
  leads: number;
  conversouComRobo: number;
  handoff: number;
  briefing: number;
  proposta: number;
  oferta: number;
  vendas: number;
  receita: number;
};

/** Oportunidades distintas que chegaram em `para` dentro do intervalo. */
function chegaram(estado: EstadoCRM, para: EtapaId, i: Intervalo): number {
  return new Set(estado.movimentos.filter((m) => m.para === para && dentro(m.em, i)).map((m) => m.oportunidadeId)).size;
}

export function contagens(estado: EstadoCRM, i: Intervalo): Contagens {
  return {
    leads: estado.contatos.filter((c) => dentro(c.criadoEm, i)).length,
    conversouComRobo: new Set(estado.mensagens.filter((m) => m.autor === "robo" && !m.aviso && dentro(m.em, i)).map((m) => m.contatoId)).size,
    handoff: chegaram(estado, "handoff", i),
    briefing: chegaram(estado, "briefing", i),
    proposta: chegaram(estado, "proposta", i),
    oferta: chegaram(estado, "oferta", i),
    vendas: chegaram(estado, "pago", i),
    receita: estado.pagamentos.filter((p) => p.status === "pago" && dentro(p.pagoEm, i)).reduce((s, p) => s + p.valor, 0),
  };
}

export type LinhaHojeMes = { chave: keyof Contagens; rotulo: string; hoje: number; mes: number; reais?: boolean };

export function linhasHojeMes(estado: EstadoCRM, agora: string, nomeRobo: string): LinhaHojeMes[] {
  const h = contagens(estado, intervaloDias(1, agora));
  const m = contagens(estado, intervaloMes(agora));
  const linha = (chave: keyof Contagens, rotulo: string, reais = false): LinhaHojeMes => ({ chave, rotulo, hoje: h[chave], mes: m[chave], reais });
  return [
    linha("leads", "Contatos novos"),
    linha("conversouComRobo", `Conversaram com ${nomeRobo}`),
    linha("handoff", "Passaram para uma pessoa"),
    linha("briefing", "Briefings feitos"),
    linha("proposta", "Propostas abertas"),
    linha("oferta", "Ofertas com condição"),
    linha("vendas", "Vendas (pagamento confirmado)"),
    linha("receita", "Receita", true),
  ];
}

/** Dias desde a última venda confirmada (movimento para Pago). null = nenhuma venda registrada. */
export function diasSemFechar(estado: EstadoCRM, agora: string): number | null {
  const ultima = estado.movimentos.filter((m) => m.para === "pago").reduce<number | null>((max, m) => {
    const t = Date.parse(m.em);
    return max == null || t > max ? t : max;
  }, null);
  if (ultima == null) return null;
  return Math.max(0, Math.round((inicioDoDia(agora) - inicioDoDia(new Date(ultima).toISOString())) / UM_DIA));
}

export function textoSemFechar(dias: number | null): string {
  if (dias == null) return "Nenhuma venda registrada";
  if (dias === 0) return "Teve venda hoje";
  return `${dias} ${dias === 1 ? "dia" : "dias"} sem fechar`;
}

// ───────────────────────── Previsão do mês ─────────────────────────

export type Previsao = {
  vendasAteHoje: number;
  receitaAteHoje: number;
  diasPassados: number;
  diasNoMes: number;
  mediaVendasDia: number;
  vendasFimDoMes: number;
  receitaFimDoMes: number | null;
  ticketMedio: number | null;
  receitaTotal: number;
};

/** Conta simples: média por dia até hoje vezes os dias do mês. Sem sazonalidade. */
export function previsaoDoMes(estado: EstadoCRM, agora: string): Previsao {
  const d = new Date(agora);
  const mes = intervaloMes(agora);
  const c = contagens(estado, mes);
  const pagosMes = estado.pagamentos.filter((p) => p.status === "pago" && dentro(p.pagoEm, mes));
  const diasPassados = d.getDate();
  const diasNoMes = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const media = c.vendas / diasPassados;
  return {
    vendasAteHoje: c.vendas,
    receitaAteHoje: c.receita,
    diasPassados,
    diasNoMes,
    mediaVendasDia: media,
    vendasFimDoMes: Math.round(media * diasNoMes),
    receitaFimDoMes: c.receita > 0 ? Math.round((c.receita / diasPassados) * diasNoMes) : null,
    ticketMedio: pagosMes.length ? c.receita / pagosMes.length : null,
    receitaTotal: estado.pagamentos.filter((p) => p.status === "pago").reduce((s, p) => s + p.valor, 0),
  };
}

// ───────────────────────── Taxa por etapa ─────────────────────────

/** Etapas do funil de venda que têm uma próxima (sem Perdido; Dentro é a última). */
const ETAPAS_VENDA = ETAPAS.filter((e) => e.id !== "perdido");
export const ETAPAS_COM_PROXIMA: Array<{ de: Etapa; para: Etapa }> = ETAPAS_VENDA.slice(0, -1).map((de, i) => ({ de, para: ETAPAS_VENDA[i + 1] }));

export type TaxaEtapa = {
  etapaId: EtapaId;
  de: string;
  para: string;
  paraId: EtapaId;
  /** Oportunidades distintas que entraram na etapa no período. */
  entraram: number;
  /** Dessas, quantas chegaram a uma etapa seguinte (qualquer uma à frente) no período. */
  avancaram: number;
  /** Percentual (0–100) ou null sem entradas. */
  real: number | null;
  /** Meta (%) da etapa, definida no funil. */
  meta: number;
};

/**
 * De quem entrou em cada etapa no período, quantos avançaram (no mesmo período).
 * Perdido não conta como avanço.
 */
export function taxasPorEtapa(estado: EstadoCRM, i: Intervalo): TaxaEtapa[] {
  const movs = estado.movimentos.filter((m) => dentro(m.em, i));
  return ETAPAS_COM_PROXIMA.map(({ de, para }) => {
    const idx = indiceEtapa(de.id);
    const entraramIds = new Set(movs.filter((m) => m.para === de.id).map((m) => m.oportunidadeId));
    const avancaramIds = new Set(
      movs.filter((m) => entraramIds.has(m.oportunidadeId) && m.para !== "perdido" && indiceEtapa(m.para) > idx).map((m) => m.oportunidadeId),
    );
    const entraram = entraramIds.size;
    const avancaram = avancaramIds.size;
    return {
      etapaId: de.id,
      de: de.nome,
      para: para.nome,
      paraId: para.id,
      entraram,
      avancaram,
      real: entraram === 0 ? null : Math.round((avancaram / entraram) * 1000) / 10,
      meta: de.meta,
    };
  });
}

/** Taxa de uma etapa: "amostra pequena" abaixo de 10 entradas, nunca um percentual enganoso. */
export function taxaTexto(real: number | null, n: number, minimo = AMOSTRA_MINIMA): string {
  if (n === 0) return "Sem entradas";
  if (n < minimo) return `Amostra pequena (${n})`;
  if (real == null) return "—";
  return `${decimal(real)}%`;
}

export function situacaoTaxa(real: number | null, meta: number | null, n: number, minimo = AMOSTRA_MINIMA): "acima" | "abaixo" | "sem" {
  if (n < minimo || real == null || meta == null) return "sem";
  return real >= meta ? "acima" : "abaixo";
}

// ───────────────────────── Conta reversa ─────────────────────────

export type PassoConta = { etapaId: EtapaId; nome: string; porDia: number };

/**
 * Quantas pessoas precisam entrar por dia em cada etapa para chegar em `vendasPorDia`,
 * usando as taxas do período (de trás para frente: Oferta → Pago, Proposta → Oferta, …).
 * Para na primeira taxa sem amostra suficiente: daí para trás a conta seria chute.
 */
export function contaReversa(vendasPorDia: number, taxas: TaxaEtapa[], minimo = AMOSTRA_MINIMA): { passos: PassoConta[]; bloqueadaEm: string | null } {
  const passos: PassoConta[] = [];
  let precisa = vendasPorDia;
  let alvo: EtapaId = "pago";
  for (;;) {
    const t = taxas.find((x) => x.paraId === alvo);
    if (!t) return { passos, bloqueadaEm: null };
    if (t.entraram < minimo || !t.real) return { passos, bloqueadaEm: `${t.de} → ${t.para}` };
    precisa = precisa / (t.real / 100);
    passos.push({ etapaId: t.etapaId, nome: t.de, porDia: Math.ceil(precisa * 10) / 10 });
    alvo = t.etapaId;
  }
}

/** Validação do campo da conta reversa (junto do campo): de 0,1 a 100 vendas por dia. */
export function validarVendasPorDia(bruto: string): string | null {
  const v = bruto.trim().replace(",", ".");
  if (v === "") return "Diga quantas vendas por dia você quer, de 0,1 a 100.";
  const n = Number(v);
  if (!Number.isFinite(n)) return "Use só números, como 2 ou 1,5.";
  if (n < 0.1 || n > 100) return "Use um número de 0,1 a 100.";
  return null;
}

// ───────────────────────── Em aberto e perdas ─────────────────────────

export type LinhaAberto = { etapaId: EtapaId; nome: string; abertas: number; valor: number; mediaMin: number | null; prazoMin: number };

/** Oportunidades vivas paradas em cada etapa: quantas, quanto valem e há quanto tempo (média). */
export function emAbertoPorEtapa(estado: EstadoCRM, agora: string): LinhaAberto[] {
  const t = Date.parse(agora);
  return ETAPAS.filter((e) => !["pago", "dentro", "perdido"].includes(e.id)).map((e) => {
    const ops = estado.oportunidades.filter((o) => !o.perdida && o.etapa === e.id);
    const mins = ops.map((o) => Math.max(0, Math.round((t - Date.parse(o.entrouNaEtapaEm)) / 60000)));
    return {
      etapaId: e.id,
      nome: e.nome,
      abertas: ops.length,
      valor: ops.reduce((s, o) => s + o.valor, 0),
      mediaMin: mins.length ? Math.round(mins.reduce((a, b) => a + b, 0) / mins.length) : null,
      prazoMin: e.prazoMin,
    };
  });
}

/** "45 min", "3 h", "2 dias". */
export function duracaoCurta(min: number): string {
  if (min < 60) return `${min} min`;
  if (min < 1440) return `${Math.round(min / 60)} h`;
  const d = Math.round(min / 1440);
  return `${d} ${d === 1 ? "dia" : "dias"}`;
}

export type LinhaPerda = { motivo: string; total: number };

/** Perdas no período por motivo (movimento para Perdido; motivo do movimento ou da oportunidade). */
export function perdasPorMotivo(estado: EstadoCRM, i: Intervalo): LinhaPerda[] {
  const porOp = new Map(estado.oportunidades.map((o) => [o.id, o]));
  const mapa = new Map<string, number>();
  const vistos = new Set<string>();
  for (const m of estado.movimentos) {
    if (m.para !== "perdido" || !dentro(m.em, i) || vistos.has(m.oportunidadeId)) continue;
    vistos.add(m.oportunidadeId);
    const motivo = (m.motivo ?? porOp.get(m.oportunidadeId)?.motivoPerda ?? "").trim() || "Sem motivo";
    mapa.set(motivo, (mapa.get(motivo) ?? 0) + 1);
  }
  return [...mapa.entries()].map(([motivo, total]) => ({ motivo: motivo.charAt(0).toUpperCase() + motivo.slice(1), total })).sort((a, b) => b.total - a.total);
}
