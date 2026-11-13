"use client";

import Link from "@/crm-grafite/link";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { Icon, type IconeV4 } from "./icon";
import { useCliqueFora, useFlutuante, useIdV4, type Lado } from "./flutuante";
import { proximoIndice } from "./teclado";

export type ItemMenu =
  | {
      tipo?: "item";
      id: string;
      label: ReactNode;
      icon?: IconeV4;
      onSelect?: () => void;
      href?: string;
      danger?: boolean;
      disabled?: boolean;
      fim?: ReactNode;
    }
  | { tipo: "checkbox"; id: string; label: ReactNode; checked: boolean; onCheckedChange: (v: boolean) => void; disabled?: boolean }
  | { tipo: "radio"; id: string; label: ReactNode; checked: boolean; onSelect: () => void; disabled?: boolean }
  | { tipo: "separador"; id: string }
  | { tipo: "rotulo"; id: string; label: ReactNode };

export type PropsGatilho = {
  ref: Ref<HTMLButtonElement>;
  "aria-haspopup": "menu";
  "aria-expanded": boolean;
  "aria-controls": string;
  onClick: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void;
};

/**
 * Menu suspenso na camada flutuante. Teclado: Enter/Espaço/↓ abre no primeiro item,
 * ↑ abre no último; setas, Home e End andam; letra pula para o item; Escape fecha e
 * devolve o foco ao gatilho; Tab fecha. Clique fora fecha.
 */
