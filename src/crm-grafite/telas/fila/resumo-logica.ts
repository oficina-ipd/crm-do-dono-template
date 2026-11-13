/**
 * Resumo do dia da Fila (coluna lateral), em texto. Só números que o estado do CRM permite
 * calcular de verdade: vendas e recebido no mês (movimentos para "Pago" e pagamentos pagos),
 * quem espera uma pessoa agora e há quanto tempo, e leads novos hoje. Meta de vendas não existe
 * no template, então o resumo não fala de meta. Puro.
 */
import { etapaDe } from "@/domain/funil";
import { relatorio } from "@/domain/metricas";
import type { EstadoCRM } from "@/domain/types";

export type ResumoVendas = {
  mesNome: string;
  noMes: number;
  hoje: number;
  /** Soma dos pagamentos pagos no mês, em reais. */
  recebidoMes: number;
  /** No ritmo atual (vendas até hoje ÷ dias passados × dias do mês). null sem venda no mês. */
  previsaoFimDoMes: number | null;
  /** "30/11". */
  ultimoDia: string;
};

export type ResumoEspera = {
  /** Quantas pessoas pediram uma pessoa e ninguém assumiu. */
  esperando: number;
  /** Há quantos minutos espera quem pediu primeiro. null sem ninguém esperando. */
  maiorEsperaMin: number | null;
  /** Prazo da etapa Handoff, em minutos (0 = sem prazo). */
  prazoMin: number;
  /** Quantos já passaram do prazo. */
  foraDoPrazo: number;
};

export type ResumoLeads = { hoje: number; conversaramHoje: number };

export type ResumoDia = { vendas: ResumoVendas; espera: ResumoEspera; leads: ResumoLeads };

const fmtMes = new Intl.DateTimeFormat("pt-BR", { month: "long" });

const inicioDoDia = (d: Date) => {
  const x = new Date(d.getTime());
  x.setHours(0, 0, 0, 0);
  return x.getTime();
};

export function resumoDoDia(estado: EstadoCRM, agoraIso: string): ResumoDia {
  const agora = new Date(agoraIso);
  const r = relatorio(estado, agoraIso);
  const diasNoMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
  const diasPassados = agora.getDate();
  const vendas: ResumoVendas = {
    mesNome: fmtMes.format(agora),
    noMes: r.vendasMes,
    hoje: r.vendasHoje,
    recebidoMes: r.receitaMes,
    previsaoFimDoMes: r.vendasMes > 0 ? Math.round((r.vendasMes / diasPassados) * diasNoMes) : null,
    ultimoDia: `${String(diasNoMes).padStart(2, "0")}/${String(agora.getMonth() + 1).padStart(2, "0")}`,
  };

  const prazoMin = etapaDe("handoff")?.prazoMin ?? 0;
  const esperas = estado.contatos
    .filter((c) => c.handoffPendente)
    .map((c) => Math.max(0, Math.floor((agora.getTime() - Date.parse(c.handoffDesde ?? c.criadoEm)) / 60_000)))
    .filter((m) => Number.isFinite(m));
  const espera: ResumoEspera = {
    esperando: estado.contatos.filter((c) => c.handoffPendente).length,
    maiorEsperaMin: esperas.length ? Math.max(...esperas) : null,
    prazoMin,
    foraDoPrazo: prazoMin > 0 ? esperas.filter((m) => m > prazoMin).length : 0,
  };

  const desde = inicioDoDia(agora);
  const leads: ResumoLeads = {
    hoje: estado.contatos.filter((c) => {
      const t = Date.parse(c.criadoEm);
      return t >= desde && t <= agora.getTime();
    }).length,
    conversaramHoje: new Set(
      estado.movimentos
        .filter((m) => m.para === "conversa" && Date.parse(m.em) >= desde && Date.parse(m.em) <= agora.getTime())
        .map((m) => m.oportunidadeId),
    ).size,
  };

  return { vendas, espera, leads };
}

/** 18 min · 2 h 10 min · 1 d 3 h. */
export function duracaoLonga(min: number): string {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m} min`;
  if (m < 60 * 24) {
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r ? `${h} h ${r} min` : `${h} h`;
  }
  const d = Math.floor(m / (60 * 24));
  const h = Math.floor((m % (60 * 24)) / 60);
  return h ? `${d} d ${h} h` : `${d} d`;
}

export const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
