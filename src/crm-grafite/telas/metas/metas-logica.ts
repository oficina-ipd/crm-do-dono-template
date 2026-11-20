/**
 * Metas: no template a meta é o percentual de conversão de cada etapa do funil (Etapa.meta,
 * definido junto com as etapas). Não há meta de faturamento nem meta diária no estado: a tela
 * não inventa nenhuma. Aqui só se compara meta com o realizado. Puro e testado.
 */
import { ETAPAS } from "@/domain/funil";
import type { EstadoCRM } from "@/domain/types";
import { AMOSTRA_MINIMA, intervaloDias, situacaoTaxa, taxaTexto, taxasPorEtapa, type Intervalo } from "../resultados/resultados-logica";

export const PERIODOS_METAS = [
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
  { value: "tudo", label: "Desde o início" },
] as const;

export type PeriodoMetas = (typeof PERIODOS_METAS)[number]["value"];

export function periodoMetasValido(v: string | null): PeriodoMetas {
  return v === "90" || v === "tudo" ? v : "30";
}

export function intervaloMetas(p: PeriodoMetas, agora: string): Intervalo {
  if (p === "tudo") return { inicio: new Date(0).toISOString(), fim: agora };
  return intervaloDias(Number(p), agora);
}

export function textoPeriodoMetas(p: PeriodoMetas): string {
  return p === "tudo" ? "desde o início" : `nos últimos ${p} dias`;
}

export type SituacaoMeta = "acima" | "abaixo" | "sem";

export type LinhaMeta = {
  etapaId: string;
  de: string;
  para: string;
  meta: number;
  realTexto: string;
  entraram: number;
  avancaram: number;
  situacao: SituacaoMeta;
  /** Pontos percentuais de diferença (realizado − meta), só quando a amostra basta. */
  diferenca: number | null;
  prazoTexto: string;
  validacao: string;
};

export function linhasMetas(estado: EstadoCRM, i: Intervalo, minimo = AMOSTRA_MINIMA): LinhaMeta[] {
  return taxasPorEtapa(estado, i).map((t) => {
    const etapa = ETAPAS.find((e) => e.id === t.etapaId);
    const situacao = situacaoTaxa(t.real, t.meta, t.entraram, minimo);
    return {
      etapaId: t.etapaId,
      de: t.de,
      para: t.para,
      meta: t.meta,
      realTexto: taxaTexto(t.real, t.entraram, minimo),
      entraram: t.entraram,
      avancaram: t.avancaram,
      situacao,
      diferenca: situacao === "sem" || t.real == null ? null : Math.round((t.real - t.meta) * 10) / 10,
      prazoTexto: etapa && etapa.prazoMin > 0 ? etapa.prazoTexto : "Sem prazo",
      validacao: etapa?.validacao ?? "",
    };
  });
}

export function textoSituacao(l: Pick<LinhaMeta, "situacao" | "diferenca" | "entraram">): string {
  if (l.situacao === "sem") return l.entraram === 0 ? "Sem entradas no período" : "Ainda sem amostra para comparar";
  const d = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(Math.abs(l.diferenca ?? 0));
  return l.situacao === "acima" ? `Na meta (${d} pontos acima)` : `Abaixo da meta (${d} pontos)`;
}

/** Resumo em uma frase para a faixa do topo: quantas etapas já dá para comparar e quantas estão abaixo. */
export function resumoMetas(linhas: LinhaMeta[]): string {
  const comparaveis = linhas.filter((l) => l.situacao !== "sem");
  if (comparaveis.length === 0) return "Nenhuma etapa com amostra suficiente ainda";
  const abaixo = comparaveis.filter((l) => l.situacao === "abaixo").length;
  const base = `${comparaveis.length} de ${linhas.length} etapas com amostra`;
  return abaixo === 0 ? `${base} · todas na meta` : `${base} · ${abaixo} abaixo da meta`;
}
