import { describe, expect, it } from "vitest";
import { estadoExemplo, IDS } from "@/data/exemplo";
import { avisoAssumir } from "@/domain/rules";
import { montarContato } from "@/domain/visao";
import type { Ligacao, Mensagem } from "@/domain/types";
import {
  acaoDoTeclado,
  autorDoBalao,
  bateBusca,
  comQuem,
  condutorDe,
  contarPorFiltro,
  destinosManuais,
  estaParada,
  eventosDaConversa,
  exigenciaParaMover,
  filtrando,
  filtrarConversas,
  janelaRecente,
  lerUrlConversas,
  limparMotivo,
  mascararEmail,
  mascararTelefone,
  montarBlocos,
  motivoBloqueioComposer,
  motivoDoHandoff,
  moverNaLista,
  previaUltima,
  proximaTarefa,
  resumosConversas,
  rotuloDia,
  rotuloFiltro,
  rotuloQuando,
  urlConversas,
  URL_PADRAO,
} from "@/crm-grafite/telas/conversas/modelo";

const AGORA = "2026-11-12T15:00:00.000Z";
const AGORA_MS = Date.parse(AGORA);
const TZ = "America/Sao_Paulo";
const estado = estadoExemplo(AGORA);
const nomes = { nomeRobo: "Cláudio", operadores: estado.operadores, euId: IDS.dono };

describe("conversas · URL", () => {
  it("lê e escreve filtro, busca, tipo e conversa", () => {
    const e = { filtro: "precisa" as const, q: "mariana", tipo: "lead" as const, c: "c1" };
    const url = urlConversas(e);
    expect(url).toBe("/conversas?filtro=precisa&q=mariana&tipo=lead&c=c1");
    expect(lerUrlConversas(new URLSearchParams(url.split("?")[1]))).toEqual(e);
  });
  it("valor inválido vira o padrão; id estranho é ignorado", () => {
    expect(lerUrlConversas(new URLSearchParams("filtro=xyz&tipo=member&c=../../x"))).toEqual(URL_PADRAO);
    expect(urlConversas(URL_PADRAO)).toBe("/conversas");
    expect(filtrando(URL_PADRAO)).toBe(false);
    expect(filtrando({ ...URL_PADRAO, q: " a " })).toBe(true);
  });
  it("rótulo do filtro usa o nome do robô configurado", () => {
    expect(rotuloFiltro("robo", "Bia")).toBe("Com Bia");
    expect(rotuloFiltro("precisa", "Bia")).toBe("Precisa de você");
  });
});

