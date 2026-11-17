# Bateria de conversas

Antes de abrir o atendimento para os clientes, e depois de cada mudança grande nas instruções ou nos perfis, a bateria mostra o que o robô faz em conversas escritas por quem aprova o atendimento. Ela usa a IA de verdade e a configuração de produção, e não toca em nada: as consultas devolvem um resultado simulado, sem chamar o projeto, e nenhuma mensagem vai para o Chatwoot.

## O que ela usa

- **A configuração de produção**, lida pela rota `config` assinada, a mesma que o robô lê: instruções, conhecimento, perfis, consultas, horário, provedor e modelo de IA.
- **O mesmo robô**: o prompt (`buildSystemPrompt`), o agente (`runAgent`) e o provedor, carregados de `<destino>/base/bot/src`, a base que vai para o contêiner. Se a base está atrás do kit, rode `update` antes.
- **As mesmas regras** que passam para a equipe sem IA: o modo desligado, as palavras que chamam a equipe e o limite de respostas (o histórico do caso conta as respostas do robô).
- **O perfil e os dados de cada caso**, como se a rota `contact` tivesse respondido. Sem `perfil`, o caso roda sem perfil, e os `facts` ficam de fora, como no robô.

## As variáveis

`PROJECT_URL` e `SUPPORT_BOT_SECRET`, com os mesmos nomes do robô, e a chave da IA com o nome que o robô lê (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY` ou o `ai.key_env` da conta). Vêm do ambiente ou de um ou mais `--env`; o arquivo seguinte vence o anterior. Com o provedor `project`, quem responde é a rota `generate` do projeto, sem chave de IA na bateria. Nenhum valor aparece na saída, no relatório ou no resultado.

## O arquivo de casos

Um JSON com a lista `casos` e, se quiser, a `conta` do Chatwoot (`--account` vence):

```json
{
  "conta": 3,
  "casos": [
    {
      "nome": "Cliente ativo pergunta pelo pedido",
      "perfil": "ativo",
      "facts": { "empresa": "Padaria Aurora", "etapa": "cliente desde 2025" },
      "ferramentas": { "consultar_pedido": { "ok": true, "numero": "1042", "situacao": "enviado" } },
      "historico": [{ "papel": "cliente", "texto": "Oi" }, { "papel": "robo", "texto": "Oi, como posso ajudar?" }],
      "mensagem": "Cadê o pedido 1042?",
      "espera": { "acao": "responder", "ferramenta": "consultar_pedido", "contem": ["enviado"], "nao_contem": ["cancelado"] }
    }
  ]
}
```

| Campo | O que é |
|---|---|
| `nome` | o nome do caso no relatório |
| `perfil` | a chave de um perfil declarado pelo projeto (opcional) |
| `facts` | os dados da pessoa, como a rota `contact` mandaria (opcional, só com `perfil`) |
| `ferramentas` | o resultado simulado de cada consulta, pelo nome; consulta sem resultado no caso devolve `{ "ok": false, "code": "sem_resultado_no_caso" }` |
| `historico` | as mensagens antes da última, com `papel` `cliente`, `robo` ou `equipe` (opcional) |
| `mensagem` | a mensagem do cliente que o robô vai tratar |
| `espera.acao` | `responder` ou `transferir` |
| `espera.contem` e `espera.nao_contem` | textos que a resposta precisa ter ou não pode ter, sem diferença de acento e de maiúscula |
| `espera.ferramenta` | uma consulta que o robô precisa ter chamado |

Cada caso precisa de pelo menos uma checagem em `espera`. O texto conferido é o que a pessoa recebe: a resposta do robô ou, numa passagem para a equipe, a frase da IA ou a mensagem de passagem da conta. No modo sugestão, é a sugestão que a equipe revisaria.

Os casos de exemplo estão em [bateria.exemplo.json](bateria.exemplo.json), de uma marca fictícia: um contato novo, um cliente ativo com consulta, um dado da pessoa que tenta virar ordem, um reembolso que vai para a equipe e uma conta bloqueada. Copie para `<destino>/bateria.json` e troque pelos perfis, consultas e assuntos do projeto, com um caso por perfil declarado e um para cada coisa que nunca pode acontecer.

## Rodar

```
node .flyee/modules/whatsapp-support/scripts/kit.mjs bateria <destino> --casos <destino>/bateria.json --env <arquivo do robô> --account <id> --json
```

Cada caso é uma chamada à IA, ou algumas quando há consulta: a bateria custa o mesmo que essas conversas no atendimento.

## O que sai

- `<destino>/conferencia/bateria-<data-hora>/relatorio.md`, para quem aprova: o resultado no topo, uma tabela com os casos e, para cada caso, o perfil, a mensagem, a ação, o texto para a pessoa, a nota para a equipe numa passagem, as consultas e cada checagem, ok ou falhou;
- `resultado.json` ao lado, com os mesmos dados;
- código de saída 1 quando alguma checagem falha, ou quando a bateria não chega a rodar (variável faltando, rota `config` recusada, caso mal escrito).

A pasta `conferencia/` fica fora do git. Leia o relatório inteiro, não só o resultado: uma resposta pode passar nas checagens e ainda estar no tom errado. Ajuste as instruções ou o bloco do perfil na tela do robô, espere um minuto e rode de novo.
