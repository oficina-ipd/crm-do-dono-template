/**
 * Ficha (Grafite) · regras PURAS: linha do tempo única (mensagens, ligações, notas, movimentos,
 * tarefas), dados de negócio só com o que tem valor, quem é a pessoa numa linha, briefing e o
 * texto inicial da proposta. Testadas em tests/unit/grafite-ficha.test.ts.
 */
import { etapaDe } from "@/domain/funil";
import { dataHora, formatarReais, oportunidadePrincipal, primeiroNome } from "@/domain/rules";
import type { Briefing, ContatoCompleto, EstadoCRM, Oportunidade, Produto } from "@/domain/types";
import { nomeDoOperador, type NomesConversa } from "../conversas/modelo";

export const TIPOS_EVENTO = ["mensagem", "ligacao", "nota", "movimento", "tarefa"] as const;
export type TipoEvento = (typeof TIPOS_EVENTO)[number];
export type FiltroLinha = TipoEvento | "tudo";

export const ROTULO_FILTRO_LINHA: Record<FiltroLinha, string> = {
  tudo: "Tudo",
  mensagem: "Mensagens",
  ligacao: "Ligações",
  nota: "Notas",
  movimento: "Movimentos",
  tarefa: "Tarefas",
};

export function filtroLinhaValido(v: unknown): FiltroLinha {
  return v === "tudo" || (TIPOS_EVENTO as readonly string[]).includes(String(v)) ? (v as FiltroLinha) : "tudo";
}

export type EventoLinha = { id: string; tipo: TipoEvento; em: string; titulo: string; texto?: string; autor?: string };

