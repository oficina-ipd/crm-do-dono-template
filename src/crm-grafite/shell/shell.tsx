"use client";

import Link from "@/crm-grafite/link";
import { usePathname } from "@/crm-grafite/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ROTULO_PAPEL,
  badgeDoItemV4,
  caminhoV4,
  gruposNavV4,
  idAtivoV4,
  inicioDoPapel,
  itensMenuUsuarioV4,
  type BadgesNavV4,
  type CrmPapelNav,
  type GrupoNavV4,
  type ItemNavV4,
} from "../nav";
import { definirDensidadeV4, definirMenuV4, definirSolidoV4, type DensidadeV4, type MenuV4 } from "../preferencias";
import { Icon } from "../ui/icon";
import { IconButton } from "../ui/button";
import { Avatar, Badge, KeyHint } from "../ui/marcadores";
import { Breadcrumbs } from "../ui/estrutura";
import { DropdownMenu, type ItemMenu } from "../ui/menu";
import { SidePanel } from "../ui/dialog";
import { SegmentedControl } from "../ui/tabs";
import { Switch } from "../ui/field";
import { Tooltip } from "../ui/tooltip";
import { useMidia } from "../ui/flutuante";
import { CommandPaletteV4 } from "./palette";
import { useBuscarPessoasV4 } from "./fonte-busca";

export type BadgesV4 = BadgesNavV4;

const RECOLHIDA = "(min-width: 768px) and (max-width: 1199px)";
/** Grafite: o menu de ícones vale de 768 px para cima; abaixo, gaveta. */
const COM_MENU_LATERAL = "(min-width: 768px)";

function ItemNav({
  item,
  atual,
  badges,
  recolhida,
  aoIr,
}: {
  item: ItemNavV4;
  atual: string;
  badges: BadgesV4;
  recolhida: boolean;
  aoIr?: () => void;
}) {
  // Âmbar só quando há alguém esperando uma pessoa; o número é exatamente esse.
  const { n, suaVez, rotulo: rotuloBadge } = badgeDoItemV4(item, badges);
  return (
    <li>
      <Tooltip content={item.label} lado="direita" descreve={false} desligado={!recolhida}>
        <Link href={item.href} className="v4-nav__item" aria-current={item.id === atual ? "page" : undefined} onClick={aoIr}>
          <Icon name={item.icone} size="nav" />
          <span className="v4-nav__text">{item.label}</span>
          <Badge n={n} suaVez={suaVez} rotulo={rotuloBadge} />
        </Link>
      </Tooltip>
    </li>
  );
}

