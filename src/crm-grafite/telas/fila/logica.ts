/**
 * Regras puras da Fila (Grafite): o modelo da tela a partir do estado do CRM, a ordem dos itens,
 * o prazo do handoff em texto e a navegação por teclado. Sem React e sem relógio escondido (tudo
 * recebe `agora`), para o teste controlar.
 */
import { etapaDe } from "@/domain/funil";
import { estourouPrazo, formatarTempo, minutosNaEtapa, primeiroNome } from "@/domain/rules";
import type { Autor, EstadoCRM } from "@/domain/types";
import { chaveDoDia, emQuanto, haQuanto, rotuloVencimento } from "../tarefas/logica";

export type HandoffFila = {
  tipo: "handoff";
  /** Chave do item na fila (o contato). */
  id: string;
  contatoId: string;
  nome: string;
  empresa: string | null;
  nota: number | null;
  desde: string;
  /** Fim do prazo do handoff (pedido + prazo da etapa Handoff). null quando a etapa não tem prazo. */
  slaAte: string | null;
  /** Motivo gravado no movimento para a etapa Handoff, quando houver. */
  motivo: string | null;
  ultimaMensagem: { texto: string; quem: string; em: string } | null;
  href: string;
};

export type TarefaFila = {
  tipo: "tarefa";
  id: string;
  tarefaId: string;
  titulo: string;
  venceEm: string | null;
  feita: boolean;
  contato: { id: string; nome: string } | null;
  href: string | null;
};

export type ParadaFila = {
  tipo: "parada";
  id: string;
  oportunidadeId: string;
  contatoId: string;
  nome: string;
  etapaNome: string;
  minutos: number;
  prazoMin: number;
  href: string;
};

export type ItemFila = HandoffFila | TarefaFila | ParadaFila;

export type Fila = { handoffs: HandoffFila[]; tarefas: TarefaFila[]; paradas: ParadaFila[] };

export const hrefConversa = (contatoId: string) => `/conversas?c=${encodeURIComponent(contatoId)}`;
export const hrefFicha = (contatoId: string) => `/contatos/${encodeURIComponent(contatoId)}`;

const tempo = (iso: string | null | undefined): number => {
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
};

/**
 * Handoffs por prazo: quem tem prazo vem primeiro, do mais curto (ou já vencido) para o mais
 * longo; sem prazo, quem espera há mais tempo. Empate: quem pediu antes, depois o nome.
 */
export function ordenarHandoffs<T extends Pick<HandoffFila, "slaAte" | "desde" | "nome">>(lista: T[]): T[] {
  return [...lista].sort((a, b) => {
    const sa = tempo(a.slaAte);
    const sb = tempo(b.slaAte);
    if (sa !== sb) return sa < sb ? -1 : 1;
    const da = tempo(a.desde);
    const db = tempo(b.desde);
    if (da !== db) return da < db ? -1 : 1;
    return a.nome.localeCompare(b.nome, "pt-BR");
  });
}

/** Tarefas: atrasadas e com hora primeiro (da mais antiga), sem data no fim. */
export function ordenarTarefasFila<T extends Pick<TarefaFila, "venceEm" | "titulo">>(lista: T[]): T[] {
  return [...lista].sort((a, b) => {
    const ta = tempo(a.venceEm);
    const tb = tempo(b.venceEm);
    if (ta !== tb) return ta < tb ? -1 : 1;
    return a.titulo.localeCompare(b.titulo, "pt-BR");
  });
}

/** Paradas: quem passou mais do prazo da etapa vem primeiro. */
export function ordenarParadas<T extends Pick<ParadaFila, "minutos" | "prazoMin" | "nome">>(lista: T[]): T[] {
  const excesso = (p: T) => p.minutos - p.prazoMin;
  return [...lista].sort((a, b) => excesso(b) - excesso(a) || a.nome.localeCompare(b.nome, "pt-BR"));
}

/** "Handoff: pediu para falar com uma pessoa." → "Pediu para falar com uma pessoa". */
export function limparMotivo(motivo: string | null | undefined): string | null {
  const m = (motivo ?? "").replace(/^handoff:\s*/i, "").replace(/\.\s*$/, "").trim();
  if (!m) return null;
  return m.charAt(0).toLocaleUpperCase("pt-BR") + m.slice(1);
}

/** Quem escreveu a mensagem, em texto: primeiro nome do contato, nome do robô ou do operador. */
export function quemEscreveu(
  m: { autor: Autor; operadorId?: string | null },
  ctx: { nomeContato: string; nomeRobo: string; operadores: ReadonlyArray<{ id: string; nome: string }> },
): string {
  if (m.autor === "contato") return primeiroNome(ctx.nomeContato);
  if (m.autor === "robo") return ctx.nomeRobo;
  const op = m.operadorId ? ctx.operadores.find((o) => o.id === m.operadorId) : null;
  return op ? primeiroNome(op.nome) : "Equipe";
}

