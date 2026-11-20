"use client";

import Link from "@/crm-grafite/link";
import { Icon } from "../../ui";
import {
  DESTINOS,
  alturaDaBarra,
  decimal,
  diasQueRestam,
  duracaoDeSegundos,
  etapasComMovimento,
  faixaDeResposta,
  hrefOrigem,
  hrefResultados,
  inteiro,
  noAnterior,
  periodoCurto,
  plural,
  reais,
  segmentosDeOrigem,
  textoVariacao,
  variacao,
  type ConversasHoje,
  type JanelaPainel,
  type LinhaDaAtividade,
  type PainelEmails,
  type PainelFunil,
  type PainelOrigem,
  type PainelRobo,
  type VendasDoMes,
} from "./logica";
import { Atalho, Cartao, LinkNumero, Selo, Variacao, Vazio } from "./partes";

/**
 * Os cartões do Painel que só mostram. Recebem o modelo pronto (logica.ts). Número sem base
 * aparece como "sem dado ainda", nunca zero; cada número com tela própria leva a ela.
 */

// ───────── Robô (Cláudio): mostrador do tempo de primeira resposta ─────────

export function RoboVista({ d, j, nomeRobo }: { d: PainelRobo; j: JanelaPainel; nomeRobo: string }) {
  const lado = <Selo>{periodoCurto(j)}</Selo>;
  if (d.conversas === 0 && d.pedidos === 0) {
    return (
      <Cartao id="claudio" titulo={nomeRobo} lado={lado}>
        <Vazio>
          {nomeRobo} não atendeu ninguém {j.descricao}. As conversas dele aparecem aqui.
        </Vazio>
      </Cartao>
    );
  }
  const r = d.primeiraResposta;
  const f = r.medianaSeg != null ? faixaDeResposta(r.medianaSeg) : null;
  return (
    <Cartao id="claudio" titulo={nomeRobo} lado={lado}>
      <div className="v4-pn-mostrador">
        <svg className="v4-pn-mostrador__svg" viewBox="0 0 150 86" aria-hidden="true" focusable="false">
          <path className="v4-pn-mostrador__trilho" d="M 13 78 A 62 62 0 0 1 137 78" />
          {f && f.fracao > 0 && <path className={`v4-pn-mostrador__arco is-${f.tom}`} d="M 13 78 A 62 62 0 0 1 137 78" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - f.fracao} />}
          {f && (
            // agulha desenhada apontando para a esquerda e girada até o valor (atributo do SVG); o CSS
            // só anima a chegada desde a primeira pintura, com movimento permitido
            <g className="v4-pn-mostrador__ponteiro" transform={`rotate(${Math.round(f.fracao * 1800) / 10})`}>
              <line className="v4-pn-mostrador__agulha" x1={75} y1={78} x2={27} y2={78} />
            </g>
          )}
          <circle className="v4-pn-mostrador__eixo" cx={75} cy={78} r={5} />
        </svg>
        {r.medianaSeg != null && f ? (
          <>
            <p className="v4-pn-mostrador__valor">{duracaoDeSegundos(r.medianaSeg)}</p>
            <p className="v4-pn-apoio">
              1ª resposta, mediana · {f.rotulo}
              {r.anteriorMedianaSeg != null ? ` · ${duracaoDeSegundos(r.anteriorMedianaSeg)} ${noAnterior(j)}` : ""}
            </p>
          </>
        ) : (
          <>
            <p className="v4-pn-mostrador__valor is-semdado">sem dado ainda</p>
            <p className="v4-pn-apoio">1ª resposta: nenhuma a medir {j.descricao}</p>
          </>
        )}
      </div>
      <dl className="v4-pn-trio">
        <div>
          <dt>Atendidas</dt>
          <dd>
            <LinkNumero href={DESTINOS.conversasRobo} seta={false}>
              {inteiro(d.conversas)}
            </LinkNumero>
          </dd>
        </div>
        <div>
          <dt>Pedidos</dt>
          <dd>
            <LinkNumero href={DESTINOS.conversasPrecisa} seta={false}>
              {inteiro(d.pedidos)}
            </LinkNumero>
            {d.pedidos > 0 && <small>{plural(d.pessoas, "pessoa", "pessoas")}</small>}
          </dd>
        </div>
        <div>
          <dt>Avançaram</dt>
          <dd>
            <LinkNumero href={DESTINOS.funil} seta={false}>
              {inteiro(d.avancaram)}
            </LinkNumero>
          </dd>
        </div>
      </dl>
      <Variacao className="v4-pn-claudio__nota v4-pn-var--2" v={textoVariacao(variacao(d.conversas, d.conversasAnterior), noAnterior(j))} />
      <p className="v4-pn-apoio is-3">
        {inteiro(d.responderam)} de {plural(d.conversas, "contato respondeu", "contatos responderam")} {j.descricao}.
      </p>
    </Cartao>
  );
}

