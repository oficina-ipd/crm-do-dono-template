"use client";

import { useState } from "react";
import { useCRM } from "@/components/crm/provider";
import { dataHora, formatarTempo } from "@/domain/rules";
import type { ContatoCompleto } from "@/domain/types";
import { Button, ButtonLink, Tag } from "../../ui";
import { FormNota, FormTarefa, MenuMoverEtapa, RevelarDado } from "./acoes";
import { etapaDoContato, haQuanto, mascararTelefone, motivoDoHandoff, nomeDoOperador, proximaTarefa, type MotivoHandoff } from "./modelo";

/** "Por que pediu uma pessoa": o motivo que o robô registrou, a nota, o prazo e o que o contato escreveu. */
export function PorQuePediu({ h, nomeRobo }: { h: MotivoHandoff; nomeRobo: string }) {
  return (
    <>
      {h.motivo ? <p className="v4-t-ui">{h.motivo.charAt(0).toUpperCase() + h.motivo.slice(1)}.</p> : <p className="v4-t-ui v4-t-2">O {nomeRobo} não registrou o motivo.</p>}
      {h.ultimaDoContato && (
        <p className="v4-t-ui">
          <span className="v4-t-2">Escreveu por último: </span>“{h.ultimaDoContato.length > 160 ? `${h.ultimaDoContato.slice(0, 160)}…` : h.ultimaDoContato}”
        </p>
      )}
      <div className="v4-conv__line">
        {h.estourou && (
          <Tag tom="atencao" icon="relogio">
            Prazo vencido
          </Tag>
        )}
        {h.minutos != null && (
          <span className="v4-t-meta">
            Pediu há {formatarTempo(h.minutos)}
            {h.prazoMin > 0 ? ` · prazo de ${formatarTempo(h.prazoMin)}` : ""}
          </span>
        )}
        {h.nota != null && <span className="v4-t-meta v4-tabular">Nota que se deu: {h.nota} de 10</span>}
      </div>
    </>
  );
}

/**
 * Contexto da conversa aberta (coluna de 320 px; painel lateral abaixo de 1200 px): por que pediu
 * uma pessoa, etapa com "Mover para…", próxima tarefa, telefone mascarado, notas e a ficha.
 */
