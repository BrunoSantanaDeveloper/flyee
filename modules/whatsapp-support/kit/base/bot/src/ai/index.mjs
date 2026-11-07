import { generate as anthropic } from "./anthropic.mjs";
import { AiError } from "./errors.mjs";
import { generate as gemini } from "./gemini.mjs";
import { generate as openai } from "./openai.mjs";
import { generate as project } from "./project.mjs";

export const PROVIDERS = { anthropic, openai, gemini, project };

export function providerFor(name) {
  const generate = PROVIDERS[name];
  if (!generate) throw new AiError("ai_provider_unknown", `provedor de IA desconhecido: ${name}`);
  return generate;
}

export { AiError };
