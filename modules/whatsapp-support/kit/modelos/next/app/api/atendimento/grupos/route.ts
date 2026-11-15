// A tela "Grupos da equipe": GET lista os grupos e quem pode entrar neles; POST cria ou muda um grupo
// (sem chave, cria); DELETE ?chave= arquiva, tirando todos do grupo e guardando o histórico.

import { archiveTeamGroupFor, saveTeamGroupFor, teamGroups } from "@/lib/atendimento";

export const dynamic = "force-dynamic";

function failure(error: unknown, fallback: string) {
  const code = (error as { code?: string }).code ?? "error";
  const fix = (error as { fix?: string }).fix;
  const message = (error as { message?: string }).message;
  // ProvisionError traz a frase e a correção para a tela; o resto vira uma frase genérica.
  const known = code.startsWith("team_group_");
  return Response.json({ code, message: known ? `${message} ${fix ?? ""}`.trim() : fallback }, { status: known ? 422 : 502 });
}

export async function GET(request: Request) {
  try {
    const result = await teamGroups(request);
    if (!result) return Response.json({ code: "forbidden", message: "Só quem administra o atendimento cuida dos grupos da equipe." }, { status: 403 });
    return Response.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return failure(error, "Não deu para ler os grupos agora.");
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { chave?: string; nome?: string; membros?: string[]; etiquetas?: string[] } | null;
  if (!body) return Response.json({ code: "body_missing", message: "Faltam os dados do grupo." }, { status: 400 });
  try {
    const result = await saveTeamGroupFor(request, body);
    return Response.json(result.body, { status: result.status });
  } catch (error) {
    return failure(error, "Não deu para salvar o grupo agora. Tente de novo em instantes.");
  }
}

export async function DELETE(request: Request) {
  const chave = new URL(request.url).searchParams.get("chave") ?? "";
  try {
    const result = await archiveTeamGroupFor(request, chave);
    return Response.json(result.body, { status: result.status });
  } catch (error) {
    return failure(error, "Não deu para arquivar o grupo agora.");
  }
}
