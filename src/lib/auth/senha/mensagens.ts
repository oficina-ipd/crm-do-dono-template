/**
 * Mensagens e respostas das rotas de entrada e de conta. Puro (sem rede): um lugar só decide o
 * que cada resultado vira em status e corpo, para que toda recusa de credencial saia igual.
 */

/** A única recusa de quem tenta entrar: não diz se o e-mail existe, se está inativo ou se a senha está errada. */
export const MSG_CREDENCIAIS = "E-mail ou senha não conferem";
export const MSG_SENHA_ATUAL = "A senha atual não confere.";
export const MSG_INDISPONIVEL = "A entrada está fora do ar por um instante. Tente de novo em um minuto.";

/**
 * Tempo mínimo de toda resposta de recusa, mais uma variação aleatória. O piso fica bem acima do
 * tempo normal de uma ida ao Supabase Auth: a recusa de um e-mail que existe leva o mesmo tempo
 * da de um que não existe.
 */
export const PISO_RECUSA_MS = 1000;
export const VARIACAO_RECUSA_MS = 250;
/** Senha maior que isso nunca é a certa (o limite do Auth é 72 bytes) e nem vai ao Auth. */
export const SENHA_MAX_ENTRADA = 200;

/** Quanto ainda falta esperar para a resposta não sair antes do piso. `sorteio` em [0, 1). */
export function esperaAtePiso(gastoMs: number, sorteio: number): number {
  return Math.max(0, PISO_RECUSA_MS - Math.max(0, gastoMs)) + Math.floor(Math.min(Math.max(sorteio, 0), 0.999) * VARIACAO_RECUSA_MS);
}

/** Texto do aviso de limite, igual para qualquer e-mail. */
export function textoBloqueio(retryAfterSec: number): string {
  return `Muitas tentativas seguidas. Espere ${minutos(retryAfterSec)} e tente de novo, ou entre com o link por e-mail.`;
}

/** "1 minuto", "5 minutos" (arredonda para cima, nunca menos de 1). */
export function minutos(segundos: number): string {
  const min = Math.max(1, Math.ceil(segundos / 60));
  return min === 1 ? "1 minuto" : `${min} minutos`;
}

export function validarEmail(bruto: string): string | null {
  const v = bruto.trim();
  if (!v) return "Digite o seu e-mail.";
  if (v.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "Digite um e-mail completo, como nome@empresa.com.";
  return null;
}

/** Só caminhos internos no destino depois de entrar (evita mandar a pessoa para fora do CRM). */
export function destinoSeguro(next: unknown): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}

export function mesmoEmail(a: string | null | undefined, b: string | null | undefined): boolean {
  return Boolean(a) && Boolean(b) && a!.trim().toLowerCase() === b!.trim().toLowerCase();
}

/** Erro do Supabase Auth que quer dizer "credencial recusada" (e não serviço fora do ar). */
export function ehRecusaDeCredencial(erro: { status?: number } | null | undefined): boolean {
  if (!erro) return false;
  const s = erro.status;
  return typeof s === "number" && s >= 400 && s < 500 && s !== 429 && s !== 408;
}

/** Papéis que entram pela tela. `bot` é acesso de agente (sem login), nunca de pessoa. */
export const PAPEIS_QUE_ENTRAM = ["dono", "vendedor", "leitura"] as const;

export type OperadorDaSessao = { id: string; nome: string; papel: string; tipo?: string | null; ativo: boolean };

/** O operador ligado à sessão pode usar o CRM? Ativo, pessoa (não IA) e com papel de pessoa. */
export function operadorPodeEntrar(o: OperadorDaSessao | null | undefined): boolean {
  if (!o || !o.ativo) return false;
  if (o.tipo && o.tipo !== "humano") return false;
  return (PAPEIS_QUE_ENTRAM as readonly string[]).includes(o.papel);
}

export type ResultadoEntrar =
  | { tipo: "ok"; destino: string }
  | { tipo: "invalido"; erro: string }
  | { tipo: "credenciais" }
  | { tipo: "limite"; retryAfterSec: number }
  | { tipo: "indisponivel" };

export type RespostaRota = { status: number; corpo: Record<string, unknown>; headers?: Record<string, string> };

/** O que a rota de entrar responde. Toda recusa de credencial: mesmo status, mesmo corpo. */
export function respostaDeEntrar(r: ResultadoEntrar): RespostaRota {
  if (r.tipo === "ok") return { status: 200, corpo: { ok: true, destino: r.destino } };
  if (r.tipo === "invalido") return { status: 400, corpo: { error: r.erro, code: "invalido" } };
  if (r.tipo === "limite") {
    return {
      status: 429,
      corpo: { error: textoBloqueio(r.retryAfterSec), code: "limite", retryAfterSec: r.retryAfterSec },
      headers: { "Retry-After": String(r.retryAfterSec) },
    };
  }
  if (r.tipo === "indisponivel") return { status: 503, corpo: { error: MSG_INDISPONIVEL, code: "indisponivel" } };
  return { status: 401, corpo: { error: MSG_CREDENCIAIS, code: "credenciais" } };
}

export type ResultadoTrocar =
  | { tipo: "ok"; outrosDesconectados: boolean }
  | { tipo: "invalido"; erro: string }
  | { tipo: "sem_sessao" }
  | { tipo: "senha_atual" }
  | { tipo: "senha_recusada"; erro: string }
  | { tipo: "reautenticar" }
  | { tipo: "limite"; retryAfterSec: number }
  | { tipo: "indisponivel" };

/** O que a rota de trocar a senha responde. */
export function respostaDeTrocar(r: ResultadoTrocar): RespostaRota {
  switch (r.tipo) {
    case "ok":
      return { status: 200, corpo: { ok: true, outrosDesconectados: r.outrosDesconectados } };
    case "invalido":
      return { status: 400, corpo: { error: r.erro, code: "invalido" } };
    case "sem_sessao":
      return { status: 401, corpo: { error: "A sua sessão terminou. Entre de novo para trocar a senha.", code: "sem_sessao" } };
    case "senha_atual":
      return { status: 422, corpo: { error: MSG_SENHA_ATUAL, code: "senha_atual" } };
    case "senha_recusada":
      return { status: 422, corpo: { error: r.erro, code: "senha_recusada" } };
    case "reautenticar":
      return {
        status: 409,
        corpo: { error: "Por segurança, saia e entre de novo com a senha atual; depois troque a senha.", code: "reautenticar" },
      };
    case "limite":
      return {
        status: 429,
        corpo: { error: `Muitas tentativas seguidas. Espere ${minutos(r.retryAfterSec)} e tente de novo.`, code: "limite" },
        headers: { "Retry-After": String(r.retryAfterSec) },
      };
    default:
      return { status: 503, corpo: { error: "Não conseguimos trocar a senha agora. Tente de novo em instantes.", code: "indisponivel" } };
  }
}
