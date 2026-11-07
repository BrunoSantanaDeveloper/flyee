# Atualizar o kit num projeto

Cada projeto guarda a versão que instalou em `<destino>/kit.json`. Atualizar é decisão do desenvolvedor, projeto por projeto.

## Passo a passo

1. `kit.mjs status <destino>`: a versão instalada, a do app, os arquivos da base editados pelo projeto e as versões travadas que mudaram.
2. Se o projeto editou algum arquivo da base, leve a edição para o código do projeto (a base aceita configuração e funções de fora, como o `store` e as consultas) e devolva o arquivo ao original. Só use `update --force` com o sim do desenvolvedor: a versão do projeto fica em `<arquivo>.projeto`.
3. `kit.mjs update <destino>`: troca a base, acrescenta os modelos novos e lista em `models_changed` os modelos que mudaram no kit; esses você porta à mão para as cópias do projeto.
4. Leia abaixo as notas da versão nova e de cada versão no meio do caminho.
5. Se as versões travadas mudaram (`kit/versoes.json` do app), troque as imagens na implantação do projeto. O Chatwoot roda as migrações do banco ao subir a versão nova; faça backup do Postgres antes.
6. `kit.mjs theme <destino>` (a lista de classes do azul fixo pode ter mudado com a versão do Chatwoot), depois o `chatwoot-config` na implantação, depois `verify` e `look`.

## O que o kit confere a cada versão nova do Chatwoot

Antes de travar uma versão nova, o kit confere no código dela:

- as variáveis de cor de `_next-colors.scss` e a cor fixa `n-brand`, e gera de novo `references/n-brand.json`;
- `DASHBOARD_SCRIPTS`, `LOGOUT_REDIRECT_LINK`, `DISABLE_USER_PROFILE_UPDATE` e o layout que os imprime;
- o serviço que devolve a marca (que não pode existir na imagem `-ce`);
- a API de plataforma (contas com `features`, pessoas, papéis, login único);
- as rotas que o token do robô alcança e o formato da assinatura dos avisos;
- os identificadores estáveis do menu lateral usados em `chatwoot.esconder`.

## Notas por versão

### 1.0.0

Primeira versão: robô sem estado com quatro provedores de IA (OpenAI e compatíveis, Anthropic, Gemini e o próprio projeto), modos responder, sugerir e desligado; provisionamento por conta com conta de serviço, robô da conta, equipe como atendente e login único; rota oficial pela caixa WhatsApp Cloud do Chatwoot e não oficial pelo OpenWA com o adaptador; telas de modelo em React com a camada `primitives.tsx`; rotas de modelo para o Next.js; tema gerado de escolhas.json; conferências por HTTP e no navegador. Versões travadas: Chatwoot 4.19.1 (`-ce`), OpenWA 0.29.1, adaptador 0.9.15.
