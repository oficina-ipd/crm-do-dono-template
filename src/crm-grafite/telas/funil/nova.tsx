"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useCRM } from "@/components/crm/provider";
import { useRouter } from "@/crm-grafite/link";
import { nomeEmExibicao } from "@/lib/crm/format";
import { Button, Dialog, Input, Select, useToast } from "../../ui";
import { conferirNovaOportunidade } from "./logica";

/**
 * Nova oportunidade: cria o contato (ou reaproveita o do mesmo WhatsApp) com uma oportunidade
 * em "Lead novo", pelo comando `criarLead` do domínio. Não abre conversa automática: quem
 * cadastra à mão decide quando falar.
 */
export function DialogoNovaOportunidade({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const { estado, despachar, operador } = useCRM();
  const toast = useToast();
  const router = useRouter();
  const funis = estado.funis.filter((f) => f.ativo);
  const produtos = estado.produtos.filter((p) => p.ativo);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [origem, setOrigem] = useState("");
  const [produtoId, setProdutoId] = useState("");
  const [tentou, setTentou] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setNome("");
    setTelefone("");
    setEmpresa("");
    setOrigem(funis[0]?.id ?? "");
    const doFunil = produtos.find((p) => p.id === funis[0]?.produto);
    setProdutoId(doFunil?.id ?? produtos[0]?.id ?? "");
    setTentou(false);
    setSalvando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  const conferencia = conferirNovaOportunidade(estado, { nome, telefone, produtoId });
  const sujo = Boolean(nome.trim() || telefone.trim() || empresa.trim());

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTentou(true);
    if (conferencia.erroNome || conferencia.erroTelefone || conferencia.jaAberta) return;
    setSalvando(true);
    const antes = new Set(estado.oportunidades.map((o) => o.id));
    const novo = await despachar({
      tipo: "criarLead",
      nome: nome.trim(),
      telefone: telefone.trim(),
      empresa: empresa.trim() || undefined,
      origem,
      produtoId: produtoId || undefined,
      abrirConversa: false,
      por: operador?.id,
    });
    setSalvando(false);
    if (!novo) return;
    const opp = novo.oportunidades.find((o) => !antes.has(o.id));
    const contato = opp ? novo.contatos.find((c) => c.id === opp.contatoId) : null;
    aoFechar();
    if (!opp || !contato) {
      toast.avisar({ tom: "info", titulo: "Nada novo no funil", texto: "Esse contato já tinha uma oportunidade aberta para este produto." });
      return;
    }
    const exibido = nomeEmExibicao(contato.nome);
    toast.avisar({
      tom: "sucesso",
      titulo: `${exibido} entrou em Lead novo`,
      texto: conferencia.existente ? "O WhatsApp já era de um contato; a oportunidade nova ficou com ele." : undefined,
      acao: { label: "Abrir ficha", onClick: () => router.push(`/contatos/${encodeURIComponent(contato.id)}`) },
    });
  }

  const semCadastro = funis.length === 0 || produtos.length === 0;

  return (
    <Dialog
      open={aberto}
      onClose={() => !salvando && aoFechar()}
      dirty={sujo && !salvando}
      perda="os dados que você digitou"
      title="Nova oportunidade"
      description="Entra em Lead novo. A conversa não começa sozinha."
      footer={({ fechar }) => (
        <>
          <Button variant="ghost" onClick={fechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button type="submit" form="v4-funil-nova" variant="primary" busy={salvando} busyLabel="Criando" disabled={semCadastro}>
            Criar oportunidade
          </Button>
        </>
      )}
    >
      {semCadastro ? (
        <p className="v4-t-ui v4-t-2">
          Para criar uma oportunidade, cadastre antes pelo menos um produto e um funil de entrada (origem).
        </p>
      ) : (
        <form id="v4-funil-nova" className="v4-funil-nova" onSubmit={enviar} noValidate>
          <Input label="Nome" required value={nome} onChange={(e) => setNome(e.target.value)} error={tentou ? conferencia.erroNome : undefined} autoComplete="off" />
          <Input
            label="WhatsApp"
            required
            inputMode="tel"
            placeholder="(11) 90000-0000"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            error={tentou ? (conferencia.erroTelefone ?? conferencia.jaAberta) : undefined}
            help={!conferencia.jaAberta && conferencia.existente ? `Esse WhatsApp já é de ${nomeEmExibicao(conferencia.existente)}; a oportunidade nova fica com esse contato.` : undefined}
            autoComplete="off"
          />
          <Input label="Empresa" value={empresa} onChange={(e) => setEmpresa(e.target.value)} autoComplete="off" />
          <Select label="Origem" value={origem} onChange={(e) => setOrigem(e.target.value)} options={funis.map((f) => ({ value: f.id, label: f.nome }))} />
          {produtos.length > 1 && (
            <Select label="Produto" value={produtoId} onChange={(e) => setProdutoId(e.target.value)} options={produtos.map((p) => ({ value: p.id, label: p.nome }))} />
          )}
        </form>
      )}
    </Dialog>
  );
}
