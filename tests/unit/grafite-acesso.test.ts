import { afterEach, describe, expect, it, vi } from "vitest";
import { REGRA_SENHA_TEXTO, SENHA_MIN, validarSenhaNova } from "@/lib/auth/senha/regra";
import { chaveEmail, criarLimitador, LIMITE_ENTRAR_EMAIL, LIMITE_ENTRAR_IP } from "@/lib/auth/senha/limitador";
import {
  MSG_CREDENCIAIS,
  PISO_RECUSA_MS,
  VARIACAO_RECUSA_MS,
  destinoSeguro,
  ehRecusaDeCredencial,
  esperaAtePiso,
  operadorPodeEntrar,
  respostaDeEntrar,
  respostaDeTrocar,
  textoBloqueio,
  type OperadorDaSessao,
  type ResultadoEntrar,
} from "@/lib/auth/senha/mensagens";
import { entrarComSenha, type ClienteEntrar, type DepsEntrar, type RespostaEntrarAuth } from "@/lib/auth/senha/entrar";
import { trocarSenha, type DepsTrocar } from "@/lib/auth/senha/conta";
import { origemConfiavel, senhaNaUrl } from "@/lib/auth/senha/http";
import { avisoDaUrl, emailDiscreto, estadoDaRespostaLink, estadoDaRespostaSenha } from "@/crm-grafite/telas/entrar/acesso-logica";
import { modeloConta, resultadoDaTroca, temErro, validarTroca } from "@/crm-grafite/telas/conta/conta-logica";

/**
 * Entrar com e-mail e senha + Minha conta (porte do CRM do IPD, PR #342): regra da senha,
 * limitador em memória, respostas únicas de recusa e as regras das rotas com o Auth trocado
 * por um dublê (a ligação real com o Supabase fica nas rotas).
 */

const SENHA_BOA = "cavalo-Bateria-grampo-42";

describe("regra da senha nova", () => {
  it("mínimo de 12 caracteres, com a conta do que falta", () => {
    expect(SENHA_MIN).toBe(12);
    const r = validarSenhaNova("Abc-12345-x");
    expect(r.ok).toBe(false);
    expect(!r.ok && r.codigo).toBe("curta");
    expect(!r.ok ? r.erro : "").toMatch(/falta 1\b/);
    expect(validarSenhaNova("abc").ok).toBe(false);
    expect(!validarSenhaNova("abc").ok && (validarSenhaNova("abc") as { erro: string }).erro).toMatch(/faltam 9/);
    expect(validarSenhaNova(SENHA_BOA).ok).toBe(true);
  });

  it("recusa as óbvias: só números, repetição, sequência, palavra comum com números, trocas por símbolo", () => {
    for (const obvia of [
      "123456789012",
      "000000000000",
      "abcabcabcabc",
      "qwertyuiopas",
      "abcdefghijkl",
      "aaaaaabbbbbb",
      "senha1234567",
      "Senha@123456",
      "minhasenha2026",
      "crmdodono2026",
      "P@ssw0rd2024!!",
      "M1nh@S3nh4F0rt3!",
      "1q2w3e4r5t6y",
      "2026-11-12!!!",
    ]) {
      const r = validarSenhaNova(obvia);
      expect(r.ok, obvia).toBe(false);
      expect(!r.ok && r.codigo, obvia).toBe("obvia");
    }
  });

  it("recusa a que contém o próprio e-mail (inteiro, parte antes do @, com ou sem pontuação)", () => {
    const email = "maria.silva@exemplo.com";
    for (const s of ["x-maria.silva@exemplo.com-9", "Maria.Silva#2026!", "mariasilva#2026!"]) {
      const r = validarSenhaNova(s, { email });
      expect(!r.ok && r.codigo, s).toBe("email");
    }
    expect(validarSenhaNova(SENHA_BOA, { email }).ok).toBe(true);
    // parte antes do @ curta demais não vira regra (senão quase toda senha cairia)
    expect(validarSenhaNova("cavalo-jo-Bateria-42", { email: "jo@exemplo.com" }).ok).toBe(true);
  });

  it("recusa espaço nas pontas e senha acima do limite do Supabase Auth (72 bytes)", () => {
    const espaco = validarSenhaNova(` ${SENHA_BOA}`);
    expect(!espaco.ok && espaco.codigo).toBe("espaco");
    const longa = validarSenhaNova("çã".repeat(20) + "Xy-9");
    expect(!longa.ok && longa.codigo).toBe("longa");
  });

  it("o texto da regra na tela diz o mínimo, o que é óbvio e o e-mail", () => {
    expect(REGRA_SENHA_TEXTO).toMatch(/12 caracteres/);
    expect(REGRA_SENHA_TEXTO).toMatch(/e-mail/);
    expect(REGRA_SENHA_TEXTO).toMatch(/sequência|repetição/);
  });
});

