"use client";

import type { ReactNode } from "react";
import { Button } from "./button";
import { Icon, type IconeV4 } from "./icon";

/** `nivel` 1 quando o estado É a tela (sem permissão, erro ao abrir): um h1 por tela. */
type Base = { titulo: string; texto?: ReactNode; acoes?: ReactNode; centro?: boolean; nivel?: 1 | 2 | 3 };

function Estado({ titulo, texto, acoes, centro, nivel = 3, icone, tom, role }: Base & { icone: IconeV4; tom?: string; role?: "alert" | "status" }) {
  const H = nivel === 1 ? "h1" : nivel === 2 ? "h2" : "h3";
  return (
    <div className={["v4-state", tom ? `v4-state--${tom}` : "", centro ? "v4-state--center" : ""].filter(Boolean).join(" ")} role={role}>
      <div className="v4-state__head">
        <Icon name={icone} />
        <H className="v4-state__title">{titulo}</H>
      </div>
      {texto && <p className="v4-state__text">{texto}</p>}
      {acoes && <div className="v4-state__actions">{acoes}</div>}
    </div>
  );
}

/** Ainda não há itens. Ensina o que vai aparecer aqui e oferece a ação certa. */
export function EmptyState(p: Base) {
  return <Estado {...p} icone="vazio" />;
}

/** A busca ou o filtro não achou nada. Mantém os filtros e oferece limpar. */
export function NoResults({ termo, aoLimpar, ...p }: Omit<Base, "titulo"> & { titulo?: string; termo?: string; aoLimpar?: () => void }) {
  return (
    <Estado
      {...p}
      titulo={p.titulo ?? (termo ? `Nada encontrado para “${termo}”` : "Nada com esses filtros")}
      icone="busca"
      role="status"
      acoes={
        p.acoes ??
        (aoLimpar && (
          <Button variant="secondary" icon="fechar" onClick={aoLimpar}>
            Limpar filtros
          </Button>
        ))
      }
    />
  );
}

/** Falhou ao carregar. Diz o impacto e oferece tentar de novo; fica até ser resolvido. */
export function ErrorState({ aoTentar, ...p }: Base & { aoTentar?: () => unknown }) {
  return (
    <Estado
      {...p}
      icone="erro"
      tom="erro"
      role="alert"
      acoes={
        p.acoes ??
        (aoTentar && (
          <Button variant="secondary" icon="recarregar" onClick={aoTentar}>
            Tentar de novo
          </Button>
        ))
      }
    />
  );
}

/** Sem permissão: explica a condição de acesso, sem mostrar o conteúdo restrito. */
export function PermissionState(p: Base) {
  return <Estado {...p} icone="cadeado" tom="permissao" />;
}
