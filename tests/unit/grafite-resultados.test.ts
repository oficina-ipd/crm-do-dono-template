import { describe, expect, it } from "vitest";
import { estadoVazio } from "@/data/exemplo";
import type { EstadoCRM, EtapaId, Movimento, Oportunidade } from "@/domain/types";
import {
  contaReversa,
  contagens,
  diasSemFechar,
  duracaoCurta,
  emAbertoPorEtapa,
  intervaloAnterior,
  intervaloDias,
  janelaValida,
  perdasPorMotivo,
  previsaoDoMes,
  situacaoTaxa,
  taxaTexto,
  taxasPorEtapa,
  textoSemFechar,
  validarVendasPorDia,
  type TaxaEtapa,
} from "@/crm-grafite/telas/resultados/resultados-logica";

const AGORA = "2026-11-12T15:00:00.000Z";
const diasAtras = (n: number, h = 15) => new Date(Date.parse(`2026-11-12T${String(h).padStart(2, "0")}:00:00.000Z`) - n * 86_400_000).toISOString();

function op(id: string, etapa: EtapaId, extra: Partial<Oportunidade> = {}): Oportunidade {
  return { id, contatoId: `c-${id}`, produtoId: "p1", valor: 1000, etapa, entrouNaEtapaEm: diasAtras(1), proximoPasso: "", briefing: null, perdida: false, motivoPerda: null, criadaEm: diasAtras(5), ...extra };
}
function mov(opId: string, de: EtapaId | null, para: EtapaId, em: string, motivo: string | null = null): Movimento {
  return { id: `${opId}-${para}-${em}`, oportunidadeId: opId, de, para, por: "robo", em, motivo };
}
function base(): EstadoCRM {
  return estadoVazio(AGORA);
}

describe("resultados · intervalos", () => {
  it("janela inválida volta para 30 dias", () => {
    expect(janelaValida(7)).toBe(7);
    expect(janelaValida(9)).toBe(30);
  });
  it("intervalo anterior tem o mesmo tamanho e termina antes do atual", () => {
    const i = intervaloDias(7, AGORA);
    const a = intervaloAnterior(i);
    expect(Date.parse(a.fim)).toBeLessThan(Date.parse(i.inicio));
    expect(Math.round((Date.parse(i.inicio) - Date.parse(a.inicio)) / 86_400_000)).toBe(7);
  });
});

describe("resultados · taxa por etapa", () => {
  it("conta quem entrou e quem avançou no período, sem contar Perdido como avanço", () => {
    const e = base();
    e.movimentos = [
      mov("a", null, "novo", diasAtras(3)),
      mov("a", "novo", "conversa", diasAtras(2)),
      mov("b", null, "novo", diasAtras(3)),
      mov("b", "novo", "perdido", diasAtras(2)),
      mov("c", null, "novo", diasAtras(40)),
      mov("c", "novo", "conversa", diasAtras(2)),
    ];
    const t = taxasPorEtapa(e, intervaloDias(30, AGORA));
    const novo = t.find((x) => x.etapaId === "novo")!;
    expect(novo.entraram).toBe(2);
    expect(novo.avancaram).toBe(1);
    expect(novo.real).toBe(50);
    expect(novo.para).toBe("Em conversa");
    expect(t.some((x) => x.etapaId === "perdido")).toBe(false);
  });

  it("menos de 10 entradas vira amostra pequena, nunca percentual", () => {
    expect(taxaTexto(50, 4)).toBe("Amostra pequena (4)");
    expect(taxaTexto(null, 0)).toBe("Sem entradas");
    expect(taxaTexto(42.5, 12)).toBe("42,5%");
    expect(situacaoTaxa(80, 70, 9)).toBe("sem");
    expect(situacaoTaxa(60, 70, 10)).toBe("abaixo");
    expect(situacaoTaxa(70, 70, 10)).toBe("acima");
  });
});

describe("resultados · conta reversa", () => {
  const t = (etapaId: EtapaId, paraId: EtapaId, real: number | null, entraram: number): TaxaEtapa => ({ etapaId, paraId, de: etapaId, para: paraId, real, entraram, avancaram: 0, meta: 50 });

  it("anda de trás para frente com as taxas do período", () => {
    const r = contaReversa(1, [t("proposta", "oferta", 50, 20), t("oferta", "pago", 25, 20)]);
    expect(r.passos.map((p) => [p.etapaId, p.porDia])).toEqual([
      ["oferta", 4],
      ["proposta", 8],
    ]);
    expect(r.bloqueadaEm).toBeNull();
  });

  it("para na primeira taxa sem amostra", () => {
    const r = contaReversa(1, [t("proposta", "oferta", 50, 3), t("oferta", "pago", 25, 20)]);
    expect(r.passos).toHaveLength(1);
    expect(r.bloqueadaEm).toBe("proposta → oferta");
  });

  it("valida o campo junto do campo", () => {
    expect(validarVendasPorDia("")).toMatch(/0,1 a 100/);
    expect(validarVendasPorDia("abc")).toMatch(/números/);
    expect(validarVendasPorDia("1,5")).toBeNull();
    expect(validarVendasPorDia("200")).toMatch(/0,1 a 100/);
  });
});

