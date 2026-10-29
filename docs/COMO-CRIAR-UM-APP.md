# Como criar um app

Referência de autoria. O procedimento passo a passo é a skill `app-author`; a publicação está em `docs/RELEASE.md`. Tudo o que você escreve em `modules/<slug>/`, menos `tests/`, `.dev/` e `*.dev.md`, chega ao integrante e é lido pela IA dele.

## 0. Pelo chat

O jeito normal de trabalhar é conversar com a IA aberta neste repositório. A skill `/apps` é o console: liste os apps (`/apps`), peça um app novo ("crie um app que…"), peça uma mudança ("adicione ao app X…"), use um app enquanto constrói outro ("analise este vídeo com o video-analysis") e peça a publicação. Por baixo, ela roda os comandos abaixo; você pode rodá-los à mão também.

| Comando | O que faz |
|---|---|
| `npm run apps -- list` | cada app com versão, validação, última tag, cópia na pasta de trabalho e quem usa quem |
| `npm run apps -- new <slug> --type <tipo> --trail <trilha> --title "…" --summary "…"` | cria o app a partir do modelo, com `[PREENCHER]` onde falta escrever |
| `npm run apps -- bump <slug> patch\|minor\|major` | sobe a versão e põe o changelog em `[PREENCHER]` |
| `npm run apps -- link <slug…>` / `unlink` | instala ou tira apps da pasta de trabalho |
| `npm run apps -- catalog` | regenera o catálogo (um gancho já faz isso a cada mudança em `modules/`) |

**O catálogo.** `.claude/rules/catalogo.md` e `docs/CATALOGO.md` são gerados a partir dos apps: o que cada um entrega, as skills, a interface para outros apps, quem usa quem. A IA deste repositório sempre os tem no contexto, e por isso, ao pedir um app novo, ela começa dizendo quais apps existentes o novo deve chamar, quais ajudam a construí-lo agora, o que já existe em parte e que ferramenta nova valeria a pena separar. Quem usa quem é lido do que os apps distribuem: um app usa outro quando cita o caminho instalado dele (`.flyee/modules/<slug>/`). Não edite esses dois arquivos.

**A pasta de trabalho.** Fica fora do repositório, por padrão em `C:\AppsProjects\flyee-workspace` (a variável `FLYEE_WORKSPACE` muda o lugar). Os apps chegam lá como chegariam ao integrante, e é lá que eles são usados e testados; o que produzem fica lá. O `dev link` da CLI recusa rodar dentro deste repositório, porque escreveria o harness do integrante por cima do seu. A cópia na pasta de trabalho não acompanha as edições sozinha: depois de mudar um app, ligue-o de novo (`apps list` mostra quando ela está desatualizada).

**O que nunca sai daqui.** O catálogo, a pasta de trabalho, as skills do operador e as ferramentas são seus. Ao integrante chega só o pacote de cada app, montado por `npm run pack` sem `tests/`, `.dev/` e `*.dev.md`, e a CLI publicada no npm.

## 1. Estrutura

```
modules/<slug>/
├── flyee.module.json      o manifesto (schema em schemas/flyee.module.schema.json)
├── README.md              o guia do integrante dentro do projeto (e o /flyee guia)
├── guides/pt-BR/usar.md   o guia da página do app na plataforma, para todo integrante (e guides/en/usar.md)
├── guides/pt-BR/abrir-o-capo.md   o guia avançado, para o FlyeeClub Pro (e guides/en/abrir-o-capo.md)
├── skills/<nome>/SKILL.md uma ou mais skills no padrão Agent Skills
├── skills/<nome>/references/   material que a skill lê sob demanda
├── scripts/               scripts que a IA roda (exigem `shell` nas permissões)
├── tests/eval.json        casos de avaliação; nunca sai do repositório
├── .dev/showcase.json     o exemplo da loja (seção 6); nunca sai do repositório
└── .dev/                  notas do operador; nunca sai do repositório
```

Comece com `npm run apps -- new <slug> --type <tipo> --trail <trilha>`, que copia `modules/_template` e preenche nomes, tipo e trilha. O que falta escrever fica marcado com `[PREENCHER]`, e a validação recusa o app até não sobrar nenhum. O nome do diretório é o `name` do manifesto: minúsculas, dígitos e hífens, até 60 caracteres.

