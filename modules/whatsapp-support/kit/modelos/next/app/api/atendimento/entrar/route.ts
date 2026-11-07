// O botão "Atendimento" chama esta rota: cria a pessoa no Chatwoot se faltar, como atendente,
// e devolve o link de entrada já logado. O link vale 5 minutos e uma vez só: peça na hora de abrir.

import { enterPanel } from "@/lib/atendimento";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const url = await enterPanel(request);
    if (!url) return Response.json({ code: "unauthenticated", message: "Entre no sistema para abrir o atendimento." }, { status: 401 });
    return Response.json({ url }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const code = (error as { code?: string }).code ?? "error";
    return Response.json({ code, message: "Não deu para abrir o atendimento agora. Tente de novo em instantes." }, { status: 502 });
  }
}
