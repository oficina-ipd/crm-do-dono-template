import { describe, expect, it } from "vitest";
import { estadoExemplo } from "@/data/exemplo";
import { contatosCompletos } from "@/domain/visao";
import { etapasDoQuadro } from "@/crm-grafite/telas/funil/logica";
import {
  casaBusca,
  filtrarPessoas,
  filtrosAtivosPessoas,
  filtrosDoCaminho,
  FILTROS_PESSOAS_PADRAO,
  hrefFichaPessoa,
  limiteValido,
  opcoesConduzPessoas,
  ordemDaUrl,
  ordenarPessoas,
  ORDEM_PADRAO,
  PAGINA_PESSOAS,
  pessoasDoEstado,
  quandoCurto,
  rotuloEtapaPessoa,
  telefoneLegivel,
  urlDePessoas,
  type PessoaLinha,
} from "@/crm-grafite/telas/pessoas/logica";

const AGORA = "2026-11-12T15:00:00.000Z";
const agora = new Date(AGORA);
const sp = (s: string) => new URLSearchParams(s);

function linha(p: Partial<PessoaLinha> & { id: string }): PessoaLinha {
  return {
    nome: "Fulano",
    empresa: null,
    email: null,
    telefone: null,
    tipo: "lead",
    situacao: "aberta",
    etapa: { id: "novo", nome: "Lead novo", ordem: 0 },
    ultimaConversa: null,
    conduzChave: "robo",
    conduz: "Cláudio",
    origem: "perpetuo",
    origemRotulo: "Perpétuo",
    criadoEm: "2026-11-01T10:00:00.000Z",
    ...p,
  };
}

describe("linhas a partir do estado", () => {
  const estado = estadoExemplo(AGORA);
  const linhas = pessoasDoEstado(estado, contatosCompletos(estado), etapasDoQuadro());

  it("uma linha por contato, com tipo, etapa, conduz, origem e última conversa reais", () => {
    expect(linhas).toHaveLength(estado.contatos.length);
    for (const l of linhas) {
      const c = estado.contatos.find((x) => x.id === l.id)!;
      const msgs = estado.mensagens.filter((m) => m.contatoId === c.id).map((m) => m.em).sort();
      expect(l.ultimaConversa).toBe(msgs.length ? msgs[msgs.length - 1] : null);
      expect(l.origemRotulo).toBe(estado.funis.find((f) => f.id === c.origem)?.nome ?? l.origemRotulo);
      expect(l.conduz).toBe(c.dono === "robo" ? estado.config.nomeRobo : (estado.operadores.find((o) => o.id === c.operadorId)?.nome ?? "Equipe"));
    }
  });

  it("cliente é quem está em Pago ou Dentro; perdida aparece como perdida", () => {
    for (const l of linhas) {
      if (l.tipo === "cliente") expect(["pago", "dentro"]).toContain(l.etapa?.id);
      if (l.situacao === "ganha") expect(l.tipo).toBe("cliente");
    }
    const perdida = linhas.find((l) => l.situacao === "perdida");
    if (perdida) expect(rotuloEtapaPessoa(perdida).texto).toMatch(/^Perdida/);
  });

  it("rótulo da etapa: aberta, ganha, perdida e sem oportunidade", () => {
    expect(rotuloEtapaPessoa({ situacao: "aberta", etapa: { id: "handoff", nome: "Handoff", ordem: 2 } })).toEqual({ texto: "Handoff", tom: "etapa" });
    expect(rotuloEtapaPessoa({ situacao: "ganha", etapa: { id: "pago", nome: "Pago", ordem: 6 } }).tom).toBe("sucesso");
    expect(rotuloEtapaPessoa({ situacao: "perdida", etapa: { id: "oferta", nome: "Oferta", ordem: 5 } }).texto).toBe("Perdida em Oferta");
    expect(rotuloEtapaPessoa({ situacao: "sem", etapa: null })).toEqual({ texto: "Sem oportunidade", tom: "discreto" });
  });
});

describe("rotas antigas e URL", () => {
  it("/leads e /clientes pré-selecionam o tipo; ?q= vira busca", () => {
    expect(filtrosDoCaminho("/leads", sp("")).tipo).toBe("lead");
    expect(filtrosDoCaminho("/clientes", sp("q=ana")).tipo).toBe("cliente");
    expect(filtrosDoCaminho("/clientes", sp("q=ana")).q).toBe("ana");
    expect(filtrosDoCaminho("/buscar", sp("q=Rocha"))).toEqual({ ...FILTROS_PESSOAS_PADRAO, q: "Rocha" });
    expect(filtrosDoCaminho("/contatos", sp("tipo=cliente")).tipo).toBe("cliente");
    expect(filtrosDoCaminho("/pessoas", sp("tipo=member")).tipo).toBe("cliente");
    expect(filtrosDoCaminho("/pessoas", sp("etapa=DROP;")).etapa).toBe("todas");
  });

  it("ida e volta pela URL, só com o que difere do padrão", () => {
    const f = { q: "ana", tipo: "lead" as const, etapa: "handoff", conduz: "op-otavio" };
    const o = { coluna: "nome" as const, direcao: "asc" as const };
    const qs = urlDePessoas(f, o);
    expect(filtrosDoCaminho("/pessoas", sp(qs))).toEqual(f);
    expect(ordemDaUrl(sp(qs).get("ordem"))).toEqual(o);
    expect(urlDePessoas(FILTROS_PESSOAS_PADRAO, ORDEM_PADRAO)).toBe("");
    expect(ordemDaUrl("qualquer.coisa")).toEqual(ORDEM_PADRAO);
    expect(hrefFichaPessoa("c 1", "/pessoas?tipo=lead")).toBe("/contatos/c%201?de=%2Fpessoas%3Ftipo%3Dlead");
  });
});

