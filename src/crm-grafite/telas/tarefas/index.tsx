"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useCRM } from "@/components/crm/provider";
import { categoria } from "@/domain/rules";
import { pessoaPublicaV4, type PessoaBuscaV4 } from "../../busca";
import { useRouter, useSearchParams } from "../../link";
import { useBuscarPessoasV4 } from "../../shell/fonte-busca";
import { Button, ButtonLink, EmptyState, FaixaTopo, NoResults, SearchInput, SegmentedControl, Tag } from "../../ui";
import {
  agruparTarefas,
  atrasada,
  contarSituacoes,
  contarTarefas,
  filtrarTarefas,
  grupoDaTarefa,
  idNovo,
  montarTarefas,
  ORDEM_GRUPOS,
  rotuloOrigem,
  rotuloVencimento,
  ROTULO_GRUPO,
  type GrupoTarefa,
  type Situacao,
  type TarefaLinha,
} from "./logica";
import { NovaTarefa } from "./nova-tarefa";
import "../../styles/telas/tarefas.css";

const VAZIO_GRUPO: Record<GrupoTarefa, string> = {
  atrasadas: "Nada atrasado.",
  hoje: "Nada para hoje.",
  proximas: "Nada agendado para depois de hoje.",
  semData: "Nenhuma tarefa sem data.",
  feitas: "Nenhuma tarefa feita.",
};

const AJUDA_GRUPO: Record<GrupoTarefa, string> = {
  atrasadas: "A data já passou. A mais antiga primeiro.",
  hoje: "Vencem até o fim do dia.",
  proximas: "Depois de hoje, pela data.",
  semData: "Sem data marcada. As mais novas primeiro.",
  feitas: "Concluídas. Reabrir devolve a tarefa para a lista.",
};

/** Grupos que aparecem mesmo vazios (dizem "nada atrasado"); os outros só com tarefa. */
const SEMPRE: Record<Situacao, GrupoTarefa[]> = {
  abertas: ["atrasadas", "hoje", "proximas"],
  feitas: ["feitas"],
  todas: ["atrasadas", "hoje", "proximas"],
};

type Fixa = { situacao: Situacao; grupo: GrupoTarefa };

function LinhaTarefa({
  t,
  agora,
  nomeRobo,
  podeEscrever,
  aoAlternar,
}: {
  t: TarefaLinha;
  agora: Date;
  nomeRobo: string;
  podeEscrever: boolean;
  aoAlternar: () => Promise<unknown>;
}) {
  const vencida = atrasada(t, agora);
  const origem = rotuloOrigem(t.origem, nomeRobo);
  return (
    <li className="v4-tarefas__li">
      <div className={["v4-tarefa", t.feita ? "is-feita" : ""].filter(Boolean).join(" ")} id={`tarefa-${t.id}`} tabIndex={-1}>
        <div className="v4-tarefa__corpo">
          <p className="v4-tarefa__titulo">{t.titulo}</p>
          <p className="v4-tarefa__meta">
            <span>{t.contato?.nome ?? "Pessoa não encontrada"}</span>
            {origem && <span>{origem}</span>}
          </p>
        </div>
        <div className="v4-tarefa__quando">
          {t.feita ? (
            <Tag tom="sucesso" icon="sucesso">
              Feita
            </Tag>
          ) : (
            <Tag tom={vencida ? "erro" : "neutro"} icon={vencida ? "alerta" : "relogio"}>
              {rotuloVencimento(t.venceEm, agora)}
            </Tag>
          )}
        </div>
        <div className="v4-tarefa__acoes">
          {podeEscrever && (
            <Button variant={t.feita ? "ghost" : "secondary"} icon={t.feita ? "devolver" : "check"} busyLabel={t.feita ? "Reabrindo" : "Concluindo"} onClick={aoAlternar}>
              {t.feita ? "Reabrir" : "Concluir"}
              <span className="v4-sr"> {t.titulo}</span>
            </Button>
          )}
          {t.contato && (
            <ButtonLink href={`/contatos/${encodeURIComponent(t.contato.id)}`} variant="ghost" icon="pessoas">
              Abrir ficha<span className="v4-sr"> de {t.contato.nome}</span>
            </ButtonLink>
          )}
        </div>
      </div>
    </li>
  );
}

/**
 * Tarefas: atrasadas, hoje, próximas e sem data; concluir e reabrir na própria linha; criar
 * tarefa ligada a uma pessoa no lugar. Busca e situação na faixa do topo. Tudo pelo estado real
 * do CRM (`criarTarefa`, `concluirTarefa`); quem tem papel de leitura só lê.
 */
