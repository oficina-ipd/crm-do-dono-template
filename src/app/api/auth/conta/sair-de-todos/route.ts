import type { NextRequest } from "next/server";
import { createClient, temSupabase } from "@/lib/supabase/server";
import { json, origemConfiavel, origemRecusada, semSupabase } from "@/lib/auth/senha/http";
import { apagarCookiesDeSessao } from "@/lib/auth/senha/supabase";

/**
 * Sair de todos os dispositivos: `signOut({ scope: "global" })` encerra no Supabase Auth todas
 * as sessões do usuário, inclusive a deste navegador (os cookies saem junto).
 */
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!temSupabase()) return semSupabase();
  if (!origemConfiavel(request.headers)) return origemRecusada();
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return json({ error: "A sua sessão já tinha terminado. Entre de novo.", code: "sem_sessao" }, 401);
    const { error } = await supabase.auth.signOut({ scope: "global" });
    if (error) {
      console.error("[conta] sair de todos falhou", error.status ?? "", error.code ?? "");
      return json({ error: "não conseguimos encerrar as sessões agora. Tente de novo em instantes.", code: "indisponivel" }, 503);
    }
    await apagarCookiesDeSessao();
    return json({ ok: true });
  } catch (e) {
    console.error("[conta] sair de todos falhou", e instanceof Error ? e.name : "erro");
    return json({ error: "não conseguimos encerrar as sessões agora. Tente de novo em instantes.", code: "indisponivel" }, 503);
  }
}
