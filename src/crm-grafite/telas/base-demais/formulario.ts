/**
 * Estado de envio de formulário das telas v4 (Metas, Sessão fechada, Integração, Relance…).
 * Puro, sem React: a tela, a prévia e os testes usam as mesmas regras.
 *
 * Fases: ocioso → salvando → salvo | falhou. "Salvo" só depois que o servidor confirmou;
 * "falhou" guarda a mensagem e fica até a próxima tentativa (não some sozinho).
 */

export type FaseEnvio = "ocioso" | "salvando" | "salvo" | "falhou";

export type EstadoEnvio =
  | { fase: "ocioso" }
  | { fase: "salvando" }
  | { fase: "salvo"; em: string }
  | { fase: "falhou"; erro: string; parcial?: string };

export type EventoEnvio =
  | { tipo: "enviar" }
  | { tipo: "ok"; em: string }
  | { tipo: "erro"; erro: string; parcial?: string }
  | { tipo: "editar" };

export const ENVIO_OCIOSO: EstadoEnvio = { fase: "ocioso" };

/** Transição do estado de envio. Editar depois de salvo volta a ocioso; erro só sai com nova tentativa. */
export function proximoEnvio(atual: EstadoEnvio, ev: EventoEnvio): EstadoEnvio {
  switch (ev.tipo) {
    case "enviar":
      return { fase: "salvando" };
    case "ok":
      return atual.fase === "salvando" ? { fase: "salvo", em: ev.em } : atual;
    case "erro":
      return atual.fase === "salvando" ? { fase: "falhou", erro: ev.erro, parcial: ev.parcial } : atual;
    case "editar":
      return atual.fase === "salvo" ? ENVIO_OCIOSO : atual;
  }
}

/** Texto do estado, ao lado do botão de salvar. Nulo em repouso. */
export function rotuloEnvio(e: EstadoEnvio): string | null {
  if (e.fase === "salvando") return "Salvando…";
  if (e.fase === "salvo") return `Salvo às ${e.em}`;
  if (e.fase === "falhou") return [e.parcial, `Não foi salvo: ${e.erro}`].filter(Boolean).join(" ");
  return null;
}

/** Hora curta de São Paulo (hh:mm) para "Salvo às 14:02". */
export function horaCurta(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(d);
}

export type RegraNumero = { min: number; max: number; inteiro?: boolean; obrigatorio?: boolean; unidade?: string };

/**
 * Validação de campo numérico, com a mensagem que diz como corrigir (aparece junto do campo).
 * Aceita vírgula decimal ("2,5"). Vazio só é erro quando `obrigatorio`.
 */
export function validarNumero(bruto: string, r: RegraNumero): string | null {
  const v = bruto.trim().replace(",", ".");
  const faixa = `de ${formatarNumero(r.min)} a ${formatarNumero(r.max)}${r.unidade ? ` ${r.unidade}` : ""}`;
  if (v === "") return r.obrigatorio ? `Preencha com um número ${faixa}.` : null;
  const n = Number(v);
  if (!Number.isFinite(n)) return `Use só números, ${faixa}.`;
  if (r.inteiro && !Number.isInteger(n)) return `Use um número inteiro, ${faixa}.`;
  if (n < r.min || n > r.max) return `Use um número ${faixa}.`;
  return null;
}

/** Converte o texto do campo (aceita vírgula). Nulo quando vazio ou inválido. */
export function lerNumero(bruto: string): number | null {
  const v = bruto.trim().replace(",", ".");
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function formatarNumero(n: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(n);
}

/** Texto mínimo (nome do acesso, objetivo…). */
export function validarTexto(bruto: string, r: { min: number; max: number; nome: string }): string | null {
  const v = bruto.trim();
  if (v.length < r.min) return r.min <= 1 ? `Preencha ${r.nome}.` : `Escreva ao menos ${r.min} caracteres em ${r.nome}.`;
  if (v.length > r.max) return `Use até ${r.max} caracteres em ${r.nome}.`;
  return null;
}

/** Acesso às telas de configuração v4: só gestor. Explica em vez de redirecionar em silêncio. */
export type AcessoTela = { ok: true } | { ok: false; titulo: string; texto: string; voltar: { href: string; label: string } };

export function acessoConfigV4(tela: string, papel: "gestor" | "vendedor" | "trafego"): AcessoTela {
  if (papel === "gestor") return { ok: true };
  return {
    ok: false,
    titulo: `${tela} é só para gestores`,
    texto: "Seu acesso ao CRM não inclui esta configuração. Se precisa mudar algo aqui, peça a um gestor da equipe.",
    voltar: papel === "trafego" ? { href: "/demanda", label: "Ir para Origem dos leads" } : { href: "/fila", label: "Voltar para a Fila" },
  };
}

/**
 * Trava de envio: enquanto uma chamada está em andamento, as seguintes são ignoradas (devolvem
 * undefined). Cobre o Enter duplo num formulário, que o bloqueio de clique do botão não pega.
 */
export function travaDeEnvio() {
  let ocupado = false;
  return async function <T>(fn: () => Promise<T>): Promise<T | undefined> {
    if (ocupado) return undefined;
    ocupado = true;
    try {
      return await fn();
    } finally {
      ocupado = false;
    }
  };
}