export function TelaTarefas() {
  const { estado, agora: agoraIso, operador, despachar, contato } = useCRM();
  const agora = useMemo(() => new Date(agoraIso), [agoraIso]);
  const podeEscrever = operador?.papel !== "leitura";
  const nomeRobo = estado.config.nomeRobo || "Cláudio";
  const buscarPessoas = useBuscarPessoasV4();
  const params = useSearchParams();
  const router = useRouter();

  const [situacao, setSituacaoBruta] = useState<Situacao>("abertas");
  const [busca, setBusca] = useState("");
  const [nova, setNova] = useState(false);
  const [pessoaInicial, setPessoaInicial] = useState<PessoaBuscaV4 | null>(null);
  // concluídas ou reabertas nesta vista: ficam onde estavam até a pessoa trocar o filtro
  const [fixas, setFixas] = useState<ReadonlyMap<string, Fixa>>(() => new Map());
  // tarefa recém-criada: o foco vai para a linha dela assim que ela aparece na lista
  const [focar, setFocar] = useState<string | null>(null);
  const botaoNova = useRef<HTMLButtonElement>(null);

  // #/trabalho?nova=1[&contato=ID]: abre "Nova tarefa" (com a pessoa, se veio da ficha) e limpa o endereço
  const pedidoNova = params.get("nova") === "1";
  const pedidoContato = params.get("contato");
  useEffect(() => {
    if (!pedidoNova || !podeEscrever) return;
    const c = pedidoContato ? contato(pedidoContato) : null;
    setPessoaInicial(
      c ? pessoaPublicaV4({ id: c.id, nome: c.nome, empresa: c.empresa, whatsapp: c.telefone, email: c.email, tipo: categoria(c.oportunidades) }) : null,
    );
    setNova(true);
    router.replace("/trabalho");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoNova, pedidoContato, podeEscrever]);

  const setSituacao = (s: Situacao) => {
    setSituacaoBruta(s);
    setFixas(new Map());
  };

  const todas = useMemo(() => montarTarefas(estado), [estado]);
  const contas = useMemo(() => contarSituacoes(todas, busca), [todas, busca]);
  const situacaoFixa = useMemo(() => new Map([...fixas].map(([id, f]) => [id, f.situacao])), [fixas]);
  const grupoFixo = useMemo(() => new Map([...fixas].map(([id, f]) => [id, f.grupo])), [fixas]);
  const visiveis = useMemo(() => filtrarTarefas(todas, { situacao, busca }, situacaoFixa), [todas, situacao, busca, situacaoFixa]);
  const grupos = useMemo(() => agruparTarefas(visiveis, agora, grupoFixo), [visiveis, agora, grupoFixo]);
  const abertas = todas.filter((t) => !t.feita);
  const nAtrasadas = abertas.filter((t) => atrasada(t, agora)).length;

  useEffect(() => {
    if (!focar) return;
    const el = document.getElementById(`tarefa-${focar}`);
    if (!el) return;
    el.focus();
    setFocar(null);
  }, [focar, visiveis]);

  const alternar = useCallback(
    async (t: TarefaLinha) => {
      const feita = !t.feita;
      setFixas((m) => (m.has(t.id) ? m : new Map(m).set(t.id, { situacao: t.feita ? "feitas" : "abertas", grupo: grupoDaTarefa(t, agora) })));
      return despachar({ tipo: "concluirTarefa", tarefaId: t.id, feita }, feita ? `Tarefa concluída: ${t.titulo}` : `Tarefa reaberta: ${t.titulo}`);
    },
    [despachar, agora],
  );

  const fecharNova = useCallback(() => {
    setNova(false);
    setPessoaInicial(null);
    window.setTimeout(() => botaoNova.current?.focus(), 0);
  }, []);

  const criar = useCallback(
    async (d: { contatoId: string; texto: string; venceEm: string | null }) => {
      const antes = estado.tarefas;
      const r = await despachar({ tipo: "criarTarefa", contatoId: d.contatoId, texto: d.texto, venceEm: d.venceEm, origem: "manual" }, `Tarefa criada: ${d.texto}`);
      if (!r) return false;
      // a tarefa nova aparece: volta para as abertas sem busca, e o foco vai para ela
      if (situacao === "feitas") {
        setSituacaoBruta("abertas");
        setFixas(new Map());
      }
      setBusca("");
      setFocar(idNovo(antes, r.tarefas));
      setNova(false);
      setPessoaInicial(null);
      return true;
    },
    [despachar, estado.tarefas, situacao],
  );

  const mostrar = ORDEM_GRUPOS.filter((g) => SEMPRE[situacao].includes(g) || grupos[g].length > 0);
  const semNenhuma = todas.length === 0;
  const vazio = visiveis.length === 0;

  let corpo: ReactNode;
  if (semNenhuma) {
    corpo = (
      <EmptyState
        nivel={2}
        titulo="Nenhuma tarefa ainda"
        texto="Tarefas criadas aqui, na ficha da pessoa ou depois de uma ligação aparecem nesta lista, separadas em atrasadas, hoje, próximas e sem data."
        acoes={
          podeEscrever && !nova ? (
            <Button variant="secondary" icon="mais_" onClick={() => setNova(true)}>
              Criar tarefa
            </Button>
          ) : undefined
        }
      />
    );
  } else if (vazio && busca.trim()) {
    corpo = (
      <NoResults
        nivel={2}
        termo={busca.trim()}
        texto={situacao === "todas" ? "Nenhuma tarefa tem esse texto, essa pessoa ou essa origem." : `Nenhuma tarefa ${situacao === "abertas" ? "aberta" : "feita"} tem esse texto, essa pessoa ou essa origem.`}
        aoLimpar={() => {
          setBusca("");
          setSituacao("abertas");
        }}
      />
    );
  } else if (vazio && situacao === "abertas") {
    corpo = (
      <EmptyState
        nivel={2}
        titulo="Nenhuma tarefa aberta"
        texto="Tudo o que estava na lista foi feito. As concluídas continuam em Feitas."
        acoes={
          <Button variant="secondary" onClick={() => setSituacao("feitas")}>
            Ver feitas
          </Button>
        }
      />
    );
  } else if (vazio && situacao === "feitas") {
    corpo = (
      <EmptyState
        nivel={2}
        titulo="Nenhuma tarefa feita ainda"
        texto="Ao concluir uma tarefa, ela sai das abertas e fica aqui; dá para reabrir."
        acoes={
          <Button variant="secondary" onClick={() => setSituacao("abertas")}>
            Ver abertas
          </Button>
        }
      />
    );
  } else {
    corpo = mostrar.map((g) => {
      const itens = grupos[g];
      return (
        <section key={g} className="v4-tarefas__grupo" aria-labelledby={`grupo-${g}`}>
          <div className="v4-tarefas__grupo-head">
            <h2 id={`grupo-${g}`} className="v4-t-section">
              {ROTULO_GRUPO[g]}
            </h2>
            <span className={["v4-tarefas__n", g === "atrasadas" && itens.length > 0 ? "is-atrasada" : ""].filter(Boolean).join(" ")}>{contarTarefas(itens.length)}</span>
          </div>
          {itens.length > 0 ? (
            <>
              <p className="v4-tarefas__ajuda">{AJUDA_GRUPO[g]}</p>
              <ul className="v4-tarefas__lista">
                {itens.map((t) => (
                  <LinhaTarefa key={t.id} t={t} agora={agora} nomeRobo={nomeRobo} podeEscrever={podeEscrever} aoAlternar={() => alternar(t)} />
                ))}
              </ul>
            </>
          ) : (
            <p className="v4-tarefas__vazio">{VAZIO_GRUPO[g]}</p>
          )}
        </section>
      );
    });
  }

  const contagem = `${abertas.length === 1 ? "1 aberta" : `${abertas.length} abertas`}${nAtrasadas > 0 ? ` · ${nAtrasadas === 1 ? "1 atrasada" : `${nAtrasadas} atrasadas`}` : ""}`;

  return (
    <div data-v4-tela="tarefas" className="v4-tela v4-tarefas">
      <FaixaTopo titulo="Tarefas" contagem={<span aria-live="polite">{contagem}</span>}>
        <SearchInput label="Buscar tarefas" placeholder="Buscar tarefa ou pessoa" value={busca} onChange={setBusca} atalho="/" />
        <SegmentedControl
          label="Situação das tarefas"
          value={situacao}
          onChange={(v) => setSituacao(v as Situacao)}
          options={[
            { value: "abertas", label: "Abertas", count: contas.abertas },
            { value: "feitas", label: "Feitas", count: contas.feitas },
            { value: "todas", label: "Todas", count: contas.todas },
          ]}
        />
        {podeEscrever && (
          <Button ref={botaoNova} variant="primary" icon="mais_" onClick={() => setNova(true)} disabled={nova} aria-expanded={nova}>
            Nova tarefa
          </Button>
        )}
      </FaixaTopo>
      <div className="v4-tarefas__corpo">
        {nova && podeEscrever && (
          <NovaTarefa key={pessoaInicial?.id ?? "nova"} agora={agora} buscarPessoas={buscarPessoas} pessoaInicial={pessoaInicial} criar={criar} aoCancelar={fecharNova} />
        )}
        {corpo}
      </div>
    </div>
  );
}
