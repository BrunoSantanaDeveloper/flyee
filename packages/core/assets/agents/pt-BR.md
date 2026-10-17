# flyee.club

Este projeto usa apps do flyee.club, instalados e atualizados pela CLI do flyee, que você roda sempre como `npx --yes flyee@latest <comando>`: o `--yes` responde a pergunta que o npx faz antes de baixar, e `@latest` usa sempre a mesma cópia. Cada app é um conjunto de skills, scripts e referências em `.flyee/modules/<app>/`, com pontes em `.agents/skills/` e `.claude/skills/` para esta IA encontrá-las.

**O integrante não usa o terminal: você roda tudo.** Ele só confirma na conversa o que você vai fazer, aprova o login no navegador e cola chaves numa página que a CLI abre no navegador dele.

Regras para a IA neste projeto:

- Antes de executar uma tarefa que um app instalado cobre, carregue a skill dele e siga-a.
- Um projeto por marca ou cliente, cada um na sua pasta. O que os apps aprendem (a voz, a marca) e o que eles entregam fica na pasta do projeto, e o trabalho de uma marca vai sempre na pasta dela: não pergunte ao integrante onde guardar. Se a marca ou o cliente ainda não tem projeto, diga numa frase que vai criá-lo e rode `npx --yes flyee@latest new <nome> --yes --json` (tempo limite de 10 minutos), que leva os apps deste projeto. Para levar apps que este projeto não tem (`--apps a,b`), rode antes com `--dry-run --json`, diga numa frase o que cada app novo pede (permissões, chaves, programas) e espere o sim. A CLI cria a pasta dentro da pasta que guarda os projetos e devolve o caminho em `path`. Com `next_step` igual a `work_in_folder`, siga nesta conversa: rode os comandos e os scripts dos apps com a pasta do projeto como diretório de trabalho e leia as skills dos apps em `<pasta>/.flyee/modules/<app>/skills/`; com `open_folder`, siga a mensagem do resultado. Numa pasta que guarda projetos, cada comando de app (`status`, `add`, `update`, `remove`) vale para o projeto de uma marca: rode-o com a pasta dela como diretório de trabalho. `npx --yes flyee@latest projects --json` lista os projetos deste computador.
- Texto em português que vai para o público (roteiro, post, legenda, página): antes de entregar, revise-o com a skill `texto-natural`, que tira as marcas de texto gerado por IA. A voz que o integrante definiu num app manda sobre ela.
- Programas que um app usa (ffmpeg, yt-dlp e outros): instale você mesmo com `npx --yes flyee@latest need <programa> --yes --json`, depois de dizer numa frase o que vai instalar. Use um tempo limite longo (10 minutos). Só se o resultado trouxer `needs_member` (senha de administrador, gerenciador de pacotes ausente), mostre ao integrante o passo único que ele indica. Nunca entregue a ele comandos de instalação para rodar.
- Chaves externas dos apps (de APIs): rode você mesmo `npx --yes flyee@latest key set <NOME> --browser --json`. Abre uma página no navegador do integrante, onde ele cola a chave; ela fica em `~/.flyee/keys.json`, fora do projeto, e nunca passa pela conversa. Para ver o que falta, `npx --yes flyee@latest key list --json` (só os nomes).
- Nunca peça uma chave em texto, nunca a coloque num comando, nunca abra `~/.flyee/keys.json` e nunca grave uma chave em arquivo do projeto.
- Conexão vencida ou máquina desconectada: rode você mesmo `npx --yes flyee@latest login` com tempo limite de 5 minutos; o integrante só aprova no navegador.
- Nunca edite arquivos em `.flyee/`: eles são substituídos por `npx --yes flyee@latest update`. Ajustes locais ficam no projeto, não dentro do app.
- Para ver os apps instalados, atualizar, abrir o guia de um app ou ver novidades, use a skill `flyee` (/flyee) ou rode `npx --yes flyee@latest status --json`.
- Ao terminar de usar um app numa tarefa real, registre o uso com `npx --yes flyee@latest track tool.executed --module <app>`. Só o nome do app e a versão saem da máquina, nunca conteúdo.

## Apps instalados

{{apps}}

Core flyee {{core_version}}. Painel, guias e ajuda: {{site}}
