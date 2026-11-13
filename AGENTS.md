# AGENTS.md · CRM do dono

Você está editando o CRM do dono (IA para Donos). O usuário é empreendedor, não programador: explique em português simples e entregue em passos pequenos.

## Antes de qualquer mudança

1. Leia `crm.config.ts`, `src/domain/rules.ts`, `src/domain/funil.ts`, `IMPLEMENTAR.md`.
2. Diga o que vai fazer e o que pode dar errado.
3. Rode `npm run typecheck` e `npm test` antes de dar por pronto.

## Mapa rápido

| O quê | Onde |
| --- | --- |
| Config da empresa / produtos / funis | `crm.config.ts` |
| Regras puras (preço, nota, prazo) | `src/domain/rules.ts` |
| 8 etapas + playbook | `src/domain/funil.ts` |
| Telas (visual Grafite) | `src/crm-grafite/telas/<area>/` · rotas em `src/crm-grafite/rotas.ts` e `app.tsx` · menu em `nav.ts` |
| Agentes (Cláudio, Scout, Scribe, Ledger, Pilot, Eco, Ember) | `src/lib/agents/` |
| Relance · Reciclador de oportunidades (Ember) | `src/domain/reciclador.ts` · `src/lib/reciclador/` · `src/crm-grafite/telas/relance/` · `src/app/api/reciclador/` |
| MCP (Cursor / GrokBot) | `src/lib/mcp/` + `src/app/api/mcp/crm/` |
| WhatsApp (WPP Engine padrão) | `src/lib/whatsapp/` · contrato `docs/wpp-engine-contrato.md` · WAHA opcional `docker-compose.waha.yml` |
| Migrations | `supabase/migrations/` |
| Design system (cores, componentes, regras) | `docs/DESIGN.md` · `src/crm-grafite/styles/tokens.css` · `src/crm-grafite/ui/` |

## Nunca mude sem perguntar

- Cláudio **nunca** fala preço / desconto / parcela / condição (`mencionaPreco`, `podeRoboEnviar`).
- Ledger **nunca** fica em Automático e **nunca** cobra.
- Ember (Relance) **nunca** dispara texto estático sem chave LLM ativa e **nunca** ignora opt-out, contexto mínimo ou parada de emergência.
- Modelo Contato → Oportunidades e o schema SQL.
- Promete-se ativo entregue, nunca faturamento. Sem emoji, sem exclamação.

## MCP-first

Toda ação de tela nova precisa de ferramenta em `src/lib/mcp/tools.ts`. Níveis: `leitura` | `escrita` | `admin`.

Caso clássico da live: “na tela de funil, ponha farol vermelho nas oportunidades com problema com o Cláudio” → ferramenta `crm_farol_funil` + estilo em `src/crm-grafite/styles/telas/funil.css` (cor só por `var(--v4-…)`).

## Como criar um agente novo (2–3 h)

1. Adicione o slug em `crm.config.ts` → `agentes`.
2. Implemente em `src/lib/agents/index.ts` (entrada → saída + `requerAprovacao`).
3. Seed em `crm_agentes` (migration aditiva).
4. Exponha `crm_agente_executar` (já cobre qualquer slug do enum — atualize o Zod).
5. Linha na tela `src/crm-grafite/telas/agentes/` (catálogo em `agentes-logica.ts`).
6. Teste unitário em `tests/unit/agents.test.ts`.

## Stack

Next.js 15 (App Router) · React 19 · Supabase · Mastra-ready · MCP SDK · WPP Engine · Vitest · Vercel.
