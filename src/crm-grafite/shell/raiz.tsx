"use client";

import "@fontsource-variable/onest";
import "../styles/tokens.css";
import "../styles/grafite.css";
import "../styles/base.css";
import "../styles/components.css";
import "../styles/shell.css";
import "../styles/fontes.css";
import { useState, type ReactNode } from "react";
import {
  COOKIE_DENSIDADE_V4,
  COOKIE_MENU_V4,
  COOKIE_SOLIDO_V4,
  densidadeV4,
  menuV4,
  solidoV4,
  type DensidadeV4,
  type MenuV4,
} from "../preferencias";
import { ToastProvider } from "../ui/toast";

export type PreferenciasGrafite = { densidade: DensidadeV4; solido: boolean; menu: MenuV4 };

function ler(nome: string): string | null {
  try {
    const salvo = window.localStorage.getItem(nome);
    if (salvo) return salvo;
  } catch {
    /* armazenamento bloqueado */
  }
  const m = document.cookie.match(new RegExp(`(?:^|; )${nome}=([^;]*)`));
  return m ? decodeURIComponent(m[1] ?? "") : null;
}

/** Preferências salvas (localStorage, com o cookie como reserva). O app só roda no navegador. */
export function lerPreferenciasGrafite(): PreferenciasGrafite {
  if (typeof window === "undefined") return { densidade: "compact", solido: false, menu: "icones" };
  return {
    densidade: densidadeV4(ler(COOKIE_DENSIDADE_V4)),
    solido: solidoV4(ler(COOKIE_SOLIDO_V4)),
    menu: menuV4(ler(COOKIE_MENU_V4)),
  };
}

/**
 * Raiz do visual Grafite: escopo `.crm-v4-root` (nenhum estilo vaza para fora), tema, densidade,
 * modo sólido, menu e a região de avisos. Tudo no app (inclusive a tela de entrada) fica dentro.
 */
export function RaizGrafite({ children }: { children: (prefs: PreferenciasGrafite) => ReactNode }) {
  const [prefs] = useState(lerPreferenciasGrafite);
  return (
    <div
      className="crm-v4-root"
      data-visual="grafite"
      data-density={prefs.densidade}
      data-solid={prefs.solido ? "1" : undefined}
      data-menu={prefs.menu}
    >
      <ToastProvider>{children(prefs)}</ToastProvider>
    </div>
  );
}
