"use client";

import { useId, useMemo, useState, type FormEvent } from "react";
import { useCRM } from "@/components/crm/provider";
import { demanda } from "@/domain/metricas";
import { formatarReais } from "@/domain/rules";
import Link, { usePathname, useRouter, useSearchParams } from "@/crm-grafite/link";
import { Button, Dialog, EmptyState, IconButton, Input, Panel, SegmentedControl, Select, Table } from "../../ui";
import { CabecalhoTela, TelaV4 } from "../base-demais/tela";
import {
  PERIODOS_ORIGEM,
  agruparPorSemana,
  comparacao,
  diaCurto,
  entradasPorDia,
  gastoDoForm,
  gastoPorCriativo,
  gastosDoPeriodo,
  intervalosOrigem,
  percentual,
  periodoValido,
  porFunil,
  porOrigem,
  resumoSerie,
  taxaComAmostra,
  temSerieReal,
  unidadeEfetiva,
  validarGasto,
  variacaoTexto,
  type ErrosGasto,
  type FormGasto,
  type UnidadeOrigem,
} from "./origem-logica";
import "../../styles/telas/resultados.css";
import "../../styles/telas/origem.css";

type LinhaTotal = { chave: string; rotulo: string; total: number; total_?: boolean };

const reais = (v: number | null) => (v == null ? "—" : formatarReais(Math.round(v * 100) / 100));

/**
 * Origem dos leads: período (7/14/30), tabelas por origem, por dia (ou semana), por funil de
 * entrada e por criativo, todas com total. O único gráfico é o de entradas por dia, porque é
 * uma série real; ele vem com resumo em texto e a mesma informação na tabela.
 */
