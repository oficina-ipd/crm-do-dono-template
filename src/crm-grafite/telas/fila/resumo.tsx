"use client";

import { formatarReais } from "@/domain/rules";
import { Panel } from "../../ui";
import { duracaoLonga, plural, type ResumoDia } from "./resumo-logica";

/**
 * Resumo do dia em texto, com período e unidade em cada número. Sem gráfico e sem cartão de
 * métrica; só o que o estado do CRM permite calcular (sem meta: o template não tem meta de vendas).
 */
export function ResumoDiaVista({ resumo, nomeRobo }: { resumo: ResumoDia; nomeRobo: string }) {
  const { vendas, espera, leads } = resumo;
  return (
    <Panel titulo="Resumo do dia">
      <dl className="v4-resumo">
        <div className="v4-resumo__item">
          <dt className="v4-resumo__rotulo">Vendas em {vendas.mesNome}</dt>
          <dd className="v4-resumo__valor">
            <span className="v4-resumo__n">{vendas.noMes}</span> {vendas.noMes === 1 ? "venda" : "vendas"}
          </dd>
          <dd className="v4-resumo__nota">
            {formatarReais(vendas.recebidoMes)} recebidos no mês. {plural(vendas.hoje, "venda", "vendas")} hoje.
            {vendas.previsaoFimDoMes != null && ` No ritmo atual, ${plural(vendas.previsaoFimDoMes, "venda", "vendas")} até ${vendas.ultimoDia}.`}
          </dd>
        </div>

        <div className="v4-resumo__item">
          <dt className="v4-resumo__rotulo">Esperando uma pessoa agora</dt>
          <dd className="v4-resumo__valor">
            {espera.esperando > 0 ? (
              <>
                <span className="v4-resumo__n">{espera.esperando}</span> {espera.esperando === 1 ? "pessoa" : "pessoas"}
              </>
            ) : (
              "Ninguém esperando"
            )}
          </dd>
          <dd className="v4-resumo__nota">
            {espera.maiorEsperaMin != null && `Quem pediu primeiro espera há ${duracaoLonga(espera.maiorEsperaMin)}. `}
            {espera.prazoMin > 0 && `Prazo para assumir: ${duracaoLonga(espera.prazoMin)}`}
            {espera.prazoMin > 0 && (espera.foraDoPrazo > 0 ? `; ${plural(espera.foraDoPrazo, "já passou", "já passaram")}.` : ".")}
          </dd>
        </div>

        <div className="v4-resumo__item">
          <dt className="v4-resumo__rotulo">Leads novos hoje</dt>
          <dd className="v4-resumo__valor">
            <span className="v4-resumo__n">{leads.hoje}</span> {leads.hoje === 1 ? "lead" : "leads"}
          </dd>
          <dd className="v4-resumo__nota">
            {leads.conversaramHoje > 0
              ? `${plural(leads.conversaramHoje, "começou", "começaram")} a conversar com ${nomeRobo} desde 00:00.`
              : `Ninguém começou a conversar com ${nomeRobo} desde 00:00.`}
          </dd>
        </div>
      </dl>
    </Panel>
  );
}
