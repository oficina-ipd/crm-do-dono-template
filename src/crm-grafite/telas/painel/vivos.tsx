"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { ButtonLink, Icon, SegmentedControl, iniciaisV4 } from "../../ui";
import {
  DESTINOS,
  alturaDaBarra,
  diaMes,
  duracaoDeMinutos,
  esperaViva,
  hrefConversa,
  inteiro,
  legendaDoDia,
  lerGrafico,
  marcasDoEixo,
  plural,
  reais,
  valorDaMetrica,
  type Abertura,
  type MetricaDoGrafico,
  type Precisa,
  type SerieDoGrafico,
} from "./logica";
import { Cartao, LinkNumero, Selo, Variacao, Vazio } from "./partes";

/**
 * Cartões do Painel que respondem ao ponteiro ou andam sozinhos: abertura (valor que acompanha a
 * mudança e barras com o dia sob o ponteiro), gráfico do mês (métrica e dia) e a pilha de quem
 * espera (relógio da espera). Movimento só com movimento permitido; sem ele tudo aparece pronto.
 * Nada aqui é inventado: o que anda sozinho é só o tempo de espera, contado da hora real do pedido.
 */

/** true se o sistema não pede movimento reduzido (na primeira pintura: false). */
export function useMovimento(): boolean {
  const [pode, setPode] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: no-preference)");
    const ler = () => setPode(mq.matches);
    ler();
    mq.addEventListener("change", ler);
    return () => mq.removeEventListener("change", ler);
  }, []);
  return pode;
}

/**
 * Número que acompanha o valor. Aparece já no valor certo (nada de contar a partir do zero ao
 * abrir a tela); quando o valor muda, anda do que está na tela até o novo (1,3 s). Sem movimento
 * permitido, troca direto.
 */
