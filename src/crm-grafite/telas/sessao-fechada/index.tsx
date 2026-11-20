"use client";

import { useMemo, useState } from "react";
import { useCRM } from "@/components/crm/provider";
import { dataCurta, formatarReais, formatarTempo } from "@/domain/rules";
import { Button, ButtonLink, Dialog, EmptyState, Icon, Input, Panel, Table, Tag } from "../../ui";
import { CabecalhoTela, EstadoSalvar, TelaV4, useEnvio } from "../base-demais/tela";
import { podeEscrever } from "../equipe/gravar";
import { useGravar } from "../equipe/use-gravar";
import { diaBr, diaLocal } from "../ocorrencias/ocorrencias-logica";
import {
  ORIGEM_CONVITE,
  convidadosDaSemana,
  fimDoDia,
  proximoDiaUtil,
  resumoSessao,
  segundaDaSemana,
  textoConvite,
  validarPrazo,
  type ConvidadoSessao,
} from "./sessao-logica";
import "../../styles/telas/config.css";

/**
 * Sessão fechada (Grafite): quem a gente chama esta semana. A fila é quem bateu na trave no
 * funil; o convite vira tarefa (com prazo) para quem vai chamar. Sem formulário de resultado:
 * o template ainda não grava a sessão.
 */
export function TelaSessaoFechada() {
  const { estado, agora, operador } = useCRM();
  const convidados = useMemo(() => convidadosDaSemana(estado, agora), [estado, agora]);
  const [selecao, setSelecao] = useState<Set<string>>(new Set());
  const [convidando, setConvidandoBruto] = useState<ConvidadoSessao[] | null>(null);
  // Cada abertura do diálogo começa limpa (prazo padrão, sem estado de envio anterior).
  const [rodada, setRodada] = useState(0);
  const setConvidando = (v: ConvidadoSessao[] | null) => {
    if (v) setRodada((r) => r + 1);
    setConvidandoBruto(v);
  };
  const escreve = podeEscrever(operador);
  const semConvite = convidados.filter((c) => !c.convite);
  const selecionados = convidados.filter((c) => selecao.has(c.oportunidadeId) && !c.convite);

  return (
    <TelaV4 area="sessao">
      <CabecalhoTela
        titulo="Sessão fechada"
        meta={`Semana de segunda, ${diaBr(segundaDaSemana(agora))} · ${resumoSessao(convidados)}`}
        acoes={
          escreve &&
          semConvite.length > 0 && (
            <Button variant="primary" icon="tarefas" onClick={() => setConvidando(semConvite)}>
              Convidar todos sem convite
            </Button>
          )
        }
      />
      <p className="v4-nota">
        <Icon name="info" />
        <span>
          Entra aqui quem recebeu a oferta com condição há mais de 2 dias e ainda não pagou. O convite vira uma tarefa com prazo; como foi a
          sessão, registre numa nota na ficha da pessoa.
        </span>
      </p>
      <Panel semRecuo titulo={`Convidados (${convidados.length})`}>
        <Table
          rotulo="Convidados da sessão fechada"
          linhas={convidados}
          chave={(c) => c.oportunidadeId}
          linkDaLinha={(c) => `/contatos/${encodeURIComponent(c.contatoId)}`}
          nomeDaLinha={(c) => c.nome}
          selecao={escreve ? selecao : undefined}
          aoSelecionar={escreve ? setSelecao : undefined}
          acoesEmLote={() =>
            selecionados.length > 0 ? (
              <Button size="sm" variant="primary" onClick={() => setConvidando(selecionados)}>
                Convidar {selecionados.length === 1 ? "1 pessoa" : `${selecionados.length} pessoas`}
              </Button>
            ) : (
              <span className="v4-t-meta">Quem está selecionado já tem convite.</span>
            )
          }
          colunas={[
            { id: "nome", titulo: "Pessoa", celula: (c) => c.nome },
            { id: "emp", titulo: "Empresa", celula: (c) => c.empresa ?? <span className="v4-t-3">—</span> },
            { id: "nota", titulo: "Nota", numerica: true, celula: (c) => (c.nota == null ? "—" : c.nota) },
            { id: "valor", titulo: "Valor", numerica: true, celula: (c) => formatarReais(c.valor) },
            { id: "tempo", titulo: "Na oferta há", numerica: true, celula: (c) => formatarTempo(c.minutosNaOferta) },
            { id: "prox", titulo: "Próximo passo", cortar: (c) => c.proximaAcao ?? "", celula: (c) => c.proximaAcao ?? <span className="v4-t-3">—</span> },
            {
              id: "convite",
              titulo: "Convite",
              celula: (c) =>
                c.convite ? (
                  <Tag tom="sucesso" icon="sucesso">
                    {c.convite.venceEm ? `Nas tarefas até ${dataCurta(c.convite.venceEm)}` : "Nas tarefas"}
                  </Tag>
                ) : escreve ? (
                  <Button size="sm" onClick={() => setConvidando([c])}>
                    Convidar<span className="v4-sr"> {c.nome}</span>
                  </Button>
                ) : (
                  <span className="v4-t-3">Sem convite</span>
                ),
            },
            {
              id: "conversa",
              titulo: "Conversa",
              celula: (c) => (
                <ButtonLink size="sm" variant="ghost" href={`/conversas?c=${encodeURIComponent(c.contatoId)}`}>
                  Abrir<span className="v4-sr"> a conversa com {c.nome}</span>
                </ButtonLink>
              ),
            },
          ]}
          vazio={
            <EmptyState
              nivel={2}
              titulo="Ninguém na fila desta semana"
              texto="Quem recebe a oferta com condição e não paga em 2 dias “bate na trave” e entra aqui como convidado da sessão."
              acoes={<ButtonLink href="/funil">Abrir o Funil</ButtonLink>}
            />
          }
        />
      </Panel>
      <DialogoConvite
        key={rodada}
        convidados={convidando}
        aoFechar={() => setConvidando(null)}
        aoConcluir={() => {
          setConvidando(null);
          setSelecao(new Set());
        }}
      />
    </TelaV4>
  );
}