**O projeto é a pasta.** Tudo o que o app aprende sobre a marca ou a voz do integrante e tudo o que entrega fica numa pasta do app na raiz do projeto (`estudio-de-video/`, `roteiros/`, `carrosseis/`), nunca na pasta do usuário nem num cache comum a todos os projetos. É isso que separa as marcas: quem atende vários clientes usa um projeto para cada um (`npx --yes flyee@latest new <pasta>`), e o operador faz o mesmo com MedChina, flyee e Seenaly (`npm run apps -- project new <nome>`). Em `~` só fica o que é da máquina: onde estão os programas, as chaves em `~/.flyee/keys.json`.

## 2. O manifesto

| Campo | Regra |
|---|---|
| `manifest_version` | `1` |
| `name` | igual ao diretório; é o slug no catálogo e no `npx --yes flyee@latest add` |
| `version` | `MAJOR.MINOR.PATCH`, sem zero à esquerda, prerelease opcional; imutável depois de publicada |
| `type` | `skill`, `workflow`, `framework` ou `tool` |
| `trail` | `planejar`, `construir`, `publicar`, `divulgar`, `vender`, `escalar` ou `manter` |
| `title`, `summary` | `{ "pt-BR", "en" }`; português obrigatório; até 80 e 280 caracteres; o resumo descreve o resultado, não a técnica |
| `compatible_ais` | só as IAs em que você testou: `claude_code`, `codex`, `gemini_cli`, `cursor`; as demais são compatíveis pelo padrão e não se declaram |
| `min_core` | a versão mínima do core, por exemplo `>=1.0.0` |
| `entry` | o arquivo que o harness carrega primeiro; precisa estar em `files` |
| `files` | gerado por `npm run pack`; nunca escrito à mão |
| `external_credentials` | toda chave que o integrante fornece: `name`, `env` em maiúsculas, `url` https de onde obter, `required`, `purpose` nos dois idiomas |
| `permissions` | tudo o que o app toca: `fs:read`, `fs:write`, `network`, `shell`, `env`, cada um com `scope` e `reason` que o integrante entende |
| `lessons` | opcional; ids de vídeo não listado do YouTube por idioma |
| `changelog` | obrigatório; o que mudou nesta versão, nos dois idiomas quando o app é bilíngue |
| `license` | `member` |

Chave desconhecida é erro. Caminhos são relativos, com `/`, sem `.` nem `..`.

## 3. Skills

O frontmatter segue o padrão Agent Skills, lido por Claude Code, Codex, Gemini CLI, Cursor, Copilot, OpenCode e outros:

```markdown
---
name: radar-instagram
description: Encontra Reels que performaram acima do normal do próprio perfil e entrega ranking e planilha. Use quando o usuário pedir "radar do Instagram", "o que está bombando" ou quiser validar uma pauta de Reels.
---
```

- `name` igual à pasta, minúsculas e hífens simples, até 64 caracteres.
- `description` diz o que a skill faz e quando usar, até 1024 caracteres e de preferência abaixo de 400, porque entra no contexto de toda sessão da IA.
- O corpo tem a regra que não se quebra, os passos e as referências. Caminhos relativos (`references/`, `scripts/`) resolvem a partir da pasta da skill dentro do pacote, nunca a partir da ponte que a CLI cria.
- O `validate` confere que existe no pacote cada arquivo citado por um caminho que sobe da pasta da skill (`../../references/x.md`, `../../scripts/x.mjs`) ou pelo caminho instalado de um app (`.flyee/modules/<slug>/scripts/x.mjs`, em qualquer texto do pacote e no manifesto), e acusa o que falta com o arquivo e a linha. Caminho com `<`, `>`, `…`, `*`, `{`, `}` ou `$`, endereço da web e caminho do projeto do integrante ficam de fora.
- Uma skill por tarefa clara. Descrições que se sobrepõem fazem a IA escolher errado: o `validate` acusa nomes repetidos entre apps.
- A skill nunca fala de material interno nem aponta para links que o servidor não deu.

## 4. O integrante não usa o terminal

