/**
 * Entrar com conta (/entrar): estados da tela. Puro. A recusa do servidor é genérica de
 * propósito (não revela quem tem acesso); a tela repete esse texto e não acrescenta nada que
 * dependa de quem digitou.
 */
import { MSG_CREDENCIAIS, destinoSeguro, validarEmail } from "@/lib/auth/senha/mensagens";

export { destinoSeguro, validarEmail };

export type Aviso = { tom: "erro" | "atencao" | "info"; titulo: string; texto: string };

export type EstadoSenha =
  | { fase: "inicial" }
  | { fase: "entrando" }
  | { fase: "entrou"; destino: string }
  | { fase: "erro"; aviso: Aviso };

export type RespostaSenha = { status: number | null; error?: string; destino?: string };

export const TEXTO_CREDENCIAIS =
  "Confira os dois e tente de novo. Se esqueceu a senha, entre pelo link por e-mail e peça uma senha nova a quem cuida do CRM.";

/** Resultado do pedido de entrada com senha. `status` nulo = falha de rede. */
export function estadoDaRespostaSenha(r: RespostaSenha): EstadoSenha {
  if (r.status === null) return { fase: "erro", aviso: { tom: "erro", titulo: "Você não entrou", texto: "Sem conexão. Confira a internet e tente de novo." } };
  if (r.status === 200) return { fase: "entrou", destino: destinoSeguro(r.destino) };
  if (r.status === 401) return { fase: "erro", aviso: { tom: "erro", titulo: MSG_CREDENCIAIS, texto: TEXTO_CREDENCIAIS } };
  if (r.status === 429) {
    return { fase: "erro", aviso: { tom: "atencao", titulo: "Muitas tentativas", texto: r.error ?? "Espere alguns minutos e tente de novo, ou entre com o link por e-mail." } };
  }
  if (r.status === 400) return { fase: "erro", aviso: { tom: "atencao", titulo: "Confira os campos", texto: r.error ?? "Preencha o e-mail e a senha." } };
  if (r.status === 403) return { fase: "erro", aviso: { tom: "atencao", titulo: "Você não entrou", texto: "Recarregue a página e tente de novo." } };
  if (r.status === 404) {
    return { fase: "erro", aviso: { tom: "atencao", titulo: "Entrada com conta desligada", texto: "Este CRM não está ligado ao Supabase. Abra o modo demo." } };
  }
  return {
    fase: "erro",
    aviso: { tom: "erro", titulo: "Você não entrou", texto: "Não conseguimos entrar agora. Tente de novo em instantes ou use o link por e-mail." },
  };
}

export function validarSenhaDigitada(bruto: string): string | null {
  return bruto ? null : "Digite a sua senha.";
}

export type EstadoLink =
  | { fase: "inicial" }
  | { fase: "enviando" }
  | { fase: "enviado"; email: string }
  | { fase: "erro"; texto: string };

/** Resultado do pedido de link. `status` nulo = falha de rede. */
export function estadoDaRespostaLink(status: number | null, email: string): EstadoLink {
  if (status === null) return { fase: "erro", texto: "Sem conexão. Confira a internet e tente de novo." };
  if (status === 429) return { fase: "erro", texto: "Muitos pedidos seguidos. Espere alguns minutos e peça de novo." };
  if (status === 503) return { fase: "erro", texto: "A entrada está fora do ar por um instante. Tente de novo em um minuto." };
  if (status >= 500) return { fase: "erro", texto: "Não conseguimos enviar o link agora. Tente de novo em instantes." };
  if (status === 404) return { fase: "erro", texto: "Este CRM não está ligado ao Supabase. Abra o modo demo." };
  if (status === 403) return { fase: "erro", texto: "Recarregue a página e peça de novo." };
  if (status === 400) return { fase: "erro", texto: "Confira o e-mail digitado e tente de novo." };
  return { fase: "enviado", email };
}

/** Aviso a partir de ?erro= na URL (o retorno do link por e-mail usa `auth`). */
export function avisoDaUrl(erro: string | null | undefined): Aviso | null {
  if (erro === "auth") {
    return { tom: "atencao", titulo: "O link de entrada não funcionou", texto: "Ele pode ter vencido ou já ter sido usado. Entre com e-mail e senha ou peça um link novo." };
  }
  return null;
}

/** E-mail parcialmente escondido na confirmação: "jo•••@empresa.com". */
export function emailDiscreto(email: string): string {
  const [u, d] = email.split("@");
  if (!u || !d) return email;
  return `${u.slice(0, 2)}${"•".repeat(Math.max(1, Math.min(3, u.length - 2)))}@${d}`;
}
