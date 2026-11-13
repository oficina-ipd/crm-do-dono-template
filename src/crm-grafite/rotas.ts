/**
 * Rotas do CRM Grafite (no hash: #/funil, #/contatos/c1?aba=conversa …). Puro, para o app e os testes.
 * Rotas antigas do v3 (/hoje, /leads, /clientes, /buscar, /integracoes, /relatorios) continuam valendo.
 */
export type TelaId =
  | "painel"
  | "fila"
  | "conversas"
  | "ficha"
  | "funil"
  | "pessoas"
  | "tarefas"
  | "agentes"
  | "relance"
  | "resultados"
  | "origem"
  | "metas"
  | "sessao-fechada"
  | "ocorrencias"
  | "ligacoes"
  | "integrar"
  | "produtos"
  | "equipe"
  | "modelos"
  | "playbook"
  | "especimes"
  | "desconhecida";

export type RotaGrafite = { tela: TelaId; id?: string };

const FIXAS: Record<string, TelaId> = {
  "/": "fila",
  "/hoje": "fila",
  "/fila": "fila",
  "/painel": "painel",
  "/conversas": "conversas",
  "/funil": "funil",
  "/pessoas": "pessoas",
  "/leads": "pessoas",
  "/clientes": "pessoas",
  "/contatos": "pessoas",
  "/buscar": "pessoas",
  "/trabalho": "tarefas",
  "/tarefas": "tarefas",
  "/agentes": "agentes",
  "/relance": "relance",
  "/placar": "resultados",
  "/relatorios": "resultados",
  "/resultados": "resultados",
  "/demanda": "origem",
  "/origem": "origem",
  "/config/metas": "metas",
  "/config/sessao-fechada": "sessao-fechada",
  "/config/ocorrencias": "ocorrencias",
  "/ocorrencias": "ocorrencias",
  "/pos-call": "ligacoes",
  "/ligacoes": "ligacoes",
  "/config/integrar": "integrar",
  "/integracoes": "integrar",
  "/config/produtos": "produtos",
  "/config/equipe": "equipe",
  "/config/modelos": "modelos",
  "/config/playbook": "playbook",
  "/especimes": "especimes",
};

export function rotaDoCaminho(caminho: string): RotaGrafite {
  const p = (caminho.split("?")[0] || "/").replace(/\/+$/, "") || "/";
  if (p.startsWith("/contatos/")) {
    const id = decodeURIComponent(p.slice("/contatos/".length));
    return id ? { tela: "ficha", id } : { tela: "pessoas" };
  }
  return { tela: FIXAS[p] ?? "desconhecida" };
}

/** Telas só de gestor (o vendedor vê "sem permissão"). */
export const SO_GESTOR: TelaId[] = ["metas", "sessao-fechada", "ocorrencias", "integrar", "produtos", "equipe", "modelos", "playbook"];
