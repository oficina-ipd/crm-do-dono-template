"use client";

import Link from "@/crm-grafite/link";
import { useEffect, useState, type MouseEvent as EventoMouse, type ReactNode, type UIEvent } from "react";
import { Checkbox } from "./field";
import { Icon } from "./icon";
import { SkeletonTableRows } from "./feedback";

import { alternarTodas, ariaSort, cliqueAbreLinha, proximaOrdem, roladaParaOLado, rolagemPrecisaDeFoco, type Ordem } from "./tabela-logica";

export { alternarTodas, ariaSort, cliqueAbreLinha, proximaOrdem, roladaParaOLado, rolagemPrecisaDeFoco, type Ordem };
export type { Direcao } from "./tabela-logica";

export type Coluna<T> = {
  id: string;
  titulo: string;
  celula: (linha: T) => ReactNode;
  ordenavel?: boolean;
  numerica?: boolean;
  /** Texto longo: corta com reticências e mostra o valor inteiro no title. */
  cortar?: (linha: T) => string;
  quebrar?: boolean;
};

/**
 * Liga tabindex e nome na região de rolagem só enquanto o conteúdo transborda. `ref` é de
 * função, então vale também para região que aparece depois (painel recolhível).
 */
/** Marca a região quando rolou para o lado (a coluna fixa ganha a sombra da borda só aí). */
function marcarRolagemLateral(e: UIEvent<HTMLDivElement>) {
  const el = e.currentTarget;
  const rolada = roladaParaOLado(el.scrollLeft);
  if (rolada !== el.hasAttribute("data-rolagem-x")) el.toggleAttribute("data-rolagem-x", rolada);
}

/**
 * Clique fora da célula principal de uma linha com link: repassa para o link real (Ctrl/⌘,
 * Shift e botão do meio abrem em nova aba, como o link faria). Fora do Grafite a área do
 * link já cobre a linha e o clique chega aqui vindo do próprio link: nada a fazer.
 */
function abrirPelaLinha(e: EventoMouse<HTMLTableRowElement>) {
  if (e.defaultPrevented || !cliqueAbreLinha(e.target as Element)) return;
  if (e.type === "auxclick" && e.button !== 1) return;
  const link = e.currentTarget.querySelector<HTMLAnchorElement>("a.v4-row__link");
  if (!link) return;
  if (e.type === "auxclick" || e.metaKey || e.ctrlKey || e.shiftKey) {
    window.open(link.href, "_blank", "noopener");
    return;
  }
  link.click();
}

