/**
 * Andamento: Spinner (com alternativa em movimento reduzido) e esqueletos com a
 * geometria final das peças que vão carregar.
 */

export function Spinner({ label = "Carregando", mostrarTexto = false, tamanho }: { label?: string; mostrarTexto?: boolean; tamanho?: "lg" }) {
  return (
    <span className={["v4-spinner", tamanho === "lg" ? "v4-spinner--lg" : ""].filter(Boolean).join(" ")} role="status">
      <svg className="v4-spinner__ring" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <circle className="is-track" cx="10" cy="10" r="8" />
        <circle className="is-arc" cx="10" cy="10" r="8" />
      </svg>
      <span className="v4-spinner__dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      {mostrarTexto ? <span>{label}</span> : <span className="v4-sr">{label}</span>}
    </span>
  );
}

type Largura = 20 | 30 | 40 | 50 | 60 | 70 | 80 | 90 | 100;

export function Skeleton({
  forma = "text",
  largura,
}: {
  forma?: "text" | "title" | "avatar" | "control" | "bubble";
  largura?: Largura;
}) {
  return <span aria-hidden="true" className={["v4-skel", `v4-skel--${forma}`, largura ? `v4-skel--w${largura}` : ""].filter(Boolean).join(" ")} />;
}

/**
 * Bloco de esqueleto com rótulo para leitor de tela ("Carregando conversas"). `comoTitulo`: o
 * esqueleto é a tela inteira (loading.tsx), então o rótulo vira o h1 dela, só para leitor de tela.
 */
export function SkeletonGroup({ label, children, comoTitulo = false }: { label: string; children: React.ReactNode; comoTitulo?: boolean }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      {comoTitulo ? <h1 className="v4-sr">{label}</h1> : <span className="v4-sr">{label}</span>}
      {children}
    </div>
  );
}

/** Mesma geometria de ListRow com avatar (lista de conversas). */
export function SkeletonListRow({ largura = 70 }: { largura?: Largura }) {
  return (
    <div className="v4-skel-listrow" aria-hidden="true">
      <Skeleton forma="avatar" />
      <Skeleton largura={40} />
      <Skeleton largura={largura} />
    </div>
  );
}

/** Mesma geometria de uma linha da Table. */
export function SkeletonTableRows({ colunas, linhas = 5, selecionavel }: { colunas: number; linhas?: number; selecionavel?: boolean }) {
  const larguras: Largura[] = [60, 40, 50, 30, 70, 40, 50];
  return (
    <>
      {Array.from({ length: linhas }, (_, r) => (
        <tr key={r} aria-hidden="true">
          {selecionavel && (
            <td className="is-check">
              <Skeleton largura={100} />
            </td>
          )}
          {Array.from({ length: colunas }, (_, c) => (
            <td key={c}>
              <Skeleton largura={larguras[(r + c) % larguras.length]} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
