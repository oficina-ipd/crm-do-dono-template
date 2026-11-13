/**
 * Ocorrências (Grafite): o que a equipe marcou nas conversas do robô, para ajustar o playbook
 * e o próprio robô. Puro: a tela e os testes usam as mesmas regras.
 */
import { nomeDoOperador } from "@/domain/comandos";
import { dataHora } from "@/domain/rules";
import type { Autor, EstadoCRM, Ocorrencia } from "@/domain/types";
import type { TagTom } from "../../ui/marcadores";

export type FiltroOcorrencia = "abertas" | "resolvidas" | "todas";

export type LinhaOcorrencia = {
  id: string;
  em: string;
  dia: string;
  tipo: Ocorrencia["tipo"];
  status: Ocorrencia["status"];
  contatoId: string;
  contatoNome: string;
  /** O que o robô disse (primeiro trecho dele) ou, sem trecho do robô, o primeiro trecho marcado. */
  trecho: string | null;
  descricao: string;
  quem: string;
  resposta: string | null;
};

export const ROTULO_TIPO: Record<Ocorrencia["tipo"], string> = { problema: "Problema", melhoria: "Melhoria" };

export const SITUACAO: Record<Ocorrencia["status"], { rotulo: string; tom: TagTom }> = {
  aberta: { rotulo: "Aberta", tom: "neutro" },
  "em análise": { rotulo: "Em análise", tom: "info" },
  resolvida: { rotulo: "Resolvida", tom: "sucesso" },
};

/** Dia local "AAAA-MM-DD" de um instante ISO (o dia em que a pessoa marcou, no relógio dela). */
export function diaLocal(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function diaBr(dia: string): string {
  return dia.split("-").reverse().join("/");
}

/** Mesma validação do IPD: dia que existe e que não está no futuro. Vazio = todos os dias. */
export function validarDia(valor: string, hoje: string): string | null {
  if (valor === "") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return "Escolha um dia no calendário.";
  const d = new Date(`${valor}T12:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== valor) return "Esse dia não existe. Escolha outro.";
  if (valor > hoje) return "Escolha hoje ou um dia que já passou.";
  return null;
}

export function nomeDoAutorTrecho(autor: Autor, contatoNome: string, nomeRobo: string): string {
  if (autor === "robo") return nomeRobo;
  if (autor === "contato") return contatoNome;
  return "Equipe";
}

export function linhasOcorrencias(estado: EstadoCRM): LinhaOcorrencia[] {
  return estado.ocorrencias
    .map((o) => {
      const c = estado.contatos.find((x) => x.id === o.contatoId);
      const doRobo = o.trechos.find((t) => t.autor === "robo") ?? o.trechos[0] ?? null;
      return {
        id: o.id,
        em: o.em,
        dia: diaLocal(o.em),
        tipo: o.tipo,
        status: o.status,
        contatoId: o.contatoId,
        contatoNome: c?.nome ?? "Contato removido",
        trecho: doRobo?.texto ?? null,
        descricao: o.descricao,
        quem: o.abertaPor ? nomeDoOperador(estado, o.abertaPor) : "Sem registro",
        resposta: o.resposta,
      };
    })
    .sort((a, b) => Date.parse(b.em) - Date.parse(a.em));
}

export function passaNoFiltro(l: Pick<LinhaOcorrencia, "status" | "dia">, filtro: FiltroOcorrencia, dia: string): boolean {
  if (dia && l.dia !== dia) return false;
  if (filtro === "abertas") return l.status !== "resolvida";
  if (filtro === "resolvidas") return l.status === "resolvida";
  return true;
}

export function contarPorFiltro(linhas: Pick<LinhaOcorrencia, "status" | "dia">[], dia: string): Record<FiltroOcorrencia, number> {
  return {
    abertas: linhas.filter((l) => passaNoFiltro(l, "abertas", dia)).length,
    resolvidas: linhas.filter((l) => passaNoFiltro(l, "resolvidas", dia)).length,
    todas: linhas.filter((l) => passaNoFiltro(l, "todas", dia)).length,
  };
}

/** "3 marcações · 1 problema" (só o que tem contagem). */
export function metaOcorrencias(linhas: Pick<LinhaOcorrencia, "tipo">[]): string {
  const n = linhas.length;
  const problemas = linhas.filter((l) => l.tipo === "problema").length;
  const base = `${n} ${n === 1 ? "marcação" : "marcações"}`;
  return problemas ? `${base} · ${problemas} ${problemas === 1 ? "problema" : "problemas"}` : base;
}

/**
 * Resumo em texto para levar a quem ajusta o robô (o mesmo que o IPD baixa por dia).
 * Leva as linhas que estão na tela, já filtradas.
 */
export function resumoEmTexto(linhas: LinhaOcorrencia[], titulo: string, nomeRobo: string): string {
  const cab = `${titulo}\n${metaOcorrencias(linhas)}\n`;
  const corpo = linhas.map((l, i) =>
    [
      `${i + 1}. ${ROTULO_TIPO[l.tipo]} · ${SITUACAO[l.status].rotulo} · ${dataHora(l.em)}`,
      `   Contato: ${l.contatoNome} · marcado por ${l.quem}`,
      l.trecho ? `   O que ${nomeRobo} disse: “${l.trecho}”` : null,
      `   Por quê: ${l.descricao}`,
      l.resposta ? `   O que foi ajustado: ${l.resposta}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  );
  return [cab, ...corpo].join("\n\n") + "\n";
}

export function nomeArquivoResumo(dia: string, hoje: string): string {
  return `ocorrencias-${dia || `ate-${hoje}`}.txt`;
}
