import { describe, expect, it } from "vitest";
import { estadoExemplo, estadoVazio, IDS } from "@/data/exemplo";
import { aplicar, type Comando } from "@/domain/comandos";
import { PLAYBOOK } from "@/domain/funil";
import type { EstadoCRM } from "@/domain/types";
import { erroDeRegra, podeEscrever } from "@/crm-grafite/telas/equipe/gravar";
import {
  comandoOperador,
  formDoOperador,
  linhasEquipe,
  motivoNaoDesativar,
  mudouOperador,
  validarConfig,
  validarOperador,
} from "@/crm-grafite/telas/equipe/equipe-logica";
import {
  contarPorFiltro,
  diaLocal,
  linhasOcorrencias,
  metaOcorrencias,
  nomeDoAutorTrecho,
  passaNoFiltro,
  resumoEmTexto,
  validarDia,
} from "@/crm-grafite/telas/ocorrencias/ocorrencias-logica";
import { duracaoTexto, linhasLigacoes, metaLigacoes, passaNoFiltroLigacao, termometroTexto } from "@/crm-grafite/telas/ligacoes/ligacoes-logica";
import {
  ORIGEM_CONVITE,
  convidadosDaSemana,
  fimDoDia,
  proximoDiaUtil,
  resumoSessao,
  segundaDaSemana,
  textoConvite,
  validarPrazo,
} from "@/crm-grafite/telas/sessao-fechada/sessao-logica";
import {
  chaveCriada,
  configMcpWeb,
  erroDoArquivo,
  inicioDaChave,
  linhasChaves,
  nomeArquivoExportacao,
  promptAgente,
  urlMcpWeb,
  validarNomeChave,
} from "@/crm-grafite/telas/integrar/integrar-logica";
import {
  comandoFunil,
  comandoProduto,
  efeitoRemover,
  formDoProduto,
  gatilhosDoTexto,
  idDoFunil,
  lerReais,
  linhasProdutos,
  mudouProduto,
  textoPlaybook,
  validarCriativo,
  validarFunil,
  validarProduto,
} from "@/crm-grafite/telas/produtos/produtos-logica";
import {
  falaDePreco,
  filtrarModelos,
  formDoModelo,
  inserirVariavel,
  mudouModelo,
  previa,
  validarModelo,
  variaveisDesconhecidas,
} from "@/crm-grafite/telas/modelos/modelos-logica";
import {
  formDaEtapa,
  linhasPlaybook,
  paraPergunta,
  playbookComEtapa,
  playbookSemEtapa,
  quemConduz,
  validarEtapa,
} from "@/crm-grafite/telas/playbook/playbook-logica";
import { proximoOperador } from "@/crm-grafite/telas/entrar/entrar-logica";

const AGORA = "2026-11-12T15:00:00.000Z";
let seq = 0;
const roda = (s: EstadoCRM, c: Comando) => aplicar(s, c, { agora: AGORA, novoId: () => `t-${++seq}` });
const base = () => estadoExemplo(AGORA);

describe("gravar (validação antes de despachar)", () => {
  it("devolve a mensagem da regra do domínio e não grava nada", () => {
    const s = base();
    expect(erroDeRegra(s, { tipo: "salvarProduto", produto: { nome: " ", valor: 1 } }, AGORA)).toBe("Produto precisa de nome.");
    expect(erroDeRegra(s, { tipo: "removerOperador", operadorId: IDS.claudio }, AGORA)).toMatch(/robô/);
    expect(s.produtos).toEqual(base().produtos);
  });
  it("comando válido passa", () => {
    expect(erroDeRegra(base(), { tipo: "salvarConfig", config: { nomeRobo: "Bia" } }, AGORA)).toBeNull();
  });
  it("só quem não é leitura escreve", () => {
    expect(podeEscrever({ papel: "dono" })).toBe(true);
    expect(podeEscrever({ papel: "vendedor" })).toBe(true);
    expect(podeEscrever({ papel: "leitura" })).toBe(false);
    expect(podeEscrever(null)).toBe(false);
  });
});

