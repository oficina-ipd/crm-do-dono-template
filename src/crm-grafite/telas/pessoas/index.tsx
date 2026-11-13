"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useCRM } from "@/components/crm/provider";
import { usePathname, useRouter, useSearchParams } from "@/crm-grafite/link";
import { nomeEmExibicao } from "@/lib/crm/format";
import { mascararWhatsappCrm } from "@/lib/crm/pii";
import {
  Button,
  ButtonLink,
  DropdownMenu,
  EmptyState,
  FaixaTopo,
  Icon,
  NoResults,
  SearchInput,
  SegmentedControl,
  Table,
  type Coluna,
  type ItemMenu,
  type Ordem,
} from "../../ui";
import { criarEspera } from "../funil/espera";
import { etapasDoQuadro } from "../funil/logica";
import {
  dataCurta,
  filtrarPessoas,
  filtrosAtivosPessoas,
  filtrosDoCaminho,
  FILTROS_PESSOAS_PADRAO,
  hrefFichaPessoa,
  limiteValido,
  opcoesConduzPessoas,
  ordemDaUrl,
  ordenarPessoas,
  PAGINA_PESSOAS,
  pessoasDoEstado,
  quandoCurto,
  rotuloEtapaPessoa,
  telefoneLegivel,
  urlDePessoas,
  type ColunaOrdenavel,
  type FiltrosPessoas,
  type OrdemPessoas,
  type PessoaLinha,
} from "./logica";
import "../../styles/telas/pessoas.css";

const CHAVE_POSICAO = "crm-grafite-pessoas-posicao";
const ID_BUSCA = "v4-pessoas-busca";
type Posicao = { busca: string; em: number; limite: number; topo: number };

function chaveUrl(caminho: string, sp: URLSearchParams): string {
  const q = new URLSearchParams(sp);
  q.sort();
  const s = q.toString();
  return s ? `${caminho}?${s}` : caminho;
}

/**
 * Pessoas: Leads, Clientes, Buscar e Contatos numa tabela só, em folha contínua com cabeçalho
 * e nome fixos. Busca espera 300 ms; filtros por tipo, etapa e quem conduz; ordenação por
 * coluna; total à vista e "Mostrar mais" de 50 em 50. O WhatsApp aparece mascarado e "Revelar"
 * mostra o número de uma linha (só nesta tela, sem registro). A linha abre a ficha.
 */
