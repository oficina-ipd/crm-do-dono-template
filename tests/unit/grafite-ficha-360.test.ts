/**
 * Ficha · histórico 360 (linha do tempo única, resumo de comportamento, identidade).
 * Roda igual com TZ=America/Sao_Paulo e TZ=UTC: o que depende de fuso recebe `tz` explícito, e o
 * caso sem `tz` compara com o relógio local do processo.
 */
import { describe, expect, it } from "vitest";
import { estadoExemplo, IDS } from "@/data/exemplo";
import { montarContato } from "@/domain/visao";
import type { ContatoCompleto, Mensagem } from "@/domain/types";
import {
  agruparPorDia,
  chaveDia,
  contarPorFiltro,
  dataCurta,
  engajamento,
  faixaDaHora,
  filtrarHistorico,
  filtro360Valido,
  identidadeDaPessoa,
  montarHistorico,
  resumoComportamento,
  textoHorario,
  textoSemResposta,
  textoTempo,
  textoTempoResposta,
  textoUltimos30,
  type Contexto360,
} from "@/crm-grafite/telas/ficha/historico";

const AGORA = "2026-11-12T15:00:00.000Z";
const SP = "America/Sao_Paulo";
const estado = estadoExemplo(AGORA);
const ctx = (tz?: string): Contexto360 => ({ nomeRobo: "Cláudio", operadores: estado.operadores, euId: IDS.dono, funis: estado.funis, produtos: estado.produtos, agora: AGORA, tz });
const contato = (id: string) => montarContato(estado, id)!;

function vazio(extra: Partial<ContatoCompleto> = {}): ContatoCompleto {
  return {
    id: "x1",
    nome: "Joana Prado",
    empresa: "",
    segmento: "",
    cidade: "",
    telefone: "",
    email: "",
    origem: "f-inexistente",
    nota: null,
    dono: "robo",
    operadorId: null,
    handoffPendente: false,
    handoffDesde: null,
    termometro: null,
    criadoEm: "2026-11-01T12:00:00.000Z",
    categoria: "lead",
    oportunidades: [],
    mensagens: [],
    notas: [],
    tarefas: [],
    ligacoes: [],
    propostas: [],
    pagamentos: [],
    emails: [],
    ocorrencias: [],
    movimentos: [],
    ...extra,
  };
}
let seq = 0;
const msg = (autor: Mensagem["autor"], em: string, texto = "oi", extra: Partial<Mensagem> = {}): Mensagem => ({ id: `m${++seq}`, contatoId: "x1", autor, texto, em, ...extra });

