import { describe, expect, it } from "vitest";
import {
  agruparTarefas,
  casaBusca,
  compararTarefas,
  contarSituacoes,
  filtrarTarefas,
  fimDoDia,
  grupoDaTarefa,
  idNovo,
  isoDeLocal,
  montarTarefas,
  rotuloOrigem,
  rotuloVencimento,
  type TarefaLinha,
} from "@/crm-grafite/telas/tarefas/logica";

// horário local, para o teste valer em qualquer fuso
const AGORA = new Date(2026, 10, 12, 15, 0, 0);
const em = (dia: number, h: number, m = 0) => new Date(2026, 10, dia, h, m, 0).toISOString();

const t = (id: string, venceEm: string | null, extra: Partial<TarefaLinha> = {}): TarefaLinha => ({
  id,
  titulo: `Tarefa ${id}`,
  venceEm,
  origem: "manual",
  feita: false,
  criadaEm: em(10, 9),
  contato: { id: "c1", nome: "Mariana Rocha" },
  ...extra,
});

describe("grupos das tarefas", () => {
  it("separa atrasadas, hoje, próximas, sem data e feitas", () => {
    expect(grupoDaTarefa(t("a", em(12, 14)), AGORA)).toBe("atrasadas");
    expect(grupoDaTarefa(t("b", em(11, 9)), AGORA)).toBe("atrasadas");
    expect(grupoDaTarefa(t("c", em(12, 16)), AGORA)).toBe("hoje");
    expect(grupoDaTarefa(t("d", em(12, 23, 59)), AGORA)).toBe("hoje");
    expect(grupoDaTarefa(t("e", em(13, 0, 1)), AGORA)).toBe("proximas");
    expect(grupoDaTarefa(t("f", null), AGORA)).toBe("semData");
    expect(grupoDaTarefa(t("g", "não é data"), AGORA)).toBe("semData");
    expect(grupoDaTarefa(t("h", em(11, 9), { feita: true }), AGORA)).toBe("feitas");
  });

  it("fim do dia é 23:59:59 local", () => {
    const f = fimDoDia(AGORA);
    expect([f.getHours(), f.getMinutes(), f.getDate()]).toEqual([23, 59, 12]);
  });

  it("ordena pela data, sem data pela criação mais nova, e mantém no lugar quem foi fixado", () => {
    const lista = [t("tarde", em(12, 18)), t("cedo", em(12, 16)), t("velha", em(10, 8)), t("s1", null, { criadaEm: em(1, 8) }), t("s2", null, { criadaEm: em(5, 8) })];
    const g = agruparTarefas(lista, AGORA);
    expect(g.hoje.map((x) => x.id)).toEqual(["cedo", "tarde"]);
    expect(g.atrasadas.map((x) => x.id)).toEqual(["velha"]);
    expect(g.semData.map((x) => x.id)).toEqual(["s2", "s1"]);
    // concluída nesta visita: continua em "atrasadas"
    const feita = { ...lista[2], feita: true };
    const g2 = agruparTarefas([feita], AGORA, new Map([["velha", "atrasadas" as const]]));
    expect(g2.atrasadas.map((x) => x.id)).toEqual(["velha"]);
    expect(g2.feitas).toEqual([]);
  });

  it("empate de data vai pelo título", () => {
    expect(compararTarefas(t("x", em(12, 16), { titulo: "B" }), t("y", em(12, 16), { titulo: "A" }))).toBeGreaterThan(0);
  });
});