Esta é a regra de experiência de todo app: o integrante conversa com a IA dele, e a IA roda tudo. Ele só confirma na conversa o que a IA vai fazer, aprova o login no navegador e cola chaves numa página que abre no navegador. Nenhum texto do app manda o integrante abrir o terminal, rodar um comando ou instalar um programa. A validação recusa um `.md` do app com comando de instalação (`winget install`, `brew install`, `apt install`, `pip install`…) ou com "no seu terminal".

**Programas.** Um app que usa um programa (ffmpeg, yt-dlp…) o declara numa permissão `shell` cujo escopo cita o nome dele, por exemplo `"scope": "ffmpeg, ffprobe"`. O `npx --yes flyee@latest add`, o `update` e o `dev link` instalam sozinhos o que faltar, pelo gerenciador de pacotes do sistema (winget, Homebrew, apt…), sem perguntas além da confirmação do próprio `add`. Se o app descobre em uso que falta algo, a skill manda a IA rodar `npx --yes flyee@latest need <programa> --yes --json`, com tempo limite longo, depois de avisar numa frase. Os programas conhecidos estão em `packages/core/assets/programs.json`; um programa novo entra ali, e até a CLI ser publicada com ele o app passa a receita no próprio comando (`npx --yes flyee@latest need <binário> --winget <id> --brew <id> --apt <id>`). Numa imagem nova (um contêiner, uma sessão na nuvem) o apt ainda não baixou as listas de pacotes e não conhece o ffmpeg: a CLI roda `apt-get update` uma vez, do mesmo jeito que a instalação, e tenta de novo. Só o que exige o integrante volta como `needs_member`, com o passo único: a senha de administrador no Linux, o Homebrew ausente no Mac. O script do app procura o programa no PATH e nas pastas dos gerenciadores de pacotes, porque a IA aberta antes da instalação herda o PATH antigo; `~/.flyee/programs.json` guarda o caminho de cada programa que a CLI conferiu.

## 5. Permissões, credenciais e o modo sem chave

Declare tudo: a página pública do app exibe as permissões, e a CLI as devolve na instalação. Um app que grava no projeto declara `fs:write` com o escopo; um que chama uma API declara `network` com o domínio; um que roda script declara `shell` com o comando, inclusive binários externos como `ffmpeg`.

Toda credencial externa se declara em `external_credentials`, e o `env` é o nome da chave. A IA do integrante roda `npx --yes flyee@latest key set <ENV> --browser --json`, que abre uma página no navegador dele, numa porta local e com um endereço de uso único; ele cola a chave ali e clica em Salvar. A chave não passa pela conversa, pelo terminal nem pela linha de comando. Ela fica em `~/.flyee/keys.json`, fora de todo projeto, e serve a todos os apps que usam o mesmo nome. Quem preferir pode definir uma variável de ambiente com esse nome. Quem roda `key set` num terminal de verdade digita a chave com o eco desligado.

O script do app lê a chave sozinho, nesta ordem:

1. A variável de ambiente `<ENV>`, que tem prioridade. Se ela existe mas está vazia, significa "sem chave" e a busca para.
2. `keys[<ENV>]` em `~/.flyee/keys.json`, um JSON `{ "version": 1, "keys": { "<ENV>": "valor" } }`, lido a cada execução. Assim, uma chave salva depois de a IA abrir funciona na hora.

```js
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

function appKey(name) {
  const fromEnvironment = process.env[name];
  if (fromEnvironment !== undefined) return fromEnvironment.trim() || null;
  try {
    const saved = JSON.parse(readFileSync(join(homedir(), ".flyee", "keys.json"), "utf8")).keys?.[name];
    return typeof saved === "string" && saved.trim() ? saved.trim() : null;
  } catch {
    return null;
  }
}
```

Declare `env` com o nome da chave e `fs:read` com `~/.flyee/keys.json`. O app e a skill nunca pedem a chave em texto, nunca a põem num comando, nunca abrem esse arquivo por conta própria e nunca gravam a chave em arquivo do projeto. Sem a chave, o app devolve à IA o `url` de onde obtê-la e o comando `npx --yes flyee@latest key set <ENV> --browser --json`, que a própria IA roda. E todo app com credencial tem um modo que entrega algo sem ela, por exemplo planejar ou preparar o material, dizendo o que a chave liberaria.

## 6. O README e os guias

