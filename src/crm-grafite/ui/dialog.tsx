"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button, IconButton } from "./button";
import { useIdV4 } from "./flutuante";

type Props = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  /** Rodapé; como função recebe `fechar`, que respeita a confirmação de descarte. */
  footer?: ReactNode | ((ctx: { fechar: () => void }) => ReactNode);
  /** Há alterações não salvas: Escape, fundo e "Fechar" pedem confirmação antes de descartar. */
  dirty?: boolean;
  /** O que se perde, dito de forma concreta ("a nota que você escreveu"). */
  perda?: string;
  closeOnBackdrop?: boolean;
  description?: ReactNode;
};

/** Primeiro campo do corpo de um diálogo (o que a pessoa veio preencher), se houver. */
export const SELETOR_PRIMEIRO_CAMPO =
  "[autofocus], input:not([type=hidden]):not([disabled]):not([readonly]), select:not([disabled]), textarea:not([disabled]):not([readonly])";

function useDialogNativo(open: boolean, focoNoCampo = false) {
  const ref = useRef<HTMLDialogElement>(null);
  const anterior = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      anterior.current = document.activeElement as HTMLElement | null;
      d.showModal();
      // O <dialog> põe o foco no primeiro focável, que é o "Fechar" do cabeçalho. Num formulário
      // (ex.: "Marcar como perdida"), o foco vai direto para o primeiro campo do corpo.
      if (focoNoCampo) d.querySelector<HTMLElement>(`.v4-dialog__body :is(${SELETOR_PRIMEIRO_CAMPO})`)?.focus();
    } else if (!open && d.open) {
      d.close();
    }
    if (!open && anterior.current) {
      const alvo = anterior.current;
      anterior.current = null;
      if (alvo.isConnected) alvo.focus();
    }
  }, [open]);
  return ref;
}

function Moldura({
  open,
  onClose,
  title,
  children,
  footer,
  dirty,
  perda = "as alterações que você fez",
  closeOnBackdrop = true,
  description,
  classe,
  focoNoCampo,
}: Props & { classe: string; focoNoCampo?: boolean }) {
  const ref = useDialogNativo(open, focoNoCampo);
  const tituloId = useIdV4("v4-dlg-titulo");
  const descId = useIdV4("v4-dlg-desc");
  const [confirmando, setConfirmando] = useState(false);
  const continuarRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) setConfirmando(false);
  }, [open]);
  useEffect(() => {
    if (confirmando) continuarRef.current?.focus();
  }, [confirmando]);

  function tentarFechar() {
    if (dirty) setConfirmando(true);
    else onClose();
  }

  return (
    <dialog
      ref={ref}
      className={classe}
      aria-labelledby={tituloId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault();
        if (confirmando) setConfirmando(false);
        else tentarFechar();
      }}
      onClose={() => {
        if (open) onClose();
      }}
      onClick={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) tentarFechar();
      }}
    >
      <div className="v4-dialog__head">
        <h2 id={tituloId} className="v4-t-section v4-dialog__title">
          {title}
        </h2>
        <IconButton icon="fechar" label="Fechar" onClick={tentarFechar} tooltipLado="baixo" />
      </div>
      <div className="v4-dialog__body">
        {description && (
          <p id={descId} className="v4-t-ui v4-t-2">
            {description}
          </p>
        )}
        {children}
      </div>
      {confirmando ? (
        <div className="v4-discard" role="alertdialog" aria-labelledby={`${tituloId}-descartar`}>
          <p id={`${tituloId}-descartar`} className="v4-t-ui">
            Descartar {perda}? Isso não pode ser desfeito.
          </p>
          <div className="v4-discard__actions">
            <Button ref={continuarRef} variant="secondary" onClick={() => setConfirmando(false)}>
              Continuar editando
            </Button>
            <Button variant="destructive" onClick={onClose}>
              Descartar
            </Button>
          </div>
        </div>
      ) : (
        footer && <div className="v4-dialog__foot">{typeof footer === "function" ? footer({ fechar: tentarFechar }) : footer}</div>
      )}
    </dialog>
  );
}

/** Diálogo modal para uma decisão ou tarefa delimitada. Foco preso pelo próprio <dialog>. */
export function Dialog(props: Props) {
  return <Moldura {...props} classe="v4-dialog" focoNoCampo />;
}

/** Painel lateral sobre <dialog>: consulta ou edição ligada ao contexto atual. */
export function SidePanel({ lado = "direita", ...props }: Props & { lado?: "direita" | "esquerda" }) {
  return <Moldura {...props} classe={["v4-dialog v4-sidepanel", lado === "esquerda" ? "v4-sidepanel--left" : ""].filter(Boolean).join(" ")} />;
}
