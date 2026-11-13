/** Navegação por teclado compartilhada (abas, segmentado, menus, listas). Puro. */

/** Próximo índice habilitado ao andar com setas/Home/End (pula desabilitados, dá a volta). */
export function proximoIndice(
  itens: Array<{ disabled?: boolean }>,
  atual: number,
  tecla: string,
): number | null {
  const n = itens.length;
  if (n === 0) return null;
  const habilitado = (i: number) => !itens[i]?.disabled;
  const andar = (de: number, passo: 1 | -1) => {
    for (let k = 1; k <= n; k++) {
      const i = (de + passo * k + n * 2) % n;
      if (habilitado(i)) return i;
    }
    return null;
  };
  switch (tecla) {
    case "ArrowRight":
    case "ArrowDown":
      return andar(atual, 1);
    case "ArrowLeft":
    case "ArrowUp":
      return andar(atual, -1);
    case "Home":
      return andar(-1, 1);
    case "End":
      return andar(n, -1);
    default:
      return null;
  }
}

