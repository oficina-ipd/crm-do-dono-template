/**
 * Pessoas (Grafite): regras puras da tabela (linhas a partir do estado, filtros, ordenação,
 * página progressiva, URL e rotas antigas). Sem React, para a tela e os testes usarem as mesmas regras.
 *
 * Tipo na tela: Lead ou Cliente (no domínio, `categoria`; "prospect" conta como Lead aqui,
 * como no `contatosLinhaDe` do template).
 */
import { ETAPAS_CLIENTE } from "@/domain/funil";
import type { ContatoCompleto, EstadoCRM, EtapaId } from "@/domain/types";
import { oportunidadePrincipal } from "@/domain/rules";
import { rotuloOrigem } from "@/lib/crm/rotulos";
import { chaveConduz, rotuloConduz, semAcento } from "../funil/logica";

export type TipoPessoa = "lead" | "cliente";

export type SituacaoPessoa = "aberta" | "ganha" | "perdida" | "sem";

export type PessoaLinha = {
  id: string;
  nome: string;
  empresa: string | null;
  email: string | null;
  telefone: string | null;
  tipo: TipoPessoa;
  situacao: SituacaoPessoa;
  etapa: { id: EtapaId; nome: string; ordem: number } | null;
  ultimaConversa: string | null;
  conduzChave: string;
  conduz: string;
  origem: string;
  origemRotulo: string;
  criadoEm: string;
};

type EtapaRef = { id: EtapaId; nome: string };

/** Uma linha por contato, com a oportunidade principal (a primeira viva; senão a última). */
export function pessoasDoEstado(
  estado: Pick<EstadoCRM, "operadores" | "config" | "funis">,
  contatos: ContatoCompleto[],
  etapas: EtapaRef[],
): PessoaLinha[] {
  const ordem = new Map(etapas.map((e, i) => [e.id, { ...e, ordem: i }]));
  const funis = new Map(estado.funis.map((f) => [f.id, f.nome]));
  return contatos.map((c) => {
    const o = oportunidadePrincipal(c.oportunidades);
    const etapa = o ? (ordem.get(o.etapa) ?? null) : null;
    const situacao: SituacaoPessoa = !o ? "sem" : o.perdida ? "perdida" : ETAPAS_CLIENTE.includes(o.etapa) ? "ganha" : "aberta";
    const ultima = c.mensagens.length ? c.mensagens[c.mensagens.length - 1].em : null;
    const origem = (c.origem ?? "").trim();
    return {
      id: c.id,
      nome: c.nome,
      empresa: c.empresa?.trim() || null,
      email: c.email?.trim() || null,
      telefone: c.telefone?.trim() || null,
      tipo: c.categoria === "cliente" ? "cliente" : "lead",
      situacao,
      etapa: situacao === "sem" ? null : etapa,
      ultimaConversa: ultima,
      conduzChave: chaveConduz(c),
      conduz: rotuloConduz(c, estado),
      origem,
      origemRotulo: origem ? (funis.get(origem) ?? rotuloOrigem(origem)) : "Sem origem",
      criadoEm: c.criadoEm,
    };
  });
}

/** Texto da coluna Etapa: a etapa da oportunidade principal, "Perdida" ou "Sem oportunidade". */
export function rotuloEtapaPessoa(p: Pick<PessoaLinha, "situacao" | "etapa">): { texto: string; tom: "etapa" | "sucesso" | "discreto" } {
  if (p.situacao === "aberta") return { texto: p.etapa?.nome ?? "Oportunidade aberta", tom: "etapa" };
  if (p.situacao === "ganha") return { texto: p.etapa?.nome ?? "Ganha", tom: "sucesso" };
  if (p.situacao === "perdida") return { texto: p.etapa ? `Perdida em ${p.etapa.nome}` : "Perdida", tom: "discreto" };
  return { texto: "Sem oportunidade", tom: "discreto" };
}

// ───────── Filtros ─────────

export type FiltrosPessoas = {
  q: string;
  tipo: "todos" | TipoPessoa;
  /** Id da etapa da oportunidade principal (aberta), "perdida", ou "todas". */
  etapa: string;
  /** "todos", "robo", id do operador ou "equipe". */
  conduz: string;
};

export const FILTROS_PESSOAS_PADRAO: FiltrosPessoas = { q: "", tipo: "todos", etapa: "todas", conduz: "todos" };

