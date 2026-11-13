# Changelog

## 1.3.0 — 2026-11-13

### Novidades do CRM da comunidade (IPD, 12 e 13/11/2026)

- **Painel** (#341 no CRM do IPD) é a nova tela de entrada (`#/`); a Fila passa para `#/fila` (o `#/hoje` antigo também leva a ela). Grade de cartões com:
  - receita e vendas do mês, com o ritmo até o fim do mês;
  - quem está esperando uma pessoa, com o motivo e "Abrir conversa";
  - a 1ª resposta do robô e os pedidos de pessoa;
  - gráfico do mês (receita, vendas, conversas), origem dos leads, e-mails enviados, conversas de hoje e funil;
  - período (hoje, 7 dias, 30 dias, mês atual) e comparação com o mesmo trecho do período anterior. Tudo calculado do que o CRM tem; o que não é medido aparece como "sem medição".
- **Ficha: histórico 360** (#340):
  - uma linha do tempo única, por dia, com conversas, ligações, e-mails, propostas, pagamentos, etapas, tarefas, notas e ocorrências. Um dia só com mensagens nossas diz "Sem resposta no dia";
  - painel **Comportamento**: quente, morna, fria ou "sem sinal ainda"; quando costuma escrever; quanto demora para responder.
- **Entrar com e-mail e senha** e **Minha conta** (#342), com o Supabase ligado:
  - `/entrar` no visual Grafite, com senha ou link por e-mail;
  - só entra operador ativo, com a mesma recusa para qualquer erro, tempo mínimo de resposta e limite de tentativas;
  - Minha conta troca a senha (pedindo a atual) e sai de todos os dispositivos. Como liberar alguém: `IMPLEMENTAR.md`, passo 3.
- **Correções:**
  - filtros de Pessoas à vista entre 768 e 1279 px (rolavam para o lado);
  - o foco da tabela de Pessoas não fica mais sob o topo fixo;
  - link de entrada vencido volta para `/entrar` com aviso;
  - o pedido de link por e-mail responde igual para qualquer endereço.

### Fica de fora (o template não tem esses dados)

- Cartão Comunidade.
- Abertura e clique de e-mail.
- Meta de vendas ou faturamento no Painel.
- Visitas ao site e junção de cadastros na Ficha.
- Link de senha gerado pelo dono e bloqueio de tentativas gravado no banco. O caminho para cada um está descrito no PR.

## 1.2.0 — 2026-11-12

### Visual Grafite em todo o CRM

O redesign do CRM da comunidade IA para Donos (10 a 12/11/2026) chega ao template. Ele foi auditado em acessibilidade e usabilidade antes de vir para cá.

- **Novo visual Grafite** (escuro, vidro controlado, luz verde, âmbar só em "precisa de você"). Todas as cores ficam num bloco só (`src/crm-grafite/styles/tokens.css`). Para trocar pela cor da sua marca, veja [docs/DESIGN.md](docs/DESIGN.md).
- **Moldura fixa:** a página não rola, só a lista, a tabela, o quadro ou a conversa. Há um menu de ícones (com opção de mostrar os nomes) e uma faixa única no topo, com título, contagem, busca e filtros.
- **Telas refeitas pela tarefa:**
  - **Fila** (antes Hoje): quem pediu uma pessoa, tarefas e oportunidades paradas, mais o resumo do dia.
  - **Conversas:** todas as conversas, busca, filtros, "carregar anteriores", barra de posse (Assumir mostra o aviso antes) e o contexto ao lado.
  - **Ficha:** conversa, linha do tempo única, briefing, proposta, link de pagamento e termômetro.
  - **Funil:** quadro em altura cheia, "Mover para…" por menu e teclado, perda com motivo, filtros de parados e "bateu na trave", taxa por etapa com "amostra pequena".
  - **Pessoas** (antes Leads e Clientes): tabela com ordenação, filtros e WhatsApp mascarado.
  - **Tarefas:** concluir, reabrir e **mudar data** na linha.
  - **Agentes**, **Relance**, **Resultados**, **Origem dos leads**, **Metas**, **Sessão fechada**, **Ocorrências** e **Ligações**.
  - **Configuração** no menu do usuário: Produtos, Equipe, Modelos de mensagem, Playbook e Integrações.
- **⌘K** busca pessoa por nome ou telefone e vai para qualquer tela. Atalhos `J`/`K`, `/` e `⌘Enter`.
- **Modo sólido** (sem vidro) e **densidade** compacta ou confortável no menu do usuário.
- **Acessibilidade:** nenhum texto abaixo de 12 px, foco visível próprio, alvo de 44 px em toque, `Esc` fecha e devolve o foco, movimento e transparência reduzidos respeitados.
- **Fonte Onest** empacotada (`@fontsource-variable/onest`); funciona sem internet.
- **Novo comando `reagendarTarefa`** e ferramenta MCP `crm_tarefas_reagendar`. O mapa de telas do MCP (`crm_mapa_telas`) aponta para os arquivos novos.
- **Correções:**
  - O código de funil gerado a partir de nome com acento saía quebrado ("Perpétuo" virava "perpe-tuo").
  - As iniciais do avatar ignoram o que está entre parênteses.

### Removido

- A casca v3 (`src/crm-v3/`) e as telas antigas (`src/screens/`). O app agora fica em `src/components/crm/App.tsx` e as telas em `src/crm-grafite/telas/`.
- Os scripts de captura de tela da v3 e as capturas antigas.

## 1.1.0 — 2026-11-04

### Relance · Agente Ember (Reciclador de oportunidades)

- Novo agente **Ember** (`ember`) com escolha de modelo próprio por agente (`CRM_EMBER_MODEL`, padrão `claude-sonnet-4-5`) e bloqueio estrito contra fallback genérico sem IA.
- Nova tela isolada **Relance** (`#/relance`): campanhas de reabertura de leads com histórico real, simulação seca em 3 leads, parada de emergência, importação CSV com contexto obrigatório, lista permanente de opt-out e trilha de auditoria por lead.
- Motor de fila e freios (`src/domain/reciclador.ts`, `src/lib/reciclador/`): teto por hora/dia, espaçamento entre envios, janela comercial, recusa de leads sem contexto mínimo, pausa automática se o WhatsApp desconectar e passagem de bastão ao atendimento quando o lead responde.
- Novas ferramentas MCP `crm_reciclador_*` e migration aditiva `20261104000005_crm_ember_reciclador.sql`.
- Correção no `.gitignore` (`/data/` ancorado na raiz) restaurando `src/data/exemplo.ts` no repositório.

## 1.0.0 — 2026-11-02

### Vitrine e documentação

- README de vitrine em português (voz do dono) + espelho `README.en.md`.
- Screenshots commitados em `docs/screenshots/` (Hoje, Funil, Conversas, Leads, Agentes, mobile).
- Marca SVG em `docs/brand/` (lockup + mark do CRM).
- Badges, sumário, FAQ, avisos de ban/LGPD, créditos Oficina IPD.
- Repo canônico documentado: `github.com/oficina-ipd/crm-do-dono-template`.

### Instalação

- `Dockerfile` + `docker-compose.yml` para subir o CRM em modo demo com um comando.
- `docker-compose.waha.yml` permanece só como provedor WhatsApp **opcional**.
- Guia longo inalterado em espírito: `IMPLEMENTAR.md`.

### App (v3 instalável)

- Next.js 15 (App Router) no lugar do Vite educacional `v0.1-vite`.
- Porte visual das telas Hoje, Funil, Conversas, Leads/Clientes, Agentes (casca CRM v3).
- `crm.config.ts` genérico (empresa, produtos, 3 funis, agentes).
- Seis agentes (Cláudio, Scout, Scribe, Ledger, Pilot, Eco) com DecisionEngine; LLM opcional (chave do membro).
- MCP-first: `/api/mcp/crm` + stdio, níveis leitura/escrita/admin.
- WhatsApp via **WPP Engine** (provedor padrão: key uma vez + QR + webhook). WAHA opcional.
- Migrations Supabase (casa + agentes + WhatsApp + seed).
- `npm run setup`, `npm run doctor`, `AGENTS.md`, `docs/LIVE-CHECKLIST.md`.

### Em breve (entregas separadas)

- Disparo de e-mail em massa (multi-token Resend).
- Agente de cobrança (nunca misturado com o Ledger).
- Agente coach e v4 (e-mail marketing).

Ver também [`docs/EM-BREVE.md`](./docs/EM-BREVE.md).
