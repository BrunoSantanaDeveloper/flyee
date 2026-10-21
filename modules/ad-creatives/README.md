# Criativos para anúncios

Prepara os criativos da sua campanha de tráfego pago no Instagram e no Facebook: pesquisa os anúncios que os seus concorrentes mantêm no ar, propõe três conceitos com a evidência de cada um, produz os vídeos e as imagens conferidos de cada conceito e entrega os textos, os nomes dos anúncios e a conta da verba.

## O que ele faz

Na primeira campanha ainda não existe dado próprio de anúncio. O que existe é o que o mercado já paga: um anúncio que um concorrente mantém no ar há meses é um anúncio que funciona para ele. O app parte daí.

- **O briefing.** A sua IA pergunta só o que falta: a oferta, a página de destino, o evento que a campanha vai otimizar, a verba por dia, o público e o que não pode ser dito. Nada é inventado: sem o dado, o campo fica em branco.
- **A conta da verba antes de tudo.** A Meta precisa de cerca de 50 eventos em 7 dias para um conjunto sair da fase de aprendizado. Com a sua verba e o seu evento, o app mostra se a campanha chega lá e, se não chega, as três saídas, para você escolher antes de produzir qualquer peça.
- **A pesquisa.** Com a chave do Apify, o app colhe sozinho os anúncios ativos dos concorrentes na Biblioteca de Anúncios da Meta. Sem ela, ele monta os links já filtrados e um roteiro curto do que fotografar; você abre os links no navegador e salva as capturas, e a sua IA lê cada uma. Nos dois casos, o app calcula há quanto tempo cada anúncio está no ar, quantas versões ele tem e o que se repete entre os concorrentes.
- **Mais evidência, quando você tem os outros apps.** A Pesquisa no Instagram mede o seu perfil e o dos concorrentes, as Pesquisas no Instagram e no YouTube trazem o que o seu público escreve nos comentários, e a Análise de vídeo destrincha, segundo a segundo, o anúncio que um concorrente mantém há mais tempo.
- **Três conceitos com ficha.** Cada conceito parte de uma barreira ou de um motivador de quem compra e traz o gancho, a prova e a evidência que o sustenta, cada dado com a origem e a data. A confiança é calculada pelo app, pelo número de tipos de fonte a favor; um conceito sem evidência aparece como aposta, nunca como achado. Nada é produzido antes do seu sim.
- **As peças de cada conceito.** Um vídeo vertical de até 15 segundos para Stories e Reels, o mesmo vídeo em 4:5 e uma imagem para o feed, com o logo e as cores do seu site e trilha original. Tudo fica dentro da área que a interface dos anúncios não cobre. Você vê a prévia antes do final, e o app confere a capa, a área segura, o tamanho do texto, os cortes na batida e o volume.
- **Os textos e os nomes.** O texto de cada anúncio passa por uma conferência: promessa de resultado, termos que você proibiu, frase que afirma uma condição de quem vê (a Meta recusa) e os limites de texto da Meta. Cada anúncio recebe um nome; se o seu site escolhe a página pelo nome que chega no link, o app segue o padrão do site.
- **Antes de pagar.** Um guia de Reels de teste mostra como comparar os vídeos com quem ainda não segue o seu perfil, e o resultado volta para a próxima rodada.

## O que ele não faz

- Não cria a campanha nem entra na sua conta de anúncios: ele prescreve, e quem monta no Gerenciador é você.
- Não promete nem prevê resultado. A evidência ordena apostas.
- Não usa o seu login da Meta para pesquisar: a coleta pelo Apify roda sem a sua conta.
- Não gera pessoa, rosto ou depoimento. Uma prova com pessoa real só entra com o material que você fornecer; uma versão com alguém falando para a câmera fica como roteiro para você gravar.

## O que você precisa

