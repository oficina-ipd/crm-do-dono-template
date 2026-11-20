"use client";

import { useMemo, useState } from "react";
import { useCRM } from "@/components/crm/provider";
import { formatarReais } from "@/domain/rules";
import { usePathname, useRouter, useSearchParams } from "@/crm-grafite/link";
import { Button, ButtonLink, EmptyState, Input, Panel, Select, Switch, Table, Tabs, Tag, Textarea } from "../../ui";
import { CabecalhoTela, TelaV4 } from "../base-demais/tela";
import { podeEscrever } from "../equipe/gravar";
import { ConfirmarExclusao, PainelEdicao } from "../equipe/painel-edicao";
import { useEnvioReiniciavel, useFormularioDoItem, useGravar } from "../equipe/use-gravar";
import {
  PLATAFORMAS,
  comandoCriativo,
  comandoFunil,
  comandoProduto,
  efeitoRemover,
  formDoCriativo,
  formDoFunil,
  formDoProduto,
  idDoFunil,
  linhasProdutos,
  mudouProduto,
  temErro,
  textoPlaybook,
  validarCriativo,
  validarFunil,
  validarProduto,
  type ErrosCriativo,
  type ErrosFunil,
  type ErrosProduto,
} from "./produtos-logica";
import "../../styles/telas/config.css";

type Aba = "produtos" | "funis" | "criativos";
const ABAS: Aba[] = ["produtos", "funis", "criativos"];
const PARAM: Record<Aba, string> = { produtos: "p", funis: "f", criativos: "c" };

const ativoTag = (ativo: boolean, inativo = "Inativo") => (ativo ? <Tag tom="sucesso">Ativo</Tag> : <Tag>{inativo}</Tag>);

/**
 * Produtos (Grafite): o que você vende, os funis de entrada (de onde o lead vem) e os
 * criativos. Uma linha por item; a linha abre o painel de edição.
 */
