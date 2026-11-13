"use client";

import { TelaPendente } from "../pendente";

/** Ficha da pessoa (porte em andamento). */
export function TelaFicha({ contatoId }: { contatoId: string }) {
  return <TelaPendente titulo={`Ficha ${contatoId}`} />;
}
