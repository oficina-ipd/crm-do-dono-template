/**
 * Navegação da casca, por papel:
 * gestor vê tudo; vendedor não vê os itens marcados `gestor`; tráfego só vê resultados.
 * Puro (sem React), para o servidor, a casca e os testes usarem o mesmo mapa.
 */
import type { IconeV4 } from "./ui/icon";

/** Papel na navegação: gestor (dono) vê tudo; vendedor não vê os itens de gestor; tráfego só resultados. */
export type CrmPapelNav = "gestor" | "vendedor" | "trafego";

export const ROTULO_PAPEL: Record<CrmPapelNav, string> = {
  gestor: "dono",
  vendedor: "vendedor",
  trafego: "tráfego",
};

export type BadgeChave = "fila" | "conversas" | "tarefas";

export type ItemNavV4 = {
  id: string;
  label: string;
  href: string;
  icone: IconeV4;
  /** Rotas antigas que também acendem este item (ex.: /leads e /clientes viram Pessoas). */
  tambem?: string[];
  badge?: BadgeChave;
  /** Contagem em âmbar: "precisa de uma pessoa agora". */
  badgeSuaVez?: boolean;
  gestor?: boolean;
};

export type GrupoNavV4 = { id: string; label: string; itens: ItemNavV4[] };

const FILA: ItemNavV4 = { id: "fila", label: "Fila", href: "/", icone: "fila", badge: "fila", badgeSuaVez: true };
const CONVERSAS: ItemNavV4 = {
  id: "conversas",
  label: "Conversas",
  href: "/conversas",
  icone: "conversas",
  badge: "conversas",
  badgeSuaVez: true,
};
const FUNIL: ItemNavV4 = { id: "funil", label: "Funil", href: "/funil", icone: "funil" };
const PESSOAS: ItemNavV4 = {
  id: "pessoas",
  label: "Pessoas",
  href: "/pessoas",
  icone: "pessoas",
  tambem: ["/leads", "/clientes", "/contatos", "/buscar"],
};
const TAREFAS: ItemNavV4 = { id: "tarefas", label: "Tarefas", href: "/trabalho", icone: "tarefas", badge: "tarefas" };
const AGENTES: ItemNavV4 = { id: "agentes", label: "Agentes", href: "/agentes", icone: "agentes" };
const RELANCE: ItemNavV4 = { id: "relance", label: "Relance", href: "/relance", icone: "relance" };
const RESULTADOS: ItemNavV4 = {
  id: "resultados",
  label: "Resultados",
  href: "/placar",
  icone: "resultados",
  tambem: ["/relatorios"],
};
const ORIGEM: ItemNavV4 = { id: "origem", label: "Origem dos leads", href: "/demanda", icone: "origem" };
const METAS: ItemNavV4 = { id: "metas", label: "Metas", href: "/config/metas", icone: "metas", gestor: true };
const SESSAO: ItemNavV4 = {
  id: "sessao",
  label: "Sessão fechada",
  href: "/config/sessao-fechada",
  icone: "sessao",
  gestor: true,
};
const OCORRENCIAS: ItemNavV4 = {
  id: "ocorrencias",
  label: "Ocorrências",
  href: "/config/ocorrencias",
  icone: "ocorrencias",
  gestor: true,
};

/** Ligações recentes (rota /pos-call). */
const LIGACOES: ItemNavV4 = { id: "ligacoes", label: "Ligações", href: "/pos-call", icone: "telefone" };

/* Configuração do template (só gestor): o que o dono ajusta para o CRM ficar com a cara dele. */
const PRODUTOS: ItemNavV4 = { id: "produtos", label: "Produtos", href: "/config/produtos", icone: "produto", gestor: true };
const EQUIPE: ItemNavV4 = { id: "equipe", label: "Equipe", href: "/config/equipe", icone: "equipe", gestor: true };
const MODELOS: ItemNavV4 = { id: "modelos", label: "Modelos de mensagem", href: "/config/modelos", icone: "modelo", gestor: true };
const PLAYBOOK: ItemNavV4 = { id: "playbook", label: "Playbook", href: "/config/playbook", icone: "livro", gestor: true };

/** Integrações (WhatsApp, IA, MCP e acesso de agentes). Fica no menu do usuário, não na barra lateral. */
export const ITEM_INTEGRACAO: ItemNavV4 = {
  id: "integrar",
  label: "Integrações",
  href: "/config/integrar",
  icone: "integracao",
  tambem: ["/integracoes"],
  gestor: true,
};

