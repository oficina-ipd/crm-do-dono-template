"use client";

import { useMemo, useState } from "react";
import { useCRM } from "@/components/crm/provider";
import { dataCurta, dataHora } from "@/domain/rules";
import { usePathname, useRouter, useSearchParams } from "@/crm-grafite/link";
import { Button, ButtonLink, EmptyState, NoResults, Panel, SegmentedControl, SidePanel, Table, Tag } from "../../ui";
import { CabecalhoTela, TelaV4 } from "../base-demais/tela";
import { podeEscrever } from "../equipe/gravar";
import {
  RESULTADO,
  ROTULO_MARCA,
  TERMOMETRO,
  TOM_TERMOMETRO,
  duracaoTexto,
  linhasLigacoes,
  metaLigacoes,
  passaNoFiltroLigacao,
  termometroTexto,
  type FiltroLigacao,
  type LinhaLigacao,
} from "./ligacoes-logica";
import "../../styles/telas/config.css";

/**
 * Ligações (Grafite, rota /pos-call): as ligações registradas, da mais nova para a mais antiga,
 * com resultado, termômetro e resumo. A linha abre o painel com os trechos marcados e os
 * follow-ups; "Nova ligação" abre a discagem rápida.
 */
export function TelaLigacoes() {
  const { estado, operador, discar } = useCRM();
  const pathname = usePathname();
  const sp = useSearchParams();
  const router = useRouter();
  const [filtro, setFiltro] = useState<FiltroLigacao>("todas");
  const todas = useMemo(() => linhasLigacoes(estado), [estado]);
  const linhas = todas.filter((l) => passaNoFiltroLigacao(l, filtro));
  const abertaId = sp.get("l");
  const aberta = abertaId ? todas.find((l) => l.id === abertaId) ?? null : null;
  const escreve = podeEscrever(operador);
  const n = (f: FiltroLigacao) => todas.filter((l) => passaNoFiltroLigacao(l, f)).length;

  return (
    <TelaV4 area="pos-call">
      <CabecalhoTela
        titulo="Ligações"
        meta={metaLigacoes(todas)}
        acoes={
          escreve && (
            <Button variant="primary" icon="telefone" onClick={discar}>
              Nova ligação
            </Button>
          )
        }
      />
      <Panel semRecuo rotulo="Ligações registradas">
        <div className="v4-cfg__filtros">
          <SegmentedControl
            label="Resultado"
            value={filtro}
            onChange={(v) => setFiltro(v as FiltroLigacao)}
            options={[
              { value: "todas", label: "Todas", count: todas.length },
              { value: "atendeu", label: "Atenderam", count: n("atendeu") },
              { value: "nao", label: "Não atenderam", count: n("nao") },
            ]}
          />
        </div>
        <Table
          rotulo="Ligações, da mais nova para a mais antiga"
          linhas={linhas}
          chave={(l) => l.id}
          linkDaLinha={(l) => `${pathname}?l=${encodeURIComponent(l.id)}`}
          colunas={[
            { id: "pessoa", titulo: "Pessoa", celula: (l) => l.contatoNome },
            { id: "quando", titulo: "Quando", celula: (l) => <span className="v4-tabular">{dataHora(l.iniciouEm)}</span> },
            { id: "res", titulo: "Resultado", celula: (l) => <Tag tom={RESULTADO[l.resultado].tom}>{RESULTADO[l.resultado].rotulo}</Tag> },
            { id: "dur", titulo: "Duração", numerica: true, celula: (l) => duracaoTexto(l.duracaoSeg) },
            { id: "termo", titulo: "Termômetro", celula: (l) => termometroTexto(l) },
            { id: "quem", titulo: "Quem ligou", celula: (l) => l.operador },
            {
              id: "resumo",
              titulo: "Resumo",
              cortar: (l) => l.resumo,
              celula: (l) => (l.resumo.trim() ? l.resumo : <span className="v4-t-3">Sem resumo</span>),
            },
          ]}
          vazio={
            todas.length === 0 ? (
              <EmptyState
                nivel={2}
                titulo="Nenhuma ligação ainda"
                texto="Ligue pela ficha da pessoa ou em “Nova ligação”. Ao encerrar, o resumo, o termômetro e os follow-ups ficam aqui e no histórico do contato."
                acoes={
                  escreve && (
                    <Button icon="telefone" onClick={discar}>
                      Nova ligação
                    </Button>
                  )
                }
              />
            ) : (
              <NoResults nivel={2} titulo={filtro === "atendeu" ? "Nenhuma ligação atendida" : "Nenhuma ligação sem atender"} aoLimpar={() => setFiltro("todas")} />
            )
          }
        />
      </Panel>
      <SidePanel open={Boolean(aberta)} onClose={() => router.replace(pathname)} title={aberta ? `Ligação · ${aberta.contatoNome}` : "Ligação"}>
        {aberta && <DetalheLigacao linha={aberta} aoFechar={() => router.replace(pathname)} />}
      </SidePanel>
    </TelaV4>
  );
}

