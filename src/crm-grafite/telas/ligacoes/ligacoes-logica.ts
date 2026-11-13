/**
 * Ligações (Grafite, rota /pos-call): o que aconteceu em cada ligação registrada, em
 * linguagem de quem usa. Puro: a tela e os testes usam as mesmas regras.
 */
import { nomeDoOperador } from "@/domain/comandos";
import type { EstadoCRM, Ligacao, Termometro, TrechoLigacao } from "@/domain/types";
import type { TagTom } from "../../ui/marcadores";

export type FiltroLigacao = "todas" | "atendeu" | "nao";

export type LinhaLigacao = {
  id: string;
  contatoId: string;
  contatoNome: string;
  operador: string;
  operadorId: string | null;
  iniciouEm: string;
  duracaoSeg: number;
  resultado: Ligacao["resultado"];
  termometroVendedor: Termometro;
  termometroIA: Termometro;
  resumo: string;
  marcados: TrechoLigacao[];
  totalTrechos: number;
  followups: Ligacao["followups"];
  avisoGravacaoDado: boolean;
};

export const TERMOMETRO: Record<Termometro, string> = { frio: "Frio", morno: "Morno", quente: "Quente" };
export const TOM_TERMOMETRO: Record<Termometro, TagTom> = { frio: "info", morno: "neutro", quente: "sucesso" };

export const RESULTADO: Record<Ligacao["resultado"], { rotulo: string; tom: TagTom }> = {
  atendeu: { rotulo: "Atendeu", tom: "sucesso" },
  "caixa postal": { rotulo: "Caixa postal", tom: "neutro" },
  "não atende": { rotulo: "Não atendeu", tom: "neutro" },
};

export const ROTULO_MARCA: Record<NonNullable<TrechoLigacao["marca"]>, string> = {
  dor: "Dor",
  meta: "Meta",
  prazo: "Prazo",
  objeção: "Objeção",
  decisão: "Decisão",
};

/** "menos de 1 min", "12 min"; sem duração = "—". Mesmo arredondamento do evento de ligação na conversa. */
export function duracaoTexto(seg: number): string {
  if (!Number.isFinite(seg) || seg <= 0) return "—";
  if (seg < 60) return "menos de 1 min";
  return `${Math.ceil(seg / 60)} min`;
}

export function linhasLigacoes(estado: EstadoCRM): LinhaLigacao[] {
  return estado.ligacoes
    .map((l) => ({
      id: l.id,
      contatoId: l.contatoId,
      contatoNome: estado.contatos.find((c) => c.id === l.contatoId)?.nome ?? "Contato removido",
      operador: l.operadorId ? nomeDoOperador(estado, l.operadorId) : "Sem registro",
      operadorId: l.operadorId,
      iniciouEm: l.iniciouEm,
      duracaoSeg: l.duracaoSeg,
      resultado: l.resultado,
      termometroVendedor: l.termometroVendedor,
      termometroIA: l.termometroIA,
      resumo: l.resumo,
      marcados: l.trechos.filter((t) => t.marca),
      totalTrechos: l.trechos.length,
      followups: l.followups,
      avisoGravacaoDado: l.avisoGravacaoDado,
    }))
    .sort((a, b) => Date.parse(b.iniciouEm) - Date.parse(a.iniciouEm));
}

export function passaNoFiltroLigacao(l: Pick<LinhaLigacao, "resultado">, f: FiltroLigacao): boolean {
  if (f === "atendeu") return l.resultado === "atendeu";
  if (f === "nao") return l.resultado !== "atendeu";
  return true;
}

/** "5 ligações · 3 atenderam" */
export function metaLigacoes(linhas: Pick<LinhaLigacao, "resultado">[]): string {
  if (linhas.length === 0) return "Nenhuma ligação ainda";
  const at = linhas.filter((l) => l.resultado === "atendeu").length;
  return `${linhas.length} ${linhas.length === 1 ? "ligação" : "ligações"} · ${at} ${at === 1 ? "atendeu" : "atenderam"}`;
}

/** A leitura do vendedor vale; a da IA aparece ao lado só quando discorda. */
export function termometroTexto(l: Pick<LinhaLigacao, "termometroVendedor" | "termometroIA" | "resultado">): string {
  const base = TERMOMETRO[l.termometroVendedor];
  if (l.resultado !== "atendeu" || l.termometroIA === l.termometroVendedor) return base;
  return `${base} · IA leu ${TERMOMETRO[l.termometroIA].toLowerCase()}`;
}

/** "03:07" (minutos:segundos) para o cronômetro da ligação. */
export function cronometro(seg: number): string {
  const s = Math.max(0, Math.floor(seg));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Discagem: contatos que casam com o nome/empresa ou com 4+ dígitos do telefone (até 6). */
export function buscarParaDiscar<T extends { nome: string; empresa: string; telefone: string }>(contatos: T[], termo: string, limite = 6): T[] {
  const q = termo.trim().toLocaleLowerCase("pt-BR");
  if (!q) return [];
  const dig = termo.replace(/\D/g, "");
  return contatos
    .filter((c) => `${c.nome} ${c.empresa}`.toLocaleLowerCase("pt-BR").includes(q) || (dig.length >= 4 && c.telefone.replace(/\D/g, "").includes(dig)))
    .slice(0, limite);
}

/** Número novo: 8+ dígitos e nenhum contato encontrado. */
export const pareceNumeroNovo = (termo: string, achados: number) => termo.replace(/\D/g, "").length >= 8 && achados === 0;
