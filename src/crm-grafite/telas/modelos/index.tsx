"use client";

import { useRef, useState } from "react";
import { useCRM } from "@/components/crm/provider";
import { usePathname, useRouter, useSearchParams } from "@/crm-grafite/link";
import { Button, EmptyState, Icon, Input, NoResults, Panel, SearchInput, SegmentedControl, Select, Table, Tag, Textarea } from "../../ui";
import { CabecalhoTela, TelaV4 } from "../base-demais/tela";
import { podeEscrever } from "../equipe/gravar";
import { ConfirmarExclusao, PainelEdicao } from "../equipe/painel-edicao";
import { useEnvioReiniciavel, useFormularioDoItem, useGravar } from "../equipe/use-gravar";
import {
  ROTULO_CANAL,
  VARIAVEIS,
  comandoModelo,
  exemploVariaveis,
  falaDePreco,
  filtrarModelos,
  formDoModelo,
  inserirVariavel,
  mudouModelo,
  previa,
  validarModelo,
  variaveisDesconhecidas,
  type ErrosModelo,
  type FiltroCanal,
} from "./modelos-logica";
import "../../styles/telas/config.css";

/**
 * Modelos de mensagem (Grafite): textos prontos de WhatsApp e e-mail, com variáveis e prévia.
 * Aparecem na conversa e no e-mail da ficha. A linha abre o painel de edição.
 */
export function TelaModelos() {
  const { estado, operador } = useCRM();
  const pathname = usePathname();
  const sp = useSearchParams();
  const router = useRouter();
  const escreve = podeEscrever(operador);
  const [canal, setCanal] = useState<FiltroCanal>("todos");
  const [busca, setBusca] = useState("");
  const vars = exemploVariaveis(estado, operador?.nome);
  const linhas = filtrarModelos(estado.templates, canal, busca);
  const n = (c: FiltroCanal) => filtrarModelos(estado.templates, c, "").length;

  return (
    <TelaV4 area="modelos">
      <CabecalhoTela
        titulo="Modelos de mensagem"
        meta={`${estado.templates.length} ${estado.templates.length === 1 ? "modelo" : "modelos"}`}
        acoes={
          escreve && (
            <Button variant="primary" icon="mais_" onClick={() => router.replace(`${pathname}?m=novo`)}>
              Novo modelo
            </Button>
          )
        }
      />
      <Panel semRecuo rotulo="Modelos de mensagem">
        <div className="v4-cfg__filtros">
          <SearchInput label="Buscar modelo" placeholder="Buscar no nome ou no texto" atalho="/" value={busca} onChange={setBusca} />
          <SegmentedControl
            label="Canal"
            value={canal}
            onChange={(v) => setCanal(v as FiltroCanal)}
            options={[
              { value: "todos", label: "Todos", count: n("todos") },
              { value: "whatsapp", label: "WhatsApp", count: n("whatsapp") },
              { value: "email", label: "E-mail", count: n("email") },
            ]}
          />
        </div>
        <Table
          rotulo="Modelos de mensagem"
          linhas={linhas}
          chave={(t) => t.id}
          linkDaLinha={(t) => `${pathname}?m=${encodeURIComponent(t.id)}`}
          colunas={[
            { id: "n", titulo: "Nome", celula: (t) => t.nome },
            { id: "c", titulo: "Canal", celula: (t) => <Tag>{ROTULO_CANAL[t.canal]}</Tag> },
            {
              id: "p",
              titulo: "Prévia",
              cortar: (t) => {
                const p = previa(t, vars);
                return p.assunto ? `${p.assunto} · ${p.texto}` : p.texto;
              },
              celula: (t) => {
                const p = previa(t, vars);
                return p.assunto ? `${p.assunto} · ${p.texto}` : p.texto;
              },
            },
            {
              id: "r",
              titulo: "Quem envia",
              celula: (t) =>
                falaDePreco({ texto: t.texto, assunto: t.assunto ?? "" }) ? (
                  <Tag tom="atencao" icon="alerta">
                    Só uma pessoa
                  </Tag>
                ) : (
                  `Pessoa ou ${estado.config.nomeRobo}`
                ),
            },
          ]}
          vazio={
            estado.templates.length === 0 ? (
              <EmptyState nivel={2} titulo="Nenhum modelo ainda" texto="Crie os textos que a equipe manda sempre: boas-vindas, lembrete, proposta. Eles aparecem na conversa e no e-mail." />
            ) : (
              <NoResults
                nivel={2}
                termo={busca.trim() || undefined}
                aoLimpar={() => {
                  setBusca("");
                  setCanal("todos");
                }}
              />
            )
          }
        />
      </Panel>
      <EditorModelo alvo={sp.get("m")} aoFechar={() => router.replace(pathname)} aoCriar={(id) => router.replace(`${pathname}?m=${encodeURIComponent(id)}`)} escreve={escreve} />
    </TelaV4>
  );
}