describe("limitador em memória", () => {
  it("deixa passar até o limite e depois recusa com o tempo que falta", () => {
    const l = criarLimitador({ n: 3, janelaMs: 60_000 });
    const t0 = 1_000_000;
    expect(l.consumir("a", t0)).toEqual({ ok: true, restantes: 2 });
    expect(l.consumir("a", t0 + 1)).toEqual({ ok: true, restantes: 1 });
    expect(l.consumir("a", t0 + 2)).toEqual({ ok: true, restantes: 0 });
    expect(l.consumir("a", t0 + 10_000)).toEqual({ ok: false, retryAfterSec: 50 });
    // outra chave não é afetada
    expect(l.consumir("b", t0 + 10_000).ok).toBe(true);
  });

  it("a janela fecha e a chave libera de novo", () => {
    const l = criarLimitador({ n: 1, janelaMs: 60_000 });
    expect(l.consumir("a", 0).ok).toBe(true);
    expect(l.consumir("a", 59_999).ok).toBe(false);
    expect(l.consumir("a", 60_000).ok).toBe(true);
  });

  it("limites da entrada: 10 por IP em 5 minutos e 10 por e-mail em 10 minutos", () => {
    expect(LIMITE_ENTRAR_IP).toEqual({ n: 10, janelaMs: 5 * 60_000 });
    expect(LIMITE_ENTRAR_EMAIL).toEqual({ n: 10, janelaMs: 10 * 60_000 });
  });

  it("a chave do e-mail é um hash (o e-mail nunca fica na memória) e ignora caixa e espaços", () => {
    const k = chaveEmail("  Alguem@Exemplo.com ");
    expect(k).toBe(chaveEmail("alguem@exemplo.com"));
    expect(k).toMatch(/^[0-9a-f]{40}$/);
    expect(k).not.toMatch(/alguem|exemplo/);
  });
});

describe("mensagens e respostas", () => {
  it("toda recusa de credencial tem o mesmo status e o mesmo corpo", () => {
    expect(MSG_CREDENCIAIS).toBe("E-mail ou senha não conferem");
    expect(respostaDeEntrar({ tipo: "credenciais" })).toEqual({ status: 401, corpo: { error: MSG_CREDENCIAIS, code: "credenciais" } });
  });

  it("limite: 429 com Retry-After e texto igual para qualquer e-mail", () => {
    const r = respostaDeEntrar({ tipo: "limite", retryAfterSec: 61 });
    expect(r.status).toBe(429);
    expect(r.headers).toEqual({ "Retry-After": "61" });
    expect(r.corpo.error).toBe(textoBloqueio(61));
    expect(textoBloqueio(61)).toMatch(/2 minutos/);
    expect(textoBloqueio(30)).toMatch(/1 minuto\b/);
  });

  it("tempo mínimo: a recusa rápida espera até o piso; a lenta só a variação", () => {
    expect(esperaAtePiso(0, 0)).toBe(PISO_RECUSA_MS);
    expect(esperaAtePiso(300, 0)).toBe(PISO_RECUSA_MS - 300);
    expect(esperaAtePiso(5000, 0)).toBe(0);
    expect(esperaAtePiso(0, 0.9999)).toBeLessThan(PISO_RECUSA_MS + VARIACAO_RECUSA_MS);
  });

  it("destino só interno; recusa de credencial só para 4xx que não é limite", () => {
    expect(destinoSeguro("/#/conta")).toBe("/#/conta");
    for (const ruim of ["//mal.com", "https://mal.com", "/\\mal.com", "", null, 42]) expect(destinoSeguro(ruim)).toBe("/");
    expect(ehRecusaDeCredencial({ status: 400 })).toBe(true);
    expect(ehRecusaDeCredencial({ status: 429 })).toBe(false);
    expect(ehRecusaDeCredencial({ status: 500 })).toBe(false);
    expect(ehRecusaDeCredencial(null)).toBe(false);
  });

  it("só entra operador ativo, pessoa e com papel de pessoa", () => {
    const base: OperadorDaSessao = { id: "o1", nome: "Ana", papel: "vendedor", tipo: "humano", ativo: true };
    expect(operadorPodeEntrar(base)).toBe(true);
    expect(operadorPodeEntrar({ ...base, papel: "leitura" })).toBe(true);
    expect(operadorPodeEntrar({ ...base, ativo: false })).toBe(false);
    expect(operadorPodeEntrar({ ...base, papel: "bot" })).toBe(false);
    expect(operadorPodeEntrar({ ...base, tipo: "ia" })).toBe(false);
    expect(operadorPodeEntrar(null)).toBe(false);
  });

  it("trocar senha: a senha atual errada vira um texto só, sem detalhe do Auth", () => {
    expect(respostaDeTrocar({ tipo: "senha_atual" })).toEqual({ status: 422, corpo: { error: "A senha atual não confere.", code: "senha_atual" } });
    expect(respostaDeTrocar({ tipo: "ok", outrosDesconectados: true }).corpo).toEqual({ ok: true, outrosDesconectados: true });
  });
});

