# Como usar

Você tem uma base de contatos (clientes, quem testou, quem só se cadastrou) e quer usá-la numa campanha. A sua IA limpa e conta a base sem tirar nenhum dado do projeto, registra com você por que a marca pode escrever para cada grupo, separa quem usa de quem parou e escreve a régua de e-mail com as datas do plano. Quem envia é você, pela sua ferramenta.

## Peça assim

- "Tenho uma planilha com contatos antigos e quero usar na campanha. Me ajuda a limpar e a montar a régua."
- "Quantos da minha base ainda podem receber e-mail?"
- "Monta a régua para quem testou e não assinou."
- "O que preciso ter registrado antes de escrever para a base?"

## O que acontece

1. Você exporta a lista de usuários ou contatos da sua ferramenta, em CSV, e a IA faz o inventário: tira os duplicados, separa os e-mails inválidos, completa os telefones com o 55 e o DDD, agrupa (quem paga, quem pagou e saiu, quem testou, quem só se cadastrou) e conta. Você ouve três linhas: quantos podem receber, quantos por grupo, quantos estão sem contato há seis meses.
2. Ela registra com você a base legal de cada grupo, numa mensagem só com até quatro perguntas: como as pessoas entraram, o que leram, onde a lista está, por que a marca pode escrever, quantas mensagens por semana. Enquanto faltar algo, a régua daquele grupo fica pendente.
3. Ela separa os segmentos pelo uso e pelas compras, nunca só pela abertura de e-mail, e define o teto: uma mensagem de marketing por 16 horas, três por semana, cinco só na semana do pico.
4. Ela escreve a régua de cada grupo, ancorada no plano: para quem não ouve da marca há seis meses, primeiro a pergunta se ainda quer receber; depois a novidade, o convite para testar, a prova, a lista, o acesso antecipado, a abertura, o lembrete e o último dia. Cada mensagem com data, assunto curto, chamado e link.
5. Ela escreve o corpo de cada mensagem, com o rodapé que diz quem escreve, de onde veio o contato e como sair, e revisa o texto para soar como gente. Você envia pela sua ferramenta, nas datas da régua.

## O que você recebe

| Onde | O quê |
|---|---|
| contatos/base-limpa.csv | a lista limpa, com os grupos; fica no projeto e não sai da máquina |
| contatos/inventario.json | só as contagens |
| contatos/base-legal.md | a base legal de cada grupo |
| contatos/segmentos.json | os segmentos, o teto de mensagens e a escada de ofertas |
| contatos/regua.md | a régua de cada grupo, com datas, assuntos, chamados e links |

## Dicas

- Exporte a lista com as datas de cadastro, de último uso e de último contato: é com elas que a IA separa quem está ativo de quem parou e sabe quem precisa da repermissão.
- Exporte só usuários e contatos. Uma lista com dados de pacientes, dependentes ou terceiros é recusada.
- Sem o plano de mídia, diga a data alvo: a régua se ancora nela.

## Limites

- O app não envia nada e não entra na sua ferramenta de e-mail ou de mensagem.
- A base legal é método, não parecer jurídico.
- Quem pediu para sair não recebe mais nada de marketing, em nenhum canal.
- Os limiares são regras de bolso com data; o seu histórico vale mais quando existir.

## Por WhatsApp

A mesma régua sai por WhatsApp em quatro toques (a pergunta se ainda quer receber, um a um; o acesso antecipado; a abertura; o último dia), só para quem aceitou receber por lá. Cada mensagem é um modelo curto que o seu provedor aprova dois dias antes, pela API oficial ou um a um, nunca por disparo de um número comum. Aceitar e-mail não é aceitar WhatsApp: enquanto o texto que as pessoas aceitaram não falar de WhatsApp ou mensagem, a régua fica pendente.

## Antes do primeiro envio

A IA confere no DNS público se o domínio que manda os seus e-mails está autenticado (SPF, DMARC e DKIM), como o Gmail e o Outlook exigem de quem envia em volume. O que falta vem com o que criar, nas palavras para quem cuida do seu DNS; o que depende de uma mensagem real ou do relatório da sua ferramenta (o descadastro em um clique, as reclamações, as rejeições) fica a conferir com você. Uma lista parada volta em lotes: primeiro quem usou há pouco, e o lote dobra enquanto os números ficarem limpos.

## O público para a Meta

Para anunciar para a sua base ou excluir os seus clientes dos anúncios, a IA prepara o público personalizado só em hash: o e-mail e o telefone embaralhados como a Meta pede, só de quem pode receber marketing e não pediu para sair, e a lista de exclusão dos clientes atuais. Com menos de 100 pessoas o arquivo não sai, e o público fica na régua. Quem sobe é você, com o passo a passo ao lado; a taxa de reconhecimento que a Meta mostrar é a que vale.

## A voz do cliente e o atendimento

Antes de escrever anúncio ou e-mail, a IA deixa pronto o questionário de sete perguntas e o roteiro de uma conversa de 20 minutos. Você ouve cinco a oito clientes e cinco a oito pessoas que testaram e não ficaram; as frases entram como foram ditas, só com o primeiro nome ou a profissão, e viram evidência para os criativos. E o arquivo do atendimento do pico fica pronto para você preencher: quem responde, em quanto tempo, as respostas às objeções, quem cobre o fim de semana.
