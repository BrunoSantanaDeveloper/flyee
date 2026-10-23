// Deliverability of the sending domain: SPF, DMARC and DKIM read from public DNS with no key,
// each item with a status (ok, missing, attention, unknown) and the fix; the one-click
// unsubscribe and the health thresholds the member confirms from the tool's reports.

import { promises as dns } from "node:dns";

export const THRESHOLDS = { hard_bounce_pct_max: 1, complaint_pct_max: 0.1, unsubscribe_pct_max: 0.3 };

/** Resolves TXT records; a missing name is [] and a DNS failure is null (unknown). */
export async function txtOf(name, resolver = dns) {
  try {
    const records = await resolver.resolveTxt(name);
    return records.map((chunks) => chunks.join(""));
  } catch (error) {
    if (error && ["ENOTFOUND", "ENODATA", "NXDOMAIN"].includes(error.code)) return [];
    return null;
  }
}

function parseDmarc(record) {
  const tags = Object.fromEntries(record.split(";").map((part) => part.trim()).filter(Boolean).map((part) => part.split("=").map((piece) => piece.trim())));
  return { policy: tags.p ?? null, subdomain_policy: tags.sp ?? null, reports: tags.rua ?? null, alignment: { dkim: tags.adkim ?? "r", spf: tags.aspf ?? "r" }, pct: tags.pct ?? "100" };
}

/**
 * Checks a domain. `dkimSelector` is the selector the e-mail tool gave (without `._domainkey`).
 * `resolver` is injectable for tests. Returns { domain, items, overall, say }.
 */
