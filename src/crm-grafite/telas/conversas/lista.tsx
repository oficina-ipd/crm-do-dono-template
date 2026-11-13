"use client";

import { type MouseEvent, type RefObject } from "react";
import { EmptyState, ListRow, NoResults, Tag } from "../../ui";
import { comQuem, estaParada, formatarParada, previaUltima, rotuloQuando, type NomesConversa, type ResumoConversa } from "./modelo";

/** Etiquetas da linha: âmbar só para "precisa de você"; quem conduz e "sem resposta" viram texto. */
function etiquetas(r: ResumoConversa, nomes: NomesConversa, agoraMs: number) {
  if (r.handoffPendente) return <Tag tom="suavez">Precisa de você</Tag>;
  const partes: string[] = [];
  if (r.dono === "humano") partes.push(comQuem(r.operadorId, nomes));
  if (estaParada(r, agoraMs)) partes.push(formatarParada(r.ultimaEm, agoraMs));
  if (!partes.length) return undefined;
  return <span className="v4-cv-linha-quem v4-t-meta">{partes.join(" · ")}</span>;
}

/** Lista de conversas: só as linhas (título, busca e filtros estão na faixa do topo). */
export function ListaConversas({
  listaRef,
  itens,
  total,
  aberta,
  hrefDe,
  aoAbrir,
  filtrandoAgora,
  busca,
  aoLimpar,
  nomes,
  agoraMs,
}: {
  listaRef: RefObject<HTMLDivElement | null>;
  itens: ResumoConversa[];
  total: number;
  aberta: string | null;
  hrefDe: (id: string) => string;
  aoAbrir: (id: string, e: MouseEvent<HTMLElement>) => void;
  filtrandoAgora: boolean;
  busca: string;
  aoLimpar: () => void;
  nomes: NomesConversa;
  agoraMs: number;
}) {
  const indiceAtual = itens.findIndex((c) => c.contatoId === aberta);
  const agora = new Date(agoraMs);
  return (
    <section className="v4-conv__list v4-cv-lista" aria-label="Lista de conversas">
      <div className="v4-conv__scroll">
        {itens.length === 0 ? (
          filtrandoAgora && total > 0 ? (
            <NoResults nivel={2} termo={busca.trim() || undefined} texto="Nenhuma conversa bate com a busca e os filtros." aoLimpar={aoLimpar} />
          ) : (
            <EmptyState nivel={2} titulo="Nenhuma conversa ainda" texto={`Quando um contato chegar, o ${nomes.nomeRobo} abre a conversa e ela aparece aqui.`} />
          )
        ) : (
          <div ref={listaRef}>
            <ul className="v4-list" aria-label="Conversas, da mais recente para a mais antiga">
              {itens.map((r, i) => (
                <li key={r.contatoId}>
                  <ListRow
                    href={hrefDe(r.contatoId)}
                    onClick={(e) => aoAbrir(r.contatoId, e)}
                    atual={r.contatoId === aberta}
                    tabIndex={i === (indiceAtual < 0 ? 0 : indiceAtual) ? 0 : -1}
                    titulo={
                      <>
                        {r.nome}
                        <span className="v4-cv-linha-tipo"> · {r.tipo === "cliente" ? "Cliente" : "Lead"}</span>
                      </>
                    }
                    meta={<time dateTime={r.ultimaEm}>{rotuloQuando(r.ultimaEm, agora)}</time>}
                    texto={previaUltima(r, nomes)}
                    tags={etiquetas(r, nomes, agoraMs)}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
        {itens.length > 0 && (
          <div className="v4-conv__more">
            <span className="v4-t-meta v4-tabular">{itens.length < total ? `Mostrando ${itens.length} de ${total}` : `Todas as ${total} conversas`}</span>
          </div>
        )}
      </div>
    </section>
  );
}
