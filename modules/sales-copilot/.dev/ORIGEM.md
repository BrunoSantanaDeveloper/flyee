# Origem e o que foi provado (nota do operador, não sai no pacote)

Pedido do operador em 2026-11-15: trazer `github.com/felipenunes07/playbook-sales-copilot` (commit `2f1df34`, 2026-10-28) como ferramenta do flyee, já com o modo ao vivo.

## O que entrou e o que não

- O repositório não tem arquivo de licença, nem o de origem (`moritzkremb/jev-sales-copilot`, `license: null` na API do GitHub em 2026-11-15). Pela D31 entrou só a ideia do método: perguntas tipadas por fala a um modelo de decisões, a conta feita em código, fatos que persistem, objeção com abertura e fechamento, roteiro conferido, recálculo com outros pesos sem perguntar de novo.
- Nenhum texto foi copiado: as perguntas (`references/perguntas.json`), as jogadas e frases (`references/playbook-modelo.json`), os pesos (`references/pesos.json`) e a página foram escritos aqui. O playbook de lá é da marca Playbook Lab; os exemplos daqui usam a marca fictícia Agenda Clara (D22).
- "Probabilidade de fechamento" virou "sinal da call", rotulado como regra de bolso (D23). Os pesos são um ponto de partida sem medição: nenhuma call real com resultado conhecido passou por eles.
- De fora: a sala de vídeo própria (túnel cloudflared, TURN, Redis), o login por senha, o deploy na Vercel, a frase reescrita por um segundo modelo, os provedores alternativos do Jev (jevmodel.org, BeatAPI, SDK da TypeSafe) e o replay de calls de exemplo.
- Diferente do plano mostrado ao operador: o app não chama o `video-analysis`. A transcrição de uma gravação com quem fala em cada fala não foi testada, então a 1.0.0 pede a transcrição e diz que a gravação ainda não entra.

## Provado em 2026-11-15, nesta máquina

- Jev real (`typesafe/jev-1.14` em `POST openrouter.ai/api/alpha/decisions`, endpoint marcado alpha) com as perguntas deste app e falas em português: 22 perguntas por fala, 0,5 a 1,3 s, cerca de US$ 0,00022 por fala (5.300 tokens de entrada). Uma call de 16 falas pelo servidor ao vivo: US$ 0,003.
- A página no Edge sem janela, com microfone falso tocando uma frase sintetizada: o corte por pausa gerou trechos `webm` válidos, a transcrição (falsa, local) virou fala e o Jev real leu.
- `tests/*.test.mjs`: 20 testes, com modelo e transcrição falsos em 127.0.0.1.

- Na mesma noite, a pedido do operador, a transcrição passou a ser do Gemini quando a chave `GEMINI_API_KEY` existe (o OpenRouter fica de reserva). Provado sem nada falso: a página no Edge sem janela, microfone falso com a frase sintetizada, Gemini real (`gemini-flash-lite-latest`, que respondeu como `gemini-3.5-flash-lite`) e Jev real. O `webm` que a página grava foi aceito como `audio/webm`: 1,2 s por trecho no Flash Lite, 2,1 s no Flash com raciocínio zerado, 4,5 s no Flash padrão. Numa das rodadas a primeira palavra ("Olha,") não saiu na transcrição; o dispositivo falso começa a tocar antes de o gravador ligar, e não separei essa causa de um corte do Gemini. 22 testes.

## Não provado

- A transcrição pelo Gemini com fala humana, ruído e duas pessoas, e o limite de pedidos por minuto de uma chave sem cobrança numa call longa (um trecho por fala).
- A transcrição real do OpenRouter (`POST /api/v1/audio/transcriptions`, `elevenlabs/scribe-v2`): a conta do operador tinha menos de US$ 0,50 e o serviço recusa áudio abaixo disso (402). O formato do pedido veio do cookbook do OpenRouter; o campo de custo da resposta e a qualidade em português não foram vistos. O preço por segundo usado na estimativa (0,0000611) vem da lista de modelos e a unidade é suposição minha.
- O áudio da aba da reunião (`getDisplayMedia`) num navegador com janela: o caminho depois de obter o áudio é o mesmo do microfone, mas a captura da aba não rodou.
- Uma call real de vendas ao vivo, com vendedor e cliente de verdade.
- Os pesos contra calls com resultado conhecido.
