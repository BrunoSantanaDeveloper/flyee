# Plano do produto

As decisões estão na plataforma (`flyee-club/docs/PRODUCT.md`, "Decisões tomadas 2026-10-06"); este plano é a execução do lado do produto. Cada fase termina com `npm run ci:verify` verde e um commit.

## Andamento

| Fase | Estado | Notas |
|---|---|---|
| P0 · Repositório e harness | Concluída em 2026-10-06 | Monorepo npm workspaces, Node 22. `CLAUDE.md`, regras (`fronteira`, `contrato`, `apps`), skills (`app-author`, `app-release`, `cli-dev`), hooks (`app-guard`, `harness-sync`), espelho Codex gerado, schema do manifesto pinado em `schemas/` com `schema:sync`, `check-tarball` como portão da fronteira, workflows de CI, release da CLI e empacotamento por tag. |
| P1 · Ferramentas de módulo | Concluída em 2026-10-06 | `packages/module-tools`: `validate` (schema, regras cruzadas, `files` gerado, caminhos seguros, limites, trilha, README, eval, frontmatter das skills, skills repetidas entre apps), `pack` (ZIP determinístico, `files` regenerado, sha256) e `index` (`dist/index.json` para a importação da plataforma). Testes com `node --test`. |
| P2 · CLI núcleo | Concluída em 2026-10-06 | `packages/cli`: `login` (PKCE em loopback e código de dispositivo), `logout`, `add` (apps e receitas), `remove`, `update`, `status`, `doctor`, `track`, `dev link`. Cliente do contrato com renovação serializada, tratamento dos códigos de erro, `min_cli_version`. Instalação com verificação de tamanho, sha256, lista de arquivos e caminhos; extração atômica; adaptadores (`AGENTS.md` gerenciado, ponteiros `CLAUDE.md` e `GEMINI.md`, pontes em `.agents/skills` e `.claude/skills`, `openai.yaml`, blocos para Windsurf e Aider quando detectados). Fila de telemetria com a lista fechada. `--json` e `--yes` em todos. Testes contra `test/fake-platform.ts`. Bundle único sem dependências de runtime. Não publicado no npm: espera a plataforma no ar para o fluxo real (`scripts/cli-flow.mjs` dela contra um preview) e a decisão de subir `min_cli_version`. |
| P3 · Primeiro app: edição de vídeo | A fazer, pelo operador | Construído para uso próprio antes do vídeo de lançamento. 1.0 reduzida e 1.1 completa no mesmo dia. Define na prática o formato de um app `workflow` ou `tool` com `shell` e dependência de binário (ffmpeg) declarada em `permissions`. |
| Apoio · `video-analysis` 1.0.0 | Construído em 2026-10-06, não publicado | Analisa vídeos (YouTube, outros sites, arquivos) pela imagem e pelo som: modo local sem chave (ffmpeg e yt-dlp medem cortes, silêncios e montam grades que a IA do integrante lê) e modo Gemini com `GEMINI_API_KEY`. Serve outros apps por `references/interface.md`; o app de edição (P3) é o primeiro consumidor. Testes em `modules/video-analysis/tests` (`npm run test:apps`). |
| P4 · Pipelines e automação | A fazer | `flyee run <app>` com o runner de pipeline (passos de script e de IA, estado em `.flyee/runs/`), `flyee schedule` com Agendador do Windows, `launchd` e `systemd`, adaptadores de execução não interativa por IA (`claude -p`, `codex exec`, `gemini -p`) com as permissões do manifesto como lista de ferramentas liberadas, e o manifesto v2 (`automation`, `requires`, `example_prompt`) junto com a plataforma (10.1). |
| P5 · Painel local | A fazer | `flyee ui`: servidor em `127.0.0.1`, token de sessão na URL, conferência de `Host`, página estática empacotada com orçamento de tamanho, proxy do token, blocos: conexão, apps, loja com cadeados, saúde, transparência da telemetria, guia, primeiros passos, projetos. Depende de `packages/design-tokens` publicado pela plataforma. |
| P6 · Licença, marcas e MCP local | A fazer, depende da plataforma 10.5 e 10.6 | Guardar e verificar a licença por download (JWKS), marcas opacas nos arquivos gerados, recusa de runtime em outra máquina; servidor MCP local `flyee mcp` com estado, catálogo, instalação, guia e telemetria. |
| P7 · Canário e avaliações | A fazer | Runner de `tests/eval.json`, gate antes de publicar, canário diário no Claude Code e no Codex e semanal no Gemini CLI e no Cursor, matriz inteira quando a versão de uma IA muda; falhas de suporte viram casos. |
| P8 · Compatibilidade ampliada | A fazer, por dado | Promover ferramentas do nível `standard` quando a plataforma indicar 30 máquinas vivas por 4 semanas; `ai_tool_detail` nos `installs` quando o contrato o servir (10.4). |

## Pedidos à plataforma que destravam fases

| Pedido | Fase da plataforma | Fase daqui |
|---|---|---|
| `min_cli_version` para `1.0.0` na publicação da CLI | 9.4 | P2, publicação |
| `links.module_page` em `/api/cli/version` | 9.4 | P2 já lê quando existir |
| Token de serviço e importação do índice | 10.2 | release de apps |
| Manifesto v2 e `trigger` | 10.1 | P4 |
| `packages/design-tokens` público | 9.6(b) | P5 |
| Licença no download e JWKS | 10.6 | P6 |
| MCP remoto | 10.5 | P6 (porta para quem só usa o app do Claude) |
| `ai_tool_detail` | 10.4 | P8 |