function cortar(t: string, n = 180): string {
  const s = t.replace(/\s+/g, " ").trim();
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

const ROTULO_METODO: Record<string, string> = { pix: "Pix", cartao: "cartão", boleto: "boleto" };

/** Quem fez um movimento: robô, "Automático" (sistema) ou o nome do operador. */
export function autorDoMovimento(por: string, n: NomesConversa): string {
  if (por === "robo") return n.nomeRobo;
  if (por === "sistema" || por === "manual") return "Automático";
  return nomeDoOperador(n.operadores, por, n.euId);
}

/**
 * Uma linha do tempo só, da mais recente para a mais antiga. Movimentos: entrada, troca de etapa,
 * perda, troca de quem conduz, proposta, pagamento e ocorrência. Tarefa entra quando foi criada
 * (o template não guarda quando foi concluída: aparece "concluída" no texto).
 */
export function montarLinhaDoTempo(
  c: ContatoCompleto,
  ctx: NomesConversa & { funis: Pick<EstadoCRM["funis"][number], "id" | "nome">[] },
): EventoLinha[] {
  const ev: EventoLinha[] = [];
  const funil = ctx.funis.find((f) => f.id === c.origem)?.nome;
  ev.push({ id: `entrada-${c.id}`, tipo: "movimento", em: c.criadoEm, titulo: funil ? `Chegou pelo funil ${funil}` : "Chegou ao CRM" });

  for (const m of c.mensagens) {
    if (m.aviso) {
      ev.push({ id: `m-${m.id}`, tipo: "movimento", em: m.em, titulo: m.autor === "robo" ? `Conversa voltou para o ${ctx.nomeRobo}` : "Uma pessoa assumiu a conversa", texto: cortar(m.texto) });
      continue;
    }
    const quem = m.autor === "contato" ? c.nome : m.autor === "robo" ? ctx.nomeRobo : nomeDoOperador(ctx.operadores, m.operadorId, ctx.euId);
    ev.push({ id: `m-${m.id}`, tipo: "mensagem", em: m.em, titulo: `Mensagem de ${quem}`, texto: cortar(m.texto || "Mensagem sem texto") });
  }
  for (const e of c.emails) {
    ev.push({ id: `e-${e.id}`, tipo: "mensagem", em: e.em, titulo: `E-mail: ${e.assunto}`, texto: cortar(e.texto), autor: e.enviadoPor ? nomeDoOperador(ctx.operadores, e.enviadoPor, ctx.euId) : undefined });
  }
  for (const l of c.ligacoes) {
    const min = l.resultado === "atendeu" && l.duracaoSeg > 0 ? `${Math.max(1, Math.round(l.duracaoSeg / 60))} min` : l.resultado;
    ev.push({
      id: `l-${l.id}`,
      tipo: "ligacao",
      em: l.iniciouEm,
      titulo: `Ligação · ${min} · ${l.termometroVendedor}`,
      texto: l.resumo.trim() ? cortar(l.resumo) : undefined,
      autor: l.operadorId ? nomeDoOperador(ctx.operadores, l.operadorId, ctx.euId) : undefined,
    });
  }
  for (const n of c.notas) {
    ev.push({ id: `n-${n.id}`, tipo: "nota", em: n.em, titulo: "Nota", texto: n.texto, autor: n.autorId ? nomeDoOperador(ctx.operadores, n.autorId, ctx.euId) : "Sistema" });
  }
  for (const m of c.movimentos) {
    const para = m.para === "perdido" ? null : etapaDe(m.para)?.nome ?? m.para;
    const de = m.de && m.de !== "perdido" ? etapaDe(m.de)?.nome ?? m.de : null;
    const titulo = m.para === "perdido" ? "Oportunidade perdida" : m.de === "perdido" ? `Reaberta em ${para}` : de ? `${de} → ${para}` : `Entrou em ${para}`;
    ev.push({ id: `v-${m.id}`, tipo: "movimento", em: m.em, titulo, texto: m.motivo?.trim() ? cortar(m.motivo) : undefined, autor: autorDoMovimento(m.por, ctx) });
  }
  for (const p of c.propostas) {
    ev.push({ id: `p-${p.id}`, tipo: "movimento", em: p.criadaEm, titulo: "Proposta escrita", texto: cortar(p.texto) });
    if (p.enviadaEm) ev.push({ id: `pe-${p.id}`, tipo: "movimento", em: p.enviadaEm, titulo: `Proposta enviada por ${p.enviadaPor === "email" ? "e-mail" : "WhatsApp"}` });
    if (p.abertaEm) ev.push({ id: `pa-${p.id}`, tipo: "movimento", em: p.abertaEm, titulo: "O contato abriu a proposta" });
  }
  for (const p of c.pagamentos) {
    ev.push({ id: `g-${p.id}`, tipo: "movimento", em: p.criadoEm, titulo: `Link de pagamento (${ROTULO_METODO[p.metodo] ?? p.metodo}) · ${formatarReais(p.valor)}` });
    if (p.pagoEm) ev.push({ id: `gp-${p.id}`, tipo: "movimento", em: p.pagoEm, titulo: "Pagamento confirmado" });
  }
  for (const o of c.ocorrencias) {
    ev.push({ id: `o-${o.id}`, tipo: "movimento", em: o.em, titulo: `Ocorrência registrada (${o.tipo})`, texto: cortar(o.descricao) });
  }
  for (const t of c.tarefas) {
    const detalhe = t.feita ? "Concluída" : t.venceEm ? `Vence ${dataHora(t.venceEm)}` : undefined;
    ev.push({ id: `t-${t.id}`, tipo: "tarefa", em: t.criadaEm, titulo: `Tarefa: ${t.texto}`, texto: detalhe });
  }
  return ev.sort((a, b) => (a.em < b.em ? 1 : a.em > b.em ? -1 : a.id < b.id ? 1 : -1));
}

export function contarPorTipo(ev: EventoLinha[]): Record<FiltroLinha, number> {
  const c: Record<FiltroLinha, number> = { tudo: ev.length, mensagem: 0, ligacao: 0, nota: 0, movimento: 0, tarefa: 0 };
  for (const e of ev) c[e.tipo] += 1;
  return c;
}

export type CampoNegocio = { rotulo: string; valor: string; numero?: boolean };

/** Dados de negócio com valor. Campo vazio não aparece (nada de "Não informado" em série). */
export function camposNegocio(c: ContatoCompleto, estado: Pick<EstadoCRM, "funis" | "produtos">): CampoNegocio[] {
  const out: CampoNegocio[] = [];
  const add = (rotulo: string, v: string | null | undefined, numero = false) => {
    if (v != null && v.trim()) out.push({ rotulo, valor: v.trim(), numero });
  };
  add("Empresa", c.empresa);
  add("Segmento", c.segmento);
  add("Cidade", c.cidade);
  const funil = estado.funis.find((f) => f.id === c.origem);
  add("Origem", funil ? funil.nome : c.origem);
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
