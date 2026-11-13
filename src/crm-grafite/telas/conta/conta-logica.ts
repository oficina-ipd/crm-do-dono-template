/**
 * Minha conta: regras de tela (puras, sem rede). Quem decide é o servidor
 * (src/app/api/auth/conta/*); aqui é só o que a tela mostra e adianta.
 */
import { validarSenhaNova } from "@/lib/auth/senha/regra";

export type ModeloConta =
  /** CRM sem Supabase (modo demo): não há conta nem senha. */
  | { fase: "local" }
  /** Supabase ligado, mas este navegador não tem sessão de operador ativo. */
  | { fase: "sem_sessao" }
  | { fase: "conta"; email: string; nome: string; papel: string }
  | { fase: "erro" };

/** Lê a resposta de GET /api/auth/conta. `status` nulo = falha de rede. */
export function modeloConta(status: number | null, corpo: unknown): ModeloConta {
  if (status !== 200 || !corpo || typeof corpo !== "object") return { fase: "erro" };
  const c = corpo as { supabase?: unknown; sessao?: unknown };
  if (c.supabase === false) return { fase: "local" };
  if (c.supabase !== true) return { fase: "erro" };
  const s = c.sessao as { email?: unknown; nome?: unknown; papel?: unknown } | null | undefined;
  if (!s) return { fase: "sem_sessao" };
  if (typeof s.email !== "string" || !s.email) return { fase: "erro" };
  return { fase: "conta", email: s.email, nome: typeof s.nome === "string" ? s.nome : "", papel: typeof s.papel === "string" ? s.papel : "" };
}

export type ErrosTroca = { atual: string | null; nova: string | null; repeticao: string | null };

/** Confere os três campos antes de mandar (o servidor confere de novo). */
export function validarTroca(atual: string, nova: string, repeticao: string, email: string | null): ErrosTroca {
  const regra = validarSenhaNova(nova, { email });
  const erroNova = !nova ? "Digite a senha nova." : !regra.ok ? regra.erro : atual && nova === atual ? "A senha nova tem de ser diferente da atual." : null;
  return {
    atual: atual ? null : "Digite a senha que você usa hoje.",
    nova: erroNova,
    repeticao: !repeticao ? "Digite a senha nova de novo." : repeticao !== nova ? "As duas senhas não estão iguais." : null,
  };
}

export function temErro(e: ErrosTroca): boolean {
  return Boolean(e.atual || e.nova || e.repeticao);
}

export type ResultadoTroca =
  | { ok: true; outrosDesconectados: boolean }
  /** `campo`: onde o erro aparece (junto do campo); sem campo, ao lado do botão. `sessao`: a sessão acabou. */
  | { ok: false; erro: string; campo?: "atual" | "nova"; sessao?: boolean };

/** Lê a resposta de POST /api/auth/conta/senha. `status` nulo = falha de rede. */
export function resultadoDaTroca(status: number | null, corpo: { error?: string; code?: string; outrosDesconectados?: boolean } | null): ResultadoTroca {
  if (status === null) return { ok: false, erro: "sem conexão. Confira a internet e tente de novo." };
  if (status === 200) return { ok: true, outrosDesconectados: corpo?.outrosDesconectados === true };
  const erro = corpo?.error ?? "não conseguimos trocar a senha agora. Tente de novo em instantes.";
  if (corpo?.code === "senha_atual") return { ok: false, erro, campo: "atual" };
  if (corpo?.code === "senha_recusada") return { ok: false, erro, campo: "nova" };
  if (corpo?.code === "sem_sessao" || status === 401) return { ok: false, erro, sessao: true };
  return { ok: false, erro };
}

export const ROTULO_PAPEL_CONTA: Record<string, string> = { dono: "Dono", vendedor: "Vendedor", leitura: "Só leitura" };
