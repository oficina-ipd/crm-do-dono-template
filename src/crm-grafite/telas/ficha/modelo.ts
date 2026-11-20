/**
 * Ficha (Grafite) · regras PURAS: dados de negócio só com o que tem valor, quem é a pessoa numa
 * linha, briefing e o texto inicial da proposta. Testadas em tests/unit/grafite-ficha.test.ts.
 * A linha do tempo e o resumo de comportamento (histórico 360) estão em historico.ts.
 */
import { etapaDe } from "@/domain/funil";
import { formatarReais, oportunidadePrincipal, primeiroNome } from "@/domain/rules";
import type { Briefing, ContatoCompleto, EstadoCRM, Oportunidade, Produto } from "@/domain/types";
import { nomeDoOperador, type NomesConversa } from "../conversas/modelo";

/** Quem fez um movimento: robô, "Automático" (sistema) ou o nome do operador. */
export function autorDoMovimento(por: string, n: NomesConversa): string {
  if (por === "robo") return n.nomeRobo;
  if (por === "sistema" || por === "manual") return "Automático";
  return nomeDoOperador(n.operadores, por, n.euId);
}

export type CampoNegocio = { rotulo: string; valor: string; numero?: boolean };

/**
 * Dados de negócio com valor. Campo vazio não aparece (nada de "Não informado" em série).
 * Empresa e origem ficam no bloco Contato (identidade da pessoa), sem repetir aqui.
 */
export function camposNegocio(c: ContatoCompleto, estado: Pick<EstadoCRM, "funis" | "produtos">): CampoNegocio[] {
  const out: CampoNegocio[] = [];
  const add = (rotulo: string, v: string | null | undefined, numero = false) => {
    if (v != null && v.trim()) out.push({ rotulo, valor: v.trim(), numero });
  };
  add("Segmento", c.segmento);
  add("Cidade", c.cidade);
  if (c.nota != null) add("Nota que se deu", `${c.nota} de 10`, true);
  const o = oportunidadePrincipal(c.oportunidades);
  if (o) {
    add("Produto", estado.produtos.find((p) => p.id === o.produtoId)?.nome);
    if (o.valor > 0) add("Valor", formatarReais(o.valor), true);
  }
  const vivas = c.oportunidades.filter((x) => !x.perdida).length;
  if (c.oportunidades.length > 1) add("Oportunidades", `${c.oportunidades.length} (${vivas} em aberto)`, true);
  return out;
}

/** Quem é a pessoa numa linha discreta: empresa · Lead ou Cliente · etapa. */
export function metaDaFicha(c: Pick<ContatoCompleto, "empresa" | "categoria" | "oportunidades">): string {
  const o = oportunidadePrincipal(c.oportunidades);
  const nome = o ? etapaDe(o.etapa)?.nome ?? o.etapa : null;
  const etapa = o && nome ? (o.perdida ? `Perdida em ${nome}` : nome) : null;
  return [c.empresa || null, c.categoria === "cliente" ? "Cliente" : "Lead", etapa].filter(Boolean).join(" · ");
}

// ───────── Briefing ─────────

export type EstadoSalvar = { tipo: "parado" } | { tipo: "salvando" } | { tipo: "salvo"; em: string } | { tipo: "falhou"; erro: string };

/** "Salvando…", "Salvo às 14:32", "Não salvou: …". */
export function rotuloSalvar(e: EstadoSalvar, hora: (iso: string) => string): string {
  if (e.tipo === "salvando") return "Salvando…";
  if (e.tipo === "salvo") return `Salvo às ${hora(e.em)}`;
  if (e.tipo === "falhou") return `Não salvou: ${e.erro}`;
  return "";
}

export function camposPreenchidos(b: Briefing | null): number {
  if (!b) return 0;
  return [b.dor, b.meta, b.data].filter((v) => v.trim()).length;
}

/** O comando exige os três; aqui a mensagem chega antes, em linguagem de dono. */
export function validarBriefing(f: Briefing): { ok: true; briefing: Briefing } | { ok: false; erro: string } {
  const b = { dor: f.dor.trim(), meta: f.meta.trim(), data: f.data.trim() };
  if (!b.dor || !b.meta || !b.data) return { ok: false, erro: "preencha dor, meta e data (os três juntos)." };
  return { ok: true, briefing: b };
}

// ───────── Proposta ─────────

/** Texto inicial da proposta, a partir do briefing. A pessoa edita antes de salvar. */
export function textoInicialProposta(c: Pick<ContatoCompleto, "nome">, o: Pick<Oportunidade, "briefing" | "valor">, produto: Pick<Produto, "nome" | "descricao" | "parcelas"> | null, quem: string | null): string {
  const b = o.briefing;
  const linhas = [
    `${primeiroNome(c.nome)}, pelo que você me contou, a dor hoje é: ${b?.dor ?? "…"}. A meta é: ${b?.meta ?? "…"}, até ${b?.data ?? "…"}.`,
    "",
    `Proposta: ${produto?.nome ?? "…"}${produto?.descricao ? `. ${produto.descricao}` : ""}`,
    "",
    `Investimento: ${formatarReais(o.valor)}${produto?.parcelas ? ` (${produto.parcelas})` : ""}.`,
  ];
  if (quem) linhas.push("", quem);
  return linhas.join("\n");
}

/** Proposta mais recente da oportunidade. */
export function ultimaProposta(c: Pick<ContatoCompleto, "propostas">, oportunidadeId: string) {
  const l = c.propostas.filter((p) => p.oportunidadeId === oportunidadeId);
  return l.length ? l.reduce((a, b) => (b.criadaEm >= a.criadaEm ? b : a)) : null;
}

/** A seção de proposta e pagamento aparece do briefing em diante, ou se já houver proposta ou pagamento. */
export function mostraPropostaPagamento(c: Pick<ContatoCompleto, "propostas" | "pagamentos">, o: Pick<Oportunidade, "id" | "etapa" | "perdida"> | null): boolean {
  if (!o) return false;
  if (c.propostas.some((p) => p.oportunidadeId === o.id) || c.pagamentos.some((p) => p.oportunidadeId === o.id)) return true;
  return !o.perdida && ["briefing", "proposta", "oferta"].includes(o.etapa);
}
