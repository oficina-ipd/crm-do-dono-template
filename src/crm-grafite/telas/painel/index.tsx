"use client";

import { useEffect, useMemo, useState } from "react";
import { useCRM } from "@/components/crm/provider";
import { usePathname, useRouter, useSearchParams } from "@/crm-grafite/link";
import { FaixaTopo, SegmentedControl } from "../../ui";
import { AtividadeVista, ConversasHojeVista, EmailsVista, FunilVista, MesVista, OrigemVista, RoboVista } from "./cartoes";
import {
  DESTINOS,
  PERIODOS_PAINEL,
  ROTULO_PERIODO,
  conversasDeHoje,
  dataDaFaixa,
  hora,
  hrefPeriodo,
  janelaDoPeriodo,
  montarAbertura,
  montarAtividade,
  montarEmails,
  montarFunil,
  montarOrigem,
  montarPrecisa,
  montarRobo,
  periodoValido,
  seriesDoGrafico,
  vendasDoMes,
} from "./logica";
import { AberturaVista, GraficoVista, PrecisaVista } from "./vivos";
import "../../styles/telas/base-demais.css";
import "../../styles/telas/painel.css";

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/**
 * O "agora" do Painel: acompanha o relógio do CRM (que anda a cada 30 s) só com a aba visível; ao
 * voltar para a aba, pega a hora na mesma hora. Os números estão em memória: recalcular basta.
 */
function useAgoraVisivel(agora: string): string {
  const [visto, setVisto] = useState(agora);
  useEffect(() => {
    if (document.visibilityState === "visible") setVisto(agora);
  }, [agora]);
  useEffect(() => {
    const aoVoltar = () => {
      if (document.visibilityState === "visible") setVisto(new Date().toISOString());
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => document.removeEventListener("visibilitychange", aoVoltar);
  }, []);
  return visto;
}

/**
 * Painel de entrada em grade bento: cartões independentes calculados do estado do CRM, com
 * período (hoje, 7 dias, 30 dias, mês atual) e comparação com o mesmo trecho do período anterior.
 * O período fica na URL (`?periodo=`). Cada número leva à tela que o compõe. Só leitura: nenhum
 * cartão escreve nada, então o papel `leitura` vê o mesmo que os outros.
 */
export function TelaPainel() {
  const { estado, agora: agoraCrm, operador } = useCRM();
  const agora = useAgoraVisivel(agoraCrm);
  const router = useRouter();
  const pathname = usePathname() || "/painel";
  const sp = useSearchParams();
  const periodo = periodoValido(sp.get("periodo"));
  const nomeRobo = estado.config.nomeRobo;

  const j = useMemo(() => janelaDoPeriodo(periodo, agora), [periodo, agora]);
  const abertura = useMemo(() => montarAbertura(estado, agora, operador?.nome ?? ""), [estado, agora, operador?.nome]);
  const precisa = useMemo(() => montarPrecisa(estado, agora), [estado, agora]);
  const robo = useMemo(() => montarRobo(estado, j), [estado, j]);
  const mes = useMemo(() => vendasDoMes(estado, agora), [estado, agora]);
  const series = useMemo(() => seriesDoGrafico(mes, estado.mensagens, agora), [mes, estado.mensagens, agora]);
  const origem = useMemo(() => montarOrigem(estado, j), [estado, j]);
  const emails = useMemo(() => montarEmails(estado, j), [estado, j]);
  const atividade = useMemo(() => montarAtividade(estado, agora), [estado, agora]);
  const hoje = useMemo(() => conversasDeHoje(estado.mensagens, agora), [estado.mensagens, agora]);
  const funil = useMemo(() => montarFunil(estado, j, agora), [estado, j, agora]);

  const atualizado = (
    <span className="v4-t-meta v4-pn-atualizado" role="status">
      {dataDaFaixa(agora)} · atualizado às {hora(agora)}
    </span>
  );
  const controles = (
    <SegmentedControl
      label="Período dos números"
      value={periodo}
      onChange={(v) => router.replace(hrefPeriodo(pathname, periodoValido(v)))}
      options={PERIODOS_PAINEL.map((p) => ({ value: p, label: ROTULO_PERIODO[p] }))}
    />
  );

  return (
    <div data-v4-tela className="v4-tela v4-pn">
      <FaixaTopo titulo="Painel" contagem={atualizado}>
        {controles}
      </FaixaTopo>
      <div className="v4-pn-area">
        {/* Tela estreita: a faixa só cabe o título; período e hora descem para cá. O CSS mostra
            um conjunto ou o outro (display: none tira o escondido da leitura e do teclado). */}
        <div className="v4-pn-barra">
          {controles}
          {atualizado}
        </div>
        <div className="v4-pn-grade">
          <AberturaVista a={abertura} />
          <PrecisaVista p={precisa} agoraIso={agora} nomeRobo={nomeRobo} />
          <RoboVista d={robo} j={j} nomeRobo={nomeRobo} />
          <GraficoVista series={series} diasNoMes={mes.diasNoMes} mes={MESES_CURTOS[new Date(agora).getMonth()]} href={DESTINOS.resultados} />
          <OrigemVista d={origem} j={j} />
          <EmailsVista d={emails} j={j} />
          <MesVista d={mes} />
          <AtividadeVista linhas={atividade} />
          <ConversasHojeVista h={hoje} />
          <FunilVista d={funil} j={j} />
        </div>
      </div>
    </div>
  );
}
