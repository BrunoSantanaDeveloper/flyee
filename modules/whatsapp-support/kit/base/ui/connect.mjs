// A tela "Conectar WhatsApp" sem framework: os passos, as transições e os textos fixos.
// A tela do projeto desenha cada passo com o design system dele e chama dispatch com os eventos.

export const UNOFFICIAL_RISK = [
  "A conexão sem a API oficial usa o WhatsApp Web, como um aparelho conectado.",
  "O WhatsApp não aprova esse uso e pode banir o número, principalmente com muitas mensagens ou mensagens para quem não salvou o contato.",
  "Não use esta opção em atividade regulada (saúde, jurídico, financeiro) nem num número que a empresa não pode perder.",
  "O celular do número precisa ficar ligado e com internet; aparelhos conectados saem sozinhos depois de um tempo sem uso do celular.",
];

export const OFFICIAL_FIELDS = [
  { name: "phoneNumber", label: "Número do WhatsApp", hint: "Com país e DDD, por exemplo +5511999990000." },
  { name: "phoneNumberId", label: "ID do número (Phone number ID)", hint: "No WhatsApp Manager da Meta, em Números de telefone." },
  { name: "businessAccountId", label: "ID da conta do WhatsApp Business (WABA ID)", hint: "No WhatsApp Manager da Meta, em Configurações da conta." },
  { name: "apiKey", label: "Token permanente", hint: "Token de um usuário do sistema com as permissões whatsapp_business_messaging e whatsapp_business_management.", secret: true },
];

export const initialConnectState = { step: "escolher", route: null, error: null, qrCode: null, status: null, metaWebhook: null, accepted: false };

/** Valida o formulário da rota oficial; devolve os problemas por campo. */
export function validateOfficial(values) {
  const problems = {};
  if (!/^\+\d{10,15}$/.test(String(values?.phoneNumber ?? "").replace(/\s+/g, ""))) problems.phoneNumber = "Use o formato +5511999990000.";
  if (!/^\d{6,30}$/.test(String(values?.phoneNumberId ?? ""))) problems.phoneNumberId = "O ID do número tem só dígitos.";
  if (!/^\d{6,30}$/.test(String(values?.businessAccountId ?? ""))) problems.businessAccountId = "O ID da conta tem só dígitos.";
  if (String(values?.apiKey ?? "").trim().length < 20) problems.apiKey = "Cole o token permanente completo.";
  return problems;
}

/**
 * Eventos: { type: "escolher_rota", route: "oficial" | "nao_oficial" }, { type: "aceitar_risco" },
 * { type: "enviar" }, { type: "conectou_oficial", metaWebhook }, { type: "criou_sessao" },
 * { type: "estado", status, qrCode }, { type: "erro", message }, { type: "voltar" }.
 */
export function connectReducer(state, event) {
  switch (event.type) {
    case "escolher_rota":
      return { ...initialConnectState, route: event.route, step: event.route === "oficial" ? "formulario_oficial" : "aviso_nao_oficial" };
    case "aceitar_risco":
      return state.route === "nao_oficial" ? { ...state, accepted: true, step: "pronto_para_criar" } : state;
    case "enviar":
      return { ...state, step: "conectando", error: null };
    case "conectou_oficial":
      return { ...state, step: "configurar_meta", metaWebhook: event.metaWebhook ?? null };
    case "criou_sessao":
      return { ...state, step: "aguardando_qr", error: null };
    case "estado": {
      if (event.status === "ready") return { ...state, step: "conectado", status: event.status, qrCode: null };
      if (event.status === "qr_ready") return { ...state, step: "mostrar_qr", status: event.status, qrCode: event.qrCode ?? state.qrCode };
      if (["failed", "action_required", "disconnected"].includes(event.status)) {
        return { ...state, step: "erro", status: event.status, error: "A sessão do WhatsApp parou. Gere um QR novo e leia de novo." };
      }
      return { ...state, status: event.status };
    }
    case "erro":
      return { ...state, step: "erro", error: event.message ?? "Não deu certo. Tente de novo em instantes." };
    case "voltar":
      return { ...initialConnectState };
    default:
      return state;
  }
}

/** De quanto em quanto tempo a tela pergunta o estado da sessão (o QR do WhatsApp muda a cada poucos segundos). */
export function pollingDelay(step) {
  if (step === "aguardando_qr" || step === "mostrar_qr") return 3000;
  return null;
}
