/**
 * Integrações (Grafite): WhatsApp, agentes (LLM e MCP), chaves de API, entrada de leads e
 * dados (exportar, importar, recomeçar). Puro: a tela e os testes usam as mesmas regras.
 */
import { nomeDoOperador } from "@/domain/comandos";
import { ESTADO_VERSAO, type ChaveApi, type EstadoCRM, type Escopo } from "@/domain/types";

export type AbaIntegrar = "whatsapp" | "agentes" | "chaves" | "entrada" | "dados";
export const ABAS_INTEGRAR: AbaIntegrar[] = ["whatsapp", "agentes", "chaves", "entrada", "dados"];

export const ROTULO_ESCOPO: Record<Escopo, string> = { leitura: "Só leitura", escrita: "Leitura e mudanças" };
export const AJUDA_ESCOPO: Record<Escopo, string> = {
  leitura: "Consulta números, contatos e funil. Não muda nada.",
  escrita: "Também cria leads, move cards e envia mensagens.",
};

/** Começo da chave, para reconhecer sem expor: a chave completa só aparece ao criar. */
export function inicioDaChave(chave: string): string {
  return `${chave.slice(0, 16)}…`;
}

export type LinhaChave = { id: string; nome: string; escopo: Escopo; operador: string; inicio: string; criadaEm: string; revogadaEm: string | null };

export function linhasChaves(estado: EstadoCRM): LinhaChave[] {
  return estado.chaves
    .map((k) => ({
      id: k.id,
      nome: k.nome,
      escopo: k.escopo,
      operador: k.operadorId ? nomeDoOperador(estado, k.operadorId) : "Ninguém",
      inicio: inicioDaChave(k.chave),
      criadaEm: k.criadaEm,
      revogadaEm: k.revogadaEm,
    }))
    .sort((a, b) => Number(Boolean(a.revogadaEm)) - Number(Boolean(b.revogadaEm)) || Date.parse(b.criadaEm) - Date.parse(a.criadaEm));
}

/** A chave que apareceu depois de criar (compara as listas antes e depois). */
export function chaveCriada(antes: Pick<ChaveApi, "id">[], depois: ChaveApi[]): ChaveApi | null {
  const ids = new Set(antes.map((k) => k.id));
  return depois.find((k) => !ids.has(k.id)) ?? null;
}

export function validarNomeChave(nome: string): string | null {
  const v = nome.trim();
  if (v.length < 2) return "Dê um nome para reconhecer a chave depois, como “GrokBot leitura”.";
  if (v.length > 80) return "Use até 80 caracteres no nome.";
  return null;
}

export function contarAtivas(estado: EstadoCRM): number {
  return estado.chaves.filter((k) => !k.revogadaEm).length;
}

/** O que tem no CRM agora (aba Dados). */
export function resumoDoEstado(e: EstadoCRM): { rotulo: string; n: number }[] {
  return [
    { rotulo: "Contatos", n: e.contatos.length },
    { rotulo: "Oportunidades", n: e.oportunidades.length },
    { rotulo: "Mensagens", n: e.mensagens.length },
    { rotulo: "Movimentos no funil", n: e.movimentos.length },
    { rotulo: "Ligações", n: e.ligacoes.length },
    { rotulo: "Tarefas", n: e.tarefas.length },
  ];
}

export function nomeArquivoExportacao(agoraIso: string): string {
  return `crm-do-dono-${agoraIso.slice(0, 10)}.json`;
}

/** Confere se o JSON é um estado deste CRM, na versão que ele lê. Nulo = pode importar. */
export function erroDoArquivo(dado: unknown): string | null {
  if (!dado || typeof dado !== "object") return "O arquivo não é um JSON de estado do CRM.";
  const e = dado as Partial<EstadoCRM>;
  if (!Array.isArray(e.contatos) || !e.config || !Array.isArray(e.operadores)) return "O arquivo não parece um estado do CRM: faltam contatos, equipe ou configuração.";
  if (e.versao !== ESTADO_VERSAO) return `O arquivo é de outra versão do CRM (${String(e.versao ?? "sem versão")}); esta lê a versão ${ESTADO_VERSAO}.`;
  if (!e.operadores.some((o) => o?.papel === "dono" && o?.ativo && o?.tipo === "humano")) return "O arquivo não tem nenhum dono ativo: ninguém conseguiria entrar.";
  return null;
}

/** URL do servidor MCP pela web (rota /api/mcp/crm deste app). */
export function urlMcpWeb(origem: string): string {
  return `${origem.replace(/\/+$/, "")}/api/mcp/crm`;
}

/** Configuração de cliente MCP remoto (Cursor e outros que aceitam `url` + cabeçalho). */
export function configMcpWeb(url: string): string {
  return JSON.stringify({ mcpServers: { "crm-do-dono": { url, headers: { Authorization: "Bearer SEU_TOKEN" } } } }, null, 2);
}