describe("Ocorrências", () => {
  it("monta a linha com o trecho do robô, o contato e quem marcou, da mais nova para a mais antiga", () => {
    let s = base();
    s = roda(s, { tipo: "registrarOcorrencia", contatoId: "c1", tipoOcorrencia: "problema", descricao: "Falou de preço", trechos: [{ autor: "contato", texto: "Quanto custa?", em: AGORA }], abertaPor: IDS.dono });
    const ls = linhasOcorrencias(s);
    expect(ls[0].descricao).toBe("Falou de preço");
    expect(ls[0].trecho).toBe("Quanto custa?");
    expect(ls[0].quem).not.toBe("Sem registro");
    expect(ls[1].trecho).toMatch(/Vou te passar/);
  });
  it("filtra por situação e dia, e conta", () => {
    const ls = [
      { status: "aberta" as const, dia: "2026-11-12" },
      { status: "em análise" as const, dia: "2026-11-11" },
      { status: "resolvida" as const, dia: "2026-11-12" },
    ];
    expect(ls.filter((l) => passaNoFiltro(l, "abertas", "")).length).toBe(2);
    expect(ls.filter((l) => passaNoFiltro(l, "resolvidas", "")).length).toBe(1);
    expect(contarPorFiltro(ls, "2026-11-12")).toEqual({ abertas: 1, resolvidas: 1, todas: 2 });
  });
  it("valida o dia: vazio vale (todos), futuro e dia inexistente não", () => {
    expect(validarDia("", "2026-11-12")).toBeNull();
    expect(validarDia("2026-11-13", "2026-11-12")).toMatch(/já passou/);
    expect(validarDia("2026-02-30", "2026-11-12")).toMatch(/não existe/);
    expect(validarDia("2026-11-01", "2026-11-12")).toBeNull();
  });
  it("meta e resumo em texto", () => {
    expect(metaOcorrencias([{ tipo: "problema" }, { tipo: "melhoria" }])).toBe("2 marcações · 1 problema");
    expect(metaOcorrencias([{ tipo: "melhoria" }])).toBe("1 marcação");
    const txt = resumoEmTexto(linhasOcorrencias(base()), "Ocorrências", "Cláudio");
    expect(txt).toMatch(/O que Cláudio disse/);
    expect(txt).toMatch(/Por quê: Cláudio foi muito seco/);
  });
  it("nome do autor do trecho usa o nome do robô da configuração", () => {
    expect(nomeDoAutorTrecho("robo", "Ana", "Bia")).toBe("Bia");
    expect(nomeDoAutorTrecho("contato", "Ana", "Bia")).toBe("Ana");
    expect(diaLocal("2026-11-12T12:00:00.000Z")).toMatch(/^2026-11-1[12]$/);
  });
});

describe("Ligações", () => {
  it("lista do estado, mais nova primeiro, só com trechos marcados", () => {
    const ls = linhasLigacoes(base());
    expect(ls.length).toBe(base().ligacoes.length);
    for (let i = 1; i < ls.length; i++) expect(Date.parse(ls[i - 1].iniciouEm)).toBeGreaterThanOrEqual(Date.parse(ls[i].iniciouEm));
    for (const l of ls) expect(l.marcados.every((t) => t.marca)).toBe(true);
  });
  it("duração, meta, filtro e termômetro (IA só quando discorda)", () => {
    expect(duracaoTexto(0)).toBe("—");
    expect(duracaoTexto(30)).toBe("menos de 1 min");
    expect(duracaoTexto(61)).toBe("2 min");
    expect(metaLigacoes([])).toBe("Nenhuma ligação ainda");
    expect(metaLigacoes([{ resultado: "atendeu" }, { resultado: "caixa postal" }])).toBe("2 ligações · 1 atendeu");
    expect(passaNoFiltroLigacao({ resultado: "não atende" }, "nao")).toBe(true);
    expect(passaNoFiltroLigacao({ resultado: "atendeu" }, "nao")).toBe(false);
    expect(termometroTexto({ termometroVendedor: "quente", termometroIA: "quente", resultado: "atendeu" })).toBe("Quente");
    expect(termometroTexto({ termometroVendedor: "quente", termometroIA: "morno", resultado: "atendeu" })).toBe("Quente · IA leu morno");
    expect(termometroTexto({ termometroVendedor: "frio", termometroIA: "morno", resultado: "caixa postal" })).toBe("Frio");
  });
});

