// As sugestões de conhecimento que esperam aprovação, da camada que a pessoa revisa.

import { listSuggestionsFor } from "@/lib/atendimento";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const scope = new URL(request.url).searchParams.get("escopo") === "plataforma" ? "plataforma" : "cliente";
  const result = await listSuggestionsFor(request, scope);
  if (!result) return Response.json({ code: "forbidden", message: "Você não revisa estas sugestões." }, { status: 403 });
  return Response.json(result, { headers: { "cache-control": "no-store" } });
}
