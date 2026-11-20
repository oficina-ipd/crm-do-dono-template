/**
 * Agentes: catálogo, como cada agente trabalha de verdade no template, contexto real para rodar
 * um agente sobre um contato e leitura dos resultados em linguagem de dono. Puro e testado.
 * Nada aqui decide política: as travas continuam no servidor (src/lib/agents, src/domain).
 */
import { crmConfig } from "@crm/config";
import type { ContatoCompleto } from "@/domain/types";

export type SlugAgente = keyof typeof crmConfig.agentes;

export const ORDEM_AGENTES: SlugAgente[] = ["claudio", "scout", "pilot", "scribe", "eco", "ledger", "ember"];

/** Agentes que dá para rodar daqui sobre um contato, com dados reais do CRM. */
export const RODAVEIS = ["scout", "pilot", "scribe", "eco"] as const;
export type SlugRodavel = (typeof RODAVEIS)[number];

export function nomeAgente(slug: string, nomeRobo?: string): string {
  if (slug === "claudio" && nomeRobo) return nomeRobo;
  return (crmConfig.agentes as Record<string, { nome: string }>)[slug]?.nome ?? slug;
}

export function resumoAgente(slug: string): string {
  return (crmConfig.agentes as Record<string, { resumo: string }>)[slug]?.resumo ?? "";
}

export type Prontidao = { iaConectada: boolean | null; whatsappConectado: boolean | null; decisoesAutomaticas: number; ultimaAutomatica: string | null };

export type LinhaAgente = {
  slug: SlugAgente;
  nome: string;
  faz: string;
  /** Como ele trabalha hoje neste CRM, em uma frase. */
  modo: string;
  estado: { tom: "sucesso" | "neutro" | "atencao"; rotulo: string; detalhe: string | null };
  /** Para onde ir para ver o trabalho dele (Relance para o Ember). */
  href?: string;
};

const SEM_IA = "Sem chave de IA: usa regras locais, mais simples.";

/**
 * Uma linha por agente, com o que ele faz de verdade. "Automático" aqui só existe onde o código
 * envia sozinho, e mesmo assim depende de quem instalou ligar no servidor.
 */
export function linhasAgentes(p: Prontidao, nomeRobo: string): LinhaAgente[] {
  const ia = p.iaConectada;
  const wpp = p.whatsappConectado;
  const comIa = (detalhe: string | null = null): LinhaAgente["estado"] =>
    ia === false ? { tom: "neutro", rotulo: "Regras locais", detalhe: SEM_IA } : ia ? { tom: "sucesso", rotulo: "Com IA", detalhe } : { tom: "neutro", rotulo: "Sem informação", detalhe: "Não deu para ler a conexão com a IA." };

  const linhas: Record<SlugAgente, Omit<LinhaAgente, "slug" | "nome" | "faz">> = {
    claudio: {
      modo: "Responde sozinho no WhatsApp só quando quem instalou liga o atendimento automático no servidor. Sem isso, a equipe conduz a conversa.",
      estado:
        ia === false
          ? { tom: "neutro", rotulo: "Não responde sozinho", detalhe: "Precisa da chave de IA conectada." }
          : wpp === false
            ? { tom: "neutro", rotulo: "Não responde sozinho", detalhe: "Precisa do WhatsApp conectado." }
            : p.decisoesAutomaticas > 0
              ? { tom: "sucesso", rotulo: "Atendendo", detalhe: `${p.decisoesAutomaticas} ${p.decisoesAutomaticas === 1 ? "decisão registrada" : "decisões registradas"}${p.ultimaAutomatica ? `, a última em ${p.ultimaAutomatica}` : ""}.` }
              : { tom: "neutro", rotulo: "Pronto, se ligado", detalhe: "IA e WhatsApp conectados. Nenhuma decisão automática registrada ainda." },
    },
    scout: {
      modo: `Lê a conversa e diz se é hora de passar para uma pessoa. Roda junto com o atendimento automático de ${nomeRobo} e quando você pede ao lado.`,
      estado: comIa(),
    },
    pilot: {
      modo: "Prepara follow-ups sem preço para quem parou de responder e deixa na fila para revisar. Só envia sozinho se quem instalou ligar o envio automático do Pilot.",
      estado: comIa(wpp === false ? "WhatsApp desconectado: mesmo ligado, só sugere." : null),
    },
    scribe: { modo: "Resume as notas e ligações do contato e propõe tarefas de follow-up. Roda quando você pede.", estado: comIa() },
    eco: { modo: "Prepara o briefing do contato antes da reunião, com dor, meta e nota. Roda quando você pede.", estado: comIa() },
    ledger: {
      modo: "Só sugere: olha o risco de cancelamento nos primeiros 7 dias. Nunca fica automático e nunca cobra.",
      estado: { tom: "neutro", rotulo: "Não roda aqui", detalhe: "Precisa saber quantas vezes o cliente acessou, e este CRM ainda não registra isso." },
    },
    ember: {
      modo: "Trabalha em campanhas no Relance: lê o histórico de quem parou e, com a campanha ativa, envia a primeira mensagem sozinho, dentro dos limites de envio.",
      estado:
        ia === false
          ? { tom: "atencao", rotulo: "Bloqueado", detalhe: "Sem chave de IA o Ember não roda (nunca manda texto pronto)." }
          : ia
            ? { tom: "sucesso", rotulo: "Com IA", detalhe: null }
            : { tom: "neutro", rotulo: "Sem informação", detalhe: null },
      href: "/relance",
    },
  };
  return ORDEM_AGENTES.map((slug) => ({ slug, nome: nomeAgente(slug, nomeRobo), faz: resumoAgente(slug), ...linhas[slug] }));
}

