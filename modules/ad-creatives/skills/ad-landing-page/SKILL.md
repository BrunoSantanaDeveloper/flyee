---
name: ad-landing-page
description: Escreve o briefing da página de destino de uma campanha paga, a partir do plano e do que os anúncios prometem, e confere a página viva pela captura do site (o chamado na primeira tela, as palavras em comum com o anúncio, preço e prazo contra o plano, as linhas legais). Use quando pedirem a página do anúncio, a continuidade entre anúncio e página, ou a conferência da página antes de ligar.
---

# A página de destino do anúncio

Quem clicou numa promessa precisa achá-la em cima da página, nas mesmas palavras. Esta skill escreve o que a página precisa ter e confere a página viva; ela não constrói a página. Os comandos partem da raiz do projeto (o script fica em `../../scripts/ads.mjs` a partir desta pasta):

```
node .flyee/modules/ad-creatives/scripts/ads.mjs page <brief|audit> <campanha> --json
```

Só o JSON vai para o stdout. Em erro, `ok` é `false` e `error` traz `code`, `message` e `fix`. **Todo resultado traz `next_step`.**

## O briefing da página

`page brief <campanha> --json` escreve `anuncios/<campanha>/pagina-briefing.md` a partir do plano (`media-plan/<plano>/pagina.md`, quando existe), do briefing da campanha e dos conceitos aprovados: a primeira frase por ângulo, o que a página mostra, as objeções respondidas em uma linha, as linhas que a lei pede (preço de referência, prazo com data e hora, regras, os 7 dias de arrependimento, o aviso de cookies), o que ela faz por dentro (preservar a UTM até o cadastro, disparar os eventos, carregar rápido no celular) e as perguntas de qualificação. Entregue ao integrante, ou a quem constrói a página, como veio; o que o plano não respondeu aparece como `[a decidir]`, e você pergunta numa mensagem só.

## A conferência da página viva

`page audit <campanha> --json` lê a captura do site feita pelo Motor de vídeo (`capturas/<site>/captura.json`, a mesma do `capture`) e devolve, item a item, `ok`, `atencao` ou `nao_conferido`:

- o primeiro chamado aparece na primeira tela (a altura do chamado contra a altura da tela capturada);
- as palavras do título da página em comum com o título de cada anúncio;
- os preços da página contra o preço do plano ou do briefing;
- o prazo da oferta na página contra a data do plano;
- as linhas legais no texto capturado (arrependimento de 7 dias, política de privacidade, cookies, preço de referência).

O que a captura não trouxe sai como `nao_conferido`, nunca como reprovado. Diga ao integrante só o que está em `atencao` e o que não deu para conferir, com a palavra do `say`; a lista completa fica em `pagina-conferida.json`. Sem captura, rode `capture <campanha>` antes.

## Regras que não se quebram

- A promessa do anúncio e a primeira frase da página são a mesma, nas mesmas palavras. Um anúncio que promete uma coisa e uma página que fala de outra paga o clique duas vezes.
- Um chamado só acima da dobra, repetido no fim.
- Nada na página que o `copy` recusaria no anúncio: a mesma regra de promessa, de atributo pessoal e de termos proibidos.
- Preço de referência verdadeiro, prazo com data e hora, regras escritas; quem já é cliente nunca paga mais do que quem entra agora.
- Você não edita a página do integrante: escreve o briefing e aponta o que conferir.
