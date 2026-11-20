"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button, Dialog, Input } from "../../ui";
import { chaveDoDia, isoDeLocal, type TarefaLinha } from "./logica";

function horaLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  // 23:59 é o "fim do dia" de quem não escolheu hora: volta como campo vazio
  return `${hh}:${mm}` === "23:59" ? "" : `${hh}:${mm}`;
}

/**
 * Mudar a data de uma tarefa (comando `reagendarTarefa`). Sem data também vale: a tarefa vai
 * para "Sem data". Só fecha quando o CRM gravou; se falhar, os campos continuam.
 */
export function MudarData({
  tarefa,
  aoFechar,
  aoSalvar,
}: {
  tarefa: TarefaLinha | null;
  aoFechar: () => void;
  aoSalvar: (venceEm: string | null) => Promise<boolean>;
}) {
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!tarefa) return;
    setData(tarefa.venceEm ? chaveDoDia(new Date(tarefa.venceEm)) : "");
    setHora(horaLocal(tarefa.venceEm));
    setErro(null);
  }, [tarefa]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (salvando) return;
    if (!data && hora) return setErro("Para pôr hora, escolha também a data.");
    const vence = data ? isoDeLocal(data, hora) : null;
    if (data && !vence) return setErro("Data ou hora inválida. Use o seletor do campo.");
    setErro(null);
    setSalvando(true);
    const ok = await aoSalvar(vence);
    setSalvando(false);
    if (ok) aoFechar();
    else setErro("A data não foi alterada. Tente de novo.");
  }

  return (
    <Dialog
      open={tarefa !== null}
      onClose={aoFechar}
      title="Mudar data"
      description={tarefa ? `${tarefa.titulo}${tarefa.contato ? ` · ${tarefa.contato.nome}` : ""}` : undefined}
      footer={({ fechar }) => (
        <>
          <Button variant="ghost" onClick={fechar}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="v4-mudar-data" busy={salvando} busyLabel="Salvando">
            Salvar data
          </Button>
        </>
      )}
    >
      <form id="v4-mudar-data" className="v4-tarefas__mudar" onSubmit={enviar} noValidate>
        <Input label="Data" type="date" value={data} onChange={(e) => setData(e.target.value)} help="Deixe vazio para tirar a data." error={erro ?? undefined} />
        <Input label="Hora (opcional)" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
      </form>
    </Dialog>
  );
}
