"use client";

import {
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import { useFlutuante, useIdV4, type Lado } from "./flutuante";

type Gatilho = ReactElement<{
  "aria-describedby"?: string;
  onPointerEnter?: (e: SyntheticEvent) => void;
  onPointerLeave?: (e: SyntheticEvent) => void;
  onFocus?: (e: SyntheticEvent) => void;
  onBlur?: (e: SyntheticEvent) => void;
  onKeyDown?: (e: SyntheticEvent) => void;
  ref?: unknown;
}>;

/**
 * Dica acessível por foco e por ponteiro. Abre imediatamente no foco de teclado, com
 * 400 ms no ponteiro; fecha com Escape, ao sair e ao perder o foco.
 * `descreve` (padrão) liga a dica ao gatilho por aria-describedby. Quando a dica só repete
 * o nome acessível (botão de ícone), use `descreve={false}` para não ler duas vezes.
 */
export function Tooltip({
  content,
  children,
  lado = "cima",
  descreve = true,
  desligado = false,
}: {
  content: ReactNode;
  children: Gatilho;
  lado?: Lado;
  descreve?: boolean;
  desligado?: boolean;
}) {
  const id = useIdV4("v4-tip");
  const [aberto, setAberto] = useState(false);
  const ancora = useRef<HTMLElement | null>(null);
  const flut = useRef<HTMLDivElement | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const mostrar = aberto && !desligado;
  useFlutuante(mostrar, ancora, flut, lado);

  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    if (!mostrar) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mostrar]);

  if (!isValidElement(children)) return children;
  const p = children.props;
  const gatilho = cloneElement(children, {
    ref: (el: HTMLElement | null) => {
      ancora.current = el;
      const proprio = p.ref;
      if (typeof proprio === "function") proprio(el);
      else if (proprio && typeof proprio === "object") (proprio as { current: HTMLElement | null }).current = el;
    },
    "aria-describedby": descreve && !desligado ? [p["aria-describedby"], id].filter(Boolean).join(" ") : p["aria-describedby"],
    onPointerEnter: (e: SyntheticEvent) => {
      p.onPointerEnter?.(e);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setAberto(true), 400);
    },
    onPointerLeave: (e: SyntheticEvent) => {
      p.onPointerLeave?.(e);
      window.clearTimeout(timer.current);
      setAberto(false);
    },
    onFocus: (e: SyntheticEvent) => {
      p.onFocus?.(e);
      const alvo = e.target as HTMLElement;
      if (alvo.matches?.(":focus-visible")) setAberto(true);
    },
    onBlur: (e: SyntheticEvent) => {
      p.onBlur?.(e);
      window.clearTimeout(timer.current);
      setAberto(false);
    },
  });

  return (
    <>
      {gatilho}
      {!desligado && (
        <div
          ref={flut}
          id={id}
          role="tooltip"
          className="v4-pop"
          popover="manual"
          hidden={!mostrar}
        >
          <div className="v4-tooltip">{content}</div>
        </div>
      )}
    </>
  );
}
