import { NextResponse } from "next/server";
import type { RespostaRota } from "./mensagens";

/**
 * Apoio das rotas de entrada e de conta: resposta sem cache, conferência de origem e leitura do
 * corpo. A senha só chega no corpo JSON de um POST; nunca na URL e nunca no log.
 */

export function json(corpo: unknown, status = 200, headers?: Record<string, string>): NextResponse {
  const r = NextResponse.json(corpo, { status, headers });
  r.headers.set("Cache-Control", "no-store");
  return r;
}

export function responder(r: RespostaRota): NextResponse {
  return json(r.corpo, r.status, r.headers);
}

/**
 * Verdadeiro quando o pedido pode ter vindo da própria tela do CRM: corpo `application/json`
 * (formulário de outro site não consegue mandar) e, se houver `Origin`, o mesmo host.
 */
export function origemConfiavel(headers: Headers): boolean {
  const tipo = headers.get("content-type") ?? "";
  if (!/^application\/json\b/i.test(tipo)) return false;
  if (headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = headers.get("origin");
  if (!origin) return true; // cliente que não é navegador: não carrega cookie de terceiro
  const hosts = [headers.get("host"), headers.get("x-forwarded-host")]
    .flatMap((h) => (h ?? "").split(","))
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  try {
    return hosts.includes(new URL(origin).host.toLowerCase());
  } catch {
    return false;
  }
}

export function origemRecusada(): NextResponse {
  return json({ error: "Pedido recusado. Recarregue a página e tente de novo.", code: "origem" }, 403);
}

/** Senha na URL (alguém montou um GET ou um formulário sem método): recusa sem ler mais nada. */
export function senhaNaUrl(url: URL): boolean {
  for (const k of url.searchParams.keys()) if (/senha|pass(word)?|pwd/i.test(k)) return true;
  return false;
}

export async function lerJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const corpo: unknown = await request.json();
    return corpo && typeof corpo === "object" && !Array.isArray(corpo) ? (corpo as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * IP de quem pediu, para o limite de tentativas. Atrás de um proxy (Vercel), o primeiro item de
 * `x-forwarded-for` é o do navegador. Sem proxy, o cabeçalho pode ser forjado: o limite por
 * e-mail continua valendo de qualquer jeito.
 */
export function ipDe(headers: Headers): string {
  const xff = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return xff || headers.get("x-real-ip")?.trim() || "sem-ip";
}

export function semSupabase(): NextResponse {
  return json({ error: "Este CRM não está ligado ao Supabase: não há contas nem senhas. Use o modo demo.", code: "sem_supabase" }, 404);
}
