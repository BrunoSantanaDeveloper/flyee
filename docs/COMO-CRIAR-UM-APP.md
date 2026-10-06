# Como criar um app

Referência de autoria. O procedimento passo a passo é a skill `app-author`; a publicação está em `docs/RELEASE.md`. Tudo o que você escreve em `modules/<slug>/`, menos `tests/`, `.dev/` e `*.dev.md`, chega ao integrante e é lido pela IA dele.

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

Comece copiando `modules/_template`. O nome do diretório é o `name` do manifesto: minúsculas, dígitos e hífens, até 60 caracteres.

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

Toda credencial externa vem por variável de ambiente; o app nunca pede a chave em texto nem a grava em arquivo. E todo app com credencial tem um modo que entrega algo sem ela, por exemplo planejar ou preparar o material, dizendo o que a chave liberaria.

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

## 9. Testar antes de publicar

```bash
npm run validate
npm run pack
# numa pasta de teste, fora deste repositório:
set FLYEE_DEV=1
node C:\AppsProjects\flyee\packages\cli\dist\flyee.js dev link C:\AppsProjects\flyee\modules\<slug>
```

Depois abra a IA nessa pasta e use a skill como um integrante usaria.