describe("ficha 360 · linha do tempo com o exemplo", () => {
  it("junta tudo, do mais recente para o mais antigo, e conta por filtro", () => {
    const ev = montarHistorico(contato("c2"), ctx(SP));
    for (let i = 1; i < ev.length; i++) expect(ev[i - 1].quando >= ev[i].quando).toBe(true);
    const n = contarPorFiltro(ev);
    expect(n.tudo).toBe(ev.length);
    expect(n.conversas).toBe(filtrarHistorico(ev, "conversas").length);
    expect(n.crm).toBe(filtrarHistorico(ev, "crm").length);
    expect(n.emails).toBe(0);
    const lig = ev.find((e) => e.tipo === "ligacao")!;
    expect(lig.titulo).toBe("Ligação · 9 min 42 s");
    expect(lig.estado?.rotulo).toBe("Interesse quente");
    expect(lig.detalhe.at(-1)).toBe("Feita por Otávio");
    expect(ev.find((e) => e.titulo === "Uma pessoa assumiu a conversa")?.tipo).toBe("conversa");
    expect(ev.some((e) => e.titulo === "Nota de Otávio: Decide sozinho. Quer organizar a fila de orçamentos.")).toBe(true);
  });

  it("mensagens viram uma linha por dia, com as últimas falas no detalhe", () => {
    const ev = montarHistorico(contato("c2"), ctx(SP));
    const dia = ev.find((e) => e.id === "conversa:2026-11-11")!;
    expect(dia.titulo).toBe("Conversa no WhatsApp · 6 mensagens");
    expect(dia.estado).toBeNull();
    expect(dia.detalhe[0]).toBe("3 da pessoa, 3 nossas (2 do Cláudio)");
    expect(dia.detalhe[1]).toBe("As 2 primeiras do dia estão na aba Conversa.");
    expect(dia.detalhe.at(-1)).toBe("14:00 · Paulo: Pode ser às 10h15.");
  });

  it("chegada e primeira etapa viram uma linha só", () => {
    const ev = montarHistorico(contato("c2"), ctx(SP));
    expect(ev.some((e) => e.id.startsWith("entrada:"))).toBe(false);
    const chegada = ev.find((e) => e.titulo === "Chegou pelo funil Live semanal")!;
    expect(chegada.tipo).toBe("etapa");
    expect(chegada.detalhe).toEqual(["Entrou em Lead novo"]);
    expect(ev.at(-1)?.id).toBe(chegada.id);
  });

  it("dia só com mensagens nossas: sem resposta no dia; pagamento, tarefa atrasada e proposta", () => {
    const ev = montarHistorico(contato("c5"), ctx(SP));
    const dia = ev.find((e) => e.tipo === "conversa")!;
    expect(dia.titulo).toBe("Mandamos 1 mensagem no WhatsApp, sem resposta no dia");
    expect(dia.estado).toEqual({ rotulo: "Sem resposta no dia", tom: "neutro" });
    const pg = ev.find((e) => e.id === "pagamento:pg1")!;
    expect(pg.titulo).toMatch(/^Link de pagamento: Comunidade IA para Donos · R\$\s?1\.997 · no Pix$/);
    expect(pg.estado?.rotulo).toBe("Aguardando pagamento");
    expect(pg.detalhe).toEqual(["Vale até 14/11, 12:00"]);
    expect(ev.find((e) => e.tipo === "tarefa")?.estado).toEqual({ rotulo: "Atrasada", tom: "atencao" });
    // No mesmo instante, "enviada" aparece acima de "criada"
    const ids = ev.filter((e) => e.tipo === "proposta").map((e) => e.id);
    expect(ids).toEqual(["proposta-aberta:pr2", "proposta-enviada:pr2", "proposta-criada:pr2"]);
    expect(ev.find((e) => e.id === "proposta-aberta:pr2")?.estado?.tom).toBe("bom");
  });

  it("perda com motivo", () => {
    const ev = montarHistorico(contato("c11"), ctx(SP));
    const perda = ev.find((e) => e.estado?.rotulo === "Perdida")!;
    expect(perda.titulo).toBe("Oportunidade perdida: preço");
    expect(perda.detalhe).toEqual(["Estava em Oferta com condição"]);
  });

  it("filtro: válido, antigo da linha do tempo de antes, ou tudo", () => {
    expect(filtro360Valido("propostas")).toBe("propostas");
    expect(filtro360Valido("mensagem")).toBe("conversas");
    expect(filtro360Valido("ligacao")).toBe("conversas");
    expect(filtro360Valido("movimento")).toBe("crm");
    expect(filtro360Valido("site")).toBe("tudo");
    expect(filtro360Valido(null)).toBe("tudo");
  });
});

describe("ficha 360 · fuso horário", () => {
  // 22:30 de 09/11 em São Paulo = 01:30 de 10/11 em UTC
  const noite = "2026-11-10T01:30:00.000Z";
  const meioDia = "2026-11-10T15:00:00.000Z";
  const c = vazio({ mensagens: [msg("robo", noite, "Boa noite"), msg("contato", meioDia, "Oi")] });

  it("em São Paulo, a mensagem da noite fica no dia 9 e o dia fica sem resposta", () => {
    const ev = montarHistorico(c, ctx(SP)).filter((e) => e.tipo === "conversa");
    expect(ev.map((e) => e.id)).toEqual(["conversa:2026-11-10", "conversa:2026-11-09"]);
    expect(ev[0].titulo).toBe("Escreveu no WhatsApp · 1 mensagem");
    expect(ev[1].estado?.rotulo).toBe("Sem resposta no dia");
    expect(ev[1].detalhe).toEqual(["1 do Cláudio", "22:30 · Cláudio: Boa noite"]);
    expect(agruparPorDia(ev, SP).map((g) => g.dia)).toEqual(["2026-11-10", "2026-11-09"]);
  });

  it("em UTC, as duas caem no mesmo dia e viram uma conversa", () => {
    const ev = montarHistorico(c, ctx("UTC")).filter((e) => e.tipo === "conversa");
    expect(ev).toHaveLength(1);
    expect(ev[0].titulo).toBe("Conversa no WhatsApp · 2 mensagens");
    expect(ev[0].estado).toBeNull();
    expect(ev[0].detalhe[1]).toBe("01:30 · Cláudio: Boa noite");
  });

  it("sem fuso, segue o relógio de quem está usando", () => {
    const d = new Date(noite);
    const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    expect(chaveDia(noite)).toBe(local);
    const dias = new Set(montarHistorico(c, ctx()).filter((e) => e.tipo === "conversa").map((e) => e.id));
    expect(dias.has(`conversa:${local}`)).toBe(true);
  });

  it("data de entrada no CRM no fuso", () => {
    expect(dataCurta(noite, SP)).toMatch(/^9 de nov\.? de 2026$/);
    expect(dataCurta(noite, "UTC")).toMatch(/^10 de nov\.? de 2026$/);
  });
});

