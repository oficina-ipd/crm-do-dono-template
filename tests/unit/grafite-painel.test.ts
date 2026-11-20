import { describe, expect, it } from "vitest";
import { estadoExemplo } from "@/data/exemplo";
import type { EstadoCRM, EtapaId, Mensagem, Movimento, Oportunidade } from "@/domain/types";
import {
  conversasDeHoje,
  conversasNovasPorDia,
  dataDaFaixa,
  diasQueRestam,
  ehAvanco,
  esperaViva,
  etapasComMovimento,
  faixaDeResposta,
  hrefOrigem,
  hrefPeriodo,
  hrefResultados,
  janelaDoPeriodo,
  lerGrafico,
  mediana,
  montarAbertura,
  montarAtividade,
  montarEmails,
  montarFunil,
  montarOrigem,
  montarPrecisa,
  montarRobo,
  noAnterior,
  periodoCurto,
  periodoValido,
  reais,
  saudacao,
  segmentosDeOrigem,
  seriesDoGrafico,
  temposDePrimeiraResposta,
  textoVariacao,
  trechoDe,
  variacao,
  vendasDoMes,
} from "@/crm-grafite/telas/painel/logica";

// sexta, 13/11/2026, 15:00 (hora local)
const AGORA = new Date(2026, 10, 13, 15, 0, 0);
const AGORA_ISO = AGORA.toISOString();
const ha = (min: number) => new Date(AGORA.getTime() - min * 60_000).toISOString();
const em = (mes: number, dia: number, h = 12, m = 0) => new Date(2026, mes, dia, h, m).toISOString();

function base(): EstadoCRM {
  const e = estadoExemplo(AGORA_ISO);
  return { ...e, contatos: [], oportunidades: [], movimentos: [], mensagens: [], tarefas: [], pagamentos: [], emails: [] };
}

const contato = (id: string, extra: Partial<EstadoCRM["contatos"][number]> = {}): EstadoCRM["contatos"][number] => ({
  id,
  nome: `Pessoa ${id}`,
  empresa: "",
  segmento: "",
  cidade: "",
  telefone: "62900000000",
  email: "",
  origem: "perpetuo",
  nota: null,
  dono: "robo",
  operadorId: null,
  handoffPendente: false,
  handoffDesde: null,
  termometro: null,
  criadoEm: ha(60 * 24 * 40),
  ...extra,
});

const op = (id: string, contatoId: string, etapa: EtapaId, extra: Partial<Oportunidade> = {}): Oportunidade => ({
  id,
  contatoId,
  produtoId: "p-comunidade",
  valor: 1000,
  etapa,
  entrouNaEtapaEm: ha(5),
  proximoPasso: "",
  briefing: null,
  perdida: false,
  motivoPerda: null,
  criadaEm: ha(60 * 24 * 40),
  ...extra,
});

let n = 0;
const mov = (oportunidadeId: string, de: EtapaId | null, para: EtapaId, quando: string, motivo: string | null = null): Movimento => ({
  id: `m${++n}`,
  oportunidadeId,
  de,
  para,
  por: "robo",
  em: quando,
  motivo,
});
const msg = (contatoId: string, autor: Mensagem["autor"], quando: string, extra: Partial<Mensagem> = {}): Mensagem => ({
  id: `msg${++n}`,
  contatoId,
  autor,
  texto: "oi",
  em: quando,
  ...extra,
});

