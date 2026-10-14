# Tutorial de tela: a narração escrita sobre a gravação

Num tutorial de tela, o jeito que dá certo é **gravar a tela primeiro e escrever a narração depois**, em cima do que de fato aparece. Escrever antes e gravar depois faz a fala não bater com a imagem; gravar e narrar de memória também. Com a gravação em mãos, a fala acompanha a ação, o vídeo fica mais enxuto e a edição anda mais rápido.

Este guia usa o app **Análise de vídeo** (`video-analysis`), que vê a imagem da gravação e mede os tempos. O guia dele é `.flyee/modules/video-analysis/references/interface.md`: leia antes da primeira vez.

## Antes de gravar: o roteiro de gravação

Vale a regra de `estrutura.md` ("Demonstração, teste ou experimento"): primeiro o criador faz e grava, depois o roteiro de fala é escrito em cima do que aconteceu.

Quando a gravação ainda não existe, entregue o **roteiro de gravação** (o que fazer, em que ordem, o que gravar e o que anotar) e o **roteiro de fala com todos os blocos escritos**: o que só a gravação responde fica `[CONFIRMAR: …]`, e as decisões dele, `[ESCOLHER: …]`. Nunca deixe um bloco só com notas para "narrar depois", e nunca prometa na fala o que a gravação ainda não mostrou (um erro, um tempo, quantas perguntas a ferramenta fez). Depois de gravar, siga este guia a partir do passo 1: o mapa da gravação preenche as marcas e acerta a fala no tempo de cada trecho.

## 0. O que você precisa

- **A gravação da tela**, um arquivo no computador do integrante (mp4, mov, mkv). Pode ter a voz dele ou não.
- **O app Análise de vídeo.** Se `.flyee/modules/video-analysis/scripts/video.mjs` não existe, ofereça instalar: rode `npx --yes flyee@latest add video-analysis --dry-run --json`, diga ao integrante numa frase o que o app declara (o que lê e grava, os programas que instala) e, com o sim, rode `npx --yes flyee@latest add video-analysis --yes --json`, com um tempo limite de 10 minutos. Sem o app, siga pelo caminho simples: peça capturas de tela de cada passo, ou a lista dos passos, e escreva a narração com uma `[TELA: …]` por passo.

Rode o `check --json` do Análise de vídeo uma vez por sessão. Se ele listar programas em `install`, avise numa frase e instale você mesmo cada um com `npx --yes flyee@latest need <programa> --yes --json`, com um tempo limite de 10 minutos.

## 1. Assistir à gravação

```
node .flyee/modules/video-analysis/scripts/video.mjs analyze <arquivo> --focus content --instructions .flyee/modules/youtube-script/references/gravacao-de-tela.md --name youtube-script --json
```

- A gravação é um arquivo do integrante. **Só use `--allow-upload` depois de perguntar** se ele aceita enviar o arquivo ao Google para o Gemini assistir, e de ouvir um sim. Sem o sim, ou sem a chave, o app trabalha no computador dele.
- `ready: true`: leia o arquivo de `description`.
- `ready: false`: siga o `next_step` como o guia do Análise de vídeo manda (ler o roteiro de leitura, abrir todas as grades de imagens e gravar a descrição).
- Gravação longa: analise por partes com `--start` e `--end`.
- Um detalhe que não ficou claro (o nome de um botão, um valor digitado): `frame <id> MM:SS --json` devolve a imagem daquele instante.

## 2. O mapa da gravação

Com a descrição lida, grave em `roteiros/<vídeo>/gravacao.md`, na parte "O mapa da gravação", a lista de tudo o que acontece, na ordem, com os tempos.

```markdown
# Mapa da gravação: <arquivo> (duração 06:40)

| Tempo | O que acontece na tela | Texto exato na tela | Observação |
|---|---|---|---|
| 00:00 a 00:12 | página inicial do construtor | "Comece grátis" | |
| 00:12 a 00:31 | digita o pedido no campo | "site para confeitaria com cardápio" | digitação lenta: acelerar |
| 00:31 a 01:05 | o site sendo montado | barra "Gerando…" | 34 s de espera: cortar ou acelerar |
```

Mostre o mapa ao integrante e confirme o que ele quer manter, cortar ou acelerar. Ele conhece a gravação; você viu só alguns quadros dela. O que ficou entre dois quadros e você não viu é dedução: marque "(provável)" e pergunte.

## 3. A estrutura

A ordem dos passos é a da gravação. O trabalho de estrutura é:

- **Abrir pelo resultado pronto.** O último trecho da gravação (o site no ar, a planilha preenchida) costuma ser a melhor abertura: mostre onde a pessoa vai chegar e só então volte ao começo.
- **Agrupar os passos em blocos com nome de resultado** ("Seu site no ar com um pedido", não "Passo 3").
- **Decidir onde o criador aparece** (gancho, viradas, fecho) e onde é só tela.
- **Cortar a espera.** Tela carregando, digitação longa, erro e volta: corte, acelere ou cubra com uma fala que acrescenta algo.

## 4. A narração

Escreva bloco a bloco, com uma marca de tela por passo, no tempo da gravação:

```markdown
## 2. O site no ar com um pedido só
[TELA 00:12 a 00:31: digita o pedido no campo]
Aqui você escreve o que quer como se pedisse a uma pessoa. Eu pedi um site para uma confeitaria, com cardápio.
[TELA 00:31 a 01:05: o site sendo montado · acelerar]
Enquanto ele monta, repare numa coisa: eu não escolhi modelo nenhum.
```

Regras:

- **A fala diz o que a imagem não diz.** A tela mostra o clique; a fala diz por que aquele clique e o que evitar. "Aqui eu clico aqui" não é narração.
- **Diga o nome exato** do botão, do menu ou do campo, como está na tela.
- **A fala cabe no tempo da ação.** No ritmo do criador, 10 segundos de tela comportam cerca de 30 palavras (a 180 por minuto). Fala maior do que a ação: peça para congelar a imagem (`[CONGELAR 3s]`) ou divida a fala. Ação maior do que a fala: acelere ou corte.
- **Antecipe o erro comum** no passo em que ele acontece.
- Os intervalos (`00:12 a 00:31`) situam a fala na gravação e não somam tempo. Só um tempo em segundos (`[CONGELAR 3s]`, `[PAUSA 2s]`) soma.

## 5. Conferir e entregar

Siga os passos de conferência, crítica e entrega da skill. Na crítica, confira também, linha a linha, se cada `[TELA …]` existe no mapa da gravação e se a fala descreve o que o mapa diz. Entregue ao integrante, junto com o roteiro, a lista de cortes e acelerações combinada: ela é o guia da edição.
