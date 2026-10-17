# flyee

A CLI do [flyee.club](https://flyee.club): instala e mantém atualizados os apps do clube na IA que você já usa. Funciona com Claude Code, Codex, Gemini CLI e Cursor, e com qualquer ferramenta que leia `AGENTS.md` e skills em `.agents/skills`.

Você não usa o terminal: a sua IA roda os comandos. Os programas que um app usa, como ffmpeg e yt-dlp, ela instala sozinha. Chaves de serviços externos você cola numa página que abre no seu navegador. Você só confirma na conversa e aprova o login no navegador.

## Como instalar

Peça à sua IA: "Instale o flyee seguindo https://flyee.club/instalar.md". Ela confere o Node.js, conecta este computador à sua conta e instala os apps que você pedir.

## O que a sua IA roda

Comandos de referência, escritos como uma IA precisa rodá-los: `--yes` responde a pergunta que o npx faz antes de baixar o pacote, e `@latest` usa sempre a versão mais nova.

```bash
npx --yes flyee@latest login                   # conecta este computador à sua conta (abre o navegador)
npx --yes flyee@latest login --device          # o mesmo, com um código, sem navegador nesta máquina
npx --yes flyee@latest add <app> --dry-run     # mostra o que o app declara, sem instalar
npx --yes flyee@latest add <app> --yes         # instala o app no projeto atual, depois do seu sim
npx --yes flyee@latest add receita:<nome>      # instala os apps de uma receita
npx --yes flyee@latest update                  # atualiza os apps instalados e renova a conexão
npx --yes flyee@latest status                  # conexão, apps instalados, versões e avisos
npx --yes flyee@latest doctor                  # confere a instalação, os programas e as chaves
npx --yes flyee@latest need <programa> --yes   # instala um programa que um app usa (winget, Homebrew ou apt)
npx --yes flyee@latest key set <NOME> --browser  # abre uma página no navegador para colar a chave de um app
npx --yes flyee@latest remove <app>
npx --yes flyee@latest new <pasta>             # outro projeto com os apps deste, ao lado dele
npx --yes flyee@latest projects                # os projetos com apps do flyee neste computador
npx --yes flyee@latest logout
```

Todo comando aceita `--json`, para a sua IA ler a saída, e `--yes`, que confirma sem perguntar. Sem um terminal para perguntar, a CLI não instala nada e responde `confirmation_required`, com o comando que mostra o plano e o que confirma.

## O que a CLI escreve no projeto

- `AGENTS.md`, com um bloco gerenciado entre `<!-- flyee:begin -->` e `<!-- flyee:end -->`; `CLAUDE.md` e `GEMINI.md` recebem uma linha que aponta para ele. Arquivos que você já tinha nunca são sobrescritos: o bloco é anexado.
- `.agents/skills/` e `.claude/skills/`: uma ponte por skill de cada app, para a sua IA encontrá-las.
- `.flyee/`: os apps instalados e o registro do que está instalado. Não edite: a atualização substitui.

Nada é instalado sem antes conferir o tamanho e o SHA-256 do pacote contra o que a plataforma publicou. As permissões que o app declara aparecem antes de instalar.

## Um projeto por marca ou cliente

O projeto é a pasta onde os apps estão instalados. Tudo o que eles aprendem ali, como a sua voz e a sua marca, e tudo o que entregam fica dentro dela. Se você cria conteúdo para mais de uma marca ou atende clientes, use uma pasta para cada um: peça à sua IA um projeto novo para o cliente, e ela cria uma pasta ao lado desta com os mesmos apps. Abra essa pasta na IA para trabalhar naquele cliente. Nada se mistura entre elas.

Cada app passa de novo pela conferência do pacote e pelo seu acesso; um app que a sua conta não inclui hoje fica de fora e continua funcionando onde já estava. A lista dos seus projetos fica só neste computador.

## Privacidade

A CLI envia à plataforma só o necessário para entregar e manter os apps: a identificação deste computador, as versões instaladas, e eventos de uso com o nome do app e a versão. Nunca envia código, prompts, caminhos de arquivo ou nomes de projeto. A fila de eventos fica em `~/.flyee/events.jsonl`, legível. As credenciais ficam em `~/.flyee/credentials.json`.

## Programas e chaves

- **Programas.** Quando um app declara que usa um programa, a instalação e a atualização do app o instalam pelo gerenciador de pacotes do seu sistema, sem perguntas além da confirmação do app: winget no Windows, Homebrew no Mac, apt, dnf ou pacman no Linux. Nada é baixado de outro lugar. Se o sistema pedir algo que só você pode dar, como a senha de administrador no Linux, a CLI devolve esse passo único.
- **Chaves.** A sua IA abre uma página em `127.0.0.1`, com endereço de uso único, que vale 15 minutos. Você cola a chave e clica em Salvar. Ela fica em `~/.flyee/keys.json`, fora dos seus projetos, e não passa pela conversa.

## Idiomas

Português e inglês, seguindo o idioma da sua conta.

## Mudanças

- 1.0.1: funciona no macOS e no Linux, onde a 1.0.0 terminava sem fazer nada. No Windows, o login pelo navegador abre o endereço inteiro, e no WSL abre o navegador do Windows. Numa sessão na nuvem, por SSH ou num computador sem tela, o login pelo navegador e a página da chave avisam na hora que não há navegador na frente da pessoa e indicam o login por código e a variável de ambiente; o login faz o mesmo quando o navegador não abre. Com um proxy em `HTTPS_PROXY`, como nas sessões na nuvem, as chamadas passam por ele, com o Node 22.21 ou mais novo. Quando a plataforma não responde, o erro e o `doctor` dizem o motivo, como um endereço que não resolve, um proxy que recusou o domínio ou um certificado em que o computador não confia. Numa imagem nova, o apt baixa as listas de pacotes antes de instalar. O resultado do `add` diz como ficou cada programa. A ferramenta de IA também é reconhecida pelo programa no PATH: com o Windsurf ou o Aider instalados, o projeto recebe o arquivo que cada um lê (`.windsurfrules`, `CONVENTIONS.md`).
- 1.0.0: a primeira versão da linha 1.x publicada. Login com navegador ou com código (o endereço e o código saem antes da espera, e com `--json` numa primeira linha JSON), instalação de apps e receitas, atualização, estado, diagnóstico, programas, chaves pela página do navegador, um projeto por marca ou cliente (`new` e `projects`) e registro de uso. Sem um terminal para perguntar, a confirmação vem por `--yes`, depois de mostrar o plano com `--dry-run`. O nome do degrau aparece como o painel o chama, e a página de um app abre no idioma de quem lê.
- A linha 0.x deste pacote pertence a um projeto anterior e não fala com o flyee.club.
