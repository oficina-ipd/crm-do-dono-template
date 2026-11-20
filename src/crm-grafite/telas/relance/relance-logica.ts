/**
 * Relance (Ember, reciclador de oportunidades): rótulos em linguagem de quem usa, formulário da
 * campanha, validação, indicadores e textos de resultado. Puro e testado.
 * As travas de verdade (preço, não contatar, contexto mínimo, emergência) continuam no servidor.
 */
import { ETAPAS } from "@/domain/funil";
import type {
  CampanhaReciclador,
  EntradaNovaCampanha,
  IncidenteReciclador,
  ItemFilaReciclador,
  MetricasCampanhaReciclador,
  OptOutRegistro,
  ResultadoImportacaoCsv,
  ResultadoSimulacaoReciclador,
  ResultadoTickReciclador,
  StatusCampanhaReciclador,
  StatusItemReciclador,
} from "@/domain/reciclador-types";
import type { EtapaId } from "@/domain/types";
import { validarNumero, validarTexto } from "../base-demais/formulario";

/** Resultado da última ação na fila (simular, lote, ativar…), mostrado junto da fila. */
export type Aviso = { tom: "ok" | "atencao" | "erro"; texto: string } | null;

export const STATUS_CAMPANHA: Record<StatusCampanhaReciclador, string> = {
  rascunho: "Rascunho",
  ativa: "Ativa: envia sozinha",
  pausada: "Pausada",
  emergencia: "Parada de emergência",
  concluida: "Concluída",
};

export const TOM_CAMPANHA: Record<StatusCampanhaReciclador, "neutro" | "sucesso" | "atencao" | "erro"> = {
  rascunho: "neutro",
  ativa: "sucesso",
  pausada: "neutro",
  emergencia: "erro",
  concluida: "neutro",
};

/** O que cada estado da campanha significa, em uma frase. */
export const EXPLICA_CAMPANHA: Record<StatusCampanhaReciclador, string> = {
  rascunho: "Rascunho: nada é enviado. Simule em até 3 contatos para ver o que o Ember escreveria.",
  ativa: "Ativa: a cada lote, o Ember envia a primeira mensagem sozinho, dentro dos limites de envio. Quem responder volta para o atendimento.",
  pausada: "Pausada: nenhum envio novo sai até alguém ativar de novo.",
  emergencia: "Parada de emergência: nenhum envio automático sai deste CRM até um gestor retomar.",
  concluida: "Concluída: a campanha não envia mais.",
};

export const STATUS_ITEM: Record<StatusItemReciclador, string> = {
  pendente: "Aguardando o Ember",
  simulado: "Simulado (não enviado)",
  enviado: "Enviado",
  adiado: "Adiado",
  ignorado: "Fica em silêncio",
  bloqueado: "Bloqueado",
  erro: "Erro no envio",
};

export const TOM_ITEM: Record<StatusItemReciclador, "neutro" | "info" | "sucesso" | "atencao" | "erro"> = {
  pendente: "neutro",
  simulado: "info",
  enviado: "sucesso",
  adiado: "neutro",
  ignorado: "neutro",
  bloqueado: "atencao",
  erro: "erro",
};

export const DECISAO: Record<string, string> = { abordar: "Abordaria", adiar: "Adiaria", ignorar: "Ficaria em silêncio" };

export const INCIDENTE: Record<IncidenteReciclador["tipo"], string> = {
  sessao_desconectada: "WhatsApp desconectado",
  erro_envio: "Falha no envio",
  parada_emergencia: "Parada de emergência",
  rate_limit: "Limite de envio atingido",
  sem_llm: "IA ausente ou fora do ar",
};

export const MOTIVO_OPTOUT: Record<OptOutRegistro["motivo"], string> = {
  pedido_parar: "Pediu para parar",
  recusa_recente: "Recusou há pouco (proteção temporária)",
  manual: "Registrado pela equipe",
};

/** Etapas que podem entrar numa campanha (nunca Pago ou Dentro: quem já comprou não é reciclado). */
export const ETAPAS_RELANCE: Array<{ id: EtapaId; label: string }> = [
  ...ETAPAS.filter((e) => !["pago", "dentro", "perdido"].includes(e.id)).map((e) => ({ id: e.id, label: e.nome })),
  { id: "perdido", label: "Perdido" },
];

