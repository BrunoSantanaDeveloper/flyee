# Gestão de tráfego pelo Orkestree, produção pelo flyee: plano de implementação

**Objetivo:** o integrante pede "analise a campanha e monte a próxima" e só responde ao que é decisão dele. O Orkestree lê a conta de anúncios, decide o que testar e o que produzir, pede permissão antes de cada escrita na conta e encomenda as peças. A IA do integrante produz as peças com os apps do flyee, no plano de IA dele, e as entrega de volta.

> Auditado contra o código em 2026-11-16 (flyee `4a797f6`; Orkestree pela leitura do plano dele e por grep, sem rodar nada). Legenda: ✅ existe · 🟡 parcial · ⬜ não existe · ⚠️ correção.

## Andamento (2026-11-16, nada commitado)

| Tarefa | Estado | Evidência |
|---|---|---|
| T1.1 | ✅ `ads-insights` 1.1.0 | `intake` em `modules/ads-insights/scripts/lib/intake.mjs`; `tests/intake.test.mjs` conta uma rodada com três perguntas e nenhum nome de coluna; 31 testes do app passam; `npm run validate` ok |
| T1.2 | ⬜ | espera um export real no conjunto padrão de colunas, com os nomes trocados |
| T2.1 | ✅ | `grep -n "PLANO-GESTAO-TRAFEGO" docs/PLANO-ANUNCIOS.md` mostra a D14, as invariantes 5 e 15 e a linha 722 |
| T2.2 | ✅ | `ad-creatives` 1.3.0, passo 6 da skill: com pedido, quem cria a campanha é o Orkestree; os textos do `ads-insights` continuam verdadeiros, porque nenhum app escreve na conta |
| T3.1 | 🟡 | contrato em `orkestree/docs/CONTRATO-PRODUCAO.md`, versão 1, decidida em 2026-11-16 (o operador confirmou S240 a S247 na sessão do Orkestree), nenhuma rota servida ainda |
| T3.2 | 🟡 `orkestree-link` 1.0.0 | 6 testes contra um Orkestree falso que fala o contrato (`modules/orkestree-link/tests/link.test.mjs`), inclusive SHA-256 adulterado e texto acima do limite; ⬜ contra o Orkestree real, que ainda não serve as rotas |
| T3.3 | 🟡 `ad-creatives` 1.3.0 | `brief` lê o pedido e pergunta só o que ele não traz; a aprovação do pedido vale enquanto chave, ângulo e gancho não mudam; `nomes.json` com `sha256` e `bytes`; 78 testes, `tests/order.test.mjs`; cadeia `take --file` e `brief` rodada na pasta de trabalho. ⬜ a evidência do pedido não entra na confiança da ficha; ⬜ `round next` ainda não lê `from_verdicts` |
| T3.4 | ⬜ | espera o `kind` `conteudo`, numa versão seguinte do contrato |
| ÉPICO 4 | 🟡 decidido, não construído | ÉPICO S17 (TS17.1 a TS17.8) de `orkestree/docs/PLANO.md`, com a S80 revista (S242), sem commit |

**Onde o flyee diverge ou depende do contrato:** o endereço é `https://www.orkestree.com`, e só um endereço desta máquina o substitui (testes), como a seção 3 do contrato passou a dizer; a lista de botões de `modules/orkestree-link/references/botoes.json` não foi conferida na documentação da Meta, e o contrato a registra como não conferida até o TS17.2; o pedido ganhou `brand`, `product`, `audience` e `forbidden_terms`, opcionais, a pedido do flyee, e o `ad-creatives` 1.3.0 os lê, perguntando só os que não vierem (`tests/order.test.mjs`).

## Origem

