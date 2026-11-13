import { describe, expect, it } from "vitest";
import { estadoExemplo } from "@/data/exemplo";
import { contatosCompletos } from "@/domain/visao";
import type { ContatoCompleto } from "@/domain/types";
import {
  ORDEM_AGENTES,
  buscarContatos,
  contextoPara,
  followupBase,
  lerResultado,
  linhasAgentes,
  motivoNaoRoda,
  notasDoContato,
  ordenarSugestoes,
  semNomeTecnico,
  textoTick,
} from "@/crm-grafite/telas/agentes/agentes-logica";
import { lerStatusWhatsapp } from "@/crm-grafite/telas/agentes/fonte";

const AGORA = "2026-11-12T15:00:00.000Z";

function contatoVazio(extra: Partial<ContatoCompleto> = {}): ContatoCompleto {
  return {
    id: "x",
    nome: "Ana Paula",
    empresa: "Padaria Sol",
    segmento: "",
    cidade: "",
    telefone: "11999990000",
    email: "",
    origem: "perpetuo",
    nota: 9,
    dono: "robo",
    operadorId: null,
    handoffPendente: false,
    handoffDesde: null,
    termometro: null,
    criadoEm: AGORA,
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

describe("agentes · tabela de uma linha por agente", () => {
  it("lista os sete agentes na ordem e o nome do robô vem da configuração", () => {
    const l = linhasAgentes({ iaConectada: true, whatsappConectado: true, decisoesAutomaticas: 0, ultimaAutomatica: null }, "Bia");
    expect(l.map((x) => x.slug)).toEqual(ORDEM_AGENTES);
    expect(l[0].nome).toBe("Bia");
    expect(l.find((x) => x.slug === "ember")?.href).toBe("/relance");
  });

  it("sem IA: regras locais, Ember bloqueado e robô não responde sozinho", () => {
    const l = linhasAgentes({ iaConectada: false, whatsappConectado: true, decisoesAutomaticas: 0, ultimaAutomatica: null }, "Cláudio");
    expect(l.find((x) => x.slug === "scout")?.estado.rotulo).toBe("Regras locais");
    expect(l.find((x) => x.slug === "ember")?.estado).toMatchObject({ tom: "atencao", rotulo: "Bloqueado" });
    expect(l.find((x) => x.slug === "claudio")?.estado.rotulo).toBe("Não responde sozinho");
  });

  it("com decisões automáticas registradas, o robô aparece atendendo", () => {
    const l = linhasAgentes({ iaConectada: true, whatsappConectado: true, decisoesAutomaticas: 2, ultimaAutomatica: "12/11 10:00" }, "Cláudio");
    expect(l[0].estado).toMatchObject({ tom: "sucesso", rotulo: "Atendendo" });
    expect(l[0].estado.detalhe).toContain("2 decisões registradas");
  });

  it("Ledger nunca roda aqui e diz por quê; nenhum texto mostra nome de variável", () => {
    const l = linhasAgentes({ iaConectada: null, whatsappConectado: null, decisoesAutomaticas: 0, ultimaAutomatica: null }, "Cláudio");
    expect(l.find((x) => x.slug === "ledger")?.estado.rotulo).toBe("Não roda aqui");
    for (const x of l) expect(`${x.modo} ${x.estado.detalhe ?? ""}`).not.toMatch(/[A-Z]+_[A-Z]+/);
  });
});

describe("agentes · rodar sobre um contato", () => {
  const e = estadoExemplo(AGORA);
  const contatos = contatosCompletos(e);

  it("busca por nome, empresa ou telefone, ignorando acento", () => {
    expect(buscarContatos(contatos, "a")).toEqual([]);
    const r = buscarContatos([contatoVazio(), contatoVazio({ id: "y", nome: "Zé", empresa: "Pão" })], "pao");
    expect(r.map((c) => c.id)).toEqual(["y"]);
    expect(buscarContatos([contatoVazio()], "9999").map((c) => c.id)).toEqual(["x"]);
  });

  it("explica quando o agente não tem o que ler", () => {
    const c = contatoVazio();
    expect(motivoNaoRoda("scout", c)).toMatch(/não tem conversa/);
    expect(motivoNaoRoda("scribe", c)).toMatch(/não tem notas/);
    expect(motivoNaoRoda("eco", c)).toBeNull();
  });

  it("monta o contexto do Pilot com dados reais da conversa", () => {
    const c = contatoVazio({
      mensagens: [
        { id: "1", contatoId: "x", autor: "contato", texto: "Oi", em: "2026-11-09T15:00:00.000Z" },
        { id: "2", contatoId: "x", autor: "robo", texto: "Olá", em: "2026-11-10T15:00:00.000Z" },
        { id: "3", contatoId: "x", autor: "robo", texto: "aviso", em: "2026-11-11T15:00:00.000Z", aviso: true },
      ],
    });
    const ctx = contextoPara("pilot", c, AGORA);
    expect(ctx).toMatchObject({ diasParado: 2, horasDesdeUltimaAutomatica: 48, ultimaMensagemContato: "Oi", textoFollowup: followupBase("Ana Paula") });
    expect(followupBase("Ana Paula")).toMatch(/^Oi Ana,/);
  });

  it("Scribe lê notas e resumos de ligação; Eco lê o briefing", () => {
    const c = contatoVazio({
      notas: [{ id: "n", contatoId: "x", texto: "Enviar proposta até sexta", autorId: null, em: AGORA }],
      oportunidades: [{ id: "o", contatoId: "x", produtoId: "p", valor: 1, etapa: "briefing", entrouNaEtapaEm: AGORA, proximoPasso: "", briefing: { dor: "dor X", meta: "meta Y", data: "" }, perdida: false, motivoPerda: null, criadaEm: AGORA }],
    });
    expect(notasDoContato(c)).toBe("Enviar proposta até sexta");
    expect(contextoPara("scribe", c, AGORA)).toEqual({ notasReuniao: "Enviar proposta até sexta" });
    expect(contextoPara("eco", c, AGORA)).toEqual({ nome: "Ana Paula", dor: "dor X", meta: "meta Y", nota: 9 });
  });
});

describe("agentes · leitura dos resultados", () => {
  it("Scout vira recomendação em linguagem simples", () => {
    const r = lerResultado("scout", { saida: { resumo: "Scout: x (handoff)", payload: { rotulo: "momento de compra", acao: "handoff", porque: "Pediu preço.", minutosSilencio: 90 } } });
    expect(r.titulo).toBe("Leitura do Scout: momento de compra.");
    expect(r.linhas).toContainEqual({ rotulo: "Recomendação", texto: "Passar para uma pessoa agora" });
    expect(r.linhas).toContainEqual({ rotulo: "Sem resposta há", texto: "2 h" });
  });

  it("Pilot bloqueado não oferece texto e explica o motivo", () => {
    const r = lerResultado("pilot", { saida: { resumo: "Pilot em cooldown de 48h.", payload: { cooldown: true, motivo: "cooldown" } } });
    expect(r.bloqueado).toBe(true);
    expect(r.texto).toBeNull();
    expect(r.titulo).toMatch(/espera 48 h/);
    const ok = lerResultado("pilot", { saida: { resumo: "Pilot: follow-up pronto.", payload: { texto: "Oi Ana" } }, usadoLlm: true });
    expect(ok).toMatchObject({ texto: "Oi Ana", bloqueado: false, comIa: true });
  });

  it("Scribe devolve follow-ups e Eco o briefing", () => {
    expect(lerResultado("scribe", { saida: { resumo: "ok", payload: { resumo: "R", followups: ["Ligar", " ", "Enviar"] } } }).followups).toEqual(["Ligar", "Enviar"]);
    expect(lerResultado("eco", { saida: { resumo: "ok", payload: { briefing: "B" } } }).briefing).toBe("B");
  });
});

describe("agentes · fila, tick e textos do servidor", () => {
  it("sugestões pendentes, quem espera há mais tempo primeiro", () => {
    const s = (id: string, criadaEm: string, status = "pendente") => ({ id, criadaEm, contatoId: "c", nome: "n", telefoneMascarado: "", diasParado: 2, texto: "t", status });
    expect(ordenarSugestoes([s("b", "2026-11-11"), s("a", "2026-11-10"), s("c", "2026-11-09", "enviada")]).map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("resultado do Pilot em uma frase, com avisos à parte", () => {
    const t = textoTick({ avaliados: 5, sugeridos: 1, enviados: 0, ignorados: 4, motivos: { sem_conversa: 3, cooldown_48h: 1, auto_sem_chave_llm: 1 }, modo: "sugerir" });
    expect(t.texto).toBe("O Pilot olhou 5 contatos: 1 sugestão nova. Ficaram de fora: 3 não têm conversa; 1 receberam mensagem automática há menos de 48 h.");
    expect(t.avisos[0]).toMatch(/sem chave de IA/);
  });

  it("nunca mostra nome de variável de ambiente", () => {
    expect(semNomeTecnico("CRM_CLAUDIO_AUTO_REPLY não está ligado.")).toBe("configuração do servidor não está ligado.");
    expect(semNomeTecnico("Desligado (CRM_PILOT_AUTO).")).toBe("Desligado.");
  });

  it("situação do WhatsApp sem detalhe técnico", () => {
    expect(lerStatusWhatsapp({ status: "desconectado" })).toEqual({ conectado: false, texto: "WhatsApp sem sessão ativa" });
    expect(lerStatusWhatsapp({ status: "qr" }).texto).toMatch(/QR/);
    expect(lerStatusWhatsapp({ connected: true }).conectado).toBe(true);
  });
});
