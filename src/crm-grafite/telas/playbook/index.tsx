"use client";

import { useState, type ReactNode } from "react";
import { useCRM } from "@/components/crm/provider";
import { ETAPAS, PLAYBOOK, playbookDe } from "@/domain/funil";
import type { EtapaId, PerguntaMatadora, Produto } from "@/domain/types";
import { usePathname, useRouter, useSearchParams } from "@/crm-grafite/link";
import { Button, IconButton, Icon, Input, Panel, Select, Table, Tag, Textarea } from "../../ui";
import { CabecalhoTela, TelaV4 } from "../base-demais/tela";
import { podeEscrever } from "../equipe/gravar";
import { ConfirmarExclusao, PainelEdicao } from "../equipe/painel-edicao";
import { useEnvioReiniciavel, useFormularioDoItem, useGravar } from "../equipe/use-gravar";
import {
  formDaEtapa,
  linhasPlaybook,
  mesmoFormulario,
  paraPergunta,
  playbookComEtapa,
  playbookSemEtapa,
  quemConduz,
  validarEtapa,
  type FormEtapa,
} from "./playbook-logica";
import "../../styles/telas/config.css";

/**
 * Playbook (Grafite): uma linha por etapa do funil com a Pergunta Matadora; a linha abre a
 * etapa inteira. O padrão vale para todos; num produto dá para ter a versão própria da etapa.
 */
export function TelaPlaybook() {
  const { estado, operador } = useCRM();
  const pathname = usePathname();
  const sp = useSearchParams();
  const router = useRouter();
  const robo = estado.config.nomeRobo;
  const produtoId = sp.get("produto");
  const produto = produtoId ? estado.produtos.find((p) => p.id === produtoId) ?? null : null;
  const linhas = linhasPlaybook(produto, robo);
  const base = produto ? `${pathname}?produto=${encodeURIComponent(produto.id)}` : pathname;
  const etapaId = sp.get("etapa") as EtapaId | null;
  const etapa = etapaId && linhas.some((l) => l.etapa === etapaId) ? etapaId : null;
  const proprias = produto?.playbook.length ?? 0;

  return (
    <TelaV4 area="playbook">
      <CabecalhoTela
        titulo="Playbook"
        meta={produto ? `${produto.nome} · ${proprias === 0 ? "igual ao padrão" : `${proprias} ${proprias === 1 ? "etapa própria" : "etapas próprias"}`}` : "Padrão · vale para todos os produtos"}
      />
      <p className="v4-nota">
        <Icon name="info" />
        <span>
          Uma pergunta principal por etapa, o que fazer com cada nota, as objeções e o próximo passo. {robo} usa a etapa “Em conversa”; a equipe usa
          as demais. Para mudar uma etapa só para um produto, escolha o produto.
        </span>
      </p>
      <Panel semRecuo rotulo="Etapas do playbook">
        <div className="v4-cfg__filtros">
          <div className="v4-cfg__seletor">
            <Select
              label="Playbook de"
              value={produto?.id ?? ""}
              options={[
                { value: "", label: "Padrão (todos os produtos)" },
                ...estado.produtos.map((p) => ({ value: p.id, label: `${p.nome}${p.ativo ? "" : " (inativo)"}${p.playbook.length ? ` · ${p.playbook.length} própria${p.playbook.length === 1 ? "" : "s"}` : ""}` })),
              ]}
              onChange={(e) => router.replace(e.target.value ? `${pathname}?produto=${encodeURIComponent(e.target.value)}` : pathname)}
            />
          </div>
        </div>
        <Table
          rotulo={produto ? `Playbook de ${produto.nome}` : "Playbook padrão"}
          linhas={linhas}
          chave={(l) => l.etapa}
          linkDaLinha={(l) => `${base}${base.includes("?") ? "&" : "?"}etapa=${l.etapa}`}
          colunas={[
            { id: "e", titulo: "Etapa", celula: (l) => `${l.ordem}. ${l.nome}` },
            { id: "p", titulo: "Pergunta Matadora", cortar: (l) => l.pergunta, celula: (l) => l.pergunta },
            { id: "c", titulo: "Quem conduz", celula: (l) => l.conduz },
            { id: "z", titulo: "Prazo", celula: (l) => l.prazo },
            { id: "m", titulo: "Meta", numerica: true, celula: (l) => `${l.meta}%` },
            ...(produto ? [{ id: "v", titulo: "Versão", celula: (l: (typeof linhas)[number]) => (l.proprio ? <Tag tom="info">Própria do produto</Tag> : <Tag>Padrão</Tag>) }] : []),
          ]}
        />
      </Panel>
      <PainelEtapa etapa={etapa} produto={produto} escreve={podeEscrever(operador)} aoFechar={() => router.replace(base)} />
    </TelaV4>
  );
}