O README é o guia dentro do projeto. Escreva para quem nunca viu o app: o que ele faz, o que precisa, como usar com um prompt de exemplo ("Peça assim: …"), o que ele grava e onde, e o modo sem chave. A IA o lê no `/flyee guia <app>`.

**Os guias são a página do app.** A página do app no painel da plataforma lê só os guias do pacote, em caminhos fixos (contrato, seção 7): `guides/pt-BR/usar.md` e `guides/en/usar.md` em todo app, e `guides/pt-BR/abrir-o-capo.md` com `guides/en/abrir-o-capo.md` no app que tem profundidade para mostrar, os dois juntos ou nenhum. "Usar" é para todo integrante: o que pedir à IA e o que esperar. "Abrir o capô" é o guia avançado, que só o FlyeeClub Pro lê: como o app trabalha por dentro, os arquivos, os pedidos avançados, as conferências e a privacidade. A plataforma recusa outro nome dentro de `guides/`, um guia vazio e um acima de 200.000 bytes, e não resolve caminho relativo ao pacote: link só com endereço absoluto. Guia nunca mostra comando, porque quem roda é a IA. O `validate` confere tudo isso, e o modelo (`modules/_template/guides/`) já traz os quatro arquivos com `[PREENCHER]`. Uma versão publicada nunca muda: um guia novo ou corrigido entra numa versão nova.

**O exemplo da loja.** A home, `/catalogo` e a página de cada app mostram o app respondendo a um pedido, no lugar do comando que o instala (contrato, seção 10.1, campo `showcase`). Ele fica em `.dev/showcase.json`, fora do pacote: um arquivo dentro do pacote mudaria o ZIP das versões já publicadas, e o manifesto v1 não tem o campo. Por idioma (`pt-BR` e `en`): `request`, o pedido que o integrante faz à IA, tirado do guia "usar" (até 400 caracteres); `reply`, de 1 a 8 linhas do que o app realmente devolve, cada uma com `text` (até 280) e, se ajudar, um `label` curto (até 40: uma cena e o tempo, um passo, um número), com a linha mais forte primeiro; e `saved`, opcional, o arquivo que o app grava, com um caminho real (até 160). Nada de números inventados sobre pessoas, canais, marcas ou perfis reais. Um app que ainda trabalha só em português leva `"en": null`: a página em inglês mostra o ícone e o texto, e um exemplo traduzido prometeria uma conversa em inglês que o app não tem (o `video-studio`, desde 2026-10-20). O `null` tira o idioma do catálogo na próxima importação; um idioma que só falta no arquivo mantém o que o catálogo já tinha. O `npm run index` o leva ao índice, e o `validate` confere o formato, os limites e a regra de texto da loja, que não aceita "grátis", "free" nem o nome do FlyeeClub Pro: um idioma que quebra uma regra a plataforma deixa de fora, com um aviso.