export function TelaPessoas() {
  const { estado, contatos, agora: agoraIso } = useCRM();
  const router = useRouter();
  const caminho = usePathname();
  const sp = useSearchParams();
  const agora = useMemo(() => new Date(agoraIso), [agoraIso]);

  const [filtros, setFiltros] = useState<FiltrosPessoas>(() => filtrosDoCaminho(caminho, sp));
  const [texto, setTexto] = useState(filtros.q);
  const [ordem, setOrdem] = useState<OrdemPessoas>(() => ordemDaUrl(sp.get("ordem")));
  const [limite, setLimite] = useState(PAGINA_PESSOAS);
  const [revelados, setRevelados] = useState<Set<string>>(() => new Set());
  const caixa = useRef<HTMLDivElement>(null);

  const etapas = useMemo(() => etapasDoQuadro(), []);
  const linhasTodas = useMemo(() => pessoasDoEstado(estado, contatos, etapas), [estado, contatos, etapas]);
  const filtradas = useMemo(() => ordenarPessoas(filtrarPessoas(linhasTodas, filtros), ordem), [linhasTodas, filtros, ordem]);
  const visiveis = filtradas.slice(0, limite);
  const conduz = useMemo(() => opcoesConduzPessoas(linhasTodas), [linhasTodas]);

  // ───── URL: acompanha filtros e ordem; as rotas antigas viram /pessoas ─────
  const qs = urlDePessoas(filtros, ordem);
  const destino = qs ? `/pessoas?${qs}` : "/pessoas";
  const escrita = useRef<string | null>(null);
  const urlAtual = chaveUrl(caminho, sp);

  const espera = useMemo(() => criarEspera(300, (v) => setFiltros((f) => (f.q === v ? f : { ...f, q: v }))), []);
  useEffect(() => () => espera.cancelar(), [espera]);

  useEffect(() => {
    if (escrita.current === null || urlAtual === escrita.current) return;
    // Navegação de fora (menu, ⌘K, rota antiga): relê a vista da URL.
    espera.cancelar();
    const f = filtrosDoCaminho(caminho, sp);
    setFiltros(f);
    setTexto(f.q);
    setOrdem(ordemDaUrl(sp.get("ordem")));
    escrita.current = urlAtual;
    if (caminho === "/buscar") document.getElementById(ID_BUSCA)?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlAtual]);

  useEffect(() => {
    const [p, q] = destino.split("?");
    const alvo = chaveUrl(p, new URLSearchParams(q ?? ""));
    escrita.current = alvo;
    if (alvo !== urlAtual) router.replace(destino);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destino]);

  // Filtro ou ordem mudou: volta para a primeira página e para o topo da tabela.
  const primeira = useRef(true);
  useEffect(() => {
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    setLimite(PAGINA_PESSOAS);
    const w = caixa.current?.querySelector<HTMLElement>(".v4-table-wrap");
    if (w) w.scrollTop = 0;
  }, [qs]);

  // "Buscar" (rota antiga) abre com o foco na busca; voltar da ficha devolve as linhas e a rolagem.
  useEffect(() => {
    if (caminho === "/buscar") document.getElementById(ID_BUSCA)?.focus();
    try {
      const bruto = window.sessionStorage.getItem(CHAVE_POSICAO);
      if (!bruto) return;
      const p = JSON.parse(bruto) as Partial<Posicao>;
      if (p.busca !== qs || typeof p.em !== "number" || Date.now() - p.em > 15 * 60_000) return;
      setLimite(limiteValido(p.limite));
      requestAnimationFrame(() => {
        const w = caixa.current?.querySelector<HTMLElement>(".v4-table-wrap");
        if (w) w.scrollTop = Number(p.topo) || 0;
      });
    } catch {
      /* armazenamento bloqueado: começa do topo */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function lembrarPosicao(e: MouseEvent<HTMLDivElement>) {
    if (!(e.target as HTMLElement).closest("a.v4-row__link, tr.v4-row--link")) return;
    try {
      const w = caixa.current?.querySelector<HTMLElement>(".v4-table-wrap");
      const p: Posicao = { busca: qs, em: Date.now(), limite, topo: w?.scrollTop ?? 0 };
      window.sessionStorage.setItem(CHAVE_POSICAO, JSON.stringify(p));
    } catch {
      /* sem armazenamento: a ficha ainda volta com os filtros pela URL */
    }
  }

  const mudar = (p: Partial<FiltrosPessoas>) => setFiltros((f) => ({ ...f, ...p }));
  const limpar = () => {
    espera.cancelar();
    setTexto("");
    setFiltros({ ...FILTROS_PESSOAS_PADRAO });
  };
  const alternarRevelado = (id: string) =>
    setRevelados((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const nAtivos = filtrosAtivosPessoas(filtros);

  const colunas: Coluna<PessoaLinha>[] = [
    {
      id: "nome",
      titulo: "Nome e empresa",
      ordenavel: true,
      cortar: (p) => [nomeEmExibicao(p.nome), p.empresa].filter(Boolean).join(" · "),
      celula: (p) => (
        <>
          <span className="v4-pessoa__nome">{nomeEmExibicao(p.nome)}</span>
          {p.empresa && <span className="v4-pessoa__empresa"> · {p.empresa}</span>}
        </>
      ),
    },
    { id: "tipo", titulo: "Tipo", ordenavel: true, celula: (p) => (p.tipo === "cliente" ? "Cliente" : "Lead") },
    {
      id: "etapa",
      titulo: "Etapa",
      ordenavel: true,
      celula: (p) => {
        const r = rotuloEtapaPessoa(p);
        if (r.tom === "etapa") return r.texto;
        if (r.tom === "sucesso")
          return (
            <span className="v4-pessoa__ganha">
              <Icon name="sucesso" size="sm" />
              {r.texto}
            </span>
          );
        return <span className="v4-t-3">{r.texto}</span>;
      },
    },
    {
      id: "conversa",
      titulo: "Última conversa",
      ordenavel: true,
      celula: (p) =>
        p.ultimaConversa ? (
          <time dateTime={p.ultimaConversa} title={dataCurta(p.ultimaConversa)}>
            {quandoCurto(p.ultimaConversa, agora)}
          </time>
        ) : (
          <span className="v4-t-3">Sem conversa</span>
        ),
    },
    { id: "conduz", titulo: "Quem conduz", ordenavel: true, celula: (p) => p.conduz },
    { id: "origem", titulo: "Origem", ordenavel: true, cortar: (p) => p.origemRotulo, celula: (p) => (p.origem ? p.origemRotulo : <span className="v4-t-3">Sem origem</span>) },
    { id: "criado", titulo: "Criado em", ordenavel: true, celula: (p) => <span className="v4-num">{dataCurta(p.criadoEm)}</span> },
    {
      id: "contato",
      titulo: "WhatsApp",
      celula: (p) => {
        if (!p.telefone) return <span className="v4-t-3">Sem WhatsApp</span>;
        const aberto = revelados.has(p.id);
        const nome = nomeEmExibicao(p.nome);
        return (
          <span className="v4-pessoa__contato">
            <span className="v4-num">{aberto ? telefoneLegivel(p.telefone) : mascararWhatsappCrm(p.telefone)}</span>
            <button type="button" className="v4-btn v4-btn--ghost v4-btn--sm v4-row__above" onClick={() => alternarRevelado(p.id)}>
              <span className="v4-btn__label">
                <Icon name="olho" size="sm" />
                {aberto ? "Ocultar" : "Revelar"}
              </span>
              <span className="v4-sr"> o WhatsApp de {nome}</span>
            </button>
          </span>
        );
      },
    },
  ];

  const etapaAtual = filtros.etapa === "perdida" ? "Perdida" : etapas.find((e) => e.id === filtros.etapa)?.nome;
  const itensEtapa: ItemMenu[] = [
    { tipo: "radio", id: "todas", label: "Todas", checked: filtros.etapa === "todas", onSelect: () => mudar({ etapa: "todas" }) },
    ...etapas.map((e) => ({ tipo: "radio" as const, id: `e-${e.id}`, label: e.nome, checked: filtros.etapa === e.id, onSelect: () => mudar({ etapa: e.id }) })),
    { tipo: "separador", id: "sep" },
    { tipo: "radio", id: "e-perdida", label: "Perdida", checked: filtros.etapa === "perdida", onSelect: () => mudar({ etapa: "perdida" }) },
  ];
  const conduzAtual = conduz.find((o) => o.valor === filtros.conduz)?.rotulo;
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

  const filtroMenu = (rotulo: string, valor: string, ativo: boolean, itens: ItemMenu[]) => (
    <DropdownMenu
      label={rotulo}
      itens={itens}
      gatilho={(p) => (
        <button
          ref={p.ref}
          type="button"
          className="v4-btn v4-btn--secondary"
          aria-pressed={ativo}
          aria-haspopup={p["aria-haspopup"]}
          aria-expanded={p["aria-expanded"]}
          aria-controls={p["aria-controls"]}
          onClick={p.onClick}
          onKeyDown={p.onKeyDown}
        >
          <span className="v4-btn__label">
            {rotulo}: {valor}
            <Icon name="chevronBaixo" size="sm" />
          </span>
        </button>
      )}
    />
  );

  const total = filtradas.length;
  const contagem = (
    <span aria-live="polite">
      <span className="v4-num">{total}</span> {total === 1 ? "pessoa" : "pessoas"}
      {nAtivos > 0 ? ` de ${linhasTodas.length}` : ""}
    </span>
  );
  const ordemTabela: Ordem = { coluna: ordem.coluna, direcao: ordem.direcao };

  return (
    <div data-v4-tela className="v4-pessoas">
      <FaixaTopo titulo="Pessoas" contagem={contagem}>
        <SearchInput
          id={ID_BUSCA}
          label="Buscar pessoas"
          placeholder="Buscar pessoa"
          value={texto}
          onChange={(v) => {
            setTexto(v);
            espera.mudar(v);
          }}
          atalho="/"
        />
        <SegmentedControl
          label="Tipo"
          value={filtros.tipo}
          onChange={(v) => mudar({ tipo: v === "lead" || v === "cliente" ? v : "todos" })}
          options={[
            { value: "todos", label: "Todos" },
            { value: "lead", label: "Lead" },
            { value: "cliente", label: "Cliente" },
          ]}
        />
        {filtroMenu("Etapa", etapaAtual ?? "Todas", filtros.etapa !== "todas", itensEtapa)}
        {filtroMenu("Conduz", conduzAtual ?? "Todos", filtros.conduz !== "todos", itensConduz)}
        {nAtivos > 0 && (
          <Button variant="ghost" icon="fechar" onClick={limpar}>
            Limpar filtros
          </Button>
        )}
      </FaixaTopo>

      <div className="v4-pessoas__tabela" ref={caixa} onClickCapture={lembrarPosicao}>
        <Table
          rotulo="Pessoas"
          legenda={
            <>
              Pessoas: mostrando <span className="v4-num">{visiveis.length}</span> de <span className="v4-num">{total}</span>. WhatsApp mascarado; “Revelar” mostra o número da linha.
            </>
          }
          linhas={visiveis}
          colunas={colunas}
          chave={(p) => p.id}
          linkDaLinha={(p) => hrefFichaPessoa(p.id, destino)}
          ordem={ordemTabela}
          aoOrdenar={(o) => setOrdem({ coluna: o.coluna as ColunaOrdenavel, direcao: o.direcao })}
          vazio={
            linhasTodas.length > 0 ? (
              <NoResults nivel={2} termo={filtros.q.trim() || undefined} aoLimpar={limpar} />
            ) : (
              <EmptyState
                nivel={2}
                titulo="Ninguém no CRM ainda"
                texto={`Quem chega pelo ${estado.config.nomeRobo}, por formulário ou cadastrado à mão no Funil aparece aqui, com tipo, etapa e última conversa.`}
                acoes={
                  <ButtonLink href="/funil" variant="secondary">
                    Ir para o Funil
                  </ButtonLink>
                }
              />
            )
          }
        />
        {visiveis.length > 0 && (
          <div className="v4-pessoas__mais">
            <p className="v4-t-meta">
              Mostrando <span className="v4-num">{visiveis.length}</span> de <span className="v4-num">{total}</span>
              <span className="v4-pessoas__nota"> · WhatsApp mascarado; “Revelar” mostra o número da linha</span>
            </p>
            {visiveis.length < total ? (
              <Button size="sm" variant="ghost" onClick={() => setLimite((n) => n + PAGINA_PESSOAS)}>
                Mostrar mais <span className="v4-num">{Math.min(PAGINA_PESSOAS, total - visiveis.length)}</span>
              </Button>
            ) : (
              <p className="v4-t-meta">Fim da lista</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