/* ---------- entrar com senha: regras da rota, com o Auth trocado por um dublê ---------- */

type Conta = { id: string; email: string; senha: string };

function cenario(contas: Conta[], operadores: Record<string, OperadorDaSessao | null>, opts: { authFora?: boolean } = {}) {
  let sessao: string | null = null;
  const chamadas = { signIn: 0, signOut: 0, buscar: 0 };
  const esperas: number[] = [];
  let agora = 1_000_000;
  const cliente: ClienteEntrar = {
    async signInWithPassword({ email, password }): Promise<RespostaEntrarAuth> {
      chamadas.signIn++;
      if (opts.authFora) return { data: { user: null, session: null }, error: { status: 500, code: "unexpected_failure" } };
      const c = contas.find((x) => x.email === email && x.senha === password);
      if (!c) return { data: { user: null, session: null }, error: { status: 400, code: "invalid_credentials", message: "Invalid login credentials" } };
      sessao = c.id;
      return { data: { user: { id: c.id, email: c.email }, session: { access_token: "t" } }, error: null };
    },
    async signOut() {
      chamadas.signOut++;
      sessao = null;
      return { error: null };
    },
  };
  const deps: DepsEntrar = {
    cliente,
    buscarOperador: async (id) => {
      chamadas.buscar++;
      return operadores[id] ?? null;
    },
    limiteIp: criarLimitador(LIMITE_ENTRAR_IP),
    limiteEmail: criarLimitador(LIMITE_ENTRAR_EMAIL),
    chaveEmail,
    agora: () => agora,
    esperar: async (ms) => {
      esperas.push(ms);
      agora += ms;
    },
    sortear: () => 0,
  };
  return { deps, chamadas, esperas, sessao: () => sessao };
}

const op = (id: string, extra: Partial<OperadorDaSessao> = {}): OperadorDaSessao => ({ id, nome: "Pessoa", papel: "vendedor", tipo: "humano", ativo: true, ...extra });
let ipSeq = 0;
const ip = () => `198.51.100.${++ipSeq}`;