function quandoTexto(q: string): string {
  return /^\d{4}-\d{2}-\d{2}/.test(q) ? dataCurta(q) : q;
}

function DetalheLigacao({ linha, aoFechar }: { linha: LinhaLigacao; aoFechar: () => void }) {
  const { operador, ligar } = useCRM();
  return (
    <div className="v4-cfg__detalhe">
      <dl className="v4-fatos">
        <dt>Quando</dt>
        <dd className="v4-tabular">{dataHora(linha.iniciouEm)}</dd>
        <dt>Resultado</dt>
        <dd>
          <Tag tom={RESULTADO[linha.resultado].tom}>{RESULTADO[linha.resultado].rotulo}</Tag>
        </dd>
        <dt>Duração</dt>
        <dd>{duracaoTexto(linha.duracaoSeg)}</dd>
        <dt>Quem ligou</dt>
        <dd>{linha.operador}</dd>
        <dt>Termômetro</dt>
        <dd>
          <Tag tom={TOM_TERMOMETRO[linha.termometroVendedor]}>{TERMOMETRO[linha.termometroVendedor]}</Tag>
          {linha.resultado === "atendeu" && <span className="v4-t-meta"> · leitura da IA: {TERMOMETRO[linha.termometroIA].toLowerCase()}</span>}
        </dd>
        <dt>Gravação</dt>
        <dd>{linha.avisoGravacaoDado ? "Avisada ao contato" : "Sem aviso, não gravada"}</dd>
      </dl>
      <section className="v4-cfg__bloco" aria-labelledby="lig-resumo">
        <h3 id="lig-resumo" className="v4-t-ui v4-t-strong">
          Resumo
        </h3>
        {linha.resumo.trim() ? <p className="v4-texto-longo">{linha.resumo}</p> : <p className="v4-t-meta">Ninguém escreveu um resumo desta ligação.</p>}
      </section>
      {linha.marcados.length > 0 && (
        <section className="v4-cfg__bloco" aria-labelledby="lig-trechos">
          <h3 id="lig-trechos" className="v4-t-ui v4-t-strong">
            Trechos marcados
          </h3>
          <ol className="v4-cfg__trechos">
            {linha.marcados.map((t, i) => (
              <li key={i} className="v4-cfg__trecho">
                <span className="v4-t-meta">
                  {t.marca ? ROTULO_MARCA[t.marca] : ""} · {t.quem === "vendedor" ? linha.operador : linha.contatoNome} · <span className="v4-tabular">{t.hora}</span>
                </span>
                <span>{t.texto}</span>
              </li>
            ))}
          </ol>
          {linha.totalTrechos > linha.marcados.length && (
            <p className="v4-t-meta">
              {linha.marcados.length} de {linha.totalTrechos} trechos da transcrição têm marca.
            </p>
          )}
        </section>
      )}
      <section className="v4-cfg__bloco" aria-labelledby="lig-follow">
        <h3 id="lig-follow" className="v4-t-ui v4-t-strong">
          Follow-ups
        </h3>
        {linha.followups.length === 0 ? (
          <p className="v4-t-meta">Nenhum follow-up saiu desta ligação.</p>
        ) : (
          <ul className="v4-cfg__lista">
            {linha.followups.map((f, i) => (
              <li key={i}>
                {f.texto} <span className="v4-t-meta">· {quandoTexto(f.quando)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <div className="v4-form__acoes">
        <ButtonLink href={`/contatos/${encodeURIComponent(linha.contatoId)}`}>Abrir ficha</ButtonLink>
        {podeEscrever(operador) && linha.contatoNome !== "Contato removido" && (
          <Button
            icon="telefone"
            onClick={() => {
              // A ligação abre num modal próprio: o painel fecha antes para não ficar por cima.
              aoFechar();
              ligar(linha.contatoId);
            }}
          >
            Ligar de novo
          </Button>
        )}
      </div>
    </div>
  );
}
