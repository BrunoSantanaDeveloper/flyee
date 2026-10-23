# Entregabilidade: a lista só vale se chegar

Este guia é para a IA. Os provedores (Gmail, Outlook) derrubam quem envia em volume sem autenticação ou com reclamação alta; uma lista antiga que volta a receber de uma vez é o caso clássico. `deliverability <domínio> --dkim <seletor>` consulta o DNS público sem chave; o resto é conferido numa mensagem real e nos relatórios da ferramenta.

## Cada item tem um estado

`ok` (o app viu no DNS), `missing` (não está lá), `attention` (está, mas incompleto), `unknown` (depende de algo que o app não vê: uma mensagem real, um relatório). Verde só é verde quando foi visto; nunca por suposição.

## A lista

| Item | Verde quando | Como conferir |
|---|---|---|
| SPF | um registro v=spf1 com o include da ferramenta e o fim (~all) | o app consulta o TXT do domínio |
| DKIM | a chave publicada no seletor que a ferramenta deu, alinhada com o domínio do remetente | o app consulta `<seletor>._domainkey.<domínio>`; o seletor está na tela de autenticação da ferramenta |
| DMARC | um registro `_dmarc` com ao menos p=none e um endereço de relatórios | o app consulta o TXT |
| Descadastro em um clique | o cabeçalho List-Unsubscribe numa mensagem real | o integrante manda um teste e mostra os cabeçalhos ("Mostrar original" no Gmail) |
| Rodapé legal | quem escreve, de onde veio o contato, como sair | a mensagem de teste |
| Reclamação | abaixo de 0,1% por envio; nunca 0,3% | o painel da ferramenta ou o Postmaster do Google |
| Rejeição dura | abaixo de 1% por envio; acima de 2% é problema de origem da lista | o relatório do envio |
| Descadastro | abaixo de 0,3% por envio; 0,5% é cansaço ou público errado | o relatório do envio |

O Gmail e o Outlook exigem SPF, DKIM, DMARC alinhado, descadastro em um clique e reclamação abaixo de 0,3% de quem envia cerca de 5.000 mensagens por dia; abaixo disso é boa prática, e o app marca como atenção, nunca como bloqueio.

## Lotes crescentes

Uma lista parada, um domínio novo ou uma ferramenta nova aquecem: comece pelos engajados dos últimos 30 dias, dobre a cada envio enquanto reclamação, rejeição e descadastro ficarem abaixo dos limiares, e volte um lote por uma semana se algum passar. Uma lista parada há seis meses começa pela repermissão, nunca por uma promoção.

## Quando fica vermelho

Primeiro a autenticação (a mensagem está sendo rejeitada); depois a reclamação (só os engajados por duas a quatro semanas, descadastro visível, origem da lista conferida); depois a rejeição (tirar endereços de função e erros de digitação, procurar listas compradas ou antigas). As promoções param enquanto estiver vermelho.