describe("entrar com senha", () => {
  afterEach(() => vi.restoreAllMocks());

  it("operador ativo com a senha certa entra e a sessão fica", async () => {
    const c = cenario([{ id: "u1", email: "ana@exemplo.com", senha: SENHA_BOA }], { u1: op("o1") });
    const r = await entrarComSenha(c.deps, { email: "  Ana@Exemplo.com ", senha: SENHA_BOA, ip: ip(), next: "/#/conta" });
    expect(r).toEqual({ tipo: "ok", destino: "/#/conta" });
    expect(c.sessao()).toBe("u1");
    expect(c.esperas).toEqual([]);
  });

  it("senha certa de quem não é operador ativo: recusa igual e a sessão aberta é encerrada", async () => {
    const contas = [
      { id: "u1", email: "fora@exemplo.com", senha: SENHA_BOA },
      { id: "u2", email: "inativo@exemplo.com", senha: SENHA_BOA },
      { id: "u3", email: "robo@exemplo.com", senha: SENHA_BOA },
    ];
    const c = cenario(contas, { u1: null, u2: op("o2", { ativo: false }), u3: op("o3", { papel: "bot" }) });
    for (const { email } of contas) {
      const r = await entrarComSenha(c.deps, { email, senha: SENHA_BOA, ip: ip() });
      expect(r, email).toEqual({ tipo: "credenciais" });
      expect(c.sessao(), email).toBeNull();
    }
    expect(c.chamadas.signOut).toBe(3);
  });

  it("senha errada, e-mail que não existe e não operador: mesma resposta e mesmo tempo mínimo", async () => {
    const c = cenario([{ id: "u1", email: "ana@exemplo.com", senha: SENHA_BOA }, { id: "u2", email: "fora@exemplo.com", senha: SENHA_BOA }], {
      u1: op("o1"),
      u2: null,
    });
    const casos: Array<[string, string]> = [
      ["ana@exemplo.com", "nao-e-a-senha-certa-1"],
      ["ninguem@exemplo.com", SENHA_BOA],
      ["fora@exemplo.com", SENHA_BOA],
    ];
    const respostas: string[] = [];
    for (const [email, senha] of casos) {
      const r = await entrarComSenha(c.deps, { email, senha, ip: ip() });
      respostas.push(JSON.stringify(respostaDeEntrar(r)));
    }
    expect(new Set(respostas).size).toBe(1);
    expect(c.esperas).toHaveLength(3);
    for (const ms of c.esperas) expect(ms).toBeGreaterThanOrEqual(PISO_RECUSA_MS);
  });

  it("entrada inválida é 400 e não chega ao Auth", async () => {
    const c = cenario([], {});
    expect((await entrarComSenha(c.deps, { email: "sem-arroba", senha: SENHA_BOA, ip: ip() })).tipo).toBe("invalido");
    expect((await entrarComSenha(c.deps, { email: "a@exemplo.com", senha: "", ip: ip() })).tipo).toBe("invalido");
    expect((await entrarComSenha(c.deps, { email: 42, senha: { x: 1 }, ip: ip() })).tipo).toBe("invalido");
    expect(c.chamadas.signIn).toBe(0);
  });

  it("depois de 10 tentativas no mesmo e-mail, nem a senha certa é tentada até a janela fechar", async () => {
    const c = cenario([{ id: "u1", email: "alvo@exemplo.com", senha: SENHA_BOA }], { u1: op("o1") });
    for (let i = 0; i < 10; i++) {
      expect((await entrarComSenha(c.deps, { email: "alvo@exemplo.com", senha: `errada-${i}-xx`, ip: ip() })).tipo).toBe("credenciais");
    }
    const antes = c.chamadas.signIn;
    const r: ResultadoEntrar = await entrarComSenha(c.deps, { email: "alvo@exemplo.com", senha: SENHA_BOA, ip: ip() });
    expect(r.tipo).toBe("limite");
    expect(c.chamadas.signIn).toBe(antes);
  });

  it("10 tentativas do mesmo IP com e-mails diferentes também param", async () => {
    const c = cenario([], {});
    const mesmoIp = ip();
    for (let i = 0; i < 10; i++) await entrarComSenha(c.deps, { email: `p${i}@exemplo.com`, senha: SENHA_BOA, ip: mesmoIp });
    expect((await entrarComSenha(c.deps, { email: "outro@exemplo.com", senha: SENHA_BOA, ip: mesmoIp })).tipo).toBe("limite");
  });

  it("Auth fora do ar vira 'indisponível', e a senha não vai para o log", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const c = cenario([], {}, { authFora: true });
    const r = await entrarComSenha(c.deps, { email: "ana@exemplo.com", senha: "segredo-que-nao-pode-vazar-9", ip: ip() });
    expect(r).toEqual({ tipo: "indisponivel" });
    expect(respostaDeEntrar(r).status).toBe(503);
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/segredo-que-nao-pode-vazar|ana@exemplo/);
  });
});

/* ---------- Minha conta: trocar a senha ---------- */

function depsTrocar(extra: Partial<DepsTrocar> = {}) {
  const chamadas = { conferir: 0, atualizar: [] as string[], outros: 0 };
  const deps: DepsTrocar = {
    usuario: { id: "u1", email: "ana@exemplo.com" },
    operador: op("o1"),
    conferirSenha: async (_email, senha) => {
      chamadas.conferir++;
      return senha === SENHA_BOA ? { ok: true, userId: "u1" } : { ok: false, recusada: true };
    },
    atualizarSenha: async (nova) => {
      chamadas.atualizar.push(nova);
      return { error: null };
    },
    desconectarOutros: async () => {
      chamadas.outros++;
      return true;
    },
    limite: criarLimitador({ n: 5, janelaMs: 15 * 60_000 }),
    agora: () => 0,
    ...extra,
  };
  return { deps, chamadas };
}