/**
 * Fim do dia local de `agora`: tarefas que vencem até lá (e as sem data) entram na Fila, a mesma
 * regra do contador de Tarefas na navegação.
 */
function fimDoDiaMs(agora: Date): number {
  const d = new Date(agora.getTime());
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/**
 * A Fila a partir do estado. `manterTarefas`: tarefas concluídas nesta visita, que continuam na
 * lista (riscadas, com "Reabrir") até a pessoa sair da tela; a linha não some debaixo do cursor.
 */
export function montarFila(
  estado: Pick<EstadoCRM, "contatos" | "oportunidades" | "movimentos" | "mensagens" | "tarefas" | "operadores" | "config">,
  agoraIso: string,
  manterTarefas: ReadonlySet<string> = new Set(),
): Fila {
  const agora = new Date(agoraIso);
  const nomes = new Map(estado.contatos.map((c) => [c.id, c.nome]));
  const prazoHandoff = etapaDe("handoff")?.prazoMin ?? 0;

  const handoffs = ordenarHandoffs(
    estado.contatos
      .filter((c) => c.handoffPendente)
      .map((c): HandoffFila => {
        const ops = new Set(estado.oportunidades.filter((o) => o.contatoId === c.id).map((o) => o.id));
        const desde = c.handoffDesde ?? c.criadoEm;
        // motivo: o do movimento mais recente para a etapa Handoff, a partir do pedido
        const mov = estado.movimentos
          .filter((m) => ops.has(m.oportunidadeId) && m.para === "handoff" && m.motivo && tempo(m.em) >= tempo(desde) - 60_000)
          .sort((a, b) => tempo(b.em) - tempo(a.em))[0];
        const ultima = estado.mensagens
          .filter((m) => m.contatoId === c.id && !m.aviso && m.texto.trim())
          .sort((a, b) => tempo(b.em) - tempo(a.em))[0];
        return {
          tipo: "handoff",
          id: `h-${c.id}`,
          contatoId: c.id,
          nome: c.nome,
          empresa: c.empresa.trim() || null,
          nota: c.nota,
          desde,
          slaAte: prazoHandoff > 0 && Number.isFinite(tempo(desde)) ? new Date(tempo(desde) + prazoHandoff * 60_000).toISOString() : null,
          motivo: limparMotivo(mov?.motivo),
          ultimaMensagem: ultima
            ? {
                texto: ultima.texto.trim(),
                quem: quemEscreveu(ultima, { nomeContato: c.nome, nomeRobo: estado.config.nomeRobo, operadores: estado.operadores }),
                em: ultima.em,
              }
            : null,
          href: hrefConversa(c.id),
        };
      }),
  );

  const limite = fimDoDiaMs(agora);
  const tarefas = ordenarTarefasFila(
    estado.tarefas
      .filter((t) => (t.feita ? manterTarefas.has(t.id) : !t.venceEm || Number.isNaN(Date.parse(t.venceEm)) || Date.parse(t.venceEm) <= limite))
      .map((t): TarefaFila => {
        const nome = nomes.get(t.contatoId);
        return {
          tipo: "tarefa",
          id: `t-${t.id}`,
          tarefaId: t.id,
          titulo: t.texto,
          venceEm: t.venceEm,
          feita: t.feita,
          contato: nome !== undefined ? { id: t.contatoId, nome } : null,
          href: nome !== undefined ? hrefFicha(t.contatoId) : null,
        };
      }),
  );

  // quem já está no grupo de cima não se repete como oportunidade parada; etapa que o sistema
  // move sozinho (pagamento, acesso) não pede ação de ninguém
  const emHandoff = new Set(handoffs.map((h) => h.contatoId));
  const paradas = ordenarParadas(
    estado.oportunidades
      .filter((o) => !o.perdida && etapaDe(o.etapa)?.dono !== "sistema" && !emHandoff.has(o.contatoId) && estourouPrazo(o, agoraIso))
      .map((o): ParadaFila => {
        const e = etapaDe(o.etapa);
        return {
          tipo: "parada",
          id: `p-${o.id}`,
          oportunidadeId: o.id,
          contatoId: o.contatoId,
          nome: nomes.get(o.contatoId) ?? "Sem nome",
          etapaNome: e?.nome ?? o.etapa,
          minutos: minutosNaEtapa(o, agoraIso),
          prazoMin: e?.prazoMin ?? 0,
          href: hrefFicha(o.contatoId),
        };
      }),
  );

  return { handoffs, tarefas, paradas };
}

/** Ordem de leitura e de teclado: handoffs, depois tarefas, depois paradas. */
export function itensEmOrdem(f: Fila): ItemFila[] {
  return [...f.handoffs, ...f.tarefas, ...f.paradas];
}

/** Quantos itens esperando por alguém (tarefas concluídas nesta visita não contam). */
export function totalEsperando(f: Fila): number {
  return f.handoffs.length + f.tarefas.filter((t) => !t.feita).length + f.paradas.length;
}

export type TomPrazo = "erro" | "atencao" | "neutro";

const fmtHora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const fmtDiaHora = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** A partir de quanto tempo para o fim do prazo o handoff fica em "atenção". */
export const PRAZO_CURTO_MIN = 30;

/**
 * Prazo do handoff em texto: "Prazo passou há 20 min" (erro), "Prazo em 12 min" (atenção),
 * "Prazo às 15:30" / "Prazo 11/11, 09:00", ou "Sem prazo definido".
 */
export function prazoDoHandoff(slaAte: string | null, agora: Date): { tom: TomPrazo; texto: string } {
  if (!slaAte) return { tom: "neutro", texto: "Sem prazo definido" };
  const d = new Date(slaAte);
  if (Number.isNaN(d.getTime())) return { tom: "neutro", texto: "Sem prazo definido" };
  const falta = d.getTime() - agora.getTime();
  if (falta < 0) return { tom: "erro", texto: `Prazo passou ${haQuanto(-falta)}` };
  if (falta <= PRAZO_CURTO_MIN * 60_000) return { tom: "atencao", texto: `Prazo ${emQuanto(falta)}` };
  const mesmoDia = chaveDoDia(d) === chaveDoDia(agora);
  return { tom: "neutro", texto: mesmoDia ? `Prazo às ${fmtHora.format(d)}` : `Prazo ${fmtDiaHora.format(d)}` };
}

export function esperandoHa(desde: string, agora: Date): string {
  const t = new Date(desde).getTime();
  if (Number.isNaN(t)) return "";
  return `pediu uma pessoa ${haQuanto(agora.getTime() - t)}`;
}

/** Hora da mensagem: "15:20" se for de hoje, "11/11, 15:20" se não. */
export function quandoMensagem(em: string, agora: Date): string {
  const d = new Date(em);
  if (Number.isNaN(d.getTime())) return "";
  return chaveDoDia(d) === chaveDoDia(agora) ? fmtHora.format(d) : fmtDiaHora.format(d);
}

export function rotuloTarefaFila(t: Pick<TarefaFila, "venceEm">, agora: Date): { atrasada: boolean; texto: string } {
  const atrasada = Boolean(t.venceEm) && tempo(t.venceEm) < agora.getTime();
  return { atrasada, texto: rotuloVencimento(t.venceEm, agora) };
}

export function rotuloParada(p: Pick<ParadaFila, "etapaNome" | "minutos" | "prazoMin">): string {
  const prazo = p.prazoMin > 0 ? ` · prazo da etapa ${formatarTempo(p.prazoMin)}` : "";
  return `${p.etapaNome} · parada há ${formatarTempo(p.minutos)}${prazo}`;
}

/**
 * Teclado da fila. J ou ↓ desce, K ou ↑ sobe, Home e End vão às pontas; sem item focado, a
 * primeira tecla de movimento vai para o primeiro. Não dá a volta. Outra tecla: null.
 */
export function proximoIndiceFila(atual: number, tecla: string, total: number): number | null {
  if (total <= 0) return null;
  switch (tecla) {
    case "j":
    case "J":
    case "ArrowDown":
      return atual < 0 ? 0 : Math.min(atual + 1, total - 1);
    case "k":
    case "K":
    case "ArrowUp":
      return atual < 0 ? 0 : Math.max(atual - 1, 0);
    case "Home":
      return 0;
    case "End":
      return total - 1;
    default:
      return null;
  }
}

/**
 * A tecla é da fila? Não quando a pessoa digita (campo, área de texto, seleção, editável), usa
 * modificador (⌘K e afins ficam com a casca) ou há um diálogo aberto. J e K só com o foco dentro
 * da tela da Fila (WCAG 2.1.4: atalho de uma letra não fica solto na página); setas, Home e End
 * só com o foco dentro da lista (fora dela continuam rolando).
 */
export function teclaDaFila(e: {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  alvoTag?: string;
  alvoEditavel?: boolean;
  dentroDaFila: boolean;
  naTela: boolean;
  dialogoAberto?: boolean;
}): boolean {
  if (e.metaKey || e.ctrlKey || e.altKey || e.dialogoAberto) return false;
  if (e.alvoEditavel || /^(INPUT|TEXTAREA|SELECT)$/i.test(e.alvoTag ?? "")) return false;
  if (e.key === "j" || e.key === "J" || e.key === "k" || e.key === "K") return e.naTela || e.dentroDaFila;
  if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Home" || e.key === "End") return e.dentroDaFila;
  return false;
}

/** Quantos itens, em texto: "1 item", "5 itens". */
export function contarItens(n: number, um = "item", varios = "itens"): string {
  return `${n} ${n === 1 ? um : varios}`;
}
