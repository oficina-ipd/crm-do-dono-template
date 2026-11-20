"use client";

import type * as React from "react";
import { useRef } from "react";
import type { Operador } from "@/domain/types";
import { Avatar, EmptyState, Icon, iniciaisV4 } from "../../ui";
import { ROTULO_PAPEL, nomeParaAvatar } from "../equipe/equipe-logica";
import { proximoOperador } from "./entrar-logica";
import "../../styles/telas/base-demais.css";
import "../../styles/telas/entrar.css";

/**
 * Entrar (Grafite, modo local): uma caixa de vidro sobre a luz, com a lista de quem pode
 * entrar. Um clique (ou Enter) entra; setas, Home e End andam pela lista. Sem senha neste modo:
 * as ações ficam registradas no nome de quem entrou. O rodapé recebe o cartão do WhatsApp.
 */
export function TelaEntrar({ nomeEmpresa, operadores, aoEntrar, rodape }: { nomeEmpresa: string; operadores: Operador[]; aoEntrar: (id: string) => void; rodape?: React.ReactNode }) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const ordenados = [...operadores].sort((a, b) => Number(b.papel === "dono") - Number(a.papel === "dono") || a.nome.localeCompare(b.nome, "pt-BR"));

  return (
    <main className="v4-entrar" data-v4-tela="entrar">
      <div className="v4-entrar__caixa">
        <div className="v4-entrar__marca">
          <span className="v4-brand__mark" aria-hidden="true">
            {iniciaisV4(nomeEmpresa)}
          </span>
          <span className="v4-t-ui v4-t-medium">CRM · {nomeEmpresa}</span>
        </div>
        <section className="v4-entrar__painel" aria-labelledby="v4-entrar-titulo">
          <h1 id="v4-entrar-titulo" className="v4-t-title">
            Quem está entrando?
          </h1>
          <p className="v4-t-ui v4-t-2">Escolha o seu nome. O que você fizer no CRM fica registrado no seu nome.</p>
          {ordenados.length === 0 ? (
            <EmptyState
              nivel={2}
              titulo="Ninguém ativo na equipe"
              texto="Para entrar, a equipe precisa de ao menos uma pessoa ativa. Peça a quem cuida do CRM para conferir os dados."
            />
          ) : (
            <ul className="v4-entrar__lista" aria-label="Pessoas da equipe">
              {ordenados.map((o, i) => (
                <li key={o.id}>
                  <button
                    ref={(el) => {
                      refs.current[i] = el;
                    }}
                    type="button"
                    className="v4-entrar__operador"
                    onClick={() => aoEntrar(o.id)}
                    onKeyDown={(e) => {
                      const prox = proximoOperador(i, ordenados.length, e.key);
                      if (prox === null) return;
                      e.preventDefault();
                      refs.current[prox]?.focus();
                    }}
                  >
                    <Avatar nome={nomeParaAvatar(o.nome)} />
                    <span className="v4-entrar__nome">{o.nome}</span>
                    <span className="v4-entrar__papel">{ROTULO_PAPEL[o.papel]}</span>
                    <Icon name="chevronDireita" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        {rodape && <div className="v4-entrar__rodape">{rodape}</div>}
      </div>
    </main>
  );
}
