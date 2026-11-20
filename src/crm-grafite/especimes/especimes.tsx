"use client";

import { useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  CallEvent,
  ChatBubble,
  Checkbox,
  Composer,
  DaySeparator,
  Dialog,
  Divider,
  DropdownMenu,
  FaixaTopo,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  Input,
  KeyHint,
  ListRow,
  MenuPreview,
  NoResults,
  OwnershipBar,
  PageHeader,
  Panel,
  PermissionState,
  SearchInput,
  SegmentedControl,
  Select,
  SidePanel,
  Skeleton,
  SkeletonGroup,
  SkeletonListRow,
  Spinner,
  Switch,
  Table,
  Tabs,
  Tag,
  Textarea,
  TipoTag,
  ToastPreview,
  Toolbar,
  useToast,
  type ButtonVariant,
  type Coluna,
  type ItemMenu,
  type Ordem,
} from "../ui";
type VisualV4 = "neutro" | "grafite";
import { ConversasExemplo } from "./conversas-exemplo";

/* DADOS ILUSTRATIVOS em toda a página: nomes, valores e mensagens inventados. */

const SECOES = [
  ["cor", "Superfícies e cor"],
  ["tipo", "Tipografia"],
  ["medidas", "Espaço, raio e sombra"],
  ["botoes", "Botões"],
  ["campos", "Campos"],
  ["selecao", "Seleção, abas e filtros"],
  ["marcadores", "Etiquetas e marcadores"],
  ["flutuante", "Menus, dicas, diálogos e avisos"],
  ["tabela", "Tabela"],
  ["listas", "Linhas de lista"],
  ["estados", "Estados de tela"],
  ["estrutura", "Estrutura da tela"],
  ["conversa", "Conversa"],
  ["densidade", "Densidades"],
  ["solido", "Vidro e modo sólido"],
  ["composicao", "Composição: Conversas"],
] as const;

function Secao({ id, titulo, descricao, children }: { id: string; titulo: string; descricao?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="v4-spec__sec" aria-labelledby={`${id}-t`}>
      <header>
        <h2 id={`${id}-t`} className="v4-t-section">
          {titulo}
        </h2>
        {descricao && <p className="v4-t-ui">{descricao}</p>}
      </header>
      {children}
    </section>
  );
}

function Sub({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="v4-spec__sub">
      <h3 className="v4-spec__h3">{titulo}</h3>
      {children}
    </div>
  );
}

const SUPERFICIES = [
  { cls: "ambiente", nome: "Ambiente", token: "--v4-surface-ambient", uso: "Fundo da aplicação; plano, sem gradiente." },
  { cls: "estrutura", nome: "Estrutura", token: "--v4-surface-structure", uso: "Navegação e cabeçalho. Vidro 88%, desfoque 16 px." },
  { cls: "trabalho", nome: "Trabalho", token: "--v4-surface-work", uso: "Listas, conversa, formulários. 97%, sem desfoque." },
  { cls: "flutuante", nome: "Flutuante", token: "--v4-surface-float", uso: "Menus, diálogos, avisos. Sólido, com sombra." },
  { cls: "campo", nome: "Campo", token: "--v4-surface-field", uso: "Fundo de campo, com contorno de controle (4,9:1)." },
  { cls: "acao", nome: "Ação principal", token: "--v4-action", uso: "Botão claro com texto escuro (provisório). Só a ação principal." },
  { cls: "suavez", nome: "A sua vez", token: "--v4-attention", uso: "Âmbar só em “precisa de você”: etiqueta e contador." },
  { cls: "sucesso", nome: "Sucesso", token: "--v4-success", uso: "Concluído, confirmado." },
  { cls: "atencao", nome: "Atenção", token: "--v4-warning", uso: "Pendência; entrega não confirmada." },
  { cls: "erro", nome: "Erro", token: "--v4-danger", uso: "Falha e ação destrutiva." },
  { cls: "info", nome: "Informação", token: "--v4-info", uso: "Orientação contextual; motivo de bloqueio." },
] as const;

/** Grafite: as quatro camadas e o que cada uma faz (tokens em styles/grafite.css). */
const CAMADAS = [
  { cls: "g-ambiente", nome: "1 · Ambiente", token: "--v4-g-ambient-*", uso: "Ardósia com a luz verde em manchas suaves. Intensidade num token só (--v4-gp-light-gain)." },
  { cls: "g-vidro", nome: "2 · Vidro", token: "--v4-g-glass-*", uso: "Menu, listas, contexto: translúcido, desfoque 24, borda clara de 1 px e brilho no topo." },
  { cls: "g-vidro-up", nome: "2 · Vidro elevado", token: "--v4-g-glass-up-*", uso: "Painel principal da tela, um pouco mais opaco." },
  { cls: "g-folha", nome: "Folha da tabela", token: "--v4-g-sheet", uso: "Corpo de tabela sólido e uniforme; a coluna fixa usa a mesma cor." },
  { cls: "g-flutuante", nome: "3 · Flutuante", token: "--v4-g-float-*", uso: "Cabeçalho da conversa, campo de resposta, cabeçalho de tabela, menus, diálogos, avisos." },
  { cls: "g-acao", nome: "4 · Relevo: ação principal", token: "--v4-g-action-*", uso: "Botão principal e item ativo do menu: verde da marca com texto escuro." },
  { cls: "g-relevo", nome: "4 · Relevo claro", token: "--v4-g-raised-*", uso: "Filtro ativo, botão secundário, segmento marcado, mensagem enviada." },
  { cls: "suavez", nome: "A sua vez", token: "--v4-attention", uso: "Âmbar só em “precisa de você”: etiqueta e contador." },
  { cls: "sucesso", nome: "Sucesso", token: "--v4-success", uso: "Concluído, confirmado. Sempre com texto." },
  { cls: "erro", nome: "Erro", token: "--v4-danger", uso: "Falha e ação destrutiva. Sempre com texto." },
] as const;

