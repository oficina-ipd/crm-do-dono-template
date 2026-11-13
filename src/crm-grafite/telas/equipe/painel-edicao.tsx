"use client";

import { useId, type FormEvent, type ReactNode } from "react";
import { Button, Dialog, SidePanel } from "../../ui";
import { EstadoSalvar } from "../base-demais/tela";
import type { EstadoEnvio } from "../base-demais/formulario";

/**
 * Painel lateral de edição das telas de configuração (Produtos, Equipe, Modelos, Playbook):
 * formulário no corpo, rodapé com o estado do envio, ações secundárias e o botão de salvar.
 * Fechar com alteração não salva pede confirmação (do próprio SidePanel). ⌘Enter salva.
 */
export function PainelEdicao({
  open,
  titulo,
  descricao,
  aoFechar,
  aoSalvar,
  rotuloSalvar,
  envio,
  dirty,
  perda,
  extras,
  somenteLeitura,
  children,
}: {
  open: boolean;
  titulo: string;
  descricao?: ReactNode;
  aoFechar: () => void;
  aoSalvar: () => Promise<unknown>;
  rotuloSalvar: string;
  envio: EstadoEnvio;
  dirty: boolean;
  perda?: string;
  /** Ações secundárias à esquerda do salvar (remover, desativar…). */
  extras?: ReactNode;
  somenteLeitura?: boolean;
  children: ReactNode;
}) {
  const formId = `v4-cfg-edicao-${useId().replace(/:/g, "")}`;
  function enviar(e: FormEvent) {
    e.preventDefault();
    if (!somenteLeitura) void aoSalvar();
  }
  return (
    <SidePanel
      open={open}
      onClose={aoFechar}
      title={titulo}
      description={descricao}
      dirty={dirty && envio.fase !== "salvando"}
      perda={perda}
      footer={({ fechar }) => (
        <div className="v4-cfg__rodape">
          <EstadoSalvar estado={envio} />
          <div className="v4-cfg__rodape-acoes">
            {extras}
            <Button variant="secondary" onClick={fechar}>
              {somenteLeitura || !dirty ? "Fechar" : "Cancelar"}
            </Button>
            {!somenteLeitura && (
              <Button type="submit" form={formId} variant="primary" busy={envio.fase === "salvando"} busyLabel="Salvando" disabled={!dirty && envio.fase !== "falhou"}>
                {rotuloSalvar}
              </Button>
            )}
          </div>
        </div>
      )}
    >
      <form
        id={formId}
        className="v4-form"
        noValidate
        onSubmit={enviar}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            if (!somenteLeitura && dirty) void aoSalvar();
          }
        }}
      >
        {children}
      </form>
    </SidePanel>
  );
}

/** Confirmação de exclusão (remover, desativar, revogar): diz o que acontece e se dá para desfazer. */
export function ConfirmarExclusao({
  open,
  titulo,
  texto,
  rotuloConfirmar,
  rotuloManter,
  aoConfirmar,
  aoFechar,
}: {
  open: boolean;
  titulo: string;
  texto: ReactNode;
  rotuloConfirmar: string;
  rotuloManter: string;
  aoConfirmar: () => Promise<unknown>;
  aoFechar: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={aoFechar}
      title={titulo}
      description={texto}
      footer={({ fechar }) => (
        <>
          <Button variant="secondary" onClick={fechar}>
            {rotuloManter}
          </Button>
          <Button variant="destructive" onClick={aoConfirmar} busyLabel="Processando">
            {rotuloConfirmar}
          </Button>
        </>
      )}
    >
      <span className="v4-sr">Confirmação</span>
    </Dialog>
  );
}
