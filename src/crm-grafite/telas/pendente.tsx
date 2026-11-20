"use client";

import { FaixaTopo } from "../ui/estrutura";
import { EmptyState } from "../ui/states";

/** Tela que ainda não ganhou o porte. Não finge dado: diz o que falta. */
export function TelaPendente({ titulo }: { titulo: string }) {
  return (
    <div className="v4-tela" data-v4-tela="pendente">
      <FaixaTopo titulo={titulo} />
      <EmptyState nivel={2} titulo="Tela em construção" texto="Esta tela ainda não foi portada para o visual Grafite." />
    </div>
  );
}
