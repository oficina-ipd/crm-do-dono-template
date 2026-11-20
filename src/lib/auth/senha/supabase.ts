import { createClient as criarClienteSupabase, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { OperadorDaSessao } from "./mensagens";
import type { ConferenciaSenha } from "./conta";
import { ehRecusaDeCredencial } from "./mensagens";

/** Ligações reais com o Supabase usadas pelas rotas de entrada e de conta. Só servidor. */

/** Operador ligado ao usuário, lido com a sessão dele (a RLS só mostra a linha a operador ativo). */
export async function buscarOperadorDoUsuario(supabase: SupabaseClient, userId: string): Promise<OperadorDaSessao | null> {
  const { data, error } = await supabase
    .from("crm_operadores")
    .select("id, nome, papel, tipo, ativo")
    .eq("user_id", userId)
    .eq("ativo", true)
    .maybeSingle();
  if (error) throw new Error(`crm_operadores: ${error.code ?? error.message}`);
  return (data as OperadorDaSessao | null) ?? null;
}

/**
 * Confere e-mail e senha num cliente sem cookies (a sessão nasce e morre aqui dentro) e encerra
 * a sessão de conferência logo depois. Não mexe na sessão de quem pediu.
 */
export async function conferirSenhaDescartavel(email: string, senha: string): Promise<ConferenciaSenha> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !chave) return { ok: false, recusada: false };
  const temporario = criarClienteSupabase(url, chave, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await temporario.auth.signInWithPassword({ email, password: senha });
  if (error || !data.session || !data.user) return { ok: false, recusada: ehRecusaDeCredencial(error) };
  await temporario.auth.signOut({ scope: "local" }).catch(() => undefined);
  return { ok: true, userId: data.user.id };
}

/**
 * Apaga os cookies de sessão do Supabase desta resposta. Reserva para quando o `signOut` não
 * conseguiu falar com o Auth: quem foi recusado não sai daqui com sessão no navegador.
 */
export async function apagarCookiesDeSessao(): Promise<void> {
  try {
    const loja = await cookies();
    for (const c of loja.getAll()) if (/^sb-.+-auth-token(\.\d+)?$/.test(c.name)) loja.delete(c.name);
  } catch {
    /* fora de uma rota: nada a apagar */
  }
}