type Par = { id: string; par: string; razao: number; minimo: number };
const CONTRASTE: Par[] = [
  { id: "1", par: "texto-1 sobre trabalho", razao: 15.37, minimo: 4.5 },
  { id: "2", par: "texto-2 sobre trabalho", razao: 10.32, minimo: 4.5 },
  { id: "3", par: "texto-3 sobre trabalho", razao: 6.7, minimo: 4.5 },
  { id: "4", par: "texto-3 sobre trabalho selecionado", razao: 5.17, minimo: 4.5 },
  { id: "5", par: "texto-3 sobre flutuante", razao: 6.03, minimo: 4.5 },
  { id: "6", par: "texto-3 sobre estrutura (vidro)", razao: 7.18, minimo: 4.5 },
  { id: "7", par: "texto sobre ação (botão claro)", razao: 17.49, minimo: 4.5 },
  { id: "7b", par: "âmbar sobre fundo suave (etiqueta “precisa de você”)", razao: 7.01, minimo: 4.5 },
  { id: "7c", par: "texto sobre âmbar (contador)", razao: 9.47, minimo: 4.5 },
  { id: "8", par: "desabilitado sobre trabalho", razao: 5.56, minimo: 4.5 },
  { id: "9", par: "erro sobre fundo suave", razao: 6.34, minimo: 4.5 },
  { id: "10", par: "contorno de controle sobre trabalho", razao: 4.7, minimo: 3 },
  { id: "11", par: "contorno de controle sobre flutuante", razao: 4.23, minimo: 3 },
  { id: "12", par: "contorno de controle sobre trabalho em hover", razao: 4.11, minimo: 3 },
  { id: "13", par: "anel de foco sobre flutuante", razao: 15.46, minimo: 3 },
];

/** Medido na página renderizada (?visual=grafite, profundidade média), no ponto mais claro da luz. */
const CONTRASTE_GRAFITE: Par[] = [];

type Pessoa = { id: string; nome: string; empresa: string; tipo: "lead" | "member"; etapa: string; ultima: string; dias: number; valor: number };
const PESSOAS: Pessoa[] = [
  { id: "p1", nome: "Marina Albuquerque", empresa: "Padaria Trigo Bom", tipo: "lead", etapa: "Handoff", ultima: "hoje, 14:32", dias: 2, valor: 1997 },
  { id: "p2", nome: "Rafael Tanaka", empresa: "Oficina Tanaka", tipo: "member", etapa: "Dentro", ultima: "hoje, 13:48", dias: 31, valor: 1997 },
  { id: "p3", nome: "Beatriz Nogueira", empresa: "Clínica Respira", tipo: "lead", etapa: "Proposta", ultima: "ontem", dias: 5, valor: 3994 },
  { id: "p4", nome: "Henrique Duarte", empresa: "Duarte Contabilidade e Assessoria Empresarial", tipo: "lead", etapa: "Oferta", ultima: "seg", dias: 9, valor: 1997 },
  { id: "p5", nome: "Luana Ferraz", empresa: "Ateliê Ferraz", tipo: "lead", etapa: "Briefing", ultima: "seg", dias: 3, valor: 0 },
];
const moeda = (n: number) => (n > 0 ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }) : "—");

function ordenar(l: Pessoa[], o?: Ordem): Pessoa[] {
  if (!o) return l;
  const k = o.coluna as keyof Pessoa;
  const s = [...l].sort((a, b) => (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0));
  return o.direcao === "asc" ? s : s.reverse();
}

const COLUNAS: Coluna<Pessoa>[] = [
  { id: "nome", titulo: "Nome", ordenavel: true, celula: (p) => p.nome },
  { id: "empresa", titulo: "Empresa", celula: (p) => p.empresa, cortar: (p) => p.empresa },
  { id: "tipo", titulo: "Tipo", celula: (p) => <TipoTag tipo={p.tipo} /> },
  { id: "etapa", titulo: "Etapa", ordenavel: true, celula: (p) => <Tag tom="etapa">{p.etapa}</Tag> },
  { id: "ultima", titulo: "Última conversa", celula: (p) => p.ultima },
  { id: "dias", titulo: "Dias na etapa", ordenavel: true, numerica: true, celula: (p) => <span className="v4-num">{p.dias}</span> },
  { id: "valor", titulo: "Valor", ordenavel: true, numerica: true, celula: (p) => <span className="v4-num">{moeda(p.valor)}</span> },
];

/** Grafite: tabela larga para a coluna do nome fixa (as outras rolam para o lado). */
const CIDADES = ["Goiânia", "São Paulo", "Anápolis", "Brasília", "Curitiba"];
const COLUNAS_LARGAS: Coluna<Pessoa>[] = [
  { id: "nome", titulo: "Nome", celula: (p) => p.nome },
  { id: "tipo", titulo: "Tipo", celula: (p) => (p.tipo === "lead" ? "Lead" : "Cliente") },
  { id: "etapa", titulo: "Etapa", celula: (p) => p.etapa },
  { id: "ultima", titulo: "Última conversa", celula: (p) => p.ultima },
  { id: "conduz", titulo: "Conduz", celula: (p) => (p.dias % 2 ? "Otávio" : "Cláudio") },
  { id: "empresa", titulo: "Empresa", celula: (p) => p.empresa, cortar: (p) => p.empresa },
  { id: "valor", titulo: "Valor", numerica: true, celula: (p) => <span className="v4-num">{moeda(p.valor)}</span> },
  { id: "dias", titulo: "Dias na etapa", numerica: true, celula: (p) => <span className="v4-num">{p.dias}</span> },
  { id: "whats", titulo: "WhatsApp", celula: (p) => `***${4410 + p.dias * 37}` },
  { id: "cidade", titulo: "Cidade", celula: (p) => CIDADES[p.dias % CIDADES.length] },
];

const ESTADOS_BOTAO: Array<{ id: string; rotulo: string }> = [
  { id: "repouso", rotulo: "Repouso" },
  { id: "hover", rotulo: "Hover" },
  { id: "foco", rotulo: "Foco (teclado)" },
  { id: "pressionado", rotulo: "Pressionado" },
  { id: "ativo", rotulo: "Ativo" },
  { id: "desabilitado", rotulo: "Desabilitado" },
  { id: "processando", rotulo: "Processando" },
];
const VARIANTES: Array<{ v: ButtonVariant; nome: string; texto: string }> = [
  { v: "primary", nome: "Principal", texto: "Assumir" },
  { v: "secondary", nome: "Secundário", texto: "Mover para…" },
  { v: "ghost", nome: "Discreto", texto: "Ver ficha" },
  { v: "destructive", nome: "Destrutivo", texto: "Excluir nota" },
];

