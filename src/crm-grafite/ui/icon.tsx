/**
 * Ícones da v4: SVG desenhados à mão no mesmo traço (1,6 px, cantos redondos, grade 24).
 * Decorativos por padrão (aria-hidden). Para ícone com significado próprio, passe `label`.
 */
const PATHS = {
  fila: "M4 6h16M4 12h10M4 18h7M17 15l2 2 3-4",
  conversas: "M5 18.5V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H8.5L5 18.5ZM9 9.5h6M9 12.5h4",
  funil: "M4 5h16l-6 7.5V18l-4 2v-7.5L4 5Z",
  pessoas: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM3 20c.6-3.4 3-5.5 6-5.5s5.4 2.1 6 5.5M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14.8c1.6.8 2.7 2.5 3 5.2",
  tarefas: "M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2",
  agentes: "M12 3v3M7 7h10a2 2 0 0 1 2 2v7a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V9a2 2 0 0 1 2-2ZM9.5 12.5v.01M14.5 12.5v.01M9.5 16h5",
  relance: "M4 12a8 8 0 0 1 14.3-4.9M20 12a8 8 0 0 1-14.3 4.9M18.5 3.5v4h-4M5.5 20.5v-4h4",
  resultados: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  origem: "M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11ZM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  metas: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 12h.01",
  sessao: "M7 11V8a5 5 0 0 1 10 0v3M6 11h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1ZM12 15v2",
  ocorrencias: "M12 4 3 19.5h18L12 4ZM12 10v4.5M12 17.2v.01",
  integracao: "M9 7 4 12l5 5M15 7l5 5-5 5M13.5 5l-3 14",
  busca: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4",
  fechar: "M6 6l12 12M18 6 6 18",
  menu: "M4 7h16M4 12h16M4 17h16",
  mais: "M5 12h.01M12 12h.01M19 12h.01",
  maisVertical: "M12 5h.01M12 12h.01M12 19h.01",
  chevronBaixo: "m6 9 6 6 6-6",
  chevronCima: "m6 15 6-6 6 6",
  chevronDireita: "m9 6 6 6-6 6",
  chevronEsquerda: "m15 6-6 6 6 6",
  ordenar: "M8 4v16M4 8l4-4 4 4M16 20V4M12 16l4 4 4-4",
  ordenarCima: "M12 19V5M6 11l6-6 6 6",
  ordenarBaixo: "M12 5v14M6 13l6 6 6-6",
  check: "m5 12.5 4.5 4.5L19 7.5",
  menos: "M6 12h12",
  mais_: "M12 5v14M5 12h14",
  enviar: "M5 12 4 4.5 20 12 4 19.5 5 12Zm0 0h7",
  relogio: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7.5V12l3 2",
  alerta: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7.5v5M12 16v.01",
  erro: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9 9l6 6M15 9l-6 6",
  sucesso: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8 12.5l2.7 2.7L16 9.8",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 8v.01",
  telefone: "M5 4h3l1.5 4-2 1.3a10 10 0 0 0 7.2 7.2L16 14.5l4 1.5v3a1.5 1.5 0 0 1-1.6 1.5C10.6 20 4 13.4 3.5 5.6A1.5 1.5 0 0 1 5 4Z",
  sair: "M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10",
  densidade: "M4 6h16M4 10h16M4 14h16M4 18h16",
  solido: "M5 5h14v14H5z",
  cadeado: "M7 11V8a5 5 0 0 1 10 0v3M6 11h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z",
  vazio: "M4 13h4l1.5 2.5h5L16 13h4M5.5 6h13l1.5 7v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5l1.5-7Z",
  recarregar: "M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6",
  transferir: "M7 7h13M16 3l4 4-4 4M17 17H4M8 13l-4 4 4 4",
  devolver: "M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3",
  assumir: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 20c.7-3.6 3.5-6 7-6M16 17l2 2 4-4",
  expandir: "m9 6 6 6-6 6M4 4v16",
  recolher: "m15 6-6 6 6 6M20 4v16",
  filtro: "M4 6h16M7 12h10M10 18h4",
  nota: "M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM15 3v4h4M8.5 12h7M8.5 16h5",
  olho: "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12ZM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  editar: "M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4",
  lixeira: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5",
  produto: "M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9ZM4 7.5l8 4.5 8-4.5M12 12v9",
  equipe: "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2.5 19c.5-3 2.7-5 5.5-5s5 2 5.5 5M13.5 14.3c.8-.2 1.6-.3 2.5-.3 2.8 0 5 2 5.5 5",
  modelo: "M5 4h14v16H5zM8.5 8.5h7M8.5 12h7M8.5 15.5h4",
  livro: "M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5v-15ZM5 19.5A1.5 1.5 0 0 0 6.5 21H19M9 7h6",
} as const;

export type IconeV4 = keyof typeof PATHS;

export function Icon({
  name,
  size,
  label,
  className,
}: {
  name: IconeV4;
  size?: "sm" | "nav";
  label?: string;
  className?: string;
}) {
  const cls = ["v4-icon", size ? `v4-icon--${size}` : "", className ?? ""].filter(Boolean).join(" ");
  return (
    <svg
      className={cls}
      viewBox="0 0 24 24"
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
