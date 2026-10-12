# flyee

A CLI do [flyee.club](https://flyee.club): instala e mantém atualizados os apps do clube na IA que você já usa. Funciona com Claude Code, Codex, Gemini CLI e Cursor, e com qualquer ferramenta que leia `AGENTS.md` e skills em `.agents/skills`.

Você não precisa usar o terminal: peça à sua IA, e ela roda os comandos abaixo. Os programas que um app usa, como ffmpeg e yt-dlp, ela instala sozinha. Chaves de serviços externos você cola numa página que abre no seu navegador. Você só confirma na conversa e aprova o login no navegador.

```bash
npx flyee login                 # conecta este computador à sua conta (abre o navegador)
npx flyee login --device        # o mesmo, sem navegador nesta máquina
npx flyee add <app>             # instala um app no projeto atual
npx flyee add receita:<nome>    # instala os apps de uma receita
npx flyee update                # atualiza os apps instalados e renova a conexão
npx flyee status                # conexão, apps instalados, versões e avisos
npx flyee doctor                # confere a instalação, os programas e as chaves externas
npx flyee need <programa>       # instala um programa que um app usa (winget, Homebrew ou apt)
npx flyee key set <NOME>        # abre uma página no navegador para colar a chave de um app
npx flyee remove <app>
npx flyee new <pasta>           # outro projeto com os apps deste, ao lado dele
npx flyee projects              # os projetos com apps do flyee neste computador
npx flyee logout
```

Todo comando aceita `--json`, para a sua IA ler a saída, e `--yes`, para pular confirmações.

## O que a CLI escreve no projeto

- `AGENTS.md`, com um bloco gerenciado entre `<!-- flyee:begin -->` e `<!-- flyee:end -->`; `CLAUDE.md` e `GEMINI.md` recebem uma linha que aponta para ele. Arquivos que você já tinha nunca são sobrescritos: o bloco é anexado.
- `.agents/skills/` e `.claude/skills/`: uma ponte por skill de cada app, para a sua IA encontrá-las.
- `.flyee/`: os apps instalados e o registro do que está instalado. Não edite; `npx flyee update` substitui.

Nada é instalado sem antes conferir o tamanho e o SHA-256 do pacote contra o que a plataforma publicou. As permissões que o app declara aparecem antes de instalar.

## Um projeto por marca ou cliente

O projeto é a pasta onde os apps estão instalados. Tudo o que eles aprendem ali, como a sua voz e a sua marca, e tudo o que entregam fica dentro dela. Se você cria conteúdo para mais de uma marca ou atende clientes, use uma pasta para cada um: peça à sua IA um projeto novo para o cliente, e ela roda `npx flyee new <nome>`, que cria uma pasta ao lado desta com os mesmos apps. Abra essa pasta na IA para trabalhar naquele cliente. Nada se mistura entre elas.

Cada app passa de novo pela conferência do pacote e pelo seu acesso; um app que a sua conta não libera hoje fica de fora e continua funcionando onde já estava. A lista dos seus projetos fica só neste computador.

## Privacidade

A CLI envia à plataforma só o necessário para entregar e manter os apps: a identificação deste computador, as versões instaladas, e eventos de uso com o nome do app e a versão. Nunca envia código, prompts, caminhos de arquivo ou nomes de projeto. A fila de eventos fica em `~/.flyee/events.jsonl`, legível. As credenciais ficam em `~/.flyee/credentials.json`.

## Programas e chaves

- **Programas.** Quando um app declara que usa um programa, o `add` e o `update` o instalam pelo gerenciador de pacotes do seu sistema, sem perguntas além da confirmação do app: winget no Windows, Homebrew no Mac, apt, dnf ou pacman no Linux. Nada é baixado de outro lugar. Se o sistema pedir algo que só você pode dar, como a senha de administrador no Linux, a CLI devolve esse passo único.
- **Chaves.** `npx flyee key set <NOME>` abre uma página em `127.0.0.1`, com endereço de uso único, que vale 15 minutos. Você cola a chave e clica em Salvar. Ela fica em `~/.flyee/keys.json`, fora dos seus projetos, e não passa pela conversa nem pelo terminal.

## Idiomas

Português e inglês, seguindo o idioma da sua conta.

## Mudanças

- Ainda não publicado: `new` e `projects`, um projeto por marca ou cliente.
- 1.0.0-alpha.1: primeira versão da linha 1.x: login com PKCE ou código de dispositivo, add, remove, update, status, doctor, track. A linha 0.x deste pacote pertence a um projeto anterior e não fala com o flyee.club.
