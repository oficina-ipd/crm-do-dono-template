import { describe, expect, it } from "vitest";
import { estadoExemplo } from "@/data/exemplo";
import type { EstadoCRM } from "@/domain/types";
import {
  itensEmOrdem,
  limparMotivo,
  montarFila,
  ordenarHandoffs,
  ordenarParadas,
  prazoDoHandoff,
  proximoIndiceFila,
  quemEscreveu,
  rotuloParada,
  teclaDaFila,
  totalEsperando,
} from "@/crm-grafite/telas/fila/logica";
import { duracaoLonga, resumoDoDia } from "@/crm-grafite/telas/fila/resumo-logica";

const AGORA = new Date(2026, 10, 12, 15, 0, 0);
const AGORA_ISO = AGORA.toISOString();
const ha = (min: number) => new Date(AGORA.getTime() - min * 60_000).toISOString();

function base(): EstadoCRM {
  const e = estadoExemplo(AGORA_ISO);
  return { ...e, contatos: [], oportunidades: [], movimentos: [], mensagens: [], tarefas: [], pagamentos: [] };
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
  criadoEm: ha(60 * 24 * 3),
  ...extra,
});

describe("montarFila", () => {
  it("quem pediu uma pessoa vem por prazo, com motivo e última mensagem", () => {
    const e = base();
    e.contatos = [
      contato("a", { nome: "Ana", handoffPendente: true, handoffDesde: ha(10), empresa: "Padaria" }),
      contato("b", { nome: "Bruno", handoffPendente: true, handoffDesde: ha(150), nota: 9 }),
      contato("c", { nome: "Caio" }),
    ];
    e.oportunidades = [{ id: "o-a", contatoId: "a", produtoId: "p", valor: 1, etapa: "handoff", entrouNaEtapaEm: ha(10), proximoPasso: "", briefing: null, perdida: false, motivoPerda: null, criadaEm: ha(100) }];
    e.movimentos = [{ id: "m1", oportunidadeId: "o-a", de: "conversa", para: "handoff", por: "robo", em: ha(10), motivo: "Handoff: perguntou de valor (só o humano fala de preço)." }];
    e.mensagens = [
      { id: "1", contatoId: "a", autor: "contato", texto: "Quanto custa?", em: ha(11) },
      { id: "2", contatoId: "a", autor: "robo", texto: "Vou te passar para uma pessoa.", em: ha(10) },
      { id: "3", contatoId: "a", autor: "humano", texto: "Aviso de troca", em: ha(9), aviso: true },
    ];
    const f = montarFila(e, AGORA_ISO);
    expect(f.handoffs.map((h) => h.nome)).toEqual(["Bruno", "Ana"]);
    const ana = f.handoffs[1];
    expect(ana.motivo).toBe("Perguntou de valor (só o humano fala de preço)");
    expect(ana.ultimaMensagem).toMatchObject({ texto: "Vou te passar para uma pessoa.", quem: e.config.nomeRobo });
    expect(ana.href).toBe("/conversas?c=a");
    expect(ana.slaAte).toBe(new Date(AGORA.getTime() - 10 * 60_000 + 120 * 60_000).toISOString());
    expect(f.handoffs[0].motivo).toBeNull();
  });

  it("tarefas de hoje, atrasadas e sem data; próximas e feitas ficam de fora (salvo as concluídas agora)", () => {
    const e = base();
    e.contatos = [contato("a", { nome: "Ana" })];
    const tarefa = (id: string, venceEm: string | null, feita = false) => ({ id, contatoId: "a", texto: id, venceEm, origem: "manual", feita, criadaEm: ha(500) });
    e.tarefas = [
      tarefa("atrasada", ha(60)),
      tarefa("hoje", new Date(2026, 10, 12, 18, 0).toISOString()),
      tarefa("amanha", new Date(2026, 10, 13, 9, 0).toISOString()),
      tarefa("semdata", null),
      tarefa("feita", ha(30), true),
      tarefa("feita-agora", ha(30), true),
    ];
    const f = montarFila(e, AGORA_ISO, new Set(["feita-agora"]));
    expect(f.tarefas.map((t) => t.tarefaId)).toEqual(["atrasada", "feita-agora", "hoje", "semdata"]);
    expect(f.tarefas[0].href).toBe("/contatos/a");
    expect(totalEsperando(f)).toBe(3);
  });

  it("oportunidades paradas: prazo da etapa estourado, sem repetir quem está no grupo de cima e sem etapa do sistema", () => {
    const e = base();
    e.contatos = [contato("a", { nome: "Ana" }), contato("b", { nome: "Bia", handoffPendente: true, handoffDesde: ha(300) }), contato("c", { nome: "Cris" })];
    const op = (id: string, contatoId: string, etapa: EstadoCRM["oportunidades"][number]["etapa"], naEtapaMin: number, perdida = false) => ({
      id,
      contatoId,
      produtoId: "p",
      valor: 1,
      etapa,
      entrouNaEtapaEm: ha(naEtapaMin),
      proximoPasso: "",
      briefing: null,
      perdida,
      motivoPerda: null,
      criadaEm: ha(naEtapaMin + 10),
    });
    e.oportunidades = [
      op("o1", "a", "conversa", 60 * 30), // prazo 1 dia: parada
      op("o2", "b", "handoff", 300), // já está em "precisa de uma pessoa"
      op("o3", "c", "dentro", 60 * 24 * 30), // etapa movida pelo sistema
      op("o4", "c", "oferta", 60), // dentro do prazo
      op("o5", "c", "oferta", 60 * 24 * 5, true), // perdida
    ];
    const f = montarFila(e, AGORA_ISO);
    expect(f.paradas.map((p) => p.oportunidadeId)).toEqual(["o1"]);
    expect(rotuloParada(f.paradas[0])).toBe("Em conversa · parada há 1 d · prazo da etapa 1 d");
    expect(itensEmOrdem(f).map((i) => i.tipo)).toEqual(["handoff", "parada"]);
  });

  it("o exemplo do template monta sem erro e tem os três grupos", () => {
    const f = montarFila(estadoExemplo(AGORA_ISO), AGORA_ISO);
    expect(f.handoffs.length).toBeGreaterThan(0);
    expect(f.tarefas.length).toBeGreaterThan(0);
  });
});

