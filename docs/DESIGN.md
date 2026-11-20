# Design do CRM do dono (visual Grafite)

O CRM usa o visual **Grafite com vidro**: fundo ardósia com uma luz verde suave, painéis de vidro, verde só na ação principal e âmbar só em quem **precisa de você agora**. Ele veio do redesign do CRM interno da comunidade IA para Donos (novembro de 2026), que foi auditado em acessibilidade e usabilidade antes de chegar aqui.

Este guia é para quem quer **mudar a cara do CRM** (cor da marca, densidade, telas novas) sem quebrar o que funciona.

## Onde fica cada coisa

| O quê | Onde |
|---|---|
| Todas as cores | `src/crm-grafite/styles/tokens.css`, bloco **Paleta do Grafite** (`--v4-gp-*`) |
| Vidro, profundidade, raio e luz | `src/crm-grafite/styles/grafite.css` (só compõe as cores da paleta) |
| Componentes (botão, campo, tabela, menu, diálogo, aviso, conversa) | `src/crm-grafite/ui/` e `styles/components.css` |
| Casca (menu de ícones, faixa do topo, busca ⌘K, menu do usuário) | `src/crm-grafite/shell/` e `styles/shell.css` |
| Navegação (itens, grupos, quem vê o quê) | `src/crm-grafite/nav.ts` |
| Rotas (caminho → tela) | `src/crm-grafite/rotas.ts` e `src/crm-grafite/app.tsx` |
| Telas | `src/crm-grafite/telas/<area>/` com o CSS em `styles/telas/<area>.css` |
| Vitrine de todos os componentes | abra o CRM e vá para `#/especimes` |

## Trocar a cor da marca

1. Abra `src/crm-grafite/styles/tokens.css` e procure **Paleta do Grafite**.
2. Troque o par da ação principal (`--v4-gp-action-1` e `--v4-gp-action-2`), o texto sobre ela (`--v4-gp-action-on`), o anel de foco (`--v4-gp-ring`) e as quatro manchas de luz (`--v4-gp-light-*-rgb`).
3. Quer menos luz? Baixe `--v4-gp-light-gain` (0,42 é suave; 0 desliga).
4. Confira o contraste: texto sobre o botão precisa de **4,5:1** ou mais. Abra `#/especimes` e olhe os botões e o foco.

Nenhuma outra parte do código tem cor escrita direto. Se você achar uma, é defeito.

## Regras que mantêm o CRM fácil de usar

- **A sua vez em primeiro lugar.** O que precisa de uma pessoa agora abre a tela e é a única coisa em âmbar.
- **Trabalho escondido é defeito.** Tudo o que existe precisa ser alcançável: total à vista, "mostrar mais" quando a lista é longa.
- **A área de trabalho manda.** Lista, quadro e conversa ocupam a tela. A página não rola: rola só a lista, a tabela, o quadro ou a conversa.
- **Botão diz a verdade.** "Assumir" assume. Se só leva para outra tela, o nome é "Abrir conversa". Ação que não grava nada não aparece.
- **Diga antes de fazer.** Assumir mostra o aviso que o contato vai receber; apagar pede confirmação.
- **Estado honesto.** Vazio, sem resultado, sem permissão, salvando, salvo e falhou têm tratamento próprio.
- **Sem dado inventado.** Número que o CRM não sabe calcular não aparece.

## Medidas

- Texto nunca abaixo de 12 px. Interface em 13 px, mensagens em 14 px, título da tela em 22 px.
- Alvo de clique de 36 px com mouse e 44 px em tela de toque.
- Contraste de 4,5:1 em texto e 3:1 em contorno de controle.
- Raio: 22 px nos painéis, 14 a 16 px nas barras e botões redondos.
- Fonte: **Onest** (empacotada, funciona sem internet).

## Preferências de quem usa

No menu do usuário (canto de baixo do menu lateral):

- **Densidade** compacta (padrão no computador) ou confortável.
- **Modo sólido**: tira o vidro e o desfoque. Use em computador mais fraco ou se a leitura sobre vidro cansar. O CRM também respeita "reduzir transparência" e "reduzir movimento" do sistema.
- **Nomes no menu**: mostra os nomes ao lado dos ícones.

As escolhas ficam salvas no navegador.

## Teclado

- `⌘K` (ou `Ctrl+K`): busca pessoa por nome ou telefone, ou vai para uma tela.
- `/`: foca a busca da tela.
- `J` / `K` ou setas: anda na lista de conversas e na Fila.
- `⌘Enter`: envia a mensagem.
- `Esc`: fecha menu, diálogo e painel, e devolve o foco.

## Criar uma tela nova

1. Crie `src/crm-grafite/telas/<area>/index.tsx` exportando um componente.
2. A raiz da tela leva `data-v4-tela` e o primeiro filho é `<FaixaTopo titulo="…">` (título, contagem, busca, filtros e ações na mesma linha).
3. Use os componentes de `src/crm-grafite/ui/`, sem recriar botão, campo ou tabela.
4. Leia os dados com `useCRM()` (`@/components/crm/provider`) e grave com `despachar(comando)`. Os comandos ficam em `src/domain/comandos.ts`.
5. Registre a rota em `rotas.ts` e `app.tsx` e, se ela for para o menu, em `nav.ts`.
6. CSS da tela em `styles/telas/<area>.css`, sempre escopado em `.crm-v4-root`, só com `var(--v4-…)`.
