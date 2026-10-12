# Perfil de voz

Um roteiro que qualquer canal poderia ler não serve a nenhum. O perfil de voz é o que faz o texto soar como o criador, e é feito de **exemplos**, não de adjetivos: "tom descontraído" não ajuda ninguém a escrever; uma frase que ele diria e outra que ele nunca diria ajudam.

O perfil fica em `roteiros/canal.md`, na seção "Voz", e é lido antes de todo roteiro.

## De onde tirar

Peça ao criador **texto de verdade dele**, o que houver:

- um roteiro antigo ou a fala transcrita de um vídeo;
- legendas e posts longos;
- uma mensagem de áudio transcrita ou um e-mail em que ele explica algo.

Quanto mais variado, melhor: temas e momentos diferentes mostram o que é dele e o que foi de um dia. Um trecho que destoa muito do resto pode ser texto de outra pessoa ou leitura de patrocínio: pergunte antes de usar.

Sem nenhum texto, faça três perguntas e escreva um perfil provisório, marcado como "(provisório)":

1. Você fala com o público como com um amigo, como professor ou como especialista?
2. Diz três expressões que você usa muito e três que você nunca usaria.
3. Um criador cujo jeito de falar parece com o seu (só o jeito, não o conteúdo).

## Pelos vídeos do canal

Quando o criador já tem vídeos publicados, a melhor amostra da voz dele é a fala real. O app **Pesquisa no YouTube** (`youtube-research`) traz essa fala sem baixar nada; o guia dele é `.flyee/modules/youtube-research/references/interface.md`. Se ele não estiver instalado, ofereça instalar (`npx flyee add youtube-research --yes --json`, que você roda com o sim) ou siga com os textos que o criador trouxer.

1. **O normal do canal e o que já funcionou:**

   ```
   node .flyee/modules/youtube-research/scripts/research.mjs channel <@canal> --json
   ```

   Anote em `canal.md` a mediana de views (`median_views`) e os vídeos de `top`, os que mais passaram do normal: eles mostram o que este público já quis deste criador.

2. **Escolha de 5 a 8 vídeos** variados: os dois ou três de `top`, alguns recentes e formatos diferentes. Menos de cinco não mostra o que é hábito e o que foi de um dia.

3. **A fala:**

   ```
   node .flyee/modules/youtube-research/scripts/research.mjs transcript <id> <id> <id> <id> <id> --json
   ```

   Leia os `transcript.md` devolvidos e preencha os pilares com trechos reais. Repare em como ele abre, como emenda uma ideia na outra, como fecha e como pede.

4. **O ritmo de fala.** Cada item traz `words_per_minute`. Use a mediana dos vídeos e grave no perfil, no lugar do valor estimado:

   ```
   - Ritmo de fala: 204 palavras por minuto (medido em 6 vídeos)
   ```

   A partir daí, a duração estimada dos roteiros usa o ritmo dele.

Cuidados:

- A legenda automática vem quase sem pontuação e erra nomes e números. Ela mostra vocabulário, tiques e ritmo; não meça o tamanho das frases por ela e não copie um número sem conferir.
- Um trecho de patrocínio lido não é a voz dele.
- Um vídeo sem legenda volta com `no_captions`: escolha outro.
- Mostre o perfil ao criador antes de usar. A fala transcrita é dele, mas a leitura dela é sua.

## Pelos criadores de referência

Quando o canal ainda não tem vídeos, ou tem poucos, o criador pode apontar de **2 a 4 criadores com o jeito de falar parecido com o dele**. A voz sai da mecânica deles, nunca do conteúdo.

1. **A fala:** `transcript <id> <id> --json` na Pesquisa no YouTube, ou as transcrições que o criador colar em arquivos. Se a legenda não vier, siga "Quando a leitura falha" em `pesquisa.md`: peça o texto, nunca contorne.
2. **Só a mecânica:**
   - como abrem (o resultado na tela, a pergunta, a confissão);
   - os marcadores de conversa ("tá?", "né?", "ó", "cara", "bora", "olha só");
   - como mostram a tela ("olha aqui", "repara nisso");
   - como pedem para ficar até o fim e como fecham;
   - o ritmo das frases e o tamanho das pausas.
3. **"Você fala assim?"** Mostre cada traço emprestado ao criador e pergunte. Só fica o que ele confirmar. Um marcador que ele não usa soa imitação. Enquanto ele não responde (ou quando delegou), o traço entra marcado como no item 4 e vai para a pergunta da entrega.
4. **Marque a origem.** No perfil, o que veio de fora leva "(emprestado de referências, confirme)" até ele confirmar.
5. **O ritmo não se empresta.** Vídeos editados de outros criadores correm mais do que a fala de quem está começando, e a duração sai errada. Deixe o valor estimado no perfil até medir nos vídeos dele.
6. **Nunca entram** o bordão marcante, a frase, a história, a opinião ou o conteúdo do outro criador.

O melhor material de voz, mesmo assim, é o texto do próprio criador: um parágrafo que ele reescreveu do roteiro vale mais do que três transcrições. Quando ele reescrever um trecho, guarde as escolhas dele no perfil (com o sim dele) e use o texto dele palavra por palavra (veja `ganchos.md`).

