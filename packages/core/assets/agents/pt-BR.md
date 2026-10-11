# flyee.club

Este projeto usa apps do flyee.club, instalados e atualizados pela CLI `npx flyee`. Cada app é um conjunto de skills, scripts e referências em `.flyee/modules/<app>/`, com pontes em `.agents/skills/` e `.claude/skills/` para esta IA encontrá-las.

**O integrante não usa o terminal: você roda tudo.** Ele só confirma na conversa o que você vai fazer, aprova o login no navegador e cola chaves numa página que a CLI abre no navegador dele.

Regras para a IA neste projeto:

- Antes de executar uma tarefa que um app instalado cobre, carregue a skill dele e siga-a.
- Texto em português que vai para o público (roteiro, post, legenda, página): antes de entregar, revise-o com a skill `texto-natural`, que tira as marcas de texto gerado por IA. A voz que o integrante definiu num app manda sobre ela.
- Programas que um app usa (ffmpeg, yt-dlp e outros): instale você mesmo com `npx flyee need <programa> --yes --json`, depois de dizer numa frase o que vai instalar. Use um tempo limite longo (10 minutos). Só se o resultado trouxer `needs_member` (senha de administrador, gerenciador de pacotes ausente), mostre ao integrante o passo único que ele indica. Nunca entregue a ele comandos de instalação para rodar.
- Chaves externas dos apps (de APIs): rode você mesmo `npx flyee key set <NOME> --json`. Abre uma página no navegador do integrante, onde ele cola a chave; ela fica em `~/.flyee/keys.json`, fora do projeto, e nunca passa pela conversa. Para ver o que falta, `npx flyee key list --json` (só os nomes).
- Nunca peça uma chave em texto, nunca a coloque num comando, nunca abra `~/.flyee/keys.json` e nunca grave uma chave em arquivo do projeto.
- Conexão vencida ou máquina desconectada: rode você mesmo `npx flyee login` com tempo limite de 5 minutos; o integrante só aprova no navegador.
- Nunca edite arquivos em `.flyee/`: eles são substituídos por `npx flyee update`. Ajustes locais ficam no projeto, não dentro do app.
- Para ver os apps instalados, atualizar, abrir o guia de um app ou ver novidades, use a skill `flyee` (/flyee) ou rode `npx flyee status --json`.
- Ao terminar de usar um app numa tarefa real, registre o uso com `npx flyee track tool.executed --module <app>`. Só o nome do app e a versão saem da máquina, nunca conteúdo.

## Apps instalados

{{apps}}

Core flyee {{core_version}}. Painel, guias e ajuda: {{site}}
