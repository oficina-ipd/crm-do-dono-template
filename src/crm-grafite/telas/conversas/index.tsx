"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useCRM } from "@/components/crm/provider";
import { etapaDe } from "@/domain/funil";
import { oportunidadePrincipal } from "@/domain/rules";
import { irPara, useRouter, useSearchParams } from "../../link";
import { Button, ButtonLink, DropdownMenu, EmptyState, FaixaTopo, IconButton, KeyHint, SearchInput, SegmentedControl, SidePanel } from "../../ui";
import { useAlturaNoPai, useMidia } from "../../ui/flutuante";
import { hrefFichaComOrigem } from "../ficha/voltar";
import { ContextoTpl } from "./contexto";
import { ConversaTpl, useNomesConversa } from "./conversa";
import { ListaConversas } from "./lista";
import {
  acaoDoTeclado,
  contarPorFiltro,
  filtrando,
  filtrarConversas,
  FILTROS_CONVERSA,
  lerUrlConversas,
  moverNaLista,
  resumosConversas,
  rolagemParaCentralizar,
  rolagemParaMostrar,
  ROTULO_TIPO,
  rotuloFiltro,
  urlConversas,
  URL_PADRAO,
  type EstadoUrlConversas,
  type FiltroConversa,
  type TipoFiltroConversa,
} from "./modelo";
import "../../styles/telas/conversas.css";

const LARGO = "(min-width: 1200px)";
const ESTREITO = "(max-width: 767px)";
const PREF_CONTEXTO = "crm-grafite-conversas-contexto";
export const ID_BUSCA_CONVERSAS = "v4-cv-busca";

/** Rola só a região da lista até a linha (sem scrollIntoView, que tira o ponto de partida do Tab). */
function rolarListaAte(linha: HTMLElement, modo: "centro" | "perto") {
  const regiao = linha.closest<HTMLElement>(".v4-conv__scroll");
  if (!regiao) return;
  const r = regiao.getBoundingClientRect();
  const l = linha.getBoundingClientRect();
  const item = { top: l.top, height: l.height };
  regiao.scrollTop = modo === "centro" ? rolagemParaCentralizar(regiao, item, r.top) : rolagemParaMostrar(regiao, item, r.top);
}

/**
 * Conversas: três regiões em altura cheia (lista · conversa · contexto recolhível). A conversa
 * aberta, o filtro, o tipo e a busca ficam na URL (#/conversas?c=…). Teclado: J/K ou ↑/↓ na lista,
 * "/" busca, Esc recolhe o contexto, ⌘Enter envia. Abaixo de 1200 px o contexto vira painel
 * lateral; abaixo de 768, uma região por vez.
 */
