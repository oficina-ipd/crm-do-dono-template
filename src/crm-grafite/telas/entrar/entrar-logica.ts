/** Entrar (modo local): navegação por teclado na lista de quem pode entrar. Puro. */

/** Próximo índice para setas, Home e End (sem dar a volta). Nulo = tecla não é de navegação. */
export function proximoOperador(atual: number, total: number, tecla: string): number | null {
  if (total <= 0) return null;
  if (tecla === "ArrowDown") return Math.min(total - 1, atual + 1);
  if (tecla === "ArrowUp") return Math.max(0, atual - 1);
  if (tecla === "Home") return 0;
  if (tecla === "End") return total - 1;
  return null;
}