export function nomeEtapa(id: EtapaId): string {
  return id === "perdido" ? "Perdido" : ETAPAS.find((e) => e.id === id)?.nome ?? id;
}

export const MODELOS_EMBER = [
  { value: "claude-sonnet-4-5", label: "Claude Sonnet 4.5 (recomendado)" },
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { value: "claude-opus-4-6", label: "Claude Opus 4.6" },
] as const;

// ───────────────────────── Formulário da campanha ─────────────────────────

export type ConfigRelance = Pick<CampanhaReciclador, "nome" | "objetivo" | "filtro" | "fontes" | "cercas" | "freios">;

export function configDe(c: CampanhaReciclador): ConfigRelance {
  const { nome, objetivo, filtro, fontes, cercas, freios } = c;
  return { nome, objetivo, filtro: { ...filtro }, fontes: { ...fontes, temasProibidos: [...fontes.temasProibidos] }, cercas: { ...cercas }, freios: { ...freios } };
}

/** Corpo do PATCH (mesmos campos que a tela antiga enviava). Cláudio só responde sozinho se a resposta vai para ele. */
export function corpoSalvar(c: ConfigRelance): ConfigRelance {
  return {
    nome: c.nome.trim(),
    objetivo: c.objetivo.trim(),
    filtro: { ...c.filtro },
    fontes: { ...c.fontes, temasProibidos: c.fontes.temasProibidos.map((t) => t.trim()).filter(Boolean) },
    cercas: { ...c.cercas, modeloLlm: c.cercas.modeloLlm.trim(), autoResponderClaudio: c.cercas.entregarPara === "claudio" ? c.cercas.autoResponderClaudio : false },
    freios: { ...c.freios },
  };
}

export type NovaCampanha = {
  nome: string;
  objetivo: string;
  etapas: EtapaId[];
  horasParadoMin: string;
  apenasComContexto: boolean;
  proibirPreco: boolean;
  entregarPara: "claudio" | "humano";
  autoResponderClaudio: boolean;
  popularDoCrm: boolean;
};

export function novaInicial(): NovaCampanha {
  return {
    nome: "",
    objetivo: "",
    etapas: ["conversa", "handoff", "briefing", "proposta", "oferta", "perdido"],
    horasParadoMin: "72",
    apenasComContexto: true,
    proibirPreco: true,
    entregarPara: "claudio",
    autoResponderClaudio: true,
    popularDoCrm: true,
  };
}

export function corpoCriar(n: NovaCampanha, modeloLlm: string): EntradaNovaCampanha {
  return {
    nome: n.nome.trim(),
    objetivo: n.objetivo.trim(),
    popularDoCrm: n.popularDoCrm,
    filtro: { etapas: n.etapas, horasParadoMin: Number(n.horasParadoMin.trim()), apenasComContexto: n.apenasComContexto },
    cercas: {
      proibirPreco: n.proibirPreco,
      ...(modeloLlm ? { modeloLlm } : {}),
      entregarPara: n.entregarPara,
      autoResponderClaudio: n.entregarPara === "claudio" ? n.autoResponderClaudio : false,
    },
  };
}

export type ErrosNova = Partial<Record<"nome" | "objetivo" | "etapas" | "horasParadoMin", string>>;

export function validarNova(n: NovaCampanha): ErrosNova {
  const e: ErrosNova = {};
  const nome = validarTexto(n.nome, { min: 1, max: 120, nome: "o nome" });
  if (nome) e.nome = nome;
  const obj = validarTexto(n.objetivo, { min: 1, max: 2000, nome: "o objetivo" });
  if (obj) e.objetivo = obj;
  if (n.etapas.length === 0) e.etapas = "Escolha ao menos uma etapa.";
  const h = validarNumero(n.horasParadoMin, { min: 0, max: 87600, inteiro: true, obrigatorio: true, unidade: "horas" });
  if (h) e.horasParadoMin = h;
  return e;
}

export type ChaveLimite = "maxPorHora" | "maxPorDia" | "espacamentoSegundos" | "janelaInicioHora" | "janelaFimHora" | "cooldownRecusaDias";