describe("Sessão fechada", () => {
  const comTrave = () => {
    const s = base();
    const o = s.oportunidades.find((x) => x.contatoId === "c5")!;
    return { ...s, oportunidades: s.oportunidades.map((x) => (x.id === o.id ? { ...x, entrouNaEtapaEm: "2026-11-08T12:00:00.000Z" } : x)) };
  };
  it("convida quem está na oferta há mais de 2 dias, sem perdidas", () => {
    expect(convidadosDaSemana(base(), AGORA).map((c) => c.contatoId)).not.toContain("c11");
    const cs = convidadosDaSemana(comTrave(), AGORA);
    expect(cs.map((c) => c.contatoId)).toContain("c5");
    expect(cs[0].convite).toBeNull();
    expect(cs[0].minutosNaOferta).toBeGreaterThan(2 * 24 * 60);
  });
  it("reconhece o convite já criado como tarefa aberta", () => {
    const s = roda(comTrave(), { tipo: "criarTarefa", contatoId: "c5", texto: textoConvite("Renata Souza"), venceEm: fimDoDia("2026-11-13"), origem: ORIGEM_CONVITE });
    const c = convidadosDaSemana(s, AGORA).find((x) => x.contatoId === "c5")!;
    expect(c.convite?.texto).toBe("Convidar Renata para a sessão fechada");
    expect(resumoSessao([c])).toBe("1 convidado · 1 com convite nas tarefas");
  });
  it("semana, prazo padrão e validação do prazo", () => {
    expect(segundaDaSemana("2026-11-12T15:00:00")).toBe("2026-11-09");
    expect(proximoDiaUtil("2026-11-13T15:00:00")).toBe("2026-11-16");
    expect(validarPrazo("2026-11-11", "2026-11-12")).toMatch(/depois de hoje/);
    expect(validarPrazo("2026-11-12", "2026-11-12")).toBeNull();
    expect(resumoSessao([])).toBe("Ninguém na fila");
  });
});

describe("Integrações", () => {
  it("mostra só o começo da chave e acha a chave criada", () => {
    const s = base();
    expect(inicioDaChave(IDS.chaveLeitura)).toBe("crm_leitura_exem…");
    expect(linhasChaves(s).every((k) => !k.inicio.includes("troque"))).toBe(true);
    const depois = roda(s, { tipo: "criarChaveApi", nome: "Site", escopo: "escrita", operadorId: null });
    const k = chaveCriada(s.chaves, depois.chaves)!;
    expect(k.nome).toBe("Site");
    expect(k.chave).toMatch(/^crm_escrita_/);
    const rev = roda(depois, { tipo: "revogarChaveApi", chaveId: k.id });
    expect(linhasChaves(rev).at(-1)!.revogadaEm).not.toBeNull();
  });
  it("valida nome da chave e arquivo de importação", () => {
    expect(validarNomeChave("a")).toMatch(/nome/);
    expect(validarNomeChave("GrokBot")).toBeNull();
    expect(erroDoArquivo(null)).toMatch(/JSON/);
    expect(erroDoArquivo({ contatos: [] })).toMatch(/faltam/);
    expect(erroDoArquivo({ ...base(), versao: 1 })).toMatch(/outra versão/);
    expect(erroDoArquivo({ ...base(), operadores: [] })).toMatch(/dono/);
    expect(erroDoArquivo(base())).toBeNull();
    expect(erroDoArquivo(estadoVazio(AGORA))).toBeNull();
  });
  it("prompt e MCP só falam do que existe neste app", () => {
    const url = urlMcpWeb("http://localhost:3123/");
    expect(url).toBe("http://localhost:3123/api/mcp/crm");
    expect(JSON.parse(configMcpWeb(url)).mcpServers["crm-do-dono"].url).toBe(url);
    const p = promptAgente(base(), "http://localhost:3123", [
      { nome: "Lead novo", auto: false },
      { nome: "Pago", auto: true },
    ]);
    expect(p).toMatch(/api\/mcp\/crm/);
    expect(p).toMatch(/AGENTS\.md/);
    expect(p).not.toMatch(/server\/mcp|5173|Hono|api\/leads/);
    expect(p).toMatch(/Pago são movidas pelo sistema/);
    expect(nomeArquivoExportacao(AGORA)).toBe("crm-do-dono-2026-11-12.json");
  });
});