function CelulaBotao({ v, texto, estado }: { v: ButtonVariant; texto: string; estado: string }) {
  if (estado === "ativo") {
    if (v === "secondary" || v === "ghost") {
      return (
        <Button variant={v} aria-pressed>
          {texto}
        </Button>
      );
    }
    return <span className="v4-t-meta">não se aplica</span>;
  }
  return (
    <Button
      variant={v}
      forceState={estado === "hover" ? "hover" : estado === "foco" ? "focus" : estado === "pressionado" ? "pressed" : undefined}
      disabled={estado === "desabilitado"}
      busy={estado === "processando"}
    >
      {texto}
    </Button>
  );
}

const MENU_ESTATICO: ItemMenu[] = [
  { tipo: "rotulo", id: "r", label: "Transferir para" },
  { id: "otavio-hover", label: "Otávio", icon: "transferir" },
  { id: "camila", label: "Camila", icon: "transferir" },
  { tipo: "separador", id: "s1" },
  { tipo: "radio", id: "d1", label: "Compacta", checked: true, onSelect: () => undefined },
  { tipo: "radio", id: "d2", label: "Confortável", checked: false, onSelect: () => undefined },
  { tipo: "checkbox", id: "sol", label: "Modo sólido (sem vidro)", checked: false, onCheckedChange: () => undefined },
  { tipo: "separador", id: "s2" },
  { id: "bloq", label: "Mesclar contatos", disabled: true, fim: "em breve" },
  { id: "sair", label: "Excluir conversa", icon: "lixeira", danger: true },
];

function Densidade({ d }: { d: "compact" | "comfortable" }) {
  const [sel, setSel] = useState<Set<string>>(new Set(["p1"]));
  return (
    <div data-density={d} className="v4-dens">
      <h3 className="v4-spec__h3">{d === "compact" ? "Compacta · padrão no computador" : "Confortável · números do guia"}</h3>
      <PageHeader nivel={3} titulo="Pessoas" caminho={[{ label: "Vender" }, { label: d === "compact" ? "Pessoas" : "Pessoas (confortável)" }]} meta="5 de 5" acoes={<Button variant="primary" icon="mais_">Nova pessoa</Button>} />
      <div className="v4-dens__stack">
        <Input label="Nome da pessoa" defaultValue="Marina Albuquerque" help="Como aparece na lista e na conversa." />
        <Table
          rotulo={`Pessoas, densidade ${d === "compact" ? "compacta" : "confortável"}`}
          linhas={PESSOAS.slice(0, 3)}
          colunas={COLUNAS.slice(0, 4)}
          chave={(p) => p.id}
          nomeDaLinha={(p) => p.nome}
          linkDaLinha={(p) => `/contatos/${p.id}`}
          selecao={sel}
          aoSelecionar={setSel}
        />
        <div className="v4-spec__row">
          <Button variant="secondary">Mover para…</Button>
          <Button variant="ghost">Ver ficha</Button>
          <Tag tom="suavez">Precisa de você</Tag>
        </div>
      </div>
    </div>
  );
}