describe("ordens e textos", () => {
  it("handoff: prazo mais curto primeiro; sem prazo, quem espera mais", () => {
    const l = ordenarHandoffs([
      { nome: "A", slaAte: null, desde: ha(100) },
      { nome: "B", slaAte: ha(-30), desde: ha(10) },
      { nome: "C", slaAte: ha(5), desde: ha(200) },
      { nome: "D", slaAte: null, desde: ha(300) },
    ]);
    expect(l.map((x) => x.nome)).toEqual(["C", "B", "D", "A"]);
  });

  it("paradas: quem passou mais do prazo primeiro", () => {
    expect(ordenarParadas([{ nome: "A", minutos: 100, prazoMin: 90 }, { nome: "B", minutos: 50, prazoMin: 5 }]).map((x) => x.nome)).toEqual(["B", "A"]);
  });

  it("prazo do handoff em texto", () => {
    expect(prazoDoHandoff(null, AGORA)).toEqual({ tom: "neutro", texto: "Sem prazo definido" });
    expect(prazoDoHandoff(ha(20), AGORA)).toEqual({ tom: "erro", texto: "Prazo passou há 20 min" });
    expect(prazoDoHandoff(ha(-12), AGORA)).toEqual({ tom: "atencao", texto: "Prazo em 12 min" });
    expect(prazoDoHandoff(new Date(2026, 10, 12, 16, 30).toISOString(), AGORA)).toEqual({ tom: "neutro", texto: "Prazo às 16:30" });
  });

  it("motivo limpo e quem escreveu", () => {
    expect(limparMotivo("Handoff: pediu para falar com uma pessoa.")).toBe("Pediu para falar com uma pessoa");
    expect(limparMotivo("  ")).toBeNull();
    const ctx = { nomeContato: "Mariana Rocha", nomeRobo: "Cláudio", operadores: [{ id: "op", nome: "Otávio Lima" }] };
    expect(quemEscreveu({ autor: "contato" }, ctx)).toBe("Mariana");
    expect(quemEscreveu({ autor: "robo" }, ctx)).toBe("Cláudio");
    expect(quemEscreveu({ autor: "humano", operadorId: "op" }, ctx)).toBe("Otávio");
    expect(quemEscreveu({ autor: "humano" }, ctx)).toBe("Equipe");
  });
});