export function filtrosAtivosPessoas(f: FiltrosPessoas): number {
  return (f.q.trim() ? 1 : 0) + (f.tipo !== "todos" ? 1 : 0) + (f.etapa !== "todas" ? 1 : 0) + (f.conduz !== "todos" ? 1 : 0);
}

const digitos = (t: string) => t.replace(/\D/g, "");

/** Nome, empresa, e-mail ou dígitos do WhatsApp (4 ou mais). O resultado continua mascarado. */
export function casaBusca(p: Pick<PessoaLinha, "nome" | "empresa" | "email" | "telefone">, q: string): boolean {
  const t = q.trim();
  if (!t) return true;
  const termo = semAcento(t);
  if (semAcento(`${p.nome} ${p.empresa ?? ""} ${p.email ?? ""}`).includes(termo)) return true;
  const d = digitos(t);
  return d.length >= 4 && d.length === t.replace(/[\s()+-]/g, "").length && digitos(p.telefone ?? "").includes(d);
}

export function filtrarPessoas(linhas: PessoaLinha[], f: FiltrosPessoas): PessoaLinha[] {
  return linhas.filter((p) => {
    if (f.tipo !== "todos" && p.tipo !== f.tipo) return false;
    if (f.etapa === "perdida" && p.situacao !== "perdida") return false;
    if (f.etapa !== "todas" && f.etapa !== "perdida" && (p.situacao === "perdida" || p.situacao === "sem" || p.etapa?.id !== f.etapa)) return false;
    if (f.conduz !== "todos" && p.conduzChave !== f.conduz) return false;
    return casaBusca(p, f.q);
  });
}

/** Opções de "quem conduz" a partir das linhas: o robô primeiro, depois as pessoas por nome. */
export function opcoesConduzPessoas(linhas: Pick<PessoaLinha, "conduzChave" | "conduz">[]): Array<{ valor: string; rotulo: string; n: number }> {
  const m = new Map<string, { rotulo: string; n: number }>();
  for (const l of linhas) {
    const a = m.get(l.conduzChave);
    if (a) a.n += 1;
    else m.set(l.conduzChave, { rotulo: l.conduz, n: 1 });
  }
  return [...m.entries()]
    .map(([valor, v]) => ({ valor, ...v }))
    .sort((a, b) => (a.valor === "robo" ? -1 : b.valor === "robo" ? 1 : a.rotulo.localeCompare(b.rotulo, "pt-BR")));
}

// ───────── Ordenação ─────────

export const COLUNAS_ORDENAVEIS = ["nome", "tipo", "etapa", "conversa", "conduz", "origem", "criado"] as const;
export type ColunaOrdenavel = (typeof COLUNAS_ORDENAVEIS)[number];
export type OrdemPessoas = { coluna: ColunaOrdenavel; direcao: "asc" | "desc" };
export const ORDEM_PADRAO: OrdemPessoas = { coluna: "criado", direcao: "desc" };

/** Valor de comparação por coluna; null fica sempre no fim, nas duas direções. */
function chaveOrdem(p: PessoaLinha, c: ColunaOrdenavel): string | number | null {
  switch (c) {
    case "nome":
      return semAcento(p.nome);
    case "tipo":
      return p.tipo;
    case "etapa":
      // ordem do funil; perdidas depois das abertas, sem oportunidade no fim
      return p.situacao === "sem" ? null : (p.situacao === "perdida" ? 100 : 0) + (p.etapa?.ordem ?? 50);
    case "conversa":
      return p.ultimaConversa;
    case "conduz":
      return semAcento(p.conduz);
    case "origem":
      return p.origem ? semAcento(p.origemRotulo) : null;
    case "criado":
      return p.criadoEm;
  }
}

export function ordenarPessoas(linhas: PessoaLinha[], o: OrdemPessoas): PessoaLinha[] {
  const s = o.direcao === "asc" ? 1 : -1;
  return [...linhas].sort((a, b) => {
    const va = chaveOrdem(a, o.coluna);
    const vb = chaveOrdem(b, o.coluna);
    if (va === null && vb !== null) return 1;
    if (vb === null && va !== null) return -1;
    if (va !== null && vb !== null && va !== vb) {
      if (typeof va === "string" && typeof vb === "string") return va.localeCompare(vb, "pt-BR") * s;
      return (va < vb ? -1 : 1) * s;
    }
    return a.id < b.id ? -s : a.id > b.id ? s : 0;
  });
}

