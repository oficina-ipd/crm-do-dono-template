/**
 * Funil (Grafite): regras puras do quadro (cartões a partir do estado, filtros, agrupamento,
 * "Mover para…", taxa por etapa e URL). Sem React, para a tela e os testes usarem as mesmas regras.
 *
 * As regras de movimento continuam no domínio (`src/domain/comandos.ts`): aqui só se decide o
 * que o menu oferece. Se o domínio recusar (ex.: briefing sem dor, meta e data), o aviso de erro
 * do próprio `despachar` explica.
 */
import { ETAPAS } from "@/domain/funil";
import type { EstadoCRM, Etapa, EtapaId, Oportunidade } from "@/domain/types";
import { cardsFunilDe } from "@/lib/crm/adapters";
import { amostraPequena, type TaxaEtapa } from "@/lib/crm/domain";
import type { TaxasFunil } from "@/lib/crm/queries";

// ───────── Cartões ─────────

export type CartaoFunil = {
  /** Id da oportunidade. */
  id: string;
  etapa: EtapaId;
  etapaDesde: string;
  contatoId: string;
  contatoNome: string;
  empresa: string | null;
  valor: number;
  /** Próximo passo gravado na oportunidade (aparece quando não há tarefa aberta). */
  proximaAcao: string | null;
  /** Mesma regra do template (`cardsFunilDe`): em Oferta há mais de 2 dias. */
  bateuNaTrave: boolean;
  /** "robo", id do operador, ou "equipe" (humano sem operador definido). */
  conduzChave: string;
  /** Quem conduz, já em texto: o nome do robô ou o da pessoa. */
  conduz: string;
  proximaTarefa: { titulo: string; venceEm: string | null } | null;
  temBriefing: boolean;
};

/** Oportunidade perdida depois de chegar em Oferta: sai do quadro, mas o filtro "Bateu na trave" mostra. */
export type PerdidaNaTrave = {
  oportunidadeId: string;
  contatoId: string;
  contatoNome: string;
  motivo: string | null;
  valor: number;
  /** Quando foi marcada como perdida (do histórico), ou null se o histórico não tiver. */
  desde: string | null;
};

export const ETAPA_TRAVE: EtapaId = "oferta";

type Pessoa = { dono: "robo" | "humano"; operadorId: string | null };

export function chaveConduz(c: Pessoa): string {
  if (c.dono === "robo") return "robo";
  return c.operadorId ?? "equipe";
}

export function rotuloConduz(c: Pessoa, estado: Pick<EstadoCRM, "operadores" | "config">): string {
  if (c.dono === "robo") return estado.config.nomeRobo;
  const op = c.operadorId ? estado.operadores.find((o) => o.id === c.operadorId) : null;
  return op?.nome ?? "Equipe";
}

/** Tarefa aberta mais urgente: com data primeiro (a mais cedo), depois as sem data. */
export function proximaTarefaDe(tarefas: EstadoCRM["tarefas"], contatoId: string): CartaoFunil["proximaTarefa"] {
  const abertas = tarefas.filter((t) => t.contatoId === contatoId && !t.feita);
  if (abertas.length === 0) return null;
  const t = [...abertas].sort((a, b) => {
    if (a.venceEm && b.venceEm) return a.venceEm.localeCompare(b.venceEm);
    if (a.venceEm) return -1;
    if (b.venceEm) return 1;
    return a.criadaEm.localeCompare(b.criadaEm);
  })[0];
  return { titulo: t.texto, venceEm: t.venceEm };
}