describe("ficha 360 · eventos que o template guarda", () => {
  it("e-mail, ligação não atendida, ocorrência, nota própria, handoff pendente", () => {
    const c = vazio({
      handoffPendente: true,
      handoffDesde: "2026-11-12T10:00:00.000Z",
      emails: [{ id: "e1", contatoId: "x1", assunto: "Proposta", texto: "Segue a proposta.", em: "2026-11-11T10:00:00.000Z", enviadoPor: IDS.dono }],
      ligacoes: [
        { id: "l1", contatoId: "x1", operadorId: null, iniciouEm: "2026-11-11T11:00:00.000Z", duracaoSeg: 0, resultado: "não atende", avisoGravacaoDado: false, trechos: [], followups: [], resumo: "", termometroVendedor: "frio", termometroIA: "frio" },
      ],
      ocorrencias: [{ id: "o1", contatoId: "x1", tipo: "problema", descricao: "Link não abriu", trechos: [], status: "resolvida", abertaPor: null, em: "2026-11-11T12:00:00.000Z", resposta: "Trocamos o link." }],
      notas: [{ id: "n1", contatoId: "x1", texto: "Ligar depois do almoço", autorId: IDS.dono, em: "2026-11-11T13:00:00.000Z" }],
    });
    const ev = montarHistorico(c, ctx(SP));
    expect(ev.find((e) => e.tipo === "email")).toMatchObject({ titulo: "E-mail enviado: Proposta", detalhe: ["Segue a proposta.", "Enviado por Você"], estado: null });
    expect(ev.find((e) => e.tipo === "ligacao")).toMatchObject({ titulo: "Ligação não atendida", estado: null, detalhe: [] });
    expect(ev.find((e) => e.tipo === "ocorrencia")).toMatchObject({ titulo: "Problema registrado: Link não abriu", estado: { rotulo: "Resolvida", tom: "bom" }, detalhe: ["Resposta: Trocamos o link."] });
    expect(ev.find((e) => e.tipo === "nota")?.titulo).toBe("Sua nota: Ligar depois do almoço");
    expect(ev[0]).toMatchObject({ id: "handoff:x1", titulo: "O Cláudio pediu uma pessoa na conversa", estado: { rotulo: "Esperando uma pessoa", tom: "atencao" } });
    // sem movimento de entrada: a chegada aparece sozinha, com a origem que existe
    expect(ev.at(-1)).toMatchObject({ id: "entrada:x1", titulo: "Chegou ao CRM" });
    const n = contarPorFiltro(ev);
    expect(n.emails).toBe(1);
    expect(n.crm).toBe(3);
    expect(n.propostas).toBe(0);
  });
});