export function useRolagemFocavel() {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [focavel, setFocavel] = useState(false);
  useEffect(() => {
    if (!el || typeof ResizeObserver === "undefined") return;
    const medir = () => setFocavel(rolagemPrecisaDeFoco(el));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [el]);
  return { ref: setEl, focavel: Boolean(el) && focavel };
}

/**
 * Tabela em superfície contínua. Cabeçalho ordenável com aria-sort; seleção com caixa
 * explícita e fundo de apoio; a barra de lote só aparece com seleção e diz quantas são;
 * linha clicável com link real na célula principal (abre em nova aba, tem destino).
 * A densidade vem da raiz (data-density) e pode ser fixada por tabela.
 */
export function Table<T>({
  linhas,
  colunas,
  chave,
  rotulo,
  legenda,
  linkDaLinha,
  nomeDaLinha,
  ordem,
  aoOrdenar,
  selecao,
  aoSelecionar,
  acoesEmLote,
  carregando,
  vazio,
  densidade,
}: {
  linhas: T[];
  colunas: Coluna<T>[];
  chave: (linha: T) => string;
  rotulo: string;
  legenda?: ReactNode;
  /** Destino da linha; a primeira coluna vira link real. */
  linkDaLinha?: (linha: T) => string;
  /** Nome usado nas caixas de seleção ("Selecionar Ana Souza"). */
  nomeDaLinha?: (linha: T) => string;
  ordem?: Ordem;
  aoOrdenar?: (o: Ordem) => void;
  selecao?: Set<string>;
  aoSelecionar?: (s: Set<string>) => void;
  acoesEmLote?: (n: number) => ReactNode;
  carregando?: boolean;
  vazio?: ReactNode;
  densidade?: "compact" | "comfortable";
}) {
  const selecionavel = Boolean(selecao && aoSelecionar);
  const ids = linhas.map(chave);
  const nSel = selecao ? ids.filter((id) => selecao.has(id)).length : 0;
  const todas = ids.length > 0 && nSel === ids.length;
  const algumas = nSel > 0 && !todas;
  const nCol = colunas.length + (selecionavel ? 1 : 0);
  const rolagem = useRolagemFocavel();

  return (
    <div className="v4-tablebox" data-density={densidade}>
      <div
        ref={rolagem.ref}
        className="v4-table-wrap"
        onScroll={marcarRolagemLateral}
        tabIndex={rolagem.focavel ? 0 : undefined}
        role={rolagem.focavel ? "region" : undefined}
        aria-label={rolagem.focavel ? `${rotulo}, role para ver todas as colunas` : undefined}
      >
        <table className="v4-table" aria-label={legenda ? undefined : rotulo} aria-busy={carregando || undefined}>
          {legenda && <caption>{legenda}</caption>}
          <thead>
            <tr>
              {selecionavel && (
                <th scope="col" className="is-check">
                  <Checkbox
                    label={<span className="v4-sr">Selecionar todas as linhas visíveis</span>}
                    checked={todas}
                    indeterminate={algumas}
                    disabled={carregando || ids.length === 0}
                    onChange={() => aoSelecionar?.(alternarTodas(ids, selecao ?? new Set()))}
                  />
                </th>
              )}
              {colunas.map((c) => {
                const sort = c.ordenavel ? ariaSort(c.id, ordem) : undefined;
                return (
                  <th key={c.id} scope="col" aria-sort={sort} className={c.numerica ? "is-num" : undefined}>
                    {c.ordenavel && aoOrdenar ? (
                      <button type="button" className="v4-sort" onClick={() => aoOrdenar(proximaOrdem(c.id, ordem))}>
                        {c.titulo}
                        <Icon name={sort === "ascending" ? "ordenarCima" : sort === "descending" ? "ordenarBaixo" : "ordenar"} />
                        <span className="v4-sr">
                          {sort === "none" ? ", ordenar" : sort === "ascending" ? ", em ordem crescente" : ", em ordem decrescente"}
                        </span>
                      </button>
                    ) : (
                      c.titulo
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <SkeletonTableRows colunas={colunas.length} selecionavel={selecionavel} />
            ) : linhas.length === 0 ? (
              <tr className="v4-table__state">
                <td colSpan={nCol}>{vazio}</td>
              </tr>
            ) : (
              linhas.map((l) => {
                const id = chave(l);
                const sel = selecao?.has(id) ?? false;
                const href = linkDaLinha?.(l);
                return (
                  <tr
                    key={id}
                    className={["v4-row", href ? "v4-row--link" : ""].filter(Boolean).join(" ")}
                    aria-selected={selecionavel ? sel : undefined}
                    onClick={href ? abrirPelaLinha : undefined}
                    onAuxClick={href ? abrirPelaLinha : undefined}
                  >
                    {selecionavel && (
                      <td className="is-check">
                        <Checkbox
                          label={<span className="v4-sr">Selecionar {nomeDaLinha?.(l) ?? id}</span>}
                          checked={sel}
                          onChange={() => {
                            const novo = new Set(selecao);
                            if (sel) novo.delete(id);
                            else novo.add(id);
                            aoSelecionar?.(novo);
                          }}
                        />
                      </td>
                    )}
                    {colunas.map((c, i) => {
                      const conteudo = c.celula(l);
                      const titulo = c.cortar?.(l);
                      const cls = [c.numerica ? "is-num" : "", titulo ? "is-truncate" : "", c.quebrar ? "is-wrap" : ""].filter(Boolean).join(" ") || undefined;
                      return (
                        <td key={c.id} className={cls} title={titulo}>
                          {i === 0 && href ? (
                            <Link href={href} className="v4-row__link">
                              {conteudo}
                            </Link>
                          ) : (
                            conteudo
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div aria-live="polite" className="v4-sr">
        {nSel > 0 ? `${nSel} ${nSel === 1 ? "linha selecionada" : "linhas selecionadas"}` : ""}
      </div>
      {selecionavel && nSel > 0 && (
        <div className="v4-bulk" role="region" aria-label={`Ações em lote: ${rotulo}`}>
          <span className="v4-bulk__count">
            {nSel} {nSel === 1 ? "selecionada" : "selecionadas"}
          </span>
          {acoesEmLote?.(nSel)}
          <button type="button" className="v4-btn v4-btn--ghost v4-btn--sm" onClick={() => aoSelecionar?.(new Set())}>
            <span className="v4-btn__label">Limpar seleção</span>
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Linha de lista (conversas, resultados). Link real quando tem `href`; botão quando tem
 * `onClick`. Selecionada = fundo de apoio + contorno (não só cor).
 */
export function ListRow({
  titulo,
  meta,
  texto,
  inicio,
  tags,
  fim,
  href,
  onClick,
  atual,
  naoLida,
  forceState,
  tabIndex,
}: {
  titulo: ReactNode;
  meta?: ReactNode;
  texto?: ReactNode;
  inicio?: ReactNode;
  tags?: ReactNode;
  fim?: ReactNode;
  href?: string;
  /** Com `href`, o link continua real (nova aba, botão do meio) e o clique simples chama isto. */
  onClick?: (e: EventoMouse<HTMLElement>) => void;
  atual?: boolean;
  naoLida?: boolean;
  forceState?: "hover" | "focus";
  /** Lista com foco itinerante (setas): só a linha atual entra no Tab. */
  tabIndex?: number;
}) {
  const cls = [
    "v4-listrow",
    inicio ? "" : "v4-listrow--noicon",
    naoLida ? "is-unread" : "",
    forceState ? `is-${forceState}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const corpo = (
    <>
      {inicio && <span className="v4-listrow__lead">{inicio}</span>}
      <span className="v4-listrow__title">{titulo}</span>
      {meta ? <span className="v4-listrow__meta">{meta}</span> : <span />}
      {texto && <span className="v4-listrow__text">{texto}</span>}
      {fim && <span className="v4-listrow__end">{fim}</span>}
      {tags && <span className="v4-listrow__tags">{tags}</span>}
      {naoLida && <span className="v4-sr">, não lida</span>}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cls} aria-current={atual ? "page" : undefined} onClick={onClick} tabIndex={tabIndex}>
        {corpo}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" className={cls} aria-current={atual ? "true" : undefined} onClick={onClick} tabIndex={tabIndex}>
        {corpo}
      </button>
    );
  }
  return <div className={cls}>{corpo}</div>;
}
