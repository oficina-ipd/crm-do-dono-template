"use client";

import { useEffect, useState } from "react";
import { nomeEmExibicao } from "@/lib/crm/format";
import { Button, Dialog, Select } from "../../ui";

/**
 * Marcar como perdida: o motivo é obrigatório e só vale um dos motivos da etapa atual
 * (`motivosPerda` em src/domain/funil.ts). Erro de regra do domínio aparece no aviso do
 * próprio `despachar`; o diálogo fica aberto para tentar de novo.
 */
export function DialogoPerda({
  aberto,
  nome,
  etapaNome,
  motivos,
  aoFechar,
  aoConfirmar,
}: {
  aberto: boolean;
  nome: string;
  etapaNome: string;
  motivos: string[];
  aoFechar: () => void;
  /** Devolve true quando gravou. */
  aoConfirmar: (motivo: string) => Promise<boolean>;
}) {
  const [motivo, setMotivo] = useState("");
  const [faltou, setFaltou] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (aberto) {
      setMotivo("");
      setFaltou(false);
      setSalvando(false);
    }
  }, [aberto]);

  async function confirmar() {
    if (!motivo) {
      setFaltou(true);
      return;
    }
    setSalvando(true);
    await aoConfirmar(motivo);
    setSalvando(false);
  }

  return (
    <Dialog
      open={aberto}
      onClose={() => !salvando && aoFechar()}
      title={`Marcar ${nomeEmExibicao(nome)} como perdida`}
      description={`A oportunidade sai do quadro e fica no histórico. Na etapa ${etapaNome}, o motivo precisa ser um destes.`}
      footer={
        <>
          <Button variant="ghost" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button variant="destructive" busy={salvando} busyLabel="Salvando" onClick={confirmar}>
            Marcar como perdida
          </Button>
        </>
      }
    >
      <Select
        label="Motivo da perda"
        required
        value={motivo}
        placeholder="Escolha o motivo"
        error={faltou && !motivo ? "Escolha o motivo para continuar." : undefined}
        onChange={(e) => {
          setMotivo(e.target.value);
          setFaltou(false);
        }}
        options={motivos.map((m) => ({ value: m, label: m.charAt(0).toLocaleUpperCase("pt-BR") + m.slice(1) }))}
      />
    </Dialog>
  );
}
