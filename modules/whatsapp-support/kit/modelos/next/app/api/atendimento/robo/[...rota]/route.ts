// As rotas que o robô chama: config, tools/<nome>, history, events, suggestions e, quando o projeto gera
// a resposta ou transcreve o áudio com a IA dele, generate e transcribe. Sem sessão do projeto: a assinatura
// HMAC com SUPPORT_BOT_SECRET é a autenticação. PROJECT_URL do robô aponta para .../api/atendimento/robo.

import { botHandler } from "@/lib/atendimento";

export const dynamic = "force-dynamic";

async function answer(request: Request, params: Promise<{ rota: string[] }>) {
  const { rota } = await params;
  const url = new URL(request.url);
  const result = await botHandler({
    method: request.method,
    pathWithQuery: `${url.pathname}${url.search}`,
    route: rota.join("/"),
    query: Object.fromEntries(url.searchParams),
    rawBody: request.method === "POST" ? await request.text() : "",
    headers: request.headers,
  });
  return Response.json(result.body, { status: result.status });
}

export async function GET(request: Request, context: { params: Promise<{ rota: string[] }> }) {
  return answer(request, context.params);
}

export async function POST(request: Request, context: { params: Promise<{ rota: string[] }> }) {
  return answer(request, context.params);
}