function ListaNav({
  grupos,
  atual,
  badges,
  recolhida,
  aoIr,
  idBase,
  rotulo = "Principal",
}: {
  rotulo?: string;
  grupos: GrupoNavV4[];
  atual: string;
  badges: BadgesV4;
  recolhida: boolean;
  aoIr?: () => void;
  idBase: string;
}) {
  return (
    <nav className="v4-nav" aria-label={rotulo}>
      {grupos.map((g) => (
        <div key={g.id} className="v4-nav__group" role="group" aria-labelledby={`${idBase}-${g.id}`}>
          <p id={`${idBase}-${g.id}`} className="v4-nav__label">
            {g.label}
          </p>
          <ul className="v4-nav__list">
            {g.itens.map((i) => (
              <ItemNav key={i.id} item={i} atual={atual} badges={badges} recolhida={recolhida} aoIr={aoIr} />
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/**
 * Casca do CRM v4: navegação por papel (232 px; 64 px entre 768 e 1199; gaveta abaixo de
 * 768), cabeçalho de contexto com caminho e busca, paleta ⌘K e menu do usuário.
 * As telas entram em `children` (hoje, as v3 dentro de .crm-v4-legado).
 *
 * Grafite (`grafite`): menu de ícones de 56 px que abre para 184 px com os nomes (preferência
 * em cookie, como a densidade), faixa única no topo (as telas preenchem com <FaixaTopo>) e
 * moldura fixa: a página não rola, só o conteúdo. Mesmo DOM; a diferença é CSS e o botão
 * de mostrar os nomes.
 */
export function CrmV4Shell({
  papel,
  nome,
  badges = {},
  relanceLigado = false,
  ligacoesLigadas = false,
  densidade: densidadeInicial,
  solido: solidoInicial,
  caminhoAtual,
  ilustrativo = false,
  grafite = false,
  menu: menuInicial = "icones",
  marca = "CRM do dono",
  aoSair,
  children,
}: {
  papel: CrmPapelNav;
  nome: string;
  badges?: BadgesV4;
  relanceLigado?: boolean;
  /** Ligações recentes (/pos-call) na Rotina, só com CRM_LIGACAO. */
  ligacoesLigadas?: boolean;
  densidade: DensidadeV4;
  solido: boolean;
  /** Preview: força o item ativo (as rotas /visual-v4 não estão na navegação). */
  caminhoAtual?: string;
  /**
   * Prévia: a paleta não chama a API. As pessoas ilustrativas vêm do provedor da prévia
   * (`previa-busca.tsx`, importado só pelas rotas /visual-v4); sem ele, a busca volta vazia.
   */
  ilustrativo?: boolean;
  /** Visual Grafite (data-visual="grafite" na raiz). */
  grafite?: boolean;
  /** Grafite: menu só com ícones (padrão) ou com os nomes. */
  menu?: MenuV4;
  /** Nome que aparece ao lado do símbolo (ex.: nome da empresa). */
  marca?: string;
  /** Sair: no template, troca de operador (modo local) ou encerra a sessão. */
  aoSair: () => void;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "/";
  const path = caminhoAtual ?? pathname;
  const grupos = useMemo(() => gruposNavV4(papel, relanceLigado, ligacoesLigadas), [papel, relanceLigado, ligacoesLigadas]);
  const extras = useMemo(() => itensMenuUsuarioV4(papel), [papel]);
  const itens = useMemo(() => grupos.flatMap((g) => g.itens), [grupos]);
  const atual = idAtivoV4([...itens, ...extras], path);
  const onde = caminhoV4(papel, path, relanceLigado, ligacoesLigadas);
  const [menu, setMenu] = useState<MenuV4>(menuInicial);
  const faixaIntermediaria = useMidia(RECOLHIDA);
  const comMenuLateral = useMidia(COM_MENU_LATERAL);
  // Só ícones: os nomes viram dica (tooltip). No Grafite, depende da escolha do menu.
  const recolhida = grafite ? comMenuLateral && menu === "icones" : faixaIntermediaria;

  const [paleta, setPaleta] = useState(false);
  const [gaveta, setGaveta] = useState(false);
  const [densidade, setDensidade] = useState<DensidadeV4>(densidadeInicial);
  const [solido, setSolido] = useState(solidoInicial);

  const telas = useMemo(
    () => [...grupos.flatMap((g) => g.itens.map((i) => ({ ...i, grupo: g.label }))), ...extras.map((i) => ({ ...i, grupo: "Configuração" }))],
    [grupos, extras],
  );
  const buscar = useBuscarPessoasV4(ilustrativo);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaleta((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Fecha a gaveta ao trocar de tela.
  useEffect(() => {
    setGaveta(false);
  }, [pathname]);

  const mudarDensidade = useCallback((d: DensidadeV4) => {
    setDensidade(d);
    definirDensidadeV4(d);
  }, []);
  const mudarSolido = useCallback((v: boolean) => {
    setSolido(v);
    definirSolidoV4(v);
  }, []);
  const alternarMenu = useCallback(() => {
    setMenu((m) => {
      const novo: MenuV4 = m === "nomes" ? "icones" : "nomes";
      definirMenuV4(novo);
      return novo;
    });
  }, []);

  const itensUsuario: ItemMenu[] = [
    ...extras.map((i) => ({ id: i.id, label: i.label, icon: i.icone, href: i.href })),
    ...(extras.length ? [{ tipo: "separador" as const, id: "sep-1" }] : []),
    { tipo: "rotulo", id: "rot-dens", label: "Densidade" },
    { tipo: "radio", id: "dens-compact", label: "Compacta", checked: densidade === "compact", onSelect: () => mudarDensidade("compact") },
    { tipo: "radio", id: "dens-comfortable", label: "Confortável", checked: densidade === "comfortable", onSelect: () => mudarDensidade("comfortable") },
    { tipo: "separador", id: "sep-2" },
    { tipo: "checkbox", id: "solido", label: "Modo sólido (sem vidro)", checked: solido, onCheckedChange: mudarSolido },
    { tipo: "separador", id: "sep-3" },
    { id: "sair", label: "Sair", icon: "sair", onSelect: () => aoSair() },
  ];

  const papelLegivel = ROTULO_PAPEL[papel];
  const passos = onde ? [{ label: onde.grupo }, { label: onde.item }] : [{ label: "CRM" }];

  return (
    <>
      <div className="v4-app">
        <a className="v4-skip" href="#v4-conteudo">
          Pular para o conteúdo
        </a>
        <aside className="v4-side" aria-label="Navegação">
          <div className="v4-side__brand">
            {/* Nome acessível começa pelo texto visível (WCAG 2.5.3); o símbolo é só decoração. */}
            <Link href={inicioDoPapel(papel)} className="v4-brand">
              <span className="v4-brand__mark" aria-hidden="true">
                CRM
              </span>
              <span className="v4-brand__name">{marca}</span>
              <span className="v4-sr">, início</span>
            </Link>
          </div>
          <ListaNav grupos={grupos} atual={atual} badges={badges} recolhida={recolhida} idBase="v4-side" />
          <div className="v4-side__foot">
            {grafite ? (
              <Tooltip content="Mostrar nomes no menu" lado="direita" descreve={false} desligado={!recolhida}>
                <button type="button" className="v4-nav__item v4-side__names" aria-pressed={menu === "nomes"} onClick={alternarMenu}>
                  <Icon name={menu === "nomes" ? "recolher" : "expandir"} size="nav" />
                  <span className="v4-nav__text">Nomes no menu</span>
                </button>
              </Tooltip>
            ) : (
              <Tooltip content="Expandir navegação" lado="direita" descreve={false} desligado={!recolhida}>
                <button type="button" className="v4-nav__item v4-side__expand" aria-label="Expandir navegação" onClick={() => setGaveta(true)}>
                  <Icon name="expandir" size="nav" />
                </button>
              </Tooltip>
            )}
            <DropdownMenu
              label={`Menu de ${nome}`}
              lado="cima-inicio"
              itens={itensUsuario}
              gatilho={(p) => (
                <button
                  ref={p.ref}
                  type="button"
                  className="v4-user"
                  aria-haspopup={p["aria-haspopup"]}
                  aria-expanded={p["aria-expanded"]}
                  aria-controls={p["aria-controls"]}
                  onClick={p.onClick}
                  onKeyDown={p.onKeyDown}
                >
                  <Avatar nome={nome} />
                  <span className="v4-user__meta">
                    <span className="v4-user__name">{nome}</span>
                    <span className="v4-user__role">{papelLegivel}</span>
                  </span>
                  <Icon name="chevronCima" size="sm" />
                  <span className="v4-sr">, abrir menu do usuário</span>
                </button>
              )}
            />
          </div>
        </aside>

        <div className="v4-stage">
          <header className="v4-header">
            <IconButton
              className="v4-header__menu"
              icon="menu"
              label="Abrir menu"
              semTooltip
              aria-haspopup="dialog"
              aria-expanded={gaveta}
              onClick={() => setGaveta(true)}
            />
            <div className="v4-header__where">
              <Breadcrumbs passos={passos} rotulo="Você está em" />
            </div>
            <button type="button" className="v4-header__search" aria-haspopup="dialog" aria-keyshortcuts="Meta+K Control+K" onClick={() => setPaleta(true)}>
              <Icon name="busca" />
              <span>{papel === "trafego" ? "Ir para uma tela" : "Buscar pessoa ou tela"}</span>
              <KeyHint teclas={["⌘", "K"]} />
              <span className="v4-sr">Abrir busca</span>
            </button>
          </header>
          <main id="v4-conteudo" className="v4-main" tabIndex={-1}>
            {children}
          </main>
        </div>
      </div>

      <SidePanel open={gaveta} onClose={() => setGaveta(false)} title="Menu" lado="esquerda">
        <div className="v4-drawer">
          <ListaNav grupos={grupos} atual={atual} badges={badges} recolhida={false} aoIr={() => setGaveta(false)} idBase="v4-gaveta" rotulo="Principal, no menu" />
          <div className="v4-drawer__prefs">
            {extras.map((i) => (
              <Link key={i.id} href={i.href} className="v4-nav__item" aria-current={i.id === atual ? "page" : undefined} onClick={() => setGaveta(false)}>
                <Icon name={i.icone} size="nav" />
                <span className="v4-nav__text">{i.label}</span>
              </Link>
            ))}
            <p className="v4-t-meta">Densidade</p>
            <SegmentedControl
              label="Densidade"
              value={densidade}
              onChange={(v) => mudarDensidade(v === "comfortable" ? "comfortable" : "compact")}
              options={[
                { value: "compact", label: "Compacta" },
                { value: "comfortable", label: "Confortável" },
              ]}
            />
            <Switch checked={solido} onChange={mudarSolido} label="Modo sólido (sem vidro)" stateText={["Ligado", "Desligado"]} />
            <button type="button" className="v4-nav__item" onClick={() => aoSair()}>
              <Icon name="sair" size="nav" />
              <span className="v4-nav__text">Sair</span>
            </button>
            <p className="v4-t-meta">
              {nome} · {papelLegivel}
            </p>
          </div>
        </div>
      </SidePanel>

      <CommandPaletteV4
        aberta={paleta}
        aoFechar={() => setPaleta(false)}
        telas={telas}
        buscarPessoas={buscar}
        podeBuscarPessoas={papel !== "trafego"}
      />
    </>
  );
}