export function TelaProdutos() {
  const { estado, operador } = useCRM();
  const pathname = usePathname();
  const sp = useSearchParams();
  const router = useRouter();
  const escreve = podeEscrever(operador);
  const daUrl = sp.get("aba") as Aba | null;
  const aba: Aba = daUrl && ABAS.includes(daUrl) ? daUrl : "produtos";
  const base = `${pathname}?aba=${aba}`;
  const editar = (id: string) => router.replace(`${base}&${PARAM[aba]}=${encodeURIComponent(id)}`);
  const fechar = () => router.replace(base);
  const alvo = (a: Aba) => (a === aba ? sp.get(PARAM[a]) : null);
  const produtos = useMemo(() => linhasProdutos(estado), [estado]);

  const novo: Record<Aba, string> = { produtos: "Novo produto", funis: "Novo funil", criativos: "Novo criativo" };
  const podeCriar = aba === "produtos" || (aba === "funis" ? estado.produtos.length > 0 : estado.funis.length > 0);

  return (
    <TelaV4 area="produtos">
      <CabecalhoTela
        titulo="Produtos"
        meta={`${estado.produtos.filter((p) => p.ativo).length} ativos · ${estado.funis.length} ${estado.funis.length === 1 ? "funil" : "funis"} de entrada`}
        acoes={
          escreve &&
          podeCriar && (
            <Button variant="primary" icon="mais_" onClick={() => editar("novo")}>
              {novo[aba]}
            </Button>
          )
        }
      />
      <Panel semRecuo rotulo="Produtos, funis e criativos">
        <Tabs
          label="O que você vende e de onde vem o lead"
          urlParam="aba"
          tabs={[
            { id: "produtos", label: "Produtos", count: estado.produtos.length },
            { id: "funis", label: "Funis de entrada", count: estado.funis.length },
            { id: "criativos", label: "Criativos", count: estado.criativos.length },
          ]}
        >
          {(ativa) =>
            ativa === "funis" ? (
              <Table
                rotulo="Funis de entrada"
                linhas={estado.funis}
                chave={(f) => f.id}
                linkDaLinha={(f) => `${pathname}?aba=funis&f=${encodeURIComponent(f.id)}`}
                colunas={[
                  { id: "n", titulo: "Funil", celula: (f) => f.nome },
                  { id: "s", titulo: "Situação", celula: (f) => ativoTag(f.ativo) },
                  { id: "c", titulo: "Canal", celula: (f) => f.canal },
                  { id: "p", titulo: "Produto padrão", celula: (f) => estado.produtos.find((p) => p.id === f.produto)?.nome ?? "—" },
                  { id: "id", titulo: "Código de origem", celula: (f) => <span className="v4-tabular">{f.id}</span> },
                ]}
                vazio={
                  <EmptyState
                    nivel={2}
                    titulo="Nenhum funil de entrada"
                    texto={estado.produtos.length ? "Um funil diz de onde o lead veio: perpétuo, live, indicação. Crie o primeiro." : "Cadastre um produto antes: todo funil leva a um produto."}
                  />
                }
              />
            ) : ativa === "criativos" ? (
              <Table
                rotulo="Criativos"
                linhas={estado.criativos}
                chave={(c) => c.id}
                linkDaLinha={(c) => `${pathname}?aba=criativos&c=${encodeURIComponent(c.id)}`}
                colunas={[
                  { id: "n", titulo: "Criativo", celula: (c) => c.nome },
                  { id: "s", titulo: "Situação", celula: (c) => ativoTag(c.ativo, "Pausado") },
                  { id: "f", titulo: "Funil", celula: (c) => estado.funis.find((f) => f.id === c.funilId)?.nome ?? "—" },
                  { id: "p", titulo: "Plataforma", celula: (c) => c.plataforma },
                ]}
                vazio={
                  <EmptyState
                    nivel={2}
                    titulo="Nenhum criativo"
                    texto={estado.funis.length ? "Criativo é o anúncio ou a peça que traz o lead. Cadastre para comparar o resultado de cada um." : "Crie um funil de entrada antes: todo criativo roda num funil."}
                  />
                }
              />
            ) : (
              <Table
                rotulo="Produtos"
                linhas={produtos}
                chave={(p) => p.id}
                linkDaLinha={(p) => `${pathname}?aba=produtos&p=${encodeURIComponent(p.id)}`}
                colunas={[
                  { id: "n", titulo: "Produto", celula: (p) => p.nome },
                  { id: "s", titulo: "Situação", celula: (p) => ativoTag(p.ativo) },
                  { id: "v", titulo: "Valor", numerica: true, celula: (p) => formatarReais(p.valor) },
                  { id: "pa", titulo: "Parcelas", celula: (p) => p.parcelas || <span className="v4-t-3">—</span> },
                  {
                    id: "g",
                    titulo: "Gatilhos de oferta",
                    cortar: (p) => p.gatilhos.join(" · "),
                    celula: (p) => (p.gatilhos.length ? p.gatilhos.join(" · ") : <span className="v4-t-3">Nenhum</span>),
                  },
                  { id: "pb", titulo: "Playbook", celula: (p) => textoPlaybook(p.etapasProprias) },
                  { id: "o", titulo: "Em negociação", numerica: true, celula: (p) => p.abertas },
                ]}
                vazio={<EmptyState nivel={2} titulo="Nenhum produto ainda" texto="Cadastre o que você vende, com o valor e as condições verdadeiras de oferta." />}
              />
            )
          }
        </Tabs>
      </Panel>
      <EditorProduto alvo={alvo("produtos")} aoFechar={fechar} aoCriar={editar} escreve={escreve} />
      <EditorFunil alvo={alvo("funis")} aoFechar={fechar} aoCriar={editar} escreve={escreve} />
      <EditorCriativo alvo={alvo("criativos")} aoFechar={fechar} aoCriar={editar} escreve={escreve} />
    </TelaV4>
  );
}

