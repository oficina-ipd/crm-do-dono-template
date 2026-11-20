import { describe, expect, it } from "vitest";
import { aplicar } from "@/domain/comandos";
import { ETAPAS } from "@/domain/funil";
import type { EstadoCRM } from "@/domain/types";
import { estadoExemplo } from "@/data/exemplo";
import {
  agruparPorEtapa,
  cartaoParado,
  cartoesDoEstado,
  conferirNovaOportunidade,
  contagemFaixaFunil,
  estadoQuadro,
  etapasDoQuadro,
  filtrarCartoes,
  filtrarPerdidas,
  filtrosAtivos,
  filtrosDaUrl,
  FILTROS_FUNIL_PADRAO,
  hrefFichaDe,
  janelaValida,
  linhasTaxas,
  opcoesConduz,
  opcoesMover,
  perdidasNaTraveDe,
  posicaoFunilValida,
  tempoNaEtapa,
  urlDoFunil,
  type CartaoFunil,
} from "@/crm-grafite/telas/funil/logica";

const AGORA = "2026-11-12T15:00:00.000Z";
const agora = new Date(AGORA);
const haMin = (m: number) => new Date(agora.getTime() - m * 60_000).toISOString();

function cartao(p: Partial<CartaoFunil> & { id: string }): CartaoFunil {
  return {
    etapa: "novo",
    etapaDesde: haMin(1),
    contatoId: `c-${p.id}`,
    contatoNome: "Fulano",
    empresa: null,
    valor: 100,
    proximaAcao: null,
    bateuNaTrave: false,
    conduzChave: "robo",
    conduz: "Cláudio",
    proximaTarefa: null,
    temBriefing: false,
    ...p,
  };
}

describe("cartões a partir do estado", () => {
  const estado = estadoExemplo(AGORA);
  const cartoes = cartoesDoEstado(estado, AGORA);

  it("um cartão por oportunidade aberta; perdida não entra", () => {
    const abertas = estado.oportunidades.filter((o) => !o.perdida);
    expect(cartoes).toHaveLength(abertas.length);
    expect(cartoes.some((c) => estado.oportunidades.find((o) => o.id === c.id)?.perdida)).toBe(false);
  });

  it("quem conduz: o robô pelo nome da config; humano pelo nome do operador", () => {
    for (const c of cartoes) {
      const contato = estado.contatos.find((x) => x.id === c.contatoId)!;
      if (contato.dono === "robo") {
        expect(c.conduzChave).toBe("robo");
        expect(c.conduz).toBe(estado.config.nomeRobo);
      } else {
        expect(c.conduzChave).toBe(contato.operadorId ?? "equipe");
        expect(c.conduz).toBe(estado.operadores.find((o) => o.id === contato.operadorId)?.nome ?? "Equipe");
      }
    }
  });

  it("próxima tarefa: a aberta com a data mais cedo; feita não conta", () => {
    const base: EstadoCRM = {
      ...estado,
      tarefas: [
        { id: "t1", contatoId: "c1", texto: "sem data", venceEm: null, origem: "manual", feita: false, criadaEm: haMin(10) },
        { id: "t2", contatoId: "c1", texto: "depois", venceEm: "2026-11-20T10:00:00.000Z", origem: "manual", feita: false, criadaEm: haMin(10) },
        { id: "t3", contatoId: "c1", texto: "antes", venceEm: "2026-11-13T10:00:00.000Z", origem: "manual", feita: false, criadaEm: haMin(10) },
        { id: "t4", contatoId: "c1", texto: "feita", venceEm: "2026-11-01T10:00:00.000Z", origem: "manual", feita: true, criadaEm: haMin(10) },
      ],
    };
    const c1 = cartoesDoEstado(base, AGORA).find((c) => c.contatoId === "c1");
    expect(c1?.proximaTarefa).toEqual({ titulo: "antes", venceEm: "2026-11-13T10:00:00.000Z" });
  });

  it("perdidas na trave: só as perdidas em Oferta, com motivo e data do histórico", () => {
    const perdidas = perdidasNaTraveDe(estado);
    for (const p of perdidas) {
      const o = estado.oportunidades.find((x) => x.id === p.oportunidadeId)!;
      expect(o.perdida).toBe(true);
      expect(o.etapa).toBe("oferta");
      expect(p.motivo).toBe(o.motivoPerda);
      expect(p.desde).toBe(estado.movimentos.filter((m) => m.oportunidadeId === o.id && m.para === "perdido").map((m) => m.em).sort().pop());
    }
    const perdidaFora = estado.oportunidades.find((o) => o.perdida && o.etapa !== "oferta");
    if (perdidaFora) expect(perdidas.some((p) => p.oportunidadeId === perdidaFora.id)).toBe(false);
  });
});

