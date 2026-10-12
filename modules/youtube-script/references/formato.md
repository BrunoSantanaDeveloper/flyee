# Pastas e formatos

Tudo o que este app produz fica na pasta `roteiros/` do projeto do integrante. Um vídeo, uma pasta. Os arquivos vão aparecendo conforme o trabalho anda, e `check --json` diz em que etapa cada vídeo está pelos arquivos que já existem e pelas pendências do roteiro.

```
roteiros/
├── canal.md                  o perfil do canal: público, promessa, formatos, voz, ritmo de fala e as regras do criador
├── pautas-<data>.md          as pautas, quando o integrante pergunta o que gravar
└── <vídeo>/                  um nome curto, minúsculas e hífens (ex.: bolo-de-pote)
    ├── briefing.md           o que o vídeo é, para quem, o que precisa provar e o que fica fora da fala
    ├── verdade.md            a ficha de verdade do que aparece no vídeo (ferramenta, produto, serviço)
    ├── pesquisa.md           os dados do tema, os padrões, a lacuna e os fatos com fonte
    ├── referencia.md         o mapa batida a batida de um vídeo de referência e a adaptação ao público
    ├── embalagem.md          títulos, thumbnails para o teste e a promessa escolhida
    ├── gravacao.md           o plano de gravação: o que fazer, gravar e anotar antes da fala (e, num tutorial de tela, o mapa da gravação)
    ├── estrutura.md          os ganchos, o escolhido, os blocos com tempo e os pontos de retenção
    ├── roteiro.md            o texto que vai ser falado, bloco por bloco
    ├── revisao.md            o que a conferência e a crítica acharam e o que mudou
    ├── descricao.md          a descrição do vídeo, com capítulos e o comentário fixado
    ├── checklist.md          o que fazer antes, o que preencher e o que conferir antes de publicar (gerado pelo script)
    ├── teleprompter.txt      só a fala, uma frase por linha (gerado pelo script)
    ├── roteiro.docx          o roteiro em documento do Word e do Google Docs (gerado pelo script)
    └── roteiro-completo.md   tudo junto, na ordem de leitura, para ler e compartilhar (gerado pelo script)
```

Nunca apague o que o integrante escreveu. Para mudar um arquivo pronto, mostre a mudança e grave por cima só com o sim dele; versões antigas do roteiro podem ficar como `roteiro-v1.md`.

## canal.md

```markdown
# <nome do canal>

- Nicho e tema: …
- Para quem: … (quem é, o que já sabe, o que quer, o que teme)
- Promessa do canal: … (o que o público leva de todo vídeo)
- Formatos: … (de frente para a câmera, tela, misto; duração típica)
- Prova e autoridade: … (o que o criador viveu, mediu ou construiu e pode mostrar)
- Ritmo de fala: 180 palavras por minuto (estimado)
- Na primeira pessoa: … ("cansado" ou "cansada"; sem a resposta, a fala evita as palavras que mudam com o gênero)
- Teste de miniaturas: sim/não (o "Testar e comparar" do YouTube)

## Voz
<os pilares de voz (pelo menos três traços), as frases no tom e fora do tom; veja perfil-de-voz.md>

## Histórias e opiniões

### Como eu comecei
- … (a história de como ele chegou ao que faz, com as palavras dele)

### O que eu defendo
- … (uma posição que ele sustenta em qualquer vídeo)

### O que me incomoda no jeito comum
- …

### Casos que eu conto
- … (o que aconteceu, com quem, e o que ele tirou disso)

## Regras do criador

### Nunca dizer
- "termo exato" (por quê)

### Nunca fazer
- o que ele não quer em nenhum vídeo

### Pedido padrão
- o que o canal pede no fim
```

- A linha "Ritmo de fala: N palavras por minuto" é lida pelo script para estimar a duração. Escreva "(estimado)" até haver uma medida.
- **Nunca dizer** é uma lista de termos exatos, um por linha, entre aspas quando têm mais de uma palavra. A conferência bloqueia o roteiro que tiver um deles na fala.
- **Histórias e opiniões** é o material dele que vale para todo vídeo: a origem, as posições, o que o incomoda e os casos, com as palavras dele. O roteiro usa daqui antes de propor qualquer coisa, e o que ele assina ou corrige num vídeo entra aqui, com o sim dele.
- **Nunca fazer** é conferido pela crítica: "explicar planos ou preços", "citar ferramenta que eu não uso", "prometer resultado".
- Quando o criador corrige algo que vale além deste vídeo ("eu nunca falo isso", "não quero isso em vídeo nenhum"), mostre a linha que vai gravar nas Regras do criador e grave com o sim dele, com as palavras dele.

## briefing.md

