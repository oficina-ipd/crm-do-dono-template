"use client";

/**
 * Navegação do CRM Grafite no template: o app roda no navegador e usa rotas no hash
 * (#/, #/funil, #/conversas?c=…, #/contatos/:id). Este módulo é o substituto de
 * `next/link` e `next/navigation` para os componentes vindos do CRM do IPD.
 */
import * as React from "react";
import { CrmLink, irPara, lerHashPath, pathSemQuery, queryDoHash, useCrmPath, useCrmRouter } from "@/crm-v3/hash-nav";

export { irPara, lerHashPath, pathSemQuery, queryDoHash, useCrmPath };

type LinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string | { pathname?: string; query?: Record<string, string> };
  prefetch?: boolean;
  scroll?: boolean;
  replace?: boolean;
};

function hrefTexto(href: LinkProps["href"]): string {
  if (typeof href === "string") return href;
  const q = href.query ? `?${new URLSearchParams(href.query).toString()}` : "";
  return `${href.pathname ?? "/"}${q}`;
}

/** Drop-in de `next/link`. Links externos (http, mailto, tel) passam direto. */
const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { href, prefetch: _p, scroll: _s, replace: _r, ...rest },
  ref,
) {
  const alvo = hrefTexto(href);
  if (/^(https?:|mailto:|tel:)/.test(alvo) || alvo.startsWith("/api/")) {
    return <a ref={ref} href={alvo} {...rest} />;
  }
  return <CrmLinkComRef ref={ref} href={alvo} {...rest} />;
});

const CrmLinkComRef = React.forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }>(
  function CrmLinkComRef({ href, onClick, ...rest }, ref) {
    const alvo = href.startsWith("#") ? href : href.startsWith("/") ? `#${href}` : `#/${href}`;
    return (
      <a
        ref={ref}
        href={alvo}
        onClick={(e) => {
          onClick?.(e);
          if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
          e.preventDefault();
          irPara(alvo);
        }}
        {...rest}
      />
    );
  },
);

export default Link;
export { CrmLink };

/** Caminho sem a query (equivalente a `usePathname`). */
export function usePathname(): string {
  return pathSemQuery(useCrmPath());
}

/** Query do hash (equivalente a `useSearchParams`). */
export function useSearchParams(): URLSearchParams {
  const path = useCrmPath();
  return React.useMemo(() => queryDoHash(path), [path]);
}

/** Equivalente a `useRouter` (push, replace, refresh, back). */
export function useRouter() {
  return useCrmRouter();
}