/** Um cartão por oportunidade aberta (não perdida), com quem conduz e a próxima tarefa. */
export function cartoesDoEstado(estado: EstadoCRM, agoraIso: string): CartaoFunil[] {
  const contatos = new Map(estado.contatos.map((c) => [c.id, c]));
  const opps = new Map(estado.oportunidades.map((o) => [o.id, o]));
  return cardsFunilDe(estado, agoraIso).map((card) => {
    const c = contatos.get(card.contatoId);
    const o = opps.get(card.id) as Oportunidade;
    const pessoa: Pessoa = { dono: c?.dono ?? "robo", operadorId: c?.operadorId ?? null };
    return {
      id: card.id,
      etapa: card.etapaId as EtapaId,
      etapaDesde: card.etapaDesde,
      contatoId: card.contatoId,
      contatoNome: card.contatoNome,
      empresa: card.empresa,
      valor: o.valor,
      proximaAcao: card.proximaAcao,
      bateuNaTrave: card.bateuNaTrave,
      conduzChave: chaveConduz(pessoa),
      conduz: rotuloConduz(pessoa, estado),
      proximaTarefa: proximaTarefaDe(estado.tarefas, card.contatoId),
      temBriefing: Boolean(o.briefing),
    };
  });
}

/** Perdidas que chegaram em Oferta (a etapa da trave), da mais recente para a mais antiga. */
export function perdidasNaTraveDe(estado: EstadoCRM): PerdidaNaTrave[] {
  const contatos = new Map(estado.contatos.map((c) => [c.id, c]));
  const quando = new Map<string, string>();
  for (const m of estado.movimentos) {
    if (m.para !== "perdido") continue;
    const atual = quando.get(m.oportunidadeId);
    if (!atual || m.em > atual) quando.set(m.oportunidadeId, m.em);
  }
  return estado.oportunidades
    .filter((o) => o.perdida && o.etapa === ETAPA_TRAVE)
    .map((o) => ({
      oportunidadeId: o.id,
      contatoId: o.contatoId,
      contatoNome: contatos.get(o.contatoId)?.nome ?? "Sem nome",
      motivo: o.motivoPerda,
      valor: o.valor,
      desde: quando.get(o.id) ?? null,
    }))
    .sort((a, b) => (b.desde ?? "").localeCompare(a.desde ?? ""));
}

// ───────── Filtros ─────────

export type FiltrosFunil = {
  q: string;
  /** "todos", "robo", id do operador ou "equipe". */
  conduz: string;
  paradas: boolean;
  trave: boolean;
};

export const FILTROS_FUNIL_PADRAO: FiltrosFunil = { q: "", conduz: "todos", paradas: false, trave: false };

export function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");
}

export function minutosDesde(desde: string, agora: Date): number {
  return Math.max(0, Math.floor((agora.getTime() - new Date(desde).getTime()) / 60_000));
}

/** Passou do prazo da etapa? Etapa sem prazo (0) nunca fica parada. */
export function cartaoParado(c: Pick<CartaoFunil, "etapaDesde">, etapa: Pick<Etapa, "prazoMin"> | undefined, agora: Date): boolean {
  if (!etapa || etapa.prazoMin <= 0) return false;
  return minutosDesde(c.etapaDesde, agora) > etapa.prazoMin;
}

export function filtrosAtivos(f: FiltrosFunil): number {
  return (f.q.trim() ? 1 : 0) + (f.conduz !== "todos" ? 1 : 0) + (f.paradas ? 1 : 0) + (f.trave ? 1 : 0);
}

/** Busca (nome ou empresa, sem acento), quem conduz, só paradas e bateu na trave. */
export function filtrarCartoes(cartoes: CartaoFunil[], etapas: Pick<Etapa, "id" | "prazoMin">[], f: FiltrosFunil, agora: Date): CartaoFunil[] {
  const porId = new Map(etapas.map((e) => [e.id, e]));
  const termo = semAcento(f.q.trim());
  return cartoes.filter((c) => {
    if (termo && !semAcento(`${c.contatoNome} ${c.empresa ?? ""}`).includes(termo)) return false;
    if (f.conduz !== "todos" && c.conduzChave !== f.conduz) return false;
    if (f.trave && !c.bateuNaTrave) return false;
    if (f.paradas && !cartaoParado(c, porId.get(c.etapa), agora)) return false;
    return true;
  });
}

