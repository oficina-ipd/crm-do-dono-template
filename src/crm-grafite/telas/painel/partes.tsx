"use client";

import type { ReactNode } from "react";
import Link from "@/crm-grafite/link";
import { Icon } from "../../ui";
import type { TextoVariacao } from "./logica";

/**
 * Peças dos cartões do Painel, sem estado. Um cartão = uma camada de vidro (a <section>); dentro
 * dela só texto, fios, listas e gráfico, nunca outra caixa.
 */

/** Ids dos cartões (a grade bento os posiciona por classe). */
export type IdCartao = "abertura" | "precisa" | "claudio" | "grafico" | "origem" | "emails" | "mes" | "atividade" | "conversas" | "funil";

/** Um cartão: título discreto, o que fica à direita dele (selo, atalho, alternador) e o conteúdo. */
export function Cartao({
  id,
  titulo,
  contagem,
  lado,
  semTitulo,
  children,
}: {
  id: IdCartao;
  titulo: string;
  /** Número pequeno junto do título (quantos esperam). */
  contagem?: number;
  lado?: ReactNode;
  /** A abertura não tem cabeçalho visível: o título fica só para leitor de tela. */
  semTitulo?: boolean;
  children: ReactNode;
}) {
  return (
    <section id={`painel-${id}`} className={`v4-panel v4-pn-cartao v4-pn-cartao--${id}`} aria-labelledby={`painel-${id}-t`}>
      {semTitulo ? (
        <h2 id={`painel-${id}-t`} className="v4-sr">
          {titulo}
        </h2>
      ) : (
        <header className="v4-pn-cartao__topo">
          <h2 id={`painel-${id}-t`} className="v4-pn-cartao__titulo">
            {titulo}
            {contagem != null && contagem > 0 && (
              <sup>
                <span aria-hidden="true">{contagem}</span>
                <span className="v4-sr"> ({contagem})</span>
              </sup>
            )}
          </h2>
          {lado && <div className="v4-pn-cartao__lado">{lado}</div>}
        </header>
      )}
      <div className="v4-pn-cartao__corpo">{children}</div>
    </section>
  );
}

/** Selo do cartão: período ou estado ("sem medição", "esperando"). `ponto` acende a bolinha. */
export function Selo({ children, ponto }: { children: ReactNode; ponto?: "vivo" | "espera" }) {
  return (
    <span className={ponto === "espera" ? "v4-pn-selo is-espera" : "v4-pn-selo"}>
      {ponto && <i aria-hidden="true" />}
      {children}
    </span>
  );
}

/** Atalho discreto no topo do cartão. Link de verdade, com seta. */
export function Atalho({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="v4-pn-atalho">
      <span>{children}</span>
      <Icon name="chevronDireita" size="sm" />
    </Link>
  );
}

/** Número (ou frase) que leva à tela que o compõe. */
export function LinkNumero({ href, children, seta = true }: { href: string; children: ReactNode; seta?: boolean }) {
  return (
    <Link href={href} className="v4-pn-link">
      {children}
      {seta && <Icon name="chevronDireita" size="sm" />}
    </Link>
  );
}

/** Variação contra o período anterior: seta + texto (a cor não carrega o sentido). */
export function Variacao({ v, className }: { v: TextoVariacao | null; className?: string }) {
  if (!v) return null;
  return (
    <p className={["v4-pn-var", className ?? ""].filter(Boolean).join(" ")}>
      <Icon name={v.seta === "sobe" ? "ordenarCima" : v.seta === "desce" ? "ordenarBaixo" : "menos"} size="sm" />
      <span className="v4-pn-var__mudanca">{v.mudanca}</span>
      <span className="v4-pn-var__base">{v.base}</span>
    </p>
  );
}

/** Cartão sem nada para mostrar: uma frase que diz o que vai aparecer ali. Não é erro. */
export function Vazio({ children }: { children: ReactNode }) {
  return <p className="v4-pn-vazio">{children}</p>;
}
