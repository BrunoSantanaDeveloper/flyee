# A entrada de um modelo novo

Material do operador; nunca é distribuído. É o procedimento para cada página que o operador traz como modelo, conforme a decisão D2 e o ÉPICO 4 de `docs/PLANO-PAGINAS.md`.

## 1. O que o operador traz

- Um endereço público.
- Uma página salva (`.mhtml`), quando a página só abre com login.
- Capturas de tela ou um vídeo da tela.

## 2. A captura

- **Página pública ou salva:** rode `node modules/video-render/scripts/render.mjs capture <endereço ou arquivo> --out <pasta de trabalho>/pesquisa-paginas/<modelo>/captura --json`. Use um `--out` absoluto, fora do repositório. O `captura.json` traz a anatomia (seções, chamados, barras fixas, caixas, preços, vídeos, animações, contadores) e o `texto.md` traz o texto inteiro.
- **Página que pede login e não foi salva:** repita o que foi feito no modelo da Hostinger.
  - Abra um navegador sem janela, com perfil temporário, e registre o que a página baixa pelo CDP (domínio Network).
  - O dicionário de textos e o código da tela dão os textos, a ordem das seções, a regra de exibição e a mídia.
  - Nunca clique em botão de compra. Não guarde respostas da API com dados do pedido do operador.
- **O que só acontece com o tempo ou com a rolagem:** a anatomia lê o estado da página, não o comportamento. Quando uma janela abre, se volta depois de dispensada, a contagem dos números, a digitação, a troca automática, a barra do celular e o que muda com menos movimento pedem a sonda.
  - Use as de `C:\AppsProjects\flyee-workspace\pesquisa-paginas\juridiq-2026-11-07\sonda\`, trocando os textos que elas procuram.
  - Elas rolam em passos e leem o texto e as animações a cada passo.
  - Separe profundidade de tempo: role rápido e devagar e veja se a janela abre na mesma altura.
  - Nunca clique em compra nem marque agenda.
- **Confira o que a foto mostra contra a sonda.** A captura rola a página antes de fotografar: uma janela que abre com a rolagem sai na foto do topo. A foto sozinha já levou a um relato errado ("a janela cobre a página na chegada").
- **Vídeos:**
  - baixe os arquivos;
  - meça o movimento pela diferença entre quadros, em janelas de 0,25 s, ignorando o pulso do quadro-chave (quadro 250 no padrão do x264);
  - monte folhas de quadros nos começos e fins de cada trecho de movimento.

## 3. O bruto fica fora do repositório

O repositório é público. O bruto vai para `C:\AppsProjects\flyee-workspace\pesquisa-paginas\<modelo>-<data>\`, com um `LEIAME.txt` que diz o que é cada arquivo.

## 4. A análise

- `references/modelos/<id>.md`, no formato do modelo da Hostinger:
  - fonte e data, os tipos e como foi lida;
  - o fluxo e quem vê a oferta;
  - a página na ordem;
  - a mecânica que vale levar;
  - o movimento;
  - o que não repetir.

  Entram só a nossa análise e trechos curtos. A citação também passa pela regra de texto: nenhuma frase com travessão ou palavra vetada.
- `references/modelos.json`: a entrada com os destaques.
- O que o modelo muda no roteiro do tipo vai para `references/tipos.json` e `references/tipos/<tipo>.md`: uma seção, uma mecânica ou um item de conferência.
- Um item de conferência novo entra em `references/checks.json` e em `scripts/lib/checks.mjs`, com teste.
- Um tipo novo entra em `tipos.json` e em `tipos/<tipo>.md`; o teste de coerência confere os dois.

## 5. A conferência entre apps

Sempre, ao fim: liste ao operador o que os outros apps do catálogo ganham com o mesmo achado, e o que cada um ganharia. A regra está em `.claude/rules/apps.md`. A primeira lista, a do modelo da Hostinger, está na seção 6 de `docs/PLANO-PAGINAS.md`.

## 6. A versão

1. `npm run apps -- bump conversion-pages minor` para modelo ou tipo novo, `patch` para correção, e o changelog nos dois idiomas.
2. `npm run validate conversion-pages` e `npm run test:apps`.
3. `npm run pack conversion-pages`.
4. `npm run apps -- link conversion-pages --user`, para a versão nova chegar aos projetos de código do operador.
5. A tag e a publicação seguem `docs/RELEASE.md`, quando o operador pedir.
