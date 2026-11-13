import type { Limitador } from "./limitador";
import { validarSenhaNova } from "./regra";
import { SENHA_MAX_ENTRADA, operadorPodeEntrar, type OperadorDaSessao, type ResultadoTrocar } from "./mensagens";
import type { ErroAuth } from "./entrar";

/**
 * Minha conta: trocar a própria senha. Só servidor.
 *
 *  1. só quem tem sessão no Supabase Auth e é operador ativo em `crm_operadores`;
 *  2. limite por usuário (em memória desta instância);
 *  3. a senha nova passa pela regra (regra.ts) e tem de ser diferente da atual;
 *  4. a senha ATUAL é conferida com um `signInWithPassword` novo, num cliente descartável (sem
 *     cookies; a sessão de conferência é encerrada logo em seguida);
 *  5. só então `updateUser({ password })` na sessão de quem pediu;
 *  6. por fim, as sessões dos outros aparelhos são encerradas (`signOut({ scope: "others" })`).
 */

export type ConferenciaSenha = { ok: true; userId: string } | { ok: false; recusada: boolean };

export type DepsTrocar = {
  /** Usuário da sessão atual (null = sem sessão). */
  usuario: { id: string; email: string | null } | null;
  operador: OperadorDaSessao | null;
  /** Confere e-mail + senha num cliente descartável. `recusada` = o Auth disse que não confere. */
  conferirSenha: (email: string, senha: string) => Promise<ConferenciaSenha>;
  /** `updateUser({ password })` na sessão de quem pediu. */
  atualizarSenha: (senhaNova: string) => Promise<{ error: ErroAuth }>;
  /** Encerra as sessões dos outros aparelhos. Devolve se deu certo. */
  desconectarOutros: () => Promise<boolean>;
  limite: Limitador;
  agora: () => number;
};

export async function trocarSenha(deps: DepsTrocar, corpo: { senhaAtual: unknown; senhaNova: unknown }): Promise<ResultadoTrocar> {
  const { usuario, operador } = deps;
  if (!usuario || !usuario.email || !operadorPodeEntrar(operador)) return { tipo: "sem_sessao" };

  const senhaAtual = typeof corpo.senhaAtual === "string" ? corpo.senhaAtual : "";
  const senhaNova = typeof corpo.senhaNova === "string" ? corpo.senhaNova : "";
  if (!senhaAtual) return { tipo: "invalido", erro: "Digite a senha que você usa hoje." };
  if (!senhaNova) return { tipo: "invalido", erro: "Digite a senha nova." };

  const limite = deps.limite.consumir(`trocar:${usuario.id}`, deps.agora());
  if (!limite.ok) return { tipo: "limite", retryAfterSec: limite.retryAfterSec };

  const regra = validarSenhaNova(senhaNova, { email: usuario.email });
  if (!regra.ok) return { tipo: "senha_recusada", erro: regra.erro };
  if (senhaNova === senhaAtual) return { tipo: "senha_recusada", erro: "A senha nova tem de ser diferente da atual." };
  if (senhaAtual.length > SENHA_MAX_ENTRADA) return { tipo: "senha_atual" };

  let conferida: ConferenciaSenha;
  try {
    conferida = await deps.conferirSenha(usuario.email, senhaAtual);
  } catch {
    return { tipo: "indisponivel" };
  }
  if (!conferida.ok) return conferida.recusada ? { tipo: "senha_atual" } : { tipo: "indisponivel" };
  // A senha conferida tem de ser a do próprio usuário da sessão.
  if (conferida.userId !== usuario.id) return { tipo: "senha_atual" };

  const { error } = await deps.atualizarSenha(senhaNova);
  if (error) {
    console.error("[conta] trocar senha falhou", error.status ?? "", error.code ?? "");
    if (error.code === "same_password") return { tipo: "senha_recusada", erro: "A senha nova tem de ser diferente da atual." };
    if (error.code === "reauthentication_needed" || error.code === "reauthentication_not_valid") return { tipo: "reautenticar" };
    if (error.code === "weak_password" || error.status === 422) {
      return { tipo: "senha_recusada", erro: "O serviço de entrada recusou esta senha. Escolha outra." };
    }
    if (error.status === 401 || error.code === "session_not_found") return { tipo: "sem_sessao" };
    return { tipo: "indisponivel" };
  }

  const outrosDesconectados = await deps.desconectarOutros().catch(() => false);
  return { tipo: "ok", outrosDesconectados };
}