- **Os vídeos avaliados em 2026-11-16.** Cinco vídeos do YouTube sobre automação de marketing com IA (5LyNOEOsVcU, WnZsMYeR7aA, 02PkMOH2nqg, uJuxenfe-NU, yvdUd9nlONU). As transcrições estão em `flyee-workspace/youtube-research/videos/<id>/`. A ideia que fica é a do uJuxenfe-NU: a leitura vem de uma base própria, a API de anúncios só escreve, e a regra de decisão é código. Nenhum dos cinco deixa a IA decidir a conta sozinha. Até o mais autônomo deixa a ativação para uma pessoa (yvdUd9nlONU, 42:05).
- **O caso que mostrou o problema.** Num projeto de marca do operador, em 2026-11-16, a pergunta "já tenho o resultado da campanha, o que preciso fornecer?" recebeu de volta:
  - um export com 16 colunas a acrescentar à mão no Gerenciador;
  - uma lista de cadastros com e-mail;
  - uma linha sobre o que mudou e capturas dos Reels de teste;
  - quatro fatos para a campanha seguinte.

  O pedido enxuto (o export como está e dois números) só veio depois de o operador perguntar se um relatório só não bastava. Pela D22, o caso é evidência; os épicos são produto.
- **As instruções do operador em 2026-11-16.** O processo precisa ser simples. A IA pode mexer na conta de anúncios, desde que peça permissão antes. A produção de peças fica no flyee, local, para gastar o plano de IA do integrante e não token pago. A gestão e a automação ficam no Orkestree, que diz o que perguntar e o que produzir conforme analisa.

## 0. Decisões que o implementador não inventa

| # | Decisão | Valor | Onde mora |
|---|---|---|---|
| G1 | A IA mexe na conta de anúncios? | **Decidido pelo operador em 2026-11-16:** sim, pedindo permissão antes de cada escrita (criar, ativar, pausar, mudar verba, trocar peça, subir público ou conversão). Substitui a D14 e as invariantes 5 e 15 de `docs/PLANO-ANUNCIOS.md`. | Este plano. No Orkestree, cada passo leva o efeito `money` ou `external_write`, que esperam uma pessoa (`orkestree/packages/automations/src/definition.ts:302-306`). |
| G2 | Quem gere e automatiza | **Decidido:** o Orkestree. Ele lê resultados, julga, decide o próximo teste, cria e escala campanhas, agenda e relata. | Plano do Orkestree, a registrar pela sessão dele. |
| G3 | Quem produz | **Decidido:** o flyee, na máquina do integrante, com a IA e o plano dele: criativos, textos, páginas e conteúdo. | Apps do catálogo. |
| G4 | A produção local roda sem o integrante? | **Decidido em 2026-11-16: não.** O pedido espera a sessão dele, e a IA oferece: "o Orkestree pediu 6 peças para a campanha X, posso produzir?". Motivo: os Termos de Consumidor da Anthropic só permitem acesso automatizado por chave de API ou onde ela permitir, e os limites dos planos supõem uso individual comum (code.claude.com, `legal-and-compliance`, lido em 2026-11-03). Rodar sem a pessoa exigiria a chave de API do integrante. | Skill do app de ligação (T3.2). |
| G5 | Como a conta da Meta se liga ao Orkestree | **Decidido em 2026-11-16: (b) no primeiro cliente, (a) em paralelo.** As duas opções: (a) o Orkestree vira provedor de tecnologia da Meta e passa pela revisão de app; para o integrante, um clique em "Continuar". (b) Cada empresa cria o próprio app e usuário de sistema e cola o token no cofre. Isso funciona na própria conta sem revisão, mas são uns dez passos no Gerenciador de Negócios, e o limite da camada sem revisão é de 300 + 40 × anúncios ativos chamadas por hora. | Cofre do Orkestree (`orkestree/packages/connectors/src/vault.ts`); painel de apps da Meta. |
| G6 | Contrato entre Orkestree e flyee | **Decidido em 2026-11-16:** um documento do Orkestree, como o `CLI-CONTRACT.md` da plataforma, com o pedido de produção e a entrega. O flyee depende só dele e testa contra um servidor falso. | `orkestree/docs/`, a criar. |
| G7 | Revisão da S80 do Orkestree | **Decidido em 2026-11-16: revisar; pedido à sessão do Orkestree no mesmo dia.** ⚠️ A S80 diz "nenhuma dependência" entre os produtos e "a CLI do flyee volta a falar só com o flyee.club" (`orkestree/docs/PLANO.md:174`). Com G2 e G3, a gestão de tráfego do Orkestree passa a contar com o integrante tendo os apps do flyee. O Orkestree continua sem instalar nada do flyee.club; quem instala é o integrante. A S80 precisa dizer isso. | Plano do Orkestree. |
| G8 | Nome e trilha do app de ligação | **Decidido em 2026-11-16:** `orkestree-link`, tool, trilha escalar. | Manifesto. |
| G9 | Quem tem campanha agora | **Decidido em 2026-11-16:** enquanto o Orkestree não tem o conector, o flyee segue como hoje: prescreve, e a pessoa cria. O ÉPICO 1 simplifica o que ele pede. Uma data comercial próxima não muda a ordem dos épicos. | Este plano. |

