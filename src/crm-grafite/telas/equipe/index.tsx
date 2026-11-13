"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useCRM } from "@/components/crm/provider";
import { usePathname, useRouter, useSearchParams } from "@/crm-grafite/link";
import { Avatar, Button, EmptyState, Icon, Input, Panel, Select, Switch, Table, Tag } from "../../ui";
import { CabecalhoTela, EstadoSalvar, TelaV4, useEnvio } from "../base-demais/tela";
import { podeEscrever } from "./gravar";
import { ConfirmarExclusao, PainelEdicao } from "./painel-edicao";
import { useEnvioReiniciavel, useFormularioDoItem, useGravar } from "./use-gravar";
import {
  AJUDA_PAPEL,
  nomeParaAvatar,
  PAPEIS,
  ROTULO_PAPEL,
  comandoOperador,
  conversasDoOperador,
  formDoOperador,
  linhasEquipe,
  motivoNaoDesativar,
  mudouOperador,
  validarConfig,
  validarOperador,
  type ErrosConfig,
  type ErrosOperador,
  type FormConfig,
} from "./equipe-logica";
import "../../styles/telas/config.css";

/**
 * Equipe (Grafite): quem usa o CRM, com papel e situação, e o nome da empresa e do robô.
 * A linha abre o painel de edição; desativar pede confirmação.
 */
export function TelaEquipe() {
  const { estado, operador } = useCRM();
  const pathname = usePathname();
  const sp = useSearchParams();
  const router = useRouter();
  const escreve = podeEscrever(operador);
  const linhas = useMemo(() => linhasEquipe(estado), [estado]);
  const ativos = linhas.filter((l) => l.ativo && l.tipo === "humano").length;
  const robo = linhas.find((l) => l.robo);

  return (
    <TelaV4 area="equipe">
      <CabecalhoTela
        titulo="Equipe"
        meta={`${ativos} ${ativos === 1 ? "pessoa ativa" : "pessoas ativas"}${robo ? ` · robô ${estado.config.nomeRobo}` : ""}`}
        acoes={
          escreve && (
            <Button variant="primary" icon="mais_" onClick={() => router.replace(`${pathname}?o=novo`)}>
              Nova pessoa
            </Button>
          )
        }
      />
      <div className="v4-grade v4-grade--lado">
        <Panel semRecuo titulo="Quem usa o CRM">
          <Table
            rotulo="Equipe"
            linhas={linhas}
            chave={(o) => o.id}
            linkDaLinha={(o) => `${pathname}?o=${encodeURIComponent(o.id)}`}
            colunas={[
              {
                id: "n",
                titulo: "Nome",
                celula: (o) => (
                  <span className="v4-cfg__pessoa">
                    <Avatar nome={nomeParaAvatar(o.nome)} claudio={o.robo} />
                    <span>{o.nome}</span>
                    {o.id === operador?.id && <Tag tom="info">Você</Tag>}
                  </span>
                ),
              },
              { id: "t", titulo: "Tipo", celula: (o) => (o.tipo === "ia" ? "IA" : "Pessoa") },
              { id: "p", titulo: "Papel", celula: (o) => (o.robo ? "Robô do atendimento" : ROTULO_PAPEL[o.papel]) },
              { id: "e", titulo: "E-mail", cortar: (o) => o.email ?? "", celula: (o) => o.email || <span className="v4-t-3">—</span> },
              { id: "c", titulo: "Conversas", numerica: true, celula: (o) => o.conversas },
              { id: "s", titulo: "Situação", celula: (o) => (o.ativo ? <Tag tom="sucesso">Ativo</Tag> : <Tag>Inativo</Tag>) },
            ]}
            vazio={<EmptyState nivel={2} titulo="Ninguém na equipe" texto="Cadastre as pessoas que vão atender e vender." />}
          />
          <dl className="v4-cfg__papeis">
            {PAPEIS.map((p) => (
              <div key={p}>
                <dt>{ROTULO_PAPEL[p]}</dt>
                <dd>{AJUDA_PAPEL[p]}</dd>
              </div>
            ))}
          </dl>
        </Panel>
        <PainelEmpresa escreve={escreve} />
      </div>
      <EditorOperador alvo={sp.get("o")} aoFechar={() => router.replace(pathname)} aoCriar={(id) => router.replace(`${pathname}?o=${encodeURIComponent(id)}`)} escreve={escreve} />
    </TelaV4>
  );
}

