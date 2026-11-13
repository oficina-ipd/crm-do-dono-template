"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useCRM } from "@/components/crm/provider";
import { formatarReais } from "@/domain/rules";
import Link, { usePathname, useRouter, useSearchParams } from "@/crm-grafite/link";
import { Button, Icon, Input, Panel, SegmentedControl, Table, Tag } from "../../ui";
import { CabecalhoTela, TelaV4 } from "../base-demais/tela";
import {
  JANELAS_RESULTADOS,
  contaReversa,
  decimal,
  diasSemFechar,
  duracaoCurta,
  emAbertoPorEtapa,
  intervaloDias,
  janelaValida,
  linhasHojeMes,
  perdasPorMotivo,
  previsaoDoMes,
  rotuloJanela,
  situacaoTaxa,
  taxaTexto,
  taxasPorEtapa,
  textoJanela,
  textoSemFechar,
  validarVendasPorDia,
} from "./resultados-logica";
import "../../styles/telas/resultados.css";

/**
 * Resultados: período, unidade escrita em cada coluna e tabelas. Sem cartões de métrica e
 * sem gráfico: aqui não há série no tempo (hoje × mês × meta é comparação, não série).
 * Tudo sai do estado do CRM (movimentos, pagamentos, contatos e mensagens).
 */