describe("filtros do quadro", () => {
  const etapas = etapasDoQuadro();
  const lista = [
    cartao({ id: "a", contatoNome: "João Árvore", empresa: "Padaria Pão", etapa: "novo", etapaDesde: haMin(10) }), // prazo 5 min: parado
    cartao({ id: "b", contatoNome: "Maria", etapa: "oferta", bateuNaTrave: true, conduzChave: "op-1", conduz: "Otávio", etapaDesde: haMin(60) }),
    cartao({ id: "c", contatoNome: "Zé", etapa: "pago", etapaDesde: haMin(99999) }), // sem prazo: nunca parado
  ];

  it("busca ignora acento e olha nome e empresa", () => {
    expect(filtrarCartoes(lista, etapas, { ...FILTROS_FUNIL_PADRAO, q: "arvore" }, agora).map((c) => c.id)).toEqual(["a"]);
    expect(filtrarCartoes(lista, etapas, { ...FILTROS_FUNIL_PADRAO, q: "pao" }, agora).map((c) => c.id)).toEqual(["a"]);
  });

  it("quem conduz, só paradas e bateu na trave", () => {
    expect(filtrarCartoes(lista, etapas, { ...FILTROS_FUNIL_PADRAO, conduz: "op-1" }, agora).map((c) => c.id)).toEqual(["b"]);
    expect(filtrarCartoes(lista, etapas, { ...FILTROS_FUNIL_PADRAO, paradas: true }, agora).map((c) => c.id)).toEqual(["a"]);
    expect(filtrarCartoes(lista, etapas, { ...FILTROS_FUNIL_PADRAO, trave: true }, agora).map((c) => c.id)).toEqual(["b"]);
    expect(filtrosAtivos({ q: " x ", conduz: "robo", paradas: true, trave: true })).toBe(4);
  });

  it("parado segue o prazo da etapa; etapa sem prazo nunca para", () => {
    expect(cartaoParado({ etapaDesde: haMin(6) }, { prazoMin: 5 }, agora)).toBe(true);
    expect(cartaoParado({ etapaDesde: haMin(5) }, { prazoMin: 5 }, agora)).toBe(false);
    expect(cartaoParado({ etapaDesde: haMin(99999) }, { prazoMin: 0 }, agora)).toBe(false);
  });

  it("perdidas só aparecem com o filtro da trave e sem filtro de aberta", () => {
    const perdidas = [{ oportunidadeId: "p", contatoId: "x", contatoNome: "Sônia", motivo: "preço", valor: 1, desde: null }];
    expect(filtrarPerdidas(perdidas, FILTROS_FUNIL_PADRAO)).toEqual([]);
    expect(filtrarPerdidas(perdidas, { ...FILTROS_FUNIL_PADRAO, trave: true })).toHaveLength(1);
    expect(filtrarPerdidas(perdidas, { ...FILTROS_FUNIL_PADRAO, trave: true, paradas: true })).toEqual([]);
    expect(filtrarPerdidas(perdidas, { ...FILTROS_FUNIL_PADRAO, trave: true, q: "sonia" })).toHaveLength(1);
    expect(filtrarPerdidas(perdidas, { ...FILTROS_FUNIL_PADRAO, trave: true, q: "ana" })).toEqual([]);
  });

  it("agrupa na ordem do funil, quem está há mais tempo primeiro, com a soma", () => {
    const cols = agruparPorEtapa(etapas, [
      cartao({ id: "x", etapa: "conversa", etapaDesde: haMin(5), valor: 10 }),
      cartao({ id: "y", etapa: "conversa", etapaDesde: haMin(50), valor: 20 }),
    ]);
    expect(cols.map((c) => c.etapa.id)).toEqual(ETAPAS.map((e) => e.id));
    const conversa = cols.find((c) => c.etapa.id === "conversa")!;
    expect(conversa.cartoes.map((c) => c.id)).toEqual(["y", "x"]);
    expect(conversa.soma).toBe(30);
  });

  it("opções de quem conduz: o robô primeiro, depois por nome, com contagem", () => {
    const op = opcoesConduz([
      { conduzChave: "op-2", conduz: "Zuleica" },
      { conduzChave: "robo", conduz: "Cláudio" },
      { conduzChave: "op-1", conduz: "Ana" },
      { conduzChave: "op-1", conduz: "Ana" },
    ]);
    expect(op).toEqual([
      { valor: "robo", rotulo: "Cláudio", n: 1 },
      { valor: "op-1", rotulo: "Ana", n: 2 },
      { valor: "op-2", rotulo: "Zuleica", n: 1 },
    ]);
  });
});