describe("ficha 360 · resumo de comportamento", () => {
  const agora = new Date(AGORA);
  const ha = (dias: number) => new Date(agora.getTime() - dias * 86_400_000).toISOString();

  it("regra quente / morno / frio pelo tempo exato", () => {
    expect(engajamento(null, agora)).toEqual({ nivel: "sem_sinal", motivo: "Nenhuma atividade da pessoa registrada." });
    expect(engajamento({ quando: ha(0.2), oQue: "escreveu no WhatsApp" }, agora)).toEqual({ nivel: "quente", motivo: "Última atividade nas últimas 24 horas: escreveu no WhatsApp." });
    expect(engajamento({ quando: ha(7), oQue: "x" }, agora).nivel).toBe("quente");
    expect(engajamento({ quando: ha(7 + 1 / 24), oQue: "x" }, agora).nivel).toBe("morno");
    expect(engajamento({ quando: ha(30), oQue: "x" }, agora).nivel).toBe("morno");
    expect(engajamento({ quando: ha(30 + 1 / 24), oQue: "x" }, agora)).toEqual({ nivel: "frio", motivo: "Última atividade há 30 dias: x." });
  });

  it("só o que a pessoa fez conta como atividade; o que nós fizemos é contato nosso", () => {
    const c = vazio({
      mensagens: [msg("robo", ha(40))],
      emails: [{ id: "e1", contatoId: "x1", assunto: "a", texto: "b", em: ha(2), enviadoPor: null }],
      ligacoes: [{ id: "l1", contatoId: "x1", operadorId: null, iniciouEm: ha(1), duracaoSeg: 300, resultado: "atendeu", avisoGravacaoDado: true, trechos: [], followups: [], resumo: "", termometroVendedor: "morno", termometroIA: "morno" }],
    });
    const r = resumoComportamento(c, AGORA, SP);
    expect(r.ultimaAtividade).toBeNull();
    expect(r.engajamento.nivel).toBe("sem_sinal");
    expect(r.ultimoContatoNosso).toEqual({ quando: ha(1), oQue: "ligação" });
    expect(textoHorario(r.horario)).toBe("sem sinal ainda");
    expect(textoTempoResposta(r.tempo)).toBe("sem resposta ainda");
    expect(textoUltimos30(r.ultimos30)).toBe("nenhuma mensagem");
    expect(textoSemResposta(r)).toBeNull();
  });

  it("abrir proposta e pagar contam como atividade", () => {
    const c = vazio({
      mensagens: [msg("contato", ha(20))],
      propostas: [{ id: "p1", oportunidadeId: "o1", texto: "", criadaEm: ha(12), enviadaEm: ha(12), enviadaPor: "whatsapp", abertaEm: ha(10) }],
    });
    const r = resumoComportamento(c, AGORA, SP);
    expect(r.ultimaAtividade).toEqual({ quando: ha(10), oQue: "abriu a proposta" });
    expect(r.engajamento.nivel).toBe("morno");
    expect(r.ultimoContatoNosso).toEqual({ quando: ha(12), oQue: "proposta enviada" });
  });

  it("quando costuma escrever, no fuso", () => {
    // Três vezes que ela volta a falar: 13h, 14h e 15h em UTC = 10h, 11h e 12h em São Paulo
    const c = vazio({
      mensagens: [
        msg("robo", "2026-11-10T12:50:00.000Z"),
        msg("contato", "2026-11-10T13:00:00.000Z"),
        msg("contato", "2026-11-10T13:01:00.000Z"),
        msg("robo", "2026-11-10T13:02:00.000Z"),
        msg("contato", "2026-11-10T14:00:00.000Z"),
        msg("humano", "2026-11-10T14:10:00.000Z", "x", { operadorId: IDS.dono }),
        msg("contato", "2026-11-10T15:00:00.000Z"),
      ],
    });
    expect(textoHorario(resumoComportamento(c, AGORA, SP).horario)).toBe("de manhã (2 de 3 vezes)");
    expect(textoHorario(resumoComportamento(c, AGORA, "UTC").horario)).toBe("à tarde (3 de 3 vezes)");
    // Tempo para responder: 10 min, 58 min e 50 min → o do meio é 50 min
    const r = resumoComportamento(c, AGORA, SP);
    expect(r.tempo).toEqual({ tipo: "medido", ms: 50 * 60_000, respostas: 3 });
    expect(textoTempoResposta(r.tempo)).toBe("cerca de 50 min · 3 respostas");
    expect(textoUltimos30(r.ultimos30)).toBe("4 dela, 3 nossas");
    expect(r.semResposta).toBe(0);
  });

  it("poucas conversas ou horários espalhados não viram 'costuma'", () => {
    const poucas = vazio({ mensagens: [msg("contato", "2026-11-10T13:00:00.000Z")] });
    expect(textoHorario(resumoComportamento(poucas, AGORA, SP).horario)).toBe("1 conversa: pouco para dizer");
    const espalhado = vazio({
      mensagens: [
        msg("contato", "2026-11-10T12:00:00.000Z"),
        msg("robo", "2026-11-10T12:01:00.000Z"),
        msg("contato", "2026-11-10T18:00:00.000Z"),
        msg("robo", "2026-11-10T18:01:00.000Z"),
        msg("contato", "2026-11-11T00:00:00.000Z"),
        msg("robo", "2026-11-11T00:01:00.000Z"),
        msg("contato", "2026-11-11T06:00:00.000Z"),
      ],
    });
    expect(textoHorario(resumoComportamento(espalhado, AGORA, "UTC").horario)).toBe("em horários variados");
  });

  it("mensagens nossas seguidas sem resposta", () => {
    const c = vazio({ mensagens: [msg("contato", ha(5)), msg("robo", ha(4)), msg("robo", ha(3)), msg("robo", ha(2))] });
    expect(textoSemResposta(resumoComportamento(c, AGORA, SP))).toBe("3 mensagens nossas desde a última dela");
    const nunca = vazio({ mensagens: [msg("robo", ha(4)), msg("robo", ha(3))] });
    expect(textoSemResposta(resumoComportamento(nunca, AGORA, SP))).toBe("2 mensagens nossas, nenhuma resposta");
    expect(textoUltimos30(resumoComportamento(nunca, AGORA, SP).ultimos30)).toBe("nenhuma dela, 2 nossas");
  });

  it("aviso de troca de atendente não conta como mensagem", () => {
    const c = vazio({ mensagens: [msg("contato", ha(2)), msg("humano", ha(1), "Daqui pra frente…", { aviso: true })] });
    const r = resumoComportamento(c, AGORA, SP);
    expect(r.ultimoContatoNosso).toBeNull();
    expect(r.semResposta).toBe(0);
  });

  it("textos de tempo e faixas do dia", () => {
    expect(textoTempo(20_000)).toBe("menos de 1 min");
    expect(textoTempo(15 * 60_000)).toBe("cerca de 15 min");
    expect(textoTempo(3 * 3_600_000)).toBe("cerca de 3 h");
    expect(textoTempo(26 * 3_600_000)).toBe("cerca de 1 dia");
    expect(textoTempo(5 * 86_400_000)).toBe("cerca de 5 dias");
    expect([0, 5, 6, 11, 12, 17, 18, 23].map(faixaDaHora)).toEqual(["madrugada", "madrugada", "manha", "manha", "tarde", "tarde", "noite", "noite"]);
  });

  it("o exemplo: Paulo escreve à tarde e responde rápido", () => {
    const r = resumoComportamento(contato("c2"), AGORA, SP);
    expect(r.engajamento.nivel).toBe("quente");
    expect(r.ultimoContatoNosso?.oQue).toBe("ligação");
    expect(textoHorario(r.horario)).toBe("à tarde (2 de 3 vezes)");
    expect(textoTempoResposta(r.tempo)).toBe("cerca de 1 min · 3 respostas");
  });
});

describe("ficha 360 · identidade", () => {
  it("mostra só o que o contato tem, sem fusão com outras bases", () => {
    const c = contato("c1");
    const linhas = identidadeDaPessoa(c, estado.funis);
    expect(linhas.map((l) => l.rotulo)).toEqual(["Nome", "Empresa", "WhatsApp", "E-mail", "Origem", "No CRM desde"].filter((r) => r !== "E-mail" || c.email.trim()));
    expect(linhas.find((l) => l.rotulo === "WhatsApp")?.tipo).toBe("telefone");
    expect(linhas.find((l) => l.rotulo === "Origem")?.valor).toBe("Perpétuo");
    expect(linhas.find((l) => l.rotulo === "No CRM desde")).toEqual({ rotulo: "No CRM desde", valor: c.criadoEm, tipo: "data" });
  });
  it("campo vazio não aparece; origem sem funil mostra o que está gravado", () => {
    const linhas = identidadeDaPessoa(vazio({ telefone: "--", email: " " }), []);
    expect(linhas.map((l) => [l.rotulo, l.valor])).toEqual([
      ["Nome", "Joana Prado"],
      ["Origem", "f-inexistente"],
      ["No CRM desde", "2026-11-01T12:00:00.000Z"],
    ]);
  });
});
