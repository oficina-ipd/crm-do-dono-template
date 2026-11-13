"use client";

import { useMemo, useState } from "react";
import { useCRM } from "@/components/crm/provider";
import { dataHora } from "@/domain/rules";
import type { ContatoCompleto } from "@/domain/types";
import { Icon, Panel, Tooltip } from "../../ui";
import { haQuanto } from "../conversas/modelo";
import { REGRA_ENGAJAMENTO, resumoComportamento, ROTULO_ENGAJAMENTO, textoHorario, textoSemResposta, textoTempoResposta, textoUltimos30, type Sinal } from "./historico";

/**
 * Resumo de comportamento no topo da lateral da Ficha (porte do IPD, `resumo-360.tsx`): sinal de
 * engajamento com a regra à vista (passar o mouse, focar ou tocar), último contato nosso, última
 * atividade da pessoa e, do WhatsApp, quando ela costuma escrever, quanto leva para responder e
 * o volume dos últimos 30 dias. O que não tem dado diz isso com palavras; nunca vira zero.
 * E-mail aberto e portal (do IPD) não entram: o CRM do dono não mede isso.
 */

function Quando({ s, vazio, agora }: { s: Sinal | null; vazio: string; agora: Date }) {
  if (!s) return <span className="v4-t-2">{vazio}</span>;
  return (
    <>
      <time dateTime={s.quando} title={dataHora(s.quando)}>
        {haQuanto(s.quando, agora)}
      </time>
      <span className="v4-t-2"> · {s.oQue}</span>
    </>
  );
}

export function ResumoComportamento({ c }: { c: ContatoCompleto }) {
  const { agora } = useCRM();
  const [regra, setRegra] = useState(false);
  const r = useMemo(() => resumoComportamento(c, agora), [c, agora]);
  const hoje = new Date(agora);
  const nivel = r.engajamento.nivel;
  const idRegra = `v4-r360-regra-${c.id}`;
  const semResposta = textoSemResposta(r);

  return (
    <Panel titulo="Comportamento">
      <div className="v4-r360-sinal">
        <Tooltip
          content={
            <span className="v4-r360-dica">
              <span>{r.engajamento.motivo}</span>
              {REGRA_ENGAJAMENTO.slice(0, 3).map((l) => (
                <span key={l}>{l}</span>
              ))}
            </span>
          }
        >
          <button type="button" className="v4-r360-sinal__botao" aria-expanded={regra} aria-controls={idRegra} onClick={() => setRegra((v) => !v)}>
            <span className={`v4-r360-pontos v4-r360-pontos--${nivel}`} aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className="v4-t-ui v4-t-medium">{ROTULO_ENGAJAMENTO[nivel]}</span>
            <Icon name="info" size="sm" />
            <span className="v4-sr">Sinal de engajamento. Mostrar como é calculado.</span>
          </button>
        </Tooltip>
        <div id={idRegra} className="v4-r360-regra v4-t-meta" hidden={!regra}>
          <p>{r.engajamento.motivo}</p>
          <ul>
            {REGRA_ENGAJAMENTO.map((l) => (
              <li key={l}>{l}</li>
            ))}
            <li>Horário e tempo de resposta saem das mensagens dela no WhatsApp; o tempo é o valor do meio entre as respostas.</li>
          </ul>
        </div>
      </div>
      <dl className="v4-fi-dl v4-r360-dl">
        <div>
          <dt>Último contato nosso</dt>
          <dd>
            <Quando s={r.ultimoContatoNosso} vazio="sem contato ainda" agora={hoje} />
          </dd>
        </div>
        <div>
          <dt>Última atividade da pessoa</dt>
          <dd>
            <Quando s={r.ultimaAtividade} vazio="sem atividade ainda" agora={hoje} />
          </dd>
        </div>
        <div>
          <dt>Costuma escrever</dt>
          <dd className={r.horario.tipo === "faixa" ? undefined : "v4-t-2"}>{textoHorario(r.horario)}</dd>
        </div>
        <div>
          <dt>Tempo para responder</dt>
          <dd className={r.tempo.tipo === "medido" ? "v4-tabular" : "v4-t-2"}>{textoTempoResposta(r.tempo)}</dd>
        </div>
        <div>
          <dt>WhatsApp em 30 dias</dt>
          <dd className={r.ultimos30.dela + r.ultimos30.nossas > 0 ? "v4-tabular" : "v4-t-2"}>{textoUltimos30(r.ultimos30)}</dd>
        </div>
        {semResposta && (
          <div>
            <dt>Sem resposta</dt>
            <dd className="v4-tabular">{semResposta}</dd>
          </div>
        )}
      </dl>
    </Panel>
  );
}
