"use client";

import { useMemo } from "react";
import { useCRM } from "@/components/crm/provider";
import { irPara, useSearchParams } from "../../link";
import { Button, ButtonLink, EmptyState, FaixaTopo } from "../../ui";
import { BriefingPainel, CabecalhoFicha, ColunaPrincipal, ContatoPainel, NegocioPainel, NotasPainel, PainelPorQue, ProximaAcao } from "./partes";
import { EmailPainel, PropostaPagamentoPainel } from "./proposta";
import { ResumoComportamento } from "./resumo-360";
import { destinoCurto, destinoVoltar } from "./voltar";
import "../../styles/telas/conversas.css";
import "../../styles/telas/ficha.css";

/**
 * Ficha da pessoa. Faixa do topo com voltar, nome, quem é e as ações (Abrir conversa, Ligar,
 * Criar tarefa, Mover para…); coluna principal com a conversa (a mesma de Conversas) e o histórico
 * 360 (linha do tempo única por dia, filtrável); coluna lateral com por que pediu uma pessoa, o
 * resumo de comportamento, próxima ação, contato (identidade), negócio (só o que tem dado),
 * briefing recolhível, proposta e pagamento, notas e e-mail.
 */
export function TelaFicha({ contatoId }: { contatoId: string }) {
  const { contato, estado } = useCRM();
  const sp = useSearchParams();
  const de = sp.get("de");
  // Uma visão nova só quando o estado muda (o relógio de 30 s não refaz a linha do tempo).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const c = useMemo(() => contato(contatoId), [estado, contatoId]);

  if (!c) {
    const volta = destinoVoltar(de);
    return (
      <div data-v4-tela className="v4-tela-ficha v4-cv-escolha">
        <FaixaTopo
          titulo="Pessoa não encontrada"
          inicio={
            <Button size="sm" variant="ghost" icon="chevronEsquerda" className="v4-fi-voltar" aria-label={volta.rotulo} onClick={() => irPara(volta.href)}>
              <span className="v4-fi-voltar__texto">{destinoCurto(volta.rotulo)}</span>
            </Button>
          }
        />
        <EmptyState
          centro
          nivel={2}
          titulo="Esta pessoa não está no CRM"
          texto="Ela pode ter sido apagada ou o endereço está incompleto. Procure pelo nome em Pessoas ou na busca (⌘K)."
          acoes={
            <ButtonLink href="/pessoas" variant="secondary" icon="pessoas">
              Ir para Pessoas
            </ButtonLink>
          }
        />
      </div>
    );
  }

  return (
    <div key={c.id} data-v4-tela className="v4-tela-ficha v4-fi">
      <CabecalhoFicha c={c} de={de} />
      <div className="v4-fi-grade">
        <ColunaPrincipal c={c} />
        <aside className="v4-fi-lateral v4-panel" aria-label={`Resumo de ${c.nome}`}>
          <div className="v4-fi-lateral__rolagem">
            <PainelPorQue c={c} />
            <ResumoComportamento c={c} />
            <ProximaAcao c={c} />
            <ContatoPainel c={c} />
            <NegocioPainel c={c} />
            <BriefingPainel c={c} />
            <PropostaPagamentoPainel c={c} />
            <NotasPainel c={c} />
            <EmailPainel c={c} />
          </div>
        </aside>
      </div>
    </div>
  );
}