// ───────── Origem dos leads: barra empilhada ─────────

export function OrigemVista({ d, j }: { d: PainelOrigem; j: JanelaPainel }) {
  const titulo = `Origem dos leads · ${periodoCurto(j)}`;
  const href = hrefOrigem(j.periodo);
  if (d.total === 0) {
    return (
      <Cartao id="origem" titulo={titulo}>
        <Vazio>
          Nenhum contato novo {j.descricao}
          {d.totalAnterior > 0 ? ` (${d.totalAnterior === 1 ? "era" : "eram"} ${inteiro(d.totalAnterior)} ${noAnterior(j)})` : ""}. Quando entrar gente por um funil de entrada, a origem aparece aqui.
        </Vazio>
      </Cartao>
    );
  }
  const partes = segmentosDeOrigem(d.origens, d.total);
  const folga = partes.length > 1 ? 0.8 : 0;
  return (
    <Cartao id="origem" titulo={titulo} lado={<Atalho href={href}>Ver origem</Atalho>}>
      <p className="v4-pn-fig">
        <LinkNumero href={href} seta={false}>
          {inteiro(d.total)}
        </LinkNumero>
        <small>{d.total === 1 ? "contato novo" : "contatos novos"}</small>
      </p>
      <Variacao className="v4-pn-origem__var v4-pn-var--2" v={textoVariacao(variacao(d.total, d.totalAnterior), noAnterior(j))} />
      <svg className="v4-pn-partes" viewBox="0 0 100 12" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        {partes.map((p, i) => (
          <rect key={p.chave} className={`v4-pn-partes__parte v4-pn-cor-${i + 1}`} x={p.inicio} y={0} width={Math.max(0.6, p.largura - folga)} height={12} rx={1} ry={4} />
        ))}
      </svg>
      <ul className="v4-pn-origens">
        {partes.map((p, i) => (
          <li key={p.chave}>
            <span className="v4-pn-origens__nome">
              <i className={`v4-pn-cor-${i + 1}`} aria-hidden="true" />
              {p.rotulo}
            </span>
            <b>{p.pct}</b>
          </li>
        ))}
      </ul>
    </Cartao>
  );
}

// ───────── E-mails: só o envio (o template não mede entrega, abertura nem clique) ─────────

export function EmailsVista({ d, j }: { d: PainelEmails; j: JanelaPainel }) {
  const titulo = `E-mails · ${periodoCurto(j)}`;
  const selo = <Selo>sem medição</Selo>;
  if (d.enviados === 0) {
    return (
      <Cartao id="emails" titulo={titulo} lado={selo}>
        <Vazio>
          Nenhum e-mail enviado pelo CRM {j.descricao}
          {d.enviadosAnterior > 0 ? ` (${d.enviadosAnterior === 1 ? "foi 1" : `foram ${inteiro(d.enviadosAnterior)}`} ${noAnterior(j)})` : ""}. Os e-mails escritos na ficha de cada pessoa aparecem aqui.
        </Vazio>
      </Cartao>
    );
  }
  return (
    <Cartao id="emails" titulo={titulo} lado={selo}>
      <p className="v4-pn-fig">
        {inteiro(d.enviados)}
        <small>{d.enviados === 1 ? "enviado" : "enviados"}</small>
      </p>
      <Variacao className="v4-pn-origem__var v4-pn-var--2" v={textoVariacao(variacao(d.enviados, d.enviadosAnterior), noAnterior(j))} />
      <div className="v4-pn-pe">
        <p className="v4-pn-apoio">Por quem enviou: {d.porQuem.map((q) => `${q.nome} ${inteiro(q.total)}`).join(" · ")}.</p>
        <p className="v4-pn-apoio is-3">Entrega, abertura e clique: sem medição. O CRM registra o envio, não o que acontece depois.</p>
      </div>
    </Cartao>
  );
}

// ───────── Vendas do mês: o cartão no verde da marca (sem meta: o template não tem) ─────────