export function TelaConversas() {
  const { estado, agora, contato, operador, ligar } = useCRM();
  const router = useRouter();
  const sp = useSearchParams();
  const url = useMemo(() => lerUrlConversas(sp), [sp]);
  const nomes = useNomesConversa();
  const largo = useMidia(LARGO);
  const estreito = useMidia(ESTREITO);
  const agoraMs = Date.parse(agora);
  const soLeitura = !operador || operador.papel === "leitura";

  // ───── URL (a fonte da verdade da conversa aberta e dos filtros) ─────
  const urlRef = useRef(url);
  urlRef.current = url;
  const pilha = useRef(0);
  const escrever = useCallback(
    (e: EstadoUrlConversas, empilhar = false) => {
      const href = urlConversas(e);
      if (empilhar) {
        pilha.current += 1;
        irPara(href);
      } else router.replace(href);
    },
    [router],
  );

  // busca: o campo filtra na hora; a URL acompanha 300 ms depois da última tecla
  const [busca, setBusca] = useState(url.q);
  const buscaRef = useRef(busca);
  buscaRef.current = busca;
  const ultimaQ = useRef(url.q);
  useEffect(() => {
    if (url.q !== ultimaQ.current) {
      ultimaQ.current = url.q;
      setBusca(url.q);
    }
  }, [url.q]);
  useEffect(() => {
    if (busca === urlRef.current.q) return;
    const t = window.setTimeout(() => {
      ultimaQ.current = busca;
      escrever({ ...urlRef.current, q: busca });
    }, 300);
    return () => window.clearTimeout(t);
  }, [busca, escrever]);

  // ───── lista ─────
  const resumos = useMemo(() => resumosConversas(estado), [estado]);
  const criterio = useMemo(() => ({ filtro: url.filtro, tipo: url.tipo, q: busca }), [url.filtro, url.tipo, busca]);
  const itens = useMemo(() => filtrarConversas(resumos, criterio, agoraMs), [resumos, criterio, agoraMs]);
  const contagem = useMemo(() => contarPorFiltro(resumos, url.tipo, agoraMs), [resumos, url.tipo, agoraMs]);
  const filtrandoAgora = filtrando(criterio);

  const abertaId = url.c;
  // Uma visão nova só quando o estado muda (o relógio de 30 s não remonta a conversa).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const aberto = useMemo(() => (abertaId ? contato(abertaId) : null), [estado, abertaId]);

  const abrir = useCallback(
    (id: string, empilhar = false) => {
      if (urlRef.current.c === id) return;
      escrever({ ...urlRef.current, q: buscaRef.current, c: id }, empilhar);
    },
    [escrever],
  );
  const fechar = useCallback(() => {
    if (pilha.current > 0) {
      pilha.current -= 1;
      window.history.back();
      return;
    }
    escrever({ ...urlRef.current, q: buscaRef.current, c: null });
  }, [escrever]);

  const limpar = () => {
    setBusca("");
    ultimaQ.current = "";
    escrever({ ...URL_PADRAO, c: urlRef.current.c });
  };

  // ───── contexto (coluna ≥ 1200; painel lateral abaixo) ─────
  const [contextoVisivel, setContextoVisivel] = useState(true);
  const [painelContexto, setPainelContexto] = useState(false);
  useEffect(() => {
    if (window.localStorage.getItem(PREF_CONTEXTO) === "0") setContextoVisivel(false);
  }, []);
  const alternarContexto = useCallback((v?: boolean) => {
    setContextoVisivel((atual) => {
      const prox = v ?? !atual;
      window.localStorage.setItem(PREF_CONTEXTO, prox ? "1" : "0");
      return prox;
    });
  }, []);

  // ───── teclado ─────
  const listaRef = useRef<HTMLDivElement>(null);
  const teclado = useRef({ itens, abertaId, largo, contextoVisivel });
  teclado.current = { itens, abertaId, largo, contextoVisivel };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      const editavel = Boolean(alvo && (alvo.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName)));
      const naLista = Boolean(alvo && listaRef.current?.contains(alvo));
      const naTela = Boolean(alvo && alvo.closest?.(".v4-tela-conversas"));
      const dialogoAberto = Boolean(document.querySelector("dialog[open], [role='menu'], .v4-owner__confirm"));
      const acao = acaoDoTeclado({ tecla: e.key, meta: e.metaKey, ctrl: e.ctrlKey, alt: e.altKey, editavel, naLista, dialogoAberto, naTela, jaTratado: e.defaultPrevented });
      if (!acao) return;
      const t = teclado.current;
      if (acao === "buscar") {
        e.preventDefault();
        document.getElementById(ID_BUSCA_CONVERSAS)?.focus();
        return;
      }
      if (acao === "fecharContexto") {
        if (t.largo && t.contextoVisivel) {
          e.preventDefault();
          alternarContexto(false);
        }
        return;
      }
      e.preventDefault();
      const ids = t.itens.map((c) => c.contatoId);
      const prox = moverNaLista(ids.length, t.abertaId ? ids.indexOf(t.abertaId) : -1, acao);
      if (prox == null) return;
      const alvoId = ids[prox];
      const linhaVisivel = !window.matchMedia(ESTREITO).matches;
      abrir(alvoId, !linhaVisivel);
      window.requestAnimationFrame(() => {
        if (!linhaVisivel) {
          document.querySelector<HTMLElement>(".v4-tela-conversas .v4-cv-main")?.focus({ preventScroll: true });
          return;
        }
        const linha = listaRef.current?.querySelectorAll<HTMLElement>(".v4-listrow")[prox];
        if (!linha) return;
        rolarListaAte(linha, "perto");
        linha.focus({ preventScroll: true });
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [abrir, alternarContexto]);

  // A conversa da URL fica à vista na lista ao chegar (voltar da ficha devolve a posição).
  useEffect(() => {
    if (!abertaId) return;
    const linha = listaRef.current?.querySelector<HTMLElement>(".v4-listrow[aria-current]");
    if (linha) rolarListaAte(linha, "centro");
    // só na chegada
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hrefDe = (id: string) => urlConversas({ ...url, q: busca, c: id });
  const aoAbrirLinha = (id: string, e: MouseEvent<HTMLElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    abrir(id, estreito);
  };

  // ───── cabeçalho da conversa (flutua sobre as mensagens) ─────
  const topo = useAlturaNoPai("--v4-cv-topo-h");
  const hrefFicha = aberto ? hrefFichaComOrigem(aberto.id, urlConversas({ ...url, q: busca, c: aberto.id })) : "";
  const opp = aberto ? oportunidadePrincipal(aberto.oportunidades) : null;
  const subtitulo = aberto
    ? [
        aberto.categoria === "cliente" ? "Cliente" : "Lead",
        opp ? (opp.perdida ? `Perdida em ${etapaDe(opp.etapa)?.nome ?? opp.etapa}` : etapaDe(opp.etapa)?.nome) : null,
        aberto.empresa || null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  const cabecalho = aberto ? (
    <div className="v4-conv__main-head" ref={topo}>
      <IconButton className="v4-cv-voltar" icon="chevronEsquerda" label="Voltar para a lista" onClick={fechar} />
      <div className="v4-conv__who">
        <h2 id="v4-cv-atual" className="v4-t-section">
          {aberto.nome}
        </h2>
        {subtitulo && <span className="v4-cv-subtitulo v4-t-meta">{subtitulo}</span>}
      </div>
      <ButtonLink href={hrefFicha} size="sm" variant="ghost" className="v4-cv-ficha">
        Abrir ficha
      </ButtonLink>
      {!soLeitura && aberto.telefone.replace(/\D/g, "") && <IconButton icon="telefone" label={`Ligar para ${aberto.nome}`} onClick={() => ligar(aberto.id)} />}
      <IconButton className="v4-cv-ctx-painel" icon="info" label="Mostrar contexto" aria-haspopup="dialog" onClick={() => setPainelContexto(true)} />
      <IconButton
        className="v4-cv-ctx-alternar"
        icon={contextoVisivel ? "recolher" : "expandir"}
        label={contextoVisivel ? "Recolher contexto" : "Mostrar contexto"}
        hint={contextoVisivel ? "Esc" : undefined}
        aria-expanded={contextoVisivel}
        aria-controls="v4-cv-contexto"
        onClick={() => alternarContexto()}
      />
    </div>
  ) : null;

  const painelDeContexto = (prefixo: string) =>
    aberto ? (
      <ContextoTpl key={aberto.id} c={aberto} hrefFicha={hrefFicha} prefixo={prefixo} />
    ) : (
      <div className="v4-conv__ctx-body">
        <p className="v4-conv__sec v4-t-ui v4-t-2">O contexto aparece quando uma conversa está aberta.</p>
      </div>
    );

  const total = resumos.length;
  const rotuloContagem = filtrandoAgora ? `${itens.length} de ${total}` : `${total} ${total === 1 ? "conversa" : "conversas"}`;

  return (
    <div
      data-v4-tela
      className={["v4-tela-conversas", "v4-cv", contextoVisivel ? "" : "v4-cv--sem-contexto"].filter(Boolean).join(" ")}
      data-aberta={abertaId ? "1" : undefined}
    >
      <FaixaTopo titulo="Conversas" contagem={<span aria-live="polite">{rotuloContagem}</span>}>
        <SearchInput id={ID_BUSCA_CONVERSAS} label="Buscar conversa por nome, empresa ou telefone" placeholder="Buscar conversa" atalho="/" value={busca} onChange={setBusca} />
        <SegmentedControl
          label="Filtrar conversas"
          value={url.filtro}
          onChange={(v) => escrever({ ...url, q: busca, filtro: v as FiltroConversa })}
          options={FILTROS_CONVERSA.map((f) => ({ value: f, label: rotuloFiltro(f, nomes.nomeRobo), count: f === "todas" ? undefined : contagem[f] }))}
        />
        <DropdownMenu
          label="Tipo de contato"
          itens={(["todos", "lead", "cliente"] as const).map((t) => ({
            tipo: "radio" as const,
            id: t,
            label: ROTULO_TIPO[t],
            checked: url.tipo === t,
            onSelect: () => escrever({ ...url, q: busca, tipo: t as TipoFiltroConversa }),
          }))}
          gatilho={(p) => (
            <Button
              ref={p.ref}
              size="sm"
              variant="ghost"
              iconEnd="chevronBaixo"
              aria-haspopup={p["aria-haspopup"]}
              aria-expanded={p["aria-expanded"]}
              aria-controls={p["aria-controls"]}
              onClick={p.onClick}
              onKeyDown={p.onKeyDown}
            >
              {ROTULO_TIPO[url.tipo]}
            </Button>
          )}
        />
        {filtrandoAgora && (
          <Button size="sm" variant="ghost" icon="fechar" onClick={limpar}>
            Limpar filtros
          </Button>
        )}
      </FaixaTopo>

      <ListaConversas
        listaRef={listaRef}
        itens={itens}
        total={total}
        aberta={abertaId}
        hrefDe={hrefDe}
        aoAbrir={aoAbrirLinha}
        filtrandoAgora={filtrandoAgora}
        busca={busca}
        aoLimpar={limpar}
        nomes={nomes}
        agoraMs={agoraMs}
      />

      {/* tabIndex -1: destino do foco depois de J/K em tela estreita */}
      <div className="v4-conv__main v4-cv-main" tabIndex={-1} aria-labelledby={aberto ? "v4-cv-atual" : undefined}>
        {aberto ? (
          <ConversaTpl key={aberto.id} c={aberto} cabecalho={cabecalho} />
        ) : abertaId ? (
          <div className="v4-cv-escolha">
            <EmptyState
              centro
              nivel={2}
              titulo="Conversa não encontrada"
              texto="Esta pessoa não existe mais no CRM ou o endereço está incompleto."
              acoes={
                <Button variant="secondary" onClick={fechar}>
                  Voltar para a lista
                </Button>
              }
            />
          </div>
        ) : (
          <div className="v4-cv-escolha">
            <EmptyState
              centro
              nivel={2}
              titulo="Escolha uma conversa"
              texto={
                <>
                  Leia o histórico e, se for a sua vez, assuma. Use <KeyHint teclas={["J"]} /> e <KeyHint teclas={["K"]} /> para andar pela lista.
                </>
              }
            />
          </div>
        )}
      </div>

      <aside id="v4-cv-contexto" className="v4-conv__ctx v4-cv-ctx" aria-label="Contexto da conversa" hidden={!contextoVisivel}>
        {painelDeContexto("cv-ctx")}
      </aside>

      <SidePanel open={painelContexto && !largo} onClose={() => setPainelContexto(false)} title="Contexto da conversa">
        {painelDeContexto("cv-painel")}
      </SidePanel>
    </div>
  );
}
