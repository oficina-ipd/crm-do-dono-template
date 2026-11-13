"use client";

import Link from "@/crm-grafite/link";
import { memo } from "react";
import { formatarReais } from "@/domain/rules";
import { diaMes, nomeEmExibicao } from "@/lib/crm/format";
import { DropdownMenu, Icon, Spinner, type ItemMenu } from "../../ui";
import { tempoNaEtapa, type CartaoFunil, type OpcoesMover, type PerdidaNaTrave } from "./logica";

/**
 * Cartão do quadro. O nome é um link real para a ficha; a área do cartão inteira leva ao mesmo
 * lugar. "Mover" abre o menu com a próxima etapa possível, a perda e a ficha. Teclado: setas
 * andam entre cartões, M abre o menu. Quem só lê (papel leitura) não vê o menu.
 */
export const CartaoFunilV4 = memo(function CartaoFunilV4({
  cartao,
  href,
  parado,
  opcoes,
  agora,
  movendo,
  somenteLeitura,
  aoAvancar,
  aoPerder,
}: {
  cartao: CartaoFunil;
  href: string;
  parado: boolean;
  opcoes: OpcoesMover;
  agora: Date;
  movendo: boolean;
  somenteLeitura: boolean;
  aoAvancar: (c: CartaoFunil, para: NonNullable<OpcoesMover["avancar"]>) => void;
  aoPerder: (c: CartaoFunil) => void;
}) {
  const nome = nomeEmExibicao(cartao.contatoNome);
  const tempo = tempoNaEtapa(cartao.etapaDesde, agora);
  const tarefa = cartao.proximaTarefa;
  const atrasada = Boolean(tarefa?.venceEm && new Date(tarefa.venceEm).getTime() < agora.getTime());

  const itens: ItemMenu[] = [
    { tipo: "rotulo", id: "rot", label: "Mover para" },
    ...(opcoes.avancar
      ? [{ id: "avancar", label: opcoes.avancar.nome, icon: "chevronDireita" as const, onSelect: () => opcoes.avancar && aoAvancar(cartao, opcoes.avancar) }]
      : opcoes.automatica
        ? [{ id: "auto", label: `${opcoes.automatica.nome}: o sistema move`, disabled: true }]
        : [{ id: "ultima", label: "Já está na última etapa", disabled: true }]),
    { tipo: "separador", id: "sep" },
    {
      id: "perder",
      label: "Marcar como perdida…",
      icon: "fechar",
      danger: true,
      disabled: opcoes.motivosPerda.length === 0,
      onSelect: () => aoPerder(cartao),
    },
    { id: "ficha", label: "Abrir ficha", icon: "pessoas", href },
  ];

  return (
    <li className="v4-cartao" data-cartao={cartao.id} data-parado={parado || undefined} aria-busy={movendo || undefined}>
      <div className="v4-cartao__topo">
        <Link href={href} className="v4-cartao__link" aria-keyshortcuts={somenteLeitura ? undefined : "M"} title={nome}>
          {nome}
        </Link>
        {somenteLeitura ? null : movendo ? (
          <span className="v4-cartao__acima">
            <Spinner label={`Movendo ${nome}`} />
          </span>
        ) : (
          <DropdownMenu
            label={`Mover ${nome}`}
            lado="baixo-fim"
            itens={itens}
            gatilho={(p) => (
              <button
                ref={p.ref}
                type="button"
                className="v4-btn v4-btn--ghost v4-btn--sm v4-cartao__mover v4-cartao__acima"
                aria-haspopup={p["aria-haspopup"]}
                aria-expanded={p["aria-expanded"]}
                aria-controls={p["aria-controls"]}
                onClick={p.onClick}
                onKeyDown={p.onKeyDown}
              >
                <span className="v4-btn__label">
                  Mover
                  <Icon name="chevronBaixo" size="sm" />
                </span>
                <span className="v4-sr"> {nome} para…</span>
              </button>
            )}
          />
        )}
      </div>
      <div className="v4-cartao__linha">
        {cartao.empresa && <span className="v4-cartao__empresa">{cartao.empresa}</span>}
        <span className="v4-num v4-cartao__valor">{formatarReais(cartao.valor)}</span>
      </div>
      <p className="v4-cartao__meta">
        {parado ? (
          <span className="v4-cartao__parado">
            <Icon name="relogio" size="sm" />
            parado há {tempo.texto}
            <span className="v4-sr">, passou do prazo da etapa</span>
          </span>
        ) : (
          <>{tempo.texto} na etapa</>
        )}
        {" · "}
        <span className="v4-sr">conduz </span>
        {cartao.conduz}
        {cartao.bateuNaTrave && <span className="v4-cartao__trave"> · bateu na trave</span>}
      </p>
      {tarefa ? (
        <p className={["v4-cartao__tarefa", atrasada ? "is-atrasada" : ""].filter(Boolean).join(" ")}>
          <Icon name={atrasada ? "alerta" : "tarefas"} size="sm" />
          <span className="v4-cartao__tarefa-texto">{tarefa.titulo}</span>
          {tarefa.venceEm && <span className="v4-cartao__tarefa-data">{atrasada ? `atrasada · ${diaMes(tarefa.venceEm)}` : diaMes(tarefa.venceEm)}</span>}
        </p>
      ) : cartao.proximaAcao ? (
        <p className="v4-cartao__tarefa">
          <Icon name="nota" size="sm" />
          <span className="v4-cartao__tarefa-texto">{cartao.proximaAcao}</span>
        </p>
      ) : (
        <p className="v4-cartao__tarefa is-vazia">Sem tarefa aberta</p>
      )}
    </li>
  );
});

/** Cartão da perdida que bateu na trave: não se move; quem pode escrever reabre. */
export function CartaoPerdida({
  p,
  href,
  somenteLeitura,
  reabrindo,
  aoReabrir,
}: {
  p: PerdidaNaTrave;
  href: string;
  somenteLeitura: boolean;
  reabrindo: boolean;
  aoReabrir: (p: PerdidaNaTrave) => void;
}) {
  const nome = nomeEmExibicao(p.contatoNome);
  return (
    <li className="v4-cartao v4-cartao--perdida" aria-busy={reabrindo || undefined}>
      <div className="v4-cartao__topo">
        <Link href={href} className="v4-cartao__link" title={nome}>
          {nome}
        </Link>
        {!somenteLeitura &&
          (reabrindo ? (
            <span className="v4-cartao__acima">
              <Spinner label={`Reabrindo ${nome}`} />
            </span>
          ) : (
            <button type="button" className="v4-btn v4-btn--ghost v4-btn--sm v4-cartao__mover v4-cartao__acima" onClick={() => aoReabrir(p)}>
              <span className="v4-btn__label">
                <Icon name="recarregar" size="sm" />
                Reabrir
              </span>
              <span className="v4-sr"> a oportunidade de {nome}</span>
            </button>
          ))}
      </div>
      <div className="v4-cartao__linha">
        <span className="v4-num v4-cartao__valor">{formatarReais(p.valor)}</span>
        {p.desde && <span className="v4-cartao__tempo">perdida em {diaMes(p.desde)}</span>}
      </div>
      <p className="v4-cartao__meta">
        <span className="v4-t-3">Motivo</span> {p.motivo ?? "não informado"}
      </p>
    </li>
  );
}
