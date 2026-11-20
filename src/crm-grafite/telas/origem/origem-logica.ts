/**
 * Origem dos leads (antiga Demandas): totais por origem, por dia ou semana, gasto de mídia por
 * criativo e comparação com o período anterior. Puro e testado; tudo sai do EstadoCRM.
 * Dias usam o horário local do navegador (o mesmo das outras contas do template).
 */
import { demanda, type Demanda } from "@/domain/metricas";
import type { EstadoCRM, GastoMidia } from "@/domain/types";
import { AMOSTRA_MINIMA, dentro, intervaloAnterior, intervaloDias, type Intervalo } from "../resultados/resultados-logica";

export const PERIODOS_ORIGEM = [7, 14, 30] as const;

export function periodoValido(n: number): number {
  return (PERIODOS_ORIGEM as readonly number[]).includes(n) ? n : 14;
}

export function intervalosOrigem(dias: number, agora: string): { atual: Intervalo; anterior: Intervalo } {
  const atual = intervaloDias(dias, agora);
  return { atual, anterior: intervaloAnterior(atual) };
}

/** Chave AAAA-MM-DD do dia local de um instante. */
export function diaLocal(iso: string): string {
  const d = new Date(iso);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dd}`;
}

const somarDia = (dia: string, n: number) => {
  const d = new Date(`${dia}T12:00:00`);
  d.setDate(d.getDate() + n);
  return diaLocal(d.toISOString());
};

/** Contatos novos por dia no intervalo, com os dias sem entrada em zero (do mais antigo ao mais novo). */
export function entradasPorDia(estado: EstadoCRM, i: Intervalo): Array<{ dia: string; total: number }> {
  const mapa = new Map<string, number>();
  for (const c of estado.contatos) {
    if (!dentro(c.criadoEm, i)) continue;
    const k = diaLocal(c.criadoEm);
    mapa.set(k, (mapa.get(k) ?? 0) + 1);
  }
  const out: Array<{ dia: string; total: number }> = [];
  const fim = diaLocal(i.fim);
  for (let d = diaLocal(i.inicio); d <= fim; d = somarDia(d, 1)) out.push({ dia: d, total: mapa.get(d) ?? 0 });
  return out;
}

export type UnidadeOrigem = "dia" | "semana";

/** 30 dias por dia viraria uma coluna de 30 linhas: o padrão é por semana. */
export function unidadePadrao(dias: number): UnidadeOrigem {
  return dias >= 30 ? "semana" : "dia";
}

/** A escolha da pessoa vale para o período em que foi feita; trocar o período volta ao padrão. */
export function unidadeEfetiva(escolha: { dias: number; unidade: UnidadeOrigem } | null, dias: number): UnidadeOrigem {
  return escolha && escolha.dias === dias ? escolha.unidade : unidadePadrao(dias);
}

/** Semana começando na segunda (chave = a segunda-feira). */
export function segundaDe(dia: string): string {
  const d = new Date(`${dia}T12:00:00`);
  const desloc = (d.getDay() + 6) % 7;
  return somarDia(dia, -desloc);
}

export function agruparPorSemana(serie: Array<{ dia: string; total: number }>): Array<{ semana: string; total: number; dias: number }> {
  const m = new Map<string, { total: number; dias: number }>();
  for (const s of serie) {
    const k = segundaDe(s.dia);
    const a = m.get(k) ?? { total: 0, dias: 0 };
    m.set(k, { total: a.total + s.total, dias: a.dias + 1 });
  }
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([semana, v]) => ({ semana, ...v }));
}

export function percentual(parte: number, total: number): string {
  if (total <= 0) return "—";
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format((parte / total) * 100)}%`;
}

/** Taxa entre duas contagens: abaixo de 10 na base vira "amostra pequena". */
export function taxaComAmostra(parte: number, base: number, minimo = AMOSTRA_MINIMA): string {
  if (base === 0) return "—";
  if (base < minimo) return `Amostra pequena (${base})`;
  return percentual(parte, base);
}

export function diaCurto(dia: string): string {
  const [, m, d] = dia.split("-");
  return `${d}/${m}`;
}