export function ContextoTpl({ c, hrefFicha, prefixo }: { c: ContatoCompleto; hrefFicha: string; prefixo: string }) {
  const { estado, agora, operador } = useCRM();
  const [criandoTarefa, setCriandoTarefa] = useState(false);
  const [criandoNota, setCriandoNota] = useState(false);
  const [todasNotas, setTodasNotas] = useState(false);
  const soLeitura = !operador || operador.papel === "leitura";
  const nomeRobo = estado.config.nomeRobo;
  const h = motivoDoHandoff(c, agora);
  const etapa = etapaDoContato(c.oportunidades);
  const { tarefa, abertas } = proximaTarefa(c.tarefas);
  const notas = [...c.notas].reverse();
  const notasVisiveis = todasNotas ? notas : notas.slice(0, 3);

  return (
    <div className="v4-conv__ctx-body">
      {h && (
        <section className="v4-conv__sec" aria-labelledby={`${prefixo}-motivo`}>
          <h3 id={`${prefixo}-motivo`} className="v4-conv__sec-title">
            Por que pediu uma pessoa
          </h3>
          <PorQuePediu h={h} nomeRobo={nomeRobo} />
        </section>
      )}

      <section className="v4-conv__sec" aria-labelledby={`${prefixo}-etapa`}>
        <h3 id={`${prefixo}-etapa`} className="v4-conv__sec-title">
          Etapa do funil
        </h3>
        {etapa ? (
          <>
            <div className="v4-conv__line">
              <Tag tom={etapa.perdida ? "erro" : "etapa"}>{etapa.perdida ? `Perdida em ${etapa.nome}` : etapa.nome}</Tag>
              {!etapa.perdida && <span className="v4-t-meta">{haQuanto(etapa.o.entrouNaEtapaEm, new Date(agora))}</span>}
            </div>
            {etapa.perdida && etapa.o.motivoPerda && <p className="v4-t-meta">Motivo: {etapa.o.motivoPerda}</p>}
            {!soLeitura && <MenuMoverEtapa oportunidade={etapa.o} />}
            {!etapa.perdida && etapa.o.proximoPasso && (
              <p className="v4-t-ui">
                <span className="v4-t-2">Próximo passo: </span>
                {etapa.o.proximoPasso}
              </p>
            )}
          </>
        ) : (
          <p className="v4-t-ui v4-t-2">Sem oportunidade aberta.</p>
        )}
      </section>

      <section className="v4-conv__sec" aria-labelledby={`${prefixo}-tarefa`}>
        <h3 id={`${prefixo}-tarefa`} className="v4-conv__sec-title">
          Próxima tarefa
        </h3>
        {tarefa ? (
          <>
            <p className="v4-t-ui">{tarefa.texto}</p>
            <p className="v4-t-meta">
              {tarefa.venceEm ? `Vence ${dataHora(tarefa.venceEm)}` : "Sem data"}
              {abertas > 1 ? ` · mais ${abertas - 1} aberta${abertas - 1 === 1 ? "" : "s"}` : ""}
            </p>
          </>
        ) : (
          <p className="v4-t-ui v4-t-2">Nenhuma tarefa aberta.</p>
        )}
        {!soLeitura &&
          (criandoTarefa ? (
            <FormTarefa contatoId={c.id} aoCancelar={() => setCriandoTarefa(false)} aoCriar={() => setCriandoTarefa(false)} />
          ) : (
            <div>
              <Button size="sm" variant="ghost" icon="mais_" onClick={() => setCriandoTarefa(true)}>
                Criar tarefa
              </Button>
            </div>
          ))}
      </section>

      <section className="v4-conv__sec" aria-labelledby={`${prefixo}-contato`}>
        <h3 id={`${prefixo}-contato`} className="v4-conv__sec-title">
          Contato
        </h3>
        {c.telefone.replace(/\D/g, "") ? (
          <RevelarDado key={c.id} rotulo="WhatsApp" mascarado={mascararTelefone(c.telefone)} completo={c.telefone} numero />
        ) : (
          <p className="v4-t-ui v4-t-2">Sem WhatsApp cadastrado.</p>
        )}
        {c.empresa && <p className="v4-t-ui">{c.empresa}</p>}
      </section>

      <section className="v4-conv__sec" aria-labelledby={`${prefixo}-notas`}>
        <h3 id={`${prefixo}-notas`} className="v4-conv__sec-title">
          Notas
        </h3>
        {notas.length === 0 && !criandoNota && <p className="v4-t-ui v4-t-2">Nenhuma nota ainda.</p>}
        {notasVisiveis.map((n) => (
          <div key={n.id} className="v4-cv-nota">
            <p className="v4-t-ui v4-cv-nota__texto">{n.texto}</p>
            <p className="v4-t-meta">
              {n.autorId ? nomeDoOperador(estado.operadores, n.autorId, operador?.id) : "Sistema"} · {dataHora(n.em)}
            </p>
          </div>
        ))}
        {notas.length > 3 && (
          <div>
            <Button size="sm" variant="ghost" onClick={() => setTodasNotas((v) => !v)}>
              {todasNotas ? "Mostrar menos" : `Mostrar todas (${notas.length})`}
            </Button>
          </div>
        )}
        {!soLeitura &&
          (criandoNota ? (
            <FormNota contatoId={c.id} aoCancelar={() => setCriandoNota(false)} aoCriar={() => setCriandoNota(false)} />
          ) : (
            <div>
              <Button size="sm" variant="ghost" icon="nota" onClick={() => setCriandoNota(true)}>
                Adicionar nota
              </Button>
            </div>
          ))}
      </section>

      <section className="v4-conv__sec">
        <ButtonLink href={hrefFicha} variant="secondary" size="sm" iconEnd="chevronDireita" block>
          Abrir ficha
        </ButtonLink>
      </section>
    </div>
  );
}