export async function checkDomain(domain, { dkimSelector = null, resolver = dns } = {}) {
  const clean = String(domain ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const items = [];
  const push = (id, status, text, fix = null, evidence = null) => items.push({ id, status, text, fix, evidence });

  const root = await txtOf(clean, resolver);
  if (root === null) push("spf", "unknown", "Não consegui consultar o DNS do domínio agora.", "Tente de novo em alguns minutos, ou confira no painel do seu provedor de e-mail.");
  else {
    const spf = root.filter((record) => /^v=spf1/i.test(record));
    if (!spf.length) push("spf", "missing", "O domínio não tem registro SPF: os provedores não sabem quem pode enviar em nome dele.", "Peça a quem cuida do DNS para criar o TXT que a sua ferramenta de e-mail indica (v=spf1 include:<ferramenta> ~all).", { records: root.length });
    else if (spf.length > 1) push("spf", "attention", `Há ${spf.length} registros SPF; a regra pede um só, e dois anulam os dois.`, "Junte os includes num único registro v=spf1.", { records: spf });
    else push("spf", /\ball\b/.test(spf[0]) ? "ok" : "attention", /\ball\b/.test(spf[0]) ? "SPF presente." : "SPF presente, mas sem o fim (~all ou -all).", /\ball\b/.test(spf[0]) ? null : "Acrescente ~all ao fim do registro.", { record: spf[0], includes: (spf[0].match(/include:[^\s]+/g) ?? []).map((part) => part.replace("include:", "")) });
  }

  const dmarc = await txtOf(`_dmarc.${clean}`, resolver);
  if (dmarc === null) push("dmarc", "unknown", "Não consegui consultar o DMARC agora.", "Tente de novo em alguns minutos.");
  else {
    const record = dmarc.find((entry) => /^v=DMARC1/i.test(entry));
    if (!record) push("dmarc", "missing", "O domínio não tem DMARC: o Gmail e o Outlook exigem um registro, ao menos com p=none, para quem envia em volume.", `Crie o TXT _dmarc.${clean} com v=DMARC1; p=none; rua=mailto:dmarc@${clean} e, depois de duas semanas de relatórios limpos, suba para p=quarantine.`);
    else {
      const parsed = parseDmarc(record);
      push("dmarc", parsed.policy ? "ok" : "attention", `DMARC presente, política ${parsed.policy ?? "não informada"}${parsed.reports ? ", com relatórios" : ", sem relatórios"}.`, parsed.reports ? null : "Acrescente rua=mailto:<endereço> para receber os relatórios.", { record, ...parsed });
    }
  }

  if (!dkimSelector) push("dkim", "unknown", "Sem o seletor DKIM da sua ferramenta de e-mail, não dá para consultar a assinatura.", "A ferramenta mostra o seletor na tela de autenticação do domínio (algo como k1, s1, mail); passe com --dkim <seletor>.");
  else {
    const dkim = await txtOf(`${dkimSelector}._domainkey.${clean}`, resolver);
    if (dkim === null) push("dkim", "unknown", "Não consegui consultar o DKIM agora.", "Tente de novo em alguns minutos.");
    else {
      const record = dkim.find((entry) => /v=DKIM1|k=rsa|p=/i.test(entry));
      if (!record) push("dkim", "missing", `Não há chave DKIM em ${dkimSelector}._domainkey.${clean}.`, "Crie o TXT com a chave pública que a ferramenta de e-mail mostra; sem DKIM alinhado o DMARC não passa.", { selector: dkimSelector });
      else push("dkim", /p=\s*;|p=$/.test(record.replace(/\s/g, "")) ? "attention" : "ok", /p=\s*;|p=$/.test(record.replace(/\s/g, "")) ? "A chave DKIM está publicada vazia (revogada)." : "DKIM presente no seletor informado.", null, { selector: dkimSelector, record: record.slice(0, 80) });
    }
  }

  push("unsubscribe_one_click", "unknown", "O descadastro em um clique (o cabeçalho List-Unsubscribe) só aparece numa mensagem real enviada pela ferramenta.", "Mande uma campanha de teste para você e mostre os cabeçalhos (no Gmail, 'Mostrar original'): a linha List-Unsubscribe precisa estar lá.");
  push("legal_footer", "unknown", "O rodapé legal (quem escreve, de onde veio o contato, como sair) é conferido na mensagem.", "Confira na mensagem de teste.");
  push("complaint_rate", "unknown", `Reclamações abaixo de ${THRESHOLDS.complaint_pct_max}% por envio; o número vem do painel da ferramenta ou do Postmaster do Google.`, "Traga o relatório do último envio.");
  push("hard_bounce_rate", "unknown", `Rejeição dura abaixo de ${THRESHOLDS.hard_bounce_pct_max}% por envio.`, "Traga o relatório do último envio.");
  push("unsubscribe_rate", "unknown", `Descadastro abaixo de ${THRESHOLDS.unsubscribe_pct_max}% por envio.`, "Traga o relatório do último envio.");

  const blockers = items.filter((item) => item.status === "missing");
  const overall = blockers.length ? "bloqueado" : items.some((item) => item.status === "attention") ? "atencao" : "ok";
  const say = blockers.length ? `${blockers.length} item(ns) faltam no domínio ${clean}: ${blockers.map((item) => item.id.toUpperCase()).join(", ")}. Nada de envio em volume antes de corrigir.` : `Autenticação do domínio ${clean} sem falta no DNS${items.some((item) => item.status === "attention") ? ", com um ponto de atenção" : ""}; o que depende de uma mensagem real e dos relatórios fica para conferir com o integrante.`;
  return { domain: clean, dkim_selector: dkimSelector, items, overall, thresholds: THRESHOLDS, batches: batchPlan(), say };
}

/** Growing batches for a dormant list or a new domain: start with the engaged, double while clean. */
export function batchPlan() {
  return {
    rule: "comece pelos mais engajados (uso nos últimos 30 dias); dobre o lote a cada envio enquanto rejeição, reclamação e descadastro ficarem abaixo dos limiares; uma lista parada há 6 meses começa pela repermissão, nunca por uma promoção",
    steps: [
      { day: 1, share: "os engajados dos últimos 30 dias" },
      { day: 3, share: "o dobro, com os engajados dos últimos 90 dias" },
      { day: 6, share: "o dobro, com quem respondeu à repermissão" },
      { day: 9, share: "o resto que pode receber" },
    ],
    stop_when: "reclamação acima de 0,1% ou rejeição acima de 1%: volta ao lote anterior por uma semana",
  };
}