const NOVA = "girafa-Tambor-ninho-73";

describe("trocar a própria senha", () => {
  it("confere a atual antes de trocar, troca e desconecta os outros aparelhos", async () => {
    const { deps, chamadas } = depsTrocar();
    expect(await trocarSenha(deps, { senhaAtual: SENHA_BOA, senhaNova: NOVA })).toEqual({ tipo: "ok", outrosDesconectados: true });
    expect(chamadas).toEqual({ conferir: 1, atualizar: [NOVA], outros: 1 });
  });

  it("senha atual errada: não troca", async () => {
    const { deps, chamadas } = depsTrocar();
    expect(await trocarSenha(deps, { senhaAtual: "nao-e-essa-senha-1", senhaNova: NOVA })).toEqual({ tipo: "senha_atual" });
    expect(chamadas.atualizar).toEqual([]);
  });

  it("senha conferida de outro usuário não vale", async () => {
    const { deps, chamadas } = depsTrocar({ conferirSenha: async () => ({ ok: true, userId: "outro" }) });
    expect((await trocarSenha(deps, { senhaAtual: SENHA_BOA, senhaNova: NOVA })).tipo).toBe("senha_atual");
    expect(chamadas.atualizar).toEqual([]);
  });

  it("aplica a regra (com o e-mail da conta) e pede senha diferente da atual, sem ir ao Auth", async () => {
    const { deps, chamadas } = depsTrocar();
    const curta = await trocarSenha(deps, { senhaAtual: SENHA_BOA, senhaNova: "curta" });
    expect(curta.tipo).toBe("senha_recusada");
    const comEmail = await trocarSenha(deps, { senhaAtual: SENHA_BOA, senhaNova: "ana@exemplo.com-xyz-9" });
    expect(comEmail.tipo === "senha_recusada" && comEmail.erro).toMatch(/e-mail/);
    const igual = await trocarSenha(deps, { senhaAtual: SENHA_BOA, senhaNova: SENHA_BOA });
    expect(igual.tipo === "senha_recusada" && igual.erro).toMatch(/diferente/);
    expect(chamadas.conferir).toBe(0);
  });

  it("sem sessão ou sem operador ativo: nada acontece", async () => {
    for (const extra of [{ usuario: null }, { operador: null }, { operador: op("o1", { ativo: false }) }]) {
      const { deps, chamadas } = depsTrocar(extra);
      expect((await trocarSenha(deps, { senhaAtual: SENHA_BOA, senhaNova: NOVA })).tipo).toBe("sem_sessao");
      expect(chamadas.conferir).toBe(0);
    }
  });

  it("limite por usuário: a 6ª tentativa em 15 minutos para", async () => {
    const { deps } = depsTrocar();
    for (let i = 0; i < 5; i++) await trocarSenha(deps, { senhaAtual: `errada-${i}-xyz`, senhaNova: NOVA });
    expect((await trocarSenha(deps, { senhaAtual: SENHA_BOA, senhaNova: NOVA })).tipo).toBe("limite");
  });

  it("erros do updateUser viram mensagens de tela", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const com = (error: { status?: number; code?: string }) => depsTrocar({ atualizarSenha: async () => ({ error }) }).deps;
    expect((await trocarSenha(com({ status: 422, code: "weak_password" }), { senhaAtual: SENHA_BOA, senhaNova: NOVA })).tipo).toBe("senha_recusada");
    expect((await trocarSenha(com({ status: 401, code: "reauthentication_needed" }), { senhaAtual: SENHA_BOA, senhaNova: NOVA })).tipo).toBe("reautenticar");
    expect((await trocarSenha(com({ status: 500 }), { senhaAtual: SENHA_BOA, senhaNova: NOVA })).tipo).toBe("indisponivel");
    vi.restoreAllMocks();
  });

  it("se não deu para desconectar os outros, a troca vale e a tela avisa", async () => {
    const { deps } = depsTrocar({ desconectarOutros: async () => false });
    expect(await trocarSenha(deps, { senhaAtual: SENHA_BOA, senhaNova: NOVA })).toEqual({ tipo: "ok", outrosDesconectados: false });
  });
});

/* ---------- conferências HTTP ---------- */

