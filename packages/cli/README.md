# flyee

A CLI do [flyee.club](https://flyee.club): instala e mantém atualizados os apps do clube na IA que você já usa. Funciona com Claude Code, Codex, Gemini CLI e Cursor, e com qualquer ferramenta que leia `AGENTS.md` e skills em `.agents/skills`.

```bash
npx flyee login                 # conecta este computador à sua conta (abre o navegador)
npx flyee login --device        # o mesmo, sem navegador nesta máquina
npx flyee add <app>             # instala um app no projeto atual
npx flyee add receita:<nome>    # instala os apps de uma receita
npx flyee update                # atualiza os apps instalados e renova a conexão
npx flyee status                # conexão, apps instalados, versões e avisos
npx flyee doctor                # confere a instalação e as chaves externas
npx flyee remove <app>
npx flyee logout
```

Todo comando aceita `--json`, para a sua IA ler a saída, e `--yes`, para pular confirmações.

## O que a CLI escreve no projeto

- `AGENTS.md`, com um bloco gerenciado entre `<!-- flyee:begin -->` e `<!-- flyee:end -->`; `CLAUDE.md` e `GEMINI.md` recebem uma linha que aponta para ele. Arquivos que você já tinha nunca são sobrescritos: o bloco é anexado.
- `.agents/skills/` e `.claude/skills/`: uma ponte por skill de cada app, para a sua IA encontrá-las.
- `.flyee/`: os apps instalados e o registro do que está instalado. Não edite; `npx flyee update` substitui.

Nada é instalado sem antes conferir o tamanho e o SHA-256 do pacote contra o que a plataforma publicou. As permissões que o app declara aparecem antes de instalar.

## Privacidade

A CLI envia à plataforma só o necessário para entregar e manter os apps: a identificação deste computador, as versões instaladas, e eventos de uso com o nome do app e a versão. Nunca envia código, prompts, caminhos de arquivo ou nomes de projeto. A fila de eventos fica em `~/.flyee/events.jsonl`, legível. As credenciais ficam em `~/.flyee/credentials.json`.

## Idiomas

Português e inglês, seguindo o idioma da sua conta.

## Mudanças

- 1.0.0-alpha.1: primeira versão da linha 1.x: login com PKCE ou código de dispositivo, add, remove, update, status, doctor, track. A linha 0.x deste pacote pertence a um projeto anterior e não fala com o flyee.club.