describe("conversas · lista", () => {
  const resumos = resumosConversas(estado);

  it("todas as pessoas com mensagem, da última mensagem mais recente para a mais antiga", () => {
    const comMensagem = new Set(estado.mensagens.map((m) => m.contatoId));
    expect(resumos).toHaveLength(comMensagem.size);
    for (let i = 1; i < resumos.length; i++) expect(resumos[i - 1].ultimaEm >= resumos[i].ultimaEm).toBe(true);
    expect(resumos[0].contatoId).toBe("c6");
  });

  it("tipo: quem pagou é Cliente; o resto é Lead", () => {
    expect(resumos.find((r) => r.contatoId === "c7")?.tipo).toBe("cliente");
    expect(resumos.find((r) => r.contatoId === "c1")?.tipo).toBe("lead");
  });

  it("filtros: precisa de você, com humano, com robô e paradas", () => {
    const precisa = filtrarConversas(resumos, { ...URL_PADRAO, filtro: "precisa" }, AGORA_MS);
    expect(precisa.map((r) => r.contatoId)).toEqual(["c1"]);
    const humano = filtrarConversas(resumos, { ...URL_PADRAO, filtro: "humano" }, AGORA_MS);
    expect(humano.every((r) => r.dono === "humano")).toBe(true);
    const robo = filtrarConversas(resumos, { ...URL_PADRAO, filtro: "robo" }, AGORA_MS);
    expect(robo.length + humano.length).toBe(resumos.length);
    const paradas = filtrarConversas(resumos, { ...URL_PADRAO, filtro: "paradas" }, AGORA_MS);
    // Paulo escreveu por último há 22 h e ninguém respondeu
    expect(paradas.map((r) => r.contatoId)).toContain("c2");
    expect(paradas.every((r) => r.ultimaAutor === "contato")).toBe(true);
    const c = contarPorFiltro(resumos, "todos", AGORA_MS);
    expect(c).toEqual({ todas: resumos.length, precisa: 1, humano: humano.length, robo: robo.length, paradas: paradas.length });
  });

  it("parada: última mensagem do contato há mais de 1 hora", () => {
    expect(estaParada({ ultimaAutor: "contato", ultimaEm: new Date(AGORA_MS - 61 * 60_000).toISOString() }, AGORA_MS)).toBe(true);
    expect(estaParada({ ultimaAutor: "contato", ultimaEm: new Date(AGORA_MS - 30 * 60_000).toISOString() }, AGORA_MS)).toBe(false);
    expect(estaParada({ ultimaAutor: "robo", ultimaEm: new Date(AGORA_MS - 600 * 60_000).toISOString() }, AGORA_MS)).toBe(false);
  });

  it("busca sem acento por nome e empresa; telefone só com dígitos", () => {
    const r = { nome: "Letícia Fernandes", empresa: "Fernandes Pet", telefoneDigitos: "62900000007" };
    expect(bateBusca(r, "leticia")).toBe(true);
    expect(bateBusca(r, "PET")).toBe(true);
    expect(bateBusca(r, "0007")).toBe(true);
    expect(bateBusca(r, "(62) 9000")).toBe(true);
    expect(bateBusca(r, "12")).toBe(false);
    expect(bateBusca(r, "mariana")).toBe(false);
  });

  it("tipo filtra Lead e Cliente", () => {
    const so = filtrarConversas(resumos, { ...URL_PADRAO, tipo: "cliente" }, AGORA_MS);
    expect(so.length).toBeGreaterThan(0);
    expect(so.every((r) => r.tipo === "cliente")).toBe(true);
  });

  it("prévia da última mensagem diz quem escreveu", () => {
    const base = { ultimaAviso: false, ultimaOperadorId: null, ultimaTexto: "Oi" };
    expect(previaUltima({ ...base, ultimaAutor: "contato" }, nomes)).toBe("Oi");
    expect(previaUltima({ ...base, ultimaAutor: "robo" }, { ...nomes, nomeRobo: "Bia" })).toBe("Bia: Oi");
    expect(previaUltima({ ...base, ultimaAutor: "humano", ultimaOperadorId: IDS.dono }, nomes)).toBe("Você: Oi");
    expect(previaUltima({ ...base, ultimaAutor: "humano", ultimaOperadorId: IDS.otavio }, nomes)).toBe("Otávio: Oi");
    expect(previaUltima({ ...base, ultimaAutor: "humano", ultimaAviso: true }, nomes)).toBe("Aviso automático: Oi");
    expect(comQuem(IDS.otavio, nomes)).toBe("Com Otávio");
    expect(comQuem(IDS.dono, nomes)).toBe("Com você");
    expect(comQuem(null, nomes)).toBe("Com uma pessoa");
  });
});

describe("conversas · teclado", () => {
  const base = { editavel: false, naLista: false, dialogoAberto: false, naTela: true };
  it("J/K e / só com o foco na tela; setas só na lista", () => {
    expect(acaoDoTeclado({ ...base, tecla: "j" })).toBe("proxima");
    expect(acaoDoTeclado({ ...base, tecla: "K" })).toBe("anterior");
    expect(acaoDoTeclado({ ...base, tecla: "/" })).toBe("buscar");
    expect(acaoDoTeclado({ ...base, tecla: "j", naTela: false })).toBeNull();
    expect(acaoDoTeclado({ ...base, tecla: "ArrowDown" })).toBeNull();
    expect(acaoDoTeclado({ ...base, tecla: "ArrowDown", naLista: true })).toBe("proxima");
    expect(acaoDoTeclado({ ...base, tecla: "Escape" })).toBe("fecharContexto");
  });
  it("digitando, com modificador ou diálogo aberto, não faz nada", () => {
    expect(acaoDoTeclado({ ...base, tecla: "j", editavel: true })).toBeNull();
    expect(acaoDoTeclado({ ...base, tecla: "j", meta: true })).toBeNull();
    expect(acaoDoTeclado({ ...base, tecla: "j", dialogoAberto: true })).toBeNull();
  });
  it("move sem dar a volta", () => {
    expect(moverNaLista(3, -1, "proxima")).toBe(0);
    expect(moverNaLista(3, -1, "anterior")).toBe(2);
    expect(moverNaLista(3, 2, "proxima")).toBeNull();
    expect(moverNaLista(3, 0, "anterior")).toBeNull();
    expect(moverNaLista(3, 1, "ultima")).toBe(2);
    expect(moverNaLista(0, -1, "proxima")).toBeNull();
  });
});

