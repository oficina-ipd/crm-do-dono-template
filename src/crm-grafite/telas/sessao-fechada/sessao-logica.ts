/**
 * Sessão fechada (Grafite): quem a gente chama esta semana. No template a fila é quem
 * "bateu na trave" no funil (oferta com condição enviada há mais de 2 dias, sem pagamento).
 * O resultado de cada convidado ainda não tem onde ser gravado; o convite vira tarefa real.
 * Puro: a tela e os testes usam as mesmas regras.
 */
import { cardsFunilDe } from "@/lib/crm/adapters";
import { primeiroNome } from "@/domain/rules";
import type { EstadoCRM, Tarefa } from "@/domain/types";

export const ORIGEM_CONVITE = "sessão fechada";

export type ConvidadoSessao = {
  oportunidadeId: string;
  contatoId: string;
  nome: string;
  empresa: string | null;
  nota: number | null;
  valor: number;
  naOfertaDesde: string;
  minutosNaOferta: number;
  proximaAcao: string | null;
  /** Tarefa de convite em aberto para este contato, se já existe. */
  convite: Pick<Tarefa, "id" | "texto" | "venceEm"> | null;
};

/** Segunda-feira da semana de `agora`, "AAAA-MM-DD" no relógio local. */
export function segundaDaSemana(agoraIso: string): string {
  const d = new Date(agoraIso);
  const dow = (d.getDay() + 6) % 7; // segunda = 0
  d.setDate(d.getDate() - dow);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function convidadosDaSemana(estado: EstadoCRM, agoraIso: string): ConvidadoSessao[] {
  const agora = Date.parse(agoraIso);
  return cardsFunilDe(estado, agoraIso)
    .filter((c) => c.bateuNaTrave)
    .map((c) => {
      const convite =
        estado.tarefas
          .filter((t) => t.contatoId === c.contatoId && !t.feita && t.origem === ORIGEM_CONVITE)
          .sort((a, b) => Date.parse(b.criadaEm) - Date.parse(a.criadaEm))[0] ?? null;
      return {
        oportunidadeId: c.id,
        contatoId: c.contatoId,
        nome: c.contatoNome,
        empresa: c.empresa,
        nota: c.nota,
        valor: c.valorCentavos / 100,
        naOfertaDesde: c.etapaDesde,
        minutosNaOferta: Math.max(0, Math.round((agora - Date.parse(c.etapaDesde)) / 60000)),
        proximaAcao: c.proximaAcao,
        convite: convite ? { id: convite.id, texto: convite.texto, venceEm: convite.venceEm } : null,
      };
    })
    .sort((a, b) => b.minutosNaOferta - a.minutosNaOferta);
}

/** "3 convidados · 1 com convite na lista de tarefas" */
export function resumoSessao(cs: Pick<ConvidadoSessao, "convite">[]): string {
  if (cs.length === 0) return "Ninguém na fila";
  const com = cs.filter((c) => c.convite).length;
  const base = `${cs.length} ${cs.length === 1 ? "convidado" : "convidados"}`;
  return com ? `${base} · ${com} com convite nas tarefas` : base;
}

export function textoConvite(nome: string): string {
  return `Convidar ${primeiroNome(nome)} para a sessão fechada`;
}

/** Fim do dia escolhido (23:59 local) em ISO, para o vencimento da tarefa. */
export function fimDoDia(dia: string): string {
  const [a, m, d] = dia.split("-").map(Number);
  return new Date(a, m - 1, d, 23, 59, 0, 0).toISOString();
}

/** Próximo dia útil depois de `agora` ("AAAA-MM-DD", local): padrão do prazo do convite. */
export function proximoDiaUtil(agoraIso: string): string {
  const d = new Date(agoraIso);
  do d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function validarPrazo(dia: string, hoje: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return "Escolha o dia do convite no calendário.";
  if (dia < hoje) return "Escolha hoje ou um dia depois de hoje.";
  return null;
}
