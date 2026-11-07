# Tema: o painel com as cores e a fonte do projeto

O painel do Chatwoot 4.19.1 pinta quase tudo com variáveis CSS (`app/javascript/dashboard/assets/scss/_next-colors.scss`). O kit sobrescreve essas variáveis com a cor do projeto, nos modos claro e escuro, por um `<style>` que o Chatwoot carrega em toda tela (`DASHBOARD_SCRIPTS`). Nada no código do Chatwoot muda.

## Do design system para escolhas.json

| Campo | De onde vem |
|---|---|
| `marca.nome` | o nome do sistema que o cliente conhece; vira o título da aba |
| `marca.cor_principal` | a cor primária do design system, em hexadecimal |
| `marca.cor_principal_escuro` | a primária do tema escuro, se o design system tem uma; senão `null` |
| `marca.fonte.familia` | a fonte do design system; `null` mantém a Inter do Chatwoot |
| `marca.fonte.css` | endereço https do CSS da fonte (do próprio sistema ou do Google Fonts) |
| `marca.logo`, `logo_escuro`, `icone` | endereços https; o ícone é quadrado, 512 px |
| `marca.site`, `termos`, `privacidade`, `saida` | endereços https do sistema; `saida` é para onde vai quem sai do painel |

## O que o tema troca

- A escala de destaque em 12 tons (`--blue-1` a `--blue-12`) e as variáveis que dependem dela (`--solid-blue`, `--text-blue`, `--border-blue`, `--border-blue-strong`), com o tom 9 igual à cor principal. Os outros tons seguem a claridade da escala do Chatwoot, com o matiz e a saturação da cor do projeto.
- O azul que o Chatwoot escreveu fixo (`n-brand`, `#2781F6` em `theme/colors.js`): uma regra para cada uma das 44 classes da versão 4.19.1 (`references/n-brand.json`), com as variantes de hover, foco e modo escuro.
- Regras de folha de estilo que usam esse azul sem classe: links em parágrafos, o foco dos campos, o link da tela de login, a faixa de aviso e a cor da busca de comandos.
- A fonte, quando o projeto define uma.

## O que continua do Chatwoot

Umas poucas cores escritas no próprio código: o ícone de mensagem lida, alguns balões especiais, telas de canais que o kit não usa e ilustrações. Também os e-mails de aviso aos atendentes. O menu de contexto da conversa e o botão de um diálogo do editor usam o azul fixo dentro de estilos com escopo; se ficarem visíveis, trate como item de `chatwoot.esconder` ou acrescente a regra com o seletor completo.

## Gerar e aplicar

1. `kit.mjs theme <destino>` grava `gerado/painel.html` (vai para `DASHBOARD_SCRIPTS`), `gerado/marca.env` (as variáveis `KIT_*` do `apply-config.rb`) e `gerado/tema.json` (o resumo para as conferências).
2. A implantação roda o serviço `chatwoot-config` (o `base/deploy/apply-config.rb` com `rails runner`), que grava tudo no banco e limpa o cache de configuração do Chatwoot.
3. `kit.mjs verify` confere se o tema no ar é o gerado; `kit.mjs look` confere a cor nas telas e salva capturas.

Trocou a cor ou o que esconder: gere de novo e rode o `chatwoot-config` de novo. O tema leva a versão do kit e um hash (`data-kit-theme`), que as conferências comparam.

## Modo escuro

O painel tem a preferência de aparência de cada pessoa (claro, escuro ou automático). O tema define os dois modos. `look` abre as telas pedindo o modo escuro ao navegador; se a pessoa de teste fixou o claro, ele avisa.
