// Telefones do WhatsApp para casar o contato da conversa com o cadastro do projeto.
// A rota oficial manda o número em E.164 (+5511999990000); a não oficial guarda o identificador
// do WhatsApp (5511999990000@c.us, ou um @lid que não é telefone). Números de celular do Brasil
// podem chegar com ou sem o nono dígito, por isso as duas formas.

export function phoneDigits(value) {
  const text = String(value ?? "");
  if (/@lid$/i.test(text.trim())) return null;
  const digits = text.replace(/@.*$/, "").replace(/\D+/g, "");
  return digits.length >= 8 ? digits : null;
}

/** As formas com e sem o nono dígito de um celular brasileiro (55 + DDD + número). */
export function brPhoneVariants(value) {
  const digits = phoneDigits(value);
  if (!digits) return [];
  const variants = new Set([digits]);
  const match = /^55(\d{2})(\d{8,9})$/.exec(digits);
  if (match) {
    const [, ddd, number] = match;
    if (number.length === 9 && number.startsWith("9")) variants.add(`55${ddd}${number.slice(1)}`);
    if (number.length === 8 && /^[6-9]/.test(number)) variants.add(`55${ddd}9${number}`);
  }
  return [...variants];
}

/** O telefone do contato da conversa, venha ele do número ou do identificador do WhatsApp. */
export function contactPhone(contact) {
  return phoneDigits(contact?.phone_number) ?? phoneDigits(contact?.identifier);
}

export function samePhone(a, b) {
  const left = brPhoneVariants(a);
  const right = new Set(brPhoneVariants(b));
  return left.some((digits) => right.has(digits));
}
