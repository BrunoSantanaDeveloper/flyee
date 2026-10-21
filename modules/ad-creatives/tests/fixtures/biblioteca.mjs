// What the Ad Library collector returns (the fields the round zero read on 2026-10-12), with every
// page, text and number invented. One page has 12 ads, to see the 10 of D12; one ad has ended.

const DAY = 86400;
const now = new Date();
/** Today at noon UTC: the collection is dated the day it runs, and the ads are counted back from it. */
export const COLLECTED = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 12) / 1000;

function ad(page, index, { days, active = true, versions = 1, video = true, text } = {}) {
  const id = `${String(page.length).padStart(2, "0")}${String(index).padStart(3, "0")}9876543210`;
  return {
    ad_archive_id: id,
    page_name: page,
    page_id: `55${page.length}00011`,
    is_active: active,
    start_date: COLLECTED - days * DAY,
    end_date: active ? null : COLLECTED - (days - 20) * DAY,
    collation_count: versions,
    publisher_platform: ["FACEBOOK", "INSTAGRAM"],
    ad_library_url: `https://www.facebook.com/ads/library/?id=${id}`,
    snapshot: {
      body: { text: text ?? `${page}: anúncio ${index} para quem atende o dia inteiro.` },
      title: `${page} ${index}`,
      cta_text: "Saiba mais",
      link_url: "https://exemplo.com.br/oferta",
      display_format: video ? "VIDEO" : "IMAGE",
      videos: video ? [{ video_hd_url: `https://video.exemplo.com/${id}.mp4`, video_preview_image_url: `https://video.exemplo.com/${id}.jpg` }] : [],
      images: video ? [] : [{ original_image_url: `https://imagem.exemplo.com/${id}.jpg` }],
      cards: [],
    },
  };
}

/** The ads of the collector for the addresses of one run, in the order the Ad Library returns them. */
export function adsForUrls(urls) {
  const out = [];
  for (const { url } of urls) {
    const query = new URL(url).searchParams.get("q") ?? "";
    if (/norte/i.test(query)) for (let index = 1; index <= 12; index++) out.push(ad("Clínica Norte Digital", index, { days: 200 - index * 12, versions: index === 1 ? 3 : 1 }));
    else if (/agenda/i.test(query)) out.push(ad("Agenda Viva", 1, { days: 40 }), ad("Agenda Viva", 2, { days: 60, active: false }));
    else if (/acupunturistas/i.test(query)) out.push(ad("Escola Ponto Certo", 1, { days: 90, video: false, text: "Curso de formação para acupunturistas." }), ad("Clínica Norte Digital", 1, { days: 188, versions: 3 }));
  }
  return out;
}
