// As telas do robô leem e gravam aqui. ?escopo=plataforma: a camada do superadmin; ?escopo=cliente:
// a camada do cliente logado, só no que a plataforma liberou (o servidor descarta o resto).

import { readSettings, writeSettings } from "@/lib/atendimento";

export const dynamic = "force-dynamic";

const scopeOf = (request: Request) => (new URL(request.url).searchParams.get("escopo") === "plataforma" ? "plataforma" : "cliente");

export async function GET(request: Request) {
  const result = await readSettings(request, scopeOf(request));
  if (!result) return Response.json({ code: "forbidden", message: "Você não pode ver esta parte do robô." }, { status: 403 });
  return Response.json(result, { headers: { "cache-control": "no-store" } });
}

export async function PUT(request: Request) {
  const settings = await request.json().catch(() => null);
  const result = await writeSettings(request, scopeOf(request), settings);
  return Response.json(result.body, { status: result.status });
}