describe("filtros", () => {
  const lista = [t("1", em(12, 16), { titulo: "Ligar para a Clínica" }), t("2", null, { feita: true, origem: "ligação 10:15" }), t("3", null, { contato: { id: "c2", nome: "João Mendes" } })];

  it("busca no texto, na pessoa e na origem, sem acento", () => {
    expect(casaBusca(lista[0], "clinica")).toBe(true);
    expect(casaBusca(lista[1], "ligacao")).toBe(true);
    expect(casaBusca(lista[2], "joão")).toBe(true);
    expect(casaBusca(lista[2], "")).toBe(true);
    expect(casaBusca(lista[0], "pix")).toBe(false);
  });

  it("filtra por situação e conta", () => {
    expect(filtrarTarefas(lista, { situacao: "abertas", busca: "" }).map((x) => x.id)).toEqual(["1", "3"]);
    expect(filtrarTarefas(lista, { situacao: "feitas", busca: "" }).map((x) => x.id)).toEqual(["2"]);
    expect(filtrarTarefas(lista, { situacao: "todas", busca: "joao" }).map((x) => x.id)).toEqual(["3"]);
    expect(contarSituacoes(lista, "")).toEqual({ abertas: 2, feitas: 1, todas: 3 });
  });

  it("concluída nesta visita continua nas abertas até trocar o filtro", () => {
    const feita = [{ ...lista[0], feita: true }];
    expect(filtrarTarefas(feita, { situacao: "abertas", busca: "" }, new Map([["1", "abertas" as const]]))).toHaveLength(1);
    expect(filtrarTarefas(feita, { situacao: "abertas", busca: "" })).toHaveLength(0);
  });
});

describe("textos de data e origem", () => {
  it("rótulo de vencimento relativo ao dia", () => {
    expect(rotuloVencimento(null, AGORA)).toBe("Sem data");
    expect(rotuloVencimento(em(12, 16), AGORA)).toBe("Hoje, 16:00");
    expect(rotuloVencimento(em(12, 23, 59), AGORA)).toBe("Hoje, até o fim do dia");
    expect(rotuloVencimento(em(13, 9), AGORA)).toBe("Amanhã, 09:00");
    expect(rotuloVencimento(em(11, 15), AGORA)).toBe("Venceu ontem, 15:00 (há 1 d)");
    expect(rotuloVencimento(em(12, 14, 40), AGORA)).toBe("Venceu hoje, 14:40 (há 20 min)");
    expect(rotuloVencimento(em(16, 9), AGORA)).toMatch(/16\/11, 09:00$/);
  });

  it("origem em texto", () => {
    expect(rotuloOrigem("manual", "Cláudio")).toBe("Criada à mão");
    expect(rotuloOrigem("ligação 10:15", "Cláudio")).toBe("Da ligação 10:15");
    expect(rotuloOrigem("cláudio", "Cláudio")).toBe("Criada pelo Cláudio");
    expect(rotuloOrigem("importação", "Cláudio")).toBe("Origem: importação");
  });

  it("data e hora locais viram ISO; hora vazia é o fim do dia; data inexistente recusa", () => {
    expect(isoDeLocal("2026-11-12", "16:30")).toBe(new Date(2026, 10, 12, 16, 30).toISOString());
    expect(isoDeLocal("2026-11-12", "")).toBe(new Date(2026, 10, 12, 23, 59).toISOString());
    expect(isoDeLocal("2026-02-31", "")).toBeNull();
    expect(isoDeLocal("12/11/2026", "")).toBeNull();
    expect(isoDeLocal("2026-11-12", "25:00")).toBeNull();
  });
});

describe("modelo a partir do estado", () => {
  it("liga a tarefa à pessoa e acha a tarefa nova", () => {
    const linhas = montarTarefas({
      contatos: [{ id: "c1", nome: "Mariana" } as never],
      tarefas: [
        { id: "t1", contatoId: "c1", texto: "Ligar", venceEm: null, origem: "manual", feita: false, criadaEm: em(1, 1) },
        { id: "t2", contatoId: "sumiu", texto: "Outra", venceEm: null, origem: "manual", feita: false, criadaEm: em(1, 1) },
      ],
    });
    expect(linhas[0].contato).toEqual({ id: "c1", nome: "Mariana" });
    expect(linhas[1].contato).toBeNull();
    expect(idNovo([{ id: "a" }], [{ id: "a" }, { id: "b" }])).toBe("b");
    expect(idNovo([{ id: "a" }], [{ id: "a" }])).toBeNull();
  });
});