/** Resumo textual da série (alternativa acessível ao gráfico). Nulo quando não há série real. */
export function resumoSerie(serie: Array<{ dia: string; total: number }>): string | null {
  if (serie.length < 3) return null;
  const total = serie.reduce((a, s) => a + s.total, 0);
  if (total === 0) return null;
  const max = serie.reduce((a, s) => (s.total > a.total ? s : a), serie[0]);
  const min = serie.reduce((a, s) => (s.total < a.total ? s : a), serie[0]);
  const media = total / serie.length;
  const fmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
  const metade = Math.floor(serie.length / 2);
  const antes = serie.slice(0, metade).reduce((a, s) => a + s.total, 0);
  const depois = serie.slice(serie.length - metade).reduce((a, s) => a + s.total, 0);
  const tendencia =
    depois > antes * 1.15
      ? "A segunda metade do período teve mais entradas que a primeira."
      : depois < antes * 0.85
        ? "A segunda metade do período teve menos entradas que a primeira."
        : "As duas metades do período ficaram parecidas.";
  return `Média de ${fmt.format(media)} por dia. Maior dia: ${diaCurto(max.dia)}, com ${max.total}. Menor: ${diaCurto(min.dia)}, com ${min.total}. ${tendencia}`;
}

/** Série com informação suficiente para virar gráfico (evita "minilinha" de 2 pontos). */
export function temSerieReal(serie: Array<{ total: number }>): boolean {
  return serie.length >= 7 && serie.filter((s) => s.total > 0).length >= 2;
}

// ───────────────────────── Por origem e por funil ─────────────────────────

export type LinhaOrigem = { chave: string; rotulo: string; total: number };

/** Contatos novos por origem (o funil de entrada do contato). Origem sem funil cadastrado aparece pelo código. */
export function porOrigem(estado: EstadoCRM, i: Intervalo): LinhaOrigem[] {
  const nomes = new Map(estado.funis.map((f) => [f.id, f.nome]));
  const mapa = new Map<string, number>();
  for (const c of estado.contatos) {
    if (!dentro(c.criadoEm, i)) continue;
    const k = c.origem || "";
    mapa.set(k, (mapa.get(k) ?? 0) + 1);
  }
  return [...mapa.entries()]
    .map(([k, total]) => ({ chave: k || "__sem", rotulo: k ? nomes.get(k) ?? k : "Sem origem", total }))
    .sort((a, b) => b.total - a.total || a.rotulo.localeCompare(b.rotulo));
}

export type LinhaFunil = { chave: string; nome: string; canal: string; d: Demanda; total?: boolean };

/** Uma linha por funil de entrada ativo (ou com movimento no período), mais o total. */
export function porFunil(estado: EstadoCRM, i: Intervalo): LinhaFunil[] {
  const linhas = estado.funis
    .map((f) => ({ chave: f.id, nome: f.nome, canal: f.canal, d: demanda(estado, i, f.id), ativo: f.ativo }))
    .filter((l) => l.ativo || l.d.leads > 0 || l.d.gasto > 0 || l.d.vendas > 0)
    .map(({ ativo: _a, ...l }) => l);
  return [...linhas, { chave: "__total", nome: "Total", canal: "", d: demanda(estado, i), total: true }];
}

// ───────────────────────── Gasto de mídia ─────────────────────────

export type LinhaCriativo = { chave: string; nome: string; funil: string; plataforma: string; gasto: number; visitas: number; total?: boolean };

/** Mesmo critério de `demanda()` no domínio (data do gasto contra o dia ISO do intervalo): os totais batem. */
const diaDentro = (dia: string, i: Intervalo) => dia >= i.inicio.slice(0, 10) && dia <= i.fim.slice(0, 10);

export function gastosDoPeriodo(estado: EstadoCRM, i: Intervalo): GastoMidia[] {
  return estado.gastos.filter((g) => diaDentro(g.data, i)).sort((a, b) => b.data.localeCompare(a.data));
}

/** Gasto e visitas por criativo no período (gasto sem criativo fica em "Sem criativo"), com total. */
export function gastoPorCriativo(estado: EstadoCRM, i: Intervalo): LinhaCriativo[] {
  const criativos = new Map(estado.criativos.map((c) => [c.id, c]));
  const funis = new Map(estado.funis.map((f) => [f.id, f.nome]));
  const mapa = new Map<string, LinhaCriativo>();
  for (const g of gastosDoPeriodo(estado, i)) {
    const c = g.criativoId ? criativos.get(g.criativoId) : undefined;
    const chave = c ? c.id : `__sem:${g.funilId}`;
    const atual = mapa.get(chave) ?? {
      chave,
      nome: c?.nome ?? "Sem criativo",
      funil: funis.get(c?.funilId ?? g.funilId) ?? g.funilId,
      plataforma: c?.plataforma ?? "—",
      gasto: 0,
      visitas: 0,
    };
    atual.gasto += g.valor;
    atual.visitas += g.visitas;
    mapa.set(chave, atual);
  }
  const linhas = [...mapa.values()].sort((a, b) => b.gasto - a.gasto);
  if (linhas.length === 0) return [];
  return [
    ...linhas,
    { chave: "__total", nome: "Total", funil: "", plataforma: "", gasto: linhas.reduce((s, l) => s + l.gasto, 0), visitas: linhas.reduce((s, l) => s + l.visitas, 0), total: true },
  ];
}