/** Perdidas só aparecem com "Bateu na trave"; "só paradas" e "quem conduz" valem para o que está aberto. */
export function filtrarPerdidas(perdidas: PerdidaNaTrave[], f: FiltrosFunil): PerdidaNaTrave[] {
  if (!f.trave) return [];
  if (f.paradas || f.conduz !== "todos") return [];
  const termo = semAcento(f.q.trim());
  return termo ? perdidas.filter((p) => semAcento(p.contatoNome).includes(termo)) : perdidas;
}

export type ColunaFunil = { etapa: Etapa; cartoes: CartaoFunil[]; soma: number };

/** Uma coluna por etapa, na ordem do funil. Na coluna, quem está há mais tempo na etapa vem primeiro. */
export function agruparPorEtapa(etapas: Etapa[], cartoes: CartaoFunil[]): ColunaFunil[] {
  const por = new Map<string, CartaoFunil[]>();
  for (const c of cartoes) {
    const l = por.get(c.etapa);
    if (l) l.push(c);
    else por.set(c.etapa, [c]);
  }
  return etapas.map((etapa) => {
    const lista = (por.get(etapa.id) ?? []).slice().sort((a, b) => a.etapaDesde.localeCompare(b.etapaDesde) || a.id.localeCompare(b.id));
    return { etapa, cartoes: lista, soma: soma(lista) };
  });
}

export function soma(cartoes: Pick<CartaoFunil, "valor">[]): number {
  return cartoes.reduce((s, c) => s + c.valor, 0);
}

/** Opções de "quem conduz" a partir dos cartões: o robô primeiro, depois as pessoas por nome. */
export function opcoesConduz(cartoes: Pick<CartaoFunil, "conduzChave" | "conduz">[]): Array<{ valor: string; rotulo: string; n: number }> {
  const m = new Map<string, { rotulo: string; n: number }>();
  for (const c of cartoes) {
    const atual = m.get(c.conduzChave);
    if (atual) atual.n += 1;
    else m.set(c.conduzChave, { rotulo: c.conduz, n: 1 });
  }
  return [...m.entries()]
    .map(([valor, v]) => ({ valor, ...v }))
    .sort((a, b) => (a.valor === "robo" ? -1 : b.valor === "robo" ? 1 : a.rotulo.localeCompare(b.rotulo, "pt-BR")));
}

// ───────── Mover para… ─────────

export type OpcoesMover = {
  /** Próxima etapa que dá para mover à mão (uma por vez, só para a frente). */
  avancar: { id: EtapaId; nome: string } | null;
  /** A próxima etapa existe, mas o sistema move (proposta aberta, pagamento, acesso). */
  automatica: { nome: string } | null;
  /** Última etapa: não há para onde avançar. */
  ultima: boolean;
  /** Motivos de perda da etapa atual (escolher um é obrigatório). */
  motivosPerda: string[];
};

/**
 * Mesma regra do domínio (`moverEtapa`): o humano move para a próxima etapa, e as etapas
 * automáticas (`auto`) ficam com o sistema. Pular ou voltar etapa pede motivo e fica na ficha.
 */
export function opcoesMover(etapas: Etapa[], etapaAtual: EtapaId): OpcoesMover {
  const i = etapas.findIndex((e) => e.id === etapaAtual);
  if (i < 0) return { avancar: null, automatica: null, ultima: false, motivosPerda: [] };
  const atual = etapas[i];
  const proxima = etapas[i + 1] ?? null;
  return {
    avancar: proxima && !proxima.auto ? { id: proxima.id, nome: proxima.nome } : null,
    automatica: proxima && proxima.auto ? { nome: proxima.nome } : null,
    ultima: !proxima,
    motivosPerda: atual.motivosPerda,
  };
}

