"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { useCRM } from "@/components/crm/provider";
import { usePathname, useRouter, useSearchParams } from "@/crm-grafite/link";
import { formatarReais } from "@/domain/rules";
import { etapasV3, taxasFunilDe } from "@/lib/crm/adapters";
import { nomeEmExibicao } from "@/lib/crm/format";
import { Button, ButtonLink, DropdownMenu, EmptyState, FaixaTopo, Icon, NoResults, SearchInput, useToast, type ItemMenu } from "../../ui";
import { CartaoFunilV4, CartaoPerdida } from "./cartao";
import { criarEspera } from "./espera";
import {
  agruparPorEtapa,
  CHAVE_POSICAO_FUNIL,
  cartaoParado,
  cartoesDoEstado,
  contagemFaixaFunil,
  estadoQuadro,
  etapasDoQuadro,
  filtrarCartoes,
  filtrarPerdidas,
  filtrosAtivos,
  filtrosDaUrl,
  FILTROS_FUNIL_PADRAO,
  hrefFichaDe,
  janelaValida,
  linhasTaxas,
  opcoesConduz,
  opcoesMover,
  perdidasNaTraveDe,
  posicaoFunilValida,
  soma,
  urlDoFunil,
  type CartaoFunil,
  type FiltrosFunil,
  type OpcoesMover,
  type PerdidaNaTrave,
  type PosicaoFunil,
} from "./logica";
import { DialogoNovaOportunidade } from "./nova";
import { DialogoPerda } from "./perda";
import { FaixaTaxas } from "./taxas";
import "../../styles/telas/funil.css";

/** Normaliza "/funil?b=1&a=2" para comparar a URL que a tela escreveu com a que chegou. */
function chaveUrl(caminho: string, sp: URLSearchParams): string {
  const q = new URLSearchParams(sp);
  q.sort();
  const s = q.toString();
  return s ? `${caminho}?${s}` : caminho;
}

/**
 * Funil (Grafite): o quadro abre a tela em altura cheia, com rolagem própria em cada coluna e
 * cabeçalho fixo. Título, contagem, busca e filtros (quem conduz, só paradas, bateu na trave)
 * na faixa do topo; taxa por etapa numa faixa recolhível acima do quadro. Abaixo de 768 px o
 * quadro vira lista agrupada por etapa. Tudo vem do estado do CRM; mover e perder passam pelos
 * comandos do domínio.
 */
