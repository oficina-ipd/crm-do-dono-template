/**
 * Gravação nas telas de configuração e rotina (Grafite). Puro, sem React.
 *
 * `despachar` do provedor já mostra o erro de regra num aviso e devolve null. As telas com
 * formulário precisam da mensagem junto do botão (estado "falhou"), então validam antes
 * com a mesma função pura do domínio: a regra é uma só, e o aviso não aparece duas vezes.
 */
import { aplicar, ErroDeRegra, type Comando } from "@/domain/comandos";
import type { EstadoCRM, Operador } from "@/domain/types";

/** Mensagem da regra que barraria o comando, ou null se ele passa. Não grava nada. */
export function erroDeRegra(estado: EstadoCRM, cmd: Comando, agora: string): string | null {
  try {
    aplicar(estado, cmd, { agora, novoId: () => "validacao" });
    return null;
  } catch (e) {
    return e instanceof ErroDeRegra ? e.message : null;
  }
}

/** Quem só lê não vê botão de escrita. */
export function podeEscrever(operador: Pick<Operador, "papel"> | null | undefined): boolean {
  return Boolean(operador) && operador?.papel !== "leitura";
}

/** Texto do erro quando o CRM não confirmou a gravação (rede, servidor). */
export const ERRO_SEM_CONFIRMACAO = "o CRM não confirmou a gravação. Tente de novo.";