```markdown
# Briefing: <tema>

- O vídeo em uma frase: …
- Para quem, exatamente: …
- O que a pessoa sabe antes e o que leva depois: …
- A ideia central, em uma frase: …
- O motivo dominante: … (dinheiro, tempo, status, liberdade, segurança, pertencer)
- O valor para quem não clicar em nada: … (o que serve mesmo sem usar a ferramenta ou o produto)
- Formato e duração alvo: … (ex.: de frente para a câmera, 10 min)
- Prova que o criador tem: … (números, casos, telas, histórias próprias)
- Alguma coisa que aparece no vídeo é sua (você fez, vende ou ganha com ela)? sim/não: …
- O resultado já existe? sim/não: … (num vídeo que mostra fazer, testar ou experimentar algo)
- Vídeo de referência: … (o endereço, ou "nenhum")
- O que o vídeo NÃO cobre: …
- O que fica fora da fala: … (marcas que o público não conhece, planos, preços, versões, números não medidos)
- Pedido do fecho: …

## Ângulos
<os cinco ângulos e o escolhido, quando ele trouxe só o tema>

## Perguntas que só você responde
<a rodada de fatos que destrava a fala; enquanto ele não responde, cada uma é uma marca no roteiro>

## Para você assinar
<as opiniões propostas na voz dele e, num canal novo, os traços de voz emprestados: ele assina, troca ou corta>

## Decidido por você
- …
```

As respostas de sim ou não são lidas pelo script: escreva a resposta logo depois de "sim/não:" ("sim/não: não, a semana começa segunda").

## verdade.md

A ficha de verdade de cada ferramenta, produto ou serviço que aparece no vídeo. Toda frase do roteiro sobre ele sai daqui.

```markdown
# Ficha de verdade: <vídeo>

## <o nome exato, como aparece na tela>
Fontes: <a documentação oficial, o README, o site; a data em que você leu>
- O que faz: …
- Os passos reais: …
- Como funciona por dentro, em uma frase simples: … (o mecanismo, para a fala poder explicar sem inventar)
- As regras do ofício e os padrões: … (o que a documentação diz que faz o resultado ficar bom, com os números e o porquê de cada um, que é o que a fala ensina)
- Limites e o que exige: … (programas, contas, outros apps, o que não faz; o que aparece na tela ao instalar)
- Custo: o que é pago … · o que não é …
- Tempo: … (medido em …) ou [CONFIRMAR: o tempo, depois de fazer]

## O que fica fora da fala
- …
```

Para um objeto comum, sem fonte oficial (uma panela, um pote), a ficha é curta: o que ele usa, o que se sabe com fonte e o resto em `[CONFIRMAR]`. Os títulos `## ` com nome próprio são os nomes que o checklist manda conferir nas legendas.

## pesquisa.md e pautas-<data>.md

Os outliers que importam, os padrões, os traços de título medidos, como os melhores fazem, o que o público pergunta, a lacuna, a tabela de fatos com fonte e as ressalvas. O formato de cada um está em `pesquisa.md` (esta mesma pasta).

## referencia.md

O mapa batida a batida do vídeo de referência, o que muda no contexto do público, o que fica de fora e de onde veio a transcrição. O formato está em `pesquisa.md`, na seção "Um vídeo de referência".

## gravacao.md

O plano de gravação. Num vídeo que mostra fazer, testar ou experimentar algo que ainda não aconteceu, ele vem antes da fala; o checklist copia os itens dele.

```markdown
# Gravação: <vídeo>

## O que fazer e gravar antes da fala
- [ ] Fazer … do começo ao fim, gravando (a tela, a cozinha, o quarto)
- [ ] Anotar: os tempos, as escolhas, o que deu errado de verdade
- [ ] A busca que a fala vai citar: … (onde, com que palavras e quantos resultados)
- [ ] Gravar as cenas de apoio: …

## O mapa da gravação
<num tutorial de tela, depois de gravar: a tabela com os tempos; veja tutorial-de-tela.md>
```

## embalagem.md

Os títulos (5, de gatilhos diferentes, cada um entre aspas, com o gatilho e o traço medido), as thumbnails (como variantes do teste de miniaturas quando o canal tem esse teste), o par escolhido, a promessa em uma frase e onde o vídeo paga essa promessa. Veja `embalagem.md`.

## estrutura.md

Os 3 ou 4 ganchos (de famílias diferentes, com o texto do criador quando houver), o escolhido e por quê, o esqueleto, os blocos na ordem (o nome de resultado, a ideia, a prova, o novo gancho e o tempo), os pontos de retenção, os laços abertos e a melhor parte. Veja `ganchos.md` e `estrutura.md`.

## roteiro.md

O formato que o script entende:

