import type { NextRequest } from "next/server";
import { createClient, temSupabase } from "@/lib/supabase/server";
import { entrarComSenha } from "@/lib/auth/senha/entrar";
import { chaveEmail, limitadoresDoServidor } from "@/lib/auth/senha/limitador";
import { respostaDeEntrar } from "@/lib/auth/senha/mensagens";
import { apagarCookiesDeSessao, buscarOperadorDoUsuario } from "@/lib/auth/senha/supabase";
import { ipDe, json, lerJson, origemConfiavel, origemRecusada, responder, semSupabase, senhaNaUrl } from "@/lib/auth/senha/http";

/**
 * Entrar com e-mail e senha. Só POST com corpo JSON: a senha nunca vai na URL (GET não existe
 * aqui; o Next responde 405) e nunca é escrita no log. Regras em src/lib/auth/senha/entrar.ts.
 */
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (senhaNaUrl(request.nextUrl)) return json({ error: "A senha não pode ir no endereço. Use o formulário de entrada.", code: "invalido" }, 400);
  if (!temSupabase()) return semSupabase();
  if (!origemConfiavel(request.headers)) return origemRecusada();
  const corpo = await lerJson(request);
  if (!corpo) return json({ error: "Preencha o e-mail e a senha.", code: "invalido" }, 400);

  const supabase = await createClient();
  const limites = limitadoresDoServidor();
  const resultado = await entrarComSenha(
    {
      cliente: supabase.auth,
      buscarOperador: (userId) => buscarOperadorDoUsuario(supabase, userId),
      limiteIp: limites.entrarIp,
      limiteEmail: limites.entrarEmail,
      chaveEmail,
      agora: Date.now,
      esperar: (ms) => new Promise((ok) => setTimeout(ok, ms)),
      sortear: Math.random,
    },
    { email: corpo.email, senha: corpo.senha, ip: ipDe(request.headers), next: corpo.next },
  );
  if (resultado.tipo === "credenciais" || resultado.tipo === "indisponivel") await apagarCookiesDeSessao();
  return responder(respostaDeEntrar(resultado));
}
