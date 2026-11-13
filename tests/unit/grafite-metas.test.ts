import { describe, expect, it } from "vitest";
import { estadoVazio } from "@/data/exemplo";
import { ETAPAS } from "@/domain/funil";
import type { Movimento } from "@/domain/types";
import { intervaloMetas, linhasMetas, periodoMetasValido, resumoMetas, textoSituacao } from "@/crm-grafite/telas/metas/metas-logica";

const AGORA = "2026-11-12T15:00:00.000Z";
const em = (dias: number) => new Date(Date.parse(AGORA) - dias * 86_400_000).toISOString();

function movs(n: number, avancam: number, diasAtras = 2): Movimento[] {
  const out: Movimento[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ id: `n${i}`, oportunidadeId: `o${i}`, de: null, para: "novo", por: "robo", em: em(diasAtras + 1), motivo: null });
    if (i < avancam) out.push({ id: `c${i}`, oportunidadeId: `o${i}`, de: "novo", para: "conversa", por: "robo", em: em(diasAtras), motivo: null });
  }
  return out;
}

describe("metas", () => {
  it("período inválido vira 30 dias; 'tudo' começa no início", () => {
    expect(periodoMetasValido("x")).toBe("30");
    expect(periodoMetasValido("tudo")).toBe("tudo");
    expect(intervaloMetas("tudo", AGORA).inicio).toBe(new Date(0).toISOString());
  });

  it("uma linha por etapa com a meta do funil, prazo e o que conta como avanço", () => {
    const e = estadoVazio(AGORA);
    const l = linhasMetas(e, intervaloMetas("30", AGORA));
    expect(l).toHaveLength(ETAPAS.filter((x) => x.id !== "perdido").length - 1);
    expect(l[0]).toMatchObject({ etapaId: "novo", meta: ETAPAS[0].meta, prazoTexto: ETAPAS[0].prazoTexto, validacao: ETAPAS[0].validacao, situacao: "sem" });
    expect(l.find((x) => x.etapaId === "pago")?.prazoTexto).toBe("Sem prazo");
  });

  it("compara meta e realizado só com amostra suficiente", () => {
    const e = estadoVazio(AGORA);
    e.movimentos = movs(10, 6);
    const novo = linhasMetas(e, intervaloMetas("30", AGORA)).find((x) => x.etapaId === "novo")!;
    expect(novo.realTexto).toBe("60%");
    expect(novo.situacao).toBe("abaixo");
    expect(novo.diferenca).toBe(-10);
    expect(textoSituacao(novo)).toBe("Abaixo da meta (10 pontos)");

    e.movimentos = movs(4, 4);
    const pequena = linhasMetas(e, intervaloMetas("30", AGORA)).find((x) => x.etapaId === "novo")!;
    expect(pequena.realTexto).toBe("Amostra pequena (4)");
    expect(pequena.diferenca).toBeNull();
    expect(textoSituacao(pequena)).toBe("Ainda sem amostra para comparar");
  });

  it("resumo da faixa diz quantas etapas dá para comparar", () => {
    const e = estadoVazio(AGORA);
    expect(resumoMetas(linhasMetas(e, intervaloMetas("30", AGORA)))).toBe("Nenhuma etapa com amostra suficiente ainda");
    e.movimentos = movs(10, 8);
    expect(resumoMetas(linhasMetas(e, intervaloMetas("30", AGORA)))).toBe("1 de 7 etapas com amostra · todas na meta");
    e.movimentos = movs(10, 2, 40);
    expect(resumoMetas(linhasMetas(e, intervaloMetas("30", AGORA)))).toBe("Nenhuma etapa com amostra suficiente ainda");
    expect(resumoMetas(linhasMetas(e, intervaloMetas("90", AGORA)))).toBe("1 de 7 etapas com amostra · 1 abaixo da meta");
  });
});
