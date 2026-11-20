/**
 * Conversas (Grafite) · regras PURAS da tela: estado na URL, lista (resumo, filtros, busca, ordem),
 * teclado, datas, a conversa montada (dias, blocos, ligações, janela "carregar anteriores") e o
 * contexto (motivo do handoff, etapa e para onde dá para mover, próxima tarefa).
 * Sem React e sem rede. Testadas em tests/unit/grafite-conversas.test.ts.
 */
import { ETAPAS, etapaDe, indiceEtapa } from "@/domain/funil";
import { categoria, formatarTempo, minutosEntre, oportunidadePrincipal } from "@/domain/rules";
import type { ContatoCompleto, Dono, EstadoCRM, EtapaId, Ligacao, Mensagem, Operador, Oportunidade, Tarefa } from "@/domain/types";

// ───────── Estado na URL ─────────

export const FILTROS_CONVERSA = ["todas", "precisa", "humano", "robo", "paradas"] as const;
export type FiltroConversa = (typeof FILTROS_CONVERSA)[number];
export type TipoFiltroConversa = "todos" | "lead" | "cliente";

export type EstadoUrlConversas = { filtro: FiltroConversa; q: string; tipo: TipoFiltroConversa; c: string | null };

export const URL_PADRAO: EstadoUrlConversas = { filtro: "todas", q: "", tipo: "todos", c: null };

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/** Lê filtro, busca, tipo e conversa aberta da URL. Valor inválido vira o padrão. */
export function lerUrlConversas(sp: { get(k: string): string | null }): EstadoUrlConversas {
  const f = sp.get("filtro");
  const t = sp.get("tipo");
  const c = sp.get("c");
  return {
    filtro: f && (FILTROS_CONVERSA as readonly string[]).includes(f) ? (f as FiltroConversa) : "todas",
    q: (sp.get("q") ?? "").slice(0, 80),
    tipo: t === "lead" || t === "cliente" ? t : "todos",
    c: c && ID_RE.test(c) ? c : null,
  };
}

/** Query da lista (sem conversa): filtro, busca e tipo. */
export function paramsDaLista(o: Pick<EstadoUrlConversas, "filtro" | "q" | "tipo">): string {
  const sp = new URLSearchParams();
  if (o.filtro !== "todas") sp.set("filtro", o.filtro);
  if (o.q.trim()) sp.set("q", o.q.trim());
  if (o.tipo !== "todos") sp.set("tipo", o.tipo);
  return sp.toString();
}

/** Endereço completo da tela (sem o "#"): lista + conversa aberta. */
export function urlConversas(e: EstadoUrlConversas, base = "/conversas"): string {
  const sp = new URLSearchParams(paramsDaLista(e));
  if (e.c) sp.set("c", e.c);
  const qs = sp.toString();
  return qs ? `${base}?${qs}` : base;
}

export function filtrando(o: Pick<EstadoUrlConversas, "filtro" | "q" | "tipo">): boolean {
  return o.filtro !== "todas" || o.tipo !== "todos" || o.q.trim() !== "";
}

export function rotuloFiltro(f: FiltroConversa, nomeRobo: string): string {
  if (f === "todas") return "Todas";
  if (f === "precisa") return "Precisa de você";
  if (f === "humano") return "Com humano";
  if (f === "robo") return `Com ${nomeRobo}`;
  return "Paradas";
}

export const ROTULO_TIPO: Record<TipoFiltroConversa, string> = { todos: "Leads e clientes", lead: "Só leads", cliente: "Só clientes" };

// ───────── Lista ─────────

export type ResumoConversa = {
  contatoId: string;
  nome: string;
  empresa: string;
  telefoneDigitos: string;
  tipo: "lead" | "cliente";
  ultimaTexto: string;
  ultimaEm: string;
  ultimaAutor: Mensagem["autor"];
  ultimaAviso: boolean;
  ultimaOperadorId: string | null;
  dono: Dono;
  operadorId: string | null;
  handoffPendente: boolean;
  handoffDesde: string | null;
  totalMensagens: number;
};

/**
 * Uma linha por pessoa que tem pelo menos uma mensagem, da última mensagem mais recente para a
 * mais antiga (empate: nome). Todas, sem corte.
 */