describe("mover para…", () => {
  const etapas = etapasDoQuadro();

  it("oferece só a próxima etapa e nunca uma automática", () => {
    expect(opcoesMover(etapas, "novo").avancar?.id).toBe("conversa");
    const briefing = opcoesMover(etapas, "briefing");
    expect(briefing.avancar).toBeNull();
    expect(briefing.automatica?.nome).toBe("Proposta aberta");
    expect(opcoesMover(etapas, "proposta").avancar?.id).toBe("oferta");
    expect(opcoesMover(etapas, "oferta").automatica?.nome).toBe("Pago");
    expect(opcoesMover(etapas, "dentro").ultima).toBe(true);
    for (const e of etapas) {
      const a = opcoesMover(etapas, e.id).avancar;
      if (a) expect(etapas.find((x) => x.id === a.id)?.auto).toBe(false);
    }
  });

  it("motivos de perda são os da etapa atual", () => {
    for (const e of etapas) expect(opcoesMover(etapas, e.id).motivosPerda).toEqual(e.motivosPerda);
  });

  it("o domínio aceita o que o menu oferece (com briefing quando a etapa pede)", () => {
    const estado = estadoExemplo(AGORA);
    const ctx = { agora: AGORA, novoId: (() => { let n = 0; return () => `t${++n}`; })() };
    for (const c of cartoesDoEstado(estado, AGORA)) {
      const a = opcoesMover(etapas, c.etapa).avancar;
      if (!a) continue;
      const cmd = { tipo: "moverEtapa" as const, oportunidadeId: c.id, para: a.id, por: "op-dono" };
      if (a.id === "briefing" && !c.temBriefing) expect(() => aplicar(estado, cmd, ctx)).toThrow(/briefing/);
      else expect(aplicar(estado, cmd, ctx).oportunidades.find((o) => o.id === c.id)?.etapa).toBe(a.id);
    }
  });

  it("tempo na etapa arredonda para baixo", () => {
    expect(tempoNaEtapa(haMin(12), agora).texto).toBe("12 min");
    expect(tempoNaEtapa(haMin(60 * 5 + 59), agora).texto).toBe("5 h");
    expect(tempoNaEtapa(haMin(60 * 47), agora).texto).toBe("1 d");
  });
});

describe("taxa por etapa", () => {
  const etapas = etapasDoQuadro();
  const taxa = (etapaId: string, entraram: number, avancaram: number) => ({ etapaId, entraram, avancaram, taxa: entraram ? avancaram / entraram : null });

  it("menos de 10 entradas vira amostra pequena (sem percentual)", () => {
    const l = linhasTaxas(etapas, { janelaDias: 7, real: [taxa("novo", 9, 9)], baseline: [] }, null);
    expect(l[0]).toMatchObject({ etapaId: "novo", taxa: null, entraram: 9, abaixoDaMeta: false });
  });

  it("com amostra, percentual inteiro contra a meta e os 30 dias", () => {
    const l = linhasTaxas(
      etapas,
      { janelaDias: 7, real: [taxa("novo", 10, 5)], baseline: [] },
      { janelaDias: 30, real: [taxa("novo", 20, 18)], baseline: [] },
    );
    expect(l[0]).toMatchObject({ taxa: 50, meta: 70, abaixoDaMeta: true, trintaDias: 90 });
  });

  it("na janela de 30 dias não repete a comparação; a última etapa não tem linha", () => {
    const l = linhasTaxas(etapas, { janelaDias: 30, real: [taxa("novo", 10, 8)], baseline: [] }, null);
    expect(l[0].trintaDias).toBeNull();
    expect(l.map((x) => x.etapaId)).not.toContain("dentro");
    expect(l).toHaveLength(etapas.length - 1);
  });

  it("janela inválida volta para 7 dias", () => {
    expect(janelaValida("14")).toBe(14);
    expect(janelaValida("3")).toBe(7);
    expect(janelaValida(null)).toBe(7);
  });
});