describe("conversas · datas", () => {
  const agora = new Date(AGORA);
  it("separador de dia e hora da lista", () => {
    expect(rotuloDia("2026-11-12T13:00:00.000Z", agora, TZ)).toBe("Hoje");
    expect(rotuloDia("2026-11-11T13:00:00.000Z", agora, TZ)).toBe("Ontem");
    expect(rotuloDia("2026-11-09T13:00:00.000Z", agora, TZ)).toBe("segunda-feira");
    expect(rotuloDia("2026-10-03T13:00:00.000Z", agora, TZ)).toBe("3 de outubro");
    expect(rotuloDia("2025-10-03T13:00:00.000Z", agora, TZ)).toBe("3 de outubro de 2025");
    expect(rotuloQuando("2026-11-12T13:05:00.000Z", agora, TZ)).toBe("10:05");
    expect(rotuloQuando("2026-11-11T13:05:00.000Z", agora, TZ)).toBe("Ontem");
    expect(rotuloQuando("2026-10-03T13:05:00.000Z", agora, TZ)).toBe("03/10");
  });
});

describe("conversas · a conversa", () => {
  const msg = (id: string, autor: Mensagem["autor"], em: string, extra: Partial<Mensagem> = {}): Mensagem => ({ id, contatoId: "x", autor, texto: `t${id}`, em, ...extra });

  it("autor do balão: contato, robô com o nome do config, você, aviso", () => {
    expect(autorDoBalao(msg("1", "contato", AGORA), "Ana", nomes)).toEqual({ tipo: "lead", nome: "Ana" });
    expect(autorDoBalao(msg("1", "robo", AGORA), "Ana", { ...nomes, nomeRobo: "Bia" })).toEqual({ tipo: "robo", nome: "Bia" });
    expect(autorDoBalao(msg("1", "humano", AGORA, { operadorId: IDS.dono }), "Ana", nomes)).toEqual({ tipo: "humano", nome: "Você" });
    expect(autorDoBalao(msg("1", "humano", AGORA, { operadorId: IDS.otavio }), "Ana", nomes)).toEqual({ tipo: "humano", nome: "Otávio" });
    expect(autorDoBalao(msg("1", "humano", AGORA, { aviso: true, operadorId: IDS.otavio }), "Ana", nomes)).toEqual({ tipo: "humano", nome: "Aviso automático" });
  });

  it("separa por dia, agrupa a mesma pessoa em até 5 min e põe a ligação na ordem", () => {
    const l: Ligacao = {
      id: "l1", contatoId: "x", operadorId: IDS.otavio, iniciouEm: "2026-11-12T13:30:00.000Z", duracaoSeg: 600, resultado: "atendeu", avisoGravacaoDado: true,
      trechos: [], followups: [], resumo: "Resumo", termometroVendedor: "quente", termometroIA: "quente",
    };
    const ev = eventosDaConversa(
      [msg("a", "contato", "2026-11-11T13:00:00.000Z"), msg("b", "robo", "2026-11-12T13:00:00.000Z"), msg("c", "robo", "2026-11-12T13:02:00.000Z"), msg("d", "robo", "2026-11-12T13:20:00.000Z"), msg("e", "contato", "2026-11-12T14:00:00.000Z")],
      [l],
    );
    expect(ev.map((e) => (e.tipo === "msg" ? e.m.id : e.l.id))).toEqual(["a", "b", "c", "d", "l1", "e"]);
    const blocos = montarBlocos(ev, { ...nomes, nomeContato: "Ana", agora: AGORA_MS, tz: TZ });
    expect(blocos.map((b) => b.rotulo)).toEqual(["Ontem", "Hoje"]);
    const hoje = blocos[1].itens;
    expect(hoje.map((i) => (i.tipo === "msg" ? i.agrupada : "lig"))).toEqual([false, true, false, "lig", false]);
    const lig = hoje[3];
    expect(lig.tipo === "ligacao" && lig.segundos).toBe(600);
    expect(lig.tipo === "ligacao" && lig.quem).toBe("Otávio");
  });

  it("blocos cortam a cada N itens sem repetir o separador de dia", () => {
    const ms = Array.from({ length: 5 }, (_, i) => msg(String(i), "contato", `2026-11-12T13:0${i}:00.000Z`));
    const blocos = montarBlocos(eventosDaConversa(ms, []), { ...nomes, nomeContato: "Ana", agora: AGORA_MS, porBloco: 2, tz: TZ });
    expect(blocos.map((b) => b.itens.length)).toEqual([2, 2, 1]);
    expect(blocos.map((b) => b.primeiroDoDia)).toEqual([true, false, false]);
  });

  it("janela das mais recentes para 'carregar anteriores'", () => {
    expect(janelaRecente(250, 100)).toEqual({ inicio: 150, temAnteriores: true, mostrando: 100 });
    expect(janelaRecente(250, 300)).toEqual({ inicio: 0, temAnteriores: false, mostrando: 250 });
    expect(janelaRecente(0, 100)).toEqual({ inicio: 0, temAnteriores: false, mostrando: 0 });
  });
});

