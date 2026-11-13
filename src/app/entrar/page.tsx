import type { Metadata } from "next";
import { temSupabase } from "@/lib/supabase/server";
import { PaginaEntrar } from "@/crm-grafite/telas/entrar/entrar-conta";
import { avisoDaUrl } from "@/crm-grafite/telas/entrar/acesso-logica";

export const metadata: Metadata = { title: "Entrar · CRM do dono" };
export const dynamic = "force-dynamic";

/**
 * Entrada com conta (Supabase Auth): e-mail e senha, com o link por e-mail como alternativa.
 * Sem Supabase configurado, a página diz isso e leva ao modo demo em "/".
 */
export default async function EntrarPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const erro = typeof sp.erro === "string" ? sp.erro : null;
  return <PaginaEntrar supabaseLigado={temSupabase()} avisoInicial={avisoDaUrl(erro)} />;
}
