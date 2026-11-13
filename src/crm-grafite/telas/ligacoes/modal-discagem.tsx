"use client";

import { useEffect, useState } from "react";
import { useCRM } from "@/components/crm/provider";
import { telefoneDigitos } from "@/domain/rules";
import { Button, Dialog, Input, ListRow, Select } from "../../ui";
import { EstadoSalvar } from "../base-demais/tela";
import { useEnvioReiniciavel, useGravar } from "../equipe/use-gravar";
import { buscarParaDiscar, pareceNumeroNovo } from "./ligacoes-logica";
import "../../styles/telas/config.css";

/**
 * Discagem rápida no visual Grafite (substitui src/screens/modais/Discagem.tsx, mesmas props):
 * escolha um contato ou digite um número. Número novo vira contato na hora (criarLead) e já
 * abre a ligação.
 */
export function ModalDiscagemGrafite({ open, onClose, aoLigar }: { open: boolean; onClose: () => void; aoLigar: (contatoId: string) => void }) {
  const { contatos, estado, operador } = useCRM();
  const gravar = useGravar();
  const { estado: envio, enviar, editar, zerar } = useEnvioReiniciavel();
  const [termo, setTermo] = useState("");
  const [novo, setNovo] = useState({ nome: "", empresa: "", origem: "" });
  const [erroNome, setErroNome] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTermo("");
    setNovo({ nome: "", empresa: "", origem: estado.funis.find((f) => f.ativo)?.id ?? estado.funis[0]?.id ?? "" });
    setErroNome(null);
    zerar();
  }, [open, estado.funis, zerar]);

  const achados = buscarParaDiscar(contatos, termo);
  const numeroNovo = pareceNumeroNovo(termo, achados.length);

  async function criarELigar() {
    if (!novo.nome.trim()) {
      setErroNome("Escreva o nome de quem vai atender.");
      return;
    }
    await enviar(async () => {
      const r = await gravar(
        { tipo: "criarLead", nome: novo.nome.trim(), telefone: termo, origem: novo.origem, empresa: novo.empresa.trim(), abrirConversa: false, por: operador?.id ?? "discagem" },
        "Contato criado.",
      );
      if (!r.ok) return r;
      const c = r.estado.contatos.find((x) => telefoneDigitos(x.telefone) === telefoneDigitos(termo));
      if (c) aoLigar(c.id);
      return { ok: true };
    });
  }

  return (
    <Dialog open={open} onClose={onClose} title="Nova ligação" description="Busque o contato pelo nome, pela empresa ou pelo telefone.">
      <div className="v4-form">
        <Input label="Contato ou telefone" placeholder="Nome, empresa ou (62) 9…" autoComplete="off" value={termo} onChange={(e) => setTermo(e.target.value)} />
        {achados.length > 0 && (
          <ul className="v4-lig__achados" aria-label="Contatos encontrados">
            {achados.map((c) => (
              <li key={c.id}>
                <ListRow titulo={c.nome} meta={c.telefone} texto={c.empresa || undefined} onClick={() => aoLigar(c.id)} />
              </li>
            ))}
          </ul>
        )}
        {termo.trim() && achados.length === 0 && !numeroNovo && <p className="v4-t-meta">Nenhum contato com esse nome. Para ligar para um número novo, digite o telefone com DDD.</p>}
        {numeroNovo && (
          <fieldset className="v4-form__grupo">
            <legend>Número novo: cria o contato e liga</legend>
            <div className="v4-form__campos">
              <Input
                label="Nome"
                required
                value={novo.nome}
                error={erroNome ?? undefined}
                onChange={(e) => {
                  setNovo((n) => ({ ...n, nome: e.target.value }));
                  setErroNome(null);
                  editar();
                }}
              />
              <Input label="Empresa" value={novo.empresa} onChange={(e) => setNovo((n) => ({ ...n, empresa: e.target.value }))} />
            </div>
            <Select label="De onde veio" value={novo.origem} options={estado.funis.map((f) => ({ value: f.id, label: f.nome }))} onChange={(e) => setNovo((n) => ({ ...n, origem: e.target.value }))} />
            <div className="v4-form__acoes">
              <Button variant="primary" icon="telefone" onClick={criarELigar} busy={envio.fase === "salvando"} busyLabel="Criando">
                Criar e ligar
              </Button>
              <EstadoSalvar estado={envio} />
            </div>
          </fieldset>
        )}
        {!termo && <p className="v4-t-meta">Dica: digite parte do nome ou o telefone com DDD.</p>}
      </div>
    </Dialog>
  );
}
