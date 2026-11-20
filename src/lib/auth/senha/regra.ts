/**
 * Regra da senha dos operadores do CRM. Pura (sem rede, sem Node): a tela mostra a mesma regra
 * que o servidor aplica. O servidor é quem decide; a tela só adianta o aviso.
 *
 *  - 12 caracteres ou mais (até 72 bytes: limite do bcrypt do Supabase Auth);
 *  - não pode ser óbvia: só números, poucos caracteres diferentes, sequência, repetição de um
 *    bloco, palavra comum com números ("Senha@123456") ou uma das senhas mais usadas;
 *  - não pode conter o próprio e-mail (inteiro, ou a parte antes do @).
 *
 * Veio do CRM do IPD (lib/crm-senha/regra.ts); só saíram as palavras da marca de lá.
 */

export const SENHA_MIN = 12;
export const SENHA_MAX_BYTES = 72;

export const REGRA_SENHA_TEXTO =
  "Use 12 caracteres ou mais. Não vale sequência, repetição nem palavra comum com números (como “senha123456”), e a senha não pode conter o seu e-mail.";

export type CodigoSenha = "curta" | "longa" | "espaco" | "email" | "obvia";
export type ResultadoSenha = { ok: true } | { ok: false; codigo: CodigoSenha; erro: string };

const LINHAS_TECLADO = ["1234567890", "qwertyuiop", "asdfghjkl", "zxcvbnm", "abcdefghijklmnopqrstuvwxyz"];

/** Palavras que, sozinhas ou juntas, não fazem uma senha (o que sobra depois de tirar números e símbolos). */
const PALAVRAS_OBVIAS = [
  "senha", "senhas", "password", "passwd", "pass", "admin", "administrador", "administrator", "root",
  "qwerty", "qwert", "asdf", "asdfgh", "zxcv", "abc", "abcd", "abcdef", "mudar", "trocar", "teste", "test",
  "login", "entrar", "acesso", "usuario", "user", "minha", "meu", "nova", "novo", "forte", "segura", "seguro",
  "secreta", "secreto", "bemvindo", "welcome", "letmein", "iloveyou", "trustno", "changeme", "brasil",
  "crm", "para", "donos", "dono", "cliente", "clientes", "vendas", "venda", "equipe", "empresa", "loja",
  "deus", "jesus", "amor", "eu", "te", "amo", "de", "do", "da", "e", "o", "a",
];

/** Senhas de 12+ caracteres que aparecem nas listas das mais usadas (comparadas em minúsculas). */
const SENHAS_COMUNS = new Set([
  "123456789012", "1234567890123", "12345678901234", "012345678901", "098765432109", "987654321098",
  "000000000000", "111111111111", "123123123123", "121212121212", "102030405060", "112233445566",
  "1q2w3e4r5t6y", "q1w2e3r4t5y6", "1qaz2wsx3edc", "qazwsxedcrfv", "zaq12wsx3edc", "1q2w3e4r5t6y7u",
  "a1b2c3d4e5f6", "1a2b3c4d5e6f", "abc123456789", "123456789abc", "abcd12345678", "aa1234567890",
  "qwerty123456", "123456qwerty", "1234qwerasdf", "qwer1234asdf", "asdf1234qwer", "q1w2e3r4t5y6u7",
]);

const LEET: Record<string, string> = { "@": "a", "4": "a", "3": "e", "1": "i", "!": "i", "0": "o", $: "s", "5": "s", "7": "t" };

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function bytesUtf8(s: string): number {
  return new TextEncoder().encode(s).length;
}

/** Par de vizinhos "previsível": mesmo caractere, ou seguidos (para frente ou para trás) numa linha do teclado ou no alfabeto. */
function vizinhosPrevisiveis(a: string, b: string): boolean {
  if (a === b) return true;
  for (const linha of LINHAS_TECLADO) {
    const i = linha.indexOf(a);
    const j = linha.indexOf(b);
    if (i >= 0 && j >= 0 && Math.abs(i - j) === 1) return true;
  }
  return false;
}

function ehSequencia(s: string): boolean {
  const c = [...s];
  if (c.length < 2) return false;
  let previsiveis = 0;
  for (let i = 1; i < c.length; i++) if (vizinhosPrevisiveis(c[i - 1], c[i])) previsiveis++;
  return previsiveis / (c.length - 1) >= 0.75;
}