describe("URL e estados", () => {
  it("?fila=trave (v3) liga o filtro da trave; conduz inválido vira todos", () => {
    expect(filtrosDaUrl(new URLSearchParams("fila=trave")).trave).toBe(true);
    expect(filtrosDaUrl(new URLSearchParams("conduz=<script>")).conduz).toBe("todos");
  });

  it("ida e volta pela URL, só com o que difere do padrão", () => {
    const f = { q: "ana", conduz: "op-1", paradas: true, trave: true };
    expect(filtrosDaUrl(new URLSearchParams(urlDoFunil(f)))).toEqual(f);
    expect(urlDoFunil(FILTROS_FUNIL_PADRAO, { janela: 7 })).toBe("");
    expect(urlDoFunil(FILTROS_FUNIL_PADRAO, { janela: 30, taxas: true })).toBe("janela=30&taxas=1");
  });

  it("link da ficha lembra de onde veio", () => {
    expect(hrefFichaDe("c1", "/funil?trave=1")).toBe("/contatos/c1?de=%2Ffunil%3Ftrave%3D1");
  });

  it("vazio, sem resultado e quadro", () => {
    expect(estadoQuadro({ nCartoes: 0, nFiltrados: 0, nPerdidasVisiveis: 0 })).toBe("vazio");
    expect(estadoQuadro({ nCartoes: 3, nFiltrados: 0, nPerdidasVisiveis: 0 })).toBe("sem-resultado");
    expect(estadoQuadro({ nCartoes: 0, nFiltrados: 0, nPerdidasVisiveis: 1 })).toBe("quadro");
    expect(contagemFaixaFunil(1, "R$ 10")).toBe("1 aberta · R$ 10");
  });

  it("posição salva vale para a mesma vista por 15 minutos", () => {
    const p = JSON.stringify({ busca: "trave=1", em: 1000, esquerda: 40, colunas: { novo: 12 }, pagina: 0 });
    expect(posicaoFunilValida(p, "trave=1", 2000)?.esquerda).toBe(40);
    expect(posicaoFunilValida(p, "", 2000)).toBeNull();
    expect(posicaoFunilValida(p, "trave=1", 1000 + 16 * 60_000)).toBeNull();
    expect(posicaoFunilValida("{quebrado", "trave=1", 2000)).toBeNull();
  });
});

describe("nova oportunidade", () => {
  const estado = estadoExemplo(AGORA);
  const comAberta = estado.contatos.find((c) => estado.oportunidades.some((o) => o.contatoId === c.id && !o.perdida))!;
  const produto = estado.oportunidades.find((o) => o.contatoId === comAberta.id && !o.perdida)!.produtoId;

  it("nome e WhatsApp são obrigatórios (WhatsApp com 8 dígitos ou mais)", () => {
    expect(conferirNovaOportunidade(estado, { nome: "", telefone: "", produtoId: produto })).toMatchObject({ erroNome: expect.any(String), erroTelefone: expect.any(String) });
    expect(conferirNovaOportunidade(estado, { nome: "Ana", telefone: "1234", produtoId: produto }).erroTelefone).toMatch(/curto/);
    expect(conferirNovaOportunidade(estado, { nome: "Ana", telefone: "(11) 97777-6666", produtoId: produto })).toEqual({});
  });

  it("WhatsApp de contato que já tem oportunidade aberta no produto: avisa antes", () => {
    const r = conferirNovaOportunidade(estado, { nome: "Outro", telefone: comAberta.telefone, produtoId: produto });
    expect(r.existente).toBe(comAberta.nome);
    expect(r.jaAberta).toMatch(comAberta.nome);
  });
});
