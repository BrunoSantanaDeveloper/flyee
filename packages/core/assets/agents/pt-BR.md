# flyee.club

Este projeto usa apps do flyee.club, instalados e atualizados pela CLI `npx flyee`. Cada app é um conjunto de skills, scripts e referências em `.flyee/modules/<app>/`, com pontes em `.agents/skills/` e `.claude/skills/` para esta IA encontrá-las.

Regras para a IA neste projeto:

- Antes de executar uma tarefa que um app instalado cobre, carregue a skill dele e siga-a.
- Nunca edite arquivos em `.flyee/`: eles são substituídos por `npx flyee update`. Ajustes locais ficam no projeto, não dentro do app.
- Para ver os apps instalados, atualizar, abrir o guia de um app ou ver novidades, use a skill `flyee` (/flyee) ou rode `npx flyee status --json`.
- Quando um app pedir uma chave externa, use a variável de ambiente que ele declara; nunca peça a chave em texto nem a grave em arquivo do projeto.
- Ao terminar de usar um app numa tarefa real, registre o uso com `npx flyee track tool.executed --module <app>`. Só o nome do app e a versão saem da máquina, nunca conteúdo.

## Apps instalados

{{apps}}

Core flyee {{core_version}}. Painel, guias e ajuda: {{site}}