```markdown
# <título de trabalho>

## Gancho
A fala, como vai ser dita. Frases curtas.
[TELA 4s: o que aparece, e quantos segundos de ação sem fala]

## 1. <o bloco, com nome de resultado>
Fala…

Outro parágrafo, depois de uma linha em branco.
[B-ROLL: imagem de apoio]
Um número com fonte: rende 18 fatias por forma. [fonte: o criador]
Levou [CONFIRMAR: quanto tempo, depois de fazer].
> Nota para o criador: não é falada.

## <o fecho, também com um nome para o público>
Fala…
```

| Elemento | Regra |
|---|---|
| `# ` | o título de trabalho; não é falado |
| `## ` | um bloco do vídeo; os blocos viram os capítulos da descrição. O primeiro é o gancho, e o limite de 45 s vale para ele; o contrato é um bloco próprio, logo depois. "Gancho", "Abertura" e "Contrato" entram como "Introdução" nos capítulos |
| texto comum | a fala, exatamente como vai ser dita |
| `[TELA: …]`, `[CÂMERA]`, `[B-ROLL: …]`, `[CORTE]`, `[TEXTO: …]`, `[MÚSICA: …]`, `[PAUSA]` | marcações de produção, nunca faladas. Um tempo dentro de qualquer uma delas (`[TELA 8s: …]`, `[B-ROLL 25s: …]`, `[PAUSA 2s]`, `[CONGELAR 3s]`) soma segundos de ação sem fala na duração |
| `[TELA 00:12–00:31: …]` | num tutorial, o trecho da gravação de tela que esta fala cobre, até a próxima marca desse tipo. Não soma tempo: a conferência compara a fala com o trecho. Escreva "acelerar" ou "cortar" na marca quando o trecho vai ser encurtado na edição |
| `[fonte: …]` | de onde vem um número ou um dado de fora; não é falada. O que está na ficha de verdade não leva marca: a ficha é a fonte |
| `[CONFIRMAR: …]` | a fala depende de algo que ainda falta: um número, um nome, um fato do criador ou o que só o resultado responde. A conferência bloqueia até sair, uma por uma, mesmo sozinha numa linha ou numa nota. Quando a marca pede uma fala dele (uma história, uma opinião), traga um exemplo do tamanho e do tom: `[CONFIRMAR: de onde veio a ideia. Ex.: 'Eu tava fazendo … e reparei que …']`. O exemplo mostra a forma, nunca a história ou a lição de outro criador |
| `[ESCOLHER: …]` | uma decisão que é do criador (o tema do exemplo, a palavra da chamada). A conferência bloqueia até sair |
| `> ` | uma nota para o criador; não é falada e não bloqueia. Use quando a fala está completa, mas ficaria mais forte com algo que só ele tem |
| `## Publi` | o bloco de um patrocinador; não vira capítulo |

Uma linha em branco separa os parágrafos, que são os respiros da fala; as marcas numa linha só não separam.

## revisao.md

```markdown
# Revisão: <vídeo>

## Conferência automática
<o resumo do lint: bloqueios, avisos, duração estimada>

## Crítica
| Critério | Nota | Por quê |
<a rubrica de revisao.md>

## Mudanças
- Obrigatória: …
- Sugestão: …

## Rodadas
<quantas rodadas de conserto e o que mudou em cada>
```

## descricao.md

```markdown
<as 2 primeiras linhas: a promessa do vídeo com as palavras que o público busca>

<o que o vídeo cobre, em 2 ou 3 frases>

Tudo que eu usei:
<cada ferramenta, material ou produto, com o link>

<quando algo é do criador: uma frase dizendo que é dele>

Capítulos (estimados; confira depois da edição)
00:00 <o primeiro bloco>
01:12 …

Comentário fixado: <uma pergunta fácil, ou o material prometido no fecho>
```

Os tempos dos capítulos saem do `lint`. Depois da edição, eles mudam: avise o integrante para conferir no vídeo final. A descrição passa pela conferência também: um `[CONFIRMAR]` esquecido nela gera aviso.

## checklist.md e roteiro-completo.md

Os dois são gerados pelo script. O `checklist` tem três tempos: o que fazer e gravar antes da fala (os itens de `gravacao.md`; sem o plano, as cenas que as marcas pedem); cada `[CONFIRMAR]` e `[ESCOLHER]` do roteiro, da descrição, do briefing, da ficha, da embalagem, do plano e do perfil, com o bloco e a linha; e o que conferir antes de publicar (telas sem dados pessoais, legendas com os nomes certos, quadros reais nas thumbnails, links). O `documento` junta o briefing, a ficha, a referência, a embalagem, a estrutura, o plano de gravação, o roteiro, a descrição, o checklist e a revisão num arquivo só, e avisa no alto quando ainda é rascunho.
