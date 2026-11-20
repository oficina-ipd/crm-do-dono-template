"use client";

import { useMemo, useState } from "react";
import { DaySeparator, Icon, SegmentedControl, type IconeV4 } from "../../ui";
import { horaCurta, rotuloDia } from "../conversas/modelo";
import { agruparPorDia, contarPorFiltro, filtrarHistorico, FILTROS_360, NOTA_DO_FILTRO, ROTULO_FILTRO_360, ROTULO_TIPO_360, type Evento360, type Filtro360, type Tipo360 } from "./historico";

/**
 * Linha do tempo 360 da Ficha (porte do IPD, `linha-360.tsx`): uma lista só com tudo o que a
 * pessoa fez e recebeu, agrupada por dia, com filtro por tipo. Cada linha abre o detalhe embaixo.
 * Aqui tudo já está em memória: sem carregar, sem "Carregar mais", sem erro de fonte.
 */

/** Proposta ainda não tem ícone na v4: o mesmo traço do IPD (1,6 px, grade 24). */
const TRACO_PROPOSTA = "M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM14 3v4h4M9 12h6M9 16h6";
const ICONE: Record<Exclude<Tipo360, "proposta">, IconeV4> = {
  conversa: "conversas",
  ligacao: "telefone",
  email: "email",
  pagamento: "cifrao",
  etapa: "funil",
  tarefa: "tarefas",
  nota: "nota",
  ocorrencia: "ocorrencias",
};

function IconeDoTipo({ tipo }: { tipo: Tipo360 }) {
  if (tipo !== "proposta") return <Icon name={ICONE[tipo]} label={ROTULO_TIPO_360[tipo]} />;
  return (
    <svg className="v4-icon" viewBox="0 0 24 24" role="img" aria-label={ROTULO_TIPO_360[tipo]} focusable="false">
      <path d={TRACO_PROPOSTA} />
    </svg>
  );
}

function LinhaEvento({ e }: { e: Evento360 }) {
  const [aberto, setAberto] = useState(false);
  const idDetalhe = `v4-l360-${e.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  return (
    <li className="v4-l360-evento">
      <button type="button" className="v4-l360-linha" aria-expanded={aberto} aria-controls={idDetalhe} onClick={() => setAberto((v) => !v)}>
        <IconeDoTipo tipo={e.tipo} />
        <span className="v4-l360-titulo">{e.titulo}</span>
        {e.estado && <span className={`v4-l360-estado v4-l360-estado--${e.estado.tom}`}>{e.estado.rotulo}</span>}
        <time className="v4-l360-hora v4-tabular" dateTime={e.quando}>
          {horaCurta(e.quando)}
        </time>
        <Icon name={aberto ? "chevronCima" : "chevronBaixo"} size="sm" />
      </button>
      <div id={idDetalhe} className="v4-l360-detalhe" hidden={!aberto}>
        {e.detalhe.map((l, i) => (
          <p key={i} className="v4-t-ui v4-t-2">
            {l}
          </p>
        ))}
        <p className="v4-t-meta">
          {ROTULO_TIPO_360[e.tipo]} · origem: {e.origem}
        </p>
      </div>
    </li>
  );
}

export function Linha360({ eventos, filtro, agora, aoMudarFiltro }: { eventos: Evento360[]; filtro: Filtro360; agora: string; aoMudarFiltro: (f: Filtro360) => void }) {
  const contagem = useMemo(() => contarPorFiltro(eventos), [eventos]);
  const lista = useMemo(() => filtrarHistorico(eventos, filtro), [eventos, filtro]);
  const dias = useMemo(() => agruparPorDia(lista), [lista]);
  const hoje = new Date(agora);
  const nota = NOTA_DO_FILTRO[filtro];

  return (
    <div className="v4-fi-bloco v4-fi-linha v4-l360">
      <SegmentedControl
        label="Mostrar na linha do tempo"
        value={filtro}
        onChange={(v) => aoMudarFiltro(FILTROS_360.includes(v as Filtro360) ? (v as Filtro360) : "tudo")}
        options={FILTROS_360.map((f) => ({ value: f, label: ROTULO_FILTRO_360[f], count: contagem[f], disabled: f !== "tudo" && contagem[f] === 0 && f !== filtro }))}
      />
      {lista.length === 0 ? (
        <p className="v4-t-ui v4-t-2 v4-l360-vazio">
          {filtro === "tudo" ? "Nada registrado ainda. Conversas, ligações, e-mails, propostas, pagamentos e o que a equipe registrar aparecem aqui." : `Nenhum registro de ${ROTULO_FILTRO_360[filtro].toLowerCase()}.`}
        </p>
      ) : (
        dias.map((d) => {
          const rotulo = rotuloDia(d.eventos[0].quando, hoje);
          return (
            <section key={d.dia} className="v4-l360-dia" aria-label={rotulo}>
              <DaySeparator rotulo={rotulo} />
              <ol className="v4-l360-eventos">
                {d.eventos.map((e) => (
                  <LinhaEvento key={e.id} e={e} />
                ))}
              </ol>
            </section>
          );
        })
      )}
      {lista.length > 0 && (
        <div className="v4-l360-fim">
          <span className="v4-t-meta">Fim do histórico.</span>
          <span className="v4-t-meta v4-tabular">
            {lista.length} {lista.length === 1 ? "registro" : "registros"}
          </span>
        </div>
      )}
      {nota && lista.length > 0 && <p className="v4-t-meta v4-l360-nota">{nota}</p>}
    </div>
  );
}