/** Cria uma tarefa de convite por pessoa, com o mesmo prazo. Só fecha quando todas foram gravadas. */
function DialogoConvite({ convidados, aoFechar, aoConcluir }: { convidados: ConvidadoSessao[] | null; aoFechar: () => void; aoConcluir: () => void }) {
  const { agora } = useCRM();
  const gravar = useGravar();
  const { estado: envio, enviar, editar } = useEnvio();
  const hoje = diaLocal(agora);
  const [dia, setDia] = useState(() => proximoDiaUtil(agora));
  const [erro, setErro] = useState<string | null>(null);
  const lista = convidados ?? [];

  async function criar() {
    const e = validarPrazo(dia, hoje);
    setErro(e);
    if (e) return;
    const ok = await enviar(async () => {
      let feitas = 0;
      for (const c of lista) {
        const ultimo = feitas === lista.length - 1;
        const r = await gravar(
          { tipo: "criarTarefa", contatoId: c.contatoId, texto: textoConvite(c.nome), venceEm: fimDoDia(dia), origem: ORIGEM_CONVITE },
          ultimo ? (lista.length === 1 ? "Convite criado nas tarefas." : `${lista.length} convites criados nas tarefas.`) : undefined,
        );
        if (!r.ok) return { ok: false, erro: r.erro, parcial: feitas ? `${feitas} de ${lista.length} convites criados.` : undefined };
        feitas += 1;
      }
      return { ok: true };
    });
    if (ok) aoConcluir();
  }

  return (
    <Dialog
      open={Boolean(convidados)}
      onClose={aoFechar}
      title={lista.length === 1 ? `Convidar ${lista[0].nome}` : `Convidar ${lista.length} pessoas`}
      description="Cada convite vira uma tarefa na lista de Tarefas, com o prazo abaixo."
      footer={({ fechar }) => (
        <>
          <EstadoSalvar estado={envio} />
          <Button variant="secondary" onClick={fechar}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={criar} busyLabel="Criando">
            {lista.length === 1 ? "Criar convite" : `Criar ${lista.length} convites`}
          </Button>
        </>
      )}
    >
      <div className="v4-form">
        {lista.length > 1 && (
          <ul className="v4-cfg__lista">
            {lista.map((c) => (
              <li key={c.oportunidadeId}>{textoConvite(c.nome)}</li>
            ))}
          </ul>
        )}
        {lista.length === 1 && <p className="v4-t-ui">{textoConvite(lista[0].nome)}</p>}
        <Input
          label="Convidar até"
          type="date"
          min={hoje}
          required
          value={dia}
          error={erro ?? undefined}
          onChange={(e) => {
            setDia(e.target.value);
            setErro(null);
            editar();
          }}
        />
      </div>
    </Dialog>
  );
}