**A escrita segue a regra de texto do flyee.club.** É a mesma do site, do painel, dos e-mails e das mensagens da CLI: nenhum travessão (o traço longo ou a meia-risca), nem num intervalo ("3 a 4", nunca com o traço), nenhum ponto de exclamação, nenhum emoji (© e → podem) e nenhuma das palavras proibidas (desbloqueie, potencialize, sem esforço, soluções inovadoras; em inglês unlock, elevate, empower, seamless, robust, supercharge, game-changing, it's not just). Onde iria um travessão, use dois-pontos, vírgula ou ponto; "·" separa itens numa linha; um valor que falta some da linha em vez de virar um traço. O `npm run validate` confere todo `.md` do pacote, os textos do manifesto e toda string que os scripts imprimem, e um hook confere cada `.md` logo depois da escrita; os textos do core passam pela mesma conferência. Ele também avisa sobre adjetivos de avaliação típicos de IA e fórmulas como "não é só X, é Y" (nesses avisos, texto entre aspas conta como citação). Para reescrever um trecho, use a skill `humanizer-pt-br`. Um script que precisa do travessão como dado, para achar ou cortar um texto, o guarda numa expressão regular ou o monta com `String.fromCodePoint(0x2014)`, e nunca o imprime.

**Comandos como a IA precisa rodar.** Toda menção a um comando do flyee num texto que a IA lê é `npx --yes flyee@latest <comando>`: o `--yes` responde a pergunta que o npx faz antes de baixar, e `@latest` mantém uma cópia só, como o `/instalar.md` da plataforma escreve. A chave é `npx --yes flyee@latest key set <ENV> --browser --json`, que nunca pede a chave no terminal. Instalar outro app é uma frase simples ao integrante ("Vou instalar o app X, que faz Y") e `add <app> --yes --json`, com tempo limite de 10 minutos, sem `--dry-run` e sem esperar o sim: é a regra do core desde a 1.8.0 (decisão do operador de 2026-10-21). Se a instalação falhar, ou se o integrante pedir para não instalar, o app segue sem o outro e diz o que fica de fora.

**App que escreve pelo integrante.** Se o app produz texto para o público do integrante (roteiro, legenda, post, texto de carrossel), o último passo da skill antes de entregar manda a IA revisar o texto com a skill `texto-natural`, que o core instala em todo projeto. O perfil de voz que o app guardou manda sobre ela. Declare `"min_core": ">=1.3.0"`, o primeiro core que a instala.

## 7. Avaliação

`tests/eval.json`:

```json
{
  "app": "radar",
  "cases": [
    {
      "name": "ranking basico",
      "prompt": "Faça o radar do Instagram para o nicho de acupuntura, 6 hashtags.",
      "assertions": [{ "kind": "file_exists", "path": "radar/*.xlsx" }],
      "rubric": "Entrega ranking com mediana por perfil e multiplicador; não inventa números."
    }
  ]
}
```

Pelo menos um caso. Toda falha de suporte vira um caso novo. Os casos rodam antes de publicar e, como canário, nas IAs testadas (fase P7).

## 8. Versões

- A primeira versão publicada é a que a conta sem compra recebe, marcada no console da plataforma. Num app principal, a 1.0 nasce reduzida e a 1.1 sai no mesmo dia com a fatia completa.
- Correção é versão nova com `changelog` novo. Nunca edite uma versão publicada.
- Tag no git: `<slug>@<versão>`.

## 9. Automação

Um app `workflow` pode ter uma metade automática. Ela roda sem ninguém presente, pela CLI e por um agendador do sistema, e por isso não tem ponto de aprovação; toda decisão fica para a metade sob demanda, que recebe o material pronto em arquivo. Declare quais passos usam a IA do integrante; onde não há raciocínio, o passo é script puro. O manifesto v2 trará o campo `automation` quando o primeiro app assim chegar (fase P4).

## 10. Apps que servem outros apps

Um app pode ser a ferramenta de outros, como o `video-analysis`, que o app de edição chama para estudar um vídeo de referência. Enquanto o manifesto v2 não traz `requires`, a ligação é por convenção:

- Comandos, opções, valores, campos do JSON e códigos de erro em inglês; mensagens, guias e descrições para o integrante em pt-BR.
- Um script com subcomandos e `--json` em todos (`node .flyee/modules/<slug>/scripts/<script>.mjs <comando> --json`), progresso no stderr e só o JSON no stdout, erros com `code` estável, `message` e `fix`.
- O contrato em `references/interface.md`, escrito para a IA que executa o outro app: como detectar o app (`.flyee/modules/<slug>/` existe; senão, oferecer `npx --yes flyee@latest add <slug>` e seguir sem ele), os comandos, os campos da saída, os erros e uma `interface_version`. Dentro de uma versão da interface, só se acrescenta; mudança que quebra é interface nova e versão maior do app.
- O resultado fica numa pasta do projeto fora de `.flyee/`, porque `.flyee/modules/<slug>/` é trocado a cada `update` e a IA não edita `.flyee/`. Com cache por conteúdo: o mesmo pedido de outro app devolve o que já existe.
- O app consumidor manda o que precisa (`--instructions <arquivo do próprio app>`, `--name <slug dele>`) em vez de pedir uma versão especial do app de ferramenta.

## 11. Testar antes de publicar

```bash
npm run validate <slug>
npm run pack <slug>
npm run apps -- link <slug> <apps que ele usa>
```

Depois rode os casos de `tests/eval.json` a partir da pasta de trabalho, pelo chat deste repositório, ou abra a IA na pasta de trabalho e use a skill como um integrante usaria. O `link` reconstrói a CLI quando o código dela mudou.