## 0.5 Convenções do repositório que valem aqui

- **Fronteira.** O flyee nunca importa código do Orkestree. O app de ligação fala só o contrato (G6), como a CLI fala só o `CLI-CONTRACT.md`. O flyee funciona inteiro sem o Orkestree (`docs/PLANO.md:44`).
- **Chave.** O token do Orkestree entra por `npx --yes flyee@latest key set ORKESTREE_TOKEN --browser`. Os scripts leem a variável de ambiente primeiro e depois `~/.flyee/keys.json`. O token nunca aparece no chat, num comando ou no projeto.
- **O integrante não abre terminal.** A IA roda tudo.
- **Como um app pergunta.** Até quatro coisas por mensagem, só o que dá para responder agora, com a sugestão na pergunta (`.claude/rules/apps.md`). Um teste conta as rodadas, no molde de `modules/contact-base/tests/rounds.test.mjs`.
- **Números.** Todo número leva rótulo e fonte. O veredito é calculado por script, nunca escrito pela IA (D23 e invariante 19 de `docs/PLANO-ANUNCIOS.md`).
- **Versões.** Cada mudança num app publicado é versão nova, com `changelog`.
- **Prova.** Uma regra que muda o que um app produz se prova construindo: teste passando não prova resultado melhor (`.claude/rules/apps.md`, 2026-11-08).
- **Windows primeiro.** Todo programa chamado tem limite de tempo.

## Invariantes

1. **Nenhuma escrita na conta de anúncios sem o sim do integrante àquela escrita.** Vale para criar, ativar, pausar, mudar verba, trocar peça e subir público ou conversão. Dinheiro gasto não volta, e uma pausa errada perde o aprendizado do conjunto.
2. **Nenhum gasto acima do teto que o integrante aprovou, nem com o sim dele a um passo.** O passo que passaria do teto volta como pedido de um teto novo. Um sim dado a uma ação não é um sim a outro valor.
3. **A produção local nunca começa sem o integrante na sessão (G4).** Usar o plano de IA dele sem ele contraria os termos do plano.
4. **O Orkestree só cria anúncio com arquivo cujo SHA-256 confere com o da entrega.** Um arquivo trocado no caminho iria ao ar com o dinheiro do integrante.
5. **O que o pedido diz não volta como pergunta.** O integrante responde uma vez, no Orkestree. Perguntar de novo na sessão local é o que tornou o caso da origem difícil.
6. **A IA não martela a API de anúncios.** O Orkestree lê em lote para a base dele, e a IA consulta a base; a API serve à escrita e à leitura agendada. O uJuxenfe-NU (14:03 a 15:30) aponta os agentes que disparam milhares de chamadas como causa de contas bloqueadas.
7. **A entrega do flyee para o Orkestree não leva dado pessoal.** Leva peças, textos, nomes e conferências (D29).
8. **O flyee continua inteiro sem o Orkestree.** Quem não tem Orkestree recebe a prescrição como hoje.
9. **Nenhuma peça leva depoimento, especialista ou cliente gerado por IA.** É a invariante 11 de `docs/PLANO-ANUNCIOS.md`, que a G1 não muda. Dois dos vídeos fazem isso (02PkMOH2nqg, 18:03; uJuxenfe-NU, 36:07), e isso é publicidade enganosa (CDC, art. 37).

