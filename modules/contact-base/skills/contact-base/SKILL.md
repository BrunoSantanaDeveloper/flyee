---
name: contact-base
description: Transforma a base de contatos de uma marca numa régua que pode ser enviada: limpa e conta os exports sem tirar dado do projeto, registra a base legal de cada grupo, escreve a régua de e-mail e de WhatsApp nas datas do plano com repermissão após seis meses, confere a entrega do domínio e prepara o público da Meta em hash. Use para a base antiga, uma régua, um CRM simples ou o e-mail do lançamento.
---

# Base de contatos e CRM

O integrante tem uma base de contatos (clientes, quem testou, quem só se cadastrou) e quer usá-la numa campanha; você cuida do inventário, da base legal, dos segmentos e da régua, e ele envia pela ferramenta dele. Os comandos partem da raiz do projeto, a pasta que contém `.flyee/` (o script fica em `../../scripts/contacts.mjs` a partir desta pasta):

```
node .flyee/modules/contact-base/scripts/contacts.mjs <comando> [opções] --json
```

Só o JSON vai para o stdout; o progresso vai para o stderr. Em erro, `ok` é `false` e `error` traz `code`, `message` e `fix`. **Todo resultado traz `next_step`**: `action`, `command` e `say`. Siga o `next_step`; ao retomar, comece por `check --json`.

Os guias desta pasta: `../../references/base-legal.md` (o método da base legal e a repermissão), `../../references/copy-regua.md` (como escrever cada mensagem), `../../references/whatsapp.md` (a régua pela API oficial), `../../references/entregabilidade.md` (a entrega do domínio e os lotes), `../../references/limiares.json` (os limiares, rotulados), `../../references/interface.md` (o que os outros apps leem daqui).

## Regras que não se quebram

- **Nenhum dado de pessoa sai do projeto.** A base limpa fica em `contatos/base-limpa.csv`, na pasta da marca; nada dela entra em contagem, relatório, resposta na conversa ou arquivo de outro app. Você nunca copia um nome, um e-mail ou um telefone para a conversa.
- **Só exports de usuários e contatos da marca.** Uma lista com coluna de paciente, dependente ou terceiro é recusada (`patient_data`), e você explica ao integrante o que exportar no lugar.
- **A base legal vem antes da régua.** A régua de um grupo com campo vazio em `base-legal.md` fica `pendente`; você pergunta o que falta numa mensagem só, com a sugestão, e nunca inventa a resposta. É método, não parecer jurídico: na dúvida, quem responde é o jurídico da marca.
- **Repermissão primeiro.** Quem não recebe nada há 6 meses ou mais recebe antes a pergunta se ainda quer receber. O script recusa qualquer outra primeira mensagem (`repermission_required`).
- **As datas, as contagens e os limites são do script.** Você cita; nunca arredonda nem inventa.
- **Quem envia é o integrante**, pela ferramenta dele. O app prepara os textos, as datas e os links; nunca entra numa ferramenta de e-mail ou de mensagem, nem pede a senha dela.
- **WhatsApp só pela API oficial, ou um a um.** Nunca disparo de número comum, e só para quem aceitou receber por WhatsApp: aceitar e-mail não é aceitar WhatsApp. Sem esse aceite no texto da base legal, a régua por WhatsApp fica `pendente`.
- **Para a Meta só sobem hashes.** O público personalizado sai de `audience` com o e-mail e o telefone já em SHA-256, e só de quem tem base legal de marketing e não pediu para sair; a lista legível nunca sobe.
- **Chat curto.** Na conversa vão as três linhas de `say` e as decisões; os documentos ficam em `contatos/`, e você indica onde.

## Passo 1: o inventário

1. Peça ao integrante o export de usuários ou contatos da ferramenta dele, em CSV, e salve em `contatos/entrada/`. Os cabeçalhos podem estar em português ou em inglês; o app reconhece e-mail, telefone, datas de cadastro, de último uso e de último contato, status ou plano, pedidos, receita, origem, consentimento e descadastro.
2. `inventory contatos/entrada/<arquivo.csv> [outro.csv] --json` limpa (duplicados por e-mail e telefone, e-mails inválidos, telefones com o 55 e o DDD), agrupa (clientes, ex-clientes, testaram, nunca-ativaram; ativos, parados, inativos) e conta. Diga ao integrante as três linhas de `say`. Em `patient_data`, explique que o app só lê a lista de usuários ou contatos, nunca de pacientes.

## Passo 2: a base legal

`legal --json` cria `contatos/base-legal.md` com uma seção por grupo e os oito campos (como entrou, texto aceito, dados presentes, último contato e descadastros, onde está guardada, base legal, teto de contatos, retenção), e devolve `questions`: até quatro, com `suggestion`. Pergunte numa mensagem só, grave as respostas nas linhas do arquivo e rode `legal` de novo até cada grupo ficar `completo`. O método está em `../../references/base-legal.md`.

## Passo 3: os segmentos

`segments --json` lê a base limpa e grava `contatos/segmentos.json`: engajamento por uso e pedidos (nunca por abertura sozinha), o RFM simples, os melhores clientes, quem está sem contato há 6 meses, o teto de mensagens (1 por 16 horas, 3 por semana, 5 só na semana de pico) e a escada de ofertas por grupo. Mostre `say` ao integrante.

## Passo 4: a régua