type PropsEditor = { alvo: string | null; aoFechar: () => void; aoCriar: (id: string) => void; escreve: boolean };

function EditorProduto({ alvo, aoFechar, aoCriar, escreve }: PropsEditor) {
  const { estado } = useCRM();
  const gravar = useGravar();
  const { estado: envio, enviar, editar, zerar } = useEnvioReiniciavel();
  const produto = alvo && alvo !== "novo" ? estado.produtos.find((p) => p.id === alvo) ?? null : null;
  const aberto = alvo === "novo" || Boolean(produto);
  const [erros, setErros] = useState<ErrosProduto>({});
  const [form, setForm, marcarCriado] = useFormularioDoItem(aberto ? alvo : null, () => formDoProduto(produto), () => {
    setErros({});
    zerar();
  });
  const [removendo, setRemovendo] = useState(false);
  const mudar = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (k in erros) setErros((e) => ({ ...e, [k]: undefined }));
    editar();
  };

  async function salvar() {
    const e = validarProduto(form);
    setErros(e);
    if (temErro(e)) return;
    await enviar(async () => {
      const antes = new Set(estado.produtos.map((p) => p.id));
      const r = await gravar(comandoProduto(form, produto?.id), produto ? undefined : "Produto criado.");
      if (!r.ok) return r;
      const criado = produto ? null : r.estado.produtos.find((p) => !antes.has(p.id));
      if (criado) {
        marcarCriado(criado.id);
        aoCriar(criado.id);
      }
      return { ok: true };
    });
  }

  async function remover() {
    if (!produto) return;
    const ef = efeitoRemover(estado, produto.id);
    const r = await gravar({ tipo: "removerProduto", produtoId: produto.id }, ef.acao === "apagar" ? "Produto removido." : "Produto desativado.");
    setRemovendo(false);
    if (r.ok && ef.acao === "apagar") aoFechar();
  }

  const ef = produto ? efeitoRemover(estado, produto.id) : null;
  return (
    <>
      <PainelEdicao
        open={aberto}
        titulo={produto ? produto.nome : "Novo produto"}
        aoFechar={aoFechar}
        aoSalvar={salvar}
        rotuloSalvar={produto ? "Salvar produto" : "Criar produto"}
        envio={envio}
        dirty={mudouProduto(form, produto)}
        perda="as mudanças neste produto"
        somenteLeitura={!escreve}
        extras={
          escreve &&
          produto &&
          (produto.ativo || ef?.acao === "apagar") && (
            <Button variant="destructive" onClick={() => setRemovendo(true)}>
              {ef?.acao === "apagar" ? "Remover" : "Desativar"}
            </Button>
          )
        }
      >
        <div className="v4-form__campos">
          <Input label="Nome" required maxLength={80} value={form.nome} error={erros.nome} onChange={(e) => mudar("nome", e.target.value)} />
          <Input label="Valor (R$)" required inputMode="decimal" value={form.valor} error={erros.valor} help="Como 1.997 ou 497,50." onChange={(e) => mudar("valor", e.target.value)} />
        </div>
        <Input label="Parcelas" value={form.parcelas} help="Do jeito que você escreve na proposta, como 12x R$ 197. Opcional." onChange={(e) => mudar("parcelas", e.target.value)} />
        <Textarea label="Descrição curta" rows={2} maxLength={400} value={form.descricao} help="Entra na proposta. Opcional." onChange={(e) => mudar("descricao", e.target.value)} />
        <Textarea
          label="Gatilhos de oferta"
          rows={4}
          value={form.gatilhos}
          help="Condições verdadeiras para fechar, uma por linha (ex.: “Bônus do evento até sexta”). A oferta usa só o que está aqui; nada é inventado na hora."
          onChange={(e) => mudar("gatilhos", e.target.value)}
        />
        <Switch label="Produto ativo" stateText={["Ativo", "Inativo"]} checked={form.ativo} onChange={(v) => mudar("ativo", v)} />
        {produto && (
          <div className="v4-cfg__bloco">
            <p className="v4-t-ui">
              Playbook: <span className="v4-t-strong">{textoPlaybook(produto.playbook.length)}</span>
            </p>
            <ButtonLink size="sm" variant="ghost" icon="livro" href={`/config/playbook?produto=${encodeURIComponent(produto.id)}`}>
              Abrir o playbook deste produto
            </ButtonLink>
          </div>
        )}
      </PainelEdicao>
      <ConfirmarExclusao
        open={removendo}
        aoFechar={() => setRemovendo(false)}
        titulo={ef?.acao === "apagar" ? "Remover este produto?" : "Desativar este produto?"}
        texto={
          ef?.acao === "apagar"
            ? `“${produto?.nome}” sai da lista. Nenhuma oportunidade usa este produto, então nada mais muda.`
            : `“${produto?.nome}” tem ${ef?.oportunidades} ${ef?.oportunidades === 1 ? "oportunidade" : "oportunidades"} no histórico, então não pode ser apagado: fica inativo e some das ofertas novas. Dá para ativar de novo aqui.`
        }
        rotuloConfirmar={ef?.acao === "apagar" ? "Remover produto" : "Desativar produto"}
        rotuloManter="Manter produto"
        aoConfirmar={remover}
      />
    </>
  );
}

