/**
 * Ficha · "Voltar" devolve à origem (lista com filtros e conversa aberta). PURO e testado.
 * A origem chega em `?de=` (caminho interno do CRM, sem o "#"). Só caminho relativo da mesma
 * origem: sem "//", sem esquema, sem barra invertida.
 */

import { lerUrlConversas, urlConversas } from "../conversas/modelo";

const LIMITE = 600;

/** Caminho interno seguro ou null. Aceita só "/algo?…". */
export function origemSegura(de: string | null | undefined): string | null {
  const t = (de ?? "").trim();
  if (!t || t.length > LIMITE) return null;
  if (!t.startsWith("/") || t.startsWith("//") || t.includes("\\")) return null;
  try {
    const u = new URL(t, "https://crm.invalido");
    if (u.origin !== "https://crm.invalido") return null;
    if (u.pathname.startsWith("/api/")) return null;
    return `${u.pathname}${u.search}`;
  } catch {
    return null;
  }
}

/** Link para a ficha que lembra de onde a pessoa veio. */
export function hrefFichaComOrigem(contatoId: string, origem: string | null): string {
  const base = `/contatos/${encodeURIComponent(contatoId)}`;
  const de = origemSegura(origem);
  return de ? `${base}?de=${encodeURIComponent(de)}` : base;
}

const ROTULOS: Array<[RegExp, string]> = [
  [/^\/conversas(\/|$)/, "Voltar para Conversas"],
  [/^\/(pessoas|leads|clientes|buscar|contatos)(\/|$)/, "Voltar para Pessoas"],
  [/^\/funil(\/|$)/, "Voltar para o Funil"],
  [/^\/(tarefas|trabalho)(\/|$)/, "Voltar para Tarefas"],
  [/^\/(fila|hoje)$/, "Voltar para a Fila"],
  [/^\/(painel)?$/, "Voltar para o Painel"],
];

/** Para onde "Voltar" leva. Com origem válida: ela. Sem origem: Pessoas. */
export function destinoVoltar(de: string | null | undefined): { href: string; rotulo: string; daOrigem: boolean } {
  const o = origemSegura(de);
  if (o) {
    const caminho = o.split("?")[0];
    const rotulo = ROTULOS.find(([re]) => re.test(caminho))?.[1] ?? "Voltar";
    return { href: o, rotulo, daOrigem: true };
  }
  return { href: "/pessoas", rotulo: "Voltar para Pessoas", daOrigem: false };
}

/** Na faixa, o "voltar" mostra só o destino ("Conversas"); o nome acessível segue inteiro. */
export function destinoCurto(rotulo: string): string {
  const curto = rotulo.replace(/^Voltar para (o |a )?/, "");
  return curto ? curto.charAt(0).toUpperCase() + curto.slice(1) : rotulo;
}

/** "Abrir conversa" da ficha: volta para a mesma lista de Conversas (filtro e busca) se veio de lá. */
export function hrefConversaDe(contatoId: string, de: string | null | undefined): string {
  const o = origemSegura(de);
  if (o && /^\/conversas(\?|$)/.test(o)) {
    const e = lerUrlConversas(new URLSearchParams(o.split("?")[1] ?? ""));
    return urlConversas({ ...e, c: contatoId });
  }
  return urlConversas({ filtro: "todas", q: "", tipo: "todos", c: contatoId });
}
