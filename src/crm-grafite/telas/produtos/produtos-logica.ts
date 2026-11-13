/**
 * Produtos (Grafite): o que você vende (valor, parcelas, gatilhos de oferta, playbook
 * próprio), os funis de entrada e os criativos. Puro: tela e testes usam as mesmas regras.
 */
import type { Comando } from "@/domain/comandos";
import type { Criativo, EstadoCRM, Funil, Produto } from "@/domain/types";

export type FormProduto = { nome: string; valor: string; parcelas: string; descricao: string; gatilhos: string; ativo: boolean };
export type ErrosProduto = Partial<Record<"nome" | "valor", string>>;

export function formDoProduto(p?: Produto | null): FormProduto {
  return {
    nome: p?.nome ?? "",
    valor: p ? String(p.valor).replace(".", ",") : "",
    parcelas: p?.parcelas ?? "",
    descricao: p?.descricao ?? "",
    gatilhos: (p?.gatilhos ?? []).join("\n"),
    ativo: p?.ativo ?? true,
  };
}

/** "1.997,00", "R$ 497", "497.5" → número. Nulo quando vazio ou não é número. */
export function lerReais(bruto: string): number | null {
  let v = bruto.replace(/R\$/gi, "").replace(/\s/g, "");
  if (v === "") return null;
  // Vírgula é o decimal; sem vírgula, "2.500" e "1.250.000" são milhares, e "497.5" é decimal.
  if (v.includes(",")) v = v.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(v)) v = v.replace(/\./g, "");
  if (!/^\d+(\.\d+)?$/.test(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function gatilhosDoTexto(t: string): string[] {
  return t
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function validarProduto(f: FormProduto): ErrosProduto {
  const e: ErrosProduto = {};
  if (!f.nome.trim()) e.nome = "Dê um nome ao produto.";
  else if (f.nome.trim().length > 80) e.nome = "Use até 80 caracteres no nome.";
  if (f.valor.trim() === "") e.valor = "Preencha o valor, como 1.997 ou 497,50.";
  else if (lerReais(f.valor) === null) e.valor = "Use só números, como 1.997 ou 497,50.";
  return e;
}

export function comandoProduto(f: FormProduto, id?: string): Comando {
  return {
    tipo: "salvarProduto",
    produto: {
      id,
      nome: f.nome.trim(),
      valor: lerReais(f.valor) ?? 0,
      parcelas: f.parcelas.trim(),
      descricao: f.descricao.trim(),
      ativo: f.ativo,
      gatilhos: gatilhosDoTexto(f.gatilhos),
    },
  };
}

export function mudouProduto(f: FormProduto, p?: Produto | null): boolean {
  const base = formDoProduto(p);
  return (Object.keys(base) as (keyof FormProduto)[]).some((k) => base[k] !== f[k]);
}

export type LinhaProduto = {
  id: string;
  nome: string;
  valor: number;
  parcelas: string;
  ativo: boolean;
  gatilhos: string[];
  etapasProprias: number;
  abertas: number;
  total: number;
};

export function linhasProdutos(estado: EstadoCRM): LinhaProduto[] {
  return estado.produtos
    .map((p) => {
      const ops = estado.oportunidades.filter((o) => o.produtoId === p.id);
      return {
        id: p.id,
        nome: p.nome,
        valor: p.valor,
        parcelas: p.parcelas,
        ativo: p.ativo,
        gatilhos: p.gatilhos,
        etapasProprias: p.playbook.length,
        abertas: ops.filter((o) => !o.perdida && o.etapa !== "pago" && o.etapa !== "dentro" && o.etapa !== "perdido").length,
        total: ops.length,
      };
    })
    .sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome, "pt-BR"));
}

/** O domínio apaga produto sem oportunidade e só desativa quando já tem histórico. */
export function efeitoRemover(estado: EstadoCRM, produtoId: string): { acao: "apagar" | "desativar"; oportunidades: number } {
  const n = estado.oportunidades.filter((o) => o.produtoId === produtoId).length;
  return { acao: n > 0 ? "desativar" : "apagar", oportunidades: n };
}

export function textoPlaybook(n: number): string {
  return n === 0 ? "Padrão" : `Próprio em ${n} ${n === 1 ? "etapa" : "etapas"}`;
}

/* ---------- Funis de entrada ---------- */

export type FormFunil = { nome: string; canal: string; produto: string; ativo: boolean };
export type ErrosFunil = Partial<Record<"nome" | "canal" | "produto", string>>;

export function formDoFunil(f: Funil | null | undefined, produtoPadrao: string): FormFunil {
  return { nome: f?.nome ?? "", canal: f?.canal ?? "", produto: f?.produto ?? produtoPadrao, ativo: f?.ativo ?? true };
}

/** Id que o domínio gera do nome para funil novo (é o que vai no campo `origem` do webhook). */
export function idDoFunil(nome: string): string {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function validarFunil(f: FormFunil, estado: EstadoCRM, id?: string): ErrosFunil {
  const e: ErrosFunil = {};
  if (!f.nome.trim()) e.nome = "Dê um nome ao funil, como Perpétuo ou Indicação.";
  else if (!id && estado.funis.some((x) => x.id === idDoFunil(f.nome))) e.nome = "Já existe um funil com esse nome. Escolha outro.";
  if (!f.canal.trim()) e.canal = "Diga por onde o lead chega, como Anúncio + formulário.";
  if (!estado.produtos.some((p) => p.id === f.produto)) e.produto = "Escolha um produto.";
  return e;
}

export function comandoFunil(f: FormFunil, id?: string): Comando {
  return { tipo: "salvarFunil", funil: { id, nome: f.nome.trim(), canal: f.canal.trim(), produto: f.produto, ativo: f.ativo } };
}

/* ---------- Criativos ---------- */

export const PLATAFORMAS = ["Meta Ads", "Google Ads", "TikTok Ads", "Orgânico", "Outro"];

export type FormCriativo = { nome: string; funilId: string; plataforma: string; ativo: boolean };
export type ErrosCriativo = Partial<Record<"nome" | "funilId", string>>;

export function formDoCriativo(c: Criativo | null | undefined, funilPadrao: string): FormCriativo {
  return { nome: c?.nome ?? "", funilId: c?.funilId ?? funilPadrao, plataforma: c?.plataforma ?? "Meta Ads", ativo: c?.ativo ?? true };
}

export function validarCriativo(f: FormCriativo, estado: EstadoCRM): ErrosCriativo {
  const e: ErrosCriativo = {};
  if (!f.nome.trim()) e.nome = "Dê um nome ao criativo, como o título do anúncio.";
  if (!estado.funis.some((x) => x.id === f.funilId)) e.funilId = "Escolha o funil em que o criativo roda.";
  return e;
}

export function comandoCriativo(f: FormCriativo, id?: string): Comando {
  return { tipo: "salvarCriativo", criativo: { id, nome: f.nome.trim(), funilId: f.funilId, plataforma: f.plataforma, ativo: f.ativo } };
}

export const temErro = (e: object) => Object.keys(e).length > 0;
