# Juridiq: a página de planos com mensal e anual

- **Fonte:** Juridiq, juridiq.com.br/plans, vista em 2026-11-07, durante a promoção de Black Friday. Os mesmos cartões aparecem embutidos na página inicial.
- **Tipo:** página de planos e preços. A página de vendas está em `juridiq-pagina-de-vendas.md`.
- **Como foi lida:** capturada no computador e no celular, com a leitura dos preços (inclusive os riscados) e das seções. O seletor foi trocado para o mensal num navegador, para ler os preços mensais e conferir as contas do anual. Um dia da agenda foi aberto, sem marcar nada. Aqui fica a análise.

## Os planos

Quatro planos, do mais caro para o mais barato, da esquerda para a direita: Proficiente, Essencial (em destaque), Sociedade Jurídica e Jovem Advogado. O nome de cada plano diz para que tamanho de escritório ele serve.

| Plano | Mensal | Anual riscado | Anual no cartão (30%) | Média mensal | Economia | Anual no PIX (40%) |
|---|---|---|---|---|---|---|
| Proficiente | R$ 734,90 | R$ 8.818,80 | R$ 6.173,16 | R$ 514,43 | R$ 2.645,64 | R$ 5.291,28 |
| Essencial | R$ 384,90 | R$ 4.618,80 | R$ 3.233,16 | R$ 269,43 | R$ 1.385,64 | R$ 2.771,28 |
| Sociedade Jurídica | R$ 249,90 | R$ 2.998,80 | R$ 2.099,16 | R$ 174,93 | R$ 899,64 | R$ 1.799,28 |
| Jovem Advogado | R$ 64,90 | R$ 778,80 | R$ 545,16 | R$ 45,43 | R$ 233,64 | R$ 467,28 |

Todas as contas fecham:
- o riscado é doze vezes o mensal;
- o cartão é o riscado com 30% a menos;
- a média mensal é o cartão dividido por 12;
- a economia é o riscado menos o cartão;
- o PIX é o riscado com 40% a menos.

## A página, na ordem

1. **A faixa da promoção e o menu,** os mesmos da página inicial, e um caminho de volta para a página inicial.
2. **O título e as condições:** o teste sem cartão, sem letras miúdas, e a promoção (30% no cartão, 40% no PIX, migração e configuração grátis, só para novos clientes e no primeiro ano).
3. **O seletor mensal ou anual,** que abre no anual, com "até 40% OFF" escrito na opção.
4. **Os quatro cartões.** Cada um tem:
   - o nome e uma frase;
   - o anual riscado, a média mensal em destaque, o total no cartão e a economia;
   - o PIX com a sua conta;
   - a promoção, o chamado "Iniciar agora" e de três a quatro itens.

   O Essencial tem fundo escuro, contorno azul e o selo "Recomendado". O Proficiente abre a lista com "Tudo do Essencial, ampliado".
5. **"Prefere ver funcionando antes de assinar?"**, que leva à demonstração.
6. **A tabela comparativa,** por grupos: capacidade e limites, inteligência artificial, documentos e assinaturas, monitoramento, gestão do escritório, API e integrações. O cabeçalho com o nome, o preço e o chamado de cada plano gruda no topo durante a rolagem. A última linha avisa que a API não está em nenhum plano e é vendida à parte, a partir de R$ 98,90 por mês.
7. **O plano sob medida,** com WhatsApp e reunião.
8. **A agenda de demonstração embutida.** Ela pergunta se a pessoa já é cliente: quem é recebe treinamento, quem não é conhece o sistema. Mostra um calendário com os horários de 30 em 30 minutos e o aviso de últimas vagas do dia. Na leitura, o aviso dizia que restava 1 horário, e a agenda do dia tinha mesmo um só.
9. **As perguntas frequentes,** as mesmas seis da página inicial.
10. **Um último chamado e os depoimentos.**

## A mecânica que vale levar

- **O anual aberto por padrão,** com o desconto escrito no próprio seletor.
- **O preço riscado verdadeiro:** é o mensal vezes doze, e o mensal existe no seletor.
- **Cada forma de pagamento com a sua conta,** e a economia em reais, não só em porcentagem.
- **O plano em destaque no segundo lugar,** ao lado do mais caro, com fundo e selo.
- **A herança entre planos** ("Tudo do Essencial, ampliado") em vez de repetir a lista.
- **O cabeçalho grudado na tabela,** com o chamado de cada plano sempre à mão.
- **O que fica de fora escrito na tabela,** com o preço do produto vendido à parte.
- **A agenda que separa cliente de quem ainda não é,** para a conversa certa.

## O movimento

Quase nada se mexe: o seletor troca os preços na hora, a tabela é parada e a janela da promoção abre com a rolagem, como na página inicial.

## O visual, em palavras

- **A página é branca,** com o menu e a faixa escuros da página de vendas. O título fica grande e centralizado, com a linha de condições em cinza.
- **A promoção,** num bloco escuro com o letreiro correndo na base.
- **O seletor,** em forma de pílula: a opção marcada fica escura, com o selo do desconto em azul.
- **Os quatro cartões** são brancos, de borda fina e cantos arredondados. O recomendado tem fundo escuro, contorno azul e o selo "Recomendado" azul sobre a borda.
- **Dentro do cartão:**
  - o preço riscado pequeno, em cinza;
  - a média mensal grande e pesada;
  - as outras contas pequenas;
  - a linha do PIX em azul;
  - a promoção numa pílula escura (azul no recomendado).

Na página do integrante, troque cores e letra pelas da marca dele; o que vale levar é a hierarquia dos preços e o destaque do plano.

## O que não repetir

- **A página não tem um título principal marcado (h1).** O título visível não é um título para o buscador nem para o leitor de tela.
- **O teste grátis não diz quanto dura.**
- **A renovação depois do primeiro ano** não está escrita: o desconto vale só no primeiro ano, e a página não diz quanto custa o segundo. Dá para deduzir pelo preço riscado, mas quem decide não deveria ter de deduzir.
- **A demonstração dura 1 hora na agenda** e 30 minutos nos chamados da página inicial.
- **A migração grátis** aparece em todos os cartões na promoção, e as perguntas frequentes dizem que ela é grátis a partir do Essencial.
- **No seletor mensal,** os cartões mostram só o preço, sem as condições.
