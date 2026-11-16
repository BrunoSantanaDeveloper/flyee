# Como usar

O Copiloto de vendas acompanha as suas calls pelo seu playbook. Ele revê uma call que você já fez, treina com você antes de uma call difícil e, durante a call, mostra numa página o que perguntar e o que responder. Você sai de cada call sabendo o que faltou e com a frase pronta para a próxima.

## Peça assim

> "Reveja esta call de vendas: transcricoes/call-clinica.txt. O vendedor sou eu, Rafael."

> "Monte o playbook de vendas do meu negócio."

> "Quero treinar uma call com um cliente que acha caro e precisa falar com o sócio."

> "Vou entrar numa call de vendas agora. Abra o copiloto ao vivo."

> "Das calls que já revimos, o que as que fecharam têm de diferente?"

## O que acontece

**Rever uma call.** Você traz a transcrição: o arquivo que a sua ferramenta de reunião exporta ou um texto com uma fala por linha. Se os nomes não deixarem claro quem vende, a IA pergunta uma vez quem é o vendedor. Depois ela lê a call fala por fala e mostra três linhas: o sinal da call, o que mais pesou contra e o que faltou no roteiro. O documento completo fica na pasta do app.

**Montar o playbook.** A IA procura no seu projeto o que você vende e pergunta, numa mensagem só, o que só você sabe: o preço que você diz na call, o próximo passo que você costuma propor e com o que os clientes comparam você. Depois escreve as frases de cada jogada na sua voz. Se você não souber uma resposta, diga que não sabe e ela segue.

**Treinar.** A IA sugere um cenário e faz o papel do cliente. Você escreve o que diria, e a cada rodada ela mostra o sinal, a objeção em aberto e a próxima jogada. No fim você recebe o mesmo documento de uma call de verdade.

**Ao vivo.** A IA pergunta se o cliente foi avisado de que a conversa será transcrita. Com o seu sim, ela abre uma página no seu navegador. Na página você liga o seu microfone, compartilha o áudio da aba da reunião para o app ouvir o cliente e deixa a página ao lado da reunião. A cada fala ela mostra a etapa, a objeção em aberto, o que falta perguntar e a próxima jogada, com uma frase para dizer. No fim, clique em Encerrar e volte à conversa com a IA.

Na primeira vez do modo ao vivo, a IA abre outra página para você colar a chave do OpenRouter, que lê cada fala, e oferece fazer o mesmo com a chave do Gemini, que transcreve o áudio. As chaves não passam pela conversa.

## O que você recebe

| Onde | O quê |
|---|---|
| Na conversa | três linhas sobre a call e o que cabe a você decidir |
| Pasta copiloto-de-vendas, dentro de calls | uma pasta por call, com o documento, as falas e a leitura |
| Pasta copiloto-de-vendas | o playbook do seu negócio |

O documento de uma call traz as etapas da conversa, o roteiro item por item com a pergunta que faltou, as objeções e como cada uma terminou, quanto cada lado falou e as falas que mais pesaram, com a jogada indicada.

## Dicas

- Diga o resultado de cada call quando souber: virou venda ou não. Com os resultados de várias, o app compara o sinal das que fecharam com o das que não fecharam.
- Monte o seu playbook cedo. Com as suas frases, a sugestão ao vivo sai do jeito que você fala.
- Ao vivo, use fone de ouvido. Sem ele, o seu microfone capta a voz do cliente e as falas se misturam.
- Se uma fala saiu no nome da pessoa errada, a página tem um botão que corrige a última.
- Numa reunião presencial, um microfone serve aos dois: marque essa opção na página e use a tecla S para trocar quem fala.

## Limites

- O sinal da call é uma regra de bolso. Ele mostra para que lado a conversa anda e não prevê se a venda fecha.
- Duas leituras da mesma call podem dar números um pouco diferentes, porque as notas de clima e de participação dependem de quem lê. As objeções e os itens do roteiro variam menos.
- Uma call sozinha é um indício. A comparação entre calls só diz algo com os resultados de várias delas.
- Uma gravação sem transcrição ainda não entra na revisão.
- Ao vivo, o app não separa sozinho duas vozes no mesmo microfone.
- O app não envia mensagem, não marca reunião e não fala com o cliente. Ele lê a conversa e sugere.
- O documento sai em português.