## ÉPICO 1: o flyee pede menos, já

**Bloqueia:** nada. Vale para quem usa só o flyee e para a transição (G9).

### T1.1: a leitura começa com um pedido só

**Estado: 🟡.**
- O script aceita o export como vier e põe o que falta em `missing`, nunca em zero (`modules/ads-insights/skills/ads-insights/SKILL.md:39`).
- A regra de perguntar existe para o contrato de medição: o script entrega as perguntas e a IA as repassa (`SKILL.md:26` e `:31`; `questions` só em `scripts/lib/contract.mjs` e `scripts/insights.mjs`).
- ⬜ A leitura não tem um passo que entregue as perguntas. No caso da origem, a IA montou a própria lista.

O trabalho:
- Comando novo `intake --json`. Ele devolve no máximo duas perguntas:
  - o export no nível de anúncio, do período, como está, sem lista de colunas;
  - quando o evento é compra ou cadastro, "quantos entraram no período e quantos vieram dos anúncios?", com a lista de cadastros como alternativa, nunca como pedido principal.
- Depois do `import`, se faltar uma coluna que muda um veredito, o `report` devolve no máximo uma pergunta por coluna, com o caminho no Gerenciador.
- O que mudou durante a campanha sai das datas e do estado no export e de `movimentos.json`. Captura de Reels de teste não entra na leitura de campanha.
- O que a campanha seguinte precisa perguntar fica com o `media-plan`, na vez dele. A leitura não pergunta antes.
- `ads-insights` 1.1.0, com `changelog`.

**Aceite:**
- Um teste no molde de `rounds.test.mjs` roda `intake` num projeto com plano de evento compra e conta: uma rodada, no máximo duas perguntas, nenhuma com nome de coluna.
- Um caso de `tests/eval.json` com marca fictícia: a primeira resposta da IA pede um arquivo só.

### T1.2: o export padrão dá veredito?

**Estado: ⬜, não medido.** Não se sabe quais colunas vêm no conjunto padrão do Gerenciador, nem quais vereditos ficam de pé sem as colunas de vídeo (gancho e ThruPlay).
- Rodar `import` e `report` sobre um export no conjunto padrão, com nomes de anúncio trocados.
- Listar quais vereditos saem dele e quais viram `dado_insuficiente`.

**Aceite:** uma fixture `tests/fixtures/meta-padrao.csv` e um teste que afirma quais vereditos saem dela. O texto do `intake` cita só as colunas que esse teste mostrou faltar.

## ÉPICO 2: a D14 nos documentos e nos textos

### T2.1: os planos

**Estado: ⚠️ corrigido neste commit.** `docs/PLANO-ANUNCIOS.md` diz em três lugares que nenhum app escreve na conta: a D14 (linha 43), a invariante 5 (linha 91) e a segunda invariante 15 (linha 521). As três agora apontam para a G1.

**Aceite:** `grep -n "PLANO-GESTAO-TRAFEGO" docs/PLANO-ANUNCIOS.md` mostra as três.

### T2.2: os textos que o integrante lê

**Estado: ✅, ainda verdadeiros.** Estes textos dizem que nenhum app entra na conta, e continuam certos enquanto nenhum app escreve:
- `modules/ads-insights/README.md:11`;
- `modules/ads-insights/skills/ads-insights/SKILL.md:24`;
- `modules/ad-creatives/skills/ad-creatives/SKILL.md:25` e `:92`;
- `modules/ad-creatives/references/lancamento.md:3`.

Eles mudam na versão que trouxer o ÉPICO 3. Com o Orkestree ligado: "o Orkestree cria a campanha pausada depois do seu sim". Sem ele, como hoje.

