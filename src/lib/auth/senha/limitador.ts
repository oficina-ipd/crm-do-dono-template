import { createHash } from "node:crypto";

/**
 * Limite simples de tentativas, em memória do servidor. Só servidor.
 *
 * ATENÇÃO: a contagem vive na memória DESTA instância do servidor. Com várias instâncias
 * (Vercel, mais de um processo), cada uma conta por si, e um reinício zera tudo. Serve para
 * frear quem testa senhas à mão ou com um script simples; não é um bloqueio persistente.
 * O bloqueio progressivo gravado no banco (como o do CRM do IPD) ficou de fora deste porte.
 *
 * Janela fixa por chave: a primeira tentativa abre a janela; passou de `limite` dentro dela,
 * recusa até a janela fechar.
 */

export type Limite = { n: number; janelaMs: number };
export type ResultadoLimite = { ok: true; restantes: number } | { ok: false; retryAfterSec: number };

export type Limitador = {
  /** Conta uma tentativa para `chave` e diz se ela pode seguir. */
  consumir(chave: string, agoraMs?: number): ResultadoLimite;
  /** Quantas chaves estão guardadas (para teste e para a faxina). */
  tamanho(): number;
};

/** Teto de chaves guardadas: acima disso, as janelas vencidas saem antes de entrar uma nova. */
const MAX_CHAVES = 10_000;

export function criarLimitador(limite: Limite): Limitador {
  const janelas = new Map<string, { inicio: number; usadas: number }>();

  function faxina(agoraMs: number) {
    for (const [k, j] of janelas) if (agoraMs - j.inicio >= limite.janelaMs) janelas.delete(k);
    // Ainda cheio (muitas chaves novas de uma vez): sai a mais antiga. Nunca cresce sem fim.
    while (janelas.size >= MAX_CHAVES) {
      const primeira = janelas.keys().next().value;
      if (primeira === undefined) break;
      janelas.delete(primeira);
    }
  }

  return {
    consumir(chave, agoraMs = Date.now()) {
      let j = janelas.get(chave);
      if (!j || agoraMs - j.inicio >= limite.janelaMs) {
        if (!j && janelas.size >= MAX_CHAVES) faxina(agoraMs);
        j = { inicio: agoraMs, usadas: 0 };
        janelas.set(chave, j);
      }
      if (j.usadas >= limite.n) {
        return { ok: false, retryAfterSec: Math.max(1, Math.ceil((j.inicio + limite.janelaMs - agoraMs) / 1000)) };
      }
      j.usadas++;
      return { ok: true, restantes: limite.n - j.usadas };
    },
    tamanho: () => janelas.size,
  };
}

/** Entrar com senha: por IP (10 a cada 5 min) e por e-mail digitado (10 a cada 10 min), como no IPD. */
export const LIMITE_ENTRAR_IP: Limite = { n: 10, janelaMs: 5 * 60_000 };
export const LIMITE_ENTRAR_EMAIL: Limite = { n: 10, janelaMs: 10 * 60_000 };
/** Link por e-mail: por IP e por e-mail digitado. */
export const LIMITE_LINK_IP: Limite = { n: 10, janelaMs: 10 * 60_000 };
export const LIMITE_LINK_EMAIL: Limite = { n: 3, janelaMs: 10 * 60_000 };
/** Trocar a senha em Minha conta: por usuário (quem pegou a sessão de outra pessoa não testa senhas à vontade). */
export const LIMITE_TROCAR: Limite = { n: 5, janelaMs: 15 * 60_000 };

/**
 * Chave do e-mail digitado (hash): é o que fica na memória do limite, nunca o e-mail em si.
 * Ignora caixa e espaços nas pontas.
 */
export function chaveEmail(email: string): string {
  return createHash("sha256").update(`crm-entrar:${email.trim().toLowerCase()}`, "utf8").digest("hex").slice(0, 40);
}

/**
 * Os limitadores do processo. Ficam no `globalThis` para sobreviver ao recarregamento de
 * módulos do `next dev`; continuam valendo só para esta instância (ver o aviso no topo).
 */
type Limitadores = { entrarIp: Limitador; entrarEmail: Limitador; linkIp: Limitador; linkEmail: Limitador; trocar: Limitador };
const CHAVE_GLOBAL = "__crmLimitadoresAuth";

export function limitadoresDoServidor(): Limitadores {
  const g = globalThis as typeof globalThis & { [CHAVE_GLOBAL]?: Limitadores };
  g[CHAVE_GLOBAL] ??= {
    entrarIp: criarLimitador(LIMITE_ENTRAR_IP),
    entrarEmail: criarLimitador(LIMITE_ENTRAR_EMAIL),
    linkIp: criarLimitador(LIMITE_LINK_IP),
    linkEmail: criarLimitador(LIMITE_LINK_EMAIL),
    trocar: criarLimitador(LIMITE_TROCAR),
  };
  return g[CHAVE_GLOBAL];
}