/** "3 d", "5 h", "12 min" (para baixo: 1 d e 23 h ainda é 1 d). */
export function tempoNaEtapa(desde: string, agora: Date): { minutos: number; texto: string } {
  const m = minutosDesde(desde, agora);
  const texto = m < 60 ? `${m} min` : m < 60 * 24 ? `${Math.floor(m / 60)} h` : `${Math.floor(m / (60 * 24))} d`;
  return { minutos: m, texto };
}

/** Etapas do quadro, na ordem do funil (as do template; troque em src/domain/funil.ts). */
export function etapasDoQuadro(): Etapa[] {
  return ETAPAS.filter((e) => e.id !== "perdido");
}

// ───────── Taxa por etapa ─────────

export const JANELAS_TAXA = [1, 7, 14, 30] as const;
export type JanelaTaxa = (typeof JANELAS_TAXA)[number];

export function janelaValida(v: unknown): JanelaTaxa {
  const n = Number(v);
  return (JANELAS_TAXA as readonly number[]).includes(n) ? (n as JanelaTaxa) : 7;
}

export function rotuloJanela(n: number): string {
  return n === 1 ? "Hoje" : `${n} dias`;
}

export type LinhaTaxa = {
  etapaId: string;
  de: string;
  para: string;
  /** Quantas entraram na etapa no período. */
  entraram: number;
  /** % inteira, ou null com amostra pequena (menos de 10 entradas) ou sem entrada. */
  taxa: number | null;
  meta: number;
  abaixoDaMeta: boolean;
  /** % dos últimos 30 dias (para comparar), quando a janela não é 30 e a amostra basta. */
  trintaDias: number | null;
};

const pct = (t: TaxaEtapa | undefined): number | null =>
  !t || t.taxa == null || amostraPequena(t.entraram) ? null : Math.round(t.taxa * 100);

/**
 * Uma linha por etapa que tem meta e uma etapa seguinte. `real` é a janela escolhida e
 * `trinta` os últimos 30 dias (os dois de `taxasFunilDe`, a conta do template).
 */
export function linhasTaxas(etapas: Etapa[], real: TaxasFunil, trinta: TaxasFunil | null): LinhaTaxa[] {
  const r = new Map(real.real.map((t) => [t.etapaId, t]));
  const t30 = new Map((trinta?.real ?? []).map((t) => [t.etapaId, t]));
  const linhas: LinhaTaxa[] = [];
  etapas.forEach((e, i) => {
    const proxima = etapas[i + 1];
    if (!proxima || !(e.meta > 0)) return;
    const atual = r.get(e.id);
    const taxa = pct(atual);
    linhas.push({
      etapaId: e.id,
      de: e.nome,
      para: proxima.nome,
      entraram: atual?.entraram ?? 0,
      taxa,
      meta: e.meta,
      abaixoDaMeta: taxa != null && taxa < e.meta,
      trintaDias: real.janelaDias === 30 ? null : pct(t30.get(e.id)),
    });
  });
  return linhas;
}

// ───────── URL ─────────

type LeitorUrl = { get(k: string): string | null };

export function filtrosDaUrl(sp: LeitorUrl): FiltrosFunil {
  const conduz = (sp.get("conduz") ?? "").trim();
  return {
    q: (sp.get("q") ?? "").slice(0, 80),
    conduz: conduz && /^[\w-]{1,64}$/.test(conduz) ? conduz : "todos",
    paradas: sp.get("paradas") === "1",
    // ?fila=trave era a fila separada do v3; hoje é o mesmo filtro
    trave: sp.get("trave") === "1" || sp.get("fila") === "trave",
  };
}

/** Query string do funil (sem "?"), só com o que difere do padrão. */
export function urlDoFunil(f: FiltrosFunil, extra: { janela?: number; taxas?: boolean } = {}): string {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.conduz !== "todos") p.set("conduz", f.conduz);
  if (f.paradas) p.set("paradas", "1");
  if (f.trave) p.set("trave", "1");
  if (extra.janela && extra.janela !== 7) p.set("janela", String(extra.janela));
  if (extra.taxas) p.set("taxas", "1");
  return p.toString();
}

