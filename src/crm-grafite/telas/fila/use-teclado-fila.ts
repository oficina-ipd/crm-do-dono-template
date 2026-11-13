"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "@/crm-grafite/link";
import { proximoIndiceFila, teclaDaFila } from "./logica";

/**
 * Teclado da fila: J/↓ e K/↑ andam entre os itens (foco itinerante: um item com tabIndex 0 por
 * vez), Home/End vão às pontas e Enter no item abre o destino dele (a conversa ou a ficha). Enter
 * num botão de dentro do item continua sendo o botão. J e K só valem com o foco dentro da tela.
 */
export function useTecladoFila(destinos: Array<string | null>) {
  const router = useRouter();
  const raiz = useRef<HTMLDivElement>(null);
  const [ativo, setAtivo] = useState(-1);
  const total = destinos.length;

  const focar = useCallback((i: number) => {
    const el = raiz.current?.querySelector<HTMLElement>(`[data-fila-indice="${i}"]`);
    if (!el) return;
    setAtivo(i);
    el.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      const dentroDaFila = Boolean(alvo && raiz.current?.contains(alvo));
      const tela = raiz.current?.closest("[data-v4-tela]");
      const ok = teclaDaFila({
        key: e.key,
        metaKey: e.metaKey,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
        alvoTag: alvo?.tagName,
        alvoEditavel: alvo?.isContentEditable,
        dentroDaFila,
        naTela: Boolean(alvo && tela?.contains(alvo)),
        dialogoAberto: Boolean(document.querySelector("dialog[open], [role='dialog'][aria-modal='true']")),
      });
      if (!ok) return;
      // índice do item em que o foco está (pode ser um botão dentro dele)
      const item = alvo?.closest<HTMLElement>("[data-fila-indice]");
      const atual = item && raiz.current?.contains(item) ? Number(item.dataset.filaIndice) : dentroDaFila ? ativo : -1;
      const prox = proximoIndiceFila(atual, e.key, total);
      if (prox === null) return;
      e.preventDefault();
      focar(prox);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ativo, total, focar]);

  /** Props do item i: foco itinerante, Enter abre, foco por clique ou Tab atualiza o ativo. */
  const propsDoItem = useCallback(
    (i: number) => ({
      "data-fila-indice": i,
      tabIndex: i === (ativo < 0 || ativo >= total ? 0 : ativo) ? 0 : -1,
      onFocus: (e: { currentTarget: HTMLElement; target: EventTarget }) => {
        if (e.target === e.currentTarget || e.currentTarget.contains(e.target as Node)) setAtivo(i);
      },
      onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
        if (e.key !== "Enter" || e.target !== e.currentTarget) return;
        const href = destinos[i];
        if (!href) return;
        e.preventDefault();
        router.push(href);
      },
    }),
    [ativo, total, destinos, router],
  );

  return { raiz, ativo, propsDoItem };
}
