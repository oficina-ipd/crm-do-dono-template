"use client";

/**
 * De onde as telas Agentes e Relance leem e onde gravam: as rotas de API que o template já tem
 * (`/api/agents/*`, `/api/whatsapp`, `/api/reciclador/*`), as mesmas da tela antiga.
 * Erros viram frase de quem usa, sem nome de variável de ambiente.
 */
import type { RespostaAgente, ResultadoTickPilot, SugestaoPilot, DecisaoAgente, SlugRodavel } from "./agentes-logica";
import { semNomeTecnico } from "./agentes-logica";

const TEMPO_LIMITE_MS = 70_000;

export class ErroApi extends Error {
  status?: number;
  constructor(msg: string, status?: number) {
    super(msg);
    this.status = status;
  }
}

/** fetch com tempo limite e mensagem legível. Corpo `{ ok: false, erro }` também é erro. */
export async function pedirJson<T>(url: string, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TEMPO_LIMITE_MS);
  try {
    const r = await fetch(url, { cache: "no-store", ...init, signal: ctrl.signal, headers: { "Content-Type": "application/json", ...init?.headers } });
    const corpo = (await r.json().catch(() => ({}))) as { ok?: boolean; erro?: string; error?: string };
    if (!r.ok || corpo.ok === false) {
      const msg =
        r.status === 401
          ? "O servidor não liberou este pedido. Quem instalou o CRM precisa liberar o acesso dos agentes."
          : semNomeTecnico(corpo.erro || corpo.error || `O servidor respondeu com erro (${r.status}).`);
      throw new ErroApi(msg, r.status);
    }
    return corpo as T;
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new ErroApi("O servidor demorou para responder. Tente de novo.");
    if (e instanceof TypeError) throw new ErroApi("Sem conexão com o servidor do CRM. Tente de novo.");
    throw e;
  } finally {
    clearTimeout(t);
  }
}

export type EstadoIa = { configurada: boolean; mascara: string | null; modelo: string; modeloEmber: string };

export async function lerIa(): Promise<EstadoIa> {
  const j = await pedirJson<{ configurada?: boolean; mascara?: string | null; model?: string; emberModel?: string }>("/api/agents/llm");
  return { configurada: Boolean(j.configurada), mascara: j.mascara ?? null, modelo: j.model ?? "", modeloEmber: j.emberModel ?? "" };
}

export async function salvarModeloEmber(modelo: string): Promise<EstadoIa> {
  const j = await pedirJson<{ configurada?: boolean; mascara?: string | null; model?: string; emberModel?: string }>("/api/agents/llm", {
    method: "POST",
    body: JSON.stringify({ emberModel: modelo }),
  });
  return { configurada: Boolean(j.configurada), mascara: j.mascara ?? null, modelo: j.model ?? "", modeloEmber: j.emberModel ?? modelo };
}

export type EstadoWhatsapp = { conectado: boolean; texto: string };

/** Situação da sessão do WhatsApp em linguagem de quem usa (o detalhe técnico do provedor não aparece). */
export function lerStatusWhatsapp(j: { connected?: boolean; status?: string } | null): EstadoWhatsapp {
  const s = String(j?.status ?? "").toLowerCase();
  const conectado = Boolean(j?.connected) || ["connected", "ready", "open", "working", "conectado"].includes(s);
  if (conectado) return { conectado: true, texto: "WhatsApp conectado" };
  if (s === "qr" || s === "pending") return { conectado: false, texto: "WhatsApp esperando a leitura do QR code" };
  return { conectado: false, texto: "WhatsApp sem sessão ativa" };
}

export async function lerWhatsapp(): Promise<EstadoWhatsapp> {
  const r = await fetch("/api/whatsapp", { cache: "no-store" }).catch(() => null);
  if (!r || !r.ok) return { conectado: false, texto: "Não deu para ler a situação do WhatsApp" };
  return lerStatusWhatsapp(await r.json().catch(() => null));
}

export async function lerSugestoesPilot(): Promise<SugestaoPilot[]> {
  return (await pedirJson<{ sugestoes?: SugestaoPilot[] }>("/api/agents/pilot/sugestoes")).sugestoes ?? [];
}

export async function lerDecisoes(limite = 30): Promise<DecisaoAgente[]> {
  return (await pedirJson<{ decisoes?: DecisaoAgente[] }>(`/api/agents/log?limite=${limite}`)).decisoes ?? [];
}

export async function rodarTickPilot(): Promise<ResultadoTickPilot> {
  return pedirJson<ResultadoTickPilot>("/api/agents/pilot/tick", { method: "POST", body: JSON.stringify({}) });
}

export async function executarAgente(slug: SlugRodavel, corpo: { contatoId: string; oportunidadeId?: string; contexto: Record<string, unknown> }): Promise<RespostaAgente> {
  const r = await pedirJson<RespostaAgente & { error?: string }>(`/api/agents/${slug}`, { method: "POST", body: JSON.stringify(corpo) });
  if (!r.saida) throw new ErroApi("O agente não devolveu resultado.");
  return r;
}