function EditorFunil({ alvo, aoFechar, aoCriar, escreve }: PropsEditor) {
  const { estado } = useCRM();
  const gravar = useGravar();
  const { estado: envio, enviar, editar, zerar } = useEnvioReiniciavel();
  const funil = alvo && alvo !== "novo" ? estado.funis.find((f) => f.id === alvo) ?? null : null;
  const aberto = alvo === "novo" || Boolean(funil);
  const [erros, setErros] = useState<ErrosFunil>({});
  const inicial = () => formDoFunil(funil, estado.produtos.find((p) => p.ativo)?.id ?? estado.produtos[0]?.id ?? "");
  const [form, setForm, marcarCriado] = useFormularioDoItem(aberto ? alvo : null, inicial, () => {
    setErros({});
    zerar();
  });
  const base = inicial();
  const dirty = (Object.keys(base) as (keyof typeof base)[]).some((k) => base[k] !== form[k]);
  const mudar = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (k in erros) setErros((e) => ({ ...e, [k]: undefined }));
    editar();
  };

  async function salvar() {
    const e = validarFunil(form, estado, funil?.id);
    setErros(e);
    if (temErro(e)) return;
    await enviar(async () => {
      const antes = new Set(estado.funis.map((f) => f.id));
      const r = await gravar(comandoFunil(form, funil?.id), funil ? undefined : "Funil criado.");
      if (!r.ok) return r;
      const criado = funil ? null : r.estado.funis.find((f) => !antes.has(f.id));
      if (criado) {
        marcarCriado(criado.id);
        aoCriar(criado.id);
      }
      return { ok: true };
    });
  }

  return (
    <PainelEdicao
      open={aberto}
      titulo={funil ? funil.nome : "Novo funil de entrada"}
      aoFechar={aoFechar}
      aoSalvar={salvar}
      rotuloSalvar={funil ? "Salvar funil" : "Criar funil"}
      envio={envio}
      dirty={dirty}
      perda="as mudanças neste funil"
      somenteLeitura={!escreve}
    >
      <Input label="Nome" required maxLength={60} value={form.nome} error={erros.nome} placeholder="Perpétuo, Live semanal, Indicação" onChange={(e) => mudar("nome", e.target.value)} />
      <Input label="Canal" required maxLength={80} value={form.canal} error={erros.canal} placeholder="Anúncio + formulário" onChange={(e) => mudar("canal", e.target.value)} />
      <Select
        label="Produto padrão"
        value={form.produto}
        error={erros.produto}
        options={estado.produtos.map((p) => ({ value: p.id, label: p.ativo ? p.nome : `${p.nome} (inativo)` }))}
        onChange={(e) => mudar("produto", e.target.value)}
      />
      <Switch label="Funil ativo" stateText={["Ativo", "Inativo"]} checked={form.ativo} onChange={(v) => mudar("ativo", v)} />
      <p className="v4-t-meta">
        {funil
          ? `Código de origem: ${funil.id}. É o que marca de onde o lead veio e não muda quando o nome muda.`
          : form.nome.trim()
            ? `Código de origem: ${idDoFunil(form.nome) || "gerado ao criar"}. É o que marca de onde o lead veio.`
            : "O código de origem, que marca de onde o lead veio, sai do nome."}
      </p>
    </PainelEdicao>
  );
}

