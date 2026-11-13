"use client";

import { createContext, useContext, type ReactNode } from "react";
import { buscarPessoasApi, type BuscarPessoas } from "./palette";

/**
 * De onde a paleta ⌘K busca pessoas. Sem provedor: a API real. A prévia (/visual-v4) envolve a
 * casca com o provedor ilustrativo (`previa-busca.tsx`), que é o único arquivo que importa os
 * dados de exemplo; assim eles nunca entram no pacote das rotas de produção.
 */
const Contexto = createContext<BuscarPessoas | null>(null);

export function ProvedorBuscaPessoas({ buscar, children }: { buscar: BuscarPessoas; children: ReactNode }) {
  return <Contexto.Provider value={buscar}>{children}</Contexto.Provider>;
}

/** Prévia sem provedor: não chama a API (não há sessão) e não mostra pessoa nenhuma. */
export const buscaVaziaDaPrevia: BuscarPessoas = async () => [];

/** A busca do contexto; sem provedor, a API real (ou nada, na prévia sem provedor). */
export function useBuscarPessoasV4(previa = false): BuscarPessoas {
  return useContext(Contexto) ?? (previa ? buscaVaziaDaPrevia : buscarPessoasApi);
}
