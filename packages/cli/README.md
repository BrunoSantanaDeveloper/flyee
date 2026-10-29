# flyee

A CLI do [flyee.club](https://flyee.club): instala e mantém atualizados os apps do clube na IA que você já usa. Funciona com Claude Code, Codex, Gemini CLI e Cursor, e com qualquer ferramenta que leia `AGENTS.md` e skills em `.agents/skills`.

Você não usa o terminal: a sua IA roda os comandos. Os programas que um app usa, como ffmpeg e yt-dlp, ela instala sozinha. Chaves de serviços externos você cola numa página que abre no seu navegador. Você só confirma na conversa e aprova o login no navegador.

## Como instalar

Peça à sua IA: "Instale o flyee seguindo https://flyee.club/instalar.md". Ela confere o Node.js, conecta este computador à sua conta e instala os apps que você pedir.

Numa sessão do Claude Code na nuvem, em claude.ai/code, a rede da sessão só chega aos endereços que o ambiente dela libera. O ajuste se faz uma vez, em Editar ambiente de nuvem: em Acesso à rede, escolha Limitado e acrescente `flyee.club` em Domínios permitidos, com a opção Permitir gerenciadores de pacotes marcada, que mantém o npm. Se a rede recusar outro endereço, a CLI responde `host_not_allowed` com o endereço que falta. Ali, a conexão é pelo login por código.

## O que a sua IA roda

Comandos de referência, escritos como uma IA precisa rodá-los: `--yes` responde a pergunta que o npx faz antes de baixar o pacote, e `@latest` usa sempre a versão mais nova.

```bash
npx --yes flyee@latest login                   # conecta este computador à sua conta (abre o navegador)
npx --yes flyee@latest login --device          # o mesmo, com um código, sem navegador nesta máquina
npx --yes flyee@latest add <app> --dry-run     # mostra o que o app declara, sem instalar
npx --yes flyee@latest add <app> --yes         # instala o app no projeto atual
npx --yes flyee@latest add receita:<nome>      # instala os apps de uma receita
npx --yes flyee@latest catalog                 # os apps do catálogo que a sua conta instala e os que o projeto tem
npx --yes flyee@latest update                  # atualiza os apps instalados e renova a conexão
npx --yes flyee@latest status                  # conexão, apps instalados, versões e avisos
npx --yes flyee@latest doctor                  # confere a instalação, os programas e as chaves
npx --yes flyee@latest need <programa> --yes   # instala um programa que um app usa (winget, Homebrew ou apt)
npx --yes flyee@latest key set <NOME> --browser  # abre uma página no navegador para colar a chave de um app
npx --yes flyee@latest remove <app>
npx --yes flyee@latest new <pasta>             # um projeto para uma marca ou um cliente, na pasta dos projetos
npx --yes flyee@latest projects                # os projetos com apps do flyee neste computador
npx --yes flyee@latest logout
```

Todo comando aceita `--json`, para a sua IA ler a saída, e `--yes`, que confirma sem perguntar. Sem um terminal para perguntar, a CLI não instala nada e responde `confirmation_required`, com o comando que mostra o plano e o que confirma.

## O que a CLI escreve no projeto

- `AGENTS.md`, com um bloco gerenciado entre `<!-- flyee:begin -->` e `<!-- flyee:end -->`; `CLAUDE.md` e `GEMINI.md` recebem uma linha que aponta para ele. Arquivos que você já tinha nunca são sobrescritos: o bloco é anexado. O bloco lista os apps instalados e os outros apps do catálogo, para a sua IA usar o app certo quando você pede um trabalho, sem você precisar saber o nome dele.
- `.agents/skills/` e `.claude/skills/`: uma ponte por skill de cada app, para a sua IA encontrá-las.
- `.flyee/`: os apps instalados e o registro do que está instalado. Não edite: a atualização substitui.

Nada é instalado sem antes conferir o tamanho e o SHA-256 do pacote contra o que a plataforma publicou. As permissões que o app declara aparecem antes de instalar.

## Um projeto por marca ou cliente

O projeto é a pasta onde os apps estão instalados. Tudo o que eles aprendem ali, como a sua voz e a sua marca, e tudo o que entregam fica dentro dela. Se você cria conteúdo para mais de uma marca ou atende clientes, cada um tem a sua pasta, dentro da pasta onde você instalou o flyee: peça à sua IA o trabalho de uma marca, e ela usa a pasta dessa marca, ou a cria com os apps que você usa, e segue na mesma conversa. Nada se mistura entre elas. Se o flyee está instalado num projeto que já tem apps, como um repositório de código, o projeto novo fica ao lado dele.

Cada app passa de novo pela conferência do pacote e pelo seu acesso; um app que a sua conta não inclui hoje fica de fora e continua funcionando onde já estava. A lista dos seus projetos fica só neste computador.

## Privacidade

A CLI envia à plataforma só o necessário para entregar e manter os apps: a identificação deste computador, as versões instaladas, e eventos de uso com o nome do app e a versão. Nunca envia código, prompts, caminhos de arquivo ou nomes de projeto. A fila de eventos fica em `~/.flyee/events.jsonl`, legível. As credenciais ficam em `~/.flyee/credentials.json`.

## Programas e chaves

- **Programas.** Quando um app declara que usa um programa, a instalação e a atualização do app o instalam pelo gerenciador de pacotes do seu sistema, sem perguntas além da confirmação do app: winget no Windows, Homebrew no Mac, apt, dnf ou pacman no Linux. Nada é baixado de outro lugar. Se o sistema pedir algo que só você pode dar, como a senha de administrador no Linux, a CLI devolve esse passo único.
- **Chaves.** A sua IA abre uma página em `127.0.0.1`, com endereço de uso único, que vale 15 minutos. Você cola a chave e clica em Salvar. Ela fica em `~/.flyee/keys.json`, fora dos seus projetos, e não passa pela conversa.

## Idiomas

Português e inglês, seguindo o idioma da sua conta.

## Mudanças

- 1.2.5: ao tirar um app que outros apps do projeto usam, a sua IA fica sabendo quais são e pergunta antes, porque sem ele esses apps pedem para instalar de novo. Um app que nenhum outro usa sai como antes, sem pergunta.
- 1.2.3: quando você pede um plano, um relatório ou a leitura de uma campanha, a sua IA resume na conversa e grava o documento completo no arquivo do app; as perguntas vêm numa mensagem só, cada uma com a sugestão dela.
- 1.2.2: um computador que você desconectou no painel volta a se conectar com um login novo. Antes, a aprovação no navegador dava certo e a conexão falhava com "este computador foi desconectado", sem saída. A página depois da aprovação agora diz que a aprovação chegou, e a conversa confirma a conexão.
- 1.2.1: numa sessão na nuvem, uma chave guardada como segredo de rede do ambiente não aparece mais como faltando, e a sua IA não a pede de novo: quem confere é o app.
- 1.2.0: numa sessão do Claude Code na nuvem, a sua IA sabe na hora da instalação quais endereços um app usa e a sessão ainda não alcança, e pede para liberá-los de uma vez, em vez de descobrir cada bloqueio no meio do trabalho. Uma chave que a página não consegue receber ali pode ficar como segredo de rede do ambiente, nos apps que aceitam, e a sessão a usa sem vê-la.
- 1.1.1: uma sessão do Claude Code na nuvem tem vaga própria e não conta mais no limite de computadores do seu plano. Com o computador conectado, a nuvem conecta também, e uma sessão nova na nuvem toma o lugar da anterior.
- 1.1.0: a sua IA reconhece quando um pedido é trabalho de um app do flyee e usa o app, mesmo que você não diga o nome. O bloco do `AGENTS.md` passa a listar os outros apps do catálogo, renovado a cada login, instalação e atualização, e a IA instala o app que falta, avisando numa frase. Um pedido com várias etapas usa um app em cada uma, com a pesquisa antes da criação. O comando novo `catalog` mostra os apps do catálogo, a versão que a sua conta instala e os que o projeto já tem. A sua IA não diz mais que um app pode não estar liberado numa conta sem compra, que instala a versão de entrada de cada app. Numa sessão na nuvem, ela guarda no repositório o app que instalou, para ele continuar na próxima sessão.
- 1.0.3: a sua IA fala mais simples. Ela diz só o que você precisa fazer ou decidir e o resultado, sem listar arquivos, pastas ou versões. Quando a ferramenta em que ela roda recusa um comando do flyee, como o modo automático do Claude Code, ela pergunta uma vez, dizendo o que vai fazer, sem procurar outro caminho. Numa sessão na nuvem, o commit dos arquivos do flyee vem com o passo certo, e as mensagens de rede e de limite de computadores falam com você e usam os nomes da tela do claude.ai em português.
- 1.0.2: a conta sem compra lê que instala a versão de entrada de cada app, e o que o FlyeeClub libera, em vez de ler que não tem acesso. Um endereço que a rede recusa vira a resposta `host_not_allowed`, com o endereço: numa sessão do Claude Code na nuvem, com o ajuste único do ambiente; fora dela, dizendo que um proxy da rede recusou o endereço. Toda chamada tem um prazo para a resposta, e uma rede que não responde não deixa mais a CLI parada. Na nuvem, o computador aparece no painel como Claude Code na nuvem, e o limite de computadores vem explicado. O `doctor` traz o código em `platform.error` e o texto em `platform.message`, e o `status` mostra a mensagem inteira de uma falha de rede. Uma conta sem plano ativo ou suspensa aparece como tal. Um certificado recusado ganha uma mensagem pela causa, como o relógio do computador, e um proxy que o Node deste computador ignora passa a ser dito. Depois de instalar um app, o `add` diz onde estão as skills dele, sem mandar abrir a IA de novo. Os projetos de cada marca ficam dentro da pasta onde o flyee foi instalado, e não mais ao lado dela, e o `new` cria um projeto mesmo sem apps para levar.
- 1.0.1: funciona no macOS e no Linux, onde a 1.0.0 terminava sem fazer nada. No Windows, o login pelo navegador abre o endereço inteiro, e no WSL abre o navegador do Windows. Numa sessão na nuvem, por SSH ou num computador sem tela, o login pelo navegador e a página da chave avisam na hora que não há navegador na frente da pessoa e indicam o login por código e a variável de ambiente; o login faz o mesmo quando o navegador não abre. Com um proxy em `HTTPS_PROXY`, como nas sessões na nuvem, as chamadas passam por ele, com o Node 22.21 ou mais novo. Quando a plataforma não responde, o erro e o `doctor` dizem o motivo, como um endereço que não resolve ou um certificado em que o computador não confia. Numa imagem nova, o apt baixa as listas de pacotes antes de instalar. O resultado do `add` diz como ficou cada programa. A ferramenta de IA também é reconhecida pelo programa no PATH: com o Windsurf ou o Aider instalados, o projeto recebe o arquivo que cada um lê (`.windsurfrules`, `CONVENTIONS.md`).
- 1.0.0: a primeira versão da linha 1.x publicada. Login com navegador ou com código (o endereço e o código saem antes da espera, e com `--json` numa primeira linha JSON), instalação de apps e receitas, atualização, estado, diagnóstico, programas, chaves pela página do navegador, um projeto por marca ou cliente (`new` e `projects`) e registro de uso. Sem um terminal para perguntar, a confirmação vem por `--yes`, depois de mostrar o plano com `--dry-run`. O nome do degrau aparece como o painel o chama, e a página de um app abre no idioma de quem lê.
- A linha 0.x deste pacote pertence a um projeto anterior e não fala com o flyee.club.