export function MesVista({ d }: { d: VendasDoMes }) {
  const ultimos = d.porDia.slice(-10);
  const maxDia = Math.max(...ultimos.map((x) => x.vendas), 1);
  const L = 100 / Math.max(1, ultimos.length);
  const comVenda = ultimos.filter((x) => x.vendas > 0).length;
  return (
    <Cartao
      id="mes"
      titulo={`Vendas em ${d.mes}`}
      lado={
        <span className="v4-pn-meta__selo">
          dia {d.dia} de {d.diasNoMes}
        </span>
      }
    >
      <div className="v4-pn-meta">
        <p className="v4-pn-meta__grande">
          <LinkNumero href={DESTINOS.resultados} seta={false}>
            {inteiro(d.vendas)}
          </LinkNumero>
          <span> {d.vendas === 1 ? "venda" : "vendas"}</span>
        </p>
        <p className="v4-pn-meta__frase">
          {d.vendas === 0
            ? `Nenhuma venda em ${d.mes} ainda · ${diasQueRestam(d.dia, d.diasNoMes)}.`
            : `${d.vendasHoje === 0 ? "nenhuma hoje" : `${inteiro(d.vendasHoje)} hoje`} · ritmo de ${decimal(d.ritmo)} por dia · ${diasQueRestam(d.dia, d.diasNoMes)}`}
        </p>
        <Variacao className="v4-pn-meta__var v4-pn-var--2" v={textoVariacao(variacao(d.vendas, d.vendasMesAnterior), d.noMesAnterior, inteiro, "nenhuma")} />
        <dl className="v4-pn-trio">
          <div>
            <dt>Receita</dt>
            <dd>
              {reais(d.receita)}
              {d.projecaoReceita != null && <small>{reais(d.projecaoReceita)} no ritmo</small>}
            </dd>
          </div>
          <div>
            <dt>Ticket médio</dt>
            {d.ticket != null ? <dd>{reais(Math.round(d.ticket))}</dd> : <dd className="is-semdado">sem venda paga</dd>}
          </div>
          <div>
            <dt>Até {d.ultimoDia}</dt>
            {d.vendas > 0 ? <dd>{plural(d.projecaoVendas, "venda", "vendas")}</dd> : <dd className="is-semdado">sem dado ainda</dd>}
          </div>
        </dl>
      </div>
      <div className="v4-pn-meta__pe">
        {ultimos.length >= 3 && (
          <>
            <svg className="v4-pn-meta__dias" viewBox="0 0 100 52" preserveAspectRatio="none" aria-hidden="true" focusable="false">
              {ultimos.map((x, i) => {
                const h = (alturaDaBarra(x.vendas, maxDia, 40) / 100) * 52;
                return <rect key={x.dia} className={x.vendas > 0 ? "v4-pn-meta__dia is-venda" : "v4-pn-meta__dia"} x={i * L + 0.6} y={52 - h} width={L - 1.2} height={h} rx={0.8} ry={3} />;
              })}
            </svg>
            <p className="v4-pn-meta__cap">
              Últimos {ultimos.length} dias · cheio = dia com venda ({plural(comVenda, "dia", "dias")})
            </p>
          </>
        )}
        <Link className="v4-pn-meta__botao" href={DESTINOS.resultados}>
          Ver resultados
        </Link>
      </div>
    </Cartao>
  );
}

// ───────── Atividade recente ─────────