export function resumosConversas(estado: Pick<EstadoCRM, "contatos" | "mensagens" | "oportunidades">): ResumoConversa[] {
  const porContato = new Map<string, { ultima: Mensagem; total: number }>();
  for (const m of estado.mensagens) {
    const atual = porContato.get(m.contatoId);
    if (!atual) porContato.set(m.contatoId, { ultima: m, total: 1 });
    else {
      atual.total += 1;
      if (m.em >= atual.ultima.em) atual.ultima = m;
    }
  }
  const opsPorContato = new Map<string, Oportunidade[]>();
  for (const o of estado.oportunidades) {
    const l = opsPorContato.get(o.contatoId) ?? [];
    l.push(o);
    opsPorContato.set(o.contatoId, l);
  }
  const out: ResumoConversa[] = [];
  for (const c of estado.contatos) {
    const r = porContato.get(c.id);
    if (!r) continue;
    out.push({
      contatoId: c.id,
      nome: c.nome,
      empresa: c.empresa,
      telefoneDigitos: c.telefone.replace(/\D/g, ""),
      tipo: categoria(opsPorContato.get(c.id) ?? []) === "cliente" ? "cliente" : "lead",
      ultimaTexto: r.ultima.texto,
      ultimaEm: r.ultima.em,
      ultimaAutor: r.ultima.autor,
      ultimaAviso: Boolean(r.ultima.aviso),
      ultimaOperadorId: r.ultima.operadorId ?? null,
      dono: c.dono,
      operadorId: c.operadorId,
      handoffPendente: c.handoffPendente,
      handoffDesde: c.handoffDesde,
      totalMensagens: r.total,
    });
  }
  return out.sort((a, b) => (a.ultimaEm < b.ultimaEm ? 1 : a.ultimaEm > b.ultimaEm ? -1 : a.nome.localeCompare(b.nome, "pt-BR")));
}

/** Minutos sem resposta para uma conversa contar como "parada". */
export const PARADA_MIN = 60;

/** Parada: a última mensagem é do contato e ninguém respondeu há mais de 1 hora (critério do IPD). */
export function estaParada(r: Pick<ResumoConversa, "ultimaAutor" | "ultimaEm">, agoraMs: number): boolean {
  return r.ultimaAutor === "contato" && agoraMs - Date.parse(r.ultimaEm) > PARADA_MIN * 60_000;
}

/** "Sem resposta há 3 h". */
export function formatarParada(ultimaEm: string, agoraMs: number): string {
  return `Sem resposta há ${formatarTempo(Math.max(0, Math.round((agoraMs - Date.parse(ultimaEm)) / 60_000)))}`;
}

export function passaNoFiltro(r: ResumoConversa, f: FiltroConversa, agoraMs: number): boolean {
  if (f === "precisa") return r.handoffPendente;
  if (f === "humano") return r.dono === "humano";
  if (f === "robo") return r.dono === "robo";
  if (f === "paradas") return estaParada(r, agoraMs);
  return true;
}

export function semAcento(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR");
}

/** Busca local por nome, empresa ou telefone (com 3 dígitos ou mais). */
export function bateBusca(r: Pick<ResumoConversa, "nome" | "empresa" | "telefoneDigitos">, q: string): boolean {
  const t = semAcento(q.trim());
  if (!t) return true;
  if (semAcento(r.nome).includes(t) || semAcento(r.empresa).includes(t)) return true;
  const digitos = q.replace(/\D/g, "");
  return /^[\d\s()+.-]+$/.test(q.trim()) && digitos.length >= 3 && r.telefoneDigitos.includes(digitos);
}

export function filtrarConversas(itens: ResumoConversa[], o: Pick<EstadoUrlConversas, "filtro" | "q" | "tipo">, agoraMs: number): ResumoConversa[] {
  return itens.filter((r) => (o.tipo === "todos" || r.tipo === o.tipo) && passaNoFiltro(r, o.filtro, agoraMs) && bateBusca(r, o.q));
}

/** Quantas conversas em cada filtro (com o tipo escolhido, sem a busca). */
export function contarPorFiltro(itens: ResumoConversa[], tipo: TipoFiltroConversa, agoraMs: number): Record<FiltroConversa, number> {
  const c: Record<FiltroConversa, number> = { todas: 0, precisa: 0, humano: 0, robo: 0, paradas: 0 };
  for (const r of itens) {
    if (tipo !== "todos" && r.tipo !== tipo) continue;
    for (const f of FILTROS_CONVERSA) if (passaNoFiltro(r, f, agoraMs)) c[f] += 1;
  }
  return c;
}

export type NomesConversa = { nomeRobo: string; operadores: Pick<Operador, "id" | "nome">[]; euId?: string | null };