/** Link da ficha que lembra de onde a pessoa veio (filtros). */
export function hrefFichaDe(contatoId: string, de: string): string {
  return `/contatos/${encodeURIComponent(contatoId)}?de=${encodeURIComponent(de)}`;
}

// ───────── Estado do quadro e contagem ─────────

/**
 * Sem oportunidade aberta é "vazio" (perdidas antigas não contam, a não ser que o filtro as
 * mostre); com abertas e nada passando no filtro, "sem resultado".
 */
export function estadoQuadro(n: { nCartoes: number; nFiltrados: number; nPerdidasVisiveis: number }): "vazio" | "sem-resultado" | "quadro" {
  if (n.nPerdidasVisiveis > 0) return "quadro";
  if (n.nCartoes === 0) return "vazio";
  if (n.nFiltrados === 0) return "sem-resultado";
  return "quadro";
}

/** Faixa do topo: "23 abertas · R$ 68.931". */
export function contagemFaixaFunil(total: number, somaFormatada: string): string {
  return `${total} ${total === 1 ? "aberta" : "abertas"} · ${somaFormatada}`;
}

// ───────── Nova oportunidade ─────────

export type ConferenciaNova = {
  erroNome?: string;
  erroTelefone?: string;
  /** Nome do contato que já tem este WhatsApp (o `criarLead` reaproveita o contato). */
  existente?: string;
  /** O contato já tem oportunidade aberta neste produto: o comando não criaria nada. */
  jaAberta?: string;
};

const digitos = (t: string) => t.replace(/\D/g, "");

/** Confere antes de mandar `criarLead` (mesmas regras do domínio, ditas antes de clicar). */
export function conferirNovaOportunidade(
  estado: Pick<EstadoCRM, "contatos" | "oportunidades">,
  dados: { nome: string; telefone: string; produtoId: string },
): ConferenciaNova {
  const r: ConferenciaNova = {};
  if (!dados.nome.trim()) r.erroNome = "Escreva o nome.";
  const tel = digitos(dados.telefone);
  if (tel.length < 8) {
    r.erroTelefone = tel.length === 0 ? "Escreva o WhatsApp." : "WhatsApp curto demais: confira o DDD e o número.";
    return r;
  }
  const c = estado.contatos.find((x) => digitos(x.telefone) === tel);
  if (!c) return r;
  r.existente = c.nome;
  const aberta = estado.oportunidades.some((o) => o.contatoId === c.id && !o.perdida && (!dados.produtoId || o.produtoId === dados.produtoId));
  if (aberta) r.jaAberta = `Esse WhatsApp é de ${c.nome}, que já tem oportunidade aberta neste produto.`;
  return r;
}

// ───────── Posição do quadro (voltar da ficha) ─────────

export type PosicaoFunil = { busca: string; em: number; esquerda: number; colunas: Record<string, number>; pagina: number };
export const CHAVE_POSICAO_FUNIL = "crm-grafite-funil-posicao";

/** Posição salva ao abrir uma ficha; vale só para a mesma vista (busca) e por 15 minutos. */
export function posicaoFunilValida(bruto: string | null, busca: string, agora: number): PosicaoFunil | null {
  if (!bruto) return null;
  try {
    const p = JSON.parse(bruto) as Partial<PosicaoFunil>;
    if (p.busca !== busca || typeof p.em !== "number" || agora - p.em > 15 * 60_000 || agora < p.em) return null;
    const colunas = p.colunas && typeof p.colunas === "object" ? p.colunas : {};
    return { busca: p.busca, em: p.em, esquerda: Number(p.esquerda) || 0, colunas: colunas as Record<string, number>, pagina: Number(p.pagina) || 0 };
  } catch {
    return null;
  }
}