describe("período e comparação", () => {
  it("7 dias: começa 6 dias antes de hoje à meia-noite; o anterior são os 7 dias antes, até a mesma hora", () => {
    const j = janelaDoPeriodo("7d", AGORA_ISO);
    expect(new Date(j.inicio)).toEqual(new Date(2026, 10, 7));
    expect(new Date(j.anteriorInicio)).toEqual(new Date(2026, 9, 31));
    expect(new Date(j.anteriorFim)).toEqual(new Date(2026, 10, 6, 15, 0));
    expect(j.descricao).toBe("nos últimos 7 dias");
    expect(noAnterior(j)).toBe("nos 7 dias anteriores");
    expect(periodoCurto(j)).toBe("7 dias");
  });

  it("hoje: compara com ontem até esta hora", () => {
    const j = janelaDoPeriodo("hoje", AGORA_ISO);
    expect(trechoDe(em(10, 12, 14, 59), j)).toBe("anterior");
    expect(trechoDe(em(10, 12, 15, 1), j)).toBeNull();
    expect(trechoDe(em(10, 13, 0, 1), j)).toBe("atual");
    expect(trechoDe(em(10, 13, 15, 1), j)).toBeNull();
    expect(noAnterior(j)).toBe("ontem até esta hora");
  });

  it("mês: o mesmo trecho do mês anterior, sem invadir o atual", () => {
    const j = janelaDoPeriodo("mes", AGORA_ISO);
    expect(new Date(j.inicio)).toEqual(new Date(2026, 10, 1));
    expect(new Date(j.anteriorInicio)).toEqual(new Date(2026, 9, 1));
    expect(noAnterior(j)).toBe("em outubro até o dia 13");
    expect(periodoCurto(j)).toBe("novembro");
    // 31/03 contra fevereiro: para no fim de fevereiro
    const marco = janelaDoPeriodo("mes", new Date(2026, 2, 31, 12).toISOString());
    expect(marco.anteriorFim).toBe(marco.inicio);
  });

  it("período da URL e caminho", () => {
    expect(periodoValido("30d")).toBe("30d");
    expect(periodoValido("ano")).toBe("7d");
    expect(periodoValido(null)).toBe("7d");
    expect(hrefPeriodo("/painel", "7d")).toBe("/painel");
    expect(hrefPeriodo("/", "mes")).toBe("/?periodo=mes");
    expect(hrefOrigem("hoje")).toBe("/demanda?dias=7");
    expect(hrefOrigem("mes")).toBe("/demanda?dias=30");
    expect(hrefResultados("hoje")).toBe("/placar?janela=1");
    expect(hrefResultados("30d")).toBe("/placar");
  });

  it("variação em palavras; sem base não inventa percentual", () => {
    expect(textoVariacao(variacao(30, 24), "nos 7 dias anteriores")).toEqual({ seta: "sobe", mudanca: "25% a mais", base: "eram 24 nos 7 dias anteriores" });
    expect(textoVariacao(variacao(4, 0), "ontem até esta hora")).toEqual({ seta: "sobe", mudanca: "4 a mais", base: "nenhum ontem até esta hora" });
    expect(textoVariacao(variacao(1, 1), "x")?.mudanca).toBe("igual");
    expect(textoVariacao(variacao(null, 3), "x")).toBeNull();
  });

  it("dias que restam contam hoje; o último dia diz só resta hoje", () => {
    expect(diasQueRestam(13, 30)).toBe("faltam 18 dias, contando hoje");
    expect(diasQueRestam(29, 30)).toBe("faltam 2 dias, contando hoje");
    expect(diasQueRestam(30, 30)).toBe("só resta hoje");
  });

  it("formatos de hora, saudação e espera", () => {
    expect(dataDaFaixa(AGORA_ISO)).toBe("Sexta, 13 de nov");
    expect(saudacao(AGORA_ISO)).toBe("Boa tarde");
    expect(saudacao(em(10, 13, 4))).toBe("Boa noite");
    expect(esperaViva(ha(12.5), AGORA, true)).toBe("12 min 30 s");
    expect(esperaViva(ha(12.5), AGORA, false)).toBe("12 min");
    expect(esperaViva(ha(0.5), AGORA, false)).toBe("menos de 1 min");
    expect(esperaViva(ha(190), AGORA, true)).toBe("3 h 10 min");
    expect(mediana([3, 1, 2, 10])).toBe(2.5);
    expect(mediana([])).toBeNull();
  });
});

