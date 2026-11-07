// O botão "Atendimento" chama esta rota: cria a pessoa no Chatwoot se faltar, como atendente,
// e devolve o link de entrada já logado. O link vale 5 minutos e uma vez só: peça na hora de abrir.
// Só entra quem faz parte da equipe de atendimento (canEnterPanel); mostre o botão só para essas pessoas.

import { enterPanel } from "@/lib/atendimento";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const result = await enterPanel(request);
    if (!result.ok) {
      if (result.code === "unauthenticated") {
        return Response.json({ code: result.code, message: "Entre no sistema para abrir o atendimento." }, { status: 401 });
      }
      return Response.json({ code: result.code, message: "O atendimento é só para quem faz parte da equipe de atendimento." }, { status: 403 });
    }
    return Response.json({ url: result.url }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const code = (error as { code?: string }).code ?? "error";
    return Response.json({ code, message: "Não deu para abrir o atendimento agora. Tente de novo em instantes." }, { status: 502 });
  }
}