export function TelaOrigem() {
  const { estado, agora, operador, despachar } = useCRM();
  const router = useRouter();
  const pathname = usePathname() || "/demanda";
  const sp = useSearchParams();
  const dias = periodoValido(Number(sp.get("dias") ?? 14));
  const podeEscrever = Boolean(operador) && operador?.papel !== "leitura";
  const gestor = operador?.papel === "dono";

  const [escolha, setEscolha] = useState<{ dias: number; unidade: UnidadeOrigem } | null>(null);
  const [lancando, setLancando] = useState(false);
  const unidade = unidadeEfetiva(escolha, dias);

  const { atual, anterior } = useMemo(() => intervalosOrigem(dias, agora), [dias, agora]);
  const serie = useMemo(() => entradasPorDia(estado, atual), [estado, atual]);
  const origens = useMemo(() => porOrigem(estado, atual), [estado, atual]);
  const funis = useMemo(() => porFunil(estado, atual), [estado, atual]);
  const criativos = useMemo(() => gastoPorCriativo(estado, atual), [estado, atual]);
  const gastos = useMemo(() => gastosDoPeriodo(estado, atual), [estado, atual]);
  const comp = useMemo(() => comparacao(demanda(estado, atual), demanda(estado, anterior)), [estado, atual, anterior]);
  const total = origens.reduce((s, o) => s + o.total, 0);

  const linhasOrigem: LinhaTotal[] = [...origens, { chave: "__total", rotulo: "Total", total, total_: true }];
  const porTempo: LinhaTotal[] = [
    ...(unidade === "dia"
      ? [...serie].reverse().map((s) => ({ chave: s.dia, rotulo: diaCurto(s.dia), total: s.total }))
      : agruparPorSemana(serie)
          .reverse()
          .map((s) => ({ chave: s.semana, rotulo: `Semana de ${diaCurto(s.semana)}${s.dias < 7 ? ` (${s.dias} ${s.dias === 1 ? "dia" : "dias"})` : ""}`, total: s.total }))),
    { chave: "__total", rotulo: "Total", total, total_: true },
  ];

  const colunas = (titulo: string) => [
    { id: "rotulo", titulo, quebrar: true, celula: (l: LinhaTotal) => <span className={l.total_ ? "v4-total" : undefined}>{l.rotulo}</span> },
    { id: "total", titulo: "Contatos", numerica: true, celula: (l: LinhaTotal) => <span className={["v4-num", l.total_ ? "v4-total" : ""].filter(Boolean).join(" ")}>{l.total}</span> },
    { id: "pct", titulo: "% do total", numerica: true, celula: (l: LinhaTotal) => <span className="v4-num">{percentual(l.total, total)}</span> },
  ];
  const nomeFunil = (id: string) => estado.funis.find((f) => f.id === id)?.nome ?? id;
  const nomeCriativo = (id: string | null) => (id ? estado.criativos.find((c) => c.id === id)?.nome ?? "Criativo removido" : "Sem criativo");

  return (
    <TelaV4 area="origem">
      <CabecalhoTela
        titulo="Origem dos leads"
        meta={`${total} ${total === 1 ? "contato novo" : "contatos novos"} · últimos ${dias} dias`}
        acoes={
          <>
            <SegmentedControl
              label="Período"
              value={String(dias)}
              onChange={(v) => router.replace(`${pathname}?dias=${v}`)}
              options={PERIODOS_ORIGEM.map((n) => ({ value: String(n), label: `${n} dias` }))}
            />
            {podeEscrever && estado.funis.length > 0 && (
              <Button icon="mais_" onClick={() => setLancando(true)}>
                Lançar gasto
              </Button>
            )}
          </>
        }
      />

      {total === 0 && gastos.length === 0 ? (
        <div className="v4-tela__estado">
          <EmptyState
            nivel={2}
            titulo={`Nenhum contato novo nos últimos ${dias} dias`}
            texto="Quando entrar gente pelos funis de entrada (formulário, WhatsApp, importação), a origem aparece aqui. Tente um período maior."
          />
        </div>
      ) : (
        <div className="v4-pilha">
          {temSerieReal(serie) && <GraficoPorDia serie={serie} />}
          <div className="v4-grade v4-grade--3">
            <Panel titulo="Por origem" semRecuo>
              <Table rotulo="Contatos novos por origem, com total" chave={(l) => l.chave} linhas={linhasOrigem} colunas={colunas("Origem")} />
            </Panel>
            <Panel
              titulo={unidade === "dia" ? "Por dia" : "Por semana"}
              semRecuo
              acoes={
                <SegmentedControl
                  label="Agrupar por"
                  value={unidade}
                  onChange={(v) => setEscolha({ dias, unidade: v === "semana" ? "semana" : "dia" })}
                  options={[
                    { value: "dia", label: "Dia" },
                    { value: "semana", label: "Semana" },
                  ]}
                />
              }
            >
              <Table
                rotulo={`Contatos novos por ${unidade}, do mais recente ao mais antigo, com total`}
                chave={(l) => l.chave}
                linhas={porTempo}
                colunas={colunas(unidade === "dia" ? "Dia" : "Semana (começa na segunda)")}
              />
            </Panel>
            <Panel titulo={`Comparado com os ${dias} dias anteriores`} semRecuo>
              <Table
                rotulo={`Indicadores deste período e dos ${dias} dias anteriores`}
                chave={(l) => l.chave}
                linhas={comp}
                colunas={[
                  { id: "rotulo", titulo: "Indicador", quebrar: true, celula: (l) => l.rotulo },
                  { id: "atual", titulo: "Agora", numerica: true, celula: (l) => <span className="v4-num">{l.tipo === "reais" ? reais(l.atual) : l.atual}</span> },
                  { id: "antes", titulo: "Antes", numerica: true, celula: (l) => <span className="v4-num">{l.tipo === "reais" ? reais(l.anterior) : l.anterior}</span> },
                  { id: "var", titulo: "Variação", numerica: true, celula: (l) => <span className="v4-num">{variacaoTexto(l.atual, l.anterior)}</span> },
                ]}
              />
            </Panel>
          </div>

          <Panel titulo="Por funil de entrada" semRecuo>
            <Table
              rotulo="Resultado de cada funil de entrada no período: quantidade, reais e taxas"
              chave={(l) => l.chave}
              linhas={funis}
              colunas={[
                {
                  id: "nome",
                  titulo: "Funil",
                  celula: (l) => (
                    <span className="v4-org__funil">
                      <span className={l.total ? "v4-total" : "v4-t-medium"}>{l.nome}</span>
                      {l.canal && <span className="v4-t-meta">{l.canal}</span>}
                    </span>
                  ),
                },
                { id: "leads", titulo: "Contatos novos", numerica: true, celula: (l) => <span className="v4-num">{l.d.leads}</span> },
                { id: "q", titulo: "Passaram para uma pessoa", numerica: true, celula: (l) => <span className="v4-num">{l.d.qualificados}</span> },
                { id: "v", titulo: "Vendas", numerica: true, celula: (l) => <span className="v4-num">{l.d.vendas}</span> },
                { id: "r", titulo: "Receita", numerica: true, celula: (l) => <span className="v4-num">{reais(l.d.receita)}</span> },
                { id: "g", titulo: "Gasto", numerica: true, celula: (l) => <span className="v4-num">{reais(l.d.gasto)}</span> },
                { id: "cpl", titulo: "Custo por contato", numerica: true, celula: (l) => <span className="v4-num">{reais(l.d.cpl)}</span> },
                { id: "cpv", titulo: "Custo por venda", numerica: true, celula: (l) => <span className="v4-num">{reais(l.d.cpv)}</span> },
                { id: "vl", titulo: "Visita → contato", numerica: true, celula: (l) => <Taxa texto={taxaComAmostra(l.d.leads, l.d.visitas)} /> },
                { id: "lv", titulo: "Contato → venda", numerica: true, celula: (l) => <Taxa texto={taxaComAmostra(l.d.vendas, l.d.leads)} /> },
              ]}
            />
            <p className="v4-t-meta v4-res__nota">
              Contatos novos contam pela data de entrada; passaram para uma pessoa, vendas e receita contam pelo que aconteceu no período. Com menos de 10 na
              base, a taxa aparece como amostra pequena.{" "}
              {gestor && (
                <Link className="v4-link" href="/config/produtos">
                  Funis e criativos ficam em Produtos
                </Link>
              )}
            </p>
          </Panel>

          <div className="v4-grade">
            <Panel titulo="Gasto por criativo" semRecuo>
              <Table
                rotulo="Gasto de mídia e visitas por criativo no período, com total"
                chave={(l) => l.chave}
                linhas={criativos}
                colunas={[
                  {
                    id: "nome",
                    titulo: "Criativo",
                    quebrar: true,
                    celula: (l) => (
                      <span className="v4-org__funil">
                        <span className={l.total ? "v4-total" : undefined}>{l.nome}</span>
                        {!l.total && <span className="v4-t-meta">{[l.funil, l.plataforma !== "—" ? l.plataforma : ""].filter(Boolean).join(" · ")}</span>}
                      </span>
                    ),
                  },
                  { id: "g", titulo: "Gasto", numerica: true, celula: (l) => <span className={["v4-num", l.total ? "v4-total" : ""].filter(Boolean).join(" ")}>{reais(l.gasto)}</span> },
                  { id: "v", titulo: "Visitas", numerica: true, celula: (l) => <span className="v4-num">{l.visitas.toLocaleString("pt-BR")}</span> },
                ]}
                vazio={<p className="v4-t-meta">Nenhum gasto de mídia lançado no período.</p>}
              />
              <p className="v4-t-meta v4-res__nota">O contato não guarda o criativo que o trouxe; por isso esta tabela mostra gasto e visitas, não contatos.</p>
            </Panel>

            <Panel titulo="Gastos lançados" semRecuo>
              <Table
                rotulo="Gastos de mídia lançados no período, do mais recente ao mais antigo"
                chave={(g) => g.id}
                linhas={gastos}
                colunas={[
                  { id: "dia", titulo: "Dia", celula: (g) => <span className="v4-tabular">{diaCurto(g.data)}</span> },
                  {
                    id: "onde",
                    titulo: "Funil e criativo",
                    quebrar: true,
                    celula: (g) => (
                      <span className="v4-org__funil">
                        <span>{nomeFunil(g.funilId)}</span>
                        <span className="v4-t-meta">{nomeCriativo(g.criativoId)}</span>
                      </span>
                    ),
                  },
                  { id: "valor", titulo: "Valor", numerica: true, celula: (g) => <span className="v4-num">{reais(g.valor)}</span> },
                  { id: "vis", titulo: "Visitas", numerica: true, celula: (g) => <span className="v4-num">{g.visitas}</span> },
                  ...(podeEscrever
                    ? [
                        {
                          id: "acao",
                          titulo: "Ação",
                          celula: (g: (typeof gastos)[number]) => (
                            <IconButton
                              icon="lixeira"
                              size="sm"
                              label={`Remover gasto de ${diaCurto(g.data)}, ${reais(g.valor)}`}
                              onClick={() => despachar({ tipo: "removerGasto", gastoId: g.id }, "Gasto removido.")}
                            />
                          ),
                        },
                      ]
                    : []),
                ]}
                vazio={<p className="v4-t-meta">Nenhum gasto lançado no período.</p>}
              />
              <p className="v4-t-meta v4-res__nota">Aqui o gasto é lançado à mão. Ligado à plataforma de anúncios, ele chegaria sozinho.</p>
            </Panel>
          </div>
        </div>
      )}

      {podeEscrever && (
        <DialogGasto
          aberto={lancando}
          aoFechar={() => setLancando(false)}
          hoje={agora.slice(0, 10)}
          aoSalvar={async (f) => Boolean(await despachar({ tipo: "lancarGasto", gasto: gastoDoForm(f) }, "Gasto lançado."))}
        />
      )}
    </TelaV4>
  );
}

