/**
 * Regras puras da tela Tarefas (Grafite): modelo das linhas a partir do estado, grupos, filtros,
 * rótulos de data e conversão de data e hora. Sem React e sem relógio escondido: tudo recebe
 * `agora`, para o teste controlar. Fuso: o do navegador (o template roda no navegador do dono;
 * o contador da navegação usa a mesma regra de "fim do dia").
 */
import type { EstadoCRM } from "@/domain/types";

export type TarefaLinha = {
  id: string;
  titulo: string;
  venceEm: string | null;
  origem: string;
  feita: boolean;
  criadaEm: string;
  contato: { id: string; nome: string } | null;
};

export type GrupoTarefa = "atrasadas" | "hoje" | "proximas" | "semData" | "feitas";

export const ORDEM_GRUPOS: GrupoTarefa[] = ["atrasadas", "hoje", "proximas", "semData", "feitas"];

export const ROTULO_GRUPO: Record<GrupoTarefa, string> = {
  atrasadas: "Atrasadas",
  hoje: "Hoje",
  proximas: "Próximas",
  semData: "Sem data",
  feitas: "Feitas",
};

export type Situacao = "abertas" | "feitas" | "todas";

const DIA_MS = 86_400_000;

/** Tarefas do estado com o nome da pessoa (a tarefa sempre é de alguém; contato apagado vira null). */
export function montarTarefas(estado: Pick<EstadoCRM, "tarefas" | "contatos">): TarefaLinha[] {
  const nomes = new Map(estado.contatos.map((c) => [c.id, c.nome]));
  return estado.tarefas.map((t) => {
    const nome = nomes.get(t.contatoId);
    return {
      id: t.id,
      titulo: t.texto,
      venceEm: t.venceEm,
      origem: t.origem,
      feita: t.feita,
      criadaEm: t.criadaEm,
      contato: nome !== undefined ? { id: t.contatoId, nome } : null,
    };
  });
}

/** Fim do dia local de `agora` (23:59:59.999). */
export function fimDoDia(agora: Date): Date {
  const d = new Date(agora.getTime());
  d.setHours(23, 59, 59, 999);
  return d;
}

const tempo = (iso: string | null | undefined): number => {
  if (!iso) return Number.NaN;
  return new Date(iso).getTime();
};

/**
 * Em que grupo a tarefa cai. Feita: "feitas". Sem data (ou data ilegível): "semData".
 * Atrasada: a data já passou. Hoje: vence até o fim do dia. Próxima: depois de hoje.
 */
export function grupoDaTarefa(t: Pick<TarefaLinha, "venceEm" | "feita">, agora: Date): GrupoTarefa {
  if (t.feita) return "feitas";
  const v = tempo(t.venceEm);
  if (Number.isNaN(v)) return "semData";
  if (v < agora.getTime()) return "atrasadas";
  if (v <= fimDoDia(agora).getTime()) return "hoje";
  return "proximas";
}

/** Ordem dentro do grupo: data mais próxima primeiro; sem data pela criação (mais nova primeiro); empate pelo título. */
export function compararTarefas(
  a: Pick<TarefaLinha, "venceEm" | "titulo" | "criadaEm">,
  b: Pick<TarefaLinha, "venceEm" | "titulo" | "criadaEm">,
): number {
  const ta = tempo(a.venceEm);
  const tb = tempo(b.venceEm);
  const sa = Number.isNaN(ta) ? Number.POSITIVE_INFINITY : ta;
  const sb = Number.isNaN(tb) ? Number.POSITIVE_INFINITY : tb;
  if (sa !== sb) return sa < sb ? -1 : 1;
  const ca = tempo(a.criadaEm);
  const cb = tempo(b.criadaEm);
  if (!Number.isNaN(ca) && !Number.isNaN(cb) && ca !== cb) return cb - ca;
  return a.titulo.localeCompare(b.titulo, "pt-BR");
}

