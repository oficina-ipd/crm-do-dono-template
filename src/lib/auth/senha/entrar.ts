import type { Limitador } from "./limitador";
import {
  SENHA_MAX_ENTRADA,
  destinoSeguro,
  ehRecusaDeCredencial,
  esperaAtePiso,
  mesmoEmail,
  operadorPodeEntrar,
  validarEmail,
  type OperadorDaSessao,
  type ResultadoEntrar,
} from "./mensagens";

/**
 * Entrar no CRM com e-mail e senha (Supabase Auth). Só servidor.
 *
 * Ordem (a mesma para qualquer e-mail):
 *  1. confere o formato (e-mail e senha preenchidos);
 *  2. limite por IP e por e-mail digitado (em memória desta instância: ver limitador.ts);
 *  3. tenta a senha no Supabase Auth (`signInWithPassword`), no cliente ligado aos cookies;
 *  4. a sessão só fica se for do mesmo e-mail e se o usuário for operador ATIVO, pessoa e com
 *     papel de pessoa em `crm_operadores` (ligado por `user_id`). Se não for, a sessão aberta
 *     é encerrada na hora.
 *
 * Toda recusa devolve o mesmo resultado ("credenciais") e espera um tempo mínimo: a resposta
 * não diz se o e-mail existe, se está inativo ou se a senha está errada. A senha nunca é
 * gravada nem vai para o log.
 *
 * Diferença do IPD: lá o servidor procura o operador pelo e-mail (com a chave de serviço) antes
 * de tentar a senha. Aqui a busca usa a própria sessão (RLS de `crm_operadores`), então a senha
 * é tentada antes e a sessão é encerrada se a pessoa não for operadora ativa.
 */

export type ErroAuth = { message?: string; status?: number; code?: string } | null;
export type UsuarioAuth = { id: string; email?: string | null };
export type RespostaEntrarAuth = { data: { user: UsuarioAuth | null; session: unknown }; error: ErroAuth };

/** O pedaço do cliente do Supabase Auth que a entrada usa. */
export interface ClienteEntrar {
  signInWithPassword(c: { email: string; password: string }): Promise<RespostaEntrarAuth>;
  signOut(o?: { scope?: "global" | "local" | "others" }): Promise<{ error: ErroAuth }>;
}

export type DepsEntrar = {
  /** Cliente ligado aos cookies da resposta: é nele que a sessão fica. */
  cliente: ClienteEntrar;
  /** Operador ligado ao usuário (null = não é operador ou a RLS não deixou ver). Lança se o banco falhar. */
  buscarOperador: (userId: string) => Promise<OperadorDaSessao | null>;
  limiteIp: Limitador;
  limiteEmail: Limitador;
  /** Chave do e-mail digitado para o limite (hash). */
  chaveEmail: (email: string) => string;
  agora: () => number;
  esperar: (ms: number) => Promise<void>;
  sortear: () => number;
};

export type EntradaLogin = { email: unknown; senha: unknown; ip: string; next?: unknown };

export async function entrarComSenha(deps: DepsEntrar, entrada: EntradaLogin): Promise<ResultadoEntrar> {
  const inicio = deps.agora();
  const email = typeof entrada.email === "string" ? entrada.email.trim().toLowerCase() : "";
  const senha = typeof entrada.senha === "string" ? entrada.senha : "";
  const erroEmail = validarEmail(email);
  if (erroEmail) return { tipo: "invalido", erro: erroEmail };
  if (!senha) return { tipo: "invalido", erro: "Digite a sua senha." };

  const segurar = async <T extends ResultadoEntrar>(r: T): Promise<T> => {
    await deps.esperar(esperaAtePiso(deps.agora() - inicio, deps.sortear()));
    return r;
  };
  const encerrar = () => deps.cliente.signOut({ scope: "local" }).catch(() => undefined);

  const porIp = deps.limiteIp.consumir(`ip:${entrada.ip}`, deps.agora());
  if (!porIp.ok) return segurar({ tipo: "limite", retryAfterSec: porIp.retryAfterSec });
  const porEmail = deps.limiteEmail.consumir(`email:${deps.chaveEmail(email)}`, deps.agora());
  if (!porEmail.ok) return segurar({ tipo: "limite", retryAfterSec: porEmail.retryAfterSec });

  if (senha.length > SENHA_MAX_ENTRADA) return segurar({ tipo: "credenciais" });

  let resposta: RespostaEntrarAuth;
  try {
    resposta = await deps.cliente.signInWithPassword({ email, password: senha });
  } catch (e) {
    console.error("[entrar] Supabase Auth indisponível", e instanceof Error ? e.name : "erro");
    return segurar({ tipo: "indisponivel" });
  }
  const usuario = resposta.data?.user ?? null;
  if (resposta.error || !usuario || !resposta.data?.session) {
    if (ehRecusaDeCredencial(resposta.error)) return segurar({ tipo: "credenciais" });
    console.error("[entrar] Supabase Auth indisponível", resposta.error?.status ?? "sem status", resposta.error?.code ?? "");
    return segurar({ tipo: "indisponivel" });
  }

  if (!mesmoEmail(usuario.email, email)) {
    await encerrar();
    return segurar({ tipo: "credenciais" });
  }

  let operador: OperadorDaSessao | null;
  try {
    operador = await deps.buscarOperador(usuario.id);
  } catch (e) {
    console.error("[entrar] leitura do operador falhou", e instanceof Error ? e.message : "erro");
    await encerrar();
    return segurar({ tipo: "indisponivel" });
  }
  if (!operadorPodeEntrar(operador)) {
    await encerrar();
    return segurar({ tipo: "credenciais" });
  }

  return { tipo: "ok", destino: destinoSeguro(entrada.next) };
}