function EditorModelo({ alvo, aoFechar, aoCriar, escreve }: { alvo: string | null; aoFechar: () => void; aoCriar: (id: string) => void; escreve: boolean }) {
  const { estado, operador } = useCRM();
  const gravar = useGravar();
  const { estado: envio, enviar, editar, zerar } = useEnvioReiniciavel();
  const modelo = alvo && alvo !== "novo" ? estado.templates.find((t) => t.id === alvo) ?? null : null;
  const aberto = alvo === "novo" || Boolean(modelo);
  const [erros, setErros] = useState<ErrosModelo>({});
  const [removendo, setRemovendo] = useState(false);
  const texto = useRef<HTMLTextAreaElement>(null);
  const [form, setForm, marcarCriado] = useFormularioDoItem(aberto ? alvo : null, () => formDoModelo(modelo), () => {
    setErros({});
    zerar();
  });
  const mudar = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (k in erros) setErros((e) => ({ ...e, [k]: undefined }));
    editar();
  };
  const vars = exemploVariaveis(estado, operador?.nome);
  const p = previa({ texto: form.texto, assunto: form.canal === "email" ? form.assunto : null }, vars);
  const desconhecidas = variaveisDesconhecidas(`${form.canal === "email" ? form.assunto : ""} ${form.texto}`);

  function inserir(chave: string) {
    const el = texto.current;
    const r = inserirVariavel(form.texto, chave, el?.selectionStart, el?.selectionEnd);
    mudar("texto", r.texto);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(r.cursor, r.cursor);
    });
  }

  async function salvar() {
    const e = validarModelo(form);
    setErros(e);
    if (Object.keys(e).length) return;
    await enviar(async () => {
      const antes = new Set(estado.templates.map((t) => t.id));
      const r = await gravar(comandoModelo(form, modelo?.id), modelo ? undefined : "Modelo criado.");
      if (!r.ok) return r;
      const criado = modelo ? null : r.estado.templates.find((t) => !antes.has(t.id));
      if (criado) {
        marcarCriado(criado.id);
        aoCriar(criado.id);
      }
      return { ok: true };
    });
  }

  async function remover() {
    if (!modelo) return;
    const r = await gravar({ tipo: "removerTemplate", templateId: modelo.id }, "Modelo removido.");
    setRemovendo(false);
    if (r.ok) aoFechar();
  }

  return (
    <>
      <PainelEdicao
        open={aberto}
        titulo={modelo ? modelo.nome : "Novo modelo"}
        aoFechar={aoFechar}
        aoSalvar={salvar}
        rotuloSalvar={modelo ? "Salvar modelo" : "Criar modelo"}
        envio={envio}
        dirty={mudouModelo(form, modelo)}
        perda="o texto que você escreveu"
        somenteLeitura={!escreve}
        extras={
          escreve &&
          modelo && (
            <Button variant="destructive" onClick={() => setRemovendo(true)}>
              Remover
            </Button>
          )
        }
      >
        <div className="v4-form__campos">
          <Input label="Nome" required maxLength={60} value={form.nome} error={erros.nome} onChange={(e) => mudar("nome", e.target.value)} />
          <Select
            label="Canal"
            value={form.canal}
            options={[
              { value: "whatsapp", label: "WhatsApp" },
              { value: "email", label: "E-mail" },
            ]}
            onChange={(e) => mudar("canal", e.target.value as typeof form.canal)}
          />
        </div>
        {form.canal === "email" && <Input label="Assunto" required maxLength={120} value={form.assunto} error={erros.assunto} onChange={(e) => mudar("assunto", e.target.value)} />}
        <Textarea ref={texto} label="Texto" required rows={7} maxLength={4096} value={form.texto} error={erros.texto} help={`${form.texto.length} de 4096 caracteres.`} onChange={(e) => mudar("texto", e.target.value)} />
        {escreve && (
          <div className="v4-cfg__bloco">
            <p className="v4-t-meta">Inserir no texto, onde está o cursor:</p>
            <div className="v4-cfg__variaveis">
              {VARIAVEIS.map((v) => (
                <Button key={v.chave} size="sm" variant="ghost" onClick={() => inserir(v.chave)} title={v.ajuda}>
                  {`{${v.chave}}`}
                  <span className="v4-sr">, {v.ajuda}</span>
                </Button>
              ))}
            </div>
          </div>
        )}
        {desconhecidas.length > 0 && (
          <p className="v4-nota v4-nota--atencao">
            <Icon name="alerta" />
            <span>
              {desconhecidas.map((k) => `{${k}}`).join(", ")} não é uma variável do CRM e vai sair na mensagem do jeito que está escrito.
            </span>
          </p>
        )}
        {falaDePreco(form) && (
          <p className="v4-nota v4-nota--atencao">
            <Icon name="alerta" />
            <span>Este texto fala de preço ou condição: {estado.config.nomeRobo} não envia. Só uma pessoa da equipe pode mandar.</span>
          </p>
        )}
        <section className="v4-cfg__previa" aria-labelledby="modelo-previa">
          <h3 id="modelo-previa" className="v4-t-ui v4-t-strong">
            Prévia com dados de exemplo
          </h3>
          {p.assunto && <p className="v4-t-ui v4-t-strong">{p.assunto}</p>}
          <p className="v4-texto-longo">{p.texto || <span className="v4-t-3">O texto aparece aqui enquanto você escreve.</span>}</p>
        </section>
      </PainelEdicao>
      <ConfirmarExclusao
        open={removendo}
        aoFechar={() => setRemovendo(false)}
        titulo="Remover este modelo?"
        texto={`“${modelo?.nome ?? ""}” some da lista e das opções na conversa e no e-mail. Não dá para desfazer; mensagens já enviadas não mudam.`}
        rotuloConfirmar="Remover modelo"
        rotuloManter="Manter modelo"
        aoConfirmar={remover}
      />
    </>
  );
}