export function DropdownMenu({
  gatilho,
  itens,
  label,
  lado = "baixo-inicio",
}: {
  gatilho: (p: PropsGatilho) => ReactNode;
  itens: ItemMenu[];
  label: string;
  lado?: Lado;
}) {
  const id = useIdV4("v4-menu");
  const [aberto, setAberto] = useState(false);
  const inicio = useRef<"primeiro" | "ultimo">("primeiro");
  const ancora = useRef<HTMLButtonElement | null>(null);
  const flut = useRef<HTMLDivElement | null>(null);
  const itensRef = useRef<Array<HTMLElement | null>>([]);
  useFlutuante(aberto, ancora, flut, lado);
  useCliqueFora(aberto, [ancora, flut], () => setAberto(false));

  const focaveis = itens
    .map((it, i) => ({ it, i }))
    .filter(({ it }) => it.tipo !== "separador" && it.tipo !== "rotulo");

  useEffect(() => {
    if (!aberto) return;
    const lista = focaveis.filter(({ it }) => !("disabled" in it && it.disabled));
    const alvo = inicio.current === "ultimo" ? lista[lista.length - 1] : lista[0];
    if (alvo) itensRef.current[alvo.i]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  function fechar(devolverFoco = true) {
    setAberto(false);
    if (devolverFoco) ancora.current?.focus();
  }

  function teclarMenu(e: KeyboardEvent<HTMLDivElement>) {
    const posicoes = focaveis.map(({ i }) => i);
    const atual = posicoes.findIndex((i) => itensRef.current[i] === document.activeElement);
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      fechar();
      return;
    }
    if (e.key === "Tab") {
      setAberto(false);
      return;
    }
    const prox = proximoIndice(
      focaveis.map(({ it }) => ({ disabled: "disabled" in it ? it.disabled : false })),
      atual < 0 ? -1 : atual,
      e.key,
    );
    if (prox !== null) {
      e.preventDefault();
      itensRef.current[posicoes[prox]]?.focus();
      return;
    }
    if (e.key.length === 1 && /\S/.test(e.key)) {
      const letra = e.key.toLocaleLowerCase("pt-BR");
      const ordem = [...posicoes.slice(atual + 1), ...posicoes.slice(0, atual + 1)];
      const hit = ordem.find((i) => (itensRef.current[i]?.textContent ?? "").trim().toLocaleLowerCase("pt-BR").startsWith(letra));
      if (hit !== undefined) itensRef.current[hit]?.focus();
    }
  }

  const propsGatilho: PropsGatilho = {
    ref: (el) => {
      ancora.current = el;
    },
    "aria-haspopup": "menu",
    "aria-expanded": aberto,
    "aria-controls": id,
    onClick: () => {
      inicio.current = "primeiro";
      setAberto((v) => !v);
    },
    onKeyDown: (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        inicio.current = e.key === "ArrowUp" ? "ultimo" : "primeiro";
        setAberto(true);
      }
    },
  };

  return (
    <>
      {gatilho(propsGatilho)}
      <div ref={flut} className="v4-pop" popover="manual" hidden={!aberto}>
        {aberto && (
          <div id={id} role="menu" aria-label={label} className="v4-menu" onKeyDown={teclarMenu}>
            {itens.map((it, i) => (
              <ItemDoMenu
                key={it.id}
                it={it}
                guardar={(el) => {
                  itensRef.current[i] = el;
                }}
                fechar={() => fechar()}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function ItemDoMenu({ it, guardar, fechar }: { it: ItemMenu; guardar: (el: HTMLElement | null) => void; fechar: () => void }) {
  if (it.tipo === "separador") return <div role="separator" className="v4-menu__sep" />;
  if (it.tipo === "rotulo") return <p className="v4-menu__label" role="presentation">{it.label}</p>;
  if (it.tipo === "checkbox") {
    return (
      <button
        ref={guardar}
        type="button"
        role="menuitemcheckbox"
        aria-checked={it.checked}
        aria-disabled={it.disabled || undefined}
        tabIndex={-1}
        className="v4-menu__item"
        onClick={() => !it.disabled && it.onCheckedChange(!it.checked)}
      >
        <span className="v4-menu__mark">
          <Icon name="check" />
        </span>
        {it.label}
      </button>
    );
  }
  if (it.tipo === "radio") {
    return (
      <button
        ref={guardar}
        type="button"
        role="menuitemradio"
        aria-checked={it.checked}
        aria-disabled={it.disabled || undefined}
        tabIndex={-1}
        className="v4-menu__item"
        onClick={() => !it.disabled && it.onSelect()}
      >
        <span className="v4-menu__mark">
          <span className="v4-menu__radio" />
        </span>
        {it.label}
      </button>
    );
  }
  const cls = ["v4-menu__item", it.danger ? "v4-menu__item--danger" : ""].filter(Boolean).join(" ");
  const conteudo = (
    <>
      {it.icon && <Icon name={it.icon} />}
      <span>{it.label}</span>
      {it.fim && <span className="v4-menu__end">{it.fim}</span>}
    </>
  );
  if (it.href && !it.disabled) {
    return (
      <Link ref={guardar} href={it.href} role="menuitem" tabIndex={-1} className={cls} onClick={() => fechar()}>
        {conteudo}
      </Link>
    );
  }
  return (
    <button
      ref={guardar}
      type="button"
      role="menuitem"
      aria-disabled={it.disabled || undefined}
      tabIndex={-1}
      className={cls}
      onClick={() => {
        if (it.disabled) return;
        fechar();
        it.onSelect?.();
      }}
    >
      {conteudo}
    </button>
  );
}

/** Vitrine estática (só para espécimes): mesma pele do menu, sem comportamento. */
export function MenuPreview({ itens, label }: { itens: ItemMenu[]; label: string }) {
  return (
    <div className="v4-menu" aria-label={label} role="group">
      {itens.map((it) => {
        if (it.tipo === "separador") return <div key={it.id} className="v4-menu__sep" />;
        if (it.tipo === "rotulo") return <p key={it.id} className="v4-menu__label">{it.label}</p>;
        const marca =
          it.tipo === "checkbox" ? (
            <span className="v4-menu__mark">{it.checked && <Icon name="check" />}</span>
          ) : it.tipo === "radio" ? (
            <span className="v4-menu__mark">
              <span className="v4-menu__radio" />
            </span>
          ) : it.icon ? (
            <Icon name={it.icon} />
          ) : null;
        const danger = (it.tipo === undefined || it.tipo === "item") && it.danger;
        const fim = (it.tipo === undefined || it.tipo === "item") && it.fim;
        return (
          <div
            key={it.id}
            className={["v4-menu__item", danger ? "v4-menu__item--danger" : "", it.id.endsWith("-hover") ? "is-hover" : ""].filter(Boolean).join(" ")}
            data-checked={it.tipo === "radio" || it.tipo === "checkbox" ? String(it.checked) : undefined}
            data-disabled={"disabled" in it && it.disabled ? "true" : undefined}
          >
            {marca}
            <span>{it.label}</span>
            {fim && <span className="v4-menu__end">{fim}</span>}
          </div>
        );
      })}
    </div>
  );
}