describe("Produtos", () => {
  it("lê reais no jeito brasileiro", () => {
    expect(lerReais("1.997,00")).toBe(1997);
    expect(lerReais("R$ 497,5")).toBe(497.5);
    expect(lerReais("497.5")).toBe(497.5);
    expect(lerReais("2.500")).toBe(2500);
    expect(lerReais("1.250.000")).toBe(1250000);
    expect(lerReais("abc")).toBeNull();
    expect(lerReais("")).toBeNull();
  });
  it("valida, monta o comando e detecta mudança", () => {
    expect(validarProduto({ ...formDoProduto(), nome: "", valor: "x" })).toEqual({ nome: expect.any(String), valor: expect.stringMatching(/números/) });
    const f = { ...formDoProduto(), nome: " Mentoria ", valor: "2.500", gatilhos: "Bônus até sexta\n\n Vaga extra " };
    const c = comandoProduto(f);
    expect(c).toMatchObject({ tipo: "salvarProduto", produto: { nome: "Mentoria", valor: 2500, gatilhos: ["Bônus até sexta", "Vaga extra"] } });
    expect(gatilhosDoTexto(" a \n\nb")).toEqual(["a", "b"]);
    const p = base().produtos[0];
    expect(mudouProduto(formDoProduto(p), p)).toBe(false);
    expect(mudouProduto({ ...formDoProduto(p), nome: "Outro" }, p)).toBe(true);
  });
  it("remover apaga sem histórico e desativa com oportunidade", () => {
    const s = base();
    const comOp = s.produtos.find((p) => s.oportunidades.some((o) => o.produtoId === p.id))!;
    expect(efeitoRemover(s, comOp.id).acao).toBe("desativar");
    const s2 = roda(s, { tipo: "salvarProduto", produto: { nome: "Novo", valor: 10 } });
    const novo = s2.produtos.find((p) => p.nome === "Novo")!;
    expect(efeitoRemover(s2, novo.id)).toEqual({ acao: "apagar", oportunidades: 0 });
    expect(linhasProdutos(s2).find((l) => l.id === novo.id)!.abertas).toBe(0);
    expect(textoPlaybook(0)).toBe("Padrão");
    expect(textoPlaybook(2)).toBe("Próprio em 2 etapas");
  });
  it("funil: id do nome, nome repetido e produto obrigatório; criativo precisa de funil", () => {
    const s = base();
    expect(idDoFunil("Live Semanal!")).toBe("live-semanal");
    const s2 = roda(s, comandoFunil({ nome: "Feira", canal: "Estande", produto: s.produtos[0].id, ativo: true }));
    expect(s2.funis.some((f) => f.id === idDoFunil("Feira"))).toBe(true);
    expect(validarFunil({ nome: "Feira", canal: "x", produto: s.produtos[0].id, ativo: true }, s2).nome).toMatch(/Já existe/);
    expect(validarFunil({ nome: "Indicação nova", canal: "", produto: "nao-existe", ativo: true }, s)).toMatchObject({ canal: expect.any(String), produto: expect.any(String) });
    expect(comandoFunil({ nome: " Feira ", canal: "Estande", produto: s.produtos[0].id, ativo: true })).toMatchObject({ funil: { nome: "Feira" } });
    expect(validarCriativo({ nome: "", funilId: "x", plataforma: "Meta Ads", ativo: true }, s)).toMatchObject({ nome: expect.any(String), funilId: expect.any(String) });
  });
});

describe("Equipe", () => {
  it("papéis, conversas e quem não pode sair", () => {
    const s = base();
    const ls = linhasEquipe(s);
    const robo = ls.find((l) => l.robo)!;
    expect(robo.conversas).toBe(s.contatos.filter((c) => c.dono === "robo").length);
    expect(motivoNaoDesativar(s, IDS.claudio)).toMatch(/robô/);
    expect(motivoNaoDesativar(s, IDS.dono)).toMatch(/único dono/);
    expect(motivoNaoDesativar(s, IDS.otavio)).toBeNull();
  });
  it("valida operador e config", () => {
    expect(validarOperador({ ...formDoOperador(), nome: "" }).nome).toBeTruthy();
    expect(validarOperador({ ...formDoOperador(), nome: "Ana", email: "ana@" }).email).toMatch(/e-mail/);
    expect(validarOperador({ ...formDoOperador(), nome: "Ana", email: "" })).toEqual({});
    expect(comandoOperador({ ...formDoOperador(), nome: " Ana ", email: " " })).toMatchObject({ operador: { nome: "Ana", email: undefined } });
    const op = base().operadores[0];
    expect(mudouOperador(formDoOperador(op), op)).toBe(false);
    expect(validarConfig({ nomeEmpresa: "", nomeRobo: "" })).toMatchObject({ nomeEmpresa: expect.any(String), nomeRobo: expect.any(String) });
    expect(validarConfig({ nomeEmpresa: "Padaria", nomeRobo: "Bia" })).toEqual({});
  });
});

