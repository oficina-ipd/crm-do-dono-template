import { describe, expect, it } from "vitest";
import { estadoExemplo, IDS } from "@/data/exemplo";
import { montarContato } from "@/domain/visao";
import {
  autorDoMovimento,
  camposNegocio,
  camposPreenchidos,
  contarPorTipo,
  filtroLinhaValido,
  metaDaFicha,
  montarLinhaDoTempo,
  mostraPropostaPagamento,
  rotuloSalvar,
  textoInicialProposta,
  ultimaProposta,
  validarBriefing,
} from "@/crm-grafite/telas/ficha/modelo";
import { destinoCurto, destinoVoltar, hrefConversaDe, hrefFichaComOrigem, origemSegura } from "@/crm-grafite/telas/ficha/voltar";

const AGORA = "2026-11-12T15:00:00.000Z";
const estado = estadoExemplo(AGORA);
const nomes = { nomeRobo: "Cláudio", operadores: estado.operadores, euId: IDS.dono, funis: estado.funis };
const contato = (id: string) => montarContato(estado, id)!;

describe("ficha · voltar", () => {
  it("só aceita caminho interno", () => {
    expect(origemSegura("/conversas?filtro=precisa&c=c1")).toBe("/conversas?filtro=precisa&c=c1");
    expect(origemSegura("//mal.example/x")).toBeNull();
    expect(origemSegura("https://mal.example")).toBeNull();
    expect(origemSegura("/a\\b")).toBeNull();
    expect(origemSegura("/api/estado")).toBeNull();
    expect(origemSegura("")).toBeNull();
  });
  it("link para a ficha leva a origem em ?de=", () => {
    expect(hrefFichaComOrigem("c1", "/conversas?filtro=precisa&c=c1")).toBe("/contatos/c1?de=%2Fconversas%3Ffiltro%3Dprecisa%26c%3Dc1");
    expect(hrefFichaComOrigem("c1", null)).toBe("/contatos/c1");
  });
  it("voltar devolve à origem com o rótulo certo; sem origem, Pessoas", () => {
    expect(destinoVoltar("/conversas?filtro=precisa&c=c1")).toEqual({ href: "/conversas?filtro=precisa&c=c1", rotulo: "Voltar para Conversas", daOrigem: true });
    expect(destinoVoltar("/funil").rotulo).toBe("Voltar para o Funil");
    expect(destinoVoltar("/").rotulo).toBe("Voltar para a Fila");
    expect(destinoVoltar(null)).toEqual({ href: "/pessoas", rotulo: "Voltar para Pessoas", daOrigem: false });
    expect(destinoCurto("Voltar para o Funil")).toBe("Funil");
    expect(destinoCurto("Voltar para Conversas")).toBe("Conversas");
  });
  it("abrir conversa a partir da ficha mantém o filtro de onde veio", () => {
    expect(hrefConversaDe("c1", "/conversas?filtro=precisa&c=c9")).toBe("/conversas?filtro=precisa&c=c1");
    expect(hrefConversaDe("c1", "/funil")).toBe("/conversas?c=c1");
    expect(hrefConversaDe("c1", null)).toBe("/conversas?c=c1");
  });
});

