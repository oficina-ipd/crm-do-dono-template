/**
 * Botão principal da barra de posse. Com aviso automático: o primeiro clique mostra o aviso;
 * com o aviso visível, o MESMO botão confirma e assume (cancelar fica no secundário).
 * Um segundo clique logo depois de abrir (duplo clique) é ignorado, para não pular a leitura.
 */
export const JANELA_DUPLO_CLIQUE_MS = 400;

export function acaoDoBotaoAssumir({
  temAviso,
  confirmando,
  abertaHaMs = Infinity,
}: {
  temAviso: boolean;
  confirmando: boolean;
  abertaHaMs?: number;
}): "abrir-confirmacao" | "assumir" | "ignorar" {
  if (!temAviso) return "assumir";
  if (!confirmando) return "abrir-confirmacao";
  return abertaHaMs < JANELA_DUPLO_CLIQUE_MS ? "ignorar" : "assumir";
}
