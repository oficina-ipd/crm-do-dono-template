"use client";

import Link from "@/crm-grafite/link";
import type { ReactNode } from "react";

/**
 * Painel de trabalho: uma camada só. Painel dentro de painel vira grupo plano (CSS:
 * sem fundo, sem sombra, só um divisor no topo).
 */
export function Panel({
  titulo,
  acoes,
  rodape,
  children,
  semRecuo,
  nivel = 2,
  rotulo,
  elevado,
}: {
  titulo?: ReactNode;
  acoes?: ReactNode;
  rodape?: ReactNode;
  children: ReactNode;
  semRecuo?: boolean;
  nivel?: 2 | 3;
  rotulo?: string;
  /** Painel principal da tela: no Grafite, vidro elevado (mais opaco). */
  elevado?: boolean;
}) {
  const H = nivel === 2 ? "h2" : "h3";
  return (
      <section className={elevado ? "v4-panel v4-panel--up" : "v4-panel"} aria-label={titulo ? undefined : rotulo}>
        {(titulo || acoes) && (
          <div className="v4-panel__head">
            {titulo && <H className="v4-t-section v4-panel__title">{titulo}</H>}
            {acoes}
          </div>
        )}
        <div className={["v4-panel__body", semRecuo ? "v4-panel__body--flush" : ""].filter(Boolean).join(" ")}>{children}</div>
        {rodape && <div className="v4-panel__foot">{rodape}</div>}
      </section>
  );
}

export type Passo = { label: string; href?: string };

/**
 * Cabeçalho de contexto da tela: caminho, título (22 no compacto) e ações à direita.
 * Sem rótulo acima do título e sem frase de efeito: o título diz onde a pessoa está.
 */
export function PageHeader({
  titulo,
  caminho,
  meta,
  acoes,
  nivel = 1,
}: {
  titulo: string;
  caminho?: Passo[];
  meta?: ReactNode;
  acoes?: ReactNode;
  /** 1 na tela; use 2 ou 3 só em prévias dentro de outra página. */
  nivel?: 1 | 2 | 3;
}) {
  const H = nivel === 1 ? "h1" : nivel === 2 ? "h2" : "h3";
  return (
    <header className="v4-pagehead">
      <div className="v4-pagehead__main">
        {caminho && caminho.length > 0 && <Breadcrumbs passos={caminho} rotulo={`Caminho até ${caminho[caminho.length - 1].label}`} />}
        <div className="v4-pagehead__row">
          <H className="v4-t-title">{titulo}</H>
          {meta && <span className="v4-pagehead__meta">{meta}</span>}
        </div>
      </div>
      {acoes && <div className="v4-pagehead__actions">{acoes}</div>}
    </header>
  );
}

/**
 * Faixa única do topo (Grafite): título, contagem e, na mesma linha, busca, filtros e ações da
 * tela. No Grafite ela ocupa a faixa da casca (ao lado da busca ⌘K) e não rola com o conteúdo;
 * no visual neutro é uma linha normal no alto da tela. Use uma por tela, como primeiro filho
 * da raiz da tela, e sem ancestral posicionado entre ela e a casca (a casca a posiciona).
 * Os controles que não cabem rolam para o lado dentro da faixa: nada é cortado.
 */
export function FaixaTopo({
  titulo,
  contagem,
  children,
  nivel = 1,
  inicio,
}: {
  titulo: string;
  contagem?: ReactNode;
  /** Busca, filtros e ações, nessa ordem. */
  children?: ReactNode;
  nivel?: 1 | 2;
  /** Antes do título (ex.: "voltar" da ficha). */
  inicio?: ReactNode;
}) {
  const H = nivel === 1 ? "h1" : "h2";
  return (
    <div className="v4-faixa">
      {inicio}
      <H className="v4-faixa__titulo">{titulo}</H>
      {contagem != null && <span className="v4-faixa__contagem">{contagem}</span>}
      {children && <div className="v4-faixa__controles">{children}</div>}
    </div>
  );
}

/** `rotulo` distingue o caminho da casca do caminho dentro da tela (landmarks com nome único). */
export function Breadcrumbs({ passos, rotulo = "Caminho" }: { passos: Passo[]; rotulo?: string }) {
  return (
    <nav aria-label={rotulo} className="v4-crumbs">
      <ol>
        {passos.map((p, i) => {
          const ultimo = i === passos.length - 1;
          return (
            <li key={`${p.label}-${i}`}>
              {p.href && !ultimo ? (
                <Link href={p.href}>{p.label}</Link>
              ) : (
                <span aria-current={ultimo ? "page" : undefined}>{p.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Comandos locais, junto do conteúdo que afetam: busca e filtros à esquerda, ações à direita. */
export function Toolbar({ rotulo, inicio, fim }: { rotulo: string; inicio?: ReactNode; fim?: ReactNode }) {
  return (
    <div className="v4-toolbar" role="group" aria-label={rotulo}>
      {inicio && <div className="v4-toolbar__start">{inicio}</div>}
      {fim && <div className="v4-toolbar__end">{fim}</div>}
    </div>
  );
}
