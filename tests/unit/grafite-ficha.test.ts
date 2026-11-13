import { describe, expect, it } from "vitest";
import { estadoExemplo, IDS } from "@/data/exemplo";
import { montarContato } from "@/domain/visao";
import {
  autorDoMovimento,
  camposNegocio,
  camposPreenchidos,
  metaDaFicha,
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
    expect(destinoVoltar("/fila").rotulo).toBe("Voltar para a Fila");
    expect(destinoVoltar("/hoje").rotulo).toBe("Voltar para a Fila");
    expect(destinoVoltar("/").rotulo).toBe("Voltar para o Painel");
    expect(destinoVoltar("/painel").rotulo).toBe("Voltar para o Painel");
    expect(destinoCurto("Voltar para o Painel")).toBe("Painel");
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

describe("ficha · autor do movimento", () => {
  it("robô, automático ou operador", () => {
    expect(autorDoMovimento("robo", { ...nomes, nomeRobo: "Bia" })).toBe("Bia");
    expect(autorDoMovimento("sistema", nomes)).toBe("Automático");
    expect(autorDoMovimento(IDS.dono, nomes)).toBe("Você");
  });
});

describe("ficha · lateral", () => {
  it("negócio só com campos preenchidos", () => {
    const c = contato("c3");
    const campos = camposNegocio(c, estado);
    // Empresa e origem ficam no bloco Contato (identidade), sem repetir em Negócio
    expect(campos.map((x) => x.rotulo)).toEqual(["Segmento", "Cidade", "Nota que se deu", "Produto", "Valor"]);
    expect(campos.find((x) => x.rotulo === "Valor")?.valor).toMatch(/1\.997/);
    const vazio = camposNegocio({ ...c, empresa: "", segmento: " ", cidade: "", nota: null, oportunidades: [] }, estado);
    expect(vazio).toEqual([]);
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
