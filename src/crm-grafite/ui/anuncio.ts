/**
 * Próximo texto de uma região viva (aria-live). Ela só anuncia quando o texto muda: repetir a
 * mesma frase alterna um espaço invisível no fim (o que é lido não muda). Compara com o texto
 * ATUAL daquela região, então um anúncio de outro canal no meio não atrapalha.
 */
export function proximoAnuncio(anterior: string, texto: string): string {
  return anterior === texto ? `${texto} ` : texto;
}