/** Nome da empresa e do robô (salvarConfig). Renomear o robô também renomeia o operador IA dele. */
function PainelEmpresa({ escreve }: { escreve: boolean }) {
  const { estado } = useCRM();
  const gravar = useGravar();
  const { estado: envio, enviar, editar } = useEnvio();
  const salvo: FormConfig = { nomeEmpresa: estado.config.nomeEmpresa, nomeRobo: estado.config.nomeRobo };
  const [form, setForm] = useState<FormConfig>(salvo);
  const [erros, setErros] = useState<ErrosConfig>({});
  const mudou = form.nomeEmpresa !== salvo.nomeEmpresa || form.nomeRobo !== salvo.nomeRobo;

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const er = validarConfig(form);
    setErros(er);
    if (Object.keys(er).length) return;
    await enviar(async () => {
      const novo = { nomeEmpresa: form.nomeEmpresa.trim(), nomeRobo: form.nomeRobo.trim() };
      const r = await gravar({ tipo: "salvarConfig", config: novo }, "Nomes salvos.");
      if (!r.ok) return r;
      const roboOp = estado.operadores.find((o) => o.id === estado.config.roboOperadorId);
      if (roboOp && novo.nomeRobo !== salvo.nomeRobo && roboOp.nome !== novo.nomeRobo) {
        const r2 = await gravar({ tipo: "salvarOperador", operador: { id: roboOp.id, nome: novo.nomeRobo, papel: roboOp.papel, tipo: "ia" } });
        if (!r2.ok) return { ok: false, erro: r2.erro, parcial: "O nome da empresa e do robô foram salvos; o robô na lista da equipe ficou com o nome antigo." };
      }
      setForm(novo);
      return { ok: true };
    });
  }

  return (
    <Panel titulo="Empresa e robô">
      <form className="v4-form" onSubmit={salvar} noValidate>
        <Input
          label="Nome da empresa"
          required
          maxLength={60}
          readOnly={!escreve}
          value={form.nomeEmpresa}
          error={erros.nomeEmpresa}
          help="Aparece no topo do CRM e nos textos que o robô envia."
          onChange={(e) => {
            setForm((f) => ({ ...f, nomeEmpresa: e.target.value }));
            setErros((x) => ({ ...x, nomeEmpresa: undefined }));
            editar();
          }}
        />
        <Input
          label="Nome do robô"
          required
          maxLength={30}
          readOnly={!escreve}
          value={form.nomeRobo}
          error={erros.nomeRobo}
          help="O assistente de IA que responde primeiro e passa para uma pessoa."
          onChange={(e) => {
            setForm((f) => ({ ...f, nomeRobo: e.target.value }));
            setErros((x) => ({ ...x, nomeRobo: undefined }));
            editar();
          }}
        />
        {escreve && (
          <div className="v4-form__acoes">
            <Button type="submit" variant="secondary" disabled={!mudou && envio.fase !== "falhou"} busy={envio.fase === "salvando"} busyLabel="Salvando">
              Salvar nomes
            </Button>
            <EstadoSalvar estado={envio} />
          </div>
        )}
      </form>
    </Panel>
  );
}

