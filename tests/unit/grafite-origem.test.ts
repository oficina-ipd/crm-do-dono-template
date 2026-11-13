import { describe, expect, it } from "vitest";
import { estadoVazio } from "@/data/exemplo";
import type { Contato, EstadoCRM } from "@/domain/types";
import {
  agruparPorSemana,
  comparacao,
  entradasPorDia,
  gastoDoForm,
  gastoPorCriativo,
  intervalosOrigem,
  lerReais,
  periodoValido,
  porFunil,
  porOrigem,
  resumoSerie,
  segundaDe,
  taxaComAmostra,
  temSerieReal,
  unidadeEfetiva,
  validarGasto,
  variacaoTexto,
} from "@/crm-grafite/telas/origem/origem-logica";
import { demanda } from "@/domain/metricas";

const AGORA = "2026-11-12T15:00:00.000Z";
const dia = (d: string) => `${d}T15:00:00.000Z`;

function contato(id: string, origem: string, criadoEm: string): Contato {
  return { id, nome: id, empresa: "", segmento: "", cidade: "", telefone: "", email: "", origem, nota: null, dono: "robo", operadorId: null, handoffPendente: false, handoffDesde: null, termometro: null, criadoEm };
}
function base(): EstadoCRM {
  const e = estadoVazio(AGORA);
  e.funis = [
    { id: "perpetuo", nome: "Perpétuo", canal: "Anúncio", produto: e.produtos[0]?.id ?? "p", ativo: true },
    { id: "live", nome: "Live", canal: "Aula", produto: e.produtos[0]?.id ?? "p", ativo: false },
  ];
  e.criativos = [{ id: "cr1", funilId: "perpetuo", nome: "Vídeo", plataforma: "Meta Ads", ativo: true }];
  return e;
}

describe("origem · período e série", () => {
  it("período inválido volta para 14", () => {
    expect(periodoValido(30)).toBe(30);
    expect(periodoValido(3)).toBe(14);
  });

  it("entradas por dia completa os dias sem entrada com zero e soma o total", () => {
    const e = base();
    e.contatos = [contato("a", "perpetuo", dia("2026-11-10")), contato("b", "perpetuo", dia("2026-11-10")), contato("c", "live", dia("2026-11-12")), contato("d", "live", dia("2026-10-01"))];
    const { atual } = intervalosOrigem(7, AGORA);
    const s = entradasPorDia(e, atual);
    expect(s).toHaveLength(7);
    expect(s[s.length - 1]).toEqual({ dia: "2026-11-12", total: 1 });
    expect(s.find((x) => x.dia === "2026-11-11")?.total).toBe(0);
    expect(s.reduce((a, x) => a + x.total, 0)).toBe(3);
  });

  it("semana começa na segunda e agrupa a série", () => {
    expect(segundaDe("2026-11-12")).toBe("2026-11-09");
    expect(segundaDe("2026-11-09")).toBe("2026-11-09");
    const g = agruparPorSemana([
      { dia: "2026-11-08", total: 1 },
      { dia: "2026-11-09", total: 2 },
      { dia: "2026-11-10", total: 3 },
    ]);
    expect(g).toEqual([
      { semana: "2026-11-02", total: 1, dias: 1 },
      { semana: "2026-11-09", total: 5, dias: 2 },
    ]);
  });

  it("30 dias agrupa por semana; a escolha vale só para o período em que foi feita", () => {
    expect(unidadeEfetiva(null, 30)).toBe("semana");
    expect(unidadeEfetiva(null, 7)).toBe("dia");
    expect(unidadeEfetiva({ dias: 7, unidade: "semana" }, 7)).toBe("semana");
    expect(unidadeEfetiva({ dias: 7, unidade: "semana" }, 14)).toBe("dia");
  });

  it("gráfico só com série real e com resumo em texto", () => {
    expect(temSerieReal([{ total: 1 }, { total: 0 }])).toBe(false);
    const serie = Array.from({ length: 7 }, (_, i) => ({ dia: `2026-11-0${i + 1}`, total: i === 6 ? 4 : i % 2 }));
    expect(temSerieReal(serie)).toBe(true);
    expect(resumoSerie(serie)).toMatch(/^Média de 1 por dia\. Maior dia: 07\/11, com 4\. Menor: 01\/11, com 0\./);
  });
});

