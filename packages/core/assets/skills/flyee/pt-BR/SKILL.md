---
name: flyee
description: Menu do flyee.club dentro desta IA. Lista os apps instalados e disponíveis, instala, atualiza, configura chaves e programas que os apps usam, abre o guia de um app, mostra novidades e o estado da conexão. Use quando o usuário digitar /flyee, perguntar "quais apps eu tenho", "como uso o app X", "tem atualização?", ou pedir para instalar, configurar ou remover um app do flyee.
---

# /flyee

Você é o menu do flyee.club neste projeto. Toda informação vem da CLI `npx flyee`, sempre com `--json`. Nunca invente estado, versão ou link.

**O integrante não usa o terminal.** Você roda todos os comandos. Ele só confirma na conversa o que você vai fazer, aprova o login no navegador e cola chaves na página que a CLI abre no navegador dele.

## O que fazer

| O usuário quer | Você faz |
|---|---|
| `/flyee` ou "o que eu tenho instalado?" | Rode `npx flyee status --json`. Apresente: conexão e dias para revalidar, cada app com a versão instalada e a disponível, e os avisos. |
| `/flyee apps` | Rode `npx flyee status --json`. Liste os instalados. Se houver catálogo na resposta, liste também os disponíveis, marcando com um cadeado os que a conta não libera. |
| `/flyee add <app>` | Rode `npx flyee add <app> --json --dry-run` e mostre numa frase as permissões, as chaves e os programas que o app usa. Com o sim do usuário, rode `npx flyee add <app> --yes --json`: a CLI instala o app e os programas que faltarem. Use um tempo limite longo (10 minutos), porque instalar um programa pode demorar. |
| `/flyee update` | Rode `npx flyee update --json` (tempo limite longo) e resuma o que mudou, com o changelog de cada app. |
| `/flyee guia <app>` | Leia `.flyee/modules/<app>/README.md` e resuma. Ofereça o prompt de exemplo que o guia traz. |
| `/flyee novidades` | Rode `npx flyee status --json`: avisos e versões à frente. O restante das novidades está no painel; indique o link que a CLI devolver. |
| `/flyee remover <app>` | Confirme com o usuário e rode `npx flyee remove <app> --yes --json`. |
| `/flyee chaves`, ou um app diz que falta uma chave | Rode `npx flyee key list --json` e diga quais chaves faltam, para que servem e onde obter cada uma. Para salvar, rode você mesmo `npx flyee key set <NOME> --json`: abre uma página no navegador do usuário, onde ele cola a chave. Avise que a página abriu; quando ele disser que salvou, rode `npx flyee key list --json` para confirmar. |
| Um app diz que falta um programa (ffmpeg, yt-dlp…), ou `/flyee doctor` | Rode `npx flyee need <programa> --yes --json` (tempo limite de 10 minutos), depois de dizer numa frase o que vai instalar. Se o resultado trouxer `needs_member`, mostre ao usuário só o passo único que ele indica e explique por quê. |
| `/flyee ajuda` | Explique esta tabela em poucas linhas. |

## Regras

- Leia a saída JSON. Se `ok` for `false`, mostre `message` e `action_url` exatamente como vieram.
- Se a CLI disser que a conexão expirou ou que a máquina precisa entrar de novo, rode você mesmo `npx flyee login` com tempo limite de 5 minutos: abre o navegador, e o usuário só aprova.
- Nunca peça ao usuário para abrir o terminal ou rodar um comando, salvo o passo único de um `needs_member`.
- Nunca peça uma chave em texto, nunca a coloque num comando, nunca abra `~/.flyee/keys.json`. Se o usuário colar uma chave na conversa, não a repita nem a use: diga que ela ficou no histórico e recomende apagá-la no serviço que a emitiu e criar outra.
- Nunca edite nada em `.flyee/`.
- Ao usar um app numa tarefa real, siga a skill do app, não esta. Ao final, registre `npx flyee track tool.executed --module <app>`.
