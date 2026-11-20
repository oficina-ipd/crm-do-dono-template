"use client";

import { usePathname, useRouter, useSearchParams } from "@/crm-grafite/link";
import { useCallback, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useIdV4 } from "./flutuante";
import { proximoIndice } from "./teclado";

export { proximoIndice };

export type TabDef = { id: string; label: ReactNode; count?: number; disabled?: boolean };

/**
 * Abas com ARIA completo (tablist/tab/tabpanel, roving tabindex, ativação automática,
 * setas, Home, End). Com `urlParam`, a aba vive na URL (?aba=…), sobrevive ao recarregar
 * e ao voltar, sem empilhar histórico a cada troca.
 */
export function Tabs({
  tabs,
  value,
  onChange,
  defaultValue,
  urlParam,
  label,
  children,
  forceFocus,
}: {
  tabs: TabDef[];
  value?: string;
  onChange?: (id: string) => void;
  defaultValue?: string;
  urlParam?: string;
  label: string;
  children: (ativa: string) => ReactNode;
  forceFocus?: string;
}) {
  const base = useIdV4("v4-abas");
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const daUrl = urlParam ? sp?.get(urlParam) ?? undefined : undefined;
  const [interna, setInterna] = useState(defaultValue ?? tabs[0]?.id ?? "");
  const ativa = value ?? (daUrl && tabs.some((t) => t.id === daUrl) ? daUrl : interna);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const escolher = useCallback(
    (id: string) => {
      if (value === undefined) setInterna(id);
      onChange?.(id);
      if (urlParam && pathname) {
        const p = new URLSearchParams(sp?.toString() ?? "");
        p.set(urlParam, id);
        router.replace(`${pathname}?${p.toString()}`);
      }
    },
    [value, onChange, urlParam, pathname, sp, router],
  );

  function teclar(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const prox = proximoIndice(tabs, i, e.key);
    if (prox === null) return;
    e.preventDefault();
    refs.current[prox]?.focus();
    escolher(tabs[prox].id);
  }

  return (
    <div className="v4-tabs">
      <div role="tablist" aria-label={label} className="v4-tabs__list">
        {tabs.map((t, i) => {
          const sel = t.id === ativa;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${t.id}`}
              aria-selected={sel}
              aria-controls={`${base}-painel-${t.id}`}
              tabIndex={sel ? 0 : -1}
              disabled={t.disabled}
              className={["v4-tab", forceFocus === t.id ? "is-focus" : ""].filter(Boolean).join(" ")}
              onClick={() => escolher(t.id)}
              onKeyDown={(e) => teclar(e, i)}
            >
              {t.label}
              {typeof t.count === "number" && <span className="v4-tab__count">{t.count}</span>}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`${base}-painel-${ativa}`}
        aria-labelledby={`${base}-tab-${ativa}`}
        tabIndex={0}
        className="v4-tabs__panel"
      >
        {children(ativa)}
      </div>
    </div>
  );
}

/**
 * Controle segmentado: escolha única entre poucas opções que filtram ou alternam a vista
 * atual (role="radiogroup"). Para trocar conjuntos de conteúdo, use Tabs.
 */
export function SegmentedControl({
  options,
  value,
  onChange,
  label,
  forceState,
}: {
  options: Array<{ value: string; label: ReactNode; count?: number; disabled?: boolean }>;
  value: string;
  onChange: (v: string) => void;
  label: string;
  forceState?: { value: string; state: "hover" | "focus" };
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const atual = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  return (
    <div role="radiogroup" aria-label={label} className="v4-seg">
      {options.map((o, i) => {
        const sel = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={sel}
            tabIndex={i === atual ? 0 : -1}
            disabled={o.disabled}
            className={["v4-seg__item", forceState?.value === o.value ? `is-${forceState.state}` : ""].filter(Boolean).join(" ")}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              const prox = proximoIndice(options, i, e.key);
              if (prox === null) return;
              e.preventDefault();
              refs.current[prox]?.focus();
              onChange(options[prox].value);
            }}
          >
            {o.label}
            {typeof o.count === "number" && <span className="v4-seg__count">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
