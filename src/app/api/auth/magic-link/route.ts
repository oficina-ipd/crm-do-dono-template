import type { NextRequest } from "next/server";
import { createClient, temSupabase } from "@/lib/supabase/server";
import { chaveEmail, limitadoresDoServidor } from "@/lib/auth/senha/limitador";
import { destinoSeguro, textoBloqueio, validarEmail } from "@/lib/auth/senha/mensagens";
import { ipDe, json, lerJson, origemConfiavel, origemRecusada, semSupabase } from "@/lib/auth/senha/http";

/**
 * Link de entrada por e-mail (Supabase `signInWithOtp`). A resposta é a mesma para qualquer
 * e-mail ("se tiver acesso, o link chega"): a tela não revela quem é operador. Quem decide o
 * acesso depois do link é `crm_operadores` (RLS).
 */
export const dynamic = "force-dynamic";

const ENVIADO = "Se este e-mail tiver acesso ao CRM, o link de entrada chega em instantes.";

export async function POST(req: NextRequest) {
  if (!temSupabase()) return semSupabase();
  if (!origemConfiavel(req.headers)) return origemRecusada();
  const corpo = await lerJson(req);
  const email = typeof corpo?.email === "string" ? corpo.email.trim().toLowerCase() : "";
  const erro = validarEmail(email);
  if (erro) return json({ message: erro, error: erro, code: "invalido" }, 400);

  const limites = limitadoresDoServidor();
  const porIp = limites.linkIp.consumir(`ip:${ipDe(req.headers)}`);
  const porEmail = porIp.ok ? limites.linkEmail.consumir(`email:${chaveEmail(email)}`) : porIp;
  if (!porEmail.ok) {
    const texto = textoBloqueio(porEmail.retryAfterSec);
    return json({ message: texto, error: texto, code: "limite" }, 429, { "Retry-After": String(porEmail.retryAfterSec) });
  }

  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
  const next = destinoSeguro(corpo?.next);
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback${next === "/" ? "" : `?next=${encodeURIComponent(next)}`}` },
  });
  if (error) {
    // 4xx do Auth (e-mail que não pode receber link, cadastro fechado…) responde igual ao sucesso.
    if (error.status === 429) {
      const texto = "Muitos pedidos de link agora. Espere um minuto e peça de novo.";
      return json({ message: texto, error: texto, code: "limite" }, 429);
    }
    if (!error.status || error.status >= 500) {
      console.error("[magic-link] envio falhou", error.status ?? "", error.code ?? "");
      const texto = "Não conseguimos enviar o link agora. Tente de novo em instantes.";
      return json({ message: texto, error: texto, code: "indisponivel" }, 503);
    }
  }
  return json({ message: ENVIADO, ok: true });
}