export function Contagem({ valor, formatar }: { valor: number; formatar: (v: number) => string }) {
  const pode = useMovimento();
  const [visto, setVisto] = useState(valor);
  const atual = useRef(valor);
  useEffect(() => {
    const de = atual.current;
    if (!pode || de === valor) {
      atual.current = valor;
      setVisto(valor);
      return;
    }
    const t0 = performance.now();
    let quadro = 0;
    const passo = (agora: number) => {
      const p = Math.min(1, (agora - t0) / 1300);
      const v = p >= 1 ? valor : de + (valor - de) * (1 - Math.pow(1 - p, 4));
      atual.current = v;
      setVisto(v);
      if (p < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [pode, valor]);
  // o leitor de tela recebe o valor final, não a contagem
  return (
    <>
      <span aria-hidden="true">{formatar(visto === valor ? valor : Math.round(visto))}</span>
      <span className="v4-sr">{formatar(valor)}</span>
    </>
  );
}

/** Índice (0 a n−1) sob o ponteiro, pela posição horizontal dentro do elemento. */
function indiceSobOPonteiro(e: PointerEvent<Element>, n: number): number {
  const r = e.currentTarget.getBoundingClientRect();
  return Math.max(0, Math.min(n - 1, Math.floor(((e.clientX - r.left) / Math.max(1, r.width)) * n)));
}

// ───────── Abertura ─────────

export function AberturaVista({ a }: { a: Abertura }) {
  const [sob, setSob] = useState<number | null>(null);
  const dias = a.dias;
  const max = Math.max(...dias.map((d) => d.conversas), 1);
  const total = dias.reduce((s, d) => s + d.conversas, 0);
  const comVenda = dias.filter((d) => d.vendas > 0).length;
  const L = 10;
  return (
    <Cartao id="abertura" titulo="Resumo do mês" semTitulo>
      <div className="v4-pn-abre__topo">
        <div>
          <p className="v4-pn-abre__oi">
            {a.saudacao}
            {a.nome && (
              <>
                , <span>{a.nome}</span>
              </>
            )}
          </p>
          <p className="v4-pn-abre__sub">{a.resumo}</p>
        </div>
        <div className="v4-pn-abre__valor">
          <p className="v4-pn-abre__rotulo">{a.valor.rotulo}</p>
          <p className="v4-pn-abre__num">
            <LinkNumero href={a.valor.href} seta={false}>
              <Contagem valor={a.valor.numero} formatar={reais} />
            </LinkNumero>
          </p>
          <Variacao v={a.valor.variacao} />
        </div>
      </div>
      {dias.length > 0 && (
        <>
          <svg
            className="v4-pn-abre__barras"
            viewBox={`0 0 ${dias.length * L} 100`}
            preserveAspectRatio="none"
            role="img"
            aria-label={`Conversas novas por dia nos últimos ${dias.length} dias: ${plural(total, "conversa nova", "conversas novas")}; ${plural(comVenda, "dia com venda", "dias com venda")}.`}
            onPointerMove={(e) => setSob(indiceSobOPonteiro(e, dias.length))}
            onPointerLeave={() => setSob(null)}
          >
            {dias.map((d, i) => {
              const h = alturaDaBarra(d.conversas, max);
              const classes = ["v4-pn-abre__barra", d.vendas > 0 ? "is-venda" : "", sob != null && sob !== i ? "is-apagada" : ""].filter(Boolean).join(" ");
              // dia sem venda: mais apagado quanto menos conversas (o verde dos dias com venda fica cheio)
              const opacidade = d.vendas > 0 ? 1 : 0.32 + (d.conversas / max) * 0.5;
              return <rect key={d.dia} className={classes} x={i * L + 1.5} y={100 - h} width={L - 3} height={h} rx={1.5} ry={3} fillOpacity={opacidade} />;
            })}
          </svg>
          <div className="v4-pn-eixo">
            <span>{diaMes(dias[0].dia)}</span>
            <span className="v4-pn-eixo__meio">{sob != null ? legendaDoDia(dias[sob]) : "Conversas novas por dia · verde = dia com venda"}</span>
            <span>Hoje</span>
          </div>
        </>
      )}
    </Cartao>
  );
}

// ───────── Gráfico do mês: realizado acumulado e projeção pelo ritmo ─────────

const W = 640;
const H = 230;

export function GraficoVista({ series, diasNoMes, mes, href }: { series: SerieDoGrafico[]; diasNoMes: number; /** "nov" */ mes: string; href: string }) {
  const [metrica, setMetrica] = useState<MetricaDoGrafico>(series[0].chave);
  const [sob, setSob] = useState<number | null>(null);
  const s = series.find((x) => x.chave === metrica) ?? series[0];
  const hoje = s.acumulado.length - 1;
  const dia = sob ?? hoje;
  const l = lerGrafico(s, dia, diasNoMes);
  const noFim = lerGrafico(s, hoje, diasNoMes);
  const teto = Math.max(noFim.projecao, noFim.realizado) * 1.08 || 1;
  const x = (d: number) => (d / diasNoMes) * W;
  const y = (v: number) => H - 14 - (v / teto) * (H - 34);
  const linha = s.acumulado.map((v, d) => `${d ? "L" : "M"}${x(d).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const marcas = marcasDoEixo(diasNoMes);
  const vazio = noFim.realizado === 0;
  return (
    <Cartao
      id="grafico"
      titulo={s.titulo}
      lado={
        <SegmentedControl
          label="Métrica do gráfico"
          value={metrica}
          onChange={(v) => {
            setMetrica(v as MetricaDoGrafico);
            setSob(null);
          }}
          options={series.map((x) => ({ value: x.chave, label: x.rotulo }))}
        />
      }
    >
      <div className="v4-pn-grafico__leg">
        <div>
          <p className="v4-pn-grafico__chave">
            <svg viewBox="0 0 16 4" aria-hidden="true" focusable="false">
              <line className="v4-pn-grafico__linha" x1={1} x2={15} y1={2} y2={2} />
            </svg>
            Realizado até {dia} {mes}
          </p>
          <p className="v4-pn-fig">
            <LinkNumero href={href} seta={false}>
              {valorDaMetrica(s.chave, l.realizado)}
            </LinkNumero>
          </p>
        </div>
        <div>
          <p className="v4-pn-grafico__chave">
            <svg viewBox="0 0 16 4" aria-hidden="true" focusable="false">
              <line className="v4-pn-grafico__proj" x1={1} x2={15} y1={2} y2={2} />
            </svg>
            No ritmo de hoje, até {diasNoMes} {mes}
          </p>
          <p className={vazio ? "v4-pn-fig is-2 is-semdado" : "v4-pn-fig is-2"}>{vazio ? "sem dado ainda" : valorDaMetrica(s.chave, noFim.projecao)}</p>
        </div>
      </div>
      <div
        className="v4-pn-grafico__plot"
        role="img"
        aria-label={`${s.titulo}: ${valorDaMetrica(s.chave, noFim.realizado)} até o dia ${hoje}${vazio ? "" : `; no ritmo atual, ${valorDaMetrica(s.chave, noFim.projecao)} no fim do mês`}.`}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const d = Math.round(((e.clientX - r.left) / Math.max(1, r.width)) * diasNoMes);
          setSob(Math.max(1, Math.min(hoje, d)));
        }}
        onPointerLeave={() => setSob(null)}
      >
        <svg className="v4-pn-grafico__svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="v4-pn-grafico-area" x1="0" x2="0" y1="0" y2="1">
              <stop className="v4-pn-grafico__stop-1" offset="0" />
              <stop className="v4-pn-grafico__stop-2" offset="1" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} className="v4-pn-grafico__grade" x1={0} x2={W} y1={H * f} y2={H * f} vectorEffect="non-scaling-stroke" />
          ))}
          <line className="v4-pn-grafico__hoje" x1={x(hoje)} x2={x(hoje)} y1={10} y2={H - 14} vectorEffect="non-scaling-stroke" />
          <path className="v4-pn-grafico__area" d={`${linha} L ${x(hoje)} ${H - 14} L 0 ${H - 14} Z`} />
          {!vazio && <path className="v4-pn-grafico__proj" d={`M ${x(hoje)} ${y(noFim.realizado)} L ${W} ${y(noFim.projecao)}`} vectorEffect="non-scaling-stroke" />}
          <path key={s.chave} className="v4-pn-grafico__linha is-desenha" d={linha} vectorEffect="non-scaling-stroke" pathLength={1} strokeDasharray={1} strokeDashoffset={0} />
          {sob != null && <line className="v4-pn-grafico__cruz" x1={x(dia)} x2={x(dia)} y1={0} y2={H} vectorEffect="non-scaling-stroke" />}
          <line className="v4-pn-grafico__ponto" x1={x(dia)} x2={x(dia)} y1={y(l.realizado)} y2={y(l.realizado)} vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="v4-pn-grafico__eixo" aria-hidden="true">
        {marcas.map((d, i) => (
          <span key={i}>{i === 0 || i === marcas.length - 1 ? `${d} ${mes}` : d}</span>
        ))}
      </div>
    </Cartao>
  );
}

// ───────── Precisa de você: quem espera uma pessoa ─────────

export function PrecisaVista({ p, agoraIso, nomeRobo }: { p: Precisa; agoraIso: string; nomeRobo: string }) {
  const pode = useMovimento();
  // a pessoa da frente; por padrão, a que espera há mais tempo
  const [frenteId, setFrenteId] = useState<string | null>(null);
  const [agora, setAgora] = useState(() => new Date(agoraIso));
  useEffect(() => {
    // o relógio parte do "agora" do CRM e anda: por segundo com movimento permitido, por meio minuto sem
    const inicio = Date.now();
    const base = new Date(agoraIso).getTime();
    setAgora(new Date(base));
    const t = window.setInterval(() => setAgora(new Date(base + (Date.now() - inicio))), pode ? 1000 : 30_000);
    return () => window.clearInterval(t);
  }, [agoraIso, pode]);

  const pessoas = p.pessoas;
  const frente = pessoas.find((x) => x.id === frenteId) ?? pessoas[0];
  // a da frente é a última da pilha (fica por cima); as outras mantêm a ordem
  const ordem = frente ? [...pessoas.filter((x) => x.id !== frente.id).reverse(), frente] : [];
  const todasTarefas = p.tarefas.atrasadas + p.tarefas.paraHoje;
  const tambem = (
    <ul className="v4-pn-tambem">
      {p.total > pessoas.length && (
        <li>
          <LinkNumero href={DESTINOS.fila}>
            <b>+{inteiro(p.total - pessoas.length)}</b> esperando na Fila
          </LinkNumero>
        </li>
      )}
      <li>
        <LinkNumero href={DESTINOS.tarefas}>
          <b>{inteiro(todasTarefas)}</b> {todasTarefas === 1 ? "tarefa para hoje" : "tarefas para hoje"}
          {p.tarefas.atrasadas > 0 && <span className="is-alerta"> · {plural(p.tarefas.atrasadas, "atrasada", "atrasadas")}</span>}
        </LinkNumero>
      </li>
      <li>
        <LinkNumero href={DESTINOS.fila}>
          <b>{inteiro(p.paradas.total)}</b> {p.paradas.total === 1 ? "parada no funil" : "paradas no funil"}
          {p.paradas.maiorEsperaMin != null && ` · há até ${duracaoDeMinutos(p.paradas.maiorEsperaMin).split(" ").slice(0, 2).join(" ")}`}
        </LinkNumero>
      </li>
    </ul>
  );

  if (!frente) {
    return (
      <Cartao id="precisa" titulo="Precisa de você" lado={<Selo>em dia</Selo>}>
        <div className="v4-pn-precisa__nada">
          <Vazio>Ninguém esperando uma pessoa agora. Quando {nomeRobo} passar uma conversa, ela aparece aqui.</Vazio>
          <ButtonLink href={DESTINOS.fila} variant="secondary" size="sm" icon="fila">
            Abrir a Fila
          </ButtonLink>
        </div>
        {tambem}
      </Cartao>
    );
  }

  const cor = (id: string) => (pessoas.findIndex((x) => x.id === id) % 3) + 1;
  return (
    <Cartao id="precisa" titulo="Precisa de você" contagem={p.total} lado={<Selo ponto="espera">esperando</Selo>}>
      <div className="v4-pn-pilha" data-n={ordem.length}>
        {ordem.map((x, pos) => {
          const atras = ordem.length - 1 - pos;
          return (
            <button
              key={x.id}
              type="button"
              className={["v4-pn-espera", `v4-pn-espera--${cor(x.id)}`, `is-pos-${pos}`, atras ? `is-atras-${atras}` : "is-frente"].join(" ")}
              aria-pressed={atras === 0}
              aria-label={atras ? `${x.nome}: trazer para a frente` : `${x.nome}, na frente`}
              onClick={() => setFrenteId(x.id)}
            >
              <span className="v4-pn-espera__linha">
                <span className="v4-avatar" aria-hidden="true">
                  {iniciaisV4(x.nome)}
                </span>
                <span className="v4-pn-espera__quem">
                  <span className="v4-pn-espera__nome">{x.nome}</span>
                  {atras === 0 && x.empresa && <span className="v4-pn-espera__empresa">{x.empresa}</span>}
                </span>
                <Icon name="conversas" size="sm" />
              </span>
            </button>
          );
        })}
      </div>
      <div className="v4-pn-frente" aria-live="polite">
        <p className={frente.motivo ? "v4-pn-frente__motivo" : "v4-pn-frente__motivo is-vazio"}>{frente.motivo ? `“${frente.motivo}”` : `${nomeRobo} não registrou o motivo do pedido.`}</p>
        <div className="v4-pn-frente__linha">
          <span className="v4-pn-frente__espera">
            esperando há <b>{esperaViva(frente.desde, agora, pode)}</b>
          </span>
          <ButtonLink href={hrefConversa(frente.id)} variant="primary" size="sm">
            Abrir conversa
          </ButtonLink>
        </div>
      </div>
      {tambem}
    </Cartao>
  );
}
