"use client";

import { useCallback, useReducer, useRef, useState } from "react";
import { useCRM } from "@/components/crm/provider";
import type { Comando } from "@/domain/comandos";
import type { EstadoCRM } from "@/domain/types";
import { ENVIO_OCIOSO, horaCurta, proximoEnvio, type EstadoEnvio, type EventoEnvio } from "../base-demais/formulario";
import { ERRO_SEM_CONFIRMACAO, erroDeRegra } from "./gravar";

export type ResultadoGravar = { ok: true; estado: EstadoCRM } | { ok: false; erro: string };

/**
 * Grava um comando e devolve o resultado no formato de `useEnvio` (base-demais/tela.tsx).
 * A regra do domínio é conferida antes; o aviso de sucesso é o do provedor.
 */
export function useGravar() {
  const { estado, despachar } = useCRM();
  return useCallback(
    async (cmd: Comando, avisoOk?: string): Promise<ResultadoGravar> => {
      const erro = erroDeRegra(estado, cmd, new Date().toISOString());
      if (erro) return { ok: false, erro };
      const novo = await despachar(cmd, avisoOk);
      return novo ? { ok: true, estado: novo } : { ok: false, erro: ERRO_SEM_CONFIRMACAO };
    },
    [estado, despachar],
  );
}

type EventoComZerar = EventoEnvio | { tipo: "zerar" };
const reduzir = (s: EstadoEnvio, ev: EventoComZerar): EstadoEnvio => (ev.tipo === "zerar" ? ENVIO_OCIOSO : proximoEnvio(s, ev));

/**
 * Igual a `useEnvio`, mais `zerar` para quando o mesmo painel lateral passa a editar outro
 * item (o painel fica montado para devolver o foco a quem o abriu).
 */
export function useEnvioReiniciavel() {
  const [estado, despachar] = useReducer(reduzir, ENVIO_OCIOSO);
  const enviar = useCallback(async (fn: () => Promise<{ ok: true } | { ok: false; erro: string; parcial?: string }>) => {
    despachar({ tipo: "enviar" });
    try {
      const r = await fn();
      if (r.ok) despachar({ tipo: "ok", em: horaCurta() });
      else despachar({ tipo: "erro", erro: r.erro, parcial: r.parcial });
      return r.ok;
    } catch (e) {
      despachar({ tipo: "erro", erro: e instanceof Error ? e.message : "tente de novo." });
      return false;
    }
  }, []);
  const editar = useCallback(() => despachar({ tipo: "editar" }), []);
  const zerar = useCallback(() => despachar({ tipo: "zerar" }), []);
  return { estado, enviar, editar, zerar };
}

/**
 * Formulário de um painel que fica montado: quando `chave` muda (outro item, ou "novo"),
 * o formulário volta ao valor inicial daquele item, já no mesmo render (sem piscar o anterior).
 * `marcarCriado(id)`: o item novo acabou de ser gravado e o painel passa a editá-lo; o
 * formulário recarrega, mas `aoTrocar` não roda (o "Salvo às" continua na tela).
 */
export function useFormularioDoItem<F>(chave: string | null, inicial: () => F, aoTrocar?: () => void) {
  const [form, setForm] = useState<F>(inicial);
  const [atual, setAtual] = useState(chave);
  const criado = useRef<string | null>(null);
  if (chave !== atual) {
    setAtual(chave);
    if (chave !== null) {
      setForm(inicial());
      if (criado.current !== chave) aoTrocar?.();
    }
    criado.current = null;
  }
  const marcarCriado = useCallback((id: string) => {
    criado.current = id;
  }, []);
  return [form, setForm, marcarCriado] as const;
}