function Taxa({ texto }: { texto: string }) {
  return <span className={texto.endsWith("%") ? "v4-num" : "v4-t-3"}>{texto}</span>;
}

function DialogGasto({ aberto, aoFechar, hoje, aoSalvar }: { aberto: boolean; aoFechar: () => void; hoje: string; aoSalvar: (f: FormGasto) => Promise<boolean> }) {
  const { estado } = useCRM();
  const vazio: FormGasto = { funilId: estado.funis.find((f) => f.ativo)?.id ?? estado.funis[0]?.id ?? "", criativoId: "", data: hoje, valor: "", visitas: "" };
  const [f, setF] = useState<FormGasto>(vazio);
  const [erros, setErros] = useState<ErrosGasto>({});
  const [tentou, setTentou] = useState(false);
  const formId = useId();
  const criativos = estado.criativos.filter((c) => c.funilId === f.funilId);

  function mudar(n: FormGasto) {
    setF(n);
    if (tentou) setErros(validarGasto(n, hoje));
  }
  function fechar() {
    setF(vazio);
    setErros({});
    setTentou(false);
    aoFechar();
  }
  async function salvar(e?: FormEvent) {
    e?.preventDefault();
    setTentou(true);
    const v = validarGasto(f, hoje);
    setErros(v);
    if (Object.keys(v).length > 0) return;
    if (await aoSalvar(f)) fechar();
  }

  return (
    <Dialog
      open={aberto}
      onClose={fechar}
      title="Lançar gasto de mídia"
      dirty={f.valor.trim() !== "" || f.visitas.trim() !== ""}
      perda="o gasto que você preencheu"
      description="Um lançamento por dia e criativo. Serve para custo por contato e por venda."
      footer={({ fechar: cancelar }) => (
        <>
          <Button variant="secondary" onClick={cancelar}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => salvar()} busyLabel="Salvando">
            Lançar gasto
          </Button>
        </>
      )}
    >
      <form id={formId} className="v4-form" onSubmit={salvar} noValidate>
        <div className="v4-form__campos">
          <Select
            label="Funil de entrada"
            required
            value={f.funilId}
            error={erros.funilId}
            onChange={(e) => mudar({ ...f, funilId: e.target.value, criativoId: "" })}
            options={estado.funis.map((x) => ({ value: x.id, label: x.ativo ? x.nome : `${x.nome} (inativo)` }))}
          />
          <Select
            label="Criativo"
            value={f.criativoId}
            onChange={(e) => mudar({ ...f, criativoId: e.target.value })}
            options={[{ value: "", label: "Sem criativo" }, ...criativos.map((c) => ({ value: c.id, label: c.nome }))]}
            help={criativos.length === 0 ? "Este funil não tem criativo cadastrado." : "Opcional."}
          />
          <Input label="Dia" required type="date" max={hoje} value={f.data} error={erros.data} onChange={(e) => mudar({ ...f, data: e.target.value })} />
          <Input
            label="Valor gasto (R$)"
            required
            inputMode="decimal"
            placeholder="0,00"
            value={f.valor}
            error={erros.valor}
            onChange={(e) => mudar({ ...f, valor: e.target.value })}
          />
          <Input
            label="Visitas à página"
            inputMode="numeric"
            value={f.visitas}
            error={erros.visitas}
            help="Opcional. Serve para a taxa visita → contato."
            onChange={(e) => mudar({ ...f, visitas: e.target.value })}
          />
        </div>
      </form>
    </Dialog>
  );
}

