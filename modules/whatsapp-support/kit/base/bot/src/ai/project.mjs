// O próprio projeto gera a resposta (rota generate), com a IA, as regras e os registros que ele já tem.
// Serve a projetos que exigem aprovação ou auditoria de toda resposta de IA. purpose diz o que se pede:
// "acao" (a próxima ação da conversa) ou "sugestoes" (perguntas e respostas tiradas de uma conversa resolvida).

import { systemText } from "../prompt.mjs";
import { AiError } from "./errors.mjs";

export async function generate({ project, ids, system, messages, schema, tools, purpose = "acao" }) {
  const result = await project.generate({
    purpose,
    account_id: ids.account,
    conversation_id: ids.conversation,
    system: systemText(system),
    messages,
    schema,
    tools: (tools ?? []).map((tool) => ({ name: tool.name, description: tool.description ?? "", input_schema: tool.input_schema ?? null })),
  });
  if (!result || typeof result !== "object") throw new AiError("ai_empty", "o projeto não devolveu a resposta");
  return { text: JSON.stringify(result), model: "project" };
}
