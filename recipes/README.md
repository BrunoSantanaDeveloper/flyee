# recipes/

Uma receita é um conjunto nomeado de apps mais um texto de workflow que os encadeia até um resultado. A plataforma guarda as receitas e serve o workflow só a quem tem o direito; a CLI instala os apps com `npx flyee add receita:<slug>`.

Um arquivo por receita, `<slug>.json`, com `slug`, `name` e `summary` nos dois idiomas, a lista de `modules` e o `workflow` em markdown por idioma. O cadastro na plataforma é feito no console `/admin/catalogo`; quando a importação do índice existir, este diretório entra no índice.

Nenhuma receita existe ainda.