describe("origem · tabelas", () => {
  it("por origem usa o nome do funil e mostra origem desconhecida pelo código", () => {
    const e = base();
    e.contatos = [contato("a", "perpetuo", dia("2026-11-10")), contato("b", "perpetuo", dia("2026-11-11")), contato("c", "indicacao", dia("2026-11-11"))];
    expect(porOrigem(e, intervalosOrigem(7, AGORA).atual)).toEqual([
      { chave: "perpetuo", rotulo: "Perpétuo", total: 2 },
      { chave: "indicacao", rotulo: "indicacao", total: 1 },
    ]);
  });

  it("por funil inclui ativos ou com movimento, e o total bate com a demanda geral", () => {
    const e = base();
    e.contatos = [contato("a", "perpetuo", dia("2026-11-10"))];
    const i = intervalosOrigem(7, AGORA).atual;
    const linhas = porFunil(e, i);
    expect(linhas.map((l) => l.chave)).toEqual(["perpetuo", "__total"]);
    expect(linhas[1].d).toEqual(demanda(e, i));
  });

  it("gasto por criativo soma valor e visitas, separa gasto sem criativo e tem total", () => {
    const e = base();
    e.gastos = [
      { id: "g1", funilId: "perpetuo", criativoId: "cr1", data: "2026-11-10", valor: 40, visitas: 10 },
      { id: "g2", funilId: "perpetuo", criativoId: "cr1", data: "2026-11-11", valor: 60, visitas: 5 },
      { id: "g3", funilId: "live", criativoId: null, data: "2026-11-11", valor: 120, visitas: 0 },
      { id: "g4", funilId: "live", criativoId: null, data: "2026-09-01", valor: 999, visitas: 0 },
    ];
    const l = gastoPorCriativo(e, intervalosOrigem(7, AGORA).atual);
    expect(l.map((x) => [x.nome, x.gasto, x.visitas])).toEqual([
      ["Sem criativo", 120, 0],
      ["Vídeo", 100, 15],
      ["Total", 220, 15],
    ]);
  });

  it("taxa com base pequena vira amostra pequena", () => {
    expect(taxaComAmostra(1, 4)).toBe("Amostra pequena (4)");
    expect(taxaComAmostra(1, 0)).toBe("—");
    expect(taxaComAmostra(5, 20)).toBe("25%");
  });

  it("variação contra o período anterior", () => {
    expect(variacaoTexto(12, 10)).toBe("+20%");
    expect(variacaoTexto(8, 10)).toBe("−20%");
    expect(variacaoTexto(5, 0)).toBe("—");
    expect(variacaoTexto(0, 0)).toBe("igual");
    expect(variacaoTexto(null, 3)).toBe("—");
    const e = base();
    const i = intervalosOrigem(7, AGORA);
    expect(comparacao(demanda(e, i.atual), demanda(e, i.anterior)).map((l) => l.chave)).toContain("cpl");
  });
});

describe("origem · lançar gasto", () => {
  const ok = { funilId: "perpetuo", criativoId: "", data: "2026-11-10", valor: "45,90", visitas: "" };

  it("lê reais no jeito brasileiro", () => {
    expect(lerReais("45,90")).toBe(45.9);
    expect(lerReais("1.234,50")).toBe(1234.5);
    expect(lerReais("45.9")).toBe(45.9);
    expect(lerReais("R$ 30")).toBe(30);
    expect(Number.isNaN(lerReais("abc"))).toBe(true);
  });

  it("valida campo a campo e converte no comando", () => {
    expect(validarGasto(ok, "2026-11-12")).toEqual({});
    expect(validarGasto({ ...ok, valor: "" }, "2026-11-12").valor).toMatch(/quanto foi gasto/);
    expect(validarGasto({ ...ok, data: "2026-11-20" }, "2026-11-12").data).toMatch(/depois de hoje/);
    expect(validarGasto({ ...ok, visitas: "2,5" }, "2026-11-12").visitas).toMatch(/inteiro/);
    expect(validarGasto({ ...ok, funilId: "" }, "2026-11-12").funilId).toBeTruthy();
    expect(gastoDoForm(ok)).toEqual({ funilId: "perpetuo", criativoId: null, data: "2026-11-10", valor: 45.9, visitas: 0 });
  });
});