describe("resultados · hoje, mês e venda", () => {
  it("conta contatos, robô, etapas e receita no intervalo", () => {
    const e = base();
    e.contatos = [{ ...({} as EstadoCRM["contatos"][number]), id: "c1", nome: "A", criadoEm: diasAtras(0, 13) } as EstadoCRM["contatos"][number]];
    e.mensagens = [
      { id: "m1", contatoId: "c1", autor: "robo", texto: "oi", em: diasAtras(0, 13) },
      { id: "m2", contatoId: "c1", autor: "robo", texto: "aviso", em: diasAtras(0, 13), aviso: true },
    ];
    e.movimentos = [mov("a", "oferta", "pago", diasAtras(0, 14)), mov("a", "oferta", "pago", diasAtras(0, 14))];
    e.pagamentos = [{ id: "p", oportunidadeId: "a", valor: 500, metodo: "pix", status: "pago", linkUrl: null, expiraEm: null, criadoEm: diasAtras(1), pagoEm: diasAtras(0, 14) }];
    const c = contagens(e, intervaloDias(1, AGORA));
    expect(c).toMatchObject({ leads: 1, conversouComRobo: 1, vendas: 1, receita: 500 });
  });

  it("dias sem fechar a partir da última venda", () => {
    const e = base();
    expect(diasSemFechar(e, AGORA)).toBeNull();
    expect(textoSemFechar(null)).toBe("Nenhuma venda registrada");
    e.movimentos = [mov("a", "oferta", "pago", diasAtras(3))];
    expect(diasSemFechar(e, AGORA)).toBe(3);
    expect(textoSemFechar(3)).toBe("3 dias sem fechar");
    expect(textoSemFechar(0)).toBe("Teve venda hoje");
  });

  it("previsão do mês é média por dia vezes os dias do mês", () => {
    const e = base();
    e.movimentos = [mov("a", "oferta", "pago", "2026-11-05T15:00:00.000Z"), mov("b", "oferta", "pago", "2026-11-06T15:00:00.000Z")];
    const p = previsaoDoMes(e, AGORA);
    expect(p.vendasAteHoje).toBe(2);
    expect(p.diasNoMes).toBe(30);
    expect(p.vendasFimDoMes).toBe(Math.round((2 / p.diasPassados) * 30));
    expect(p.receitaFimDoMes).toBeNull();
  });
});

describe("resultados · em aberto e perdas", () => {
  it("em aberto ignora perdidas e etapas finais", () => {
    const e = base();
    e.oportunidades = [op("a", "conversa", { valor: 300, entrouNaEtapaEm: diasAtras(2) }), op("b", "conversa", { perdida: true }), op("c", "pago")];
    const l = emAbertoPorEtapa(e, AGORA);
    const conversa = l.find((x) => x.etapaId === "conversa")!;
    expect(conversa).toMatchObject({ abertas: 1, valor: 300, mediaMin: 2 * 1440 });
    expect(l.some((x) => x.etapaId === "pago")).toBe(false);
    expect(duracaoCurta(2 * 1440)).toBe("2 dias");
    expect(duracaoCurta(90)).toBe("2 h");
  });

  it("perdas por motivo no período, uma por oportunidade", () => {
    const e = base();
    e.oportunidades = [op("a", "oferta", { perdida: true, motivoPerda: "preço" }), op("b", "oferta", { perdida: true, motivoPerda: null })];
    e.movimentos = [mov("a", "oferta", "perdido", diasAtras(2)), mov("a", "oferta", "perdido", diasAtras(1)), mov("b", "oferta", "perdido", diasAtras(1)), mov("c", "oferta", "perdido", diasAtras(60), "sumiu")];
    expect(perdasPorMotivo(e, intervaloDias(30, AGORA))).toEqual([
      { motivo: "Preço", total: 1 },
      { motivo: "Sem motivo", total: 1 },
    ]);
  });
});
