/**
 * Equipe (Grafite): quem usa o CRM (pessoas e IA), com o papel de cada um, e o nome da
 * empresa e do robô. Puro: a tela e os testes usam as mesmas regras.
 */
import type { Comando } from "@/domain/comandos";
import type { EstadoCRM, Operador, Papel } from "@/domain/types";

export const ROTULO_PAPEL: Record<Papel, string> = {
  dono: "Dono",
  vendedor: "Vendedor",
  leitura: "Só leitura",
  bot: "Bot de testes",
};

export const AJUDA_PAPEL: Record<Papel, string> = {
  dono: "Vê e muda tudo, inclusive esta tela.",
  vendedor: "Atende, liga e move o funil. Não mexe na configuração.",
  leitura: "Só consulta. Bom para um agente de IA que lê os números.",
  bot: "Conta de testes para um agente abrir o CRM no navegador e clicar.",
};

export const PAPEIS: Papel[] = ["dono", "vendedor", "leitura", "bot"];

export type FormOperador = { nome: string; email: string; papel: Papel; tipo: Operador["tipo"]; ativo: boolean };
export type ErrosOperador = Partial<Record<"nome" | "email", string>>;

export function formDoOperador(o?: Operador | null): FormOperador {
  return { nome: o?.nome ?? "", email: o?.email ?? "", papel: o?.papel ?? "vendedor", tipo: o?.tipo ?? "humano", ativo: o?.ativo ?? true };
}

export function validarOperador(f: FormOperador): ErrosOperador {
  const e: ErrosOperador = {};
  if (!f.nome.trim()) e.nome = "Escreva o nome, como aparece para a equipe.";
  else if (f.nome.trim().length > 60) e.nome = "Use até 60 caracteres no nome.";
  const email = f.email.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Digite um e-mail completo, como nome@empresa.com, ou deixe em branco.";
  return e;
}

export function comandoOperador(f: FormOperador, id?: string): Comando {
  return { tipo: "salvarOperador", operador: { id, nome: f.nome.trim(), email: f.email.trim() || undefined, papel: f.papel, tipo: f.tipo, ativo: f.ativo } };
}

export function mudouOperador(f: FormOperador, o?: Operador | null): boolean {
  const b = formDoOperador(o);
  return (Object.keys(b) as (keyof FormOperador)[]).some((k) => b[k] !== f[k]);
}

export type LinhaEquipe = Operador & { conversas: number; robo: boolean };

export function linhasEquipe(estado: EstadoCRM): LinhaEquipe[] {
  const roboId = estado.config.roboOperadorId;
  return estado.operadores
    .map((o) => ({
      ...o,
      robo: o.id === roboId,
      conversas: estado.contatos.filter((c) => (o.id === roboId ? c.dono === "robo" : c.dono === "humano" && c.operadorId === o.id)).length,
    }))
    .sort((a, b) => Number(b.ativo) - Number(a.ativo));
}

/** Por que não dá para desativar (nulo = dá). Mesmas regras do domínio, ditas antes do clique. */
export function motivoNaoDesativar(estado: EstadoCRM, id: string): string | null {
  const o = estado.operadores.find((x) => x.id === id);
  if (!o) return "Esta pessoa não está mais na equipe.";
  if (o.id === estado.config.roboOperadorId) return `${o.nome} é o robô do CRM: não sai da equipe. Para parar de usar, desligue “Na equipe” e salve.`;
  if (o.papel === "dono" && !estado.operadores.some((x) => x.papel === "dono" && x.ativo && x.id !== o.id)) return "É o único dono ativo. Dê o papel de dono a outra pessoa antes.";
  return null;
}

/** Quantas conversas voltam para "sem responsável" ao desativar. */
export function conversasDoOperador(estado: EstadoCRM, id: string): number {
  return estado.contatos.filter((c) => c.operadorId === id).length;
}

export type FormConfig = { nomeEmpresa: string; nomeRobo: string };
export type ErrosConfig = Partial<Record<keyof FormConfig, string>>;

export function validarConfig(f: FormConfig): ErrosConfig {
  const e: ErrosConfig = {};
  if (!f.nomeEmpresa.trim()) e.nomeEmpresa = "Escreva o nome da empresa. Ele aparece no CRM e nos textos do robô.";
  else if (f.nomeEmpresa.trim().length > 60) e.nomeEmpresa = "Use até 60 caracteres.";
  if (!f.nomeRobo.trim()) e.nomeRobo = "Dê um nome ao robô, como Cláudio.";
  else if (f.nomeRobo.trim().length > 30) e.nomeRobo = "Use até 30 caracteres.";
  return e;
}

/** "João (dono)" → "João": o que está entre parênteses é apelido do papel, não sobrenome (iniciais "J", não "J("). */
export function nomeParaAvatar(nome: string): string {
  return nome.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim() || nome;
}