describe("conversas · posse e contexto", () => {
  it("quem conduz e por que o campo fica bloqueado", () => {
    expect(condutorDe({ dono: "robo", operadorId: null }, nomes)).toEqual({ tipo: "robo" });
    expect(condutorDe({ dono: "humano", operadorId: IDS.dono }, nomes)).toEqual({ tipo: "voce" });
    expect(condutorDe({ dono: "humano", operadorId: IDS.otavio }, nomes)).toEqual({ tipo: "outro", nome: "Otávio" });
    expect(motivoBloqueioComposer({ tipo: "robo" }, "Bia", false)).toBe("Bia está conduzindo. Assuma a conversa para responder.");
    expect(motivoBloqueioComposer({ tipo: "voce" }, "Bia", false)).toBeUndefined();
    expect(motivoBloqueioComposer({ tipo: "voce" }, "Bia", true)).toMatch(/só de leitura/);
  });

  it("o aviso de assumir é o mesmo texto que o comando envia ao contato", () => {
    expect(avisoAssumir("Mariana", "João")).toBe("Oi Mariana, daqui pra frente quem fala com você é João. O assistente de IA não atende mais esta conversa.");
  });

  it("por que pediu uma pessoa: só com handoff pendente, com prazo, nota e a última fala", () => {
    const c1 = montarContato(estado, "c1")!;
    const h = motivoDoHandoff(c1, AGORA)!;
    expect(h.minutos).toBe(22);
    expect(h.prazoMin).toBe(120);
    expect(h.estourou).toBe(false);
    expect(h.nota).toBe(9);
    expect(h.ultimaDoContato).toBe("9. E quanto custa?");
    expect(h.motivo).toBeNull();
    expect(motivoDoHandoff(montarContato(estado, "c2")!, AGORA)).toBeNull();
    const comMotivo = { ...c1, movimentos: [...c1.movimentos, { id: "mx", oportunidadeId: "o", de: "conversa" as const, para: "handoff" as const, por: "robo", em: AGORA, motivo: "Handoff: perguntou de valor (só o humano fala de preço)." }] };
    expect(motivoDoHandoff(comMotivo, AGORA)?.motivo).toBe("perguntou de valor (só o humano fala de preço)");
    expect(limparMotivo("Handoff: nota 9.")).toBe("nota 9");
  });

  it("mover: pular ou voltar pede motivo; Briefing feito pede o briefing", () => {
    expect(exigenciaParaMover({ etapa: "conversa", briefing: null }, "handoff")).toBe("livre");
    expect(exigenciaParaMover({ etapa: "conversa", briefing: null }, "oferta")).toBe("motivo");
    expect(exigenciaParaMover({ etapa: "oferta", briefing: null }, "handoff")).toBe("motivo");
    expect(exigenciaParaMover({ etapa: "handoff", briefing: null }, "briefing")).toBe("briefing");
    expect(exigenciaParaMover({ etapa: "handoff", briefing: { dor: "a", meta: "b", data: "c" } }, "briefing")).toBe("livre");
  });

  it("destinos: só etapas que uma pessoa move, sem a atual; perdida não move", () => {
    const d = destinosManuais({ etapa: "handoff", perdida: false }).map((x) => x.id);
    expect(d).toEqual(["novo", "conversa", "briefing", "oferta"]);
    expect(destinosManuais({ etapa: "handoff", perdida: true })).toEqual([]);
    expect(destinosManuais(null)).toEqual([]);
  });

  it("próxima tarefa: a que vence primeiro; sem data vai para o fim", () => {
    const t = (id: string, venceEm: string | null, feita = false) => ({ id, contatoId: "x", texto: id, venceEm, origem: "manual", feita, criadaEm: AGORA });
    const r = proximaTarefa([t("a", null), t("b", "2026-11-14T00:00:00.000Z"), t("c", "2026-11-13T00:00:00.000Z"), t("d", "2026-11-01T00:00:00.000Z", true)]);
    expect(r.tarefa?.id).toBe("c");
    expect(r.abertas).toBe(3);
    expect(proximaTarefa([]).tarefa).toBeNull();
  });

  it("telefone e e-mail mascarados", () => {
    expect(mascararTelefone("(62) 90000-0001")).toBe("••• 0001");
    expect(mascararTelefone("")).toBe("");
    expect(mascararEmail("mariana@exemplo.com")).toBe("ma•••@exemplo.com");
  });
});
