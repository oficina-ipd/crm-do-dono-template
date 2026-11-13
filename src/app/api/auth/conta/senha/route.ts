import type { NextRequest } from "next/server";
import { createClient, temSupabase } from "@/lib/supabase/server";
import { trocarSenha } from "@/lib/auth/senha/conta";
import { limitadoresDoServidor } from "@/lib/auth/senha/limitador";
import { respostaDeTrocar } from "@/lib/auth/senha/mensagens";
import { buscarOperadorDoUsuario, conferirSenhaDescartavel } from "@/lib/auth/senha/supabase";
import { json, lerJson, origemConfiavel, origemRecusada, responder, semSupabase, senhaNaUrl } from "@/lib/auth/senha/http";

/**
 * Minha conta: trocar a própria senha. Pede a atual (conferida com um novo signInWithPassword no
 * servidor antes do updateUser). Só POST com corpo JSON; nenhuma senha vai para o log.
 */
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (senhaNaUrl(request.nextUrl)) return json({ error: "A senha não pode ir no endereço.", code: "invalido" }, 400);
  if (!temSupabase()) return semSupabase();
  if (!origemConfiavel(request.headers)) return origemRecusada();
  const corpo = await lerJson(request);
  if (!corpo) return json({ error: "Preencha a senha atual e a nova.", code: "invalido" }, 400);

  const supabase = await createClient();
  let usuario: { id: string; email: string | null } | null = null;
  let operador = null;
  try {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      usuario = { id: data.user.id, email: data.user.email ?? null };
      operador = await buscarOperadorDoUsuario(supabase, data.user.id);
    }
  } catch (e) {
    console.error("[conta] leitura da sessão falhou", e instanceof Error ? e.message : "erro");
    return responder(respostaDeTrocar({ tipo: "indisponivel" }));
  }

  const resultado = await trocarSenha(
    {
      usuario,
      operador,
      conferirSenha: conferirSenhaDescartavel,
      atualizarSenha: async (senhaNova) => {
        const { error } = await supabase.auth.updateUser({ password: senhaNova });
        return { error };
      },
      desconectarOutros: async () => {
        const { error } = await supabase.auth.signOut({ scope: "others" });
        return !error;
      },
      limite: limitadoresDoServidor().trocar,
      agora: Date.now,
    },
    { senhaAtual: corpo.senhaAtual, senhaNova: corpo.senhaNova },
  );
  return responder(respostaDeTrocar(resultado));
}