// ───────── Página progressiva ─────────

export const PAGINA_PESSOAS = 50;

/** Quantas linhas mostrar: múltiplo da página, nunca abaixo de uma página. */
export function limiteValido(n: unknown): number {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v) || v < PAGINA_PESSOAS) return PAGINA_PESSOAS;
  return Math.ceil(v / PAGINA_PESSOAS) * PAGINA_PESSOAS;
}

// ───────── URL e rotas antigas ─────────

type LeitorUrl = { get(k: string): string | null };

export function tipoDaUrl(v: string | null): FiltrosPessoas["tipo"] {
  if (v === "lead") return "lead";
  if (v === "cliente" || v === "member") return "cliente";
  return "todos";
}

/**
 * Filtros a partir do caminho e da query. As rotas antigas caem aqui: /leads pré-seleciona Lead,
 * /clientes pré-seleciona Cliente; /buscar e /contatos abrem com todos. `?q=` vira a busca.
 */
export function filtrosDoCaminho(caminho: string, sp: LeitorUrl): FiltrosPessoas {
  const p = caminho.replace(/\/+$/, "");
  const tipoRota: FiltrosPessoas["tipo"] = p === "/leads" ? "lead" : p === "/clientes" ? "cliente" : "todos";
  const etapa = (sp.get("etapa") ?? "").trim();
  const conduz = (sp.get("conduz") ?? "").trim();
  return {
    q: (sp.get("q") ?? "").slice(0, 80),
    tipo: tipoRota !== "todos" ? tipoRota : tipoDaUrl(sp.get("tipo")),
    etapa: etapa && /^[a-z_]{1,32}$/.test(etapa) ? etapa : "todas",
    conduz: conduz && /^[\w-]{1,64}$/.test(conduz) ? conduz : "todos",
  };
}

export function ordemDaUrl(v: string | null | undefined): OrdemPessoas {
  const [c, d] = String(v ?? "").split(".");
  if (!(COLUNAS_ORDENAVEIS as readonly string[]).includes(c)) return ORDEM_PADRAO;
  return { coluna: c as ColunaOrdenavel, direcao: d === "desc" ? "desc" : "asc" };
}

/** Query string (sem "?") só com o que difere do padrão. */
export function urlDePessoas(f: FiltrosPessoas, o: OrdemPessoas = ORDEM_PADRAO): string {
  const p = new URLSearchParams();
  if (f.tipo !== "todos") p.set("tipo", f.tipo);
  if (f.etapa !== "todas") p.set("etapa", f.etapa);
  if (f.conduz !== "todos") p.set("conduz", f.conduz);
  if (f.q.trim()) p.set("q", f.q.trim());
  if (o.coluna !== ORDEM_PADRAO.coluna || o.direcao !== ORDEM_PADRAO.direcao) p.set("ordem", `${o.coluna}.${o.direcao}`);
  return p.toString();
}

export function hrefFichaPessoa(id: string, de: string): string {
  return `/contatos/${encodeURIComponent(id)}?de=${encodeURIComponent(de)}`;
}

// ───────── Datas e telefone ─────────

const TZ = "America/Sao_Paulo";

/** "há 12 min", "há 3 h", "há 2 d"; depois de uma semana, a data (20/10 ou 20/10/2025). */
export function quandoCurto(iso: string, agora: Date): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const min = Math.max(0, Math.floor((agora.getTime() - t) / 60_000));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  if (min < 60 * 24) return `há ${Math.floor(min / 60)} h`;
  if (min < 60 * 24 * 7) return `há ${Math.floor(min / (60 * 24))} d`;
  const mesmoAno = new Date(t).getUTCFullYear() === agora.getUTCFullYear();
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", ...(mesmoAno ? {} : { year: "numeric" }) }).format(new Date(t));
}

/** 20/10/2026 no horário de Brasília. */
export function dataCurta(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

/** WhatsApp revelado legível: 5511900001234 → +55 11 90000-1234; (62) 90000-0001 fica como veio. */
export function telefoneLegivel(v: string): string {
  const d = v.replace(/\D/g, "");
  const m = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(d);
  return m ? `+55 ${m[1]} ${m[2]}-${m[3]}` : v;
}
