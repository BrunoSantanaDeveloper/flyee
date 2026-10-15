# Como usar

O Roteiro para YouTube escreve com você o roteiro de um vídeo: o título, a thumbnail, a fala inteira e a descrição. É para quem grava para o YouTube, de frente para a câmera ou mostrando a tela, em vídeo longo ou em Short, com canal novo ou com anos de vídeos publicados. A fala sai do seu jeito e cada número tem origem. Antes de você gravar, o texto passa por uma revisão. A sua IA faz o trabalho; você responde e decide.

## Peça assim

Diga à sua IA do jeito que você falaria:

- "Quero gravar um vídeo de uns 10 minutos sobre como montar a marmita da semana sem enjoar. Me ajuda com o roteiro?"
- "Quero um vídeo mostrando a planilha de orçamento que eu criei."
- "Melhora este roteiro antes de eu gravar: (cole o texto ou diga onde está o arquivo)"
- "Vou testar dormir 8 horas por 7 dias. Me dá o roteiro do vídeo."
- "Me dá títulos e ideias de thumbnail para um vídeo sobre airfryer."

## O que acontece

1. Da primeira vez, a IA monta o perfil do seu canal. Ela faz rodadas curtas de perguntas, no máximo quatro por vez, cada uma com uma resposta recomendada: para quem você fala, o que o canal promete, o formato de sempre, a prova que você tem e o que você pede no fim dos vídeos. A voz sai de um texto seu, como um roteiro antigo, a fala transcrita de um vídeo ou um post longo. Sem nenhum texto, ela faz três perguntas sobre o seu jeito de falar e escreve um perfil provisório até você confirmar. Ela pergunta também o que você nunca diz em vídeo, como você começou e o que você defende. Isso vale para todos os vídeos seguintes.
2. Em cada vídeo, ela pergunta só o que falta: o tema, para quem, a duração e a prova que você tem. Pergunta também se alguma coisa que aparece no vídeo é sua e se o resultado já existe. Quando o vídeo mostra uma ferramenta ou um produto, a IA lê a documentação dele e monta uma ficha do que ele faz de verdade. Nenhuma frase do roteiro passa disso.
3. Título e thumbnail vêm antes do texto. Você recebe cinco títulos de tipos diferentes e duas ou três ideias de thumbnail (três variantes, se o canal usa o teste de miniaturas do YouTube). A IA diz qual escolheria e por quê, e você escolhe.
4. Depois vêm três ou quatro opções de gancho e os blocos do vídeo, cada um com nome e tempo. Se você escreveu um gancho, ele entra palavra por palavra como uma das opções. Você ajusta antes de qualquer texto. Quando o vídeo mostra algo que ainda não aconteceu (um teste, uma receita, um app em uso), vem antes o plano de gravação: você faz e grava primeiro, e a fala é escrita em cima do que aconteceu.
5. A IA escreve o gancho e o primeiro bloco e mostra. Você reage ("mais curto", "eu não falaria assim") e ela segue bloco a bloco até o fim. O que só você sabe fica marcado dentro da frase, como `[CONFIRMAR: quanto tempo levou]`, em vez de inventado. Num tutorial de tela, você passa a lista dos passos ou capturas de cada momento, e a narração acompanha o que aparece.
6. Antes de você gravar, a fala passa por uma revisão que tira a cara de texto de IA, por uma conferência automática e por uma crítica com olhos novos. A conferência pega aberturas que espantam o público, frases longas, números sem fonte, as palavras que você nunca diz e frases de anúncio. A crítica dá notas e separa o que é obrigatório mudar do que é sugestão. As mudanças entram com o seu sim.
7. No fim, você recebe a descrição com os capítulos, o checklist do que fazer até publicar e, quando não sobra nenhuma marca, o texto do teleprompter.

Não há programa a instalar, chave ou conta para criar. O trabalho anda no ritmo das suas respostas. Se você disser "decide o resto por mim", a IA segue sem parar, anota cada decisão e mostra a lista no fim. Ela não inventa fato nenhum por isso: o que só você sabe vira marca e aparece na lista da entrega.

## O que você recebe

Tudo fica na pasta `roteiros/` do seu projeto. O perfil do canal fica nela, e cada vídeo ganha uma pasta própria, com um nome curto.

| Arquivo | O que tem |
|---|---|
| `canal.md` | o perfil do canal: público, voz, histórias, opiniões e as suas regras |
| `briefing.md` | o que o vídeo é, para quem, o que precisa provar e o que a IA decidiu por você |
| `embalagem.md` | os títulos, as thumbnails e a promessa do vídeo |
| `estrutura.md` | os ganchos, os blocos com tempo e os pontos que seguram a atenção |
| `roteiro.md` | o roteiro |
| `revisao.md` | as notas da crítica e o que mudou |
| `descricao.md` | a descrição com "tudo que eu usei" e os capítulos |
| `checklist.md` | o que fazer antes, o que preencher e o que conferir antes de publicar |
| `teleprompter.txt` | só a fala, uma frase por linha |

Conforme o vídeo, aparecem também a ficha de verdade (`verdade.md`) e o plano de gravação (`gravacao.md`).

## Dicas

- O melhor material para a sua voz é um texto seu, como um roteiro antigo ou um post longo. Um parágrafo que você reescreveu vale mais do que três transcrições.
- Quando algo não soa como você, diga como você falaria. Se a correção vale para todo vídeo ("eu nunca digo galera"), a IA mostra a linha que vai guardar nas suas regras e só guarda com o seu sim. O que você corrige ou assina num vídeo fica no perfil para os próximos.
- Traga a prova: números que você mediu, casos, telas, histórias suas.
- Se o vídeo mostra algo que você fez, vende ou ganha com ele, diga. O roteiro fala como quem montou e está mostrando: uma frase de transparência, nada de preço na fala e o link na descrição.
- Diga se você fala de si como "cansado" ou "cansada". Sem essa resposta, a fala evita as palavras que mudam com o gênero.

## Limites

- Não inventa nada. Número, caso, resultado ou história sua só entram se vieram de você ou de uma fonte citada. O que falta fica marcado, e o roteiro só fica pronto quando todas as marcas forem preenchidas.
- Não narra o que ainda não aconteceu. Num teste ou numa demonstração, você faz primeiro e a fala vem depois.
- A duração é uma estimativa pelo seu ritmo de fala. Até conhecer o seu, o app conta 180 palavras por minuto; se o vídeo gravado sair mais longo ou mais curto, conte para a IA, e ela ajusta o perfil. Os tempos dos capítulos também são estimados: confira no vídeo editado.
- Não grava, não edita e não publica o vídeo. As thumbnails saem como ideias, não como imagens.
- Nesta versão, a IA não busca dados no YouTube nem assiste a vídeos: os títulos, os ganchos e a estrutura saem do que você conta, do perfil do canal e das regras do app.
- O app foi feito para roteiros em português do Brasil.