function EditorOperador({ alvo, aoFechar, aoCriar, escreve }: { alvo: string | null; aoFechar: () => void; aoCriar: (id: string) => void; escreve: boolean }) {
  const { estado, operador: eu } = useCRM();
  const gravar = useGravar();
  const { estado: envio, enviar, editar, zerar } = useEnvioReiniciavel();
  const op = alvo && alvo !== "novo" ? estado.operadores.find((o) => o.id === alvo) ?? null : null;
  const aberto = alvo === "novo" || Boolean(op);
  const robo = op?.id === estado.config.roboOperadorId;
  const [erros, setErros] = useState<ErrosOperador>({});
  const [desativando, setDesativando] = useState(false);
  const [form, setForm, marcarCriado] = useFormularioDoItem(aberto ? alvo : null, () => formDoOperador(op), () => {
    setErros({});
    zerar();
  });
  const mudar = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (k in erros) setErros((e) => ({ ...e, [k]: undefined }));
    editar();
  };
  const motivo = op ? motivoNaoDesativar(estado, op.id) : null;
  const souEu = op?.id === eu?.id;

  async function salvar() {
    const e = validarOperador(form);
    setErros(e);
    if (Object.keys(e).length) return;
    await enviar(async () => {
      const antes = new Set(estado.operadores.map((o) => o.id));
      const r = await gravar(comandoOperador(form, op?.id), op ? undefined : `${form.nome.trim()} entrou na equipe.`);
      if (!r.ok) return r;
      const criado = op ? null : r.estado.operadores.find((o) => !antes.has(o.id));
      if (criado) {
        marcarCriado(criado.id);
        aoCriar(criado.id);
      }
      return { ok: true };
    });
  }

  async function desativar() {
    if (!op) return;
    const r = await gravar({ tipo: "removerOperador", operadorId: op.id }, `${op.nome} saiu da equipe.`);
    setDesativando(false);
    if (r.ok) aoFechar();
  }

  const n = op ? conversasDoOperador(estado, op.id) : 0;
  return (
    <>
      <PainelEdicao
        open={aberto}
        titulo={op ? op.nome : "Nova pessoa na equipe"}
        aoFechar={aoFechar}
        aoSalvar={salvar}
        rotuloSalvar={op ? "Salvar" : "Adicionar à equipe"}
        envio={envio}
        dirty={mudouOperador(form, op)}
        perda="as mudanças nesta pessoa"
        somenteLeitura={!escreve}
        extras={
          escreve &&
          op?.ativo &&
          !motivo && (
            <Button variant="destructive" onClick={() => setDesativando(true)}>
              Tirar da equipe
            </Button>
          )
        }
      >
        {souEu && (
          <p className="v4-nota v4-nota--atencao">
            <Icon name="alerta" />
            <span>Este é o seu acesso. Se deixar de ser dono, você perde acesso às telas de configuração.</span>
          </p>
        )}
        <Input label="Nome" required maxLength={60} value={form.nome} error={erros.nome} onChange={(e) => mudar("nome", e.target.value)} />
        <Input label="E-mail" type="email" autoComplete="off" value={form.email} error={erros.email} help="Opcional. Usado para entrar quando o CRM tiver login por e-mail." onChange={(e) => mudar("email", e.target.value)} />
        <Select
          label="Papel"
          value={form.papel}
          help={AJUDA_PAPEL[form.papel]}
          options={PAPEIS.map((p) => ({ value: p, label: ROTULO_PAPEL[p] }))}
          onChange={(e) => mudar("papel", e.target.value as typeof form.papel)}
        />
        <Select
          label="Tipo"
          value={form.tipo}
          disabled={robo}
          help={robo ? "O robô do atendimento é sempre IA." : "IA para agentes que usam o CRM por chave de API."}
          options={[
            { value: "humano", label: "Pessoa" },
            { value: "ia", label: "IA" },
          ]}
          onChange={(e) => mudar("tipo", e.target.value as typeof form.tipo)}
        />
        <Switch label="Na equipe" stateText={["Ativo", "Inativo"]} checked={form.ativo} onChange={(v) => mudar("ativo", v)} />
        {op?.ativo && motivo && <p className="v4-t-meta">{motivo}</p>}
      </PainelEdicao>
      <ConfirmarExclusao
        open={desativando}
        aoFechar={() => setDesativando(false)}
        titulo={`Tirar ${op?.nome ?? ""} da equipe?`}
        texto={[
          `${op?.nome ?? "Esta pessoa"} não entra mais no CRM.`,
          n ? `${n === 1 ? "A conversa que estava com ela fica" : `As ${n} conversas que estavam com ela ficam`} sem responsável.` : null,
          souEu ? "Como é você, a sessão termina e o CRM volta para a escolha de quem está entrando." : null,
          "Dá para ativar de novo aqui, mas as conversas não voltam sozinhas.",
        ]
          .filter(Boolean)
          .join(" ")}
        rotuloConfirmar="Tirar da equipe"
        rotuloManter="Manter na equipe"
        aoConfirmar={desativar}
      />
    </>
  );
}