**Aceite:** nessa versão, o eval com Orkestree falso mostra a frase nova, e o eval sem Orkestree mostra a de hoje.

## ÉPICO 3: o flyee como fábrica

**Bloqueia:** a T3.2 e a T3.3 esperam o contrato (G6).

### T3.1: o pedido e a entrega (contrato, do lado do Orkestree)

**Estado:**
- ⬜ Um grep por "pedido de produção", "work order" e "production order" em `docs/` e nos apps do flyee e em `orkestree/docs` e `orkestree/packages` volta zero.
- 🟡 A entrega já existe em arquivo: `anuncios/<campanha>/entrega/nomes.json`, com `ad_name`, `concept`, `angle` e `files[]` com `placement`, `format` e `kind` (`modules/ad-creatives/references/interface.md`, "O que este app grava para os outros"), e os textos em `anuncios/<campanha>/textos.json`.

O trabalho:
- **Pedido:**
  - id, campanha, objetivo e evento, oferta e página (ou o `plano.json` inteiro);
  - os conceitos com a evidência e a aprovação (data e origem), ou "a partir dos vereditos" com o `report.json`;
  - formatos e posicionamentos, quantidade por conceito, padrão de nome, limites de texto e prazo.
- **Entrega:** o `nomes.json` v1, mais `sha256` e `bytes` por arquivo, os textos por anúncio, as conferências do motor e a versão do app que produziu.

**Aceite:** o documento existe no Orkestree, e o servidor falso da T3.2 responde exatamente os exemplos dele.

### T3.2: o app de ligação

**Estado: ⬜.**
- **Comandos:**
  - `check`;
  - `orders` (pedidos abertos);
  - `take <id>`, que grava `anuncios/<campanha>/pedido.json`;
  - `deliver <campanha>`, que sobe os arquivos e o manifesto, com o SHA-256 conferido pelo servidor;
  - `status <id>`.
- **Chave:** `ORKESTREE_TOKEN` em `external_credentials`. Sem a chave, o app ainda entrega: o integrante cola o pedido em `anuncios/<campanha>/pedido.json` e recebe o pacote na pasta, para subir pelo painel do Orkestree.
- **A skill:**
  - oferece os pedidos abertos quando o integrante pergunta "o que o Orkestree pediu?" ou abre a sessão no projeto e pede trabalho;
  - nunca roda sozinha (G4).

**Aceite:**
- Testes contra um Orkestree falso:
  - listar, pegar e entregar com a soma certa;
  - recusar a entrega com a soma errada;
  - sem token, `needs_member` com o `key set`.
- Verde no Windows e no Linux (imagem `flyee-ci-linux`).

### T3.3: o `ad-creatives` lê o pedido

**Estado: 🟡.**
- `brief` já preenche o briefing a partir de `media-plan/<plano>/plano.json`, com `source: plano` (`modules/ad-creatives/references/interface.md`, "O que este app lê").
- `round next` já lê o `report.json` da medição e propõe a rodada seguinte (`modules/ad-creatives/scripts/lib/round.mjs:55-80`).
- `deliver` já escreve `nomes.json`.
- ⬜ Nada lê `pedido.json`.

O trabalho:
- `brief` lê `pedido.json` antes do plano, com `source: pedido`.
- Conceitos aprovados no Orkestree entram aprovados, com a data e a origem da aprovação.
- O que o pedido diz não volta como pergunta (invariante 5).
- `round next` aceita os vereditos que vêm no pedido no lugar do `report.json` local.
- `deliver` acrescenta `sha256` e `bytes` em `nomes.json`. São campos novos, e a interface v1 só cresce.
- Versão nova com `changelog`. A regra se prova construindo: uma rodada real de um pedido, olhada ao lado do que a rodada anterior produziu.

**Aceite:**
- Com um pedido fictício de marca inventada, `brief` e `status` chegam a `pecas` sem nenhuma pergunta sobre o que o pedido diz, contado por teste.
- Cada arquivo de `nomes.json` traz a soma, e ela confere com `sha256sum`.

