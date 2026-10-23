# Plano de estratégia e mídia

Monta o plano de tráfego pago da sua marca a nível de especialista, antes de qualquer anúncio: o que um cliente pode custar, de onde vem a meta, a oferta, o calendário até a data alvo e o que fazer primeiro. Este texto é o guia dentro do projeto; a página do app no flyee.club lê os guias em `guides/`.

## O que ele faz

Você diz o que quer vender e até quando. A sua IA olha o que o projeto já sabe (briefings de campanha, a captura do seu site, a pesquisa no Instagram, o inventário da sua base) e pergunta só o que falta, numa mensagem só, cada pergunta já com uma sugestão e o que muda se a resposta for outra.

Depois ela faz as contas: quanto um cliente pode custar pelo seu preço e pela sua margem, quantos clientes podem vir de quem já conhece a marca e quantos de quem nunca ouviu falar, quantos leads e visitas isso pede, três cenários de verba, se a verba tira um conjunto de anúncios da fase de aprendizado da Meta e quantas vezes a sua base veria o mesmo anúncio. Monta as formas de oferta a partir do seu preço, aponta a colisão entre uma promoção que está no ar e a seguinte, e lista as linhas que uma oferta vendida à distância precisa ter. Desenha o calendário de trás para frente da data alvo, com as fases, as janelas de aprendizado, o ponto de decisão, os prazos que não se discutem e os feriados nacionais no caminho.

O plano sai escrito, curto em cima e completo embaixo: o que olhamos, dois ou três achados com a certeza de cada um, o que fazer primeiro, as decisões que são suas, a história, até seis movimentos, o que não vamos fazer e o que não conseguimos conferir. Ele fica em rascunho até você aprovar, e a versão aprovada fica congelada. Os outros apps do flyee leem o plano aprovado: os criativos partem da oferta e do evento dele, a régua da sua base parte das datas das fases.

## O que você precisa

- Uma das IAs em que o app foi testado.
- O seu preço e, se souber, a margem e quanto tempo um cliente costuma ficar. Sem isso o app usa faixas de referência, sempre marcadas como tal, e pede para você trocar pelo seu número.
- Nenhuma chave e nenhum programa a mais.

## Peça assim

> "Quero um plano de tráfego pago para a minha marca até a Black Friday. Temos uma base de contatos antigos e nunca anunciamos. Me diga se começar antes faz sentido e por onde começar."

## O que ele grava

| Caminho | Conteúdo |
|---|---|
| `media-plan/marca.md` | os fatos estáveis da sua marca, com fonte e data, lidos antes de qualquer pergunta |
| `media-plan/<plano>/premissas.json` | as premissas do plano, cada uma com a origem: informada por você, encontrada no projeto ou sugerida e pendente |
| `media-plan/<plano>/cenarios.json`, `oferta.json`, `calendario.json` | as contas |
| `media-plan/<plano>/plano.md` e `plano.json` | o plano para você ler e o plano para os outros apps lerem |
| `media-plan/<plano>/plano-v1.md` | a versão aprovada, congelada; as seguintes vêm numeradas |
| `media-plan/<plano>/decisoes.md` | cada aprovação, com a data e a sua frase |

## Bom saber

- O plano não promete resultado. Os cenários são contas sobre suposições marcadas; os seus números substituem as faixas assim que existem.
- As faixas de referência (conversão, custo por lead, CPM) vêm de guias escritos para outro mercado e valem só como ordem de grandeza. Cada uma aparece no plano com a fonte e a data.
- Os feriados marcados são os nacionais. Os da sua cidade e do seu estado você acrescenta em `marca.md`.
- O app não cria campanhas, não sobe públicos e não envia mensagens: ele prescreve, e quem executa é você, com a sua IA ao lado.
- As linhas do código do consumidor e da proteção de dados são método, não parecer jurídico.

## O que há de novo

- 1.0.0: primeira versão. Olhar antes de perguntar, até quatro perguntas com sugestão, premissas rotuladas, a conta do que um cliente pode custar, o funil ao contrário com três cenários e o teto da capacidade do time, a fase de aprendizado e a frequência da base, as formas de oferta com a colisão entre promoções e as linhas do consumidor, o calendário por fases com feriados e o plano escrito como rascunho até o seu sim.
