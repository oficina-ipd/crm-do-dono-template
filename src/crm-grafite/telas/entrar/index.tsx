"use client";

import type * as React from "react";
import type { Operador } from "@/domain/types";
import { Button } from "../../ui/button";

/** Entrada do modo local: escolher quem está entrando (porte em andamento). */
export function TelaEntrar({ nomeEmpresa, operadores, aoEntrar, rodape }: { nomeEmpresa: string; operadores: Operador[]; aoEntrar: (id: string) => void; rodape?: React.ReactNode }) {
  return (
    <main className="v4-entrar" data-v4-tela="entrar">
      <h1 className="v4-t-title">Quem está entrando?</h1>
      <p className="v4-t-meta">CRM · {nomeEmpresa}</p>
      <ul>
        {operadores.map((o) => (
          <li key={o.id}>
            <Button onClick={() => aoEntrar(o.id)}>{o.nome}</Button>
          </li>
        ))}
      </ul>
      {rodape}
    </main>
  );
}
