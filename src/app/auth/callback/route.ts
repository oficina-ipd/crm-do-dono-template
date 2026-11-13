import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      // Link vencido ou já usado: volta para a entrada com o aviso, em vez de cair no CRM sem sessão.
      if (error) return NextResponse.redirect(`${origin}/entrar?erro=auth`);
    } catch {
      return NextResponse.redirect(`${origin}/entrar?erro=auth`);
    }
  }
  return NextResponse.redirect(`${origin}${next}`);
}