export function gruposNavV4(papel: CrmPapelNav, relanceLigado = true, ligacoesLigadas = true): GrupoNavV4[] {
  if (papel === "trafego") {
    return [{ id: "resultados", label: "Resultados", itens: [RESULTADOS, ORIGEM] }];
  }
  const grupos: GrupoNavV4[] = [
    { id: "atender", label: "Atender", itens: [FILA, CONVERSAS] },
    { id: "vender", label: "Vender", itens: [FUNIL, PESSOAS, TAREFAS] },
    { id: "agentes", label: "Agentes", itens: relanceLigado ? [AGENTES, RELANCE] : [AGENTES] },
    { id: "resultados", label: "Resultados", itens: [RESULTADOS, ORIGEM, METAS] },
    { id: "rotina", label: "Rotina", itens: ligacoesLigadas ? [SESSAO, OCORRENCIAS, LIGACOES] : [SESSAO, OCORRENCIAS] },
  ];
  const gestor = papel === "gestor";
  return grupos
    .map((g) => ({ ...g, itens: g.itens.filter((i) => gestor || !i.gestor) }))
    .filter((g) => g.itens.length > 0);
}

export function itensNavV4(papel: CrmPapelNav, relanceLigado = true, ligacoesLigadas = true): ItemNavV4[] {
  return gruposNavV4(papel, relanceLigado, ligacoesLigadas).flatMap((g) => g.itens);
}

/** Itens do menu do usuário que levam a uma tela: a configuração do CRM (só gestor). */
export function itensMenuUsuarioV4(papel: CrmPapelNav): ItemNavV4[] {
  return papel === "gestor" ? [PRODUTOS, EQUIPE, MODELOS, PLAYBOOK, ITEM_INTEGRACAO] : [];
}

function normalizarCaminho(pathBruto: string): string {
  const semQuery = pathBruto.split(/[?#]/)[0] ?? "/";
  const p = semQuery.replace(/^\/crm(?=\/|$)/, "") || "/";
  return p.length > 1 ? p.replace(/\/+$/, "") : p;
}

/** Item ativo pelo caminho: o prefixo mais longo vence; "/" só casa com "/". */
export function idAtivoV4(itens: ItemNavV4[], pathBruto: string): string {
  const path = normalizarCaminho(pathBruto);
  const candidatos = itens.flatMap((i) => [i.href, ...(i.tambem ?? [])].map((href) => ({ id: i.id, href })));
  if (path === "/") return candidatos.find((c) => c.href === "/")?.id ?? "";
  const hit = candidatos
    .filter((c) => c.href !== "/")
    .sort((a, b) => b.href.length - a.href.length)
    .find((c) => path === c.href || path.startsWith(`${c.href}/`));
  return hit?.id ?? "";
}

/** Caminho do cabeçalho de contexto: grupo › item. Vazio quando a rota não está na navegação. */
export function caminhoV4(
  papel: CrmPapelNav,
  pathBruto: string,
  relanceLigado = true,
  ligacoesLigadas = true,
): { grupo: string; item: string } | null {
  const grupos = gruposNavV4(papel, relanceLigado, ligacoesLigadas);
  const itens = grupos.flatMap((g) => g.itens);
  const ativo = idAtivoV4([...itens, ...itensMenuUsuarioV4(papel)], pathBruto);
  const configuracao = itensMenuUsuarioV4(papel).find((i) => i.id === ativo);
  if (configuracao) return { grupo: "Configuração", item: configuracao.label };
  for (const g of grupos) {
    const i = g.itens.find((x) => x.id === ativo);
    if (i) {
      const path = normalizarCaminho(pathBruto);
      if (i.id === "pessoas" && path.startsWith("/contatos/")) return { grupo: "Pessoas", item: "Ficha" };
      return { grupo: g.label, item: i.label };
    }
  }
  return null;
}

/** Destino inicial do papel (o logotipo e o ⌘K "ir para o início" usam). */
export function inicioDoPapel(papel: CrmPapelNav): string {
  return papel === "trafego" ? "/demanda" : "/";
}

export type BadgesNavV4 = Partial<Record<BadgeChave, number>>;

/**
 * Contadores da navegação a partir do que o servidor sabe.
 * Fila e Conversas mostram só os handoffs pendentes (pessoas esperando, em âmbar);
 * tarefas aparecem só em Tarefas, em neutro. Nada é somado nem contado duas vezes.
 */
export function badgesNavV4({ handoffs, tarefas }: { handoffs: number; tarefas: number }): BadgesNavV4 {
  const h = Math.max(0, Math.floor(handoffs || 0));
  const t = Math.max(0, Math.floor(tarefas || 0));
  return { fila: h, conversas: h, tarefas: t };
}

/** Número, cor e rótulo do contador de um item. Âmbar só quando há gente esperando. */
export function badgeDoItemV4(item: ItemNavV4, badges: BadgesNavV4): { n: number; suaVez: boolean; rotulo: string } {
  const n = item.badge ? Math.max(0, badges[item.badge] ?? 0) : 0;
  if (item.badgeSuaVez) return { n, suaVez: n > 0, rotulo: "precisam de você" };
  return { n, suaVez: false, rotulo: item.badge === "tarefas" ? "tarefas para hoje" : "itens" };
}
