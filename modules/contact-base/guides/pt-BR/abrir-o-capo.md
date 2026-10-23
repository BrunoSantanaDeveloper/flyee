# Abrir o capô

Como a base é lida, agrupada e transformada em régua por dentro.

## O inventário sem tirar dado do projeto

O app lê os exports pelos cabeçalhos, em português ou em inglês: e-mail, telefone, nome, data de cadastro, último uso, último contato, status ou plano, pedidos, receita, origem, consentimento, descadastro. Normaliza o e-mail (minúsculas) e o telefone (só dígitos, com o 55 e o DDD; um número de 8 ou 9 dígitos fica marcado como sem DDD), tira os duplicados por e-mail e depois por telefone, juntando o que uma linha tinha e a outra não, e descarta colunas que não servem para escrever a ninguém (CPF, endereço, data de nascimento). Uma coluna de paciente, dependente ou terceiro recusa o arquivo inteiro: o app só lê usuários e contatos da marca.

O arquivo que os outros apps leem, o inventário, traz só contagens: total, duplicados, inválidos, por grupo, por uso, por origem, quantos estão sem contato há seis meses. A lista limpa fica em outro arquivo, na pasta do projeto, e não sai da máquina.

## Os grupos

Quatro grupos pela relação com a marca: clientes (pagam hoje), ex-clientes (pagaram e saíram), testaram (usaram sem pagar) e nunca ativaram (cadastraram e não usaram). Três faixas pelo uso: ativos (usaram nos últimos 30 dias), parados (entre 30 e 180) e inativos (há mais de 180, ou nunca). E uma marca a mais: sem contato há seis meses ou mais, que decide a primeira mensagem.

## A base legal como método

Cada grupo tem oito campos: como entrou, o texto aceito, os dados presentes, o último contato e os descadastros, onde a lista está guardada, a base legal (consentimento, legítimo interesse ou execução de contrato), o teto de contatos e a retenção. Enquanto um campo estiver vazio, a régua do grupo fica pendente. Não há assinatura nem cerimônia: é um registro feito uma vez e emendado quando a marca muda. Quem pediu para sair não recebe marketing em nenhum grupo; o transacional não entra na régua.

## A repermissão

Quem não recebe nada há seis meses ou mais recebe antes a pergunta se ainda quer receber, em duas mensagens curtas, cinco dias entre elas, com um link de um clique para ficar. Quem não clica sai da régua e fica guardado só para não ser contatado de novo. O script não aceita outra primeira mensagem para esse grupo: é o que protege a reputação do remetente, porque quem não quer receber reclama, e a reclamação derruba a entrega para todos.

## Os segmentos e o teto

O engajamento é medido por uso e por pedidos, nunca pela abertura do e-mail sozinha: o aplicativo de e-mail do iPhone abre tudo por conta própria. Janelas de 30, 90 e 180 dias; clientes novos e recorrentes; os melhores clientes pelos 10% de maior receita; um RFM simples (recência, frequência e valor em quintis) quando a base tem pedidos e receita. O teto: uma mensagem de marketing por 16 horas, três por semana, cinco só na semana de pico e com fim marcado; quem comprou nos últimos sete dias fica fora das promoções.

## A régua

Nove mensagens possíveis, ancoradas no aquecimento e no pico do plano (ou numa data alvo, com o aquecimento começando sete dias antes e o pico durando quatro): a repermissão, a novidade, o convite para testar, a prova, a lista, o acesso antecipado, a abertura, o lembrete e o último dia. Cada uma com data e dia da semana, o público dentro do grupo, o trabalho, um assunto de até 45 caracteres, o chamado e o link pela regra única do plano, com o nome da mensagem no lugar do nome do anúncio. Duas mensagens no mesmo dia são afastadas; uma data que já passou entra hoje, e o aviso diz. A escada de ofertas por grupo garante que quem já paga nunca pague mais do que quem entra agora.

## O que o app não faz

Não envia, não entra em ferramenta de e-mail ou de mensagem, não pede senha e não dá parecer jurídico.