/** Barras simples (SVG, sem estilo inline) com média tracejada e resumo textual ligado ao gráfico. */
function GraficoPorDia({ serie }: { serie: Array<{ dia: string; total: number }> }) {
  const id = useId();
  const resumo = resumoSerie(serie);
  const max = Math.max(...serie.map((s) => s.total), 1);
  const media = serie.reduce((a, s) => a + s.total, 0) / serie.length;
  const L = 10;
  const H = 100;
  const altura = (n: number) => (n / max) * (H - 4);
  const marcas = [serie[0], serie[Math.floor(serie.length / 2)], serie[serie.length - 1]];
  return (
    <Panel titulo="Entradas por dia">
      <figure className="v4-barras">
        <svg className="v4-barras__svg" viewBox={`0 0 ${serie.length * L} ${H}`} preserveAspectRatio="none" role="img" aria-labelledby={`${id}-r`}>
          {serie.map((s, i) => {
            const h = altura(s.total);
            return (
              <rect key={s.dia} className={["v4-barras__barra", s.total === max ? "is-max" : ""].filter(Boolean).join(" ")} x={i * L + 1.5} y={H - h} width={L - 3} height={h} rx={1}>
                <title>{`${diaCurto(s.dia)}: ${s.total}`}</title>
              </rect>
            );
          })}
          <line className="v4-barras__media" x1={0} x2={serie.length * L} y1={H - altura(media)} y2={H - altura(media)} vectorEffect="non-scaling-stroke" />
          <line className="v4-barras__base" x1={0} x2={serie.length * L} y1={H} y2={H} vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="v4-barras__eixo" aria-hidden="true">
          {marcas.map((m, i) => (
            <span key={`${m.dia}-${i}`}>{diaCurto(m.dia)}</span>
          ))}
        </div>
        <figcaption className="v4-barras__legenda v4-t-meta">
          <span id={`${id}-r`}>{resumo}</span>
          <span className="v4-barras__marca">média do período</span>
          <span>Os números de cada dia estão na tabela Por dia.</span>
        </figcaption>
      </figure>
    </Panel>
  );
}
