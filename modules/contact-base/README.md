# Base de contatos e CRM

Transforma a sua base antiga de contatos numa régua que pode ser enviada, sem tirar nenhum dado do projeto. Este texto é o guia dentro do projeto; a página do app no flyee.club lê os guias em `guides/`.

## O que ele faz

Você exporta a lista de usuários ou contatos da sua ferramenta e a sua IA faz o inventário: tira os duplicados, separa os e-mails inválidos, põe o 55 e o DDD nos telefones, agrupa quem paga, quem pagou e saiu, quem testou sem pagar e quem só se cadastrou, e conta. Só as contagens saem da base; a lista limpa fica na pasta do projeto e não vai para lugar nenhum.

Depois ela registra, com você, a base legal de cada grupo: como as pessoas entraram, o que leram ao entrar, onde a lista está guardada, por que a marca pode escrever para elas e quantas mensagens por semana é o teto. Enquanto faltar algo, a régua daquele grupo fica pendente.

Com isso ela separa os segmentos (quem usou nos últimos 30, 90 e 180 dias, quem comprou uma ou mais vezes, os melhores clientes, quem está sem contato há seis meses) e escreve a régua de e-mail de cada grupo, ancorada nas datas do plano de mídia: a repermissão para quem não ouve da marca há seis meses, a novidade, o convite para testar, a prova, a lista, o acesso antecipado, a abertura, o lembrete e o último dia. Cada mensagem tem data, um trabalho só, um assunto curto, um chamado e um link com a regra única do plano, para a medição saber de onde veio cada clique.

A mesma régua sai por WhatsApp, em quatro toques, para quem aceitou receber por lá: cada mensagem é um modelo que o seu provedor aprova dois dias antes, pela API oficial ou um a um, nunca por disparo de um número comum. Antes do primeiro envio em volume, a IA confere no DNS público se o seu domínio está autenticado (SPF, DMARC e DKIM) e diz o que criar quando falta, com os limiares de saúde de cada envio e o plano de lotes de uma lista parada. Para a Meta, ela prepara o público personalizado só em hash, com a lista de exclusão dos seus clientes atuais. E deixa prontos o questionário da voz do cliente, cuja síntese vira evidência para os criativos, e o arquivo do atendimento do pico.

Quem envia é você, pela sua ferramenta de e-mail ou pela sua conta da API do WhatsApp. O app prepara tudo e não entra em ferramenta nenhuma.

## O que você precisa

- Uma das IAs em que o app foi testado.
- O export de usuários ou contatos da sua ferramenta, em CSV, com e-mail ou telefone. Cabeçalhos em português ou em inglês.
- O plano aprovado do app de plano, quando houver: as datas, a marca, a página e a regra de link vêm de lá. Sem ele, você diz a data alvo.
- Nenhuma chave e nenhum programa a mais.

## Peça assim

> "Tenho uma planilha com 480 contatos antigos, muitos sem contato há meses. Quero usar na Black Friday. Me ajuda a limpar e a montar a régua."

> "Monta a régua de e-mail para quem testou e não assinou."

## O que ele grava

| Caminho | Conteúdo |
|---|---|
| `contatos/entrada/` | os exports que você traz; é só daqui que o app lê |
| `contatos/base-limpa.csv` | a lista limpa, com os grupos de cada pessoa; fica no projeto e não sai da máquina |
| `contatos/inventario.json` | só as contagens: total, duplicados, inválidos, grupos, origens |
| `contatos/base-legal.md` | a base legal de cada grupo, nos oito campos |
| `contatos/segmentos.json` | os segmentos, o teto de mensagens e a escada de ofertas |
| `contatos/regua.json` e `regua.md` | a régua de cada grupo, por e-mail e por WhatsApp, com as datas, os assuntos, os modelos e os links |
| `contatos/envio.md` e `entregabilidade.json` | a conferência do domínio de envio, item por item, os limiares de saúde e os lotes |
| `contatos/publicos/` | o público para a Meta só em hash, a lista de exclusão dos clientes e o passo a passo para subir |
| `contatos/voz-do-cliente.md` e `voz-leitura.json` | o questionário, o roteiro e a leitura declarada que o app de criativos importa |
| `contatos/atendimento.md` | quem responde no pico, em quanto tempo, e as respostas às objeções |

## Bom saber

- Uma lista com coluna de paciente, dependente ou terceiro é recusada: o app só lê usuários e contatos da marca.
- Quem não recebe nada há seis meses ou mais recebe primeiro a pergunta se ainda quer receber, e nada de promoção antes do sim.
- A base legal é método, não parecer jurídico. Na dúvida, quem responde é quem cuida do jurídico da sua marca.
- Os limiares (30 e 180 dias de uso, 6 meses sem contato, 1 mensagem por 16 horas, 3 por semana) são regras de bolso marcadas com a data; o plano e os seus números valem mais.
- Quem pediu para sair não recebe mais nada de marketing, em nenhum canal.
- Aceitar e-mail não é aceitar WhatsApp: a régua por WhatsApp fica pendente até o texto aceito falar de WhatsApp ou mensagem.
- A conferência do domínio só marca como ok o que viu no DNS; o que depende de uma mensagem real ou de um relatório fica a conferir com você.
- A lista legível nunca sobe para a Meta: o arquivo do público traz só hashes, e a taxa de reconhecimento que a Meta mostra substitui a estimativa do app.

## O que há de novo

- 1.1.0: a régua por WhatsApp pela API oficial, a conferência de entrega do domínio (SPF, DMARC, DKIM, limiares e lotes), o público personalizado para a Meta só em hash com a lista de exclusão dos clientes, a voz do cliente com a leitura declarada para os criativos e o atendimento do pico.
- 1.0.0: primeira versão. O inventário da base com a limpeza e as contagens, a base legal por grupo, os segmentos com o teto de mensagens e a escada de ofertas, e a régua de e-mail por grupo ancorada no plano ou numa data alvo, com a repermissão para quem está sem contato há seis meses.
