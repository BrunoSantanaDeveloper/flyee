// A tela "Conectar WhatsApp": GET devolve o estado (e o QR, na rota não oficial); POST conecta.

import { connectWhatsapp, whatsapp } from "@/lib/atendimento";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const result = await whatsapp(request);
    if (!result) return Response.json({ code: "forbidden", message: "Só quem administra o atendimento conecta o número." }, { status: 403 });
    return Response.json(result, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ code: "unavailable", message: "Não deu para ler o estado do WhatsApp agora." }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, string> | null;
  if (!body || !["oficial", "nao_oficial"].includes(body.route)) {
    return Response.json({ code: "route_missing", message: "Escolha a forma de conexão." }, { status: 400 });
  }
  try {
    const result = await connectWhatsapp(request, body);
    return Response.json(result.body, { status: result.status });
  } catch (error) {
    const code = (error as { code?: string }).code ?? "error";
    const fix = (error as { fix?: string }).fix;
    return Response.json({ code, message: fix ?? "Não deu para conectar agora. Confira os dados e tente de novo." }, { status: 502 });
  }
}
