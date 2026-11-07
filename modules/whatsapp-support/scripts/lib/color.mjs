// Cores em OKLCH para gerar a escala de 12 tons do painel a partir da cor principal do projeto,
// com o mesmo desenho de claridade da escala azul do Chatwoot 4.19.1 (_next-colors.scss).

/** A escala azul do Chatwoot 4.19.1, em "r g b", modo claro e modo escuro. */
export const CHATWOOT_BLUE = {
  light: ["251 253 255", "245 249 255", "233 243 255", "218 236 255", "201 226 255", "181 213 255", "155 195 252", "117 171 247", "39 129 246", "16 115 233", "8 109 224", "11 50 101"],
  dark: ["10 17 28", "15 24 38", "15 39 72", "10 49 99", "18 61 117", "29 84 134", "40 89 156", "48 106 186", "39 129 246", "21 116 231", "126 182 255", "205 227 255"],
};

export function parseHex(hex) {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex ?? "").trim());
  if (!match) return null;
  const value = match[1].length === 3 ? match[1].replace(/./g, (c) => c + c) : match[1];
  return [0, 2, 4].map((index) => Number.parseInt(value.slice(index, index + 2), 16));
}

export function rgbText(rgb) {
  return rgb.map((channel) => Math.round(channel)).join(" ");
}

function toLinear(channel) {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function fromLinear(value) {
  const c = value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055;
  return c * 255;
}

export function rgbToOklch([r, g, b]) {
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { l: L, c: Math.sqrt(a * a + bb * bb), h: (Math.atan2(bb, a) * 180) / Math.PI };
}

function oklchToLinear({ l, c, h }) {
  const radians = (h * Math.PI) / 180;
  const a = c * Math.cos(radians);
  const b = c * Math.sin(radians);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}

const inGamut = (linear) => linear.every((value) => value >= -1e-4 && value <= 1 + 1e-4);

/** OKLCH para sRGB, baixando o croma até caber no sRGB (mantém claridade e matiz). */
export function oklchToRgb(color) {
  let { c } = color;
  let linear = oklchToLinear({ ...color, c });
  if (!inGamut(linear)) {
    let low = 0;
    let high = c;
    for (let step = 0; step < 24; step++) {
      const mid = (low + high) / 2;
      if (inGamut(oklchToLinear({ ...color, c: mid }))) low = mid;
      else high = mid;
    }
    c = low;
    linear = oklchToLinear({ ...color, c });
  }
  return linear.map((value) => Math.min(255, Math.max(0, fromLinear(Math.min(1, Math.max(0, value))))));
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * 12 tons com a cor principal no tom 9. Os tons claros e escuros seguem a claridade da escala do
 * Chatwoot; os tons 10 e 11 ficam relativos à cor principal, para continuarem mais fortes que ela.
 */
export function buildScale(primaryRgb, mode = "light") {
  const reference = CHATWOOT_BLUE[mode].map((text) => rgbToOklch(text.split(" ").map(Number)));
  const target = rgbToOklch(primaryRgb);
  const ref9 = reference[8];
  const chromaRatio = ref9.c > 0 ? target.c / ref9.c : 1;
  return reference.map((step, index) => {
    if (index === 8) return rgbText(primaryRgb);
    const relative = index === 9 || index === 10;
    const lightness = relative ? clamp(target.l + (step.l - ref9.l), 0.05, 0.98) : step.l;
    const chroma = clamp(step.c * chromaRatio, 0, 0.37);
    return rgbText(oklchToRgb({ l: lightness, c: chroma, h: target.h }));
  });
}
