import { describe, expect, it } from "vitest";
import type { CampanhaReciclador, ItemFilaReciclador, MetricasCampanhaReciclador } from "@/domain/reciclador-types";
import {
  ETAPAS_RELANCE,
  amostra,
  configDe,
  contarPorStatus,
  corpoCriar,
  corpoSalvar,
  filtrarFila,
  fonteLida,
  incidentesUnificados,
  indicadores,
  motivoSemLote,
  motivoSemSimular,
  novaInicial,
  semSigla,
  temasDoTexto,
  textoImportacao,
  textoSimulacao,
  textoTick,
  validarConfig,
  validarNaoContatar,
  validarNova,
} from "@/crm-grafite/telas/relance/relance-logica";

const campanha: CampanhaReciclador = {
  id: "c1",
  nome: "Reativação",
  objetivo: "Reabrir",
  status: "rascunho",
  filtro: { etapas: ["conversa"], horasParadoMin: 48, apenasComContexto: true },
  fontes: { usarHistoricoMensagens: true, usarNotas: true, baseConteudo: "x", novidadesMercado: "", temasProibidos: ["desconto"] },
  cercas: { proibirPreco: true, tomMarca: "Direto", modeloLlm: "claude-sonnet-4-5", entregarPara: "humano", autoResponderClaudio: true },
  freios: { maxPorHora: 8, maxPorDia: 30, espacamentoSegundos: 120, janelaInicioHora: 9, janelaFimHora: 18, apenasDiasUteis: true, cooldownRecusaDias: 30 },
  criadaEm: "2026-11-01T00:00:00.000Z",
  atualizadaEm: "2026-11-01T00:00:00.000Z",
};

function item(id: string, status: ItemFilaReciclador["status"], processadoEm: string | null = null): ItemFilaReciclador {
  return {
    id,
    campanhaId: "c1",
    contatoId: id,
    oportunidadeId: null,
    nomeContato: id,
    empresa: "",
    telefone: "",
    telefoneMascarado: "",
    etapaInicial: "conversa",
    etapaAtual: "conversa",
    contextoExtraido: "",
    fontesLidas: [],
    status,
    decisao: null,
    motivo: "",
    ganchoIdentificado: null,
    mensagemGerada: null,
    modeloUsado: null,
    custoTokens: 0,
    providerWhatsapp: null,
    messageIdWhatsapp: null,
    criadoEm: "2026-11-10T00:00:00.000Z",
    processadoEm,
    respondeuEm: null,
    avancouEtapa: false,
    virouVenda: false,
  };
}

describe("relance · formulário da campanha", () => {
  it("configuração válida não tem erro; erros aparecem por campo", () => {
    const c = configDe(campanha);
    expect(validarConfig(c)).toEqual({});
    expect(validarConfig({ ...c, nome: " " }).nome).toBeTruthy();
    expect(validarConfig({ ...c, filtro: { ...c.filtro, etapas: [] } }).etapas).toMatch(/ao menos uma/);
    expect(validarConfig(c, { maxPorHora: "abc" }).maxPorHora).toMatch(/números/);
    expect(validarConfig({ ...c, freios: { ...c.freios, janelaInicioHora: 18, janelaFimHora: 9 } }).janelaFimHora).toMatch(/depois do início/);
    expect(validarConfig({ ...c, cercas: { ...c.cercas, modeloLlm: "" } }).modeloLlm).toBeTruthy();
  });

  it("salvar não manda resposta automática do robô se a resposta vai para uma pessoa", () => {
    const corpo = corpoSalvar({ ...configDe(campanha), nome: "  Nome  ", fontes: { ...campanha.fontes, temasProibidos: [" a ", ""] } });
    expect(corpo.nome).toBe("Nome");
    expect(corpo.cercas.autoResponderClaudio).toBe(false);
    expect(corpo.fontes.temasProibidos).toEqual(["a"]);
  });

  it("temas: um por linha ou por vírgula", () => {
    expect(temasDoTexto("desconto, promoção\n\n últimas vagas ")).toEqual(["desconto", "promoção", "últimas vagas"]);
  });

  it("nova campanha: valida e monta o corpo com o modelo padrão", () => {
    const n = novaInicial();
    expect(validarNova(n).nome).toBeTruthy();
    const ok = { ...n, nome: "A", objetivo: "B", entregarPara: "humano" as const };
    expect(validarNova(ok)).toEqual({});
    expect(validarNova({ ...ok, horasParadoMin: "1,5" }).horasParadoMin).toMatch(/inteiro/);
    const corpo = corpoCriar(ok, "claude-sonnet-4-5");
    expect(corpo).toMatchObject({ nome: "A", popularDoCrm: true, filtro: { horasParadoMin: 72 }, cercas: { modeloLlm: "claude-sonnet-4-5", autoResponderClaudio: false } });
    expect(corpoCriar(ok, "").cercas).not.toHaveProperty("modeloLlm");
  });

  it("etapas da campanha nunca incluem Pago nem Dentro", () => {
    expect(ETAPAS_RELANCE.map((e) => e.id)).not.toContain("pago");
    expect(ETAPAS_RELANCE.map((e) => e.id)).not.toContain("dentro");
    expect(ETAPAS_RELANCE.at(-1)?.id).toBe("perdido");
  });
});