/** Limites de envio com faixa e explicação. */
export const LIMITES_ENVIO: Array<{ chave: ChaveLimite; label: string; min: number; max: number; unidade: string; ajuda?: string }> = [
  { chave: "maxPorHora", label: "Mensagens por hora, no máximo", min: 1, max: 60, unidade: "por hora" },
  { chave: "maxPorDia", label: "Mensagens por dia, no máximo", min: 1, max: 500, unidade: "por dia" },
  { chave: "espacamentoSegundos", label: "Intervalo mínimo entre mensagens", min: 5, max: 86400, unidade: "segundos", ajuda: "Em segundos. 120 segundos são 2 minutos." },
  { chave: "janelaInicioHora", label: "Começa a enviar às", min: 0, max: 23, unidade: "h", ajuda: "Hora de São Paulo, de 0 a 23." },
  { chave: "janelaFimHora", label: "Para de enviar às", min: 1, max: 24, unidade: "h", ajuda: "Hora de São Paulo, de 1 a 24." },
  { chave: "cooldownRecusaDias", label: "Depois de uma recusa, esperar", min: 1, max: 365, unidade: "dias", ajuda: "Em dias, de 1 a 365." },
];

export type ErrosConfig = Partial<Record<"nome" | "objetivo" | "tomMarca" | "modeloLlm" | "horasParadoMin" | "etapas" | ChaveLimite, string>>;

/** Valida a configuração campo a campo; a mensagem aparece junto do campo. `texto` guarda o que a pessoa digitou nos números. */
export function validarConfig(c: ConfigRelance, texto: Partial<Record<string, string>> = {}): ErrosConfig {
  const e: ErrosConfig = {};
  const t = (k: string, v: number) => texto[k] ?? String(v);
  const nome = validarTexto(c.nome, { min: 1, max: 120, nome: "o nome" });
  if (nome) e.nome = nome;
  const objetivo = validarTexto(c.objetivo, { min: 1, max: 2000, nome: "o objetivo" });
  if (objetivo) e.objetivo = objetivo;
  const tom = validarTexto(c.cercas.tomMarca, { min: 1, max: 1000, nome: "o tom" });
  if (tom) e.tomMarca = tom;
  if (!c.cercas.modeloLlm.trim()) e.modeloLlm = "Escolha o modelo de IA do Ember.";
  const horas = validarNumero(t("horasParadoMin", c.filtro.horasParadoMin), { min: 0, max: 87600, inteiro: true, obrigatorio: true, unidade: "horas" });
  if (horas) e.horasParadoMin = horas;
  if (c.filtro.etapas.length === 0) e.etapas = "Escolha ao menos uma etapa.";
  for (const l of LIMITES_ENVIO) {
    const m = validarNumero(t(l.chave, c.freios[l.chave]), { min: l.min, max: l.max, inteiro: true, obrigatorio: true, unidade: l.unidade });
    if (m) e[l.chave] = m;
  }
  if (!e.janelaInicioHora && !e.janelaFimHora && c.freios.janelaFimHora <= c.freios.janelaInicioHora) e.janelaFimHora = "O fim precisa ser depois do início.";
  return e;
}

