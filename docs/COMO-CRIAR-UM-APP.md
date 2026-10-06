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
├── README.md              o guia do integrante; vira o texto da página do app na plataforma
├── skills/<nome>/SKILL.md uma ou mais skills no padrão Agent Skills
├── skills/<nome>/references/   material que a skill lê sob demanda
├── scripts/               scripts que a IA roda (exigem `shell` nas permissões)
├── tests/eval.json        casos de avaliação; nunca sai do repositório
└── .dev/                  notas do operador; nunca sai do repositório
```

Comece com `npm run apps -- new <slug> --type <tipo> --trail <trilha>`, que copia `modules/_template` e preenche nomes, tipo e trilha. O que falta escrever fica marcado com `[PREENCHER]`, e a validação recusa o app até não sobrar nenhum. O nome do diretório é o `name` do manifesto: minúsculas, dígitos e hífens, até 60 caracteres.

## 2. O manifesto

| Campo | Regra |
|---|---|
| `manifest_version` | `1` |
| `name` | igual ao diretório; é o slug no catálogo e no `npx flyee add` |
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
- Uma skill por tarefa clara. Descrições que se sobrepõem fazem a IA escolher errado: o `validate` acusa nomes repetidos entre apps.
- A skill nunca fala de material interno nem aponta para links que o servidor não deu.

## 4. Permissões, credenciais e o modo sem chave

Declare tudo: a IA mostra as permissões antes de instalar, e a página pública do app as exibe. Um app que grava no projeto declara `fs:write` com o escopo; um que chama uma API declara `network` com o domínio; um que roda script declara `shell` com o comando, inclusive binários externos como `ffmpeg`.

Toda credencial externa se declara em `external_credentials`, e o `env` é o nome da chave. O integrante a salva uma vez por máquina com `npx flyee key set <ENV>`, no terminal dele e sem que ela apareça na tela. Ela fica em `~/.flyee/keys.json`, fora de todo projeto, e serve a todos os apps que usam o mesmo nome. Quem preferir pode definir uma variável de ambiente com esse nome.

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

Declare `env` com o nome da chave e `fs:read` com `~/.flyee/keys.json`. O app e a skill nunca pedem a chave em texto, nunca a põem num comando, nunca rodam `key set` pelo integrante, nunca abrem esse arquivo por conta própria e nunca gravam a chave em arquivo do projeto. Sem a chave, o app mostra o comando `npx flyee key set <ENV>` e o `url` de onde obtê-la. E todo app com credencial tem um modo que entrega algo sem ela, por exemplo planejar ou preparar o material, dizendo o que a chave liberaria.

## 5. O README é o guia

Escreva para quem nunca viu o app: o que ele faz, o que precisa, como usar com um prompt de exemplo ("Peça assim: …"), o que ele grava e onde, e o modo sem chave. Esse texto vira a página do app na plataforma e o `/flyee guia <app>` dentro da IA.

## 6. Avaliação

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

## 7. Versões

- A primeira versão publicada é a que a conta sem compra recebe, marcada no console da plataforma. Num app principal, a 1.0 nasce reduzida e a 1.1 sai no mesmo dia com a fatia completa.
- Correção é versão nova com `changelog` novo. Nunca edite uma versão publicada.
- Tag no git: `<slug>@<versão>`.

## 8. Automação

Um app `workflow` pode ter uma metade automática. Ela roda sem ninguém presente, pela CLI e por um agendador do sistema, e por isso não tem ponto de aprovação; toda decisão fica para a metade sob demanda, que recebe o material pronto em arquivo. Declare quais passos usam a IA do integrante; onde não há raciocínio, o passo é script puro. O manifesto v2 trará o campo `automation` quando o primeiro app assim chegar (fase P4).

## 9. Apps que servem outros apps

Um app pode ser a ferramenta de outros, como o `video-analysis`, que o app de edição chama para estudar um vídeo de referência. Enquanto o manifesto v2 não traz `requires`, a ligação é por convenção:

- Comandos, opções, valores, campos do JSON e códigos de erro em inglês; mensagens, guias e descrições para o integrante em pt-BR.
- Um script com subcomandos e `--json` em todos (`node .flyee/modules/<slug>/scripts/<script>.mjs <comando> --json`), progresso no stderr e só o JSON no stdout, erros com `code` estável, `message` e `fix`.
- O contrato em `references/interface.md`, escrito para a IA que executa o outro app: como detectar o app (`.flyee/modules/<slug>/` existe; senão, oferecer `npx flyee add <slug>` e seguir sem ele), os comandos, os campos da saída, os erros e uma `interface_version`. Dentro de uma versão da interface, só se acrescenta; mudança que quebra é interface nova e versão maior do app.
- O resultado fica numa pasta do projeto fora de `.flyee/`, porque `.flyee/modules/<slug>/` é trocado a cada `update` e a IA não edita `.flyee/`. Com cache por conteúdo: o mesmo pedido de outro app devolve o que já existe.
- O app consumidor manda o que precisa (`--instructions <arquivo do próprio app>`, `--name <slug dele>`) em vez de pedir uma versão especial do app de ferramenta.

## 10. Testar antes de publicar

```bash
npm run validate <slug>
npm run pack <slug>
npm run apps -- link <slug> <apps que ele usa>
```

Depois rode os casos de `tests/eval.json` a partir da pasta de trabalho, pelo chat deste repositório, ou abra a IA na pasta de trabalho e use a skill como um integrante usaria. O `link` reconstrói a CLI quando o código dela mudou.
