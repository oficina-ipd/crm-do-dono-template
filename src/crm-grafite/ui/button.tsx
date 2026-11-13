"use client";

import Link from "@/crm-grafite/link";
import { useRef, useState, type ButtonHTMLAttributes, type MouseEvent, type ReactNode, type Ref } from "react";
import { Icon, type IconeV4 } from "./icon";
import { Spinner } from "./feedback";
import { Tooltip } from "./tooltip";
import type { Lado } from "./flutuante";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
export type ButtonSize = "sm" | "md";

type Base = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconeV4;
  iconEnd?: IconeV4;
  /** Processando: mantém a largura, mostra andamento e ignora novos cliques. */
  busy?: boolean;
  /** Texto lido enquanto processa (padrão "Processando"). */
  busyLabel?: string;
  block?: boolean;
  /** Estado forçado na página de espécimes. */
  forceState?: "hover" | "focus" | "pressed";
  ref?: Ref<HTMLButtonElement>;
};

export type ButtonProps = Base &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & {
    onClick?: (e: MouseEvent<HTMLButtonElement>) => unknown;
  };

export function classesBotao({
  variant = "secondary",
  size = "md",
  block,
  forceState,
  extra,
}: Pick<Base, "variant" | "size" | "block" | "forceState"> & { extra?: string }) {
  return [
    "v4-btn",
    `v4-btn--${variant}`,
    size === "sm" ? "v4-btn--sm" : "",
    block ? "v4-btn--block" : "",
    forceState ? `is-${forceState}` : "",
    extra ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Botão da v4. Desabilitado usa aria-disabled (continua focável e anunciado) e não dispara
 * o clique. Se `onClick` devolver uma Promise, o botão entra sozinho em "processando" até
 * ela terminar: nada de envio duplicado nem quando o pai demora a marcar `busy`.
 */
export function Button({
  variant = "secondary",
  size = "md",
  icon,
  iconEnd,
  busy = false,
  busyLabel = "Processando",
  block,
  forceState,
  disabled,
  className,
  children,
  onClick,
  type = "button",
  ref,
  ...rest
}: ButtonProps) {
  const [auto, setAuto] = useState(false);
  const trava = useRef(false);
  const ocupado = busy || auto;
  const inerte = Boolean(disabled) || ocupado;

  function clicar(e: MouseEvent<HTMLButtonElement>) {
    if (inerte || trava.current) {
      e.preventDefault();
      return;
    }
    const r = onClick?.(e);
    if (r && typeof (r as Promise<unknown>).then === "function") {
      trava.current = true;
      setAuto(true);
      (r as Promise<unknown>).finally(() => {
        trava.current = false;
        setAuto(false);
      });
    }
  }

  return (
    <button
      ref={ref}
      type={type}
      className={classesBotao({ variant, size, block, forceState, extra: className })}
      aria-disabled={inerte || undefined}
      aria-busy={ocupado || undefined}
      onClick={clicar}
      {...rest}
    >
      <span className="v4-btn__label">
        {icon && <Icon name={icon} size={size === "sm" ? "sm" : undefined} />}
        {children}
        {iconEnd && <Icon name={iconEnd} size={size === "sm" ? "sm" : undefined} />}
      </span>
      {ocupado && (
        <span className="v4-btn__busy">
          <Spinner label={busyLabel} />
        </span>
      )}
    </button>
  );
}

export type IconButtonProps = Omit<ButtonProps, "children" | "icon" | "iconEnd" | "aria-label"> & {
  icon: IconeV4;
  /** Nome acessível, obrigatório. Também vira a dica visível. */
  label: string;
  /** Atalho mostrado na dica (ex.: "⌘K"). */
  hint?: string;
  tooltipLado?: Lado;
  semTooltip?: boolean;
};

export function IconButton({
  icon,
  label,
  hint,
  variant = "ghost",
  size = "md",
  tooltipLado = "cima",
  semTooltip,
  className,
  ...rest
}: IconButtonProps) {
  const botao = (
    <Button
      {...rest}
      variant={variant}
      size={size}
      aria-label={label}
      className={["v4-iconbtn", className].filter(Boolean).join(" ")}
    >
      <Icon name={icon} size={size === "sm" ? "sm" : undefined} />
    </Button>
  );
  if (semTooltip) return botao;
  return (
    <Tooltip
      lado={tooltipLado}
      descreve={false}
      content={
        <>
          {label}
          {hint && <kbd className="v4-kbd">{hint}</kbd>}
        </>
      }
    >
      {botao}
    </Tooltip>
  );
}

/** Link com cara de botão (navegação real, abre em nova aba com o botão do meio). */
export function ButtonLink({
  href,
  variant = "secondary",
  size = "md",
  icon,
  iconEnd,
  block,
  children,
  className,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconeV4;
  iconEnd?: IconeV4;
  block?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={classesBotao({ variant, size, block, extra: className })}>
      <span className="v4-btn__label">
        {icon && <Icon name={icon} size={size === "sm" ? "sm" : undefined} />}
        {children}
        {iconEnd && <Icon name={iconEnd} size={size === "sm" ? "sm" : undefined} />}
      </span>
    </Link>
  );
}