export function EspecimesV4({ visual = "grafite" }: { visual?: VisualV4 }) {
  const grafite = visual === "grafite";
  const toast = useToast();
  const [ordem, setOrdem] = useState<Ordem | undefined>({ coluna: "nome", direcao: "asc" });
  const [selecao, setSelecao] = useState<Set<string>>(new Set(["p1", "p3"]));
  const [dialogo, setDialogo] = useState(false);
  const [painel, setPainel] = useState(false);
  const [nota, setNota] = useState("");
  const [seg, setSeg] = useState("voce");
  const [chk, setChk] = useState(true);
  const [sw, setSw] = useState(true);
  const [buscado, setBuscado] = useState("");
  const [irPara, setIrPara] = useState("cor");

  return (
    <div className="v4-spec">
      <div className="v4-spec__intro">
      {grafite ? (
        <FaixaTopo titulo="Espécimes do Grafite" contagem={`${SECOES.length} seções`}>
          <SearchInput label="Buscar componente (ilustrativo)" placeholder="Buscar componente" value={buscado} onChange={setBuscado} />
          <SegmentedControl
            label="Ir para a seção"
            value={irPara}
            onChange={(v) => {
              setIrPara(v);
              // âncora nativa: rola só a região de conteúdo (a moldura não rola)
              window.location.hash = v;
            }}
            options={[
              { value: "cor", label: "Camadas" },
              { value: "botoes", label: "Botões" },
              { value: "tabela", label: "Tabela" },
              { value: "composicao", label: "Conversas" },
            ]}
          />
          <Button variant="primary" icon="busca" onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}>
            Testar ⌘K
          </Button>
        </FaixaTopo>
      ) : (
      <PageHeader
        titulo="Espécimes do design system v4"
        caminho={[{ label: "Design system" }, { label: "Espécimes" }]}
        meta={<Tag tom="info" icon="info">Dados ilustrativos</Tag>}
        acoes={
          <Button variant="secondary" icon="busca" onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}>
            Testar a paleta ⌘K
          </Button>
        }
      />
      )}
      <p className="v4-spec__note v4-t-ui">
        <Icon name="info" />
        <span>
          Preview local. Nomes, mensagens e valores são inventados e não vêm do banco. Na paleta ⌘K, digite “mar” ou “1234”; “erro” mostra o estado de falha.
        </span>
      </p>
      <nav aria-label="Seções desta página">
        <ul className="v4-spec__nav">
          {SECOES.map(([id, t]) => (
            <li key={id}>
              <a className="v4-btn v4-btn--ghost v4-btn--sm" href={`#${id}`}>
                <span className="v4-btn__label">{t}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
      </div>

      {grafite ? (
      <Secao id="cor" titulo="Camadas e cor" descricao="Ambiente, vidro, flutuante e relevo, do fundo para a frente. Paleta Ardósia e verde: verde na luz de fundo, no botão principal e no item ativo do menu; âmbar só em “precisa de você”.">
        <div className="v4-spec__grid">
          {CAMADAS.map((s) => (
            <div key={s.cls} className={`v4-swatch v4-swatch--${s.cls}`}>
              <span className="v4-swatch__name">{s.nome}</span>
              <code className="v4-t-meta">{s.token}</code>
              <span className="v4-t-meta">{s.uso}</span>
            </div>
          ))}
        </div>
        {CONTRASTE_GRAFITE.length > 0 && (
        <Sub titulo="Contraste medido na tela renderizada (fundo efetivo, no ponto mais claro da luz)">
          <Table
            rotulo="Contraste medido no Grafite"
            linhas={CONTRASTE_GRAFITE}
            chave={(p) => p.id}
            colunas={[
              { id: "par", titulo: "Par", celula: (p) => p.par },
              { id: "razao", titulo: "Razão", numerica: true, celula: (p) => <span className="v4-num">{p.razao.toFixed(2).replace(".", ",")}:1</span> },
              { id: "min", titulo: "Mínimo", numerica: true, celula: (p) => <span className="v4-num">{p.minimo.toString().replace(".", ",")}:1</span> },
              { id: "ok", titulo: "Resultado", celula: (p) => (p.razao >= p.minimo ? <Tag tom="sucesso" icon="check">Passa</Tag> : <Tag tom="erro">Falha</Tag>) },
            ]}
          />
        </Sub>
        )}
      </Secao>
      ) : (
      <Secao id="cor" titulo="Superfícies e cor" descricao="Quatro superfícies por papel, três níveis de texto, uma cor de ação e quatro estados. Paleta provisória em escuro neutro: a ação principal é um botão claro e o âmbar fica só em “precisa de você”.">
        <div className="v4-spec__grid">
          {SUPERFICIES.map((s) => (
            <div key={s.cls} className={`v4-swatch v4-swatch--${s.cls}`}>
              <span className="v4-swatch__name">{s.nome}</span>
              <code className="v4-t-meta">{s.token}</code>
              <span className="v4-t-meta">{s.uso}</span>
            </div>
          ))}
        </div>
        <Sub titulo="Contraste calculado (WCAG 2.2)">
          <Table
            rotulo="Contraste dos pares de texto e contorno"
            linhas={CONTRASTE}
            chave={(p) => p.id}
            colunas={[
              { id: "par", titulo: "Par", celula: (p) => p.par },
              { id: "razao", titulo: "Razão", numerica: true, celula: (p) => <span className="v4-num">{p.razao.toFixed(2).replace(".", ",")}:1</span> },
              { id: "min", titulo: "Mínimo", numerica: true, celula: (p) => <span className="v4-num">{p.minimo.toString().replace(".", ",")}:1</span> },
              { id: "ok", titulo: "Resultado", celula: (p) => (p.razao >= p.minimo ? <Tag tom="sucesso" icon="check">Passa</Tag> : <Tag tom="erro">Falha</Tag>) },
            ]}
          />
        </Sub>
      </Secao>
      )}

      <Secao
        id="tipo"
        titulo="Tipografia"
        descricao={
          grafite
            ? "Onest em três pesos (400, 500, 600): 13 px na interface, 14 nas mensagens, nunca abaixo de 12. Números em coluna com algarismos tabulares."
            : "Atkinson Hyperlegible Next em três pesos (400, 500, 600). A Mono entra só em números comparados em coluna."
        }
      >
        <div className="v4-type">
          <div className="v4-type__row">
            <span className="v4-t-meta">{grafite ? "Tela · 19/24 · 600" : "Tela · 22/28 · 600"}</span>
            <span className="v4-t-title">Conversas</span>
          </div>
          <div className="v4-type__row">
            <span className="v4-t-meta">{grafite ? "Seção · 15/20 · 600" : "Seção · 18/24 · 600"}</span>
            <span className="v4-t-section">Por que pediu uma pessoa</span>
          </div>
          <div className="v4-type__row">
            <span className="v4-t-meta">{grafite ? "Leitura e mensagem · 14/21 · 400" : "Leitura · 16/24 · 400"}</span>
            <span className="v4-t-read">Quer saber o valor e se cabe no caixa deste mês. Il1 O0 rn m: caracteres parecidos continuam diferentes.</span>
          </div>
          <div className="v4-type__row">
            <span className="v4-t-meta">{grafite ? "Interface · 13/18" : "Lista e campo · 14/20"}</span>
            <span className="v4-t-ui">Marina Albuquerque · Padaria Trigo Bom</span>
          </div>
          <div className="v4-type__row">
            <span className="v4-t-meta">Metadado · 12/16</span>
            <span className="v4-t-meta">Hoje, 14:32 · Otávio</span>
          </div>
          <div className="v4-type__row">
            <span className="v4-t-meta">{grafite ? "Números em coluna · tabulares" : "Números em coluna · Mono"}</span>
            <span className="v4-type__mono">R$ 1.997 · 31 · 0,42</span>
          </div>
        </div>
      </Secao>

      <Secao id="medidas" titulo="Espaço, raio e sombra">
        <div className="v4-spec__grid--2 v4-spec__grid">
          <Sub titulo="Espaço (4 → 48)">
            <div className="v4-scale">
              {[4, 8, 12, 16, 24, 32, 48].map((n, i) => (
                <div key={n} className="v4-scale__row">
                  <span className="v4-t-meta v4-tabular">
                    --v4-space-{i + 1} · {n}
                  </span>
                  <span className={`v4-scale__bar v4-scale__bar--${i + 1}`} />
                </div>
              ))}
            </div>
          </Sub>
          <Sub titulo="Raio">
            <div className="v4-spec__row">
              <span className="v4-radius v4-radius--panel">{grafite ? "painel 22" : "painel 16"}</span>
              {grafite && <span className="v4-radius v4-radius--bar">barra 16</span>}
              <span className="v4-radius v4-radius--menu">{grafite ? "menu 14" : "menu 12"}</span>
              <span className="v4-radius v4-radius--control">{grafite ? "item 14" : "campo 10"}</span>
              <span className="v4-radius v4-radius--pill">{grafite ? "controle (pílula)" : "pílula"}</span>
            </div>
          </Sub>
        </div>
      </Secao>

      <Secao id="botoes" titulo="Botões" descricao="Um principal por contexto. Processando mantém a largura e ignora o segundo clique; desabilitado continua focável e anunciado.">
        <div className="v4-spec-scroll">
          <table className="v4-spec-matrix">
            <caption className="v4-sr">Variantes de botão em cada estado</caption>
            <thead>
              <tr>
                <th scope="col">Variante</th>
                {ESTADOS_BOTAO.map((e) => (
                  <th key={e.id} scope="col">
                    {e.rotulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {VARIANTES.map((v) => (
                <tr key={v.v}>
                  <th scope="row">{v.nome}</th>
                  {ESTADOS_BOTAO.map((e) => (
                    <td key={e.id}>
                      <CelulaBotao v={v.v} texto={v.texto} estado={e.id} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Sub titulo="Tamanhos, ícone e só ícone">
          <div className="v4-spec__row">
            <Button size="sm" variant="secondary">
              Pequeno
            </Button>
            <Button variant="secondary" icon="telefone">
              Ligar
            </Button>
            <Button variant="primary" icon="enviar" onClick={() => new Promise((r) => setTimeout(r, 1500))}>
              Clique: processa 1,5 s
            </Button>
            <IconButton icon="telefone" label="Ligar para o contato" />
            <IconButton icon="maisVertical" label="Mais ações" variant="secondary" />
            <IconButton icon="fechar" label="Fechar" size="sm" />
          </div>
        </Sub>
      </Secao>

      <Secao id="campos" titulo="Campos" descricao="Rótulo sempre visível, ajuda e erro ligados ao campo. O placeholder é só exemplo.">
        <div className="v4-spec__grid v4-spec__grid--3">
          <Input label="Nome" placeholder="Ex.: Marina Albuquerque" help="Repouso, com ajuda." />
          <Input label="Empresa" defaultValue="Padaria Trigo Bom" forceState="hover" help="Hover." />
          <Input label="E-mail" defaultValue="marina@" forceState="focus" help="Foco de teclado." />
          <Input label="Telefone" defaultValue="11 9000" required error="Faltam dígitos. Use DDD e número, ex.: 11 90000-1234." />
          <Input label="Origem" defaultValue="Live gratuita" disabled help="Desabilitado: vem do formulário de entrada." />
          <Input label="Criado em" defaultValue="08/11/2026" readOnly help="Somente leitura." />
          <Select
            label="Etapa"
            defaultValue="handoff"
            options={[
              { value: "claudio", label: "Cláudio" },
              { value: "handoff", label: "Handoff" },
              { value: "briefing", label: "Briefing" },
              { value: "proposta", label: "Proposta" },
            ]}
          />
          <Textarea label="Nota" placeholder="O que você combinou com a pessoa" help="Fica na ficha, visível para a equipe." />
          <div className="v4-field">
            <span className="v4-field__label">Busca local (espera 300 ms)</span>
            <SearchInput label="Buscar pessoas" placeholder="Buscar por nome" debounceMs={300} onSearch={setBuscado} />
            <p className="v4-field__help" aria-live="polite">
              {buscado ? `Buscaria por “${buscado}”.` : "Digite para ver a espera em ação. Escape limpa."}
            </p>
          </div>
        </div>
      </Secao>

      <Secao id="selecao" titulo="Seleção, abas e filtros">
        <div className="v4-spec__grid v4-spec__grid--2">
          <Sub titulo="Caixa de seleção e interruptor">
            <div className="v4-spec__row v4-spec__row--top">
              <Checkbox label="Marcada" checked={chk} onChange={(e) => setChk(e.target.checked)} />
              <Checkbox label="Em parte" indeterminate checked={false} onChange={() => undefined} />
              <Checkbox label="Em foco" forceState="focus" defaultChecked={false} />
              <Checkbox label="Desabilitada" disabled defaultChecked />
            </div>
            <div className="v4-spec__row">
              <Switch checked={sw} onChange={setSw} label="Avisar quando pedir humano" stateText={["Ligado", "Desligado"]} />
              <Switch checked={false} onChange={() => undefined} label="Indisponível" disabled stateText={["Ligado", "Desligado"]} />
            </div>
          </Sub>
          <Sub titulo="Controle segmentado (filtra a vista atual)">
            <SegmentedControl
              label="Filtrar conversas"
              value={seg}
              onChange={setSeg}
              options={[
                { value: "voce", label: "Precisa de você", count: 2 },
                { value: "humano", label: "Com humano", count: 4 },
                { value: "claudio", label: "Com Cláudio", count: 51 },
                { value: "paradas", label: "Paradas", count: 5 },
              ]}
            />
            <p className="v4-t-meta">Setas trocam a opção; Tab sai do grupo.</p>
          </Sub>
        </div>
        <Sub titulo="Abas (sincronizadas com a URL em ?aba=)">
          <Tabs
            label="Ficha da pessoa"
            urlParam="aba"
            tabs={[
              { id: "conversa", label: "Conversa", count: 48 },
              { id: "linha", label: "Linha do tempo" },
              { id: "tarefas", label: "Tarefas", count: 2 },
              { id: "negocio", label: "Negócio", disabled: true },
            ]}
          >
            {(a) => <p className="v4-t-ui v4-t-2">Painel da aba “{a}”. Setas, Home e End andam entre as abas; a aba “Negócio” está desabilitada.</p>}
          </Tabs>
        </Sub>
      </Secao>

      <Secao id="marcadores" titulo="Etiquetas e marcadores" descricao="Sempre com texto. A cor reforça; o texto e a forma dizem.">
        <div className="v4-spec__row">
          <TipoTag tipo="lead" />
          <TipoTag tipo="member" />
          <Tag tom="etapa">Proposta</Tag>
          <Tag tom="suavez">Precisa de você</Tag>
          <Tag tom="sucesso" icon="check">
            Pago
          </Tag>
          <Tag tom="atencao" icon="relogio">
            Parada há 5 dias
          </Tag>
          <Tag tom="erro" icon="erro">
            Número inválido
          </Tag>
          <Tag tom="info">Com Cláudio</Tag>
          <Tag>Live gratuita</Tag>
        </div>
        <div className="v4-spec__row">
          <span className="v4-spec__row">
            Fila <Badge n={3} suaVez rotulo="precisam de você" />
          </span>
          <span className="v4-spec__row">
            Tarefas <Badge n={7} rotulo="tarefas para hoje" />
          </span>
          <Avatar nome="Marina Albuquerque" />
          <Avatar nome="Rafael Tanaka" tamanho="lg" />
          <Avatar nome="Cláudio" claudio />
          <span className="v4-spec__row">
            Abrir a paleta <KeyHint teclas={["⌘", "K"]} />
          </span>
          <span className="v4-spec__row">
            Focar a busca <KeyHint teclas={["/"]} />
          </span>
        </div>
        <Divider rotulo="Divisor com rótulo" />
        <Divider />
      </Secao>

      <Secao id="flutuante" titulo="Menus, dicas, diálogos e avisos" descricao="Camada flutuante sólida, acima do conteúdo. Escape fecha e o foco volta para quem abriu.">
        <div className="v4-spec__grid v4-spec__grid--3">
          <Sub titulo="Menu (aberto, vitrine estática)">
            <MenuPreview label="Exemplo de menu" itens={MENU_ESTATICO} />
          </Sub>
          <Sub titulo="Menu real e dica">
            <div className="v4-spec__row">
              <DropdownMenu
                label="Transferir conversa"
                itens={[
                  { tipo: "rotulo", id: "r", label: "Transferir para" },
                  { id: "o1", label: "Otávio", icon: "transferir", onSelect: () => toast.avisar({ tom: "info", titulo: "Transferida para Otávio", texto: "Exemplo: nada foi gravado." }) },
                  { id: "o2", label: "Camila", icon: "transferir", onSelect: () => toast.avisar({ tom: "info", titulo: "Transferida para Camila", texto: "Exemplo: nada foi gravado." }) },
                  { tipo: "separador", id: "s" },
                  { id: "x", label: "Excluir conversa", icon: "lixeira", danger: true, onSelect: () => toast.avisar({ tom: "atencao", titulo: "Exclusão não existe aqui", texto: "Exemplo de item destrutivo." }) },
                ]}
                gatilho={(p) => (
                  <Button
                    ref={p.ref}
                    variant="secondary"
                    iconEnd="chevronBaixo"
                    aria-haspopup={p["aria-haspopup"]}
                    aria-expanded={p["aria-expanded"]}
                    aria-controls={p["aria-controls"]}
                    onClick={p.onClick}
                    onKeyDown={p.onKeyDown}
                  >
                    Transferir
                  </Button>
                )}
              />
              <IconButton icon="info" label="O que é handoff" hint="?" />
            </div>
            <div className="v4-tooltip">Dica aberta (vitrine): aparece no foco e no ponteiro</div>
          </Sub>
          <Sub titulo="Diálogo e painel lateral">
            <div className="v4-spec__row">
              <Button variant="secondary" onClick={() => setDialogo(true)}>
                Nova nota (diálogo)
              </Button>
              <Button variant="secondary" onClick={() => setPainel(true)}>
                Contexto (painel lateral)
              </Button>
            </div>
            <p className="v4-t-meta">Escreva algo na nota e tente fechar: o diálogo pede confirmação antes de descartar.</p>
          </Sub>
        </div>
        <Sub titulo="Avisos">
          <div className="v4-spec__grid v4-spec__grid--3">
            <ToastPreview tom="sucesso" titulo="Etapa atualizada" texto="Marina foi para Proposta." />
            <ToastPreview tom="erro" titulo="A mensagem não saiu" texto="O WhatsApp não respondeu. O texto ficou no campo." acao="Tentar de novo" />
            <ToastPreview tom="atencao" titulo="Entrega não confirmada" texto="Confira na conversa antes de reenviar." />
          </div>
          <div className="v4-spec__row">
            <Button variant="secondary" onClick={() => toast.avisar({ tom: "sucesso", titulo: "Nota salva", texto: "Some em 5 segundos." })}>
              Disparar sucesso
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                toast.avisar({ tom: "erro", titulo: "Não foi possível salvar", texto: "Fica até você dispensar.", acao: { label: "Tentar de novo", onClick: () => undefined } })
              }
            >
              Disparar erro (persistente)
            </Button>
          </div>
        </Sub>
      </Secao>

      <Secao id="tabela" titulo="Tabela" descricao="Superfície contínua. Títulos ordenáveis dizem a direção; a barra de lote só aparece com seleção; a linha inteira leva à ficha por um link real.">
        <Toolbar
          rotulo="Comandos da tabela de pessoas"
          inicio={
            <>
              <div className="v4-toolbar__grow">
                <SearchInput label="Buscar pessoas" placeholder="Buscar por nome" />
              </div>
              <SegmentedControl label="Tipo" value="todos" onChange={() => undefined} options={[{ value: "todos", label: "Todos" }, { value: "lead", label: "Lead" }, { value: "member", label: "Cliente" }]} />
            </>
          }
          fim={<Button variant="ghost" icon="filtro">Filtros</Button>}
        />
        <Table
          rotulo="Pessoas"
          legenda="5 pessoas · ilustrativo"
          linhas={ordenar(PESSOAS, ordem)}
          colunas={COLUNAS}
          chave={(p) => p.id}
          nomeDaLinha={(p) => p.nome}
          linkDaLinha={(p) => `/contatos/${p.id}`}
          ordem={ordem}
          aoOrdenar={setOrdem}
          selecao={selecao}
          aoSelecionar={setSelecao}
          acoesEmLote={() => (
            <>
              <Button size="sm" variant="secondary" icon="transferir">
                Transferir
              </Button>
              <Button size="sm" variant="secondary">
                Mover para…
              </Button>
            </>
          )}
        />
        {grafite && (
          <Sub titulo="Tabela larga: cabeçalho de vidro, nome fixo, sombra na borda só ao rolar para o lado">
            <div className="v4-spec-largura">
              <Table rotulo="Pessoas, todas as colunas" linhas={PESSOAS} colunas={COLUNAS_LARGAS} chave={(p) => p.id} linkDaLinha={(p) => `/contatos/${p.id}`} />
            </div>
          </Sub>
        )}
        <div className="v4-spec__grid v4-spec__grid--2">
          <Sub titulo="Carregando (geometria final)">
            <Table rotulo="Pessoas carregando" linhas={[] as Pessoa[]} colunas={COLUNAS.slice(0, 4)} chave={(p) => p.id} carregando selecao={new Set()} aoSelecionar={() => undefined} />
          </Sub>
          <Sub titulo="Sem resultado">
            <Table
              rotulo="Pessoas sem resultado"
              linhas={[] as Pessoa[]}
              colunas={COLUNAS.slice(0, 4)}
              chave={(p) => p.id}
              vazio={<NoResults termo="Zé da Silva" aoLimpar={() => undefined} />}
            />
          </Sub>
        </div>
      </Secao>

      <Secao id="listas" titulo="Linhas de lista">
        <div className="v4-spec__grid v4-spec__grid--3">
          <ul className="v4-list" aria-label="Exemplos de linha">
            <li>
              <ListRow inicio={<Avatar nome="Marina Albuquerque" />} titulo="Marina Albuquerque" meta="14:32" texto="Pode me ligar depois das 16h?" naoLida tags={<><TipoTag tipo="lead" /><Tag tom="suavez">Precisa de você</Tag></>} onClick={() => undefined} />
            </li>
            <li>
              <ListRow inicio={<Avatar nome="Rafael Tanaka" />} titulo="Rafael Tanaka" meta="13:48" texto="Você: Combinado, te mando o link." atual tags={<TipoTag tipo="member" />} onClick={() => undefined} />
            </li>
            <li>
              <ListRow inicio={<Avatar nome="Beatriz Nogueira" />} titulo="Beatriz Nogueira" meta="Ontem" texto="Cláudio: Qual é o maior gargalo hoje?" forceState="hover" onClick={() => undefined} />
            </li>
            <li>
              <ListRow inicio={<Avatar nome="Henrique Duarte" />} titulo="Henrique Duarte" meta="Seg" texto="Vou ver com meu sócio." forceState="focus" onClick={() => undefined} />
            </li>
          </ul>
          <p className="v4-t-meta">De cima para baixo: não lida, aberta agora (contorno e fundo), hover, foco de teclado.</p>
        </div>
      </Secao>

      <Secao id="estados" titulo="Estados de tela" descricao="Carregando, vazio, sem resultado, erro e sem permissão. Cada um diz o que houve e qual é o próximo passo.">
        <div className="v4-spec__grid v4-spec__grid--2">
          <Panel titulo="Vazio" nivel={3}>
            <EmptyState titulo="Nenhuma tarefa para hoje" texto="Quando o Cláudio passar uma conversa ou você criar uma tarefa, ela aparece aqui por prazo." acoes={<Button variant="secondary" icon="mais_">Criar tarefa</Button>} />
          </Panel>
          <Panel titulo="Sem resultado" nivel={3}>
            <NoResults termo="Zé da Silva" texto="A busca olha nome e telefone. Os filtros “Lead” e “Parada” continuam ligados." aoLimpar={() => undefined} />
          </Panel>
          <Panel titulo="Erro" nivel={3}>
            <ErrorState titulo="As conversas não carregaram" texto="O espelho do WhatsApp não respondeu. Nada foi perdido; o que já estava na tela continua aqui." aoTentar={() => new Promise((r) => setTimeout(r, 1200))} />
          </Panel>
          <Panel titulo="Sem permissão" nivel={3}>
            <PermissionState titulo="Metas é só para gestor" texto="Seu acesso é de vendedor. Peça ao João para mudar o seu papel, se precisar ver ou editar metas." />
          </Panel>
          <Panel titulo="Carregando" nivel={3}>
            <SkeletonGroup label="Carregando conversas">
              <SkeletonListRow />
              <SkeletonListRow largura={50} />
              <SkeletonListRow largura={80} />
            </SkeletonGroup>
          </Panel>
          <Panel titulo="Andamento" nivel={3}>
            <div className="v4-spec__row">
              <Spinner label="Carregando" mostrarTexto />
              <Spinner label="Salvando" tamanho="lg" />
            </div>
            <p className="v4-t-meta">Com movimento reduzido no sistema, o giro vira três pontos que acendem sem se mover, e o esqueleto fica parado.</p>
            <Skeleton forma="title" />
            <Skeleton largura={90} />
            <Skeleton largura={60} />
          </Panel>
        </div>
      </Secao>

      <Secao id="estrutura" titulo="Estrutura da tela" descricao="Cabeçalho de contexto com caminho, título e ações; comandos locais junto do conteúdo; painel de uma camada só.">
        <Panel titulo="Painel de trabalho" acoes={<Button size="sm" variant="ghost">Ver tudo</Button>} rodape={<><Button variant="ghost">Cancelar</Button><Button variant="primary">Salvar</Button></>}>
          <PageHeader nivel={3} titulo="Funil" caminho={[{ label: "Vender", href: "#estrutura" }, { label: "Funil" }]} meta="38 abertas" acoes={<><Button variant="secondary" icon="filtro">Filtros</Button><Button variant="primary" icon="mais_">Nova oportunidade</Button></>} />
          <Toolbar rotulo="Comandos do funil" inicio={<SearchInput label="Buscar no funil" placeholder="Buscar por nome" />} fim={<SegmentedControl label="Dono" value="todos" onChange={() => undefined} options={[{ value: "todos", label: "Todos" }, { value: "meus", label: "Meus" }]} />} />
          <Panel titulo="Painel aninhado vira grupo plano" nivel={3}>
            <p className="v4-t-ui v4-t-2">Sem segunda camada de vidro: borda de divisor e fundo transparente.</p>
          </Panel>
        </Panel>
      </Secao>

      <Secao id="conversa" titulo="Conversa" descricao="Balões compactos com autor e estado de envio, separador por dia, ligação, barra de posse e campo de resposta isolado.">
        <div className="v4-spec__grid v4-spec__grid--2">
          <Panel titulo="Balões e estados" nivel={3} semRecuo>
            <div className="v4-thread">
              <DaySeparator rotulo="Hoje" />
              <ChatBubble direcao="in" autor={{ tipo: "lead", nome: "Marina" }} hora="14:30">
                Quanto custa a comunidade?
              </ChatBubble>
              <ChatBubble direcao="out" autor={{ tipo: "claudio" }} hora="14:30" estado="enviada">
                Te explico! Antes, me conta quantas pessoas trabalham com você?
              </ChatBubble>
              <ChatBubble direcao="out" autor={{ tipo: "humano", nome: "Otávio" }} hora="14:31" estado="enviando">
                Oi, Marina, aqui é o Otávio.
              </ChatBubble>
              <ChatBubble direcao="out" autor={{ tipo: "humano", nome: "Otávio" }} hora="14:31" estado="incerta" agrupada>
                Posso te ligar agora?
              </ChatBubble>
              <ChatBubble direcao="out" autor={{ tipo: "humano", nome: "Otávio" }} hora="14:32" estado="falhou" aoTentarDeNovo={() => new Promise((r) => setTimeout(r, 900))} agrupada>
                Te mando o link da proposta.
              </ChatBubble>
              <CallEvent segundos={754} hora="14:40" quem="Otávio" />
            </div>
          </Panel>
          <Panel titulo="Posse e resposta" nivel={3} semRecuo>
            <OwnershipBar condutor={{ tipo: "claudio" }} precisaDeVoce avisoAutomatico="Oi! Aqui é o Otávio, da equipe do João. Vou seguir com você por aqui." aoAssumir={() => new Promise((r) => setTimeout(r, 600))} aoDevolver={() => undefined} />
            <Composer motivoBloqueio="O Cláudio está conduzindo. Assuma a conversa para responder." aoEnviar={async () => true} />
            <OwnershipBar
              condutor={{ tipo: "voce" }}
              operadores={[{ id: "o1", nome: "Otávio" }, { id: "o2", nome: "Camila" }]}
              aoAssumir={() => undefined}
              aoDevolver={() => toast.avisar({ tom: "info", titulo: "Devolvida ao Cláudio", texto: "Exemplo: nada foi gravado." })}
              aoTransferir={() => undefined}
            />
            <Composer aoEnviar={() => new Promise((r) => setTimeout(() => r(true), 800))} rascunhoInicial="Posso te ligar às 16h?" limite={160} />
          </Panel>
        </div>
        <Sub titulo="Confirmação antes de assumir">
          <Panel rotulo="Barra de posse com confirmação aberta" semRecuo>
            <OwnershipBar condutor={{ tipo: "outro", nome: "Camila" }} confirmandoInicial avisoAutomatico="Oi! Aqui é o João. Vou seguir com você por aqui." aoAssumir={() => undefined} aoDevolver={() => undefined} />
          </Panel>
        </Sub>
      </Secao>

      <Secao id="densidade" titulo="Densidades" descricao="Compacta é o padrão no computador; confortável usa os números do guia. Em tela de toque, todo alvo tem 44 px nas duas.">
        <div className="v4-spec__grid v4-spec__grid--2">
          <Densidade d="compact" />
          <Densidade d="comfortable" />
        </div>
      </Secao>

      <Secao
        id="solido"
        titulo="Vidro e modo sólido"
        descricao={
          grafite
            ? "Desfoque só nas superfícies grandes (menu, painéis, barras flutuantes, cabeçalho de tabela); linhas, cartões e a coluna fixa ficam sem. O modo sólido, no menu do usuário, tira desfoque e transparência e mantém bordas, sombras e hierarquia; o sistema com transparência reduzida recebe o mesmo."
            : "Vidro só na estrutura (navegação e cabeçalho). O modo sólido, no menu do usuário, tira o vidro e o desfoque e mantém limites e hierarquia; o sistema com transparência reduzida recebe o mesmo."
        }
      >
        <div className="v4-spec__grid v4-spec__grid--2">
          <div>
            <h3 className="v4-spec__h3">Vidro (padrão)</h3>
            <div className="v4-glassdemo" tabIndex={0} aria-label="Exemplo de vidro: role para ver o conteúdo passar por baixo">
              <div className="v4-glassdemo__bar">
                Cabeçalho <KeyHint teclas={["⌘", "K"]} />
              </div>
              <div className="v4-glassdemo__rows">
                {["Marina Albuquerque", "Rafael Tanaka", "Beatriz Nogueira", "Henrique Duarte", "Luana Ferraz", "Marcos Vilela"].map((n) => (
                  <div key={n} className="v4-glassdemo__row">
                    {n}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div data-solid="1">
            <h3 className="v4-spec__h3">Sólido</h3>
            <div className="v4-glassdemo" tabIndex={0} aria-label="Exemplo de modo sólido: role para ver o conteúdo passar por baixo">
              <div className="v4-glassdemo__bar">
                Cabeçalho <KeyHint teclas={["⌘", "K"]} />
              </div>
              <div className="v4-glassdemo__rows">
                {["Marina Albuquerque", "Rafael Tanaka", "Beatriz Nogueira", "Henrique Duarte", "Luana Ferraz", "Marcos Vilela"].map((n) => (
                  <div key={n} className="v4-glassdemo__row">
                    {n}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Secao>

      <Secao
        id="composicao"
        titulo="Composição: Conversas"
        descricao={
          grafite
            ? "Três regiões de vidro: lista 284, conversa (vidro elevado) e contexto 272, cada uma com rolagem própria. Cabeçalho e campo de resposta flutuam sobre a conversa: as mensagens passam por baixo. Abaixo de 1200 px o contexto vira painel lateral; abaixo de 768, uma coluna."
            : "Lista 340, conversa e contexto 320, em altura cheia, cada região com rolagem própria. Abaixo de 1200 px o contexto vira painel lateral; abaixo de 768, uma coluna."
        }
      >
        <p className="v4-spec__note v4-t-ui">
          <Icon name="info" />
          <span>Dados ilustrativos. Assumir, enviar, mover e transferir não gravam nada.</span>
        </p>
        <ConversasExemplo altura="fixa" />
      </Secao>

      <Dialog
        open={dialogo}
        onClose={() => {
          setDialogo(false);
          setNota("");
        }}
        title="Nova nota"
        dirty={nota.trim().length > 0}
        perda="a nota que você escreveu"
        footer={({ fechar }) => (
          <>
            <Button variant="ghost" onClick={fechar}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              disabled={!nota.trim()}
              onClick={async () => {
                await new Promise((r) => setTimeout(r, 700));
                setDialogo(false);
                setNota("");
                toast.avisar({ tom: "sucesso", titulo: "Nota salva", texto: "Exemplo: nada foi gravado." });
              }}
            >
              Salvar nota
            </Button>
          </>
        )}
      >
        <Textarea label="Nota sobre Marina" value={nota} onChange={(e) => setNota(e.target.value)} help="Visível para a equipe na ficha." />
      </Dialog>

      <SidePanel open={painel} onClose={() => setPainel(false)} title="Contexto: Marina Albuquerque">
        <p className="v4-t-ui">Quer saber o valor e se cabe no caixa deste mês.</p>
        <p className="v4-t-meta">Falta saber: faturamento mensal e quem decide.</p>
        <Divider />
        <Input label="Próxima tarefa" defaultValue="Ligar às 16h" />
      </SidePanel>
    </div>
  );
}