1. `sequence <grupo> --json` escreve a régua do grupo, ancorada nas fases do plano aprovado (aquecimento e pico) ou, sem plano, numa data alvo (`--target AAAA-MM-DD`): a repermissão para quem está sem contato, a novidade, o convite para testar, a prova, a lista, o acesso antecipado, a abertura, o lembrete e o último dia, cada uma com data, trabalho, assunto de até 45 caracteres, chamado e link pela regra única. Rode para cada grupo que vai receber.
2. O corpo de cada mensagem é seu: escreva com `../../references/copy-regua.md`, com o rodapé obrigatório (quem escreve, de onde veio o contato, como sair), revise com a skill `texto-natural` e grave em `contatos/regua.md` no lugar de `[a escrever]`. Nenhuma mensagem sai enquanto a régua do grupo estiver `pendente`.
3. Mostre ao integrante as datas e os assuntos, e diga que quem envia é ele, pela ferramenta dele, nos lotes e nos horários que `regua.md` indica.
4. `sequence <grupo> --channel whatsapp --json` escreve a régua do mesmo grupo por WhatsApp, ao lado da de e-mail: quatro toques (a repermissão um a um para quem está sem contato, o acesso antecipado, a abertura e o último dia), cada um um modelo de marketing que o provedor aprova até 2 dias antes (`approve_by`), com até 300 caracteres, uma pergunta ou um link, a palavra SAIR, e o link com `utm_source=whatsapp`. Fica `pendente` enquanto o texto aceito do grupo em `base-legal.md` não falar de WhatsApp ou mensagem. O guia é `../../references/whatsapp.md`.

## Passo 5: a entrega

Antes do primeiro envio em volume, `deliverability <domínio> --dkim <seletor> --json` consulta o DNS público do domínio de envio (o que vem depois do @ do remetente): SPF, DMARC e DKIM, cada um com o estado (`ok`, `missing`, `attention`, `unknown`) e o que fazer. O seletor DKIM está na tela de autenticação da ferramenta de e-mail do integrante; sem ele, o DKIM fica `unknown`. `missing` bloqueia o envio em volume: diga ao integrante o que criar no DNS com as palavras de cada `fix`. O que depende de uma mensagem real (o descadastro em um clique, o rodapé) e dos relatórios (reclamação, rejeição, descadastro por envio) fica `unknown` até ele trazer; nunca marque como ok o que o app não viu. O plano de lotes de uma lista parada está em `contatos/envio.md`.

## Passo 6: o público para a Meta

`audience <grupo|segmento> --json` monta o público personalizado de um grupo ou de um segmento de `segmentos.json` com o e-mail e o telefone já em hash, só de quem tem base legal de marketing e não pediu para sair, e a lista de exclusão dos clientes atuais, em `contatos/publicos/`. Com menos de 100 pessoas o arquivo não sai (`too_small`): esse público fica na régua. O passo a passo para subir no Gerenciador está no `.md` ao lado; quem sobe é o integrante, e a taxa de reconhecimento que a Meta mostrar substitui a estimativa do app. A lista sobe de novo toda semana.

## Passo 7: a voz do cliente e o atendimento

- `voice --json` cria `contatos/voz-do-cliente.md` com o questionário de sete perguntas e o roteiro de 20 minutos. Peça ao integrante cinco a oito conversas; grave cada frase como foi dita, com o primeiro nome ou a profissão (nunca o e-mail) e a data, em `contatos/voz-respostas.json` como uma lista de `{ who, text, where }`, e rode `voice --quotes contatos/voz-respostas.json --json`: com cinco frases ou mais, sai `contatos/voz-leitura.json`, a leitura declarada que o app de criativos importa como evidência. Escreva a síntese no `.md`.
- `support --json` cria `contatos/atendimento.md` com o pico e os feriados do plano: quem responde, em quanto tempo, as respostas às objeções nas palavras do público, quem cobre o fim de semana. Pergunte numa mensagem só e preencha antes do primeiro anúncio.

## O que vem depois

A régua ancorada no plano é o que o app de medição lê pelo `utm_content` de cada link; a leitura declarada da voz do cliente entra no app de criativos; o público em hash e a lista de exclusão entram na estrutura da Meta que o plano descreve. Ao terminar, registre o uso com `npx --yes flyee@latest track tool.executed --module contact-base`.

## Problemas comuns

| `code` | O que fazer |
|---|---|
| `patient_data` | o arquivo tem coluna de paciente ou terceiro: peça o export só de usuários ou contatos |
| `csv_invalid` | o arquivo está vazio ou não tem e-mail nem telefone |
| `outside_project` | copie o export para `contatos/entrada/` e importe de lá |
| `inventory_missing` | rode `inventory` antes |
| `group_unknown` | os grupos são `clientes`, `ex-clientes`, `testaram`, `nunca-ativaram` |
| `repermission_required` | o grupo tem gente sem contato há 6 meses: a primeira mensagem é a repermissão |
| `target_missing` | sem plano aprovado, passe `--target AAAA-MM-DD` |
| `segment_unknown` | o segmento não existe: `details` e `segmentos.json` listam os que há |
| `quotes_invalid`, `quotes_few` | o arquivo de respostas não é uma lista de `{ who, text }`, ou tem menos de cinco frases |
| `usage` em `deliverability` | o domínio é o que vem depois do @ do remetente, sem http e sem caminho |