- Uma IA que leia imagens, como o Claude Code: ela lê as capturas dos anúncios e olha os quadros das peças.
- O app **Motor de vídeo** (`video-render`), que copia a marca do seu site, compõe a trilha, renderiza e confere as peças. Quando ele faltar, a sua IA diz em uma frase o que vai instalar e instala.
- O **ffmpeg** e um navegador sem janela. No Windows, o Microsoft Edge já vem instalado. Você não instala nada: a sua IA cuida disso na primeira vez, depois de avisar.
- Opcional: a chave do **Apify**, para a coleta automática, criada em console.apify.com. A sua IA abre uma página no seu navegador para você colar a chave; ela não passa pela conversa. O Apify cobra pelo uso, do crédito da sua conta lá, e o app sempre manda um limite de itens e de gasto e pede o seu sim antes de uma coleta acima de US$ 1.
- Opcional: os apps **Pesquisa no Instagram** (`instagram-research`), **Pesquisa no YouTube** (`youtube-research`) e **Análise de vídeo** (`video-analysis`). Quando um deles faltar, a sua IA diz o que ele traria e pergunta se pode instalar.

## Sem a chave

Tudo funciona sem a chave do Apify. A pesquisa dos concorrentes é a guiada: você abre os links da Biblioteca de Anúncios já filtrados e salva as capturas dos primeiros anúncios de cada concorrente, e a sua IA lê cada uma. Os conceitos, as peças, os textos, a conta da verba e o diário são os mesmos. A chave só automatiza a coleta.

## O que ter em mãos

- A oferta, a página de destino, a verba por dia e o evento que a campanha vai otimizar.
- De três a cinco concorrentes, ou as palavras do seu nicho: a busca por palavra também acha quem anuncia para o mesmo público.
- Opcional, na pasta `materiais/` da campanha: o logo e telas do produto (com nomes começando por `logo` e `tela`) e, se quiser prova com pessoa real, o depoimento com a autorização.

## Peça assim

> "Prepare os criativos da minha primeira campanha no Instagram. Vendo o plano anual do meu app de agenda, a página é https://… e tenho R$ 50 por dia."

Outros pedidos:

> "Quero anúncios para a campanha de inverno da loja. Meus concorrentes são a Loja Norte e a Casa Sul."

> "Os prints dos anúncios estão na pasta. Pode ler e me mostrar o que o mercado faz?"

> "Troque o gancho do conceito de economia e refaça a prévia."

## O que ele grava

Tudo fica em `anuncios/` dentro do seu projeto, uma pasta por campanha:

| Caminho | Conteúdo |
|---|---|
| `anuncios/<campanha>/briefing.md` | o briefing |
| `anuncios/<campanha>/pesquisa/` | os links da Biblioteca, as suas capturas, as leituras delas e o que o Apify colheu |
| `anuncios/<campanha>/evidencias.md` | o resumo do que o mercado mostra, com a origem e a data de cada dado |
| `anuncios/<campanha>/conceitos.md` | as fichas dos três conceitos |
| `anuncios/<campanha>/pecas/<conceito>/` | as páginas, a prévia e as peças finais de cada conceito |
| `anuncios/<campanha>/entrega/` | os vídeos e as imagens com o nome de cada anúncio, a capa, os textos e os nomes |
| `anuncios/<campanha>/lancamento.md` | a estrutura, a conta da verba, o que conferir antes de ligar e o que não mexer |
| `anuncios/<campanha>/diario.json` | a rodada, as hipóteses e as aprovações, para a próxima rodada |
| `capturas/` | as telas copiadas do site da marca |

## O que há de novo

- 1.1.0: o vídeo 4:5 e a imagem 4:5 ou 1:1 para o feed; a coleta pelo Apify, com a chave opcional; a evidência da Pesquisa no Instagram, da Pesquisa no YouTube e da Análise de vídeo; o guia de Reels de teste.
- 1.0.0: primeira versão. Pesquisa guiada dos concorrentes, três conceitos com ficha, um vídeo vertical por conceito, a conferência dos textos, a conta da verba e o diário.
