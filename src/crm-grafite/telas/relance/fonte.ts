"use client";

/**
 * Relance: as mesmas rotas que a tela antiga usava (`/api/reciclador/*`), em funções pequenas.
 * Cada função lança `ErroApi` com uma frase legível quando o servidor recusa.
 */
import type {
  CampanhaReciclador,
  EntradaNovaCampanha,
  IncidenteReciclador,
  ItemFilaReciclador,
  MetricasCampanhaReciclador,
  OptOutRegistro,
  ResultadoImportacaoCsv,
  ResultadoSimulacaoReciclador,
  ResultadoTickReciclador,
} from "@/domain/reciclador-types";
import { pedirJson } from "../agentes/fonte";
import type { ConfigRelance } from "./relance-logica";

export type VisaoRelance = { campanhas: CampanhaReciclador[]; optOuts: OptOutRegistro[]; incidentes: IncidenteReciclador[]; emergenciaGlobal: boolean };
export type DetalheRelance = { campanha: CampanhaReciclador; itens: ItemFilaReciclador[]; metricas: MetricasCampanhaReciclador; incidentes: IncidenteReciclador[] };

const enc = encodeURIComponent;
const post = (corpo: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(corpo) });
const patch = (corpo: unknown): RequestInit => ({ method: "PATCH", body: JSON.stringify(corpo) });

export async function lerVisao(): Promise<VisaoRelance> {
  const j = await pedirJson<Partial<VisaoRelance>>("/api/reciclador");
  return { campanhas: j.campanhas ?? [], optOuts: j.optOuts ?? [], incidentes: j.incidentes ?? [], emergenciaGlobal: Boolean(j.emergenciaGlobal) };
}

export async function lerDetalhe(id: string): Promise<DetalheRelance> {
  const j = await pedirJson<{ campanha: CampanhaReciclador; itens?: ItemFilaReciclador[]; metricas: MetricasCampanhaReciclador; incidentes?: IncidenteReciclador[] }>(`/api/reciclador/${enc(id)}`);
  return { campanha: j.campanha, itens: j.itens ?? [], metricas: j.metricas, incidentes: j.incidentes ?? [] };
}

export async function criarCampanha(entrada: EntradaNovaCampanha): Promise<CampanhaReciclador> {
  return (await pedirJson<{ campanha: CampanhaReciclador }>("/api/reciclador", post({ acao: "criar", campanha: entrada }))).campanha;
}

export async function salvarCampanha(id: string, c: ConfigRelance): Promise<void> {
  await pedirJson(`/api/reciclador/${enc(id)}`, patch(c));
}

export async function acaoCampanha(id: string, acao: "ativar" | "pausar" | "retomar_emergencia" | "sincronizar_crm"): Promise<void> {
  await pedirJson(`/api/reciclador/${enc(id)}`, patch({ acao }));
}

export async function simular(id: string, limite = 3): Promise<ResultadoSimulacaoReciclador> {
  return (await pedirJson<{ resultado: ResultadoSimulacaoReciclador }>(`/api/reciclador/${enc(id)}/simular`, post({ limite }))).resultado;
}

export async function processarLote(campanhaId: string, ignorarJanela: boolean): Promise<ResultadoTickReciclador> {
  return (await pedirJson<{ resultado: ResultadoTickReciclador }>("/api/reciclador/tick", post({ campanhaId, ignorarJanela }))).resultado;
}

export async function emergenciaGeral(motivo: string): Promise<{ pausadas: number }> {
  return pedirJson<{ pausadas: number }>("/api/reciclador", post({ acao: "emergencia_global", motivo }));
}

export async function importarCsv(id: string, csv: string): Promise<ResultadoImportacaoCsv> {
  return (await pedirJson<{ resultado: ResultadoImportacaoCsv }>(`/api/reciclador/${enc(id)}/importar`, post({ csv }))).resultado;
}

export async function naoContatar(corpo: { telefone: string; nomeContato?: string; evidencia: string }): Promise<{ itensBloqueados: number }> {
  return pedirJson<{ itensBloqueados: number }>("/api/reciclador", post({ acao: "optout", motivo: "manual", ...corpo }));
}