describe("vendas e receita do mês", () => {
  it("venda = chegada em Pago (uma por oportunidade); receita = pagamentos pagos; compara pagas com pagas no mesmo trecho", () => {
    const e = base();
    e.movimentos = [
      mov("o1", "oferta", "pago", em(10, 2)),
      mov("o1", "oferta", "pago", em(10, 3)), // reaberta: conta uma vez
      mov("o2", "oferta", "pago", em(10, 13, 10)),
      mov("o3", "oferta", "pago", em(9, 5)), // outubro, dentro do trecho
      mov("o4", "oferta", "pago", em(9, 20)), // outubro, fora do trecho
    ];
    e.pagamentos = [
      { id: "p1", oportunidadeId: "o1", valor: 1000, metodo: "pix", status: "pago", linkUrl: null, expiraEm: null, criadoEm: em(10, 2), pagoEm: em(10, 2) },
      { id: "p2", oportunidadeId: "o2", valor: 500, metodo: "pix", status: "pago", linkUrl: null, expiraEm: null, criadoEm: em(10, 13, 9), pagoEm: em(10, 13, 10) },
      { id: "p3", oportunidadeId: "o2", valor: 999, metodo: "pix", status: "falhou", linkUrl: null, expiraEm: null, criadoEm: em(10, 13, 9), pagoEm: null },
      { id: "p4", oportunidadeId: "o3", valor: 300, metodo: "pix", status: "pago", linkUrl: null, expiraEm: null, criadoEm: em(9, 5), pagoEm: em(9, 5) },
    ];
    const v = vendasDoMes(e, AGORA_ISO);
    expect(v.mes).toBe("novembro");
    expect(v.vendas).toBe(2);
    expect(v.vendasHoje).toBe(1);
    expect(v.vendasMesAnterior).toBe(1);
    expect(v.receita).toBe(1500);
    expect(v.receitaMesAnterior).toBe(300);
    expect(v.ticket).toBe(750);
    expect(v.diasNoMes).toBe(30);
    expect(v.ultimoDia).toBe("30/11");
    expect(v.projecaoVendas).toBe(Math.round((2 / 13) * 30));
    expect(v.projecaoReceita).toBe(Math.round((1500 / 13) * 30));
    expect(v.porDia).toHaveLength(13);
    expect(v.porDia[1]).toEqual({ dia: "2026-11-02", vendas: 1, receita: 1000 });
    expect(v.noMesAnterior).toBe("em outubro até o dia 13");
  });

  it("sem venda: sem ticket nem projeção de receita (nada de zero inventado)", () => {
    const v = vendasDoMes(base(), AGORA_ISO);
    expect(v.vendas).toBe(0);
    expect(v.ticket).toBeNull();
    expect(v.projecaoReceita).toBeNull();
  });

  it("gráfico do mês: acumulado e projeção linear, sem meta", () => {
    const e = base();
    e.movimentos = [mov("o1", "oferta", "pago", em(10, 2)), mov("o2", "oferta", "pago", em(10, 13, 10))];
    const s = seriesDoGrafico(vendasDoMes(e, AGORA_ISO), [], AGORA_ISO);
    expect(s.map((x) => x.chave)).toEqual(["receita", "vendas", "conversas"]);
    const vendas = s[1];
    expect(vendas.acumulado).toHaveLength(14);
    expect(vendas.acumulado[1]).toBe(0);
    expect(vendas.acumulado[2]).toBe(1);
    expect(lerGrafico(vendas, 5, 30)).toEqual({ realizado: 1, projecao: (2 / 13) * 30 });
    expect(lerGrafico(vendas, 13, 30).realizado).toBe(2);
  });
});

