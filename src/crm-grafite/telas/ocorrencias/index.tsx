"use client";

import { useMemo, useState } from "react";
import { useCRM } from "@/components/crm/provider";
import { dataHora, horaDe } from "@/domain/rules";
import Link, { usePathname, useRouter, useSearchParams } from "@/crm-grafite/link";
import { Button, EmptyState, Icon, Input, NoResults, Panel, SegmentedControl, SidePanel, Table, Tag, Textarea } from "../../ui";
import { CabecalhoTela, EstadoSalvar, TelaV4, useEnvio } from "../base-demais/tela";
import { podeEscrever } from "../equipe/gravar";
import { useGravar } from "../equipe/use-gravar";
import {
  ROTULO_TIPO,
  SITUACAO,
  contarPorFiltro,
  diaBr,
  diaLocal,
  linhasOcorrencias,
  metaOcorrencias,
  nomeArquivoResumo,
  nomeDoAutorTrecho,
  passaNoFiltro,
  resumoEmTexto,
  validarDia,
  type FiltroOcorrencia,
  type LinhaOcorrencia,
} from "./ocorrencias-logica";
import "../../styles/telas/config.css";

function baixarTexto(nome: string, texto: string) {
  const url = URL.createObjectURL(new Blob([texto], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Ocorrências (Grafite): o que a equipe marcou nas conversas do robô, em tabela, com o resumo
 * para baixar. A linha abre o painel com os trechos, a resposta do dono e a situação.
 */
export function TelaOcorrencias() {
  const { estado } = useCRM();
  const pathname = usePathname();
  const sp = useSearchParams();
  const router = useRouter();
  const robo = estado.config.nomeRobo;
  const hoje = diaLocal(new Date().toISOString());
  const [filtro, setFiltro] = useState<FiltroOcorrencia>("abertas");
  const [dia, setDia] = useState("");
  const [diaCampo, setDiaCampo] = useState("");
  const [erroDia, setErroDia] = useState<string | null>(null);

  const todas = useMemo(() => linhasOcorrencias(estado), [estado]);
  const linhas = todas.filter((l) => passaNoFiltro(l, filtro, dia));
  const contagem = contarPorFiltro(todas, dia);
  const abertaId = sp.get("o");
  const aberta = abertaId ? todas.find((l) => l.id === abertaId) ?? null : null;

  function escolherDia(v: string) {
    setDiaCampo(v);
    const erro = validarDia(v, hoje);
    setErroDia(erro);
    if (!erro) setDia(v);
  }
  function limpar() {
    setFiltro("todas");
    setDia("");
    setDiaCampo("");
    setErroDia(null);
  }

  const titulo = dia ? `Ocorrências de ${diaBr(dia)}` : "Ocorrências";
  return (
    <TelaV4 area="ocorrencias">
      <CabecalhoTela
        titulo="Ocorrências"
        meta={todas.length === 0 ? "Nenhuma marcação ainda" : `${metaOcorrencias(linhas)}${dia ? ` em ${diaBr(dia)}` : ""}`}
        acoes={
          <Button variant="primary" icon="nota" disabled={linhas.length === 0} onClick={() => baixarTexto(nomeArquivoResumo(dia, hoje), resumoEmTexto(linhas, titulo, robo))}>
            Baixar resumo
          </Button>
        }
      />
      <p className="v4-nota">
        <Icon name="info" />
        <span>Marcar uma ocorrência não muda o que {robo} faz: leia os trechos, ajuste o playbook ou os modelos de mensagem e marque como resolvida.</span>
      </p>
      <Panel semRecuo rotulo="Ocorrências marcadas">
        <div className="v4-cfg__filtros">
          <SegmentedControl
            label="Situação"
            value={filtro}
            onChange={(v) => setFiltro(v as FiltroOcorrencia)}
            options={[
              { value: "abertas", label: "Abertas", count: contagem.abertas },
              { value: "resolvidas", label: "Resolvidas", count: contagem.resolvidas },
              { value: "todas", label: "Todas", count: contagem.todas },
            ]}
          />
          <div className="v4-cfg__dia">
            <Input label="Dia" type="date" max={hoje} value={diaCampo} error={erroDia ?? undefined} onChange={(e) => escolherDia(e.target.value)} />
            {dia && (
              <Button variant="ghost" onClick={() => escolherDia("")}>
                Todos os dias
              </Button>
            )}
          </div>
        </div>
        <Table
          rotulo={titulo}
          linhas={linhas}
          chave={(l) => l.id}
          linkDaLinha={(l) => `${pathname}?o=${encodeURIComponent(l.id)}`}
          colunas={[
            { id: "c", titulo: "Contato", celula: (l) => l.contatoNome },
            { id: "q", titulo: "Quando", celula: (l) => <span className="v4-tabular">{dataHora(l.em)}</span> },
            {
              id: "t",
              titulo: "Tipo",
              celula: (l) => (
                <Tag tom={l.tipo === "problema" ? "atencao" : "info"} icon={l.tipo === "problema" ? "alerta" : "info"}>
                  {ROTULO_TIPO[l.tipo]}
                </Tag>
              ),
            },
            { id: "s", titulo: "Situação", celula: (l) => <Tag tom={SITUACAO[l.status].tom}>{SITUACAO[l.status].rotulo}</Tag> },
            { id: "m", titulo: `O que ${robo} disse`, quebrar: true, celula: (l) => (l.trecho ? <span className="v4-ocor__trecho">{l.trecho}</span> : <span className="v4-t-3">Sem trecho marcado</span>) },
            { id: "p", titulo: "Por quê", quebrar: true, celula: (l) => <span className="v4-ocor__trecho">{l.descricao}</span> },
            { id: "o", titulo: "Quem marcou", celula: (l) => l.quem },
          ]}
          vazio={
            todas.length === 0 ? (
              <EmptyState
                nivel={2}
                titulo="Nenhuma ocorrência ainda"
                texto={`Quando alguém da equipe marcar um problema ou uma melhoria numa conversa do ${robo}, a marcação aparece aqui com os trechos.`}
              />
            ) : (
              <NoResults
                nivel={2}
                titulo={dia ? `Nenhuma ocorrência ${filtro === "todas" ? "" : filtro === "abertas" ? "aberta " : "resolvida "}em ${diaBr(dia)}` : filtro === "abertas" ? "Nenhuma ocorrência aberta" : "Nenhuma ocorrência resolvida"}
                texto={filtro === "abertas" && !dia ? "Tudo o que foi marcado já foi resolvido." : undefined}
                aoLimpar={limpar}
              />
            )
          }
        />
      </Panel>
      <SidePanel
        open={Boolean(aberta)}
        onClose={() => router.replace(pathname)}
        title={aberta ? `Ocorrência · ${aberta.contatoNome}` : "Ocorrência"}
      >
        {aberta && <DetalheOcorrencia key={aberta.id} linha={aberta} />}
      </SidePanel>
    </TelaV4>
  );
}

/** Painel da ocorrência: trechos, motivo, a resposta do dono e a mudança de situação. */
function DetalheOcorrencia({ linha }: { linha: LinhaOcorrencia }) {
  const { estado, operador } = useCRM();
  const gravar = useGravar();
  const { estado: envio, enviar, editar } = useEnvio();
  const [resposta, setResposta] = useState(linha.resposta ?? "");
  const oc = estado.ocorrencias.find((o) => o.id === linha.id);
  const escreve = podeEscrever(operador);
  if (!oc) return null;

  function mudar(status: "aberta" | "em análise" | "resolvida", aviso: string) {
    return enviar(async () => {
      const r = await gravar({ tipo: "atualizarOcorrencia", ocorrenciaId: linha.id, status, resposta: resposta.trim() || undefined }, aviso);
      return r.ok ? { ok: true } : r;
    });
  }

  return (
    <div className="v4-cfg__detalhe">
      <dl className="v4-fatos">
        <dt>Tipo</dt>
        <dd>{ROTULO_TIPO[linha.tipo]}</dd>
        <dt>Situação</dt>
        <dd>
          <Tag tom={SITUACAO[linha.status].tom}>{SITUACAO[linha.status].rotulo}</Tag>
        </dd>
        <dt>Contato</dt>
        <dd>
          <Link className="v4-link" href={`/contatos/${encodeURIComponent(linha.contatoId)}`}>
            {linha.contatoNome}
          </Link>
        </dd>
        <dt>Quando</dt>
        <dd className="v4-tabular">{dataHora(linha.em)}</dd>
        <dt>Quem marcou</dt>
        <dd>{linha.quem}</dd>
      </dl>
      <section className="v4-cfg__bloco" aria-labelledby="oc-porque">
        <h3 id="oc-porque" className="v4-t-ui v4-t-strong">
          Por quê
        </h3>
        <p className="v4-texto-longo">{oc.descricao}</p>
      </section>
      {oc.trechos.length > 0 && (
        <section className="v4-cfg__bloco" aria-labelledby="oc-trechos">
          <h3 id="oc-trechos" className="v4-t-ui v4-t-strong">
            Trechos marcados
          </h3>
          <ol className="v4-cfg__trechos">
            {oc.trechos.map((t, i) => (
              <li key={i} className="v4-cfg__trecho">
                <span className="v4-t-meta">
                  {nomeDoAutorTrecho(t.autor, linha.contatoNome, estado.config.nomeRobo)} · <span className="v4-tabular">{horaDe(t.em)}</span>
                </span>
                <span>{t.texto}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
      {escreve ? (
        <div className="v4-form">
          <Textarea
            label="O que foi ajustado"
            rows={3}
            maxLength={1000}
            value={resposta}
            help="Fica registrado na ocorrência. Opcional."
            onChange={(e) => {
              setResposta(e.target.value);
              editar();
            }}
          />
          <div className="v4-form__acoes">
            {linha.status === "resolvida" ? (
              <Button onClick={() => mudar("aberta", "Ocorrência reaberta.")}>Reabrir</Button>
            ) : (
              <>
                <Button variant="primary" onClick={() => mudar("resolvida", "Ocorrência resolvida.")}>
                  Marcar como resolvida
                </Button>
                {linha.status === "aberta" && <Button onClick={() => mudar("em análise", "Ocorrência em análise.")}>Marcar em análise</Button>}
              </>
            )}
            <EstadoSalvar estado={envio} />
          </div>
        </div>
      ) : (
        linha.resposta && (
          <section className="v4-cfg__bloco" aria-labelledby="oc-resp">
            <h3 id="oc-resp" className="v4-t-ui v4-t-strong">
              O que foi ajustado
            </h3>
            <p className="v4-texto-longo">{linha.resposta}</p>
          </section>
        )
      )}
    </div>
  );
}