describe("relance · fila e indicadores", () => {
  const itens = [item("a", "enviado", "2026-11-11"), item("b", "simulado", "2026-11-10"), item("c", "pendente"), item("d", "simulado", "2026-11-11")];

  it("conta por situação e ordena quem precisa de atenção primeiro", () => {
    expect(contarPorStatus(itens)).toMatchObject({ todos: 4, simulado: 2, pendente: 1, enviado: 1, erro: 0 });
    expect(filtrarFila(itens, "todos").map((i) => i.id)).toEqual(["d", "b", "c", "a"]);
    expect(filtrarFila(itens, "simulado").map((i) => i.id)).toEqual(["d", "b"]);
  });

  it("indicadores numa linha, com amostra pequena traduzida", () => {
    const m: MetricasCampanhaReciclador = { totalFila: 4, pendentes: 1, simulados: 2, enviados: 1, adiados: 0, ignorados: 0, bloqueados: 0, erros: 0, respostas: 0, avancosEtapa: 0, vendasAtribuidas: 0, taxaRespostaTexto: "n=1 · amostra pequena", taxaAvancoTexto: "Sem disparos ainda", motivosBloqueio: [], incidentes: 0 };
    const l = indicadores(m);
    expect(l[0]).toEqual({ rotulo: "Na fila", valor: "4" });
    expect(l.find((x) => x.rotulo === "Responderam")?.valor).toBe("0 · amostra pequena");
    expect(amostra("Sem disparos ainda")).toBe("Sem disparos ainda");
  });

  it("simular e processar lote dizem por que estão indisponíveis", () => {
    expect(motivoSemSimular("rascunho", [item("a", "pendente")], false)).toBeNull();
    expect(motivoSemSimular("rascunho", [item("a", "simulado")], false)).toMatch(/Ninguém aguardando/);
    expect(motivoSemSimular("ativa", [item("a", "pendente")], true)).toMatch(/emergência/);
    expect(motivoSemLote("rascunho", false)).toMatch(/campanha ativa/);
    expect(motivoSemLote("ativa", false)).toBeNull();
    expect(motivoSemLote("ativa", true)).toMatch(/emergência/);
  });

  it("incidentes da campanha e gerais sem repetição, do mais novo ao mais antigo", () => {
    const a = { id: "1", campanhaId: "c1", tipo: "sem_llm" as const, detalhe: "", em: "2026-11-10" };
    const b = { id: "2", campanhaId: null, tipo: "parada_emergencia" as const, detalhe: "", em: "2026-11-11" };
    expect(incidentesUnificados([a, b], [b]).map((i) => i.id)).toEqual(["2", "1"]);
  });
});

describe("relance · textos", () => {
  it("simulação nunca diz que enviou", () => {
    expect(textoSimulacao({ processados: 2, avisoLlm: null }).texto).toMatch(/^2 contatos simulados\. Nenhuma mensagem enviada/);
    expect(textoSimulacao({ processados: 0, avisoLlm: "x" }).tom).toBe("atencao");
  });

  it("lote: contagens, parada por proteção e motivo sem envio", () => {
    const base = { enviados: 1, ignorados: 2, bloqueados: 0, adiados: 1, erros: 0, pausadaPorIncidente: false };
    expect(textoTick(base)).toEqual({ tom: "ok", texto: "Lote processado: 1 enviado, 2 em silêncio, 0 bloqueados, 1 adiado." });
    expect(textoTick({ ...base, pausadaPorIncidente: true, motivoPausa: "WhatsApp caiu" }).texto).toMatch(/^O lote parou por proteção: WhatsApp caiu/);
    expect(textoTick({ ...base, motivoPausa: "Chave LLM não configurada." }).texto).toBe("Nenhum envio neste lote: Chave de IA não configurada.");
  });

  it("jargão do servidor vira linguagem de dono", () => {
    expect(semSigla("Elegível nos guardrails · configure chave LLM para o Ember.")).toBe("Elegível nas travas · configure chave de IA para o Ember.");
    expect(semSigla("Bloqueado nos guardrails pré-LLM.")).toBe("Bloqueado nas travas antes da IA.");
    expect(semSigla("Chave Anthropic não configurada. O Ember nunca usa mensagem genérica de fallback.")).toMatch(/Conecte a IA em Integração/);
    expect(semSigla("Falta WPP_API_KEY")).toBe("Falta configuração do servidor");
    expect(fonteLida("historico_mensagens")).toBe("histórico de mensagens");
    expect(fonteLida("algo_novo")).toBe("algo novo");
  });

  it("importação e não contatar", () => {
    expect(textoImportacao({ totalLinhas: 3, importados: 1, rejeitadosSemContexto: 1, rejeitadosOptOut: 1, rejeitadosTelefoneInvalido: 0 })).toBe("1 de 3 linhas entraram na fila; 2 ficaram de fora.");
    expect(validarNaoContatar("119999", "pediu")).toMatchObject({ tel: expect.stringMatching(/DDD/), evid: undefined });
    expect(validarNaoContatar("(11) 99999-0000", "pediu")).toEqual({ tel: undefined, evid: undefined });
  });
});