describe("conversas", () => {
  it("conversa nova = primeira mensagem do contato no dia; aviso não conta", () => {
    const m = [
      msg("a", "contato", em(10, 13, 9)),
      msg("a", "robo", em(10, 13, 9, 1)),
      msg("b", "contato", em(10, 10, 9)),
      msg("b", "contato", em(10, 13, 11)),
      msg("c", "humano", em(10, 13, 8), { aviso: true }),
    ];
    const s = conversasNovasPorDia(m, new Date(2026, 10, 10).getTime(), AGORA_ISO);
    expect(s.map((x) => x.novas)).toEqual([1, 0, 0, 1]);
    const h = conversasDeHoje(m, AGORA_ISO);
    expect(h.mensagens).toBe(3);
    expect(h.porHora).toHaveLength(16);
    expect(h.porHora[9]).toBe(2);
    expect(h.porHora[11]).toBe(1);
    expect(h.novas).toBe(1);
    expect(h.escreveram).toBe(2);
  });

  it("abertura: primeiro nome sem o rótulo entre parênteses, receita com variação, 30 dias com os dias de venda", () => {
    const e = base();
    e.movimentos = [mov("o1", "oferta", "pago", em(10, 12))];
    e.pagamentos = [{ id: "p1", oportunidadeId: "o1", valor: 2000, metodo: "pix", status: "pago", linkUrl: null, expiraEm: null, criadoEm: em(10, 12), pagoEm: em(10, 12) }];
    e.mensagens = [msg("a", "contato", em(10, 12, 9)), msg("b", "contato", em(9, 20, 9))];
    const a = montarAbertura(e, AGORA_ISO, "João (dono)");
    expect(a.nome).toBe("João");
    expect(a.saudacao).toBe("Boa tarde");
    expect(a.valor.rotulo).toBe("Receita em novembro");
    expect(a.valor.numero).toBe(2000);
    expect(a.valor.variacao?.base).toBe("nada em outubro até o dia 13");
    expect(textoVariacao(variacao(500, 300), "em outubro", reais)?.base).toBe(`era ${reais(300)} em outubro`);
    expect(a.dias).toHaveLength(30);
    expect(a.dias[a.dias.length - 1].dia).toBe("2026-11-13");
    expect(a.dias.find((d) => d.dia === "2026-11-12")).toEqual({ dia: "2026-11-12", conversas: 1, vendas: 1 });
    expect(a.resumo).toBe("Em novembro: 1 venda e 1 conversa nova. Hoje, ninguém escreveu ainda.");
  });
});

describe("precisa de você", () => {
  it("pilha das que esperam há mais tempo (até 3), com o motivo do movimento para Handoff", () => {
    const e = base();
    e.contatos = ["a", "b", "c", "d"].map((id, i) => contato(id, { nome: `Pessoa ${id.toUpperCase()}`, handoffPendente: true, handoffDesde: ha(10 + i * 30), empresa: id === "d" ? "Padaria" : "" }));
    e.oportunidades = [op("o-d", "d", "handoff")];
    e.movimentos = [mov("o-d", "conversa", "handoff", ha(100), "Handoff: perguntou de valor.")];
    const p = montarPrecisa(e, AGORA_ISO);
    expect(p.total).toBe(4);
    expect(p.pessoas.map((x) => x.id)).toEqual(["d", "c", "b"]);
    expect(p.pessoas[0]).toMatchObject({ nome: "Pessoa D", empresa: "Padaria", motivo: "Perguntou de valor" });
    expect(p.pessoas[1].motivo).toBeNull();
  });

  it("tarefas de hoje (atrasadas à parte) e paradas no funil, o recorte da Fila", () => {
    const e = base();
    e.contatos = [contato("a")];
    e.tarefas = [
      { id: "t1", contatoId: "a", texto: "x", venceEm: ha(60), origem: "manual", feita: false, criadaEm: ha(500) },
      { id: "t2", contatoId: "a", texto: "y", venceEm: null, origem: "manual", feita: false, criadaEm: ha(500) },
      { id: "t3", contatoId: "a", texto: "z", venceEm: ha(60), origem: "manual", feita: true, criadaEm: ha(500) },
    ];
    e.oportunidades = [op("o1", "a", "conversa", { entrouNaEtapaEm: ha(60 * 24 * 3) })];
    const p = montarPrecisa(e, AGORA_ISO);
    expect(p.tarefas).toEqual({ atrasadas: 1, paraHoje: 1 });
    expect(p.paradas.total).toBe(1);
    expect(p.paradas.maiorEsperaMin).toBe(60 * 24 * 3);
    expect(p.pessoas).toEqual([]);
  });
});

