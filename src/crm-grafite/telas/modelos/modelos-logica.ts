/**
 * Modelos de mensagem (Grafite): textos prontos de WhatsApp e e-mail com variáveis.
 * Puro: a tela e os testes usam as mesmas regras.
 */
import type { Comando } from "@/domain/comandos";
import { mencionaPreco, preencherTemplate } from "@/domain/rules";
import type { EstadoCRM, Template } from "@/domain/types";

export type FiltroCanal = "todos" | Template["canal"];

export const ROTULO_CANAL: Record<Template["canal"], string> = { whatsapp: "WhatsApp", email: "E-mail" };

export const VARIAVEIS: { chave: string; ajuda: string }[] = [
  { chave: "nome", ajuda: "primeiro nome do contato" },
  { chave: "empresa", ajuda: "nome da sua empresa" },
  { chave: "produto", ajuda: "produto da oportunidade" },
  { chave: "operador", ajuda: "quem está enviando" },
  { chave: "link", ajuda: "link de pagamento ou da proposta" },
];

/** Valores de exemplo para a prévia: dados do próprio CRM quando existem. */
export function exemploVariaveis(estado: EstadoCRM, operadorNome: string | undefined): Record<string, string> {
  return {
    nome: "Mariana",
    empresa: estado.config.nomeEmpresa,
    produto: estado.produtos.find((p) => p.ativo)?.nome ?? "seu produto",
    operador: operadorNome ?? "você",
    link: "https://exemplo.invalid/link",
  };
}

export function previa(t: Pick<Template, "texto" | "assunto">, vars: Record<string, string>): { assunto: string | null; texto: string } {
  return { assunto: t.assunto ? preencherTemplate(t.assunto, vars) : null, texto: preencherTemplate(t.texto, vars) };
}

/** Variáveis escritas no texto que o CRM não conhece (ficam como estão na mensagem). */
export function variaveisDesconhecidas(texto: string): string[] {
  const conhecidas = new Set(VARIAVEIS.map((v) => v.chave));
  const achadas = [...texto.matchAll(/\{([^{}]+)\}/g)].map((m) => m[1].trim());
  return [...new Set(achadas.filter((k) => !conhecidas.has(k)))];
}

/** Insere `{chave}` na posição do cursor (ou no fim). Devolve o texto novo e onde o cursor fica. */
export function inserirVariavel(texto: string, chave: string, inicio?: number | null, fim?: number | null): { texto: string; cursor: number } {
  const ins = `{${chave}}`;
  const a = inicio ?? texto.length;
  const b = fim ?? a;
  return { texto: texto.slice(0, a) + ins + texto.slice(b), cursor: a + ins.length };
}

export type FormModelo = { nome: string; canal: Template["canal"]; assunto: string; texto: string };
export type ErrosModelo = Partial<Record<"nome" | "assunto" | "texto", string>>;

export function formDoModelo(t?: Template | null): FormModelo {
  return { nome: t?.nome ?? "", canal: t?.canal ?? "whatsapp", assunto: t?.assunto ?? "", texto: t?.texto ?? "" };
}

export function validarModelo(f: FormModelo): ErrosModelo {
  const e: ErrosModelo = {};
  if (!f.nome.trim()) e.nome = "Dê um nome para achar o modelo depois, como “Boas-vindas”.";
  if (f.canal === "email" && !f.assunto.trim()) e.assunto = "E-mail precisa de assunto.";
  if (!f.texto.trim()) e.texto = "Escreva o texto da mensagem.";
  else if (f.texto.length > 4096) e.texto = "Use até 4096 caracteres.";
  return e;
}

export function comandoModelo(f: FormModelo, id?: string): Comando {
  return { tipo: "salvarTemplate", template: { id, nome: f.nome.trim(), canal: f.canal, assunto: f.canal === "email" ? f.assunto.trim() : null, texto: f.texto } };
}

export function mudouModelo(f: FormModelo, t?: Template | null): boolean {
  const b = formDoModelo(t);
  return b.nome !== f.nome || b.canal !== f.canal || b.texto !== f.texto || (f.canal === "email" && b.assunto !== f.assunto);
}

/** O robô não fala de preço: modelo que fala de valor só uma pessoa envia. */
export const falaDePreco = (f: Pick<FormModelo, "texto" | "assunto">) => mencionaPreco(`${f.assunto} ${f.texto}`);

export function filtrarModelos(ts: Template[], canal: FiltroCanal, busca: string): Template[] {
  const q = busca.trim().toLocaleLowerCase("pt-BR");
  return ts
    .filter((t) => canal === "todos" || t.canal === canal)
    .filter((t) => !q || `${t.nome} ${t.assunto ?? ""} ${t.texto}`.toLocaleLowerCase("pt-BR").includes(q))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
