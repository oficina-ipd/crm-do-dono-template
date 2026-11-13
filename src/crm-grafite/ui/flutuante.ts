"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";

/**
 * Camada flutuante da v4 (menu, dica, avisos).
 * - Vai para a "top layer" do navegador com a API popover quando existe: escapa de
 *   `overflow: hidden` e fica acima de diálogos abertos antes dela.
 * - Sem a API, cai para `position: fixed` com `z-index: var(--v4-z-float)`.
 * - A posição é escrita como variáveis CSS (--v4-pop-x / --v4-pop-y) direto no nó,
 *   sem estilo inline no JSX.
 */

export type Lado = "baixo-inicio" | "baixo-fim" | "cima-inicio" | "cima-fim" | "direita" | "cima" | "baixo";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function temPopover(el: HTMLElement): el is HTMLElement & { showPopover: () => void; hidePopover: () => void } {
  return typeof (el as { showPopover?: unknown }).showPopover === "function";
}

export function mostrarNaCamada(el: HTMLElement | null, aberto: boolean) {
  if (!el || !temPopover(el)) return;
  try {
    const ja = el.matches(":popover-open");
    if (aberto && !ja) el.showPopover();
    if (!aberto && ja) el.hidePopover();
  } catch {
    /* navegador sem :popover-open: segue em position fixed */
  }
}

/** Reabre na camada de cima (usado pelos avisos, para ficarem acima de um diálogo novo). */
export function trazerParaFrente(el: HTMLElement | null) {
  if (!el || !temPopover(el)) return;
  try {
    if (el.matches(":popover-open")) el.hidePopover();
    el.showPopover();
  } catch {
    /* sem suporte */
  }
}

export function posicionar(ancora: HTMLElement, flutuante: HTMLElement, lado: Lado, folga = 6) {
  const a = ancora.getBoundingClientRect();
  const f = flutuante.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margem = 8;
  let x = a.left;
  let y = a.bottom + folga;
  switch (lado) {
    case "baixo-fim":
      x = a.right - f.width;
      break;
    case "cima-inicio":
      y = a.top - f.height - folga;
      break;
    case "cima-fim":
      x = a.right - f.width;
      y = a.top - f.height - folga;
      break;
    case "direita":
      x = a.right + folga;
      y = a.top + a.height / 2 - f.height / 2;
      break;
    case "cima":
      x = a.left + a.width / 2 - f.width / 2;
      y = a.top - f.height - folga;
      break;
    case "baixo":
      x = a.left + a.width / 2 - f.width / 2;
      break;
  }
  // Vira para o outro lado quando não cabe
  if (y + f.height > vh - margem && (lado.startsWith("baixo") || lado === "baixo")) y = a.top - f.height - folga;
  if (y < margem && (lado.startsWith("cima") || lado === "cima")) y = a.bottom + folga;
  if (lado === "direita" && x + f.width > vw - margem) x = a.left - f.width - folga;
  x = Math.min(Math.max(margem, x), Math.max(margem, vw - f.width - margem));
  y = Math.min(Math.max(margem, y), Math.max(margem, vh - f.height - margem));
  flutuante.style.setProperty("--v4-pop-x", `${Math.round(x)}px`);
  flutuante.style.setProperty("--v4-pop-y", `${Math.round(y)}px`);
}

/** Mantém o flutuante junto da âncora enquanto aberto (rolagem e redimensionamento). */
export function useFlutuante(
  aberto: boolean,
  ancora: RefObject<HTMLElement | null>,
  flutuante: RefObject<HTMLElement | null>,
  lado: Lado,
) {
  useIsoLayoutEffect(() => {
    const el = flutuante.current;
    mostrarNaCamada(el, aberto);
    if (!aberto || !el || !ancora.current) return;
    const atualizar = () => {
      if (ancora.current && flutuante.current) posicionar(ancora.current, flutuante.current, lado);
    };
    atualizar();
    window.addEventListener("resize", atualizar);
    window.addEventListener("scroll", atualizar, true);
    return () => {
      window.removeEventListener("resize", atualizar);
      window.removeEventListener("scroll", atualizar, true);
    };
  }, [aberto, lado]);
}

/** Fecha ao clicar fora (âncora e flutuante contam como dentro). */
export function useCliqueFora(
  aberto: boolean,
  refs: Array<RefObject<HTMLElement | null>>,
  fechar: () => void,
) {
  const fecharRef = useRef(fechar);
  fecharRef.current = fechar;
  useEffect(() => {
    if (!aberto) return;
    const onDown = (e: PointerEvent) => {
      const alvo = e.target as Node | null;
      if (refs.some((r) => r.current && alvo && r.current.contains(alvo))) return;
      fecharRef.current();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
    // refs são estáveis (useRef)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);
}

export function useIdV4(prefixo: string): string {
  const id = useId().replace(/:/g, "");
  return `${prefixo}-${id}`;
}

/** Lê uma media query no cliente (falso no servidor e na hidratação). */
export function useMidia(query: string): boolean {
  return useSyncExternalStore(
    (avisar) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", avisar);
      return () => mq.removeEventListener("change", avisar);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/**
 * Barra que flutua sobre uma região com rolagem (Grafite: posse + resposta sobre a conversa).
 * Escreve a altura da barra numa variável CSS do elemento pai, para a região reservar o espaço
 * e o fim do conteúdo nunca ficar preso atrás dela, mesmo quando a barra cresce (confirmação,
 * texto longo). Devolve o `ref` da barra. Sem caixa (display: contents), escreve 0.
 */
export function useAlturaNoPai(variavel: string) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const pai = el?.parentElement;
    if (!el || !pai || typeof ResizeObserver === "undefined") return;
    const medir = () => pai.style.setProperty(variavel, `${Math.ceil(el.getBoundingClientRect().height)}px`);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => {
      ro.disconnect();
      pai.style.removeProperty(variavel);
    };
  }, [el, variavel]);
  return setEl;
}
