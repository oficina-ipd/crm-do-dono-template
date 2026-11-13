/**
 * Envio do Composer com UMA trava compartilhada entre o botão Enviar e o atalho ⌘Enter.
 * A trava é síncrona (variável, não estado do React): dois disparos antes do próximo
 * render não chamam `aoEnviar` duas vezes. Puro, testável sem DOM.
 */
export type TeclaComposer = { key: string; metaKey: boolean; ctrlKey: boolean; preventDefault: () => void };

export function criarEnvioComposer(deps: {
  ler: () => string;
  limite: number;
  bloqueado: () => boolean;
  aoEnviar: (texto: string) => Promise<boolean>;
  aoMudarEnviando: (v: boolean) => void;
  aoLimpar: () => void;
}) {
  let ocupado = false;

  async function enviar(): Promise<void> {
    if (ocupado) return;
    const texto = deps.ler();
    if (deps.bloqueado() || texto.trim().length === 0 || texto.length > deps.limite) return;
    ocupado = true;
    deps.aoMudarEnviando(true);
    try {
      const ok = await deps.aoEnviar(texto.trim());
      if (ok) deps.aoLimpar();
    } finally {
      ocupado = false;
      deps.aoMudarEnviando(false);
    }
  }

  function teclar(e: TeclaComposer): void {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void enviar();
    }
  }

  return { enviar, teclar, ocupado: () => ocupado };
}