export function nomeDoOperador(operadores: Pick<Operador, "id" | "nome">[], id: string | null | undefined, euId?: string | null): string {
  if (id && euId && id === euId) return "Você";
  return (id && operadores.find((o) => o.id === id)?.nome) || "Equipe";
}

/** Texto da linha: "<robô>: …", "Você: …", "<pessoa>: …" ou só o que o contato escreveu. */
export function previaUltima(r: Pick<ResumoConversa, "ultimaAutor" | "ultimaTexto" | "ultimaAviso" | "ultimaOperadorId">, n: NomesConversa): string {
  const t = r.ultimaTexto.replace(/\s+/g, " ").trim() || "Mensagem sem texto";
  if (r.ultimaAutor === "contato") return t;
  if (r.ultimaAviso) return `Aviso automático: ${t}`;
  if (r.ultimaAutor === "robo") return `${n.nomeRobo}: ${t}`;
  return `${nomeDoOperador(n.operadores, r.ultimaOperadorId, n.euId)}: ${t}`;
}

/** "Com você", "Com Otávio" ou "Com uma pessoa" quando um humano conduz. */
export function comQuem(operadorId: string | null, n: NomesConversa): string {
  if (operadorId && n.euId && operadorId === n.euId) return "Com você";
  const nome = operadorId ? n.operadores.find((o) => o.id === operadorId)?.nome : null;
  return nome ? `Com ${nome}` : "Com uma pessoa";
}

// ───────── Teclado ─────────

export type AcaoTeclado = "proxima" | "anterior" | "primeira" | "ultima" | "buscar" | "fecharContexto";

/**
 * Atalhos da tela. J/K e "/" só com o foco dentro da tela de Conversas (atalho de uma tecla não
 * fica solto na página); setas, Home e End só com o foco na lista; Esc recolhe o contexto.
 * Digitando, com modificador, diálogo aberto ou evento já tratado, não faz nada.
 */
export function acaoDoTeclado(e: {
  tecla: string;
  meta?: boolean;
  ctrl?: boolean;
  alt?: boolean;
  editavel: boolean;
  naLista: boolean;
  dialogoAberto: boolean;
  naTela: boolean;
  jaTratado?: boolean;
}): AcaoTeclado | null {
  if (e.jaTratado || e.meta || e.ctrl || e.alt || e.dialogoAberto || e.editavel) return null;
  const k = e.tecla.length === 1 ? e.tecla.toLowerCase() : e.tecla;
  if (k === "Escape") return e.naTela ? "fecharContexto" : null;
  if (!e.naTela) return null;
  if (k === "j") return "proxima";
  if (k === "k") return "anterior";
  if (k === "/") return "buscar";
  if (!e.naLista) return null;
  if (k === "ArrowDown") return "proxima";
  if (k === "ArrowUp") return "anterior";
  if (k === "Home") return "primeira";
  if (k === "End") return "ultima";
  return null;
}

/** Próximo índice, sem dar a volta. Sem item atual: J/↓ vai ao primeiro, K/↑ ao último. */
export function moverNaLista(n: number, atual: number, acao: Exclude<AcaoTeclado, "buscar" | "fecharContexto">): number | null {
  if (n <= 0) return null;
  if (acao === "primeira") return 0;
  if (acao === "ultima") return n - 1;
  if (atual < 0 || atual >= n) return acao === "proxima" ? 0 : n - 1;
  const i = acao === "proxima" ? atual + 1 : atual - 1;
  return i < 0 || i >= n ? null : i;
}

/** scrollTop mínimo para o item ficar inteiro à vista (equivale a block: "nearest"). */
export function rolagemParaMostrar(r: { scrollTop: number; clientHeight: number }, item: { top: number; height: number }, regiaoTop: number): number {
  const topo = item.top - regiaoTop;
  if (topo < 0) return r.scrollTop + topo;
  const fundo = topo + item.height - r.clientHeight;
  return fundo > 0 ? r.scrollTop + fundo : r.scrollTop;
}

/** scrollTop que põe o item no centro da região. */
export function rolagemParaCentralizar(r: { scrollTop: number; clientHeight: number; scrollHeight: number }, item: { top: number; height: number }, regiaoTop: number): number {
  const alvo = r.scrollTop + (item.top - regiaoTop) - (r.clientHeight - item.height) / 2;
  return Math.max(0, Math.min(alvo, r.scrollHeight - r.clientHeight));
}

