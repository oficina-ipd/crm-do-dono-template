/** Regras puras da Table (ordenação e seleção), testáveis sem React. */

export type Direcao = "asc" | "desc";
export type Ordem = { coluna: string; direcao: Direcao };

/** aria-sort da coluna conforme a ordem atual. */
export function ariaSort(coluna: string, ordem?: Ordem): "ascending" | "descending" | "none" {
  if (!ordem || ordem.coluna !== coluna) return "none";
  return ordem.direcao === "asc" ? "ascending" : "descending";
}

/** Clique no título: mesma coluna inverte; outra coluna começa crescente. */
export function proximaOrdem(coluna: string, ordem?: Ordem): Ordem {
  if (ordem?.coluna === coluna) return { coluna, direcao: ordem.direcao === "asc" ? "desc" : "asc" };
  return { coluna, direcao: "asc" };
}

/** Marca/desmarca todas as linhas visíveis (mantém seleção de fora da página). */
export function alternarTodas(ids: string[], selecionadas: Set<string>): Set<string> {
  const todas = ids.length > 0 && ids.every((id) => selecionadas.has(id));
  const novo = new Set(selecionadas);
  for (const id of ids) {
    if (todas) novo.delete(id);
    else novo.add(id);
  }
  return novo;
}


/**
 * Região com rolagem própria precisa ser alcançável pelo teclado (WCAG 2.1.1) quando o
 * conteúdo passa da caixa: aí ganha tabindex e nome. Sem transbordo, nenhuma parada extra.
 */
export function rolagemPrecisaDeFoco(m: { scrollWidth: number; clientWidth: number; scrollHeight: number; clientHeight: number }): boolean {
  return m.scrollWidth - m.clientWidth > 1 || m.scrollHeight - m.clientHeight > 1;
}

/** Elementos que têm ação própria dentro da linha: o clique neles nunca abre a linha. */
export const SELETOR_INTERATIVO_LINHA = "a, button, input, label, select, textarea, summary, [role='button'], [role='checkbox'], [role='menuitem']";

/**
 * Linha clicável: o link real fica na célula principal. Com a coluna principal fixa (Grafite),
 * a área de clique do link não cobre mais a linha inteira, então a linha repassa o clique
 * das outras células para o link. Clique em algo com ação própria segue com ele.
 */
export function cliqueAbreLinha(alvo: { closest: (seletor: string) => unknown } | null | undefined): boolean {
  if (!alvo) return false;
  return !alvo.closest(SELETOR_INTERATIVO_LINHA);
}

/** Sombra na borda da coluna fixa só quando a tabela rolou para o lado. */
export function roladaParaOLado(scrollLeft: number): boolean {
  return scrollLeft > 0;
}