describe("robô", () => {
  it("primeira resposta só quando quem respondeu foi o robô; separa pelo trecho", () => {
    const j = janelaDoPeriodo("7d", AGORA_ISO);
    const m = [
      msg("a", "contato", ha(100)),
      msg("a", "robo", new Date(Date.parse(ha(100)) + 30_000).toISOString()),
      msg("a", "contato", ha(50)),
      msg("a", "humano", ha(40)),
      msg("b", "contato", ha(60 * 24 * 8)),
      msg("b", "robo", new Date(Date.parse(ha(60 * 24 * 8)) + 90_000).toISOString()),
    ];
    expect(temposDePrimeiraResposta(m, j)).toEqual({ atual: [30], anterior: [90] });
  });

  it("atendidas, responderam, pedidos de pessoa e avanços no período", () => {
    const e = base();
    e.contatos = [contato("a"), contato("b")];
    e.oportunidades = [op("oa", "a", "handoff"), op("ob", "b", "conversa")];
    e.mensagens = [
      msg("a", "contato", ha(100)),
      msg("a", "robo", ha(99)),
      msg("b", "robo", ha(60)),
      msg("b", "robo", ha(60 * 24 * 9)),
      msg("a", "robo", ha(10), { aviso: true }),
    ];
    e.movimentos = [mov("oa", "conversa", "handoff", ha(98)), mov("ob", "novo", "conversa", ha(60 * 24 * 9))];
    const r = montarRobo(e, janelaDoPeriodo("7d", AGORA_ISO));
    expect(r.conversas).toBe(2);
    expect(r.conversasAnterior).toBe(1);
    expect(r.responderam).toBe(1);
    expect(r.pedidos).toBe(1);
    expect(r.pessoas).toBe(1);
    expect(r.avancaram).toBe(1);
    expect(r.primeiraResposta).toEqual({ medianaSeg: 60, respostas: 1, anteriorMedianaSeg: null });
  });

  it("faixa do mostrador e avanço", () => {
    expect(faixaDeResposta(45)).toMatchObject({ tom: "rapido", rotulo: "rápido" });
    expect(faixaDeResposta(100).tom).toBe("ok");
    expect(faixaDeResposta(600)).toMatchObject({ tom: "lento", fracao: 1 });
    expect(ehAvanco({ de: "conversa", para: "handoff" })).toBe(true);
    expect(ehAvanco({ de: "oferta", para: "perdido" })).toBe(false);
    expect(ehAvanco({ de: null, para: "novo" })).toBe(false);
  });
});