describe("filtros e busca", () => {
  const lista = [
    linha({ id: "a", nome: "João Árvore", empresa: "Padaria Pão", telefone: "(62) 90000-0001", email: "joao@exemplo.com" }),
    linha({ id: "b", nome: "Maria", tipo: "cliente", situacao: "ganha", etapa: { id: "pago", nome: "Pago", ordem: 6 }, conduzChave: "op-1", conduz: "Otávio" }),
    linha({ id: "c", nome: "Sônia", situacao: "perdida", etapa: { id: "oferta", nome: "Oferta", ordem: 5 } }),
    linha({ id: "d", nome: "Zé", situacao: "sem", etapa: null }),
  ];

  it("tipo, etapa (aberta), perdida e quem conduz", () => {
    expect(filtrarPessoas(lista, { ...FILTROS_PESSOAS_PADRAO, tipo: "cliente" }).map((l) => l.id)).toEqual(["b"]);
    expect(filtrarPessoas(lista, { ...FILTROS_PESSOAS_PADRAO, etapa: "oferta" }).map((l) => l.id)).toEqual([]);
    expect(filtrarPessoas(lista, { ...FILTROS_PESSOAS_PADRAO, etapa: "novo" }).map((l) => l.id)).toEqual(["a"]);
    expect(filtrarPessoas(lista, { ...FILTROS_PESSOAS_PADRAO, etapa: "perdida" }).map((l) => l.id)).toEqual(["c"]);
    expect(filtrarPessoas(lista, { ...FILTROS_PESSOAS_PADRAO, conduz: "op-1" }).map((l) => l.id)).toEqual(["b"]);
    expect(filtrosAtivosPessoas({ q: "x", tipo: "lead", etapa: "novo", conduz: "robo" })).toBe(4);
  });

  it("busca sem acento por nome, empresa e e-mail; WhatsApp só com 4 dígitos ou mais", () => {
    const a = lista[0];
    expect(casaBusca(a, "arvore")).toBe(true);
    expect(casaBusca(a, "pao")).toBe(true);
    expect(casaBusca(a, "joao@")).toBe(true);
    expect(casaBusca(a, "0001")).toBe(true);
    expect(casaBusca(a, "62 90000")).toBe(true);
    expect(casaBusca(a, "001")).toBe(false);
    expect(casaBusca(a, "rua 0001")).toBe(false);
    expect(casaBusca(a, "")).toBe(true);
  });

  it("opções de quem conduz: o robô primeiro", () => {
    expect(opcoesConduzPessoas(lista).map((o) => o.valor)).toEqual(["robo", "op-1"]);
  });
});

describe("ordenação e página", () => {
  const lista = [
    linha({ id: "1", nome: "Bruno", ultimaConversa: "2026-11-10T10:00:00.000Z", criadoEm: "2026-11-03T00:00:00.000Z" }),
    linha({ id: "2", nome: "Álvaro", ultimaConversa: null, criadoEm: "2026-11-01T00:00:00.000Z", situacao: "sem", etapa: null }),
    linha({ id: "3", nome: "Carla", ultimaConversa: "2026-11-12T10:00:00.000Z", criadoEm: "2026-11-02T00:00:00.000Z", etapa: { id: "oferta", nome: "Oferta", ordem: 5 } }),
  ];

  it("nome sem acento, nas duas direções", () => {
    expect(ordenarPessoas(lista, { coluna: "nome", direcao: "asc" }).map((l) => l.nome)).toEqual(["Álvaro", "Bruno", "Carla"]);
    expect(ordenarPessoas(lista, { coluna: "nome", direcao: "desc" }).map((l) => l.nome)).toEqual(["Carla", "Bruno", "Álvaro"]);
  });

  it("sem dado vai sempre para o fim", () => {
    expect(ordenarPessoas(lista, { coluna: "conversa", direcao: "desc" }).map((l) => l.id)).toEqual(["3", "1", "2"]);
    expect(ordenarPessoas(lista, { coluna: "conversa", direcao: "asc" }).map((l) => l.id)).toEqual(["1", "3", "2"]);
    expect(ordenarPessoas(lista, { coluna: "etapa", direcao: "asc" }).map((l) => l.id)).toEqual(["1", "3", "2"]);
  });

  it("padrão: criados mais recentes primeiro", () => {
    expect(ordenarPessoas(lista, ORDEM_PADRAO).map((l) => l.id)).toEqual(["1", "3", "2"]);
  });

  it("limite em múltiplos de 50, nunca abaixo de uma página", () => {
    expect(PAGINA_PESSOAS).toBe(50);
    expect(limiteValido(0)).toBe(50);
    expect(limiteValido("abc")).toBe(50);
    expect(limiteValido(51)).toBe(100);
    expect(limiteValido(150)).toBe(150);
  });
});

describe("datas e telefone", () => {
  it("quando curto", () => {
    expect(quandoCurto(AGORA, agora)).toBe("agora");
    expect(quandoCurto("2026-11-12T14:48:00.000Z", agora)).toBe("há 12 min");
    expect(quandoCurto("2026-11-12T12:00:00.000Z", agora)).toBe("há 3 h");
    expect(quandoCurto("2026-11-10T15:00:00.000Z", agora)).toBe("há 2 d");
    expect(quandoCurto("2026-10-20T15:00:00.000Z", agora)).toBe("20/10");
    expect(quandoCurto("2025-10-20T15:00:00.000Z", agora)).toBe("20/10/2025");
  });

  it("telefone revelado legível", () => {
    expect(telefoneLegivel("5511900001234")).toBe("+55 11 90000-1234");
    expect(telefoneLegivel("(62) 90000-0001")).toBe("(62) 90000-0001");
  });
});
