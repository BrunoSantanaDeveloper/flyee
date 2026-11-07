// A tela "Robô de atendimento" lê e grava aqui as configurações do robô do cliente logado.

import { readSettings, writeSettings } from "@/lib/atendimento";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const result = await readSettings(request);
  if (!result) return Response.json({ code: "forbidden", message: "Só quem administra o atendimento vê o robô." }, { status: 403 });
  return Response.json(result, { headers: { "cache-control": "no-store" } });
}

export async function PUT(request: Request) {
  const settings = await request.json().catch(() => null);
  const result = await writeSettings(request, settings);
  return Response.json(result.body, { status: result.status });
}