describe("ficha · linha do tempo", () => {
  it("junta mensagens, ligações, notas, movimentos e tarefas, da mais recente para a mais antiga", () => {
    const c = contato("c2");
    const ev = montarLinhaDoTempo(c, nomes);
    for (let i = 1; i < ev.length; i++) expect(ev[i - 1].em >= ev[i].em).toBe(true);
    const n = contarPorTipo(ev);
    expect(n.ligacao).toBe(1);
    expect(n.nota).toBe(1);
    expect(n.tarefa).toBe(2);
    // 7 mensagens, uma delas o aviso de troca (vira movimento)
    expect(n.mensagem).toBe(6);
    expect(n.tudo).toBe(ev.length);
    expect(ev.find((e) => e.tipo === "ligacao")?.titulo).toBe("Ligação · 10 min · quente");
    expect(ev.find((e) => e.titulo === "Uma pessoa assumiu a conversa")?.tipo).toBe("movimento");
    expect(ev.find((e) => e.titulo === "Chegou pelo funil Live semanal")).toBeTruthy();
    expect(ev.some((e) => e.titulo === "Handoff → Briefing feito" && e.autor === "Otávio")).toBe(true);
  });
  it("perda, proposta e pagamento entram como movimento", () => {
    const sonia = montarLinhaDoTempo(contato("c11"), nomes);
    expect(sonia.find((e) => e.titulo === "Oportunidade perdida")?.texto).toBe("preço");
    const renata = montarLinhaDoTempo(contato("c5"), nomes);
    expect(renata.some((e) => e.titulo.startsWith("Link de pagamento (Pix)"))).toBe(true);
    expect(renata.some((e) => e.titulo === "Proposta enviada por WhatsApp")).toBe(true);
  });
  it("autor do movimento", () => {
    expect(autorDoMovimento("robo", { ...nomes, nomeRobo: "Bia" })).toBe("Bia");
    expect(autorDoMovimento("sistema", nomes)).toBe("Automático");
    expect(autorDoMovimento(IDS.dono, nomes)).toBe("Você");
  });
  it("filtro inválido vira 'tudo'", () => {
    expect(filtroLinhaValido("nota")).toBe("nota");
    expect(filtroLinhaValido("xyz")).toBe("tudo");
    expect(filtroLinhaValido(undefined)).toBe("tudo");
  });
});

describe("ficha · lateral", () => {
  it("negócio só com campos preenchidos", () => {
    const c = contato("c3");
    const campos = camposNegocio(c, estado);
    expect(campos.map((x) => x.rotulo)).toEqual(["Empresa", "Segmento", "Cidade", "Origem", "Nota que se deu", "Produto", "Valor"]);
    expect(campos.find((x) => x.rotulo === "Valor")?.valor).toMatch(/1\.997/);
    const vazio = camposNegocio({ ...c, empresa: "", segmento: " ", cidade: "", nota: null, oportunidades: [] }, estado);
    expect(vazio.map((x) => x.rotulo)).toEqual(["Origem"]);
  });
  it("quem é numa linha", () => {
    expect(metaDaFicha(contato("c1"))).toBe("Clínica Exemplo Vida · Lead · Handoff");
    expect(metaDaFicha(contato("c11"))).toBe("Carvalho Imóveis · Lead · Perdida em Oferta com condição");
    expect(metaDaFicha(contato("c7"))).toMatch(/Cliente · Pago$/);
  });
  it("briefing: os três juntos; estado do salvamento em texto", () => {
    expect(validarBriefing({ dor: " a ", meta: "b", data: "c" })).toEqual({ ok: true, briefing: { dor: "a", meta: "b", data: "c" } });
    expect(validarBriefing({ dor: "a", meta: "", data: "c" }).ok).toBe(false);
    expect(camposPreenchidos(null)).toBe(0);
    expect(camposPreenchidos({ dor: "a", meta: "", data: "c" })).toBe(2);
    expect(rotuloSalvar({ tipo: "salvando" }, () => "")).toBe("Salvando…");
    expect(rotuloSalvar({ tipo: "salvo", em: AGORA }, () => "12:00")).toBe("Salvo às 12:00");
    expect(rotuloSalvar({ tipo: "falhou", erro: "x" }, () => "")).toBe("Não salvou: x");
    expect(rotuloSalvar({ tipo: "parado" }, () => "")).toBe("");
  });
  it("proposta: texto inicial sai do briefing; seção aparece do briefing em diante", () => {
    const c = contato("c2");
    const o = c.oportunidades[0];
    const t = textoInicialProposta(c, o, estado.produtos[0], "Otávio");
    expect(t).toContain("Orçamentos espalhados");
    expect(t).toContain("Comunidade IA para Donos");
    expect(t.trim().endsWith("Otávio")).toBe(true);
    expect(mostraPropostaPagamento(c, o)).toBe(true);
    const ana = contato("c3");
    expect(mostraPropostaPagamento(ana, ana.oportunidades[0])).toBe(false);
    const carlos = contato("c4");
    expect(ultimaProposta(carlos, carlos.oportunidades[0].id)?.id).toBe("pr1");
  });
});
