# Copiloto de vendas

Acompanha as suas calls de vendas pelo seu playbook: revê uma call já feita, treina com você e, ao vivo, mostra o que perguntar e o que responder enquanto a conversa acontece.

## O que ele faz

Quem vende por call costuma descobrir tarde o que deu errado: o preço saiu antes de o cliente dizer quanto o problema custa, uma objeção ficou sem resposta, a conversa acabou sem data marcada. Este app lê a call fala por fala, com as mesmas perguntas para todas, e mostra onde isso aconteceu.

Ele trabalha de três jeitos:

- **Rever uma call.** Você traz a transcrição e recebe um documento com as etapas da conversa, as objeções e como cada uma terminou, o que faltou no roteiro, quanto cada lado falou e as falas que mais pesaram, com a jogada indicada e uma frase do seu playbook para cada uma.
- **Treinar.** A sua IA faz o cliente, você escreve as suas falas, e a cada rodada vê para que lado a conversa foi e qual seria a próxima jogada.
- **Ao vivo.** Uma página abre no seu computador durante a call e mostra a etapa, a objeção em aberto, o que falta perguntar e a próxima jogada, atualizados a cada fala.

Em todos eles aparece o sinal da call, um número de 0 a 100 que diz para que lado a conversa anda. Ele é uma regra de bolso, com pesos que o app declara e que você pode mudar. Não é uma previsão de venda.

O playbook é o seu: o que você vende, o preço que você diz, as jogadas e as frases na sua voz. Sem ele, o app usa um playbook modelo com frases que servem a qualquer negócio.

## O que você precisa

- O Claude Code, onde o app foi testado.
- Para rever uma call: a transcrição dela. Serve o arquivo que a sua ferramenta de reunião exporta ou um texto com uma fala por linha. Uma gravação sem transcrição ainda não entra.
- Para a call ao vivo: uma chave do OpenRouter, um serviço pago por uso, que lê cada fala. A sua IA abre uma página no navegador para você colar a chave, uma vez só. A chave é criada em openrouter.ai, na área de chaves.
- Para o app ouvir a call em vez de você digitar as falas: uma chave do Gemini, criada no Google AI Studio com a sua conta Google e colada do mesmo jeito. Sem ela, quem transcreve é o OpenRouter, que para áudio pede um saldo mínimo na conta.
- Para o app ouvir o cliente ao vivo: a reunião aberta numa aba do navegador, e fone de ouvido.

Nada disso é instalado ou digitado por você: a sua IA cuida dos comandos.

## Peça assim

> "Reveja esta call de vendas: transcricoes/call-clinica.txt. O vendedor sou eu, Rafael."

Outros pedidos:

> "Monte o playbook de vendas do meu negócio."

> "Quero treinar uma call com um cliente que acha caro."

> "Vou entrar numa call de vendas agora. Abra o copiloto ao vivo."

## O que ele grava

| Caminho | Conteúdo |
|---|---|
| `copiloto-de-vendas/playbook.json` | o playbook do seu negócio: o que você vende, as jogadas, as frases e o roteiro |
| `copiloto-de-vendas/calls/<call>/relatorio.md` | o documento da call |
| `copiloto-de-vendas/calls/<call>/call.json` | as falas, de onde vieram e as respostas dadas a cada uma |
| `copiloto-de-vendas/calls/<call>/leitura.json` | a leitura calculada, para outros apps |
| `copiloto-de-vendas/pesos.json` | só se você mudar algum peso do sinal |

As calls ficam na pasta do projeto. Quem atende vários clientes usa um projeto para cada um.

## Sem a chave

A revisão de uma call, o treino e o playbook funcionam sem chave nenhuma: quem responde às perguntas sobre cada fala é a sua IA. A chave do OpenRouter serve só à call ao vivo, em que cada fala precisa ser lida em menos de um segundo. A do Gemini serve só para transcrever o áudio dessa call; sem nenhuma chave de áudio, as falas são digitadas na página.

## Quanto custa o modo ao vivo

O OpenRouter cobra pelo uso, direto na sua conta de lá. A página mostra o gasto da call enquanto ela acontece e para de consultar o serviço ao chegar no teto, que é de US$ 0,50 por call até você pedir outro. Depois do teto as falas continuam gravadas, e a sua IA lê as que faltaram.

A transcrição pelo Gemini usa a sua chave do Google e, quando é cobrada, é cobrada lá: ela não entra nesse teto. O que a limita é o tempo da call.

## Privacidade

- Na revisão e no treino, as falas vão só para a sua IA, como qualquer arquivo do projeto.
- Ao vivo, as últimas falas da call vão para o OpenRouter a cada fala. Com o microfone ou o áudio da reunião ligados, cada trecho de áudio vai para o Gemini, ou para o OpenRouter quando não há chave do Gemini.
- Avise o cliente de que a conversa será transcrita. A sua IA pergunta isso antes de abrir o modo ao vivo.
- A página da call existe só no seu computador, num endereço de uso único, e fecha sozinha no fim.

## O que há de novo

- 1.0.0: primeira versão.
