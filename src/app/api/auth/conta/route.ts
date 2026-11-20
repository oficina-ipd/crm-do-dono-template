import { createClient, temSupabase } from "@/lib/supabase/server";
import { operadorPodeEntrar } from "@/lib/auth/senha/mensagens";
import { buscarOperadorDoUsuario } from "@/lib/auth/senha/supabase";
import { json } from "@/lib/auth/senha/http";

/**
 * Minha conta: o CRM está ligado ao Supabase? Há sessão de um operador ativo neste navegador?
 * Só leitura e sem segredo (nenhuma senha passa por aqui).
 *
 *  { supabase: false }                                  → modo local (demo)
 *  { supabase: true, sessao: null }                     → sem sessão de operador
 *  { supabase: true, sessao: { email, nome, papel } }   → operador ativo com sessão
 */
export const dynamic = "force-dynamic";

export async function GET() {
  if (!temSupabase()) return json({ supabase: false });
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    const usuario = data.user;
    if (!usuario?.email) return json({ supabase: true, sessao: null });
    const operador = await buscarOperadorDoUsuario(supabase, usuario.id);
    if (!operador || !operadorPodeEntrar(operador)) return json({ supabase: true, sessao: null });
    return json({ supabase: true, sessao: { email: usuario.email, nome: operador.nome, papel: operador.papel } });
  } catch (e) {
    console.error("[conta] leitura da sessão falhou", e instanceof Error ? e.message : "erro");
    return json({ error: "Não conseguimos conferir a sua conta agora.", code: "indisponivel" }, 503);
  }
}