describe("origem, e-mails, funil e atividade", () => {
  it("origem pelo funil de entrada, com o resto em Outras", () => {
    const e = base();
    e.contatos = [contato("a", { criadoEm: ha(60) }), contato("b", { criadoEm: ha(120), origem: "live" }), contato("c", { criadoEm: ha(130), origem: "" }), contato("d", { criadoEm: ha(60 * 24 * 10) })];
    const o = montarOrigem(e, janelaDoPeriodo("7d", AGORA_ISO));
    expect(o.total).toBe(3);
    expect(o.totalAnterior).toBe(1);
    expect(o.origens.map((x) => x.chave)).toContain("__sem");
    const seg = segmentosDeOrigem([{ chave: "a", rotulo: "A", total: 2 }, { chave: "b", rotulo: "B", total: 1 }, { chave: "c", rotulo: "C", total: 1 }], 4, 2);
    expect(seg.map((s) => [s.rotulo, s.pct])).toEqual([["A", "50%"], ["Outras", "50%"]]);
    expect(seg[1].inicio).toBe(50);
  });

  it("e-mails: só o envio, por quem enviou", () => {
    const e = base();
    e.emails = [
      { id: "1", contatoId: "a", assunto: "x", texto: "x", em: ha(60), enviadoPor: e.operadores.find((o) => o.papel === "vendedor")!.id },
      { id: "2", contatoId: "a", assunto: "x", texto: "x", em: ha(60 * 24 * 9), enviadoPor: null },
    ];
    const r = montarEmails(e, janelaDoPeriodo("7d", AGORA_ISO));
    expect(r.enviados).toBe(1);
    expect(r.enviadosAnterior).toBe(1);
    expect(r.porQuem).toHaveLength(1);
  });

  it("funil: entradas, avanços e perdas contra o mesmo trecho; etapas sem movimento ficam de fora", () => {
    const e = base();
    e.contatos = [contato("a"), contato("b")];
    e.oportunidades = [op("o1", "a", "handoff", { criadaEm: ha(60) }), op("o2", "b", "oferta", { perdida: true, criadaEm: ha(60 * 24 * 9) })];
    e.movimentos = [
      mov("o1", null, "novo", ha(60)),
      mov("o1", "novo", "conversa", ha(50)),
      mov("o1", "conversa", "handoff", ha(40)),
      mov("o2", "proposta", "oferta", ha(60 * 24 * 9)),
      mov("o2", "oferta", "perdido", ha(60 * 24)),
    ];
    const f = montarFunil(e, janelaDoPeriodo("7d", AGORA_ISO), AGORA_ISO);
    expect(f.entradas).toBe(1);
    expect(f.entradasAnterior).toBe(1);
    expect(f.avancaram).toBe(1);
    expect(f.avancaramAnterior).toBe(1);
    expect(f.perdidas).toBe(1);
    expect(f.emAndamento).toBe(1);
    const conversa = f.etapas.find((x) => x.id === "conversa")!;
    expect(conversa).toMatchObject({ entraram: 1, avancaram: 1, naEtapa: 0 });
    expect(f.etapas.some((x) => x.id === "perdido")).toBe(false);
    const { visiveis, semMovimento } = etapasComMovimento(f.etapas);
    expect(visiveis.map((x) => x.id)).toEqual(["novo", "conversa", "handoff"]);
    expect(semMovimento).toBe(5);
  });

  it("atividade: vendas, pedidos e contatos novos, do mais recente; nada do futuro", () => {
    const e = base();
    e.contatos = [contato("a", { nome: "Ana Lima", handoffPendente: true, handoffDesde: ha(5), criadoEm: ha(300) }), contato("b", { nome: "Bia", criadoEm: ha(-10) })];
    e.oportunidades = [op("o1", "a", "handoff")];
    e.movimentos = [mov("o1", "conversa", "handoff", ha(20)), mov("o1", "conversa", "handoff", ha(5), "pediu"), mov("o1", "oferta", "pago", ha(2))];
    e.pagamentos = [{ id: "p1", oportunidadeId: "o1", valor: 1997, metodo: "pix", status: "pago", linkUrl: null, expiraEm: null, criadoEm: ha(3), pagoEm: ha(2) }];
    const l = montarAtividade(e, AGORA_ISO);
    expect(l.map((x) => x.id.split("-")[0])).toEqual(["venda", "pedido", "pedido", "lead"]);
    expect(l[0]).toMatchObject({ titulo: "Venda · Ana", valor: reais(1997), estado: { tom: "ok" }, href: "/contatos/a" });
    expect(l[1]).toMatchObject({ estado: { texto: "esperando", tom: "espera" }, href: "/conversas?c=a" });
    expect(l[1].detalhe).toContain(`${e.config.nomeRobo} passou a conversa`);
    expect(l[2].estado.tom).toBe("neutro");
  });

  it("o estado de exemplo monta todos os cartões sem erro", () => {
    const e = estadoExemplo(AGORA_ISO);
    const j = janelaDoPeriodo("30d", AGORA_ISO);
    expect(() => [montarAbertura(e, AGORA_ISO, "João (dono)"), montarPrecisa(e, AGORA_ISO), montarRobo(e, j), montarOrigem(e, j), montarEmails(e, j), montarFunil(e, j, AGORA_ISO), montarAtividade(e, AGORA_ISO)]).not.toThrow();
    expect(montarPrecisa(e, AGORA_ISO).total).toBe(1);
  });
});