/**
 * Agrupa as tarefas. `fixas`: ids concluídos ou reabertos nesta visita, que ficam no grupo em
 * que estavam (a linha não pula de lugar no clique; muda só o estado dela). `grupoFixo` diz qual.
 */
export function agruparTarefas<T extends TarefaLinha>(
  tarefas: T[],
  agora: Date,
  grupoFixo: ReadonlyMap<string, GrupoTarefa> = new Map(),
): Record<GrupoTarefa, T[]> {
  const out: Record<GrupoTarefa, T[]> = { atrasadas: [], hoje: [], proximas: [], semData: [], feitas: [] };
  for (const t of tarefas) out[grupoFixo.get(t.id) ?? grupoDaTarefa(t, agora)].push(t);
  for (const g of ORDEM_GRUPOS) out[g].sort(g === "feitas" ? (a, b) => -compararTarefas(a, b) : compararTarefas);
  return out;
}

/** Texto sem acento e em minúsculas, para a busca. */
export function normalizar(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR").trim();
}

/** A tarefa casa com a busca? Procura no texto, no nome da pessoa e na origem. Busca vazia: casa. */
export function casaBusca(t: Pick<TarefaLinha, "titulo" | "origem" | "contato">, busca: string): boolean {
  const q = normalizar(busca);
  if (!q) return true;
  return normalizar(`${t.titulo} ${t.contato?.nome ?? ""} ${t.origem}`).includes(q);
}

/**
 * Filtra por situação e busca. `fixas` (concluídas ou reabertas nesta visita) continuam na
 * situação em que estavam quando a pessoa clicou, para a linha não sumir debaixo do cursor.
 */
export function filtrarTarefas<T extends TarefaLinha>(
  tarefas: T[],
  f: { situacao: Situacao; busca: string },
  fixas: ReadonlyMap<string, Situacao> = new Map(),
): T[] {
  return tarefas.filter((t) => {
    if (!casaBusca(t, f.busca)) return false;
    if (f.situacao === "todas") return true;
    const onde = fixas.get(t.id) ?? (t.feita ? "feitas" : "abertas");
    return onde === f.situacao;
  });
}

/** Contagem por situação (para os filtros da faixa), já com a busca aplicada. */
export function contarSituacoes(tarefas: TarefaLinha[], busca: string): Record<Situacao, number> {
  let abertas = 0;
  let feitas = 0;
  for (const t of tarefas) {
    if (!casaBusca(t, busca)) continue;
    if (t.feita) feitas += 1;
    else abertas += 1;
  }
  return { abertas, feitas, todas: abertas + feitas };
}

/** Chave do dia local (AAAA-MM-DD). */
export function chaveDoDia(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const fmtHora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const fmtDia = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });
const fmtSemana = new Intl.DateTimeFormat("pt-BR", { weekday: "short" });

/** "15:00", ou "até o fim do dia" quando a tarefa vence às 23:59 (o padrão de quem não põe hora). */
function horaOuFimDoDia(d: Date): string {
  return d.getHours() === 23 && d.getMinutes() === 59 ? "até o fim do dia" : fmtHora.format(d);
}

/** Quanto tempo atrás, curto: "há 20 min", "há 3 h", "há 2 d". */
export function haQuanto(ms: number): string {
  const min = Math.max(0, Math.floor(ms / 60_000));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  if (min < 60 * 24) return `há ${Math.floor(min / 60)} h`;
  return `há ${Math.floor(min / (60 * 24))} d`;
}

/** Daqui a quanto tempo, curto: "em 20 min", "em 3 h", "em 2 d". */
export function emQuanto(ms: number): string {
  const min = Math.max(0, Math.ceil(ms / 60_000));
  if (min < 60) return `em ${min} min`;
  if (min < 60 * 24) return `em ${Math.floor(min / 60)} h`;
  return `em ${Math.floor(min / (60 * 24))} d`;
}