### T3.4: os apps de conteúdo

**Estado: ⬜.** `motion-carousel`, `video-studio` e `youtube-script` passam a ler um pedido de conteúdo, pelo mesmo contrato, depois da T3.3.

**Aceite:** o mesmo da T3.3, para cada app.

## ÉPICO 4: o lado do Orkestree (a planejar pela sessão dele)

Este épico está aqui só para deixar a fronteira clara. O plano e o aceite dele moram em `orkestree/docs/PLANO.md`.

**Estado, pelo código (grep e plano, nada rodou):**
- 🟡 Existem:
  - o agendador (`packages/automations/src/schedule.ts`);
  - a fila de aprovação por efeito (`packages/automations/src/definition.ts:302-306`);
  - o cofre (`packages/connectors/src/vault.ts`);
  - o bloco `chamar_conector` (`packages/blocks/src/library.ts`);
  - no site do próprio Orkestree, o pixel com a API de Conversões (`apps/web/src/lib/meta-capi.ts`), o GA4 e a atribuição por UTM.
- ⬜ Não há conector de anúncios: grep por `act_`, `adsets`, `Marketing API` e `googleads` volta zero.
- Conteúdo e tráfego é a TS11.5 (`docs/PLANO.md:1582-1586`), o último passo da ordem de construção.

**O que entra nele:**
- **O4.1 Conector da Meta.** A ligação (G5), a leitura agendada para a base, e a escrita só como passo com efeito `money` ou `external_write`.
- **O4.2 Leitura e regras.** Uma cópia das regras do `ads-insights` (`references/leitura.json`, `scripts/lib/verdict.mjs`, `scripts/lib/moves.mjs`), como a S80 permite, com um teste que compara a cópia com a versão de origem.
- **O4.3 Pedidos de produção.** O pedido sai dos vereditos, pela lógica de `round.mjs`. Depois vêm a espera pela entrega, a criação pausada com permissão e a ativação com permissão.
- **O4.4 Relatório curto.** Três linhas e as decisões (D33), por WhatsApp ou e-mail, com as permissões pendentes.
- **O4.5 Conteúdo.** Publicação e resposta privada a comentário pela API oficial do Instagram: uma resposta por comentário, em até 7 dias. Precisa de webhook, por isso mora no servidor.
- **Primeiro cliente:** o marketing do próprio Orkestree, o cliente zero (S72), que já tem as tags.

## Riscos

| Risco | Primeiro sinal | Saída |
|---|---|---|
| A revisão da Meta demora ou recusa (G5 a) | A resposta à primeira submissão | A opção (b), por empresa |
| As regras copiadas divergem entre os dois produtos | O teste de comparação do O4.2 falha | Atualizar a cópia na mesma semana |
| Uma data comercial pressiona a ordem dos épicos | Pedido de pular o ÉPICO 1 | G9 |
| O plano de IA do integrante não aguenta a produção | Erros de limite de uso na sessão | O pedido traz a quantidade da conta da verba, nunca "o máximo" |
| Os termos da Anthropic mudam (G4) | A página `legal-and-compliance` | Rever a G4 |
| A conta de anúncios é bloqueada por excesso de chamadas | Erros de limite da API na leitura agendada | Ler em lote, invariante 6 |

## O que este plano não cobriu

- **Orkestree:** foram lidas as linhas citadas do plano e o código, por grep; nada rodou. Os estados ✅ e 🟡 dele são os que o plano dele declara.
- **Meta:** as camadas de acesso e o limite de chamadas vêm de resultados de busca de 2026-11-16 que citam as páginas da Meta (`developers.facebook.com/docs/marketing-api/overview/rate-limiting` e `.../marketing-api/access/`), sem leitura da página inteira. O formato da importação em massa do Gerenciador não foi conferido.
- **Sessão de origem:** só a troca de 2026-11-16 foi lida.
- **Export padrão:** não se sabe se o conjunto padrão do export traz as colunas de vídeo; é a T1.2.
