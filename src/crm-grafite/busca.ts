/**
 * Busca de pessoas da paleta ⌘K (v4). Puro: o endpoint injeta a consulta ao banco,
 * os testes injetam uma falsa. Regras:
 * - nome com pelo menos 2 letras, ou telefone com pelo menos 4 dígitos;
 * - no máximo 8 resultados;
 * - telefone e e-mail SEMPRE mascarados (a paleta nunca revela contato completo).
 */
import { mascararEmailCrm as maskEmail, mascararWhatsappCrm as maskWhatsapp } from "@/lib/crm/pii";

export const BUSCA_V4_LIMITE = 8;
export const BUSCA_V4_MAX_CARACTERES = 80;

export type ConsultaBuscaV4 =
  | { tipo: "vazia" }
  | { tipo: "nome"; termo: string }
  | { tipo: "telefone"; digitos: string };

/** Linha crua vinda do banco (o endpoint seleciona só estas colunas). */
export type LinhaPessoaV4 = {
  id: string;
  nome: string | null;
  empresa: string | null;
  whatsapp: string | null;
  email: string | null;
  tipo: string | null;
};

export type PessoaBuscaV4 = {
  id: string;
  nome: string;
  empresa: string | null;
  tipo: "lead" | "member";
  telefone: string | null;
  email: string | null;
  href: string;
};

export function interpretarConsultaV4(bruto: string | null | undefined): ConsultaBuscaV4 {
  const q = (bruto ?? "").slice(0, BUSCA_V4_MAX_CARACTERES).trim();
  if (!q) return { tipo: "vazia" };
  const digitos = q.replace(/\D/g, "");
  const pareceTelefone = /^[\d\s()+.-]+$/.test(q);
  if (pareceTelefone) {
    return digitos.length >= 4 ? { tipo: "telefone", digitos } : { tipo: "vazia" };
  }
  // Tira o que quebra o filtro do PostgREST (vírgula, parênteses, curingas).
  const termo = q.replace(/[,()%*\\_]/g, " ").replace(/\s+/g, " ").trim();
  const letras = termo.match(/\p{L}/gu)?.length ?? 0;
  if (letras < 2) return { tipo: "vazia" };
  return { tipo: "nome", termo };
}

export function pessoaPublicaV4(l: LinhaPessoaV4): PessoaBuscaV4 {
  return {
    id: l.id,
    nome: (l.nome ?? "").trim() || "Sem nome",
    empresa: l.empresa?.trim() || null,
    tipo: l.tipo === "cliente" ? "member" : "lead",
    telefone: maskWhatsapp(l.whatsapp),
    email: maskEmail(l.email),
    href: `/contatos/${encodeURIComponent(l.id)}`,
  };
}

export type ConsultarPessoasV4 = (c: Exclude<ConsultaBuscaV4, { tipo: "vazia" }>, limite: number) => Promise<LinhaPessoaV4[]>;

export async function buscarPessoasV4(
  bruto: string | null | undefined,
  consultar: ConsultarPessoasV4,
): Promise<{ consulta: ConsultaBuscaV4["tipo"]; pessoas: PessoaBuscaV4[] }> {
  const c = interpretarConsultaV4(bruto);
  if (c.tipo === "vazia") return { consulta: "vazia", pessoas: [] };
  const linhas = await consultar(c, BUSCA_V4_LIMITE);
  return { consulta: c.tipo, pessoas: linhas.slice(0, BUSCA_V4_LIMITE).map(pessoaPublicaV4) };
}
