# A base legal de cada grupo: o método

Este guia é para a IA. A lei de proteção de dados pede que toda mensagem de marketing tenha uma razão para existir: a pessoa consentiu, ou ela é cliente (ou quase) e espera ouvir da marca, ou a mensagem é parte do serviço que ela contratou. O app não dá parecer jurídico; ele registra, por grupo, o que a marca sabe, e trava a régua enquanto faltar algo. Na dúvida, quem responde é quem cuida do jurídico da marca.

## Os quatro grupos

| Grupo | Quem é | Base legal mais comum | O que recebe |
|---|---|---|---|
| clientes | paga hoje | legítimo interesse (espera ouvir da marca) | novidades, acesso antecipado, bônus; nunca paga mais do que quem entra agora |
| ex-clientes | pagou e saiu | legítimo interesse, com cuidado: se saiu há muito tempo, repermissão | a volta com um bônus; nunca um desconto mais fundo do que o do pico |
| testaram | usou sem pagar | legítimo interesse (testou a marca) ou consentimento, pelo texto do cadastro | a oferta do pico, com a prova do que mudou |
| nunca-ativaram | cadastrou e não usou | consentimento, pelo texto que leu ao cadastrar; sem o texto, repermissão | o convite para testar antes da oferta |

Quem pediu para sair não recebe marketing em nenhum canal, em nenhum grupo. O transacional (confirmação, cobrança, acesso) é execução de contrato e não entra na régua de marketing.

## Os oito campos de cada grupo

1. **Como entrou**: o formulário, a compra, o teste, a planilha de um evento; quem trouxe.
2. **Texto aceito**: a frase que a pessoa leu ao entrar, com ou sem a parte sobre receber novidades. Sem o texto, a base é mais fraca, e a repermissão vira o caminho.
3. **Dados presentes**: e-mail, telefone, nome, datas de uso; nada além do necessário para escrever. CPF, endereço e data de nascimento ficam fora da base limpa.
4. **Último contato e descadastros**: quando foi a última mensagem e quantos pediram para sair. Seis meses ou mais sem contato pede repermissão.
5. **Onde está guardada**: a ferramenta ou a planilha, quem tem acesso.
6. **Base legal**: consentimento, legítimo interesse ou execução de contrato.
7. **Teto de contatos**: quantas mensagens de marketing por semana o grupo recebe, no máximo.
8. **Retenção**: por quanto tempo a base fica guardada e o que acontece com quem não responde à repermissão (sai da régua e fica só na lista de exclusão).

## A repermissão

Quem não recebe nada há 6 meses ou mais recebe primeiro a pergunta: ainda quer receber? Com um link de um clique para ficar. Duas mensagens, cinco dias entre elas; quem não clicar sai da régua e fica guardado só para não ser contatado de novo. Nenhuma promoção antes do sim. É o que protege a reputação do remetente (quem não quer receber reclama, e a reclamação derruba a entrega para todo o resto) e o que a lei espera de quem ficou meio ano em silêncio.

## O que o app faz com isto

`legal` cria `contatos/base-legal.md` com uma seção por grupo e os oito campos, e marca cada grupo como `pendente` ou `completo`. `sequence` lê o arquivo: a régua de um grupo pendente é escrita, mas marcada `pendente`, e a IA pergunta ao integrante o que falta, numa mensagem só, com a sugestão de cada campo. Quando o grupo fica completo, a régua passa a `pronta`. Nada é assinado nem cerimônia: é um registro, feito uma vez e emendado quando a marca muda.