describe("Modelos de mensagem", () => {
  it("prévia com variáveis, desconhecidas e trava de preço", () => {
    const p = previa({ texto: "Oi {nome}, aqui é {operador}", assunto: null }, { nome: "Ana", operador: "Rui" });
    expect(p.texto).toBe("Oi Ana, aqui é Rui");
    expect(variaveisDesconhecidas("{nome} {cupom} {cupom}")).toEqual(["cupom"]);
    expect(falaDePreco({ texto: "Fica R$ 197", assunto: "" })).toBe(true);
    expect(falaDePreco({ texto: "Posso te ligar?", assunto: "" })).toBe(false);
  });
  it("insere variável no cursor e valida", () => {
    expect(inserirVariavel("Oi !", "nome", 3, 3)).toEqual({ texto: "Oi {nome}!", cursor: 9 });
    expect(inserirVariavel("Oi", "nome")).toEqual({ texto: "Oi{nome}", cursor: 8 });
    expect(validarModelo({ ...formDoModelo(), canal: "email" })).toMatchObject({ nome: expect.any(String), assunto: expect.any(String), texto: expect.any(String) });
    const t = base().templates[0];
    expect(mudouModelo(formDoModelo(t), t)).toBe(false);
  });
  it("filtra por canal e busca", () => {
    const ts = base().templates;
    expect(filtrarModelos(ts, "email", "").every((t) => t.canal === "email")).toBe(true);
    expect(filtrarModelos(ts, "todos", "follow-up").length).toBe(1);
  });
});

describe("Playbook", () => {
  it("linhas por etapa, com versão própria do produto", () => {
    const s = base();
    const p = s.produtos[0];
    const pm = { ...PLAYBOOK.find((x) => x.etapa === "conversa")!, pergunta: "Pergunta própria" };
    const prod = { ...p, playbook: playbookComEtapa(p.playbook, pm) };
    const ls = linhasPlaybook(prod, "Bia");
    const conversa = ls.find((l) => l.etapa === "conversa")!;
    expect(conversa.pergunta).toBe("Pergunta própria");
    expect(conversa.proprio).toBe(true);
    expect(conversa.conduz).toBe("Bia");
    expect(linhasPlaybook(null, "Bia").every((l) => !l.proprio)).toBe(true);
    expect(playbookSemEtapa(prod.playbook, "conversa").some((x) => x.etapa === "conversa")).toBe(false);
    expect(quemConduz({ auto: true, dono: "sistema" }, "Bia")).toBe("Sistema");
  });
  it("valida e converte o formulário da etapa (linhas vazias saem)", () => {
    const f = formDaEtapa(PLAYBOOK[1]);
    expect(validarEtapa(f)).toEqual({});
    const ruim = { ...f, pergunta: "", faixas: [{ de: "8", ate: "3", acao: "" }, { de: "", ate: "", acao: "" }], objecoes: [{ objecao: "Caro", diga: "", nuncaDiga: "" }] };
    const e = validarEtapa(ruim);
    expect(e.pergunta).toBeTruthy();
    expect(e["faixas.0.ate"]).toMatch(/maior/);
    expect(e["faixas.0.acao"]).toBeTruthy();
    expect(e["faixas.1.de"]).toBeUndefined();
    expect(e["objecoes.0.diga"]).toBeTruthy();
    const pm = paraPergunta({ ...f, complementares: [...f.complementares, { pergunta: " ", porque: "" }] }, "conversa");
    expect(pm.complementares.length).toBe(f.complementares.length);
    expect(pm.faixas[0]).toEqual(PLAYBOOK[1].faixas[0]);
  });
});

describe("Entrar", () => {
  it("setas, Home e End sem dar a volta", () => {
    expect(proximoOperador(0, 3, "ArrowDown")).toBe(1);
    expect(proximoOperador(2, 3, "ArrowDown")).toBe(2);
    expect(proximoOperador(0, 3, "ArrowUp")).toBe(0);
    expect(proximoOperador(1, 3, "End")).toBe(2);
    expect(proximoOperador(1, 3, "Home")).toBe(0);
    expect(proximoOperador(1, 3, "a")).toBeNull();
  });
});
