# flyee.club

Este projeto usa apps do flyee.club, instalados e atualizados pela CLI `npx flyee`. Cada app é um conjunto de skills, scripts e referências em `.flyee/modules/<app>/`, com pontes em `.agents/skills/` e `.claude/skills/` para esta IA encontrá-las.

Regras para a IA neste projeto:

- Antes de executar uma tarefa que um app instalado cobre, carregue a skill dele e siga-a.
- Nunca edite arquivos em `.flyee/`: eles são substituídos por `npx flyee update`. Ajustes locais ficam no projeto, não dentro do app.
- Para ver os apps instalados, atualizar, abrir o guia de um app ou ver novidades, use a skill `flyee` (/flyee) ou rode `npx flyee status --json`.
- Chaves externas dos apps (de APIs): o integrante salva cada uma no terminal dele com `npx flyee key set <NOME>`, digitando sem aparecer na tela. Elas ficam em `~/.flyee/keys.json`, fora do projeto, e os apps as leem de lá ou da variável de ambiente de mesmo nome. Para ver o que falta, rode `npx flyee key list --json` (mostra só os nomes).
- Nunca peça uma chave em texto, nunca a coloque num comando, nunca rode `npx flyee key set` pelo integrante, nunca abra `~/.flyee/keys.json` e nunca grave uma chave em arquivo do projeto.
- Ao terminar de usar um app numa tarefa real, registre o uso com `npx flyee track tool.executed --module <app>`. Só o nome do app e a versão saem da máquina, nunca conteúdo.

## Apps instalados

{{apps}}

Core flyee {{core_version}}. Painel, guias e ajuda: {{site}}
