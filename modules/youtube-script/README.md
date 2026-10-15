# Roteiro para YouTube

Escreve com você roteiros que prendem do primeiro segundo ao fim: título e thumbnail antes, gancho forte, estrutura que segura a atenção, texto na sua voz, nada presumido nem com cara de anúncio, e revisão antes de gravar.

## O que ele faz

Pedir um roteiro inteiro para uma IA costuma dar um texto genérico, que soa como robô, presume coisas que não aconteceram e vira propaganda quando o vídeo mostra algo seu. Este app faz diferente: a sua IA escreve **com** você, nas etapas em que os bons roteiristas trabalham, e você decide nos pontos que importam.

1. **O perfil do seu canal**, uma vez só: para quem você fala, o que promete e como você fala. As suas regras ("nunca diga isso", "nunca faça aquilo") valem para todo vídeo, e as suas histórias e opiniões (como você começou, o que você defende, o que te incomoda no jeito comum) entram nos roteiros no lugar de qualquer coisa inventada.
2. **A ficha de verdade** de tudo que aparece no vídeo: o que a ferramenta ou o produto faz de verdade, os limites, o que custa e o que fica fora da fala. Nenhuma frase passa disso.
3. **Título e thumbnail primeiro**: cinco títulos com gatilhos diferentes e thumbnails prontas para o teste de miniaturas.
4. **Gancho e estrutura**: o seu texto como gancho quando você escreve um, blocos com nome de resultado, a melhor parte guardada para o fim e um esqueleto para vídeos de "como eu uso X para Y".
5. **Primeiro acontece, depois se escreve**: num vídeo que mostra fazer ou testar algo, você recebe antes o roteiro de gravação, e a fala vem em cima do que aconteceu. O que só o resultado responde fica marcado para preencher.
6. **Conferência e crítica**: um verificador acha aberturas que espantam o público, frases longas demais, cara de texto de IA, números sem fonte, "ninguém faz isso" sem a busca, frase de anúncio e as palavras que você nunca diz. Depois, uma crítica com olhos novos dá notas e aponta o que é obrigatório mudar.
7. **Pronto para gravar**: o checklist do que fazer, preencher e conferir, o teleprompter e a descrição com "tudo que eu usei" e os capítulos.

Se algo que aparece no vídeo é seu, o roteiro fica sem cara de anúncio: uma frase de transparência, nada de plano ou preço na fala, e o link na descrição.

## O que você precisa

- Uma das IAs em que o app foi testado.
- Nenhum programa a instalar, nenhuma chave e nenhuma conta paga.

## Peça assim

> "Quero gravar um vídeo de uns 10 minutos sobre como fazer o primeiro orçamento como freelancer. Me ajuda com o roteiro?"

Outros pedidos:

- "Quero um vídeo mostrando a planilha de orçamento que eu criei."
- "Melhora este roteiro: <cole o texto ou indique o arquivo>"
- "Vou testar dormir 8 horas por 7 dias. Me dá o roteiro."
- "Me dá títulos e ideias de thumbnail para um vídeo sobre airfryer."

## O que ele grava

| Caminho | Conteúdo |
|---|---|
| `roteiros/canal.md` | o perfil do canal, a sua voz, as suas histórias e opiniões e as suas regras, usados em todos os roteiros |
| `roteiros/<vídeo>/briefing.md` | o que o vídeo é, o que precisa provar e o que fica fora da fala |
| `roteiros/<vídeo>/verdade.md` | a ficha de verdade do que aparece no vídeo |
| `roteiros/<vídeo>/embalagem.md` | os títulos, as thumbnails para o teste e a promessa |
| `roteiros/<vídeo>/estrutura.md` | os ganchos, os blocos com tempo e os pontos de retenção |
| `roteiros/<vídeo>/roteiro.md` | o roteiro |
| `roteiros/<vídeo>/revisao.md` | o que a revisão achou e o que mudou |
| `roteiros/<vídeo>/descricao.md` | a descrição com "tudo que eu usei" e os capítulos |
| `roteiros/<vídeo>/checklist.md` | o que fazer antes, o que preencher e o que conferir antes de publicar |
| `roteiros/<vídeo>/teleprompter.txt` | só a fala, para ler gravando |

## Bom saber

- A duração é estimada pelo seu ritmo de fala. Até o app conhecer o seu, ele usa 180 palavras por minuto, um ritmo comum de vídeo editado. Se o seu vídeo sair mais longo ou mais curto, conte para a IA: ela ajusta o perfil.
- Os tempos dos capítulos são estimados. Confira no vídeo editado antes de publicar.

## O que há de novo

- 1.0.0: primeira versão. Perfil do canal com a sua voz, as suas histórias e opiniões e as suas regras; ficha de verdade do que aparece no vídeo; vídeo do que é seu sem cara de anúncio; primeiro acontece, depois se escreve; título e thumbnail antes do roteiro, com variantes para o teste de miniaturas; ganchos de famílias diferentes, com o seu texto em primeiro lugar; esqueleto para "como eu uso X para Y"; escrita bloco a bloco; conferência automática e crítica com nota mínima; checklist, teleprompter e descrição com capítulos.
