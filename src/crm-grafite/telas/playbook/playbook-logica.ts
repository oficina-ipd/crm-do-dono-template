/**
 * Playbook (Grafite): a Pergunta Matadora de cada etapa, o que fazer por resposta, as
 * complementares, as objeções (diga / nunca diga), a condição e o próximo passo. O padrão vale
 * para todos os produtos; cada produto pode ter a sua versão de qualquer etapa.
 * Puro: a tela e os testes usam as mesmas regras.
 */
import { ETAPAS, playbookDe } from "@/domain/funil";
import type { Etapa, EtapaId, PerguntaMatadora, Produto } from "@/domain/types";

export type LinhaPlaybook = {
  etapa: EtapaId;
  ordem: number;
  nome: string;
  pergunta: string;
  conduz: string;
  prazo: string;
  meta: number;
  proprio: boolean;
};

export function quemConduz(e: Pick<Etapa, "auto" | "dono">, nomeRobo: string): string {
  if (e.auto) return "Sistema";
  return e.dono === "robo" ? nomeRobo : "Pessoa da equipe";
}

export function linhasPlaybook(produto: Produto | null, nomeRobo: string): LinhaPlaybook[] {
  const out: LinhaPlaybook[] = [];
  ETAPAS.forEach((e, i) => {
    const p = playbookDe(e.id, produto);
    if (!p) return;
    out.push({
      etapa: e.id,
      ordem: i + 1,
      nome: e.nome,
      pergunta: p.pergunta,
      conduz: quemConduz(e, nomeRobo),
      prazo: e.prazoTexto,
      meta: e.meta,
      proprio: Boolean(produto?.playbook.some((x) => x.etapa === e.id)),
    });
  });
  return out;
}

/* ---------- Edição de uma etapa (só no playbook de um produto) ---------- */

export type FaixaForm = { de: string; ate: string; acao: string };
export type FormEtapa = {
  pergunta: string;
  faixas: FaixaForm[];
  complementares: { pergunta: string; porque: string }[];
  objecoes: { objecao: string; diga: string; nuncaDiga: string }[];
  condicao: string;
  proximoPasso: string;
};

export function formDaEtapa(p: PerguntaMatadora): FormEtapa {
  return {
    pergunta: p.pergunta,
    faixas: p.faixas.map((f) => ({ de: String(f.de), ate: String(f.ate), acao: f.acao })),
    complementares: p.complementares.map((c) => ({ ...c })),
    objecoes: p.objecoes.map((o) => ({ ...o })),
    condicao: p.condicao,
    proximoPasso: p.proximoPasso,
  };
}

const vazia = (o: Record<string, string>) => Object.values(o).every((v) => !v.trim());

/** Erros por campo: "pergunta", "faixas.0.de", "objecoes.1.diga"… Linhas totalmente vazias são ignoradas. */
export function validarEtapa(f: FormEtapa): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.pergunta.trim()) e.pergunta = "Escreva a Pergunta Matadora desta etapa.";
  const faixas = f.faixas.map((x, i) => [x, i] as const).filter(([x]) => !vazia(x));
  if (faixas.length === 0) e.faixas = "Inclua ao menos uma faixa de nota, como de 0 a 10.";
  for (const [x, i] of faixas) {
    const de = Number(x.de);
    const ate = Number(x.ate);
    const ok = (s: string, n: number) => s.trim() !== "" && Number.isInteger(n) && n >= 0 && n <= 10;
    if (!ok(x.de, de)) e[`faixas.${i}.de`] = "Use um número inteiro de 0 a 10.";
    if (!ok(x.ate, ate)) e[`faixas.${i}.ate`] = "Use um número inteiro de 0 a 10.";
    else if (ok(x.de, de) && de > ate) e[`faixas.${i}.ate`] = "O “até” precisa ser maior ou igual ao “de”.";
    if (!x.acao.trim()) e[`faixas.${i}.acao`] = "Diga o que fazer com quem dá essa nota.";
  }
  f.complementares.forEach((c, i) => {
    if (!vazia(c) && !c.pergunta.trim()) e[`complementares.${i}.pergunta`] = "Escreva a pergunta (ou apague a linha).";
  });
  f.objecoes.forEach((o, i) => {
    if (vazia(o)) return;
    if (!o.objecao.trim()) e[`objecoes.${i}.objecao`] = "Escreva a objeção, como o contato fala.";
    if (!o.diga.trim()) e[`objecoes.${i}.diga`] = "Escreva o que responder.";
  });
  return e;
}

export function paraPergunta(f: FormEtapa, etapa: EtapaId): PerguntaMatadora {
  return {
    etapa,
    pergunta: f.pergunta.trim(),
    faixas: f.faixas.filter((x) => !vazia(x)).map((x) => ({ de: Number(x.de), ate: Number(x.ate), acao: x.acao.trim() })),
    complementares: f.complementares.filter((c) => !vazia(c)).map((c) => ({ pergunta: c.pergunta.trim(), porque: c.porque.trim() })),
    objecoes: f.objecoes.filter((o) => !vazia(o)).map((o) => ({ objecao: o.objecao.trim(), diga: o.diga.trim(), nuncaDiga: o.nuncaDiga.trim() })),
    condicao: f.condicao.trim(),
    proximoPasso: f.proximoPasso.trim(),
  };
}

/** Playbook do produto com a etapa trocada (ou incluída). Mantém a ordem das etapas. */
export function playbookComEtapa(atual: PerguntaMatadora[], p: PerguntaMatadora): PerguntaMatadora[] {
  const ordem = (id: EtapaId) => ETAPAS.findIndex((e) => e.id === id);
  return [...atual.filter((x) => x.etapa !== p.etapa), p].sort((a, b) => ordem(a.etapa) - ordem(b.etapa));
}

export function playbookSemEtapa(atual: PerguntaMatadora[], etapa: EtapaId): PerguntaMatadora[] {
  return atual.filter((x) => x.etapa !== etapa);
}

export function mesmoFormulario(a: FormEtapa, b: FormEtapa): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