export function AtividadeVista({ linhas }: { linhas: LinhaDaAtividade[] }) {
  return (
    <Cartao id="atividade" titulo="Atividade recente" lado={<Selo>vendas, pedidos e contatos novos</Selo>}>
      {linhas.length === 0 ? (
        <Vazio>Nada aconteceu ainda. Vendas, pedidos de uma pessoa e contatos novos aparecem aqui, com a hora.</Vazio>
      ) : (
        <ul className="v4-pn-ativ">
          {linhas.map((l) => (
            <li key={l.id}>
              <Link href={l.href} className="v4-pn-ativ__alvo">
                <span className="v4-pn-ativ__icone" aria-hidden="true">
                  <Icon name={l.icone} size="sm" />
                </span>
                <span className="v4-pn-ativ__texto">
                  <span className="v4-pn-ativ__titulo">{l.titulo}</span>
                  <span className="v4-pn-ativ__detalhe">{l.detalhe}</span>
                </span>
                <span className="v4-pn-ativ__lado">
                  {l.valor && <span className="v4-pn-ativ__valor">{l.valor}</span>}
                  <span className={l.estado.tom === "neutro" ? "v4-pn-ativ__estado" : `v4-pn-ativ__estado is-${l.estado.tom}`}>{l.estado.texto}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Cartao>
  );
}

// ───────── Conversas hoje ─────────

export function ConversasHojeVista({ h }: { h: ConversasHoje }) {
  const max = Math.max(...h.porHora, 1);
  const L = 4;
  return (
    <Cartao id="conversas" titulo="Conversas hoje" lado={<Atalho href={DESTINOS.conversas}>Conversas</Atalho>}>
      <p className="v4-pn-fig">
        {inteiro(h.mensagens)}
        <small>{h.mensagens === 1 ? "mensagem" : "mensagens"}</small>
      </p>
      {h.mensagens > 0 ? (
        <svg
          className="v4-pn-horas"
          viewBox={`0 0 ${24 * L} 64`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`Mensagens por hora hoje, da 0h às ${h.porHora.length - 1}h: ${h.porHora.map((n, i) => `${i}h ${n}`).join(", ")}.`}
        >
          {h.porHora.map((n, i) => {
            const alt = (alturaDaBarra(n, max, 10) / 100) * 64;
            return <rect key={i} className={i === h.porHora.length - 1 ? "v4-pn-horas__barra is-agora" : "v4-pn-horas__barra"} x={i * L + 0.5} y={64 - alt} width={L - 1} height={alt} rx={0.5} ry={2} />;
          })}
        </svg>
      ) : (
        <p className="v4-pn-apoio">Nenhuma mensagem hoje ainda. A barra de cada hora aparece quando a primeira chegar.</p>
      )}
      {h.mensagens > 0 && <p className="v4-pn-apoio is-3">Por hora, da 0h até agora · a última barra é a hora atual</p>}
      <dl className="v4-pn-trio v4-pn-trio--2">
        <div>
          <dt>Conversas novas</dt>
          <dd>{inteiro(h.novas)}</dd>
        </div>
        <div>
          <dt>Escreveram hoje</dt>
          <dd>{inteiro(h.escreveram)}</dd>
        </div>
      </dl>
    </Cartao>
  );
}

// ───────── Funil (linha inteira): entradas, avanço por etapa, paradas ─────────

export function FunilVista({ d, j }: { d: PainelFunil; j: JanelaPainel }) {
  const titulo = `Funil · ${periodoCurto(j)}`;
  const lado = <Atalho href={DESTINOS.funil}>Abrir funil</Atalho>;
  const { visiveis, semMovimento } = etapasComMovimento(d.etapas);
  if (d.entradas === 0 && visiveis.length === 0 && d.perdidas === 0) {
    return (
      <Cartao id="funil" titulo={titulo} lado={lado}>
        <Vazio>Nenhuma oportunidade no funil {j.descricao}. Quando a primeira entrar, as etapas aparecem aqui.</Vazio>
      </Cartao>
    );
  }
  const eram = (n: number) => (n === 0 ? "nenhuma antes" : `${n === 1 ? "era" : "eram"} ${inteiro(n)} antes`);
  return (
    <Cartao id="funil" titulo={titulo} lado={lado}>
      <div className="v4-pn-funil">
        <div>
          <p className="v4-pn-fig">
            <LinkNumero href={DESTINOS.funil} seta={false}>
              {inteiro(d.entradas)}
            </LinkNumero>
            <small>{d.entradas === 1 ? "oportunidade nova" : "oportunidades novas"}</small>
          </p>
          <Variacao className="v4-pn-origem__var" v={textoVariacao(variacao(d.entradas, d.entradasAnterior), noAnterior(j), inteiro, "nenhuma")} />
          <dl className="v4-pn-trio">
            <div>
              <dt>Avançaram</dt>
              <dd>
                {inteiro(d.avancaram)}
                <small>{eram(d.avancaramAnterior)}</small>
              </dd>
            </div>
            <div>
              <dt>Perdidas</dt>
              <dd>
                <LinkNumero href={hrefResultados(j.periodo)} seta={false}>
                  {inteiro(d.perdidas)}
                </LinkNumero>
                <small>{eram(d.perdidasAnterior)}</small>
              </dd>
            </div>
            <div>
              <dt>Paradas agora</dt>
              <dd>
                <LinkNumero href={DESTINOS.fila} seta={false}>
                  {inteiro(d.paradas)}
                </LinkNumero>
                <small>de {plural(d.emAndamento, "em andamento", "em andamento")}</small>
              </dd>
            </div>
          </dl>
        </div>
        <div>
          {visiveis.length > 0 && (
            <table className="v4-pn-tabela">
              <caption className="v4-sr">Por etapa: oportunidades na etapa agora, entraram e avançaram no período, paradas agora</caption>
              <thead>
                <tr>
                  <th scope="col">Etapa</th>
                  <th scope="col">Na etapa</th>
                  <th scope="col">Entraram</th>
                  <th scope="col">Avançaram</th>
                  <th scope="col">Paradas</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((e) => (
                  <tr key={e.id}>
                    <th scope="row">{e.nome}</th>
                    <td>{inteiro(e.naEtapa)}</td>
                    <td>{inteiro(e.entraram)}</td>
                    <td>{inteiro(e.avancaram)}</td>
                    <td>{inteiro(e.paradas)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {semMovimento > 0 && (
            <p className="v4-pn-apoio is-3 v4-pn-funil__resto">
              {semMovimento === 1 ? "A outra etapa não teve" : `As outras ${semMovimento} etapas não tiveram`} movimento {j.descricao}.
            </p>
          )}
        </div>
      </div>
    </Cartao>
  );
}
