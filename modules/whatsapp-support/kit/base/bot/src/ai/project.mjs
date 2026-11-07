// O próprio projeto gera a ação (rota generate), com a IA, as regras e os registros que ele já tem.
// Serve a projetos que exigem aprovação ou auditoria de toda resposta de IA.

import { AiError } from "./errors.mjs";

export async function generate({ project, ids, system, messages, schema, tools }) {
  const result = await project.generate({
    account_id: ids.account,
    conversation_id: ids.conversation,
    system,
    messages,
    schema,
    tools: (tools ?? []).map((tool) => ({ name: tool.name, description: tool.description ?? "", input_schema: tool.input_schema ?? null })),
  });
  if (!result || typeof result !== "object") throw new AiError("ai_empty", "o projeto não devolveu a ação");
  return { text: JSON.stringify(result), model: "project" };
}
