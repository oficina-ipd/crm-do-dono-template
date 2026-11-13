import { Icon, type IconeV4 } from "./icon";

export type TagTom = "neutro" | "lead" | "member" | "etapa" | "sucesso" | "atencao" | "erro" | "info" | "suavez";

/**
 * Etiqueta sempre com texto. A cor reforça, nunca carrega sozinha o sentido:
 * Lead tem contorno, Member tem preenchimento, estados têm ícone opcional.
 */
export function Tag({ tom = "neutro", icon, children }: { tom?: TagTom; icon?: IconeV4; children: React.ReactNode }) {
  return (
    <span className={["v4-tag", tom !== "neutro" ? `v4-tag--${tom}` : ""].filter(Boolean).join(" ")}>
      {icon && <Icon name={icon} />}
      {children}
    </span>
  );
}

/** Tipo da pessoa no CRM: lead de venda ou member da comunidade. */
export function TipoTag({ tipo }: { tipo: "lead" | "member" }) {
  return tipo === "member" ? <Tag tom="member">Cliente</Tag> : <Tag tom="lead">Lead</Tag>;
}

/** Contagem. `suaVez` pinta de âmbar: "precisa de uma pessoa agora". */
export function Badge({ n, suaVez, rotulo }: { n: number; suaVez?: boolean; rotulo: string }) {
  if (n <= 0) return null;
  return (
    <span className={["v4-badge", suaVez ? "v4-badge--suavez" : ""].filter(Boolean).join(" ")}>
      <span aria-hidden="true">{n > 99 ? "99+" : n}</span>
      <span className="v4-sr">
        {n} {rotulo}
      </span>
    </span>
  );
}

export function iniciaisV4(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  const a = partes[0][0] ?? "";
  const b = partes.length > 1 ? partes[partes.length - 1][0] ?? "" : "";
  return (a + b).toUpperCase();
}

/** Avatar de iniciais. Decorativo: o nome aparece ao lado. Cláudio tem marcador próprio, neutro. */
export function Avatar({ nome, claudio, tamanho }: { nome: string; claudio?: boolean; tamanho?: "sm" | "lg" }) {
  return (
    <span
      aria-hidden="true"
      className={["v4-avatar", claudio ? "v4-avatar--claudio" : "", tamanho ? `v4-avatar--${tamanho}` : ""].filter(Boolean).join(" ")}
    >
      {claudio ? "C" : iniciaisV4(nome)}
    </span>
  );
}

const LEITURA_TECLA: Record<string, string> = {
  "⌘": "Command",
  "⌃": "Control",
  "⇧": "Shift",
  "⌥": "Option",
  "↵": "Enter",
  Esc: "Escape",
  "↑": "seta para cima",
  "↓": "seta para baixo",
};

/** Atalho de teclado. `teclas` em ordem: ["⌘", "K"]. */
export function KeyHint({ teclas }: { teclas: string[] }) {
  const lido = teclas.map((t) => LEITURA_TECLA[t] ?? t).join(" + ");
  return (
    <kbd className="v4-kbd">
      <span aria-hidden="true">{teclas.join("")}</span>
      <span className="v4-sr">{lido}</span>
    </kbd>
  );
}

export function Divider({ vertical, rotulo }: { vertical?: boolean; rotulo?: string }) {
  if (rotulo) {
    return (
      <div className="v4-divider-label" role="separator" aria-label={rotulo}>
        <span aria-hidden="true">{rotulo}</span>
      </div>
    );
  }
  return <hr className={["v4-divider", vertical ? "v4-divider--v" : ""].filter(Boolean).join(" ")} aria-orientation={vertical ? "vertical" : undefined} />;
}