/**
 * Data da tarefa em texto, relativa ao dia de `agora`: "Venceu ontem, 15:00 (há 20 h)",
 * "Hoje, 15:00", "Hoje, até o fim do dia", "Amanhã, 09:00", "qui 13/11, 09:00", "Sem data".
 */
export function rotuloVencimento(venceEm: string | null, agora: Date): string {
  if (!venceEm) return "Sem data";
  const d = new Date(venceEm);
  if (Number.isNaN(d.getTime())) return "Sem data";
  const hoje = chaveDoDia(agora);
  const dia = chaveDoDia(d);
  const ontem = chaveDoDia(new Date(agora.getTime() - DIA_MS));
  const amanha = chaveDoDia(new Date(agora.getTime() + DIA_MS));
  const hora = horaOuFimDoDia(d);
  const juntar = (a: string) => `${a}, ${hora}`;
  if (d.getTime() < agora.getTime()) {
    const quando = dia === hoje ? "hoje" : dia === ontem ? "ontem" : fmtDia.format(d);
    const base = hora === "até o fim do dia" ? quando : juntar(quando);
    return `Venceu ${base} (${haQuanto(agora.getTime() - d.getTime())})`;
  }
  if (dia === hoje) return juntar("Hoje");
  if (dia === amanha) return juntar("Amanhã");
  const semana = fmtSemana.format(d).replace(".", "");
  return juntar(`${semana} ${fmtDia.format(d)}`);
}

/** A tarefa está atrasada em `agora`? */
export function atrasada(t: Pick<TarefaLinha, "venceEm" | "feita">, agora: Date): boolean {
  const v = tempo(t.venceEm);
  return !t.feita && !Number.isNaN(v) && v < agora.getTime();
}

/** De onde a tarefa veio, em texto: "Criada à mão", "Da ligação 10:15", "Criada pelo Cláudio". */
export function rotuloOrigem(origem: string, nomeRobo: string): string {
  const o = origem.trim();
  if (!o) return "";
  const n = normalizar(o);
  if (n === "manual") return "Criada à mão";
  if (n === normalizar(nomeRobo) || n === "claudio" || n === "robo") return `Criada pelo ${nomeRobo}`;
  if (n.startsWith("ligacao")) return `Da ${o.charAt(0).toLocaleLowerCase("pt-BR")}${o.slice(1)}`;
  return `Origem: ${o}`;
}

/** Data (AAAA-MM-DD) e hora (HH:MM) locais → ISO. Hora vazia = 23:59 (fim do dia). Data inexistente: null. */
export function isoDeLocal(data: string, hora: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data.trim());
  if (!m) return null;
  const h = hora.trim() || "23:59";
  const mh = /^(\d{2}):(\d{2})$/.exec(h);
  if (!mh) return null;
  const [ano, mes, dia, hh, mm] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(mh[1]), Number(mh[2])];
  if (hh > 23 || mm > 59) return null;
  const d = new Date(ano, mes - 1, dia, hh, mm, 0, 0);
  if (Number.isNaN(d.getTime())) return null;
  // 31/02 vira março: não aceita data que não existe
  if (d.getFullYear() !== ano || d.getMonth() !== mes - 1 || d.getDate() !== dia) return null;
  return d.toISOString();
}

/** Data de hoje (AAAA-MM-DD), para o valor inicial do campo. */
export function hojeLocal(agora: Date): string {
  return chaveDoDia(agora);
}

/** A tarefa nova (ids antes × depois do despacho): a que não existia antes. */
export function idNovo(antes: ReadonlyArray<{ id: string }>, depois: ReadonlyArray<{ id: string }>): string | null {
  const ja = new Set(antes.map((t) => t.id));
  return depois.find((t) => !ja.has(t.id))?.id ?? null;
}

/** "1 tarefa", "3 tarefas". */
export const contarTarefas = (n: number) => `${n} ${n === 1 ? "tarefa" : "tarefas"}`;