describe("teclado", () => {
  it("J/K andam sem dar a volta; Home/End vão às pontas", () => {
    expect(proximoIndiceFila(-1, "j", 3)).toBe(0);
    expect(proximoIndiceFila(2, "j", 3)).toBe(2);
    expect(proximoIndiceFila(1, "k", 3)).toBe(0);
    expect(proximoIndiceFila(1, "End", 3)).toBe(2);
    expect(proximoIndiceFila(1, "x", 3)).toBeNull();
    expect(proximoIndiceFila(0, "j", 0)).toBeNull();
  });

  it("J/K só com o foco dentro da tela; nunca digitando, com modificador ou com diálogo", () => {
    const base = { key: "j", dentroDaFila: false, naTela: true };
    expect(teclaDaFila(base)).toBe(true);
    expect(teclaDaFila({ ...base, naTela: false })).toBe(false);
    expect(teclaDaFila({ ...base, alvoTag: "INPUT" })).toBe(false);
    expect(teclaDaFila({ ...base, metaKey: true })).toBe(false);
    expect(teclaDaFila({ ...base, dialogoAberto: true })).toBe(false);
    expect(teclaDaFila({ key: "ArrowDown", dentroDaFila: false, naTela: true })).toBe(false);
    expect(teclaDaFila({ key: "ArrowDown", dentroDaFila: true, naTela: true })).toBe(true);
  });
});

describe("resumo do dia", () => {
  it("vendas e recebido no mês, espera e leads de hoje, sem meta", () => {
    const e = base();
    e.contatos = [
      contato("a", { handoffPendente: true, handoffDesde: ha(150) }),
      contato("b", { handoffPendente: true, handoffDesde: ha(30) }),
      contato("c", { criadoEm: ha(60) }),
    ];
    e.movimentos = [
      { id: "1", oportunidadeId: "o1", de: "oferta", para: "pago", por: "sistema", em: ha(60), motivo: null },
      { id: "2", oportunidadeId: "o2", de: "oferta", para: "pago", por: "sistema", em: new Date(2026, 10, 3, 10).toISOString(), motivo: null },
      { id: "3", oportunidadeId: "o3", de: "novo", para: "conversa", por: "robo", em: ha(50), motivo: null },
      { id: "4", oportunidadeId: "o4", de: "oferta", para: "pago", por: "sistema", em: new Date(2026, 9, 30, 10).toISOString(), motivo: null },
    ];
    e.pagamentos = [{ id: "p", oportunidadeId: "o1", valor: 1997, metodo: "pix", status: "pago", linkUrl: null, expiraEm: null, criadoEm: ha(70), pagoEm: ha(60) }];
    const r = resumoDoDia(e, AGORA_ISO);
    expect(r.vendas).toMatchObject({ noMes: 2, hoje: 1, recebidoMes: 1997, previsaoFimDoMes: 5, ultimoDia: "30/11" });
    expect(r.espera).toEqual({ esperando: 2, maiorEsperaMin: 150, prazoMin: 120, foraDoPrazo: 1 });
    expect(r.leads).toEqual({ hoje: 1, conversaramHoje: 1 });
    expect("meta" in r.vendas).toBe(false);
  });

  it("sem venda no mês não projeta", () => {
    expect(resumoDoDia(base(), AGORA_ISO).vendas.previsaoFimDoMes).toBeNull();
  });

  it("duração longa", () => {
    expect(duracaoLonga(18)).toBe("18 min");
    expect(duracaoLonga(130)).toBe("2 h 10 min");
    expect(duracaoLonga(60 * 27)).toBe("1 d 3 h");
  });
});