// ───────── Datas (fuso do navegador; `tz` fixa o fuso nos testes) ─────────

function chaveDia(d: Date, tz?: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function diasEntre(a: string, b: string): number {
  const [ya, ma, da] = a.split("-").map(Number);
  const [yb, mb, db] = b.split("-").map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86_400_000);
}

export function horaCurta(iso: string, tz?: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

/** Separador de dia: "Hoje", "Ontem", "segunda-feira" (até 6 dias), "3 de novembro" (e o ano, se outro). */
export function rotuloDia(iso: string, agora: Date = new Date(), tz?: string): string {
  const d = new Date(iso);
  const n = diasEntre(chaveDia(d, tz), chaveDia(agora, tz));
  if (n === 0) return "Hoje";
  if (n === 1) return "Ontem";
  if (n > 1 && n < 7) return new Intl.DateTimeFormat("pt-BR", { timeZone: tz, weekday: "long" }).format(d);
  const mesmoAno = chaveDia(d, tz).slice(0, 4) === chaveDia(agora, tz).slice(0, 4);
  return new Intl.DateTimeFormat("pt-BR", { timeZone: tz, day: "numeric", month: "long", ...(mesmoAno ? {} : { year: "numeric" }) }).format(d);
}

/** Hora da última mensagem na lista: "14:32" hoje, "Ontem", "seg." na semana, "03/11" antes. */
export function rotuloQuando(iso: string, agora: Date = new Date(), tz?: string): string {
  const d = new Date(iso);
  const n = diasEntre(chaveDia(d, tz), chaveDia(agora, tz));
  if (n <= 0) return horaCurta(iso, tz);
  if (n === 1) return "Ontem";
  if (n < 7) return new Intl.DateTimeFormat("pt-BR", { timeZone: tz, weekday: "short" }).format(d);
  return new Intl.DateTimeFormat("pt-BR", { timeZone: tz, day: "2-digit", month: "2-digit" }).format(d);
}

/** "há 3 dias", "há 2 h", "agora há pouco". */
export function haQuanto(iso: string, agora: Date = new Date()): string {
  const min = Math.max(0, Math.floor((agora.getTime() - Date.parse(iso)) / 60_000));
  if (min < 2) return "agora há pouco";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "há 1 dia" : `há ${d} dias`;
}

// ───────── Conversa ─────────

export type AutorBalao = { tipo: "robo"; nome: string } | { tipo: "humano"; nome: string } | { tipo: "lead"; nome: string };

/** Quem escreveu, para o balão. A pessoa logada aparece como "Você"; aviso de troca é "Aviso automático". */
export function autorDoBalao(m: Pick<Mensagem, "autor" | "aviso" | "operadorId">, nomeContato: string, n: NomesConversa): AutorBalao {
  if (m.autor === "contato") return { tipo: "lead", nome: nomeContato };
  if (m.aviso) return { tipo: "humano", nome: "Aviso automático" };
  if (m.autor === "robo") return { tipo: "robo", nome: n.nomeRobo };
  return { tipo: "humano", nome: nomeDoOperador(n.operadores, m.operadorId, n.euId) };
}

export type EventoConversa = { tipo: "msg"; em: string; m: Mensagem } | { tipo: "ligacao"; em: string; l: Ligacao };

/** Mensagens e ligações do contato numa linha só, da mais antiga para a mais nova. */
export function eventosDaConversa(mensagens: Mensagem[], ligacoes: Ligacao[]): EventoConversa[] {
  const ev: EventoConversa[] = [
    ...mensagens.map((m) => ({ tipo: "msg" as const, em: m.em, m })),
    ...ligacoes.map((l) => ({ tipo: "ligacao" as const, em: l.iniciouEm, l })),
  ];
  return ev.sort((a, b) => (a.em < b.em ? -1 : a.em > b.em ? 1 : 0));
}

/** Quantas mensagens a conversa mostra de cada vez ("carregar anteriores" soma mais estas). */
export const PAGINA_CONVERSA = 100;

/** Janela das mais recentes: devolve o índice de início e se há anteriores escondidas. */
export function janelaRecente(total: number, limite: number): { inicio: number; temAnteriores: boolean; mostrando: number } {
  const inicio = Math.max(0, total - Math.max(0, limite));
  return { inicio, temAnteriores: inicio > 0, mostrando: total - inicio };
}

export type ItemThread =
  | { tipo: "msg"; chave: string; autor: AutorBalao; direcao: "in" | "out"; hora: string; texto: string; agrupada: boolean }
  | { tipo: "ligacao"; chave: string; hora: string; segundos: number; quem?: string; resultado: Ligacao["resultado"]; resumo?: string };

export type BlocoThread = { chave: string; dia: string; rotulo: string; primeiroDoDia: boolean; itens: ItemThread[] };

/** Itens por bloco: corta a cada dia e a cada `porBloco` (o navegador pula a pintura do que está fora da tela). */
export const ITENS_POR_BLOCO = 40;
const AGRUPAR_MS = 5 * 60_000;

function chaveDoAutor(a: AutorBalao): string {
  return `${a.tipo}:${a.nome}`;
}

/**
 * Monta a conversa: separador por dia, ligação como "Ligação · N min", balões agrupados quando a
 * mesma pessoa escreve em sequência (até 5 min).
 */
export function montarBlocos(
  eventos: EventoConversa[],
  ctx: NomesConversa & { nomeContato: string; agora: number; porBloco?: number; tz?: string },
): BlocoThread[] {
  const porBloco = ctx.porBloco ?? ITENS_POR_BLOCO;
  const agoraD = new Date(ctx.agora);
  const blocos: BlocoThread[] = [];
  let atual: BlocoThread | null = null;
  let anterior: { chave: string; em: number; direcao: string } | null = null;

  const abrir = (iso: string, chaveItem: string): BlocoThread => {
    const dia = chaveDia(new Date(iso), ctx.tz);
    const mudouDia = !atual || atual.dia !== dia;
    if (mudouDia || (atual && atual.itens.length >= porBloco)) {
      atual = { chave: `b-${chaveItem}`, dia, rotulo: rotuloDia(iso, agoraD, ctx.tz), primeiroDoDia: mudouDia, itens: [] };
      blocos.push(atual);
      if (mudouDia) anterior = null;
    }
    return atual as BlocoThread;
  };

  for (const e of eventos) {
    if (e.tipo === "ligacao") {
      const l = e.l;
      const b = abrir(l.iniciouEm, l.id);
      b.itens.push({
        tipo: "ligacao",
        chave: l.id,
        hora: horaCurta(l.iniciouEm, ctx.tz),
        segundos: l.resultado === "atendeu" ? l.duracaoSeg : 0,
        quem: l.operadorId ? nomeDoOperador(ctx.operadores, l.operadorId, ctx.euId) : undefined,
        resultado: l.resultado,
        resumo: l.resumo.trim() || undefined,
      });
      anterior = null;
      continue;
    }
    const m = e.m;
    const b = abrir(m.em, m.id);
    const autor = autorDoBalao(m, ctx.nomeContato, ctx);
    const chave = chaveDoAutor(autor);
    const direcao = m.autor === "contato" ? "in" : "out";
    const em = Date.parse(m.em);
    const agrupada = Boolean(anterior && anterior.chave === chave && anterior.direcao === direcao && em - anterior.em < AGRUPAR_MS);
    b.itens.push({ tipo: "msg", chave: m.id, autor, direcao, hora: horaCurta(m.em, ctx.tz), texto: m.texto.trim() || "Mensagem sem texto", agrupada });
    anterior = { chave, em, direcao };
  }
  return blocos;
}

// ───────── Posse ─────────

export type CondutorTpl = { tipo: "robo" } | { tipo: "voce" } | { tipo: "outro"; nome: string };

export function condutorDe(c: Pick<ContatoCompleto, "dono" | "operadorId">, n: NomesConversa): CondutorTpl {
  if (c.dono !== "humano") return { tipo: "robo" };
  if (c.operadorId && n.euId && c.operadorId === n.euId) return { tipo: "voce" };
  const nome = c.operadorId ? n.operadores.find((o) => o.id === c.operadorId)?.nome : null;
  return { tipo: "outro", nome: nome || "Uma pessoa da equipe" };
}

/** Por que o campo de resposta está bloqueado (ou undefined quando dá para escrever). */
export function motivoBloqueioComposer(c: CondutorTpl, nomeRobo: string, soLeitura: boolean): string | undefined {
  if (soLeitura) return "Seu acesso é só de leitura: dá para ler a conversa, mas não para responder.";
  if (c.tipo === "robo") return `${nomeRobo} está conduzindo. Assuma a conversa para responder.`;
  if (c.tipo === "outro") return `${c.nome} está conduzindo. Assuma a conversa para responder.`;
  return undefined;
}

// ───────── Contexto ─────────

export type MotivoHandoff = {
  desde: string | null;
  minutos: number | null;
  prazoMin: number;
  estourou: boolean;
  /** Motivo que o robô registrou ao passar para uma pessoa (movimento para "Handoff"), se houver. */
  motivo: string | null;
  nota: number | null;
  /** O que o contato escreveu por último antes do pedido. */
  ultimaDoContato: string | null;
};

/** Tira o "Handoff: " e o ponto final que o robô grava no motivo. */
export function limparMotivo(m: string): string {
  return m.replace(/^handoff:\s*/i, "").replace(/\.\s*$/, "").trim();
}

/**
 * "Por que pediu uma pessoa": só existe com handoff pendente. Tudo derivado do estado: há quanto
 * tempo, o prazo da etapa Handoff, o motivo do último movimento do robô para Handoff, a nota
 * e a última mensagem do contato.
 */
export function motivoDoHandoff(c: Pick<ContatoCompleto, "handoffPendente" | "handoffDesde" | "nota" | "movimentos" | "mensagens">, agora: string): MotivoHandoff | null {
  if (!c.handoffPendente) return null;
  const prazoMin = etapaDe("handoff")?.prazoMin ?? 0;
  const minutos = c.handoffDesde ? minutosEntre(c.handoffDesde, agora) : null;
  const mov = [...c.movimentos].reverse().find((m) => m.para === "handoff" && m.por === "robo" && m.motivo && m.motivo.trim());
  const doContato = [...c.mensagens].reverse().find((m) => m.autor === "contato");
  return {
    desde: c.handoffDesde,
    minutos,
    prazoMin,
    estourou: minutos != null && prazoMin > 0 && minutos > prazoMin,
    motivo: mov?.motivo ? limparMotivo(mov.motivo) : null,
    nota: c.nota,
    ultimaDoContato: doContato ? doContato.texto.trim() || null : null,
  };
}

export type ExigenciaMover = "livre" | "motivo" | "briefing";

/**
 * O que mover a oportunidade para `para` exige (regras de comandos.ts `mover`): o briefing antes de
 * "Briefing feito"; um motivo para pular etapa ou voltar.
 */
export function exigenciaParaMover(o: Pick<Oportunidade, "etapa" | "briefing">, para: EtapaId): ExigenciaMover {
  if (para === "briefing" && !o.briefing) return "briefing";
  const de = indiceEtapa(o.etapa);
  const ate = indiceEtapa(para);
  if (ate > de + 1 || ate < de) return "motivo";
  return "livre";
}

/** Para onde dá para mover à mão: etapas que o sistema não move, menos a atual. Oportunidade perdida não se move (reabrir antes). */
export function destinosManuais(o: Pick<Oportunidade, "etapa" | "perdida"> | null): Array<{ id: EtapaId; nome: string }> {
  if (!o || o.perdida) return [];
  return ETAPAS.filter((e) => !e.auto && e.id !== o.etapa && e.id !== "perdido").map((e) => ({ id: e.id, nome: e.nome }));
}

/** Próxima tarefa aberta: a que vence primeiro; sem data vai para o fim. */
export function proximaTarefa(tarefas: Tarefa[]): { tarefa: Tarefa | null; abertas: number } {
  const abertas = tarefas.filter((t) => !t.feita);
  const ordenadas = [...abertas].sort((a, b) => (a.venceEm ?? "9999").localeCompare(b.venceEm ?? "9999"));
  return { tarefa: ordenadas[0] ?? null, abertas: abertas.length };
}

/** Oportunidade principal com o nome da etapa ("Perdida em …" quando perdida). */
export function etapaDoContato(ops: Oportunidade[]): { o: Oportunidade; nome: string; perdida: boolean } | null {
  const o = oportunidadePrincipal(ops);
  if (!o) return null;
  const nome = etapaDe(o.etapa)?.nome ?? o.etapa;
  return { o, nome, perdida: o.perdida };
}

/** Telefone com só os 4 últimos dígitos à vista. */
export function mascararTelefone(t: string): string {
  const d = t.replace(/\D/g, "");
  if (!d) return "";
  if (d.length < 4) return "•••";
  return `••• ${d.slice(-4)}`;
}

/** E-mail com o começo do usuário e o domínio. */
export function mascararEmail(e: string): string {
  const [u, d] = e.split("@");
  if (!e.trim()) return "";
  if (!d) return "•••";
  return `${(u ?? "").slice(0, 2)}•••@${d}`;
}
