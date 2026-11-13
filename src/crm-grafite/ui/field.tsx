"use client";

import {
  useEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Icon } from "./icon";
import { useIdV4 } from "./flutuante";
import { IconButton } from "./button";
import { KeyHint } from "./marcadores";

type Estado = "hover" | "focus";

export type FieldIds = { id: string; "aria-describedby"?: string; "aria-invalid"?: true; "aria-required"?: true };

/**
 * Moldura de campo: rótulo persistente acima, ajuda e erro abaixo, ligados ao controle
 * por aria-describedby. O erro aparece junto do campo, com ícone e texto (não só cor).
 */
export function Field({
  label,
  help,
  error,
  required,
  id: idFixo,
  children,
}: {
  label: ReactNode;
  help?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  id?: string;
  children: (ids: FieldIds) => ReactNode;
}) {
  const auto = useIdV4("v4-campo");
  const id = idFixo ?? auto;
  const helpId = help ? `${id}-ajuda` : undefined;
  const errId = error ? `${id}-erro` : undefined;
  const describedby = [errId, helpId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="v4-field">
      <label className="v4-field__label" htmlFor={id}>
        {label}
        {required && <span className="v4-field__req">obrigatório</span>}
      </label>
      {children({
        id,
        "aria-describedby": describedby,
        "aria-invalid": error ? true : undefined,
        "aria-required": required ? true : undefined,
      })}
      {error && (
        <p className="v4-field__error" id={errId}>
          <Icon name="alerta" />
          <span>{error}</span>
        </p>
      )}
      {help && (
        <p className="v4-field__help" id={helpId}>
          {help}
        </p>
      )}
    </div>
  );
}

type Comum = { label: ReactNode; help?: ReactNode; error?: ReactNode; forceState?: Estado };

export function Input({
  label,
  help,
  error,
  required,
  forceState,
  className,
  id,
  ref,
  ...rest
}: Comum & InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  return (
    <Field label={label} help={help} error={error} required={required} id={id}>
      {(ids) => (
        <input
          ref={ref}
          {...ids}
          {...rest}
          required={required}
          className={["v4-input", forceState ? `is-${forceState}` : "", className].filter(Boolean).join(" ")}
        />
      )}
    </Field>
  );
}

export function Textarea({
  label,
  help,
  error,
  required,
  forceState,
  className,
  id,
  ref,
  ...rest
}: Comum & TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> }) {
  return (
    <Field label={label} help={help} error={error} required={required} id={id}>
      {(ids) => (
        <textarea
          ref={ref}
          {...ids}
          {...rest}
          required={required}
          className={["v4-textarea", forceState ? `is-${forceState}` : "", className].filter(Boolean).join(" ")}
        />
      )}
    </Field>
  );
}

export function Select({
  label,
  help,
  error,
  required,
  forceState,
  className,
  id,
  options,
  placeholder,
  ...rest
}: Comum &
  SelectHTMLAttributes<HTMLSelectElement> & {
    options: Array<{ value: string; label: string; disabled?: boolean }>;
    placeholder?: string;
  }) {
  return (
    <Field label={label} help={help} error={error} required={required} id={id}>
      {(ids) => (
        <span className="v4-select-wrap">
          <select
            {...ids}
            {...rest}
            required={required}
            className={["v4-select", forceState ? `is-${forceState}` : "", className].filter(Boolean).join(" ")}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((o) => (
              <option key={o.value} value={o.value} disabled={o.disabled}>
                {o.label}
              </option>
            ))}
          </select>
          <Icon name="chevronBaixo" />
        </span>
      )}
    </Field>
  );
}

export function Checkbox({
  label,
  indeterminate,
  forceState,
  className,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: ReactNode;
  indeterminate?: boolean;
  forceState?: Estado;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate);
  }, [indeterminate]);
  return (
    <label className={["v4-check", forceState === "hover" ? "is-hover" : "", className].filter(Boolean).join(" ")}>
      <span className="v4-check__box">
        <input
          ref={ref}
          type="checkbox"
          aria-checked={indeterminate ? "mixed" : undefined}
          {...rest}
          className={["v4-check__input", forceState === "focus" ? "is-focus" : ""].filter(Boolean).join(" ")}
        />
        <Icon name={indeterminate ? "menos" : "check"} />
      </span>
      <span>{label}</span>
    </label>
  );
}

/** Interruptor (role="switch"). `stateText` mostra "Ligado/Desligado" ao lado. */
export function Switch({
  checked,
  onChange,
  label,
  stateText,
  disabled,
  forceState,
  describedBy,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  stateText?: [string, string];
  disabled?: boolean;
  forceState?: Estado;
  describedBy?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={["v4-switch", forceState ? `is-${forceState}` : ""].filter(Boolean).join(" ")}
    >
      <span className="v4-switch__track" aria-hidden="true">
        <span className="v4-switch__thumb" />
      </span>
      <span>{label}</span>
      {stateText && <span className="v4-switch__state">{checked ? stateText[0] : stateText[1]}</span>}
    </button>
  );
}

/**
 * Busca local. O rótulo é obrigatório (fica só para leitor de tela; o ícone e o
 * placeholder mostram a função). `debounceMs` espera a pessoa parar de digitar antes de
 * chamar `onSearch`; Escape limpa; `atalho="/"` foca a busca de qualquer lugar da tela.
 */
export function SearchInput({
  label,
  value: valorControlado,
  defaultValue = "",
  onChange,
  onSearch,
  debounceMs = 0,
  placeholder = "Buscar",
  atalho,
  forceState,
  id: idFixo,
}: {
  label: string;
  value?: string;
  defaultValue?: string;
  onChange?: (v: string) => void;
  onSearch?: (v: string) => void;
  debounceMs?: number;
  placeholder?: string;
  atalho?: "/";
  forceState?: Estado;
  id?: string;
}) {
  const auto = useIdV4("v4-busca");
  const id = idFixo ?? auto;
  const [interno, setInterno] = useState(defaultValue);
  const valor = valorControlado ?? interno;
  const ref = useRef<HTMLInputElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    if (!atalho) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== atalho || e.metaKey || e.ctrlKey || e.altKey) return;
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName))) return;
      e.preventDefault();
      ref.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [atalho]);

  function mudar(v: string) {
    if (valorControlado === undefined) setInterno(v);
    onChange?.(v);
    window.clearTimeout(timer.current);
    if (!onSearchRef.current) return;
    if (debounceMs > 0) timer.current = window.setTimeout(() => onSearchRef.current?.(v), debounceMs);
    else onSearchRef.current(v);
  }

  return (
    <div className="v4-search">
      <label className="v4-sr" htmlFor={id}>
        {label}
      </label>
      <Icon name="busca" />
      <input
        ref={ref}
        id={id}
        type="search"
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        value={valor}
        onChange={(e) => mudar(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && valor) {
            e.preventDefault();
            mudar("");
          }
        }}
        className={["v4-input", forceState ? `is-${forceState}` : ""].filter(Boolean).join(" ")}
      />
      <span className="v4-search__end">
        {valor ? (
          <IconButton
            icon="fechar"
            label="Limpar busca"
            size="sm"
            semTooltip
            onClick={() => {
              mudar("");
              ref.current?.focus();
            }}
          />
        ) : atalho ? (
          <KeyHint teclas={[atalho]} />
        ) : null}
      </span>
    </div>
  );
}