/** A senha inteira é um bloco curto repetido ("abc123abc123", "xyzxyzxyzxyz"). */
function ehBlocoRepetido(s: string): boolean {
  return s.length >= 2 && (s + s).indexOf(s, 1) < s.length;
}

/** Dá para escrever `letras` só emendando palavras óbvias? (programação dinâmica) */
function soPalavrasObvias(letras: string): boolean {
  if (!letras) return true;
  const alcanca = new Array<boolean>(letras.length + 1).fill(false);
  alcanca[0] = true;
  for (let i = 0; i < letras.length; i++) {
    if (!alcanca[i]) continue;
    for (const p of PALAVRAS_OBVIAS) if (letras.startsWith(p, i)) alcanca[i + p.length] = true;
  }
  return alcanca[letras.length];
}

function ehObvia(senha: string): boolean {
  const s = semAcento(senha).toLowerCase();
  if (SENHAS_COMUNS.has(s)) return true;
  if (/^\d+$/.test(s)) return true;
  if (new Set([...s]).size < 5) return true;
  if (ehSequencia(s) || ehBlocoRepetido(s)) return true;
  // "Senha@123456", "crmdodono2026": o que sobra sem números e símbolos é só palavra comum.
  if (soPalavrasObvias(s.replace(/[^a-z]/g, ""))) return true;
  // Trocas de letra por número ou símbolo. Duas leituras: "P@ssw0rd2024!!" (a cauda de números
  // e símbolos sai antes) e "M1nh@S3nh4F0rt3!" (só a pontuação das pontas sai; os números são letras).
  const semCauda = s.replace(/^[^a-z]+/, "").replace(/[^a-z@$]+$/, "");
  const semPontuacao = s.replace(/^[^a-z0-9@$]+/, "").replace(/[^a-z0-9@$]+$/, "");
  for (const miolo of [semCauda, semPontuacao]) {
    const desfeito = [...miolo].map((ch) => LEET[ch] ?? ch).join("").replace(/[^a-z]/g, "");
    if (desfeito.length >= 4 && soPalavrasObvias(desfeito)) return true;
  }
  return false;
}

function contemEmail(senha: string, email: string): boolean {
  const s = semAcento(senha).toLowerCase();
  const e = semAcento(email).trim().toLowerCase();
  if (!e) return false;
  if (s.includes(e)) return true;
  const local = e.split("@")[0] ?? "";
  if (local.length >= 4 && s.includes(local)) return true;
  const localSemPontuacao = local.replace(/[^a-z0-9]/g, "");
  return localSemPontuacao.length >= 4 && s.replace(/[^a-z0-9]/g, "").includes(localSemPontuacao);
}

/**
 * Confere a senha nova. Devolve o primeiro problema, com o texto que diz como corrigir.
 * `email` é o e-mail de quem vai usar a senha (operador); sem ele, a regra do e-mail não roda.
 */
export function validarSenhaNova(senha: string, opts: { email?: string | null } = {}): ResultadoSenha {
  const tamanho = [...senha].length;
  if (tamanho < SENHA_MIN) {
    const faltam = SENHA_MIN - tamanho;
    return { ok: false, codigo: "curta", erro: `Use ao menos ${SENHA_MIN} caracteres (${faltam === 1 ? "falta 1" : `faltam ${faltam}`}).` };
  }
  if (bytesUtf8(senha) > SENHA_MAX_BYTES) {
    return { ok: false, codigo: "longa", erro: `Use uma senha mais curta: o limite é de ${SENHA_MAX_BYTES} caracteres simples.` };
  }
  if (senha !== senha.trim()) {
    return { ok: false, codigo: "espaco", erro: "Tire o espaço do começo ou do fim da senha." };
  }
  if (opts.email && contemEmail(senha, opts.email)) {
    return { ok: false, codigo: "email", erro: "Não use o seu e-mail (nem a parte antes do @) dentro da senha." };
  }
  if (ehObvia(senha)) {
    return {
      ok: false,
      codigo: "obvia",
      erro: "Esta senha é fácil de adivinhar (sequência, repetição ou palavra comum com números). Junte palavras que só você juntaria.",
    };
  }
  return { ok: true };
}
