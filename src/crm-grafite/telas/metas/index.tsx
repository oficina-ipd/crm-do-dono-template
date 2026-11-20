"use client";

import { useMemo } from "react";
import { useCRM } from "@/components/crm/provider";
import Link, { usePathname, useRouter, useSearchParams } from "@/crm-grafite/link";
import { Icon, Panel, SegmentedControl, Table } from "../../ui";
import { CabecalhoTela, TelaV4 } from "../base-demais/tela";
import { PERIODOS_METAS, intervaloMetas, linhasMetas, periodoMetasValido, resumoMetas, textoPeriodoMetas, textoSituacao } from "./metas-logica";
import "../../styles/telas/resultados.css";
import "../../styles/telas/metas.css";

/**
 * Metas: a meta de cada etapa do funil contra o realizado no período. Somente leitura: no
 * template a meta é fixa na configuração do funil e não existe comando para editá-la aqui.
 * (O roteador já mostra "sem permissão" para quem não é dono.)
 */
export function TelaMetas() {
  const { estado, agora } = useCRM();
  const router = useRouter();
  const pathname = usePathname() || "/config/metas";
  const sp = useSearchParams();
  const periodo = periodoMetasValido(sp.get("periodo"));
  const linhas = useMemo(() => linhasMetas(estado, intervaloMetas(periodo, agora)), [estado, agora, periodo]);

  return (
    <TelaV4 area="metas">
      <CabecalhoTela
        titulo="Metas"
        meta={resumoMetas(linhas)}
        acoes={
          <SegmentedControl
            label="Período do realizado"
            value={periodo}
            onChange={(v) => router.replace(`${pathname}?periodo=${v}`)}
            options={PERIODOS_METAS.map((p) => ({ value: p.value, label: p.label }))}
          />
        }
      />

      <Panel titulo={`Taxa por etapa: meta e realizado ${textoPeriodoMetas(periodo)}`} semRecuo>
        <Table
          rotulo="Meta de conversão de cada etapa contra o realizado no período, em porcentagem"
          chave={(l) => l.etapaId}
          linhas={linhas}
          colunas={[
            {
              id: "etapa",
              titulo: "Etapa",
              quebrar: true,
              celula: (l) => (
                <span className="v4-metas__etapa">
                  <span className="v4-t-medium">
                    {l.de} → {l.para}
                  </span>
                  <span className="v4-t-meta">Conta como avanço quando: {l.validacao}</span>
                </span>
              ),
            },
            { id: "meta", titulo: "Meta", numerica: true, celula: (l) => <span className="v4-num">{l.meta}%</span> },
            { id: "real", titulo: "Realizado", numerica: true, celula: (l) => <span className={l.situacao === "sem" ? "v4-t-3" : "v4-num"}>{l.realTexto}</span> },
            { id: "n", titulo: "Entraram", numerica: true, celula: (l) => <span className="v4-num">{l.entraram}</span> },
            {
              id: "sit",
              titulo: "Situação",
              quebrar: true,
              celula: (l) => (
                <span className={`v4-res__taxa v4-res__taxa--${l.situacao}`}>
                  {l.situacao === "abaixo" && <Icon name="alerta" />}
                  {l.situacao === "acima" && <Icon name="sucesso" />}
                  <span>{textoSituacao(l)}</span>
                </span>
              ),
            },
            { id: "prazo", titulo: "Prazo parado", celula: (l) => <span className="v4-tabular">{l.prazoTexto}</span> },
          ]}
        />
        <p className="v4-t-meta v4-res__nota">
          Realizado: de quem entrou na etapa no período, quantos chegaram a uma etapa seguinte. Com menos de 10 entradas não há comparação, só a contagem.
          O prazo parado é o tempo que uma oportunidade pode ficar na etapa antes de aparecer como atrasada.{" "}
          <Link className="v4-link" href="/placar">
            Ver todos os números em Resultados
          </Link>
        </p>
      </Panel>

      <Panel titulo="Como mudar as metas">
        <div className="v4-metas__como">
          <p className="v4-t-ui">
            As metas ficam junto das etapas do funil, na configuração do CRM, e valem para toda a equipe. Esta tela mostra as metas; ainda não dá para
            editá-las por aqui.
          </p>
          <p className="v4-t-ui v4-t-2">
            Para mudar, peça a quem instalou o CRM (ou ao assistente de código que você usa) para trocar o número da meta de cada etapa no arquivo do funil,{" "}
            <code className="v4-metas__arquivo">src/domain/funil.ts</code>. Nada do que já foi registrado muda: só a comparação.
          </p>
          <p className="v4-t-meta">Este CRM não tem meta de faturamento nem meta diária de vendas. Escolha as suas metas e revise depois de 30 dias com o dado real.</p>
        </div>
      </Panel>
    </TelaV4>
  );
}