function PainelEtapa({ etapa, produto, escreve, aoFechar }: { etapa: EtapaId | null; produto: Produto | null; escreve: boolean; aoFechar: () => void }) {
  const { estado } = useCRM();
  const gravar = useGravar();
  const { estado: envio, enviar, editar, zerar } = useEnvioReiniciavel();
  const [editando, setEditando] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});
  const e = etapa ? ETAPAS.find((x) => x.id === etapa) ?? null : null;
  const pm = etapa ? playbookDe(etapa, produto) : null;
  const proprio = Boolean(etapa && produto?.playbook.some((x) => x.etapa === etapa));
  const chave = etapa ? `${produto?.id ?? "padrao"}:${etapa}` : null;
  const [form, setForm] = useFormularioDoItem(chave, () => (pm ? formDaEtapa(pm) : formDaEtapa(PLAYBOOK[0])), () => {
    setEditando(false);
    setErros({});
    zerar();
  });
  const dirty = Boolean(editando && pm && !mesmoFormulario(form, formDaEtapa(pm)));
  const mudar = (f: (x: FormEtapa) => FormEtapa, campo?: string) => {
    setForm(f);
    if (campo && erros[campo]) setErros((x) => ({ ...x, [campo]: "" }));
    editar();
  };

  async function salvar() {
    if (!produto || !etapa) return;
    const er = Object.fromEntries(Object.entries(validarEtapa(form)).filter(([, v]) => v));
    setErros(er);
    if (Object.keys(er).length) return;
    await enviar(async () => {
      const playbook = playbookComEtapa(produto.playbook, paraPergunta(form, etapa));
      const r = await gravar({ tipo: "salvarProduto", produto: { id: produto.id, nome: produto.nome, valor: produto.valor, playbook } }, `Etapa salva no playbook de ${produto.nome}.`);
      return r.ok ? { ok: true } : r;
    });
  }

  async function restaurar() {
    if (!produto || !etapa) return;
    const playbook = playbookSemEtapa(produto.playbook, etapa);
    const r = await gravar({ tipo: "salvarProduto", produto: { id: produto.id, nome: produto.nome, valor: produto.valor, playbook } }, "A etapa voltou ao playbook padrão.");
    setRestaurando(false);
    if (r.ok) {
      const padrao = PLAYBOOK.find((x) => x.etapa === etapa);
      if (padrao) setForm(formDaEtapa(padrao));
      setEditando(false);
    }
  }

  const podeEditar = escreve && Boolean(produto);
  return (
    <>
      <PainelEdicao
        open={Boolean(e && pm)}
        titulo={e ? `${ETAPAS.indexOf(e) + 1}. ${e.nome}` : "Etapa"}
        descricao={produto ? (proprio ? `Versão própria de ${produto.nome}.` : `${produto.nome} usa o padrão nesta etapa.`) : "Playbook padrão, para todos os produtos."}
        aoFechar={aoFechar}
        aoSalvar={salvar}
        rotuloSalvar="Salvar etapa"
        envio={envio}
        dirty={dirty}
        perda="as mudanças nesta etapa"
        somenteLeitura={!editando}
        extras={
          podeEditar &&
          (editando ? (
            proprio && (
              <Button variant="destructive" onClick={() => setRestaurando(true)}>
                Voltar ao padrão
              </Button>
            )
          ) : (
            <Button variant="primary" icon="editar" onClick={() => setEditando(true)}>
              {proprio ? "Editar" : "Criar versão do produto"}
            </Button>
          ))
        }
      >
        {e && pm && (editando ? <FormularioEtapa form={form} erros={erros} mudar={mudar} /> : <LeituraEtapa pm={pm} etapa={e} nomeRobo={estado.config.nomeRobo} />)}
      </PainelEdicao>
      <ConfirmarExclusao
        open={restaurando}
        aoFechar={() => setRestaurando(false)}
        titulo="Voltar esta etapa ao padrão?"
        texto={`${produto?.nome ?? "O produto"} deixa de ter versão própria em “${e?.nome ?? ""}” e passa a usar o playbook padrão. O que foi escrito para o produto nesta etapa se perde.`}
        rotuloConfirmar="Voltar ao padrão"
        rotuloManter="Manter a versão do produto"
        aoConfirmar={restaurar}
      />
    </>
  );
}