/** Temas proibidos: um por linha ou separados por vírgula, sem vazios. */
export function temasDoTexto(bruto: string): string[] {
  return bruto
    .split(/[\n,]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

// ───────────────────────── Fila e indicadores ─────────────────────────

export type FiltroFila = "todos" | StatusItemReciclador;

export const FILTROS_FILA: Array<{ value: FiltroFila; label: string }> = [
  { value: "todos", label: "Todos" },
  { value: "pendente", label: "Aguardando" },
  { value: "simulado", label: "Simulados" },
  { value: "enviado", label: "Enviados" },
  { value: "ignorado", label: "Em silêncio" },
  { value: "bloqueado", label: "Bloqueados" },
  { value: "adiado", label: "Adiados" },
  { value: "erro", label: "Erros" },
];

export function contarPorStatus(itens: Pick<ItemFilaReciclador, "status">[]): Record<FiltroFila, number> {
  const c = { todos: itens.length, pendente: 0, simulado: 0, enviado: 0, ignorado: 0, bloqueado: 0, adiado: 0, erro: 0 } as Record<FiltroFila, number>;
  for (const i of itens) c[i.status] += 1;
  return c;
}

/** Quem precisa de atenção primeiro: aguardando e simulados, depois o resto; mais recentes antes. */
export function filtrarFila(itens: ItemFilaReciclador[], filtro: FiltroFila): ItemFilaReciclador[] {
  const ordem: Record<StatusItemReciclador, number> = { simulado: 0, pendente: 1, erro: 2, adiado: 3, enviado: 4, bloqueado: 5, ignorado: 6 };
  return itens
    .filter((i) => filtro === "todos" || i.status === filtro)
    .sort((a, b) => ordem[a.status] - ordem[b.status] || (b.processadoEm ?? b.criadoEm).localeCompare(a.processadoEm ?? a.criadoEm));
}

/** Indicadores em uma linha: cada estado contado separadamente; taxas com amostra pequena vêm do servidor já honestas. */
export function indicadores(m: MetricasCampanhaReciclador): Array<{ rotulo: string; valor: string }> {
  return [
    { rotulo: "Na fila", valor: String(m.totalFila) },
    { rotulo: "Aguardando", valor: String(m.pendentes) },
    { rotulo: "Simulados", valor: String(m.simulados) },
    { rotulo: "Enviados", valor: String(m.enviados) },
    { rotulo: "Responderam", valor: `${m.respostas} · ${amostra(m.taxaRespostaTexto)}` },
    { rotulo: "Avançaram no funil", valor: `${m.avancosEtapa} · ${amostra(m.taxaAvancoTexto)}` },
    { rotulo: "Vendas da campanha", valor: String(m.vendasAtribuidas) },
    { rotulo: "Em silêncio", valor: String(m.ignorados) },
    { rotulo: "Bloqueados", valor: String(m.bloqueados) },
    { rotulo: "Adiados", valor: String(m.adiados) },
    { rotulo: "Erros", valor: String(m.erros) },
  ];
}

/** "n=3 · amostra pequena" do servidor vira "amostra pequena"; "Sem disparos ainda" fica. */
export function amostra(t: string): string {
  if (/amostra pequena/i.test(t)) return "amostra pequena";
  return t;
}

/** Incidentes da campanha e gerais, sem repetição, do mais novo ao mais antigo. */
export function incidentesUnificados(daCampanha: IncidenteReciclador[], gerais: IncidenteReciclador[]): IncidenteReciclador[] {
  const m = new Map<string, IncidenteReciclador>();
  for (const i of [...daCampanha, ...gerais]) m.set(i.id, i);
  return [...m.values()].sort((a, b) => b.em.localeCompare(a.em));
}

/** Por que "Simular" está indisponível (null quando pode). */
export function motivoSemSimular(status: StatusCampanhaReciclador | undefined, itens: Pick<ItemFilaReciclador, "status">[], emergenciaGeral: boolean): string | null {
  if (emergenciaGeral || status === "emergencia") return "Com a parada de emergência ligada, nada é simulado.";
  if (status === "concluida") return "A campanha foi concluída.";
  if (!itens.some((i) => i.status === "pendente")) return "Ninguém aguardando o Ember. Puxe contatos do CRM ou importe uma lista com contexto.";
  return null;
}

/** Por que "Processar lote" está indisponível (null quando pode). */
export function motivoSemLote(status: StatusCampanhaReciclador | undefined, emergenciaGeral: boolean): string | null {
  if (emergenciaGeral || status === "emergencia") return "Com a parada de emergência ligada, nenhum lote roda.";
  if (status !== "ativa") return "Lote só envia com a campanha ativa.";
  return null;
}

// ───────────────────────── Textos de resultado ─────────────────────────

export function textoSimulacao(r: Pick<ResultadoSimulacaoReciclador, "processados" | "avisoLlm">): { tom: "ok" | "atencao"; texto: string } {
  const base =
    r.processados === 0
      ? "Ninguém foi simulado (não havia quem estivesse pronto). Nenhuma mensagem enviada."
      : `${r.processados} ${r.processados === 1 ? "contato simulado" : "contatos simulados"}. Nenhuma mensagem enviada: abra cada um na fila para ver o texto.`;
  return r.avisoLlm ? { tom: "atencao", texto: `${base} ${r.avisoLlm}` } : { tom: "ok", texto: base };
}

export function textoTick(r: Pick<ResultadoTickReciclador, "enviados" | "ignorados" | "bloqueados" | "adiados" | "erros" | "pausadaPorIncidente" | "motivoPausa">): {
  tom: "ok" | "atencao";
  texto: string;
} {
  const motivo = r.motivoPausa ? semSigla(r.motivoPausa) : null;
  if (r.pausadaPorIncidente) {
    return { tom: "atencao", texto: `O lote parou por proteção${motivo ? `: ${motivo}` : "."} Veja os incidentes.` };
  }
  if (motivo) return { tom: "atencao", texto: `Nenhum envio neste lote: ${motivo}` };
  const partes = [
    `${r.enviados} ${r.enviados === 1 ? "enviado" : "enviados"}`,
    `${r.ignorados} em silêncio`,
    `${r.bloqueados} ${r.bloqueados === 1 ? "bloqueado" : "bloqueados"}`,
    `${r.adiados} ${r.adiados === 1 ? "adiado" : "adiados"}`,
  ];
  if (r.erros > 0) partes.push(`${r.erros} com erro`);
  return { tom: r.erros > 0 ? "atencao" : "ok", texto: `Lote processado: ${partes.join(", ")}.` };
}

/** Texto do servidor sem sigla técnica: "chave LLM" vira "chave de IA", "dry-run" vira "simulação". */
export function semSigla(t: string): string {
  if (/fallback/i.test(t) && /chave/i.test(t)) return "Sem chave de IA o Ember não escreve nada: ele nunca usa texto pronto. Conecte a IA em Integração antes de ativar o envio.";
  return t
    .replace(/Chave Anthropic/g, "Chave de IA")
    .replace(/chave Anthropic/g, "chave de IA")
    .replace(/(pré|pós)-LLM/g, (_m, q: string) => (q === "pré" ? "antes da IA" : "depois da IA"))
    .replace(/nos guardrails/gi, "nas travas")
    .replace(/pelos guardrails/gi, "pelas travas")
    .replace(/guardrails?/gi, "travas")
    .replace(/([Cc])have LLM/g, "$1have de IA")
    .replace(/\bLLM\b/g, "IA")
    .replace(/\bdry-run\b/gi, "simulação")
    .replace(/\btick\b/gi, "lote")
    .replace(/\bopt-out\b/gi, "pedido de não contato")
    .replace(/\s*\((?:[A-Z][A-Z0-9]*_)+[A-Z0-9]+\)/g, "")
    .replace(/\b(?:[A-Z][A-Z0-9]*_)+[A-Z0-9]+\b/g, "configuração do servidor");
}

const FONTE_LIDA: Record<string, string> = {
  historico_mensagens: "histórico de mensagens",
  notas_crm: "notas",
  briefing: "briefing",
  csv_importado: "lista importada",
};

/** "historico_mensagens" → "histórico de mensagens". */
export function fonteLida(f: string): string {
  return FONTE_LIDA[f] ?? f.replace(/_/g, " ");
}

export function textoImportacao(r: Pick<ResultadoImportacaoCsv, "totalLinhas" | "importados" | "rejeitadosSemContexto" | "rejeitadosOptOut" | "rejeitadosTelefoneInvalido">): string {
  const fora = r.rejeitadosSemContexto + r.rejeitadosOptOut + r.rejeitadosTelefoneInvalido;
  return `${r.importados} de ${r.totalLinhas} ${r.totalLinhas === 1 ? "linha entrou" : "linhas entraram"} na fila${fora > 0 ? `; ${fora} ficaram de fora` : ""}.`;
}

export const ACAO_OK: Record<"ativar" | "pausar" | "retomar_emergencia" | "sincronizar_crm", string> = {
  ativar: "Campanha ativa. O Ember envia sozinho, dentro dos limites, a cada lote.",
  pausar: "Campanha pausada. Nenhum envio novo sai até alguém ativar de novo.",
  retomar_emergencia: "Parada de emergência encerrada. Por segurança, a campanha voltou como pausada.",
  sincronizar_crm: "Fila atualizada com quem está parado no CRM e tem contexto.",
};

export function validarNaoContatar(tel: string, evidencia: string): { tel?: string; evid?: string } {
  const digitos = tel.replace(/\D/g, "");
  return {
    tel: digitos.length < 10 ? "Digite o telefone com DDD (ao menos 10 números)." : undefined,
    evid: evidencia.trim().length < 3 ? "Escreva de onde veio o pedido (ao menos 3 letras)." : undefined,
  };
}
