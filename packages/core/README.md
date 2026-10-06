# @flyee-product/core

Conteúdo, não código: o que a CLI escreve no projeto do integrante. Tudo aqui é lido por integrantes e pelas IAs deles, nos dois idiomas, sem nomes internos.

| Arquivo | Papel |
|---|---|
| `assets/core.json` | a versão do core (reportada como `core_version`) e os marcadores do bloco gerenciado |
| `assets/tools.json` | o registro declarativo das ferramentas de IA: detecção, arquivo de instruções, skills, nível |
| `assets/agents/{pt-BR,en}.md` | o bloco gerenciado do `AGENTS.md`, com `{{apps}}`, `{{core_version}}` e `{{site}}` preenchidos pela CLI |
| `assets/skills/flyee/{pt-BR,en}/SKILL.md` | a skill `/flyee`, o menu do clube dentro da IA |

Suba `version` em `core.json` quando o integrante deva receber a mudança no próximo `npx flyee update`. O build da CLI copia `assets/` para `packages/cli/dist/core/`.