function LeituraEtapa({ pm, etapa, nomeRobo }: { pm: PerguntaMatadora; etapa: (typeof ETAPAS)[number]; nomeRobo: string }) {
  return (
    <div className="v4-cfg__detalhe">
      <section className="v4-cfg__bloco" aria-labelledby="pb-pergunta">
        <h3 id="pb-pergunta" className="v4-t-ui v4-t-strong">
          Pergunta Matadora
        </h3>
        <p className="v4-cfg__pergunta">{pm.pergunta}</p>
      </section>
      <section className="v4-cfg__bloco" aria-labelledby="pb-faixas">
        <h3 id="pb-faixas" className="v4-t-ui v4-t-strong">
          O que fazer com cada nota
        </h3>
        <ul className="v4-cfg__lista">
          {pm.faixas.map((f) => (
            <li key={`${f.de}-${f.ate}`}>
              <span className="v4-tabular v4-t-strong">
                {f.de === f.ate ? f.de : `${f.de} a ${f.ate}`}
              </span>
              : {f.acao}
            </li>
          ))}
        </ul>
      </section>
      {pm.complementares.length > 0 && (
        <section className="v4-cfg__bloco" aria-labelledby="pb-comp">
          <h3 id="pb-comp" className="v4-t-ui v4-t-strong">
            Perguntas complementares
          </h3>
          <ul className="v4-cfg__lista">
            {pm.complementares.map((c) => (
              <li key={c.pergunta}>
                {c.pergunta}
                {c.porque && <span className="v4-t-meta"> · {c.porque}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {pm.objecoes.length > 0 && (
        <section className="v4-cfg__bloco" aria-labelledby="pb-obj">
          <h3 id="pb-obj" className="v4-t-ui v4-t-strong">
            Objeções
          </h3>
          <ul className="v4-cfg__objecoes">
            {pm.objecoes.map((o) => (
              <li key={o.objecao}>
                <p className="v4-t-ui v4-t-strong">“{o.objecao}”</p>
                <p className="v4-cfg__diga">
                  <Icon name="sucesso" />
                  <span>
                    <span className="v4-t-meta">Diga: </span>
                    {o.diga}
                  </span>
                </p>
                {o.nuncaDiga && (
                  <p className="v4-cfg__nunca">
                    <Icon name="erro" />
                    <span>
                      <span className="v4-t-meta">Nunca diga: </span>
                      {o.nuncaDiga}
                    </span>
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      <dl className="v4-fatos">
        <dt>Condição</dt>
        <dd>{pm.condicao || "—"}</dd>
        <dt>Próximo passo</dt>
        <dd>{pm.proximoPasso || "—"}</dd>
        <dt>Quem conduz</dt>
        <dd>
          {quemConduz(etapa, nomeRobo)} · prazo {etapa.prazoTexto} · meta {etapa.meta}%
        </dd>
        <dt>Para o card andar</dt>
        <dd>{etapa.validacao}</dd>
        <dt>Motivos de perda</dt>
        <dd>{etapa.motivosPerda.join(", ")}</dd>
      </dl>
    </div>
  );
}

/** Um item editável da lista (faixa, pergunta, objeção): título curto, botão de tirar e os campos empilhados. */
function ItemLista({ titulo, aoTirar, children }: { titulo: string; aoTirar: () => void; children: ReactNode }) {
  return (
    <div className="v4-cfg__item">
      <div className="v4-cfg__item-topo">
        <span className="v4-t-meta">{titulo}</span>
        <IconButton size="sm" icon="lixeira" label={`Tirar ${titulo.toLowerCase()}`} onClick={aoTirar} />
      </div>
      {children}
    </div>
  );
}

function FormularioEtapa({ form, erros, mudar }: { form: FormEtapa; erros: Record<string, string>; mudar: (f: (x: FormEtapa) => FormEtapa, campo?: string) => void }) {
  const lista = <K extends "faixas" | "complementares" | "objecoes">(k: K, i: number, campo: keyof FormEtapa[K][number], v: string) =>
    mudar((x) => ({ ...x, [k]: x[k].map((item, j) => (j === i ? { ...item, [campo]: v } : item)) }), `${k}.${i}.${String(campo)}`);
  const tirar = (k: "faixas" | "complementares" | "objecoes", i: number) => mudar((x) => ({ ...x, [k]: (x[k] as unknown[]).filter((_, j) => j !== i) }));
  return (
    <>
      <Textarea label="Pergunta Matadora" required rows={3} value={form.pergunta} error={erros.pergunta} onChange={(e) => mudar((x) => ({ ...x, pergunta: e.target.value }), "pergunta")} />
      <fieldset className="v4-form__grupo">
        <legend>O que fazer com cada nota</legend>
        {erros.faixas && <p className="v4-t-meta v4-cfg__erro">{erros.faixas}</p>}
        {form.faixas.map((f, i) => (
          <ItemLista key={i} titulo={`Faixa ${i + 1}`} aoTirar={() => tirar("faixas", i)}>
            <div className="v4-cfg__notas">
              <Input label="Nota de" inputMode="numeric" maxLength={2} value={f.de} error={erros[`faixas.${i}.de`]} onChange={(e) => lista("faixas", i, "de", e.target.value)} />
              <Input label="até" inputMode="numeric" maxLength={2} value={f.ate} error={erros[`faixas.${i}.ate`]} onChange={(e) => lista("faixas", i, "ate", e.target.value)} />
            </div>
            <Textarea label="O que fazer" rows={2} value={f.acao} error={erros[`faixas.${i}.acao`]} onChange={(e) => lista("faixas", i, "acao", e.target.value)} />
          </ItemLista>
        ))}
        <Button size="sm" variant="ghost" icon="mais_" onClick={() => mudar((x) => ({ ...x, faixas: [...x.faixas, { de: "", ate: "", acao: "" }] }))}>
          Incluir faixa
        </Button>
      </fieldset>
      <fieldset className="v4-form__grupo">
        <legend>Perguntas complementares</legend>
        {form.complementares.map((c, i) => (
          <ItemLista key={i} titulo={`Pergunta ${i + 1}`} aoTirar={() => tirar("complementares", i)}>
            <Textarea label="Pergunta" rows={2} value={c.pergunta} error={erros[`complementares.${i}.pergunta`]} onChange={(e) => lista("complementares", i, "pergunta", e.target.value)} />
            <Input label="Por quê" value={c.porque} onChange={(e) => lista("complementares", i, "porque", e.target.value)} />
          </ItemLista>
        ))}
        <Button size="sm" variant="ghost" icon="mais_" onClick={() => mudar((x) => ({ ...x, complementares: [...x.complementares, { pergunta: "", porque: "" }] }))}>
          Incluir pergunta
        </Button>
      </fieldset>
      <fieldset className="v4-form__grupo">
        <legend>Objeções</legend>
        {form.objecoes.map((o, i) => (
          <ItemLista key={i} titulo={`Objeção ${i + 1}`} aoTirar={() => tirar("objecoes", i)}>
            <Input label="O que o contato diz" value={o.objecao} error={erros[`objecoes.${i}.objecao`]} onChange={(e) => lista("objecoes", i, "objecao", e.target.value)} />
            <Textarea label="Diga" rows={2} value={o.diga} error={erros[`objecoes.${i}.diga`]} onChange={(e) => lista("objecoes", i, "diga", e.target.value)} />
            <Input label="Nunca diga" value={o.nuncaDiga} onChange={(e) => lista("objecoes", i, "nuncaDiga", e.target.value)} />
          </ItemLista>
        ))}
        <Button size="sm" variant="ghost" icon="mais_" onClick={() => mudar((x) => ({ ...x, objecoes: [...x.objecoes, { objecao: "", diga: "", nuncaDiga: "" }] }))}>
          Incluir objeção
        </Button>
      </fieldset>
      <Input label="Condição" value={form.condicao} help="A condição de oferta desta etapa, se houver." onChange={(e) => mudar((x) => ({ ...x, condicao: e.target.value }))} />
      <Input label="Próximo passo" value={form.proximoPasso} onChange={(e) => mudar((x) => ({ ...x, proximoPasso: e.target.value }))} />
    </>
  );
}
