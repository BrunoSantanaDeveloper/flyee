# Contexto do robô: de onde vem, quem controla, como atualiza

O modelo de IA não é treinado. A cada mensagem, o robô monta o contexto da conta e manda junto. Por isso uma informação nova vale em até um minuto (o robô guarda a configuração por 60 segundos), uma errada sai na hora, nenhum dado de cliente fica gravado num modelo e trocar de provedor não perde nada.

## Os dois modelos de atendimento

Escolha no começo, em `escolhas.json`, campo `modelo`:

| Modelo | Quando usar | Contas no Chatwoot | Quem controla o contexto |
|---|---|---|---|
| `plataforma` | o sistema atende os próprios clientes, como um suporte da plataforma | uma, a do sistema | só o superadmin |
| `por-cliente` | cada cliente do sistema atende os clientes dele (um escritório, uma loja) | uma por cliente | o superadmin define as regras de todos e o que cada cliente pode mudar; o administrador do cliente mexe só no que foi liberado |

## As camadas

- **Plataforma.** Editada pelo superadmin, numa tela da área dele (`RoboAtendimento` com `escopo="plataforma"`). Sempre existe. No modelo `por-cliente`, as instruções e o conhecimento dela entram no prompt como "Regras da plataforma" e "Conhecimento da plataforma", antes dos do cliente, com a regra de que valem acima deles. Ela também guarda: o que cada cliente pode mudar (`client_permissions`), quais consultas os clientes podem ligar (`tools_available`), o provedor de IA (`ai`), aprender com a equipe (`learning`) e o relatório das lacunas (`report`). Modo `desligado` na plataforma desliga o robô de todos.
- **Cliente.** Só no modelo `por-cliente`. Editada pelo administrador do cliente (`escopo="cliente"`), e só nos grupos liberados: apresentação, instruções, conhecimento, horário, mensagens, quando passar para a equipe, consultas e modo. O servidor descarta o que vier de um grupo não liberado (`applyClientEdits`), então esconder o campo na tela não é a única barreira. O que o cliente nunca preencheu vem da plataforma.

A junção das camadas é `botConfig` em `base/shared/settings.mjs`; a rota `config` do robô a devolve pronta.

## De onde vem o que o robô sabe

| Fonte | Quem alimenta | Atualiza | Limite |
|---|---|---|---|
| Regras e conhecimento da plataforma | superadmin | em até 1 minuto depois de salvar | 20 mil caracteres de instruções e 150 mil de perguntas e respostas por camada |
| Instruções e conhecimento do cliente | administrador do cliente, se liberado | em até 1 minuto | os mesmos, por cliente |
| Consultas ao sistema (pedido, agenda, boleto) | o desenvolvedor escreve; o superadmin oferece; o cliente liga, se liberado | sempre atual: o robô consulta na hora | só dados da pessoa da conversa |
| A conversa | automático | a cada mensagem | as últimas 30 mensagens, por 24 horas na memória do robô; depois de reiniciar, o histórico vem do sistema |

No prompt, o conhecimento das duas camadas somado vai até 200 mil caracteres (umas 100 páginas). Acima disso o texto é cortado com aviso; para bases maiores, use uma consulta de busca do próprio sistema.

## Cache: texto grande sem pagar caro a cada mensagem

O prompt tem uma parte fixa (regras, instruções, conhecimento, consultas e o formato da resposta), igual em toda mensagem da conta, e uma parte variável (data, horário da equipe e nome do contato), que vai depois.

- **Anthropic.** A parte fixa vai num bloco com `cache_control`; ler do cache custa uma fração do preço normal de entrada (5% no Claude Opus 5.5, 10% na maioria dos modelos). O cache dura 5 minutos e se renova a cada leitura; contas com mensagens espaçadas de 5 a 60 minutos ganham com `ai.cache_ttl: "1h"` na camada da plataforma, cuja gravação custa mais.
- **OpenAI e Gemini.** O cache deles é automático por prefixo; a parte fixa no começo é o que o faz funcionar.

## Aprender com a equipe, com aprovação

1. Quando uma conversa que o robô passou para a equipe (etiqueta `robo-passou`) é resolvida, o Chatwoot avisa o robô (`conversation_resolved`).
2. O robô pede o histórico ao sistema, tira dado pessoal (e-mail, telefone, CPF, CNPJ, número de processo, cartão) e pede à IA até 3 perguntas e respostas gerais a partir do que a equipe respondeu. Resposta que só vale para aquela pessoa não vira sugestão.
3. As sugestões chegam ao sistema (rota `suggestions`) e esperam aprovação de quem é dono do conhecimento daquela conta (`knowledgeOwner`): o superadmin no modelo `plataforma`, ou quando o cliente não pode mexer no conhecimento; senão, o administrador do cliente.
4. Na tela `SugestoesConhecimento`, a pessoa edita, aprova (entra no conhecimento da camada dona) ou descarta. Nada entra sozinho.

O superadmin liga ou desliga isso em `learning`.

## Relatório das lacunas

A cada passagem para a equipe, o robô registra (rota `events`) a categoria (`nao_sei`, `pedido_da_pessoa`, `decisao_humana`, `reclamacao`, `risco`, `limite`, `anexo`, `falha`, `outro`), o assunto em poucas palavras e um trecho curto já sem dado pessoal. A tela `LacunasRobo` agrupa por assunto nos últimos 7, 30 ou 90 dias. O superadmin vê todos os clientes; o administrador do cliente, só o dele. Os assuntos de categoria `nao_sei` são o mapa do que falta no conhecimento, com um botão para criar a pergunta.

O superadmin liga ou desliga isso em `report`.

## O que fica para depois

Uma base de documentos com busca (o cliente envia PDFs e páginas do site, o sistema divide em trechos e o robô busca só os trechos da pergunta) fica para quando algum cliente precisar. Até lá, um sistema que já tem busca própria a oferece como uma consulta.
