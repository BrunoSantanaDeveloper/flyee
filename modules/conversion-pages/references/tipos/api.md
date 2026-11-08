# Página de API: vender para quem programa

**O que é.** A página que vende o acesso programável a um produto: uma API, webhooks ou um servidor MCP para agentes de IA. Quem lê sabe programar, ou vai repassar a página para quem sabe, e decide pela documentação, pelos limites e pelo preço.

**Quando usar.** Quando o produto tem uma API para clientes ou parceiros, inclusive quando ela é vendida à parte, como no modelo do Juridiq: a API básica por R$ 98,90 por mês e a API com o servidor MCP por R$ 198,90 por mês.

**A regra que não se quebra.** Os exemplos da página funcionam como estão escritos: a mesma rota, a mesma versão e a mesma resposta da documentação. Os limites de uso e o preço estão em número.

## As seções, na ordem

1. **O topo.**
   - Uma frase com o que a API permite. No Juridiq: a operação do escritório, agora programável.
   - O chamado para a documentação e o de ver os planos.
   - Um console com uma chamada e a resposta, e a etiqueta de que os dados são de exemplo.
   - Uma linha técnica curta: REST, JSON, Bearer, HTTPS.
2. **A ficha técnica.** O endereço base, o protocolo, a autenticação, o transporte, a codificação e a versão. Um selo de estado, como "Operacional", leva a uma página de status real.
3. **Os recursos expostos.** Um cartão por área (processos, prazos, documentos, clientes, financeiro), com o método e a rota.
4. **O que dá para automatizar.** Casos de uso, cada um com o resultado.
5. **Os agentes de IA,** quando há um servidor MCP. O que o agente consegue fazer e uma conversa de exemplo em que ele chama as ferramentas e responde. No Juridiq, o agente lista os prazos da semana, resume uma publicação e cria a tarefa.
6. **Da chave à primeira resposta, em três passos.** Gerar a chave, fazer a primeira chamada e receber o JSON, com o exemplo pronto para copiar.
7. **Os planos da API.** Para cada plano:
   - o preço e o período;
   - os limites de uso em número;
   - o que inclui e o tipo de suporte;
   - se há taxa de implantação;
   - como cancelar;
   - se a API exige a assinatura de outro plano.
8. **O último chamado,** com a documentação.

## A mecânica

- **Os exemplos têm uma aba por linguagem** (curl, Node.js, Python) e um botão de copiar.
- **Os exemplos batem com a documentação.** No Juridiq, a página inicial mostra uma rota em inglês (`/tasks`), e a página da API mostra outra em português e com versão (`/v1/tarefas`).
- **O console do topo usa dados de exemplo** e diz isso. A chamada e a resposta são as do produto, e a cena segue `../demonstracao.md`.
- **O chamado de começar leva à criação da chave,** não a um cadastro genérico.
- **O plano de agentes em destaque,** quando é o que a maioria deve escolher.

## O texto

- Direto e técnico, sem adjetivo: o que cada rota faz, em uma linha.
- Os nomes das rotas, dos campos e das ferramentas iguais aos da documentação.
- Leia `../vicios.md` antes de escrever: disponibilidade, volume e versão precisam de origem.
- Revise com a skill `texto-natural` antes de entregar, sem acrescentar fato, número ou promessa.

## Movimento e mídia

Veja `../movimento.md`. Um cursor que pisca num terminal e uma conversa de exemplo que aparece passo a passo bastam. Com menos movimento pedido, a conversa aparece inteira.

## No celular

O chamado para a documentação aparece na primeira tela. O código rola de lado dentro do bloco, sem quebrar a página.

## Medição

Use os eventos de `../medicao.md`: o clique na documentação, a cópia de um exemplo, o plano da API escolhido, a chave criada e a primeira chamada.

## Linhas legais

- O preço, o período e as condições da API, inclusive se ela exige outro plano (Decreto 7.962/2013, art. 2, V e VI).
- Quem vende identificado (Decreto 7.962/2013, art. 2, I e II).
- A política de privacidade diz que dados a API trata e onde eles ficam.

Os detalhes estão em `../lei.md`.

## O que a conferência olha

`h1_present`, `docs_first_screen`, `cta_consistent`, `code_sample`, `rate_limits_shown`, `price_shown`, `plan_highlighted`, `claims_have_origin`, `placeholder_data`, `cancel_terms_shown`, `supplier_identified`, `legal_lines`, `demo_honest`, `demo_film`, `ai_defaults`, `off_brand`, `popup_dismissable`, `popup_on_arrival`, `reduced_motion`, `mobile_fits`, `text_legible`, `tap_targets`, `contrast_ok`, `controls_fit`, `images_light`, `images_alt`.

## Modelos

- `../modelos/juridiq-api.md`: a API e o servidor MCP de um software jurídico, com o console no topo, a ficha técnica e dois planos.
