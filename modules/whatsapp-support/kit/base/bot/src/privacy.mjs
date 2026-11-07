// Tira dado pessoal dos trechos que saem do Chatwoot para o sistema (relatório de lacunas e sugestões
// de conhecimento): e-mail, telefone, CPF, CNPJ, número de processo no padrão do CNJ e número de cartão.
// É uma rede de segurança; quem aprova a sugestão ainda lê antes.

const PATTERNS = [
  /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu,
  /\b\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4}\b/g,
  /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g,
  /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g,
  /\b(?:\d[ .]?){13,19}\b/g,
  /(?:\+?\d{1,3}[\s.]?)?\(?\d{2}\)?[\s.]?\d{4,5}[\s.-]?\d{4}\b/g,
];

export const REMOVED = "[dado removido]";

export function scrub(text, limit = 300) {
  let clean = String(text ?? "");
  for (const pattern of PATTERNS) clean = clean.replace(pattern, REMOVED);
  clean = clean.replace(/\s+/g, " ").trim();
  return clean.length > limit ? `${clean.slice(0, limit)}...` : clean;
}