Pergunte também, uma vez, como ele fala de si: "cansado" ou "cansada". Vai para o perfil ("Na primeira pessoa"); sem a resposta, a fala evita as palavras que mudam com o gênero.

## Os pilares

| Pilar | O que observar | Exemplo de anotação |
|---|---|---|
| Tratamento | "você", "vocês", "galera", "tu", "a gente" | fala com "você", no singular; nunca "galera" |
| Vocabulário | formal ou coloquial, técnico ou simples, regional, palavras preferidas | diz "grana", "treta", "na prática"; evita anglicismo |
| Ritmo | o tamanho das frases, como abre, como emenda uma ideia na outra | frases curtas; emenda com "só que" e "aí" |
| Tiques | o que ele repete: "tipo", "né", "bora", "beleza?" | fecha explicações com "faz sentido?" |
| Humor e franqueza | brinca ou é sério; diz direto ou rodeia | ironia leve consigo mesmo; nunca com o público |
| Autoridade | fala como colega, como professor ou como instituição | colega que já errou antes |
| Como abre e fecha | o hábito dele nos vídeos | fecha sempre apontando o próximo vídeo |
| Prova | usa números, casos próprios, comparações do cotidiano | sempre conta um caso de cliente, sem nome |

## Os três blocos que mais ajudam

1. **Três frases de referência**, tiradas do material dele: uma que mostra o vocabulário e o ritmo, uma que mostra como ele diz algo delicado e uma em que ele está sob pressão (uma crítica, um erro, uma polêmica). São a régua de todo texto novo. Num canal novo, com pouco material dele, use o que houver (o gancho que ele escreveu, uma mensagem) e marque as que faltam com `[CONFIRMAR]`.
2. **"Nunca diria"**: três frases erradas para ele, com o porquê.
3. **Pares no tom e fora do tom**, sobre o mesmo conteúdo:

   > No tom: "Comprei, usei três meses e devolvi. Vou te contar por quê."
   > Fora do tom: "Hoje vamos explorar os prós e contras deste produto incrível!"

## Como fica em canal.md

```markdown
## Voz (provisório até o criador confirmar)

Resumo: fala como um colega que já errou antes, direto, com ironia leve consigo mesmo.

- Tratamento: "você"; nunca "galera" nem "pessoal".
- Vocabulário: coloquial; "grana", "na prática"; evita termos em inglês.
- Ritmo: frases curtas; emenda com "só que" e "aí".
- Tiques: "faz sentido?" depois de explicar.
- Prova: casos de clientes, sem nome; números da própria planilha.

Frases de referência:
1. "…"
2. "…"
3. "…"

Nunca diria:
- "Sejam muito bem-vindos a mais um vídeo" (não cumprimenta assim)
- "…"

No tom / fora do tom:
- "…" / "…"
```

## Histórias e opiniões

A voz diz como ele fala; esta seção de `canal.md` guarda o que ele tem para dizer em qualquer vídeo. Sem ela, a origem e a opinião de cada roteiro viram proposta ou marca; com ela, saem prontas e são dele.

- **Como eu comecei:** a história de como ele chegou ao que faz (o que estava fazendo, o que percebeu, o que fez).
- **O que eu defendo:** uma ou duas posições que ele sustenta, com o porquê.
- **O que me incomoda no jeito comum:** o que ele vê os outros fazerem e acha que dá errado.
- **Casos que eu conto:** o que aconteceu, com quem (sem nome de cliente), e o que ele tirou disso.

Peça na rodada do perfil, com uma pergunta para cada, e grave com as palavras dele. Num canal com vídeos, as transcrições ("Pelos vídeos do canal") costumam trazer essas histórias: proponha as que achar, com o trecho e o tempo, e grave só as que ele confirmar. O que ele assinar ou corrigir num roteiro também entra aqui. Nunca escreva nesta seção uma história ou uma opinião que ele não contou ou não assinou.

## Usar e manter

- **Antes de escrever**, releia as frases de referência. **Depois de escrever cada bloco**, compare: o criador diria isso, nessa ordem, com essas palavras?
- Os tiques entram com parcimônia: um "né" onde ele poria, não em toda frase. Não invente hesitação para parecer humano.
- O perfil manda sobre os guias de estilo: se "incrível" é palavra dele, ela fica, mesmo sendo palavra gasta.
- **As Regras do criador ficam separadas da voz**, em `canal.md`: o "Nunca dizer" (termos exatos, que a conferência bloqueia) e o "Nunca fazer" (que a crítica confere). Veja `formato.md`.
- **Só o criador muda o perfil.** Quando ele corrigir um texto ("eu não falaria assim"), anote a correção com as palavras dele. Nunca acrescente ao perfil uma dedução sua sem ele confirmar. Um traço de outro criador marcado "(emprestado de referências, confirme)" é uma proposta à espera do sim, não uma dedução.
- Mostre o perfil pronto e pergunte: "onde isso ainda não parece você?". O alvo é ele ler um bloco e reconhecer como seu, com pouca correção.