describe("origem e senha na URL", () => {
  const h = (o: Record<string, string>) => new Headers(o);
  it("só JSON, do mesmo host", () => {
    expect(origemConfiavel(h({ "content-type": "application/json", host: "crm.exemplo.com", origin: "https://crm.exemplo.com" }))).toBe(true);
    expect(origemConfiavel(h({ "content-type": "application/json", host: "crm.exemplo.com", origin: "https://mal.com" }))).toBe(false);
    expect(origemConfiavel(h({ "content-type": "application/x-www-form-urlencoded", host: "crm.exemplo.com" }))).toBe(false);
    expect(origemConfiavel(h({ "content-type": "application/json", "sec-fetch-site": "cross-site" }))).toBe(false);
  });
  it("senha no endereço é recusada", () => {
    expect(senhaNaUrl(new URL("https://x/api/auth/senha?senha=abc"))).toBe(true);
    expect(senhaNaUrl(new URL("https://x/api/auth/senha?password=abc"))).toBe(true);
    expect(senhaNaUrl(new URL("https://x/api/auth/senha?next=/"))).toBe(false);
  });
});

/* ---------- telas ---------- */

describe("tela Entrar com conta", () => {
  it("recusa do servidor vira o texto único, sem dizer se o e-mail existe", () => {
    const e = estadoDaRespostaSenha({ status: 401, error: "qualquer coisa" });
    expect(e.fase === "erro" && e.aviso.titulo).toBe(MSG_CREDENCIAIS);
    expect(estadoDaRespostaSenha({ status: 200, destino: "//mal.com" })).toEqual({ fase: "entrou", destino: "/" });
    expect(estadoDaRespostaSenha({ status: null }).fase).toBe("erro");
    const limite = estadoDaRespostaSenha({ status: 429, error: textoBloqueio(120) });
    expect(limite.fase === "erro" && limite.aviso.tom).toBe("atencao");
  });

  it("link por e-mail: confirmação discreta e erros com o que fazer", () => {
    expect(estadoDaRespostaLink(200, "joana@empresa.com")).toEqual({ fase: "enviado", email: "joana@empresa.com" });
    expect(estadoDaRespostaLink(null, "x@y.com").fase).toBe("erro");
    expect(estadoDaRespostaLink(429, "x@y.com").fase).toBe("erro");
    expect(emailDiscreto("joana@empresa.com")).toBe("jo•••@empresa.com");
    expect(avisoDaUrl("auth")?.titulo).toMatch(/link/);
    expect(avisoDaUrl(null)).toBeNull();
  });
});

describe("tela Minha conta", () => {
  it("lê a resposta do servidor: modo local, sem sessão, com conta, erro", () => {
    expect(modeloConta(200, { supabase: false })).toEqual({ fase: "local" });
    expect(modeloConta(200, { supabase: true, sessao: null })).toEqual({ fase: "sem_sessao" });
    expect(modeloConta(200, { supabase: true, sessao: { email: "ana@exemplo.com", nome: "Ana", papel: "dono" } })).toEqual({
      fase: "conta",
      email: "ana@exemplo.com",
      nome: "Ana",
      papel: "dono",
    });
    expect(modeloConta(503, { error: "x" })).toEqual({ fase: "erro" });
    expect(modeloConta(null, null)).toEqual({ fase: "erro" });
  });

  it("confere os três campos antes de mandar", () => {
    const vazio = validarTroca("", "", "", "ana@exemplo.com");
    expect(temErro(vazio)).toBe(true);
    expect(vazio.atual).toMatch(/senha que você usa hoje/);
    expect(validarTroca(SENHA_BOA, NOVA, "outra", "ana@exemplo.com").repeticao).toMatch(/não estão iguais/);
    expect(validarTroca(SENHA_BOA, SENHA_BOA, SENHA_BOA, "ana@exemplo.com").nova).toMatch(/diferente/);
    expect(temErro(validarTroca(SENHA_BOA, NOVA, NOVA, "ana@exemplo.com"))).toBe(false);
  });

  it("resposta da troca: erro no campo certo, sessão perdida e sucesso", () => {
    expect(resultadoDaTroca(422, { error: "A senha atual não confere.", code: "senha_atual" })).toEqual({ ok: false, erro: "A senha atual não confere.", campo: "atual" });
    expect(resultadoDaTroca(422, { error: "Use ao menos 12", code: "senha_recusada" })).toMatchObject({ campo: "nova" });
    expect(resultadoDaTroca(401, { error: "x", code: "sem_sessao" })).toMatchObject({ sessao: true });
    expect(resultadoDaTroca(200, { outrosDesconectados: true })).toEqual({ ok: true, outrosDesconectados: true });
    expect(resultadoDaTroca(null, null).ok).toBe(false);
  });
});
