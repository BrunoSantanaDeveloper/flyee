// O relatório das lacunas: o que o robô passou para a equipe, agrupado por assunto.

import { gapsFor } from "@/lib/atendimento";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const scope = params.get("escopo") === "plataforma" ? "plataforma" : "cliente";
  const days = Math.min(Math.max(Number(params.get("dias")) || 30, 1), 365);
  const result = await gapsFor(request, scope, days);
  if (!result) return Response.json({ code: "forbidden", message: "Você não vê este relatório." }, { status: 403 });
  return Response.json(result, { headers: { "cache-control": "no-store" } });
}