function EditorCriativo({ alvo, aoFechar, aoCriar, escreve }: PropsEditor) {
  const { estado } = useCRM();
  const gravar = useGravar();
  const { estado: envio, enviar, editar, zerar } = useEnvioReiniciavel();
  const criativo = alvo && alvo !== "novo" ? estado.criativos.find((c) => c.id === alvo) ?? null : null;
  const aberto = alvo === "novo" || Boolean(criativo);
  const [erros, setErros] = useState<ErrosCriativo>({});
  const inicial = () => formDoCriativo(criativo, estado.funis.find((f) => f.ativo)?.id ?? estado.funis[0]?.id ?? "");
  const [form, setForm, marcarCriado] = useFormularioDoItem(aberto ? alvo : null, inicial, () => {
    setErros({});
    zerar();
  });
  const base = inicial();
  const dirty = (Object.keys(base) as (keyof typeof base)[]).some((k) => base[k] !== form[k]);
  const mudar = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (k in erros) setErros((e) => ({ ...e, [k]: undefined }));
    editar();
  };

  async function salvar() {
    const e = validarCriativo(form, estado);
    setErros(e);
    if (temErro(e)) return;
    await enviar(async () => {
      const antes = new Set(estado.criativos.map((c) => c.id));
      const r = await gravar(comandoCriativo(form, criativo?.id), criativo ? undefined : "Criativo criado.");
      if (!r.ok) return r;
      const criado = criativo ? null : r.estado.criativos.find((c) => !antes.has(c.id));
      if (criado) {
        marcarCriado(criado.id);
        aoCriar(criado.id);
      }
      return { ok: true };
    });
  }

  const plataformas = PLATAFORMAS.includes(form.plataforma) ? PLATAFORMAS : [form.plataforma, ...PLATAFORMAS];
  return (
    <PainelEdicao
      open={aberto}
      titulo={criativo ? criativo.nome : "Novo criativo"}
      aoFechar={aoFechar}
      aoSalvar={salvar}
      rotuloSalvar={criativo ? "Salvar criativo" : "Criar criativo"}
      envio={envio}
      dirty={dirty}
      perda="as mudanças neste criativo"
      somenteLeitura={!escreve}
    >
      <Input label="Nome" required maxLength={80} value={form.nome} error={erros.nome} onChange={(e) => mudar("nome", e.target.value)} />
      <Select label="Funil" value={form.funilId} error={erros.funilId} options={estado.funis.map((f) => ({ value: f.id, label: f.nome }))} onChange={(e) => mudar("funilId", e.target.value)} />
      <Select label="Plataforma" value={form.plataforma} options={plataformas.map((p) => ({ value: p, label: p }))} onChange={(e) => mudar("plataforma", e.target.value)} />
      <Switch label="Criativo no ar" stateText={["No ar", "Pausado"]} checked={form.ativo} onChange={(v) => mudar("ativo", v)} />
    </PainelEdicao>
  );
}