export function TelaResultados() {
  const { estado, agora, operador } = useCRM();
  const router = useRouter();
  const pathname = usePathname() || "/placar";
  const sp = useSearchParams();
  const janela = janelaValida(Number(sp.get("janela") ?? 30));
  const gestor = operador?.papel === "dono";
  const robo = estado.config.nomeRobo || "Cláudio";

  const intervalo = useMemo(() => intervaloDias(janela, agora), [janela, agora]);
  const hojeMes = useMemo(() => linhasHojeMes(estado, agora, robo), [estado, agora, robo]);
  const previsao = useMemo(() => previsaoDoMes(estado, agora), [estado, agora]);
  const taxas = useMemo(() => taxasPorEtapa(estado, intervalo), [estado, intervalo]);
  const base30 = useMemo(() => (janela === 30 ? null : taxasPorEtapa(estado, intervaloDias(30, agora))), [estado, agora, janela]);
  const aberto = useMemo(() => emAbertoPorEtapa(estado, agora), [estado, agora]);
  const perdas = useMemo(() => perdasPorMotivo(estado, intervalo), [estado, intervalo]);
  const semFechar = diasSemFechar(estado, agora);

  const [alvo, setAlvo] = useState("1");
  const [alvoUsado, setAlvoUsado] = useState(1);
  const [erroAlvo, setErroAlvo] = useState<string | null>(null);
  const conta = useMemo(() => contaReversa(alvoUsado, taxas), [alvoUsado, taxas]);

  function calcular(e: FormEvent) {
    e.preventDefault();
    const erro = validarVendasPorDia(alvo);
    setErroAlvo(erro);
    if (!erro) setAlvoUsado(Number(alvo.trim().replace(",", ".")));
  }

  const totalAberto = aberto.reduce((s, l) => ({ abertas: s.abertas + l.abertas, valor: s.valor + l.valor }), { abertas: 0, valor: 0 });

  return (
    <TelaV4 area="resultados">
      <CabecalhoTela
        titulo="Resultados"
        meta={<Tag tom="neutro">{textoSemFechar(semFechar)}</Tag>}
        acoes={
          <SegmentedControl
            label="Período das taxas e das perdas"
            value={String(janela)}
            onChange={(v) => router.replace(`${pathname}?janela=${v}`)}
            options={JANELAS_RESULTADOS.map((n) => ({ value: String(n), label: rotuloJanela(n) }))}
          />
        }
      />

      <div className="v4-grade">
        <Panel titulo="Hoje e no mês" semRecuo>
          <Table
            rotulo="Hoje e no mês (quantidade de pessoas e oportunidades; receita em reais)"
            chave={(l) => l.chave}
            linhas={hojeMes}
            colunas={[
              { id: "rotulo", titulo: "Indicador", celula: (l) => l.rotulo },
              { id: "hoje", titulo: "Hoje", numerica: true, celula: (l) => <span className="v4-num">{l.reais ? formatarReais(l.hoje) : l.hoje}</span> },
              { id: "mes", titulo: "No mês", numerica: true, celula: (l) => <span className="v4-num">{l.reais ? formatarReais(l.mes) : l.mes}</span> },
            ]}
          />
          <p className="v4-t-meta v4-res__nota">
            Cada oportunidade conta uma vez por etapa. Vendas são as que chegaram em Pago; receita é a soma dos pagamentos confirmados.
          </p>
        </Panel>

        <Panel titulo="Previsão do mês">
          <div className="v4-res__previsao">
            <p className="v4-t-read">
              <span className="v4-tabular v4-t-strong">{previsao.vendasFimDoMes}</span> {previsao.vendasFimDoMes === 1 ? "venda" : "vendas"} no fim do mês, se o ritmo
              continuar.
            </p>
            <p className="v4-t-ui v4-t-2">
              {previsao.vendasAteHoje} até hoje, em {previsao.diasPassados} {previsao.diasPassados === 1 ? "dia" : "dias"} · média de {decimal(previsao.mediaVendasDia, 2)} por dia.
            </p>
            <dl className="v4-fatos">
              <dt>Receita no mês</dt>
              <dd className="v4-tabular">{formatarReais(previsao.receitaAteHoje)}</dd>
              <dt>Receita prevista</dt>
              <dd className="v4-tabular">{previsao.receitaFimDoMes == null ? "Sem receita no mês ainda" : formatarReais(previsao.receitaFimDoMes)}</dd>
              <dt>Ticket médio</dt>
              <dd className="v4-tabular">{previsao.ticketMedio == null ? "Sem pagamento no mês" : formatarReais(Math.round(previsao.ticketMedio))}</dd>
              <dt>Receita total</dt>
              <dd className="v4-tabular">{formatarReais(previsao.receitaTotal)}</dd>
            </dl>
            <p className="v4-t-meta">Conta simples: média por dia até agora vezes os {previsao.diasNoMes} dias do mês. Não considera sazonalidade nem lançamentos.</p>
          </div>
        </Panel>
      </div>

      <Panel titulo={`Taxa por etapa · ${textoJanela(janela)}`} semRecuo>
        <Table
          rotulo="Taxa por etapa, em porcentagem de quem entrou e avançou no período"
          chave={(t) => t.etapaId}
          linhas={taxas}
          colunas={[
            { id: "etapa", titulo: "Etapa", celula: (t) => `${t.de} → ${t.para}` },
            {
              id: "real",
              titulo: "Taxa no período",
              numerica: true,
              celula: (t) => {
                const s = situacaoTaxa(t.real, t.meta, t.entraram);
                return (
                  <span className={`v4-res__taxa v4-res__taxa--${s}`}>
                    {s === "abaixo" && <Icon name="alerta" label="abaixo da meta" />}
                    <span className={s === "sem" ? "v4-t-3" : "v4-num"}>{taxaTexto(t.real, t.entraram)}</span>
                  </span>
                );
              },
            },
            { id: "meta", titulo: "Meta", numerica: true, celula: (t) => <span className="v4-num">{t.meta}%</span> },
            ...(base30
              ? [
                  {
                    id: "base",
                    titulo: "Últimos 30 dias",
                    numerica: true,
                    celula: (t: (typeof taxas)[number]) => {
                      const b = base30.find((x) => x.etapaId === t.etapaId);
                      return <span className={b && b.entraram >= 10 ? "v4-num" : "v4-t-3"}>{b ? taxaTexto(b.real, b.entraram) : "—"}</span>;
                    },
                  },
                ]
              : []),
            { id: "n", titulo: "Entraram (oportunidades)", numerica: true, celula: (t) => <span className="v4-num">{t.entraram}</span> },
            { id: "a", titulo: "Avançaram", numerica: true, celula: (t) => <span className="v4-num">{t.avancaram}</span> },
          ]}
        />
        <p className="v4-t-meta v4-res__nota">
          De quem entrou na etapa no período, quantos chegaram a uma etapa seguinte. Com menos de 10 entradas, a taxa aparece como amostra pequena, sem
          percentual.{" "}
          {gestor ? (
            <Link className="v4-link" href="/config/metas">
              Ver as metas por etapa
            </Link>
          ) : (
            "As metas por etapa são definidas pelo dono."
          )}
        </p>
      </Panel>

      <div className="v4-grade">
        <Panel titulo="Conta reversa">
          <form className="v4-res__conta" onSubmit={calcular} noValidate>
            <Input
              label="Vendas por dia que você quer"
              inputMode="decimal"
              value={alvo}
              error={erroAlvo ?? undefined}
              help={erroAlvo ? undefined : "De 0,1 a 100."}
              onChange={(e) => {
                setAlvo(e.target.value);
                if (erroAlvo) setErroAlvo(null);
              }}
            />
            <Button type="submit" variant="secondary">
              Calcular
            </Button>
          </form>
          <p className="v4-t-ui v4-t-2">
            Para {decimal(alvoUsado, 2)} {alvoUsado === 1 ? "venda" : "vendas"} por dia, com as taxas de {textoJanela(janela)}, precisam entrar por dia:
          </p>
          {conta.passos.length > 0 && (
            <Table
              rotulo="Oportunidades por dia em cada etapa"
              chave={(p) => p.etapaId}
              linhas={conta.passos}
              colunas={[
                { id: "nome", titulo: "Etapa", celula: (p) => p.nome },
                { id: "dia", titulo: "Oportunidades por dia", numerica: true, celula: (p) => <span className="v4-num">{decimal(p.porDia)}</span> },
              ]}
            />
          )}
          {conta.bloqueadaEm && (
            <p className="v4-t-meta">
              {conta.passos.length === 0 ? "A conta não começa" : "A conta para"} em {conta.bloqueadaEm}: ainda não há amostra suficiente nessa taxa (menos de 10
              entradas no período). {janela < 30 ? "Tente um período maior." : "Ela aparece quando o funil tiver mais movimento."}
            </p>
          )}
        </Panel>

        <Panel titulo="Em aberto por etapa" semRecuo>
          <Table
            rotulo="Oportunidades abertas por etapa: quantidade, valor em reais e tempo médio parado"
            chave={(l) => l.etapaId}
            linhas={[...aberto, { etapaId: "perdido" as const, nome: "Total", abertas: totalAberto.abertas, valor: totalAberto.valor, mediaMin: null, prazoMin: 0 }]}
            colunas={[
              { id: "nome", titulo: "Etapa", celula: (l) => <span className={l.nome === "Total" ? "v4-total" : undefined}>{l.nome}</span> },
              { id: "n", titulo: "Abertas", numerica: true, celula: (l) => <span className="v4-num">{l.abertas}</span> },
              { id: "v", titulo: "Valor", numerica: true, celula: (l) => <span className="v4-num">{formatarReais(l.valor)}</span> },
              {
                id: "t",
                titulo: "Parado há (média)",
                numerica: true,
                celula: (l) =>
                  l.mediaMin == null ? (
                    <span className="v4-t-3">—</span>
                  ) : (
                    <span className={["v4-res__taxa", l.prazoMin > 0 && l.mediaMin > l.prazoMin ? "v4-res__taxa--abaixo" : ""].filter(Boolean).join(" ")}>
                      {l.prazoMin > 0 && l.mediaMin > l.prazoMin && <Icon name="relogio" label="acima do prazo da etapa" />}
                      <span className="v4-tabular">{duracaoCurta(l.mediaMin)}</span>
                    </span>
                  ),
              },
            ]}
          />
        </Panel>

        <Panel titulo={`Motivos de perda · ${textoJanela(janela)}`} semRecuo>
          <Table
            rotulo="Perdas por motivo no período"
            chave={(p) => p.motivo}
            linhas={perdas}
            colunas={[
              { id: "motivo", titulo: "Motivo", quebrar: true, celula: (p) => p.motivo },
              { id: "total", titulo: "Perdas", numerica: true, celula: (p) => <span className="v4-num">{p.total}</span> },
            ]}
            vazio={<p className="v4-t-meta">Nenhuma perda registrada no período.</p>}
          />
        </Panel>
      </div>
    </TelaV4>
  );
}