export function testeMcpWeb(url: string): string {
  return `curl -s -X POST ${url} \\
  -H "Authorization: Bearer SEU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`;
}

/**
 * Prompt para colar no agente (GrokBot, Cursor…), montado com os dados do CRM. Só fala do que
 * existe neste app: o MCP pela web (/api/mcp/crm), o AGENTS.md e o teste pelo navegador.
 */
export function promptAgente(estado: EstadoCRM, origem: string, etapas: { nome: string; auto: boolean }[]): string {
  const robo = estado.config.nomeRobo;
  const lista = (itens: string[], vazio: string) => (itens.length ? itens.map((i) => `- ${i}`).join("\n") : `- ${vazio}`);
  const funis = lista(estado.funis.filter((f) => f.ativo).map((f) => `${f.nome} (código ${f.id}) · ${f.canal}`), "nenhum funil ativo");
  const produtos = lista(estado.produtos.filter((p) => p.ativo).map((p) => `${p.nome}${p.parcelas ? ` · ${p.parcelas}` : ""}`), "nenhum produto ativo");
  const equipe = lista(estado.operadores.filter((o) => o.ativo).map((o) => `${o.nome} · ${o.papel} · ${o.tipo === "ia" ? "IA" : "pessoa"}`), "ninguém");
  const bot = estado.operadores.find((o) => o.ativo && o.papel === "bot");
  const automaticas = etapas.filter((e) => e.auto).map((e) => e.nome);
  return `Você vai me ajudar com o CRM da ${estado.config.nomeEmpresa} (template "CRM do dono"). Faça uma etapa por vez e me confirme antes de seguir.

## O que é este CRM
- Cada contato (pessoa) tem uma ou mais oportunidades, uma por produto. Lead, prospect e cliente são calculados pelo funil; ninguém edita.
- Etapas do funil de venda: ${etapas.map((e) => e.nome).join(" → ")}.${automaticas.length ? ` ${automaticas.join(", ")} são movidas pelo sistema, nunca por você.` : ""}
- ${robo} é o assistente de IA que responde primeiro e qualifica com a Pergunta Matadora (nota de 0 a 10). Nota 9 ou 10, pedido de preço ou de uma pessoa: passa para a equipe.
- Regra de ouro: ${robo} nunca fala preço, desconto, parcela ou condição. Só uma pessoa da equipe.

Funis de entrada:
${funis}

Produtos:
${produtos}

Equipe:
${equipe}

## 1. Ler e agir pelo MCP
Servidor MCP pela web: ${urlMcpWeb(origem)} (POST com JSON-RPC: initialize, tools/list, tools/call).
Autenticação: cabeçalho Authorization: Bearer <token>. Eu te passo o token; o nível dele (leitura, escrita ou admin) define o que você pode fazer.
Teste: chame tools/list e me diga quais ferramentas você recebeu.

## 2. Mudanças no código (Cursor)
Leia o AGENTS.md do repositório antes de tudo e siga as regras dele. Antes de editar, me diga o que vai mudar e o que pode quebrar. Rode npm run typecheck e npm test antes de dar por pronto.

## 3. Testes pelo navegador
Abra ${origem} e entre como ${bot ? `"${bot.nome}" (papel bot)` : "um operador de papel bot (se não houver, me peça para criar em Equipe)"}. Roteiro: Fila → Funil → Conversas (assuma uma conversa, envie uma mensagem, devolva para ${robo}) → ficha de um contato. Me relate o que funcionou e o que não funcionou.

Não invente dados. Quando não souber, pergunte. Quando uma ação mudar o funil, me avise antes.`;
}

/** Situação do WhatsApp em linguagem de quem usa (mesmos dados de /api/whatsapp). */
export function situacaoWhatsapp(
  info: { connected: boolean } | null,
  sessao: { status: string } | null,
): { rotulo: string; tom: "sucesso" | "info" | "atencao" | "neutro" } {
  if (sessao?.status === "conectado") return { rotulo: "Conectado", tom: "sucesso" };
  if (sessao && ["qr", "pending", "pairing"].includes(sessao.status)) return { rotulo: "Esperando ler o QR", tom: "atencao" };
  if (info?.connected) return { rotulo: "Chave salva, falta conectar", tom: "info" };
  return { rotulo: "Não conectado", tom: "neutro" };
}

export const esperandoQr = (status: string | undefined) => status === "qr" || status === "pending" || status === "pairing";

/** Telefone da sessão no formato internacional (+55…): só confere o formato. */
export function validarTelefoneSessao(v: string): string | null {
  const t = v.replace(/[\s()-]/g, "");
  if (!t) return "Digite o número do WhatsApp que vai conectar.";
  if (!/^\+\d{10,15}$/.test(t)) return "Use o formato internacional, com + e DDD: +5511999999999.";
  return null;
}