export function TelaFunil() {
  const { estado, agora: agoraIso, operador, despachar } = useCRM();
  const toast = useToast();
  const router = useRouter();
  const caminho = usePathname();
  const sp = useSearchParams();
  const agora = useMemo(() => new Date(agoraIso), [agoraIso]);
  const somenteLeitura = !operador || operador.papel === "leitura";

  const [filtros, setFiltros] = useState<FiltrosFunil>(() => filtrosDaUrl(sp));
  const [texto, setTexto] = useState(filtros.q);
  const [faixaAberta, setFaixaAberta] = useState(() => sp.get("taxas") === "1");
  const [janela, setJanela] = useState(() => janelaValida(sp.get("janela")));
  const [movendo, setMovendo] = useState<Set<string>>(() => new Set());
  const [reabrindo, setReabrindo] = useState<Set<string>>(() => new Set());
  const [perdendo, setPerdendo] = useState<CartaoFunil | null>(null);
  const [novaAberta, setNovaAberta] = useState(false);

  const etapas = useMemo(() => etapasDoQuadro(), []);
  const etapaPorId = useMemo(() => new Map(etapas.map((e) => [e.id, e])), [etapas]);
  const opcoesPorEtapa = useMemo(() => new Map(etapas.map((e) => [e.id, opcoesMover(etapas, e.id)])), [etapas]);

  const cartoes = useMemo(() => cartoesDoEstado(estado, agoraIso), [estado, agoraIso]);
  const perdidasTodas = useMemo(() => perdidasNaTraveDe(estado), [estado]);
  const filtrados = useMemo(() => filtrarCartoes(cartoes, etapas, filtros, agora), [cartoes, etapas, filtros, agora]);
  const perdidas = useMemo(() => filtrarPerdidas(perdidasTodas, filtros), [perdidasTodas, filtros]);
  const colunas = useMemo(() => agruparPorEtapa(etapas, filtrados), [etapas, filtrados]);
  const conduz = useMemo(() => opcoesConduz(cartoes), [cartoes]);
  const nParadas = useMemo(() => cartoes.filter((c) => cartaoParado(c, etapaPorId.get(c.etapa), agora)).length, [cartoes, etapaPorId, agora]);
  const nTrave = cartoes.filter((c) => c.bateuNaTrave).length + perdidasTodas.length;

  const taxas = useMemo(() => {
    if (!faixaAberta) return [];
    const info = etapasV3();
    return linhasTaxas(etapas, taxasFunilDe(estado, info, janela), janela === 30 ? null : taxasFunilDe(estado, info, 30));
  }, [faixaAberta, estado, etapas, janela]);

  // ───── URL: acompanha filtros, janela e faixa, sem empilhar histórico ─────
  const qs = urlDoFunil(filtros, { janela, taxas: faixaAberta });
  const destino = qs ? `/funil?${qs}` : "/funil";
  const escrita = useRef<string | null>(null);
  const urlAtual = chaveUrl(caminho, sp);

  const espera = useMemo(() => criarEspera(200, (v) => setFiltros((f) => (f.q === v ? f : { ...f, q: v }))), []);
  useEffect(() => () => espera.cancelar(), [espera]);

  // Navegação de fora (menu, link "Bateu na trave", voltar): relê a vista da URL.
  useEffect(() => {
    if (escrita.current === null || urlAtual === escrita.current) return;
    espera.cancelar();
    const f = filtrosDaUrl(sp);
    setFiltros(f);
    setTexto(f.q);
    setJanela(janelaValida(sp.get("janela")));
    setFaixaAberta(sp.get("taxas") === "1");
    escrita.current = urlAtual;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlAtual]);

  useEffect(() => {
    const [p, q] = destino.split("?");
    const alvo = chaveUrl(p, new URLSearchParams(q ?? ""));
    escrita.current = alvo;
    if (alvo !== urlAtual) router.replace(destino);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destino]);

  const mudar = useCallback((p: Partial<FiltrosFunil>) => setFiltros((f) => ({ ...f, ...p })), []);
  const limpar = () => {
    espera.cancelar();
    setTexto("");
    setFiltros({ ...FILTROS_FUNIL_PADRAO });
  };

  // ───── Ações ─────
  const quadroRef = useRef<HTMLDivElement>(null);

  // Com filtro, o quadro rola até a primeira coluna que tem cartão (ex.: "Bateu na trave" fica em Oferta).
  const chaveFiltros = urlDoFunil(filtros);
  useEffect(() => {
    const q = quadroRef.current;
    if (!q || filtrosAtivos(filtros) === 0) return;
    const col = q.querySelector<HTMLElement>(".v4-coluna:not([data-vazia])");
    if (!col) return;
    const fora = col.offsetLeft < q.scrollLeft || col.offsetLeft + col.offsetWidth > q.scrollLeft + q.clientWidth;
    if (fora) q.scrollLeft = Math.max(0, col.offsetLeft - 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveFiltros]);
  const focarCartao = (id: string) =>
    requestAnimationFrame(() => quadroRef.current?.querySelector<HTMLElement>(`[data-cartao="${CSS.escape(id)}"] .v4-cartao__link`)?.focus());

  const avancar = useCallback(
    async (c: CartaoFunil, para: NonNullable<OpcoesMover["avancar"]>) => {
      if (!operador) return;
      setMovendo((s) => new Set(s).add(c.id));
      const r = await despachar({ tipo: "moverEtapa", oportunidadeId: c.id, para: para.id, por: operador.id });
      setMovendo((s) => {
        const n = new Set(s);
        n.delete(c.id);
        return n;
      });
      // Erro de regra (ex.: briefing incompleto) já aparece no aviso do próprio despachar.
      if (!r) return;
      toast.avisar({ tom: "sucesso", titulo: `${nomeEmExibicao(c.contatoNome)} foi para ${para.nome}` });
      focarCartao(c.id);
    },
    [operador, despachar, toast],
  );

  const reabrir = useCallback(
    async (oportunidadeId: string, nome: string) => {
      if (!operador) return;
      setReabrindo((s) => new Set(s).add(oportunidadeId));
      const r = await despachar({ tipo: "reabrir", oportunidadeId, por: operador.id });
      setReabrindo((s) => {
        const n = new Set(s);
        n.delete(oportunidadeId);
        return n;
      });
      if (!r) return;
      const o = r.oportunidades.find((x) => x.id === oportunidadeId);
      const etapa = o ? etapaPorId.get(o.etapa)?.nome : null;
      toast.avisar({ tom: "sucesso", titulo: `${nomeEmExibicao(nome)} voltou para o quadro`, texto: etapa ? `Em ${etapa}, com o tempo na etapa zerado.` : undefined });
    },
    [operador, despachar, toast, etapaPorId],
  );

  const pedirPerda = useCallback((c: CartaoFunil) => setPerdendo(c), []);

  async function confirmarPerda(motivo: string): Promise<boolean> {
    const c = perdendo;
    if (!c || !operador) return false;
    const r = await despachar({ tipo: "marcarPerdida", oportunidadeId: c.id, motivo, por: operador.id });
    if (!r) return false;
    setPerdendo(null);
    toast.avisar({
      tom: "sucesso",
      titulo: `${nomeEmExibicao(c.contatoNome)} marcada como perdida`,
      texto: "Saiu do quadro.",
      acao: { label: "Reabrir", onClick: () => void reabrir(c.id, c.contatoNome) },
    });
    return true;
  }

  // ───── Teclado: setas andam entre cartões (↑↓ na coluna, ←→ entre colunas), M abre "Mover" ─────
  function teclar(e: KeyboardEvent<HTMLDivElement>) {
    const alvo = e.target as HTMLElement;
    if (!alvo.classList.contains("v4-cartao__link")) return;
    const coluna = alvo.closest<HTMLElement>(".v4-coluna");
    if (!coluna || !quadroRef.current) return;
    const links = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>(".v4-cartao__link")];
    const naColuna = links(coluna);
    const i = naColuna.indexOf(alvo);
    const ir = (el: HTMLElement | undefined) => {
      if (!el) return;
      e.preventDefault();
      el.focus();
    };
    if (e.key === "ArrowDown") return ir(naColuna[i + 1]);
    if (e.key === "ArrowUp") return ir(naColuna[i - 1]);
    if (e.key === "Home") return ir(naColuna[0]);
    if (e.key === "End") return ir(naColuna[naColuna.length - 1]);
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      const cols = [...quadroRef.current.querySelectorAll<HTMLElement>(".v4-coluna")].filter((c) => links(c).length > 0);
      const k = cols.indexOf(coluna);
      const prox = cols[e.key === "ArrowRight" ? k + 1 : k - 1];
      if (prox) {
        const l = links(prox);
        ir(l[Math.min(i, l.length - 1)]);
      }
      return;
    }
    if ((e.key === "m" || e.key === "M") && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const botao = alvo.closest(".v4-cartao")?.querySelector<HTMLButtonElement>(".v4-cartao__mover");
      if (botao) {
        e.preventDefault();
        botao.focus();
        botao.click();
      }
    }
  }

  // ───── Abrir a ficha guarda a rolagem do quadro e de cada coluna; voltar (mesma vista) devolve ─────
  function lembrarPosicao(e: MouseEvent<HTMLDivElement>) {
    if (!(e.target as HTMLElement).closest("a.v4-cartao__link") || !quadroRef.current) return;
    const cols: Record<string, number> = {};
    quadroRef.current.querySelectorAll<HTMLElement>(".v4-coluna[data-etapa]").forEach((c) => {
      const l = c.querySelector<HTMLElement>(".v4-coluna__lista");
      if (l) cols[c.dataset.etapa ?? ""] = l.scrollTop;
    });
    const regiao = quadroRef.current.closest<HTMLElement>(".v4-main");
    const p: PosicaoFunil = { busca: qs, em: Date.now(), esquerda: quadroRef.current.scrollLeft, colunas: cols, pagina: regiao?.scrollTop ?? 0 };
    try {
      window.sessionStorage.setItem(CHAVE_POSICAO_FUNIL, JSON.stringify(p));
    } catch {
      /* sem armazenamento: a URL ainda guarda os filtros */
    }
  }
  useEffect(() => {
    let p: PosicaoFunil | null = null;
    try {
      p = posicaoFunilValida(window.sessionStorage.getItem(CHAVE_POSICAO_FUNIL), qs, Date.now());
    } catch {
      p = null;
    }
    if (!p) return;
    const pos = p;
    requestAnimationFrame(() => {
      const q = quadroRef.current;
      if (!q) return;
      const regiao = q.closest<HTMLElement>(".v4-main");
      if (regiao && pos.pagina > 0) regiao.scrollTop = pos.pagina;
      q.scrollLeft = pos.esquerda;
      q.querySelectorAll<HTMLElement>(".v4-coluna[data-etapa]").forEach((c) => {
        const l = c.querySelector<HTMLElement>(".v4-coluna__lista");
        const v = pos.colunas[c.dataset.etapa ?? ""];
        if (l && typeof v === "number") l.scrollTop = v;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ───── Faixa do topo ─────
  const nAtivos = filtrosAtivos(filtros);
  const valorConduz = conduz.find((o) => o.valor === filtros.conduz);
  const itensConduz: ItemMenu[] = [
    { tipo: "radio", id: "todos", label: "Todos", checked: filtros.conduz === "todos", onSelect: () => mudar({ conduz: "todos" }) },
    ...conduz.map((o) => ({
      tipo: "radio" as const,
      id: `c-${o.valor}`,
      label: `${o.rotulo} (${o.n})`,
      checked: filtros.conduz === o.valor,
      onSelect: () => mudar({ conduz: o.valor }),
    })),
  ];

  const estadoTela = estadoQuadro({ nCartoes: cartoes.length, nFiltrados: filtrados.length, nPerdidasVisiveis: perdidas.length });
  const de = destino;
  const contagem =
    nAtivos > 0 ? (
      <>
        <span className="v4-num">{filtrados.length + perdidas.length}</span> de{" "}
        <span className="v4-num">{cartoes.length + (filtros.trave ? perdidasTodas.length : 0)}</span> no quadro
      </>
    ) : (
      <span className="v4-tabular">{contagemFaixaFunil(cartoes.length, formatarReais(soma(cartoes)))}</span>
    );

  return (
    <div data-v4-tela className="v4-funil">
      <FaixaTopo titulo="Funil" contagem={<span aria-live="polite">{contagem}</span>}>
        <SearchInput
          label="Buscar no funil"
          placeholder="Buscar no funil"
          value={texto}
          onChange={(v) => {
            setTexto(v);
            espera.mudar(v);
          }}
          atalho="/"
        />
        <DropdownMenu
          label="Quem conduz"
          itens={itensConduz}
          gatilho={(p) => (
            <button
              ref={p.ref}
              type="button"
              className="v4-btn v4-btn--secondary"
              aria-pressed={filtros.conduz !== "todos"}
              aria-haspopup={p["aria-haspopup"]}
              aria-expanded={p["aria-expanded"]}
              aria-controls={p["aria-controls"]}
              onClick={p.onClick}
              onKeyDown={p.onKeyDown}
            >
              <span className="v4-btn__label">
                Conduz: {valorConduz?.rotulo ?? "Todos"}
                <Icon name="chevronBaixo" size="sm" />
              </span>
            </button>
          )}
        />
        <Button aria-pressed={filtros.paradas} icon="relogio" onClick={() => mudar({ paradas: !filtros.paradas })}>
          Só paradas <span className="v4-funil__n v4-num">{nParadas}</span>
        </Button>
        <Button aria-pressed={filtros.trave} onClick={() => mudar({ trave: !filtros.trave })}>
          Bateu na trave <span className="v4-funil__n v4-num">{nTrave}</span>
        </Button>
        {nAtivos > 0 && (
          <Button variant="ghost" icon="fechar" onClick={limpar}>
            Limpar filtros
          </Button>
        )}
        {!somenteLeitura && (
          <Button onClick={() => setNovaAberta(true)}>
            Nova oportunidade
          </Button>
        )}
      </FaixaTopo>

      <FaixaTaxas
        linhas={taxas}
        janela={janela}
        aberta={faixaAberta}
        aoAlternar={() => setFaixaAberta((v) => !v)}
        aoMudarJanela={(n) => setJanela(janelaValida(n))}
      />

      {estadoTela === "vazio" ? (
        <div className="v4-funil__estado">
          <EmptyState
            nivel={2}
            titulo="Nenhuma oportunidade aberta"
            texto={`Quando o ${estado.config.nomeRobo} qualificar um lead ou alguém abrir uma oportunidade, o cartão aparece aqui, na etapa em que está.`}
            acoes={
              <>
                {!somenteLeitura && (
                  <Button onClick={() => setNovaAberta(true)}>
                    Nova oportunidade
                  </Button>
                )}
                <ButtonLink href="/conversas" variant="ghost">
                  Ir para Conversas
                </ButtonLink>
              </>
            }
          />
        </div>
      ) : estadoTela === "sem-resultado" ? (
        <div className="v4-funil__estado">
          <NoResults nivel={2} termo={filtros.q.trim() || undefined} aoLimpar={limpar} />
        </div>
      ) : (
        <div
          ref={quadroRef}
          className="v4-quadro"
          role="region"
          aria-label={somenteLeitura ? "Quadro do funil. Setas andam entre cartões." : "Quadro do funil. Setas andam entre cartões; M abre Mover para."}
          tabIndex={-1}
          onKeyDown={teclar}
          onClickCapture={lembrarPosicao}
        >
          {colunas.map(({ etapa, cartoes: lista, soma: somaCol }) => (
            <section key={etapa.id} className="v4-coluna" data-etapa={etapa.id} data-vazia={lista.length === 0 || undefined} aria-labelledby={`v4-col-${etapa.id}`}>
              <header className="v4-coluna__cabeca">
                <h2 id={`v4-col-${etapa.id}`} className="v4-coluna__nome">
                  {etapa.nome}
                </h2>
                <span className="v4-coluna__numeros">
                  <span className="v4-num">{lista.length}</span>
                  <span className="v4-sr">{lista.length === 1 ? " oportunidade" : " oportunidades"}</span>
                  {lista.length > 0 && (
                    <>
                      <span aria-hidden="true"> · </span>
                      <span className="v4-num">{formatarReais(somaCol)}</span>
                    </>
                  )}
                </span>
              </header>
              {lista.length === 0 ? (
                <p className="v4-coluna__vazia">{nAtivos > 0 ? "Nenhum com esses filtros" : "Ninguém nesta etapa"}</p>
              ) : (
                <ol className="v4-coluna__lista">
                  {lista.map((c) => (
                    <CartaoFunilV4
                      key={c.id}
                      cartao={c}
                      href={hrefFichaDe(c.contatoId, de)}
                      parado={cartaoParado(c, etapa, agora)}
                      opcoes={opcoesPorEtapa.get(c.etapa) ?? opcoesMover(etapas, c.etapa)}
                      agora={agora}
                      movendo={movendo.has(c.id)}
                      somenteLeitura={somenteLeitura}
                      aoAvancar={avancar}
                      aoPerder={pedirPerda}
                    />
                  ))}
                </ol>
              )}
            </section>
          ))}
          {perdidas.length > 0 && (
            <section className="v4-coluna v4-coluna--perdidas" aria-labelledby="v4-col-perdidas">
              <header className="v4-coluna__cabeca">
                <h2 id="v4-col-perdidas" className="v4-coluna__nome">
                  Perdidas na trave
                </h2>
                <span className="v4-coluna__numeros">
                  <span className="v4-num">{perdidas.length}</span>
                  <span aria-hidden="true"> · </span>
                  <span className="v4-num">{formatarReais(perdidas.reduce((s, p) => s + p.valor, 0))}</span>
                </span>
              </header>
              <ol className="v4-coluna__lista">
                {perdidas.map((p: PerdidaNaTrave) => (
                  <CartaoPerdida
                    key={p.oportunidadeId}
                    p={p}
                    href={hrefFichaDe(p.contatoId, de)}
                    somenteLeitura={somenteLeitura}
                    reabrindo={reabrindo.has(p.oportunidadeId)}
                    aoReabrir={(x) => void reabrir(x.oportunidadeId, x.contatoNome)}
                  />
                ))}
              </ol>
            </section>
          )}
        </div>
      )}

      {!somenteLeitura && (
        <>
          <DialogoPerda
            aberto={perdendo !== null}
            nome={perdendo?.contatoNome ?? ""}
            etapaNome={perdendo ? (etapaPorId.get(perdendo.etapa)?.nome ?? "") : ""}
            motivos={perdendo ? (opcoesPorEtapa.get(perdendo.etapa)?.motivosPerda ?? []) : []}
            aoFechar={() => setPerdendo(null)}
            aoConfirmar={confirmarPerda}
          />
          <DialogoNovaOportunidade aberto={novaAberta} aoFechar={() => setNovaAberta(false)} />
        </>
      )}
    </div>
  );
}