// ───────────────────────── Rodar um agente sobre um contato ─────────────────────────

/** Contatos para escolher: por nome, empresa ou telefone; com oportunidade aberta primeiro. */
export function buscarContatos(contatos: ContatoCompleto[], q: string, max = 8): ContatoCompleto[] {
  const t = normalizar(q);
  if (t.length < 2) return [];
  const dig = q.replace(/\D/g, "");
  return contatos
    .filter((c) => normalizar(c.nome).includes(t) || normalizar(c.empresa).includes(t) || (dig.length >= 4 && c.telefone.replace(/\D/g, "").includes(dig)))
    .sort((a, b) => Number(temAberta(b)) - Number(temAberta(a)) || a.nome.localeCompare(b.nome))
    .slice(0, max);
}

const normalizar = (s: string) =>
  (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

const temAberta = (c: ContatoCompleto) => c.oportunidades.some((o) => !o.perdida && !["pago", "dentro"].includes(o.etapa));

export function oportunidadeAberta(c: ContatoCompleto) {
  return c.oportunidades.find((o) => !o.perdida) ?? null;
}

const mensagensReais = (c: ContatoCompleto) => [...c.mensagens].filter((m) => !m.aviso).sort((a, b) => a.em.localeCompare(b.em));

/** Texto de base que o Pilot melhora (o mesmo do tick do servidor). */
export function followupBase(nome: string): string {
  const primeiro = nome.trim().split(/\s+/)[0] || nome;
  return `Oi ${primeiro}, passando para retomar nosso papo. Quando fica bom pra você?`;
}

/** Notas e resumos de ligação do contato, do mais antigo ao mais novo (o que o Scribe resume). */
export function notasDoContato(c: ContatoCompleto): string {
  const notas = [...c.notas].sort((a, b) => a.em.localeCompare(b.em)).map((n) => n.texto.trim());
  const ligacoes = [...c.ligacoes].sort((a, b) => a.iniciouEm.localeCompare(b.iniciouEm)).map((l) => l.resumo.trim());
  return [...notas, ...ligacoes].filter(Boolean).join("\n");
}

/** Por que o agente não pode rodar sobre este contato (null quando pode). */
export function motivoNaoRoda(slug: SlugRodavel, c: ContatoCompleto): string | null {
  if ((slug === "scout" || slug === "pilot") && mensagensReais(c).length === 0) return `${c.nome} ainda não tem conversa no CRM.`;
  if (slug === "scribe" && !notasDoContato(c)) return `${c.nome} não tem notas nem resumo de ligação para resumir.`;
  return null;
}

/** Contexto real enviado ao agente (mesmos campos que o servidor lê em src/lib/agents). */
export function contextoPara(slug: SlugRodavel, c: ContatoCompleto, agora: string): Record<string, unknown> {
  const msgs = mensagensReais(c);
  const op = oportunidadeAberta(c);
  switch (slug) {
    case "scout":
      return { mensagens: msgs.slice(-30).map((m) => ({ autor: m.autor, texto: m.texto, em: m.em })), agora, nota: c.nota };
    case "pilot": {
      const ultima = msgs[msgs.length - 1];
      const ultimaRobo = [...msgs].reverse().find((m) => m.autor === "robo");
      const ultimaContato = [...msgs].reverse().find((m) => m.autor === "contato");
      const horas = (iso: string) => (Date.parse(agora) - Date.parse(iso)) / 3_600_000;
      return {
        nome: c.nome,
        diasParado: ultima ? Math.floor(horas(ultima.em) / 24) : 0,
        horasDesdeUltimaAutomatica: ultimaRobo ? Math.round(horas(ultimaRobo.em)) : null,
        ultimaMensagemContato: ultimaContato?.texto ?? null,
        textoFollowup: followupBase(c.nome),
        historico: msgs.slice(-10).map((m) => ({ autor: m.autor, texto: m.texto })),
      };
    }
    case "scribe":
      return { notasReuniao: notasDoContato(c) };
    case "eco":
      return { nome: c.nome, dor: op?.briefing?.dor ?? null, meta: op?.briefing?.meta ?? null, nota: c.nota };
  }
}

export type SaidaAgente = { resumo: string; acaoSugerida?: string; requerAprovacao?: boolean; payload?: Record<string, unknown> };
export type RespostaAgente = { saida: SaidaAgente; usadoLlm?: boolean; custoTokens?: number };

export const ACAO_SCOUT: Record<string, string> = {
  aguardar: "Esperar a resposta",
  retomar: "Retomar com um follow-up",
  handoff: "Passar para uma pessoa agora",
  nutrir: "Mandar conteúdo útil, sem pressão",
  ignorar: "Não contatar",
};

export const BLOQUEIO_PILOT: Record<string, string> = {
  cooldown: "O Pilot espera 48 h desde a última mensagem automática antes de sugerir outra.",
  teto_anti_loop: "Parado há 14 dias ou mais: o Pilot não insiste. Se fizer sentido, retome à mão.",
  opt_out: "O contato pediu para parar: nenhum follow-up.",
  recusa_recente: "O contato recusou há pouco: o Pilot não insiste.",
  preco: "O texto falava de preço e foi descartado. Preço é sempre com uma pessoa.",
};

export type LeituraResultado = {
  titulo: string;
  linhas: Array<{ rotulo: string; texto: string }>;
  /** Texto pronto para levar à conversa (Pilot). */
  texto: string | null;
  /** Follow-ups que viram tarefa (Scribe). */
  followups: string[];
  /** Briefing que vira nota (Eco). */
  briefing: string | null;
  bloqueado: boolean;
  comIa: boolean;
};

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Leitura do resultado em linguagem de quem usa. Nada aqui foi enviado ao contato. */
export function lerResultado(slug: SlugRodavel, r: RespostaAgente): LeituraResultado {
  const p = r.saida.payload ?? {};
  const bloqueado = Boolean(p.bloqueado || p.pausado || p.cooldown);
  const base: LeituraResultado = { titulo: r.saida.resumo, linhas: [], texto: null, followups: [], briefing: null, bloqueado, comIa: Boolean(r.usadoLlm) };
  if (slug === "scout") {
    const rotulo = str(p.rotulo);
    if (rotulo) base.titulo = `Leitura do Scout: ${rotulo}.`;
    const acao = str(p.acao);
    if (acao) base.linhas.push({ rotulo: "Recomendação", texto: ACAO_SCOUT[acao] ?? acao });
    const porque = str(p.porque) ?? str(r.saida.acaoSugerida);
    if (porque) base.linhas.push({ rotulo: "Por quê", texto: porque });
    const prox = str(p.proximoPasso);
    if (prox) base.linhas.push({ rotulo: "Próximo passo", texto: prox });
    if (typeof p.minutosSilencio === "number") base.linhas.push({ rotulo: "Sem resposta há", texto: tempoLegivel(p.minutosSilencio) });
    return base;
  }
  if (slug === "pilot") {
    const motivo = str(p.motivo);
    if (bloqueado || motivo === "preco") {
      base.bloqueado = true;
      base.titulo = (motivo && BLOQUEIO_PILOT[motivo]) ?? r.saida.resumo;
      return base;
    }
    base.texto = str(p.texto);
    base.titulo = base.texto ? "Follow-up pronto. Revise antes de enviar." : r.saida.resumo;
    return base;
  }
  if (slug === "scribe") {
    const resumo = str(p.resumo);
    if (resumo && resumo !== "Sem notas") base.linhas.push({ rotulo: "Resumo", texto: resumo });
    base.followups = Array.isArray(p.followups) ? p.followups.map(String).map((f) => f.trim()).filter(Boolean) : [];
    return base;
  }
  base.briefing = str(p.briefing);
  return base;
}

export function tempoLegivel(min: number): string {
  if (min < 60) return `${Math.round(min)} min`;
  if (min < 1440) return `${Math.round(min / 60)} h`;
  const d = Math.round(min / 1440);
  return `${d} ${d === 1 ? "dia" : "dias"}`;
}

// ───────────────────────── Fila e registro ─────────────────────────

export type SugestaoPilot = { id: string; criadaEm: string; contatoId: string; nome: string; telefoneMascarado: string; diasParado: number; texto: string; status: string };
export type DecisaoAgente = { id: string; em: string; origem: string; decisao: string; motivo: string; telefone: string; trecho?: string };

export const DECISAO: Record<string, string> = {
  responder: "Respondeu",
  handoff: "Passou para uma pessoa",
  silenciar: "Ficou em silêncio",
  sugerir: "Sugeriu follow-up",
  enviar: "Enviou follow-up",
};

export const ORIGEM_DECISAO: Record<string, string> = { "auto-atendimento": "Atendimento automático", pilot: "Pilot" };

/** Sugestões pendentes, das mais antigas para as mais novas (quem espera há mais tempo primeiro). */
export function ordenarSugestoes(s: SugestaoPilot[]): SugestaoPilot[] {
  return s.filter((x) => x.status === "pendente").sort((a, b) => a.criadaEm.localeCompare(b.criadaEm));
}

export const MOTIVO_TICK: Record<string, string> = {
  ja_tem_sugestao_pendente: "já tinham sugestão esperando revisão",
  sem_conversa: "não têm conversa",
  parado_menos_de_1_dia: "pararam há menos de 1 dia",
  parado_alem_do_teto_14_dias: "pararam há mais de 14 dias (o Pilot não insiste)",
  opt_out: "pediram para não ser contatados",
  humano_no_comando: "estão com uma pessoa no comando",
  handoff_pendente: "estão esperando uma pessoa",
  cooldown_48h: "receberam mensagem automática há menos de 48 h",
  pilot_pausado: "foram pausados pelo limite de insistência",
  pilot_cooldown: "estão no intervalo mínimo entre mensagens",
  pilot_sem_texto_seguro: "não tiveram texto seguro",
  texto_inseguro: "tiveram texto que falava de preço (descartado)",
  trava_podeRoboEnviar: "foram barrados pela regra de envio",
  envio_falhou: "tiveram envio com falha",
};

export const AVISO_TICK: Record<string, string> = {
  auto_sem_chave_llm: "O envio automático está ligado no servidor, mas sem chave de IA: o Pilot só sugeriu.",
  auto_sem_sessao_whatsapp: "O envio automático está ligado no servidor, mas o WhatsApp não está conectado: o Pilot só sugeriu.",
  fora_da_janela_comercial_so_sugere: "Fora do horário comercial: o Pilot só sugeriu.",
};

export type ResultadoTickPilot = { avaliados: number; sugeridos: number; enviados: number; ignorados: number; motivos: Record<string, number>; modo: string };

export function textoTick(r: ResultadoTickPilot): { texto: string; avisos: string[] } {
  if (r.avaliados === 0) {
    return { texto: "O Pilot não encontrou contatos para olhar. Ele lê as conversas que chegam pelo WhatsApp conectado ao CRM.", avisos: [] };
  }
  const partes = [`O Pilot olhou ${r.avaliados} ${r.avaliados === 1 ? "contato" : "contatos"}`];
  const feitos = [`${r.sugeridos} ${r.sugeridos === 1 ? "sugestão nova" : "sugestões novas"}`];
  if (r.enviados > 0) feitos.push(`${r.enviados} ${r.enviados === 1 ? "follow-up enviado" : "follow-ups enviados"}`);
  const avisos = Object.keys(r.motivos)
    .filter((k) => AVISO_TICK[k])
    .map((k) => AVISO_TICK[k]);
  const pulados = Object.entries(r.motivos)
    .filter(([k]) => !AVISO_TICK[k])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, n]) => `${n} ${MOTIVO_TICK[k] ?? semNomeTecnico(k.replace(/_/g, " "))}`);
  const texto = `${partes[0]}: ${feitos.join(", ")}.${pulados.length ? ` Ficaram de fora: ${pulados.join("; ")}.` : ""}`;
  return { texto, avisos };
}

/**
 * Texto vindo do servidor em linguagem de quem usa: nunca mostra nome de variável de ambiente
 * (CRM_ALGUMA_COISA vira "configuração do servidor").
 */
export function semNomeTecnico(b: string): string {
  return b
    .replace(/\s*\((?:[A-Z][A-Z0-9]*_)+[A-Z0-9]+\)/g, "")
    .replace(/\b(?:[A-Z][A-Z0-9]*_)+[A-Z0-9]+\b/g, "configuração do servidor")
    .replace(/\s+\./g, ".")
    .trim();
}
