/**
 * Rascunho do campo de resposta, por conversa, na sessionStorage da aba (some ao fechar a aba,
 * nunca vai para o servidor). Puro e testável com um armazenamento falso; falha de armazenamento
 * (modo privado, cota cheia) nunca quebra o campo.
 */
export type ArmazenamentoRascunho = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const PREFIXO_RASCUNHO = "crm-v4-rascunho:";
export const LIMITE_RASCUNHO = 10_000;

export function chaveRascunho(contatoId: string): string {
  return `${PREFIXO_RASCUNHO}${contatoId}`;
}

export function lerRascunho(s: ArmazenamentoRascunho | null | undefined, chave: string): string {
  if (!s) return "";
  try {
    return s.getItem(chave) ?? "";
  } catch {
    return "";
  }
}

/** Guarda o texto; vazio (ou só espaços) apaga a chave. */
export function guardarRascunho(s: ArmazenamentoRascunho | null | undefined, chave: string, texto: string): void {
  if (!s) return;
  try {
    if (texto.trim() === "") s.removeItem(chave);
    else s.setItem(chave, texto.slice(0, LIMITE_RASCUNHO));
  } catch {
    /* sem armazenamento: o campo segue funcionando, só sem lembrar */
  }
}

export function apagarRascunho(s: ArmazenamentoRascunho | null | undefined, chave: string): void {
  if (!s) return;
  try {
    s.removeItem(chave);
  } catch {
    /* idem */
  }
}

/** sessionStorage do navegador, ou null no servidor / quando bloqueado. */
export function armazenamentoDaSessao(): ArmazenamentoRascunho | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}