// ───────────────────────── Comparação ─────────────────────────

export type LinhaComparacao = { chave: string; rotulo: string; atual: number | null; anterior: number | null; tipo: "n" | "reais"; menorMelhor?: boolean };

export function comparacao(atual: Demanda, anterior: Demanda): LinhaComparacao[] {
  return [
    { chave: "leads", rotulo: "Contatos novos", atual: atual.leads, anterior: anterior.leads, tipo: "n" },
    { chave: "qualificados", rotulo: "Passaram para uma pessoa", atual: atual.qualificados, anterior: anterior.qualificados, tipo: "n" },
    { chave: "ofertas", rotulo: "Ofertas", atual: atual.ofertas, anterior: anterior.ofertas, tipo: "n" },
    { chave: "vendas", rotulo: "Vendas", atual: atual.vendas, anterior: anterior.vendas, tipo: "n" },
    { chave: "receita", rotulo: "Receita", atual: atual.receita, anterior: anterior.receita, tipo: "reais" },
    { chave: "gasto", rotulo: "Gasto em mídia", atual: atual.gasto, anterior: anterior.gasto, tipo: "reais", menorMelhor: true },
    { chave: "cpl", rotulo: "Custo por contato novo", atual: atual.cpl, anterior: anterior.cpl, tipo: "reais", menorMelhor: true },
    { chave: "cpv", rotulo: "Custo por venda", atual: atual.cpv, anterior: anterior.cpv, tipo: "reais", menorMelhor: true },
  ];
}

/** "+12%", "−8%", "igual", ou "—" quando não dá para comparar (anterior zero ou sem valor). */
export function variacaoTexto(atual: number | null, anterior: number | null): string {
  if (atual == null || anterior == null) return "—";
  if (anterior === 0) return atual === 0 ? "igual" : "—";
  const v = Math.round(((atual - anterior) / anterior) * 100);
  if (v === 0) return "igual";
  return v > 0 ? `+${v}%` : `−${Math.abs(v)}%`;
}

// ───────────────────────── Lançar gasto ─────────────────────────

export type FormGasto = { funilId: string; criativoId: string; data: string; valor: string; visitas: string };
export type ErrosGasto = Partial<Record<keyof FormGasto, string>>;

/** "45", "45,90", "1.234,50" ou "45.90" → número; NaN quando não é valor. */
export function lerReais(bruto: string): number {
  const t = bruto.trim().replace(/^R\$\s*/i, "");
  if (t === "") return NaN;
  const normal = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  return /^\d+(\.\d{1,2})?$/.test(normal) ? Number(normal) : NaN;
}

export function validarGasto(f: FormGasto, hoje: string): ErrosGasto {
  const e: ErrosGasto = {};
  if (!f.funilId) e.funilId = "Escolha o funil de entrada.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.data)) e.data = "Escolha o dia do gasto.";
  else if (f.data > hoje) e.data = "O dia não pode ser depois de hoje.";
  const valor = lerReais(f.valor);
  if (f.valor.trim() === "") e.valor = "Diga quanto foi gasto, em reais.";
  else if (!Number.isFinite(valor) || valor < 0) e.valor = "Use um valor em reais, como 45 ou 45,90.";
  else if (valor > 1_000_000) e.valor = "Use um valor até R$ 1.000.000 por lançamento.";
  if (f.visitas.trim() !== "") {
    const v = Number(f.visitas.trim());
    if (!Number.isInteger(v) || v < 0) e.visitas = "Use um número inteiro de visitas, ou deixe em branco.";
  }
  return e;
}

/** Converte o formulário validado no gasto do comando `lancarGasto`. */
export function gastoDoForm(f: FormGasto): Omit<GastoMidia, "id"> {
  return {
    funilId: f.funilId,
    criativoId: f.criativoId || null,
    data: f.data,
    valor: lerReais(f.valor),
    visitas: f.visitas.trim() === "" ? 0 : Number(f.visitas.trim()),
  };
}
