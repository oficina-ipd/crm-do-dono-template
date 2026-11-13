"use client";

import { Icon, SegmentedControl, useRolagemFocavel } from "../../ui";
import { JANELAS_TAXA, rotuloJanela, type LinhaTaxa } from "./logica";

/**
 * "Taxa por etapa" em faixa recolhível acima do quadro, fechada por padrão.
 * Da entrada na etapa até a seguinte, contra a meta e os últimos 30 dias. Com menos de
 * 10 entradas não há percentual: a tela diz "amostra pequena".
 */
export function FaixaTaxas({
  linhas,
  janela,
  aberta,
  aoAlternar,
  aoMudarJanela,
}: {
  linhas: LinhaTaxa[];
  janela: number;
  aberta: boolean;
  aoAlternar: () => void;
  aoMudarJanela: (n: number) => void;
}) {
  const rolagem = useRolagemFocavel();
  return (
    <section className="v4-taxas" aria-labelledby="v4-taxas-titulo">
      <div className="v4-taxas__cabeca">
        <button type="button" className="v4-taxas__alternar" aria-expanded={aberta} aria-controls="v4-taxas-corpo" onClick={aoAlternar}>
          <Icon name={aberta ? "chevronBaixo" : "chevronDireita"} size="sm" />
          <span id="v4-taxas-titulo" className="v4-taxas__titulo">
            Taxa por etapa
          </span>
          <span className="v4-taxas__janela">{rotuloJanela(janela)}</span>
        </button>
        {aberta && (
          <div className="v4-taxas__periodo">
            <SegmentedControl
              label="Período das taxas"
              value={String(janela)}
              onChange={(v) => aoMudarJanela(Number(v))}
              options={JANELAS_TAXA.map((n) => ({ value: String(n), label: rotuloJanela(n) }))}
            />
          </div>
        )}
      </div>
      {aberta && (
        <div
          id="v4-taxas-corpo"
          ref={rolagem.ref}
          className="v4-taxas__corpo"
          tabIndex={rolagem.focavel ? 0 : undefined}
          role={rolagem.focavel ? "region" : undefined}
          aria-label={rolagem.focavel ? "Taxas de cada etapa, role para ver todas" : undefined}
        >
          <p className="v4-t-meta">Da entrada na etapa até a seguinte. Com menos de 10 entradas no período não há percentual: amostra pequena.</p>
          {linhas.length === 0 ? (
            <p className="v4-t-ui v4-t-2">Nenhuma etapa tem meta de taxa definida.</p>
          ) : (
            <ol className="v4-taxas__lista">
              {linhas.map((l) => (
                <li key={l.etapaId} className="v4-taxas__item">
                  <span className="v4-taxas__par">
                    {l.de} <span aria-hidden="true">→</span>
                    <span className="v4-sr">até</span> {l.para}
                  </span>
                  <span className="v4-taxas__valor">
                    {l.taxa == null ? (
                      <span className="v4-taxas__pequena">amostra pequena</span>
                    ) : (
                      <span className={["v4-num", l.abaixoDaMeta ? "v4-taxas__abaixo" : ""].filter(Boolean).join(" ")}>{l.taxa}%</span>
                    )}
                    {l.abaixoDaMeta && <span className="v4-taxas__abaixo"> abaixo da meta</span>}
                  </span>
                  <span className="v4-taxas__meta">
                    meta <span className="v4-num">{l.meta}%</span>
                    {l.trintaDias != null && (
                      <>
                        {" · "}30 dias <span className="v4-num">{l.trintaDias}%</span>
                      </>
                    )}
                    {" · "}
                    <span className="v4-num">{l.entraram}</span> {l.entraram === 1 ? "entrou" : "entraram"}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}
