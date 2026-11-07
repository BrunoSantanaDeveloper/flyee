// Aprovar (com as edições da pessoa) ou descartar uma sugestão de conhecimento.

import { decideSuggestion } from "@/lib/atendimento";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = ((await request.json().catch(() => null)) ?? {}) as { decisao?: string; q?: string; a?: string };
  if (!["aprovar", "descartar"].includes(String(body.decisao))) {
    return Response.json({ code: "decision_missing", message: "Escolha aprovar ou descartar." }, { status: 400 });
  }
  const result = await decideSuggestion(request, id, body);
  return Response.json(result.body, { status: result.status });
}
