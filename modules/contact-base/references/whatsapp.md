# WhatsApp: a régua pela API oficial

Este guia é para a IA. O WhatsApp é onde o público do Brasil conversa, e por isso é onde uma mensagem errada custa mais caro: o número é bloqueado e a marca some do canal. O app escreve a régua em WhatsApp com as mesmas datas da de e-mail; quem envia é o integrante, pela conta da API oficial ou um a um.

## As regras que não se quebram

- **Só pela API oficial, ou um a um.** Nunca disparo em massa de um número comum: o número é banido e a base vai junto.
- **Opt-in registrado.** Só recebe quem deu o número e aceitou receber por WhatsApp, com a data e o texto do aceite; aceitar e-mail não é aceitar WhatsApp.
- **Modelos aprovados com antecedência.** Toda mensagem fora da janela de 24 horas usa um modelo aprovado pela Meta, na categoria certa (marketing, utilidade, autenticação); a aprovação leva de minutos a dois dias, então os modelos entram na fila na fase de testes.
- **A janela de 24 horas.** Depois que a pessoa responde, a conversa fica aberta por 24 horas para mensagens livres; fora dela, só modelo.
- **A qualidade do número.** A Meta classifica o número em verde, amarelo e vermelho pela reação das pessoas (bloqueios e denúncias); vermelho reduz quantos podem receber por dia. Uma reclamação a cada 200 mensagens já derruba.
- **Horário.** Das 9 às 20 horas no fuso de quem recebe; nunca de madrugada, nunca em feriado.
- **Sair com uma palavra.** "Parar", "sair" e "stop" tiram a pessoa da lista na hora, e a mensagem diz como sair.
- **Repermissão para a base antiga.** Quem não ouve da marca há seis meses recebe antes uma mensagem um a um perguntando se quer receber; nada de promoção antes do sim.

## A régua em WhatsApp

Mais curta do que a de e-mail: a repermissão (um a um), o acesso antecipado, a abertura e o último dia. Cada mensagem com até 300 caracteres, uma pergunta ou um link, o nome da marca no começo e como sair no fim. O e-mail carrega a prova e a história; o WhatsApp carrega a data.

## O que o app faz

`sequence <grupo> --channel whatsapp` escreve a régua do grupo em WhatsApp, com as mesmas âncoras e as mesmas regras de base legal e repermissão, e marca cada mensagem com a categoria do modelo (marketing ou utilidade) e o prazo para pedir a aprovação. Quem cadastra os modelos e envia é o integrante, pela plataforma da API oficial dele.
