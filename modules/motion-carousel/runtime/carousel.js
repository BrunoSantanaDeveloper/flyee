/*
 * Carrossel animado · biblioteca dos slides (carousel.js)
 * Carregue depois de motion.js. Monta, em cima de Motion, os elementos de um slide de carrossel:
 * título, texto, rótulo, cartão, forma, contador, gráfico de barras, régua de compassos, bola com
 * squash & stretch, pílulas de progresso, botão de chamada, dica de deslizar, pulso de fundo, grão e,
 * para slides com fotos, imagens em camadas com paralaxe e o degradê que deixa o texto legível por cima.
 *
 * Tudo é função pura do tempo: sem timers, sem requestAnimationFrame, sem Math.random, sem estado
 * entre quadros (só os caches de medidas de texto e do grão). Os tempos dos elementos são em
 * BATIDAS contadas do início do slide: `at` (entra), `out` (sai), `back` (volta), `inBeats`, `perLine`.
 *
 * Uso mínimo:
 *   const C = Carousel.setup({ bars: 3, bpm: 120, format: "4:5", theme: "noir", seed: 7, title: "01 · gancho" });
 *   window.seek = (t) => { C.begin(t); C.headline("Olá", { y: 0.3 }); return C.end(); };
 *
 * Regras que a biblioteca garante:
 *   - Elemento com `at: 0` (padrão) está assentado no quadro 0: nenhuma entrada toca em t = 0.
 *   - Elemento com `at: 0` que sai em `out` e volta em `back` está no mesmo estado assentado em t = 0 e em t → T,
 *     então o loop fecha sem salto e o quadro 0 é um design terminado (a capa do slide).
 *   - Elemento com `at > 0` entra com o estilo `in`, fica e sai em `out`; sem `out`, sai sozinho na última
 *     meia batida do slide, porque não existe no quadro 0 e o loop precisa fechar.
 * Posições: números de 0 a 1 são frações de largura/altura; acima de 1 são pixels. `maxWidth` idem.
 */
(function (global) {
  "use strict";

  const M = global.Motion;
  if (!M) throw new Error("carousel.js precisa de motion.js carregado antes dele.");

  const VERSION = 2;
  const clamp = M.clamp;
  const lerp = M.lerp;

  /** Tamanhos dos formatos aceitos (px). */
  const FORMATS = {
    "4:5": { width: 1080, height: 1350 },
    "3:4": { width: 1080, height: 1440 },
    "1:1": { width: 1080, height: 1080 },
    "9:16": { width: 1080, height: 1920 },
  };

  /** Temas: uma cor-herói (bg) e um acento; `grain` liga o grão. Todas em hexadecimal. */
  const THEMES = {
    noir: { bg: "#0C0C0E", ink: "#F3F1EA", muted: "#8A8781", accent: "#E6C15A", grain: true },
    cobalt: { bg: "#0A3DD6", ink: "#FFFFFF", muted: "#9DB6FF", accent: "#FF7A1A" },
    paper: { bg: "#F4F1EA", ink: "#141413", muted: "#8E8A80", accent: "#D97757" },
    forest: { bg: "#0F2A1E", ink: "#ECF3E8", muted: "#7FA18E", accent: "#C7F25E" },
    mono: { bg: "#111111", ink: "#FAFAFA", muted: "#777777", accent: "#FFFFFF" },
  };

  const FAMILY = '"Inter", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  const FONTS = { display: { family: FAMILY, weight: 800 }, text: { family: FAMILY, weight: 500 } };

  /** Margem do carrossel e os dois cantos que o Instagram cobre (contador "1/N" e botão de som), a 1080 px de largura. */
  const MARGIN = 72;
  const CORNERS = { counter: { w: 170, h: 80 }, sound: { w: 100, h: 100 } };

  /** Tempo (s) em que cada mola de Motion assenta a 1%: a entrada é comprimida para assentar exatamente no fim de `inBeats`. */
  const SETTLE = { snappy: 0.24, default: 0.51, type: 0.61, heavy: 0.7, playful: 0.62 };

  /** Padrões dos três tipos de texto. */
  const TEXT = {
    headline: { size: 120, lineHeight: 1.0, font: "display", weight: 800, tracking: -0.025, color: "ink", spring: "heavy", in: "rise" },
    body: { size: 52, lineHeight: 1.25, font: "text", weight: 500, tracking: 0, color: "ink", spring: "type", in: "rise" },
    label: { size: 36, lineHeight: 1.2, font: "display", weight: 700, tracking: 0.14, color: "muted", spring: "snappy", in: "rise", uppercase: true },
  };

  // ---------------------------------------------------------------------------------------------
  // Cores
  // ---------------------------------------------------------------------------------------------

  function parseHex(hex) {
    const h = String(hex).trim().replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
    const n = parseInt(full, 16);
    if (!Number.isFinite(n)) return null;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  /** "#E6C15A" com transparência → "rgba(230,193,90,0.3)". Cores que não são hexadecimais voltam como vieram. */
  function rgba(color, alpha) {
    const c = parseHex(color);
    if (!c) return color;
    return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + clamp(alpha) + ")";
  }

  /** Mistura duas cores hexadecimais (t = 0 → a, t = 1 → b). */
  function mix(a, b, t) {
    const A = parseHex(a);
    const B = parseHex(b);
    if (!A || !B) return a;
    return "#" + A.map((v, i) => Math.round(lerp(v, B[i], t)).toString(16).padStart(2, "0")).join("");
  }

  function luminance(color) {
    const c = parseHex(color);
    return c ? (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255 : 0;
  }

  /** O tema resolvido: chave de THEMES ou objeto { bg, ink, muted, accent, accent2?, grain? }, com as cores derivadas. */
  function resolveTheme(theme) {
    const base = typeof theme === "string" ? THEMES[theme] : theme;
    if (!base || !base.bg || !base.ink) throw new Error("Tema desconhecido: " + theme + ". Use " + Object.keys(THEMES).join(", ") + " ou { bg, ink, muted, accent }.");
    const t = Object.assign({ muted: mix(base.ink, base.bg, 0.5), accent: base.ink, grain: false }, base);
    t.name = typeof theme === "string" ? theme : "custom";
    t.accent2 = t.accent2 || t.accent;
    t.light = luminance(t.bg) > 0.5;
    t.surface = t.surface || mix(t.bg, t.ink, t.light ? 0.06 : 0.08);
    t.line = t.line || rgba(t.ink, 0.18);
    return t;
  }

  // ---------------------------------------------------------------------------------------------
  // Geometria e tempo
  // ---------------------------------------------------------------------------------------------

  /** Área segura do carrossel: margem de 72 px e os dois cantos do Instagram, em escala; no 9:16, também as margens dos Reels. */
  function safeRect(width, height, format) {
    const k = width / 1080;
    const margin = Math.round(MARGIN * k);
    const counter = { x: width - CORNERS.counter.w * k, y: 0, w: CORNERS.counter.w * k, h: CORNERS.counter.h * k };
    const sound = { x: width - CORNERS.sound.w * k, y: height - CORNERS.sound.h * k, w: CORNERS.sound.w * k, h: CORNERS.sound.h * k };
    let top = margin;
    let bottom = height - margin;
    let left = margin;
    let right = width - margin;
    if (format === "9:16" && M.SAFE["9:16"]) {
      const s = M.SAFE["9:16"];
      top = Math.max(top, s.top * k);
      bottom = Math.min(bottom, height - s.bottom * k);
      left = Math.max(left, s.left * k);
      right = Math.min(right, width - s.right * k);
    }
    top = Math.max(top, counter.y + counter.h);
    bottom = Math.min(bottom, sound.y);
    return { x: left, y: top, w: right - left, h: bottom - top, margin, corners: { counter, sound } };
  }

  /** Progresso 0→1 de uma entrada: x = fração do tempo de entrada. A mola é comprimida para assentar exatamente em 1. */
  function entrance(x, preset, linear) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    if (linear) return x;
    const settle = SETTLE[preset] || SETTLE.default;
    return M.springBy(preset, x * settle) / M.springBy(preset, settle);
  }

  /** Duração padrão de uma entrada, em batidas. */
  function defaultInBeats(style, text) {
    if (style === "slam") return 0.5;
    if (style === "type") return Math.max(0.5, 0.1 * String(text || "").length);
    if (style === "none") return 0.0001;
    return 1;
  }

  /** Quebra um número no padrão brasileiro: 1234.5 → "1.234,5". */
  function formatNumber(value, decimals) {
    const d = Math.max(0, decimals | 0);
    const fixed = Math.abs(value).toFixed(d);
    const parts = fixed.split(".");
    const int = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return (value < 0 ? "-" : "") + int + (d ? "," + parts[1] : "");
  }

  /** Pulos de uma bola: segmentos com duração relativa `hops` (número ou lista); alturas proporcionais ao quadrado da duração. */
  function hopProfile(hops) {
    const list = Array.isArray(hops) && hops.length ? hops.slice() : (() => {
      const n = Math.max(1, hops | 0 || 3);
      const out = [];
      for (let i = 0; i < n; i++) out.push(Math.pow(0.6, i));
      return out;
    })();
    const total = list.reduce((a, b) => a + b, 0);
    const first = list[0];
    let start = 0;
    return list.map((d) => {
      const seg = { start, end: start + d / total, height: (d / first) * (d / first) };
      start = seg.end;
      return seg;
    });
  }

  /** Altura (0→1 do primeiro pulo), fase local 0→1 e índice do segmento de um pulo em p ∈ [0, 1]. */
  function hopAt(profile, p) {
    const x = clamp(p);
    for (let i = 0; i < profile.length; i++) {
      const seg = profile[i];
      if (x <= seg.end || i === profile.length - 1) {
        const s = clamp((x - seg.start) / Math.max(1e-9, seg.end - seg.start));
        return { height: seg.height * 4 * s * (1 - s), s, index: i, count: profile.length };
      }
    }
    return { height: 0, s: 1, index: profile.length - 1, count: profile.length };
  }

  // ---------------------------------------------------------------------------------------------
  // setup
  // ---------------------------------------------------------------------------------------------

  function setup(options) {
    const o = options || {};
    const doc = global.document;
    const bpm = Number(o.bpm) || 120;
    const beatsPerBar = Number(o.beatsPerBar) || 4;
    const barCount = Number(o.bars) || 3;
    const fps = Number(o.fps) || 30;
    const formatName = o.format || "4:5";
    const size = FORMATS[formatName] || FORMATS["4:5"];
    const theme = resolveTheme(o.theme || "noir");
    const seed = Number(o.seed) || 1;
    const beatS = 60 / bpm;
    const totalBeats = barCount * beatsPerBar;
    const T = totalBeats * beatS;

    let canvas = o.canvas || (doc && (doc.getElementById("c") || doc.querySelector("canvas")));
    if (!canvas && doc) {
      canvas = doc.createElement("canvas");
      doc.body.appendChild(canvas);
    }
    if (!canvas) throw new Error("A página precisa de um <canvas> (id \"c\").");
    canvas.width = size.width;
    canvas.height = size.height;
    const g = canvas.getContext("2d");
    const hasLetterSpacing = typeof g.letterSpacing === "string";

    const film = M.setup({ title: o.title || "slide", duration: T, width: size.width, height: size.height, fps, background: theme.bg });
    const grid = M.beatGrid(bpm, 0, beatsPerBar);
    const rand = M.rng(seed);
    const noise = M.noise1d(seed);

    const state = { t: 0, b: 0, boxes: [], lastSeekT: null, layoutCache: new Map(), grainTile: null, grainPattern: null, images: new Map() };

    const C = {
      version: VERSION,
      canvas, g, film, grid, theme, fonts: { display: FONTS.display.family, text: FONTS.text.family, family: FAMILY, displayWeight: FONTS.display.weight, textWeight: FONTS.text.weight },
      bpm, beatsPerBar, bars: barCount, fps, seed, totalBeats, beatS, T,
      format: formatName,
      W: size.width, H: size.height,
      safe: safeRect(size.width, size.height, formatName),
      rng: rand, noise,
      images: {},
      t: 0, b: 0,
    };

    /** Troca o formato (o Motor chama antes do primeiro quadro): recompõe tamanho e área segura. */
    function setFormat(f) {
      const name = (f && f.name) || formatName;
      const width = Number(f && f.width) || (FORMATS[name] || size).width;
      const height = Number(f && f.height) || (FORMATS[name] || size).height;
      canvas.width = width;
      canvas.height = height;
      film.width = width;
      film.height = height;
      C.W = width;
      C.H = height;
      C.format = name;
      C.safe = safeRect(width, height, name);
      state.layoutCache.clear();
      state.grainPattern = null;
    }

    const dimX = (v, fallback) => (v === undefined || v === null ? fallback : Math.abs(v) <= 1 ? v * C.W : v);
    const dimY = (v, fallback) => (v === undefined || v === null ? fallback : Math.abs(v) <= 1 ? v * C.H : v);
    const point = (p) => ({ x: dimX(p[0], 0), y: dimY(p[1], 0) });
    const themeColor = (c, fallback) => (c === undefined || c === null ? fallback : THEME_KEYS.includes(c) ? theme[c] : c);
    const THEME_KEYS = ["bg", "ink", "muted", "accent", "accent2", "surface"];

    // ----- tempo e ciclo de vida -----

    const beat = (n) => n * beatS;
    const bar = (n, b) => (n * beatsPerBar + (b || 0)) * beatS;

    /** Pulso que decai a partir de cada batida (1 na batida). */
    function beatPulse(decay) {
      const phase = ((state.b % 1) + 1) % 1;
      return Math.exp(-phase * (decay || 6));
    }

    /** Pulso que decai a partir de cada cabeça de compasso (1 no tempo forte). */
    function downbeat(decay) {
      const phase = ((state.b % beatsPerBar) + beatsPerBar) % beatsPerBar;
      return Math.exp(-phase * (decay || 5));
    }

    /**
     * Respiração simétrica em volta de cada cabeça de compasso: sobe nos quadros antes do tempo forte, 1 nele,
     * desce depois (sigma em batidas). Como o último quadro do slide já está quase no pico, o loop fecha sem salto.
     */
    function downbeatBump(sigma) {
      const phase = ((state.b % beatsPerBar) + beatsPerBar) % beatsPerBar;
      const distance = Math.min(phase, beatsPerBar - phase);
      const s = sigma || 0.14;
      return Math.exp(-(distance * distance) / (s * s));
    }

    /**
     * Estado de um elemento no instante atual: visível?, progresso de entrada p (0→1) e de saída q (0→1).
     * `at` 0 = assentado desde o quadro 0; `out` = sai; `back` = volta com o estilo `in`.
     * Um elemento com `at > 0` e sem `out` sai sozinho no fim do slide (o tempo de saída antes do último
     * quadro): ele não existe no quadro 0, então precisa ter sumido quando o loop recomeça.
     */
    function life(o, inBeats, outBeats, preset, linear) {
      const b = state.b;
      const at = Number(o.at) || 0;
      const hasOut = o.out !== undefined && o.out !== null;
      const inB = Math.max(1e-4, inBeats);
      const outB = Math.max(1e-4, outBeats);
      const out = hasOut ? Number(o.out) : at > 0 ? Math.max(at, totalBeats - outB) : Infinity;
      const hasBack = o.back !== undefined && o.back !== null;
      const back = hasBack ? Number(o.back) : Infinity;
      let visible = true;
      let p = 1;
      let q = 0;
      if (b < out) {
        if (b < at) visible = false;
        else if (at > 0) p = entrance((b - at) / inB, preset, linear);
      } else if (b < out + outB) {
        q = (b - out) / outB;
      } else if (!hasBack || b < back) {
        visible = false;
      } else {
        const room = totalBeats - back;
        const dur = room > 0 ? Math.min(inB, room) : inB;
        p = entrance((b - back) / dur, preset, linear);
      }
      return { visible, p, q, settled: visible && p >= 1 && q === 0 };
    }

    /** Transformação de um estilo de entrada/saída: alpha, deslocamento, escala, recorte (wipe) e letras (type). */
    function pose(style, p, q, outStyle, unit) {
      let alpha = 1;
      let dx = 0;
      let dy = 0;
      let scale = 1;
      let wipe = null;
      let chars = null;
      if (p < 1) {
        switch (style) {
          case "rise": dy = (1 - p) * unit; alpha = clamp(p * 1.6); break;
          case "drop": dy = -(1 - p) * unit; alpha = clamp(p * 1.6); break;
          case "pop": scale = 0.6 + 0.4 * p; alpha = clamp(p * 1.8); break;
          case "slam": scale = 1 + 0.35 * (1 - p); alpha = clamp(p * 3); break;
          case "wipe": wipe = p; break;
          case "type": chars = p; break;
          case "grow": scale = p; break;
          case "draw": wipe = p; break;
          case "fade": alpha = p; break;
          default: break;
        }
      }
      if (q > 0) {
        const e = M.ease.inQuad(q);
        const fade = 1 - M.ease.outQuad(q);
        switch (outStyle) {
          case "rise": dy -= e * unit * 1.5; alpha *= fade; break;
          case "drop": dy += e * unit * 1.5; alpha *= fade; break;
          case "shrink": scale *= 1 - 0.3 * e; alpha *= fade; break;
          case "grow": scale *= 1 + 0.4 * e; alpha *= fade; break;
          case "none": alpha = q > 0 ? 0 : alpha; break;
          case "fade":
          default: dy += e * unit * 0.35; alpha *= fade; break;
        }
      }
      return { alpha: clamp(alpha), dx, dy, scale, wipe, chars };
    }

    // ----- quadro -----

    /** Começa o quadro do instante t: fecha o loop, pinta o fundo (e o grão do tema) e zera as caixas. */
    function begin(t) {
      const tl = M.loopT(Number(t) || 0, T);
      state.t = tl;
      state.b = tl / beatS;
      state.lastSeekT = Number(t) || 0;
      state.boxes = [];
      C.t = tl;
      C.b = state.b;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
      g.shadowColor = "rgba(0,0,0,0)";
      g.shadowBlur = 0;
      g.fillStyle = theme.bg;
      g.fillRect(0, 0, C.W, C.H);
      if (theme.grain) grain();
      return tl;
    }

    /** Fecha o quadro. Devolva o resultado em window.seek. */
    function end() {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = 1;
      if (hasLetterSpacing) g.letterSpacing = "0px";
      return true;
    }

    function register(role, x, y, w, h, size, text) {
      if (!(w > 0) || !(h > 0)) return;
      const box = { role, x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), size: size ? Math.round(size) : null };
      if (text !== undefined) box.text = String(text).slice(0, 80);
      state.boxes.push(box);
    }

    /** As caixas (texto, ui) desenhadas no último seek; com t diferente, redesenha antes. */
    function boxes(t) {
      const stale = state.lastSeekT === null || Math.abs(Number(t) - state.lastSeekT) > 1e-6;
      if (t !== undefined && t !== null && stale && typeof global.seek === "function") global.seek(Number(t));
      return state.boxes.slice();
    }

    // ----- fundo -----

    function makeGrainTile() {
      const doc = global.document;
      if (!doc || !doc.createElement) return null;
      const tile = doc.createElement("canvas");
      const N = 192;
      tile.width = N;
      tile.height = N;
      const tg = tile.getContext("2d");
      if (!tg || !tg.createImageData) return null;
      const image = tg.createImageData(N, N);
      const r = M.rng(seed * 7919 + 13);
      const speck = theme.light ? 0 : 255;
      for (let i = 0; i < N * N; i++) {
        const v = r();
        const a = v < 0.22 ? Math.floor(r() * 110 + 20) : 0;
        image.data[i * 4] = speck;
        image.data[i * 4 + 1] = speck;
        image.data[i * 4 + 2] = speck;
        image.data[i * 4 + 3] = a;
      }
      tg.putImageData(image, 0, 0);
      return tile;
    }

    /** Grão com semente sobre o quadro inteiro (o tema `noir` liga por padrão). */
    function grain(alpha) {
      if (!state.grainTile) state.grainTile = makeGrainTile();
      if (!state.grainTile) return;
      if (!state.grainPattern) state.grainPattern = g.createPattern(state.grainTile, "repeat");
      if (!state.grainPattern) return;
      g.save();
      g.globalAlpha = alpha === undefined ? (theme.light ? 0.35 : 0.5) : alpha;
      g.fillStyle = state.grainPattern;
      g.fillRect(0, 0, C.W, C.H);
      g.restore();
    }

    /** Pulso de brilho do fundo nas cabeças de compasso (no máximo 3%): sobe dois quadros antes do tempo forte e desce depois. */
    function pulseBg(amount) {
      const a = Math.min(0.03, Math.abs(amount === undefined ? 0.03 : amount)) * downbeatBump(0.14);
      if (a <= 0.0005) return;
      g.save();
      g.globalAlpha = a;
      g.fillStyle = theme.light ? "#000000" : "#FFFFFF";
      g.fillRect(0, 0, C.W, C.H);
      g.restore();
    }

    /** Uma luz suave que deriva num círculo fechado ao longo do slide (volta ao lugar no fim: loop limpo). */
    function glow(o) {
      const s = o || {};
      const color = themeColor(s.color, theme.accent);
      const amp = s.drift === undefined ? 0.03 : s.drift;
      const ang = (state.t / T) * Math.PI * 2;
      const cx = dimX(s.x, C.W * 0.75) + Math.sin(ang) * amp * C.W;
      const cy = dimY(s.y, C.H * 0.3) + Math.cos(ang) * amp * C.H;
      const r = dimX(s.r, C.W * 0.8);
      const alpha = s.alpha === undefined ? 0.1 : s.alpha;
      const grd = g.createRadialGradient(cx, cy, 0, cx, cy, r);
      grd.addColorStop(0, rgba(color, alpha));
      grd.addColorStop(1, rgba(color, 0));
      g.save();
      g.fillStyle = grd;
      g.fillRect(0, 0, C.W, C.H);
      g.restore();
    }

    // ----- texto -----

    function setFont(weight, size, family, tracking) {
      g.font = weight + " " + size + "px " + family;
      if (hasLetterSpacing) g.letterSpacing = (tracking ? Math.round(tracking * size * 100) / 100 : 0) + "px";
    }

    /** Linhas, tamanho e medidas de um texto que cabe na largura (e na altura, quando dada), descendo até minSize. */
    function layoutText(text, o) {
      const key = [text, o.size, o.minSize, o.maxWidth, o.maxHeight, o.maxLines, o.weight, o.family, o.lineHeight, o.tracking, o.uppercase].join("\u0001");
      const cached = state.layoutCache.get(key);
      if (cached) return cached;
      const raw = o.uppercase ? String(text).toUpperCase() : String(text);
      const paragraphs = raw.split("\n");
      let size = Math.round(o.size);
      let lines;
      let widths;
      let width;
      let lh;
      for (;;) {
        setFont(o.weight, size, o.family, o.tracking);
        lines = [];
        for (const p of paragraphs) {
          const wrapped = M.wrapText(g, p, o.maxWidth);
          for (const l of wrapped) lines.push(l);
        }
        widths = lines.map((l) => g.measureText(l).width);
        width = widths.reduce((a, b) => Math.max(a, b), 0);
        lh = Math.round(size * o.lineHeight);
        const height = lh * lines.length;
        const fits = width <= o.maxWidth + 0.5 && (!o.maxHeight || height <= o.maxHeight) && (!o.maxLines || lines.length <= o.maxLines);
        if (fits || size <= o.minSize) break;
        size = Math.max(o.minSize, size - 2);
      }
      const result = { size, lines, widths, width, lineHeight: lh, height: lh * lines.length };
      if (state.layoutCache.size > 400) state.layoutCache.clear();
      state.layoutCache.set(key, result);
      return result;
    }

    /**
     * Desenha um bloco de texto (título, parágrafo ou rótulo). Devolve a geometria do bloco (x, y, w, h, bottom, size, lines)
     * mesmo quando ele não está visível, para o próximo elemento poder se apoiar nele. `colors` dá uma cor por linha
     * (ex.: ["accent", "ink"]) para a palavra-herói sem quebrar o bloco.
     */
    function textBlock(kind, text, options) {
      const o = options || {};
      const d = TEXT[kind];
      const font = FONTS[d.font];
      const safe = C.safe;
      const align = o.align || "left";
      const x = dimX(o.x, align === "center" ? C.W / 2 : align === "right" ? safe.x + safe.w : safe.x);
      const y = dimY(o.y, safe.y);
      const valign = o.valign || "top";
      const maxWidth = o.maxWidth !== undefined && o.maxWidth !== null
        ? dimX(o.maxWidth, safe.w)
        : align === "center" ? 2 * Math.min(x - safe.x, safe.x + safe.w - x) : align === "right" ? x - safe.x : safe.x + safe.w - x;
      const maxHeight = o.maxHeight !== undefined ? dimY(o.maxHeight, 0) : valign === "middle" ? 2 * Math.min(y - safe.y, safe.y + safe.h - y) : valign === "bottom" ? y - safe.y : safe.y + safe.h - y;
      const size = o.size === undefined ? d.size : Number(o.size);
      const weight = o.weight || d.weight;
      const tracking = o.tracking === undefined ? d.tracking : o.tracking;
      const uppercase = o.uppercase === undefined ? Boolean(d.uppercase) : Boolean(o.uppercase);
      const layout = layoutText(text, {
        size,
        minSize: o.minSize === undefined ? Math.round(size * 0.6) : o.minSize,
        maxWidth: Math.max(10, maxWidth),
        maxHeight: Math.max(0, maxHeight),
        maxLines: o.maxLines || 0,
        weight,
        family: font.family,
        lineHeight: o.lineHeight || d.lineHeight,
        tracking,
        uppercase,
      });
      const top = valign === "middle" ? y - layout.height / 2 : valign === "bottom" ? y - layout.height : y;
      const left = align === "center" ? x - layout.width / 2 : align === "right" ? x - layout.width : x;
      const geometry = { x: left, y: top, w: layout.width, h: layout.height, bottom: top + layout.height, right: left + layout.width, size: layout.size, lines: layout.lines, lineHeight: layout.lineHeight };

      const style = o.in || d.in;
      const outStyle = o.outStyle || "fade";
      const perLine = Number(o.perLine) || 0;
      const at = Number(o.at) || 0;
      const inBeats = o.inBeats === undefined ? defaultInBeats(style, text) : Number(o.inBeats);
      const outBeats = o.outBeats === undefined ? 0.5 : Number(o.outBeats);
      const preset = o.spring || d.spring;
      const color = themeColor(o.color, theme[d.color]);
      const unit = Math.min(80, layout.size * 0.4);
      const role = o.role || "text";
      const colors = Array.isArray(o.colors) ? o.colors : null;

      let union = null;
      g.save();
      setFont(weight, layout.size, font.family, tracking);
      g.textBaseline = "top";
      g.textAlign = align;
      g.fillStyle = color;
      for (let i = 0; i < layout.lines.length; i++) {
        const line = layout.lines[i];
        const L = life({ at: at > 0 ? at + i * perLine : 0, out: o.out, back: o.back === undefined || o.back === null ? undefined : Number(o.back) + i * perLine }, inBeats, outBeats, preset, style === "type");
        if (!L.visible) continue;
        const P = pose(style, L.p, L.q, outStyle, unit);
        if (P.alpha <= 0.002) continue;
        const lineTop = top + i * layout.lineHeight;
        const lineLeft = align === "center" ? x - layout.widths[i] / 2 : align === "right" ? x - layout.widths[i] : x;
        const cx = perLine > 0 ? lineLeft + layout.widths[i] / 2 : left + layout.width / 2;
        const cy = perLine > 0 ? lineTop + layout.lineHeight / 2 : top + layout.height / 2;
        g.save();
        g.globalAlpha = P.alpha;
        if (colors && colors[i] !== undefined && colors[i] !== null) g.fillStyle = themeColor(colors[i], color);
        g.translate(cx + P.dx, cy + P.dy);
        g.scale(P.scale, P.scale);
        g.translate(-cx, -cy);
        if (P.wipe !== null) {
          g.beginPath();
          g.rect(lineLeft - 2, lineTop - 2, (layout.widths[i] + 4) * P.wipe, layout.lineHeight + 4);
          g.clip();
        }
        const shown = P.chars !== null ? line.slice(0, Math.ceil(P.chars * line.length)) : line;
        g.fillText(shown, x, lineTop);
        g.restore();
        if (P.alpha > 0.05) {
          const bx = cx + P.dx + (lineLeft - cx) * P.scale;
          const by = cy + P.dy + (lineTop - cy) * P.scale;
          const bw = layout.widths[i] * P.scale;
          const bh = layout.lineHeight * P.scale;
          union = union ? { x: Math.min(union.x, bx), y: Math.min(union.y, by), r: Math.max(union.r, bx + bw), b: Math.max(union.b, by + bh) } : { x: bx, y: by, r: bx + bw, b: by + bh };
        }
      }
      g.restore();
      if (union) register(role, union.x, union.y, union.r - union.x, union.b - union.y, layout.size, uppercase ? String(text).toUpperCase() : text);
      return geometry;
    }

    const headline = (text, o) => textBlock("headline", text, o);
    const body = (text, o) => textBlock("body", text, o);
    const label = (text, o) => textBlock("label", text, o);

    // ----- cartão e formas -----

    /** Retângulo arredondado com entrada (rise, pop, wipe, fade, none), saída e volta. */
    function card(options) {
      const o = options || {};
      const safe = C.safe;
      const x = dimX(o.x, safe.x);
      const y = dimY(o.y, safe.y);
      const w = dimX(o.w, safe.w);
      const h = dimY(o.h, 200);
      const r = o.radius === undefined ? 28 : o.radius;
      const geometry = { x, y, w, h, bottom: y + h, right: x + w };
      const style = o.in || "rise";
      const L = life(o, o.inBeats === undefined ? 1 : Number(o.inBeats), o.outBeats === undefined ? 0.5 : Number(o.outBeats), o.spring || "default");
      if (!L.visible) return geometry;
      const P = pose(style, L.p, L.q, o.outStyle || "fade", 40);
      if (P.alpha <= 0.002) return geometry;
      const cx = x + w / 2;
      const cy = y + h / 2;
      g.save();
      g.globalAlpha = P.alpha;
      g.translate(cx + P.dx, cy + P.dy);
      g.scale(P.scale, P.scale);
      g.translate(-cx, -cy);
      if (P.wipe !== null) {
        g.beginPath();
        g.rect(x - 2, y - 2, (w + 4) * P.wipe, h + 4);
        g.clip();
      }
      if (o.shadow) {
        g.shadowColor = "rgba(0,0,0,0.35)";
        g.shadowBlur = 40;
        g.shadowOffsetY = 16;
      }
      M.roundRect(g, x, y, w, h, r);
      g.fillStyle = themeColor(o.color, theme.surface);
      g.fill();
      if (o.stroke) {
        g.shadowColor = "rgba(0,0,0,0)";
        g.lineWidth = o.lineWidth || 2;
        g.strokeStyle = themeColor(o.stroke, theme.line);
        g.stroke();
      }
      g.restore();
      if (P.alpha > 0.05) register(o.role || "ui", cx + P.dx - (w / 2) * P.scale, cy + P.dy - (h / 2) * P.scale, w * P.scale, h * P.scale, null);
      return geometry;
    }

    /** Forma simples: circle (x, y, r), rect (x, y, w, h), line e arrow (x, y → x2, y2), ring (x, y, r). Entrada `draw`, `pop`, `fade`, `wipe`. */
    function shape(options) {
      const o = options || {};
      const kind = o.kind || "rect";
      const style = o.in || (kind === "line" || kind === "arrow" || kind === "ring" ? "draw" : "pop");
      const L = life(o, o.inBeats === undefined ? 1 : Number(o.inBeats), o.outBeats === undefined ? 0.5 : Number(o.outBeats), o.spring || "default");
      if (!L.visible) return null;
      const P = pose(style, L.p, L.q, o.outStyle || "fade", 30);
      if (P.alpha <= 0.002) return null;
      const color = themeColor(o.color, theme.accent);
      const lw = o.lineWidth || 6;
      const x = dimX(o.x, C.W / 2);
      const y = dimY(o.y, C.H / 2);
      g.save();
      g.globalAlpha = P.alpha;
      g.fillStyle = color;
      g.strokeStyle = color;
      g.lineWidth = lw;
      g.lineCap = "round";
      g.lineJoin = "round";
      let box = null;
      if (kind === "line" || kind === "arrow") {
        const x2 = dimX(o.x2, x + 200);
        const y2 = dimY(o.y2, y);
        const draw = P.wipe === null ? 1 : P.wipe;
        const ex = lerp(x, x2, draw);
        const ey = lerp(y, y2, draw);
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(ex, ey);
        g.stroke();
        if (kind === "arrow" && draw > 0.05) {
          const ang = Math.atan2(y2 - y, x2 - x);
          const head = o.head || lw * 3;
          g.beginPath();
          g.moveTo(ex, ey);
          g.lineTo(ex - head * Math.cos(ang - Math.PI / 6), ey - head * Math.sin(ang - Math.PI / 6));
          g.moveTo(ex, ey);
          g.lineTo(ex - head * Math.cos(ang + Math.PI / 6), ey - head * Math.sin(ang + Math.PI / 6));
          g.stroke();
        }
        box = { x: Math.min(x, ex) - lw, y: Math.min(y, ey) - lw, w: Math.abs(ex - x) + lw * 2, h: Math.abs(ey - y) + lw * 2 };
      } else if (kind === "circle" || kind === "ring") {
        const r = dimX(o.r, 60) * (P.wipe === null ? P.scale : 1);
        g.translate(x + P.dx, y + P.dy);
        g.beginPath();
        if (kind === "ring" && P.wipe !== null) g.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * P.wipe);
        else g.arc(0, 0, r, 0, Math.PI * 2);
        if (kind === "ring") g.stroke();
        else g.fill();
        box = { x: x + P.dx - r - lw, y: y + P.dy - r - lw, w: r * 2 + lw * 2, h: r * 2 + lw * 2 };
      } else {
        const w = dimX(o.w, 200);
        const h = dimY(o.h, 200);
        const cx = x + w / 2;
        const cy = y + h / 2;
        g.translate(cx + P.dx, cy + P.dy);
        g.scale(P.scale, P.scale);
        g.translate(-cx, -cy);
        if (P.wipe !== null) {
          g.beginPath();
          g.rect(x - 2, y - 2, (w + 4) * P.wipe, h + 4);
          g.clip();
        }
        M.roundRect(g, x, y, w, h, o.radius === undefined ? 0 : o.radius);
        g.fill();
        box = { x: cx + P.dx - (w / 2) * P.scale, y: cy + P.dy - (h / 2) * P.scale, w: w * P.scale, h: h * P.scale };
      }
      g.restore();
      if (box && P.alpha > 0.05) register(o.role || "ui", box.x, box.y, box.w, box.h, null);
      return box;
    }

    // ----- números e gráficos -----

    /**
     * Número animado. Com `at: 0`, o quadro 0 mostra `to` assentado; a contagem toca a partir de `back`
     * (saindo em `out` antes, se houver) e termina exatamente em `to` depois de `beats` batidas.
     */
    function counter(options) {
      const o = options || {};
      const from = Number(o.from) || 0;
      const to = Number(o.to) || 0;
      const at = Number(o.at) || 0;
      const beats = o.beats === undefined ? 4 : Math.max(1e-4, Number(o.beats));
      const hasBack = o.back !== undefined && o.back !== null;
      const easeFn = M.ease[o.ease || "outCubic"] || M.ease.outCubic;
      const b = state.b;
      let progress = 1;
      if (at > 0) progress = b < at ? 0 : clamp((b - at) / beats);
      else if (hasBack && b >= Number(o.back)) progress = clamp((b - Number(o.back)) / beats);
      const value = from + (to - from) * easeFn(progress);
      const text = (o.prefix || "") + formatNumber(value, o.decimals || 0) + (o.suffix || "");
      const timing = { at, out: o.out, back: o.back, in: o.in || "pop", inBeats: o.inBeats === undefined ? 0.5 : o.inBeats, outBeats: o.outBeats, outStyle: o.outStyle, spring: o.spring || "snappy" };
      return textBlock("headline", text, Object.assign({ size: 200, lineHeight: 0.95, tracking: -0.04 }, o, timing, { role: o.role || "text", color: themeColor(o.color, theme.accent) }));
    }

    /** Gráfico de barras que crescem nas batidas (`perBar` entre uma e outra); rótulos embaixo. */
    function bars(options) {
      const o = options || {};
      const values = (o.values || []).map(Number);
      const n = values.length;
      const safe = C.safe;
      const x = dimX(o.x, safe.x);
      const y = dimY(o.y, safe.y);
      const w = dimX(o.w, safe.w);
      const h = dimY(o.h, 320);
      const geometry = { x, y, w, h, bottom: y + h, right: x + w };
      if (!n) return geometry;
      const labelSize = o.labelSize === undefined ? 44 : Number(o.labelSize);
      const labelGap = o.labels ? Math.round(labelSize * 1.6) : 0;
      const chartH = h - labelGap;
      const max = o.max === undefined ? Math.max.apply(null, values.concat([1e-9])) : Number(o.max);
      const slot = w / n;
      const bw = slot * (1 - (o.gap === undefined ? 0.28 : o.gap));
      const perBar = o.perBar === undefined ? 0.5 : Number(o.perBar);
      const at = Number(o.at) || 0;
      const inBeats = o.inBeats === undefined ? 1 : Number(o.inBeats);
      const color = themeColor(o.color, theme.accent);
      const radius = o.radius === undefined ? Math.min(12, bw / 2) : o.radius;
      let anyVisible = false;
      let labelsVisible = false;
      g.save();
      for (let i = 0; i < n; i++) {
        const L = life({ at: at > 0 ? at + i * perBar : 0, out: o.out, back: o.back === undefined || o.back === null ? undefined : Number(o.back) + i * perBar }, inBeats, o.outBeats === undefined ? 0.5 : Number(o.outBeats), o.spring || "default");
        if (!L.visible) continue;
        const alpha = L.q > 0 ? 1 - M.ease.outQuad(L.q) : 1;
        if (alpha <= 0.002) continue;
        anyVisible = true;
        const full = chartH * clamp(values[i] / max);
        const height = Math.max(0, full * L.p);
        const bx = x + i * slot + (slot - bw) / 2;
        g.globalAlpha = alpha;
        g.fillStyle = color;
        if (height > 1) {
          M.roundRect(g, bx, y + chartH - height, bw, height, Math.min(radius, height / 2));
          g.fill();
        }
        g.fillStyle = rgba(theme.ink, 0.22);
        g.fillRect(bx, y + chartH - 3, bw, 3);
        if (o.valueLabels && L.p >= 0.999) {
          setFont(700, labelSize, FONTS.display.family, 0);
          g.textAlign = "center";
          g.textBaseline = "bottom";
          g.fillStyle = themeColor(o.labelColor, theme.ink);
          g.fillText(formatNumber(values[i], o.decimals || 0) + (o.suffix || ""), bx + bw / 2, y + chartH - height - 10);
        }
        if (o.labels && o.labels[i] !== undefined) {
          labelsVisible = true;
          setFont(700, labelSize, FONTS.display.family, 0.02);
          g.textAlign = "center";
          g.textBaseline = "top";
          g.fillStyle = themeColor(o.labelColor, theme.muted);
          g.fillText(String(o.labels[i]), bx + bw / 2, y + chartH + Math.round(labelSize * 0.45));
        }
      }
      g.restore();
      if (anyVisible) register("ui", x, y, w, chartH, null);
      if (labelsVisible) register("text", x, y + chartH + Math.round(labelSize * 0.45), w, Math.round(labelSize * 1.15), labelSize, o.labels.join(" "));
      return geometry;
    }

    // ----- régua, bola, pílulas, chamada, dica -----

    /** Régua de compassos compartilhada entre os slides: um traço por batida, número por compasso, cabeça que varre os compassos deste slide. */
    function ruler(options) {
      const o = options || {};
      const safe = C.safe;
      const totalBars = Math.max(1, Number(o.totalBars) || barCount);
      const offset = Number(o.offsetBars) || 0;
      const own = Number(o.bars) || barCount;
      const x = dimX(o.x, safe.x);
      const w = dimX(o.w, safe.w);
      const y = dimY(o.y, safe.y + safe.h - 110);
      const color = themeColor(o.color, rgba(theme.ink, 0.35));
      const accent = themeColor(o.accent, theme.accent);
      const unit = w / totalBars;
      const numbers = o.numbers !== false;
      const numberSize = o.numberSize || 22;
      g.save();
      g.fillStyle = rgba(theme.ink, 0.16);
      g.fillRect(x, y, w, 2);
      g.fillStyle = rgba(accent, 0.45);
      g.fillRect(x + offset * unit, y - 1, own * unit, 4);
      for (let i = 0; i <= totalBars * beatsPerBar; i++) {
        const bx = x + (i * unit) / beatsPerBar;
        const isBar = i % beatsPerBar === 0;
        g.fillStyle = isBar ? color : rgba(theme.ink, 0.18);
        g.fillRect(bx - 1, y - (isBar ? 16 : 7), 2, isBar ? 16 : 7);
      }
      if (numbers) {
        const every = unit >= 36 ? 1 : unit >= 18 ? 2 : 4;
        setFont(700, numberSize, FONTS.display.family, 0.04);
        g.textAlign = "left";
        g.textBaseline = "top";
        for (let i = 0; i < totalBars; i += every) {
          const inside = i >= offset && i < offset + own;
          g.fillStyle = inside ? accent : rgba(theme.ink, 0.35);
          g.fillText(String(i + 1), x + i * unit + 4, y + 10);
        }
      }
      const head = x + (offset + state.b / beatsPerBar) * unit;
      g.fillStyle = accent;
      g.fillRect(head - 2, y - 26, 4, 40);
      g.restore();
      register("ui", x, y - 26, w, 36 + (numbers ? numberSize + 4 : 0), null);
      return { x, y, w, unit, head };
    }

    /**
     * Bola com squash & stretch. Vai de `from` a `to` em `beats` batidas a partir de `at`, e volta de `back` em diante
     * (padrão: a tempo de descansar em `from` no fim do slide). `ease`: linear | out | spring | bounce (pulos). `path` (lista de
     * pontos) substitui a reta; um caminho fechado dá a volta completa.
     */
    function ball(options) {
      const o = options || {};
      const r = Number(o.radius) || 40;
      const at = Number(o.at) || 0;
      const beats = Math.max(1e-4, o.beats === undefined ? 4 : Number(o.beats));
      const back = o.back === undefined || o.back === null ? totalBeats - beats : Number(o.back);
      const easeName = o.ease || "bounce";
      const color = themeColor(o.color, theme.accent);
      const b = state.b;
      const path = Array.isArray(o.path) && o.path.length > 1 ? o.path.map(point) : null;
      const from = path ? path[0] : point(o.from || [0.2, 0.7]);
      const to = path ? path[path.length - 1] : point(o.to || [0.8, 0.7]);
      const closed = path ? Math.abs(from.x - to.x) < 0.5 && Math.abs(from.y - to.y) < 0.5 : false;
      let p = 0;
      let dir = 1;
      let moving = false;
      if (b < at) { p = 0; dir = 1; }
      else if (b < at + beats) { p = (b - at) / beats; dir = 1; moving = true; }
      else if (closed || b < back) { p = 1; dir = 1; }
      else if (b < back + beats) { p = (b - back) / beats; dir = -1; moving = true; }
      else { p = 1; dir = -1; }
      // position along the path for a parameter u in [0, 1]
      const along = (u) => {
        if (!path) return { x: lerp(from.x, to.x, u), y: lerp(from.y, to.y, u) };
        const seg = [];
        let total = 0;
        for (let i = 1; i < path.length; i++) {
          const d = Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
          seg.push(d);
          total += d;
        }
        let dist = u * total;
        for (let i = 1; i < path.length; i++) {
          if (dist <= seg[i - 1] || i === path.length - 1) {
            const s = seg[i - 1] > 0 ? clamp(dist / seg[i - 1]) : 1;
            return { x: lerp(path[i - 1].x, path[i].x, s), y: lerp(path[i - 1].y, path[i].y, s) };
          }
          dist -= seg[i - 1];
        }
        return to;
      };
      let u;
      let sx = 1;
      let sy = 1;
      let angle = 0;
      let pos;
      if (easeName === "bounce") {
        const profile = hopProfile(o.hops === undefined ? 3 : o.hops);
        const hop = hopAt(profile, p);
        const height = dimY(o.height, r * 5);
        u = dir > 0 ? p : 1 - p;
        pos = along(u);
        pos.y -= hop.height * height;
        if (moving) {
          const v = Math.abs(1 - 2 * hop.s);
          const contact = clamp(1 - Math.min(hop.s, 1 - hop.s) / 0.1);
          sy = (1 + 0.22 * v) * (1 - 0.45 * contact);
          sx = 1 / sy;
        }
      } else {
        const s = easeName === "linear" ? p : easeName === "spring" ? entrance(p, o.spring || "default") : M.ease.outCubic(p);
        u = dir > 0 ? s : 1 - s;
        pos = along(u);
        if (moving && o.squash !== false) {
          const dp = 0.01;
          const s2 = easeName === "linear" ? clamp(p + dp) : easeName === "spring" ? entrance(clamp(p + dp), o.spring || "default") : M.ease.outCubic(clamp(p + dp));
          const u2 = dir > 0 ? s2 : 1 - s2;
          const next = along(u2);
          const speed = Math.hypot(next.x - pos.x, next.y - pos.y) / dp;
          const dist = path ? 1 : Math.hypot(to.x - from.x, to.y - from.y);
          const k = clamp(speed / Math.max(1, dist * 2.5));
          sx = 1 + 0.3 * k;
          sy = 1 / sx;
          angle = Math.atan2(next.y - pos.y, next.x - pos.x);
        }
      }
      if (o.squash === false) { sx = 1; sy = 1; }
      const cx = pos.x;
      const cy = easeName === "bounce" ? pos.y + r - r * sy : pos.y;
      g.save();
      g.translate(cx, cy);
      g.rotate(angle);
      g.scale(sx, sy);
      g.fillStyle = color;
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.fill();
      g.restore();
      register(o.role || "ui", cx - r * Math.max(sx, sy), cy - r * Math.max(sx, sy), 2 * r * Math.max(sx, sy), 2 * r * Math.max(sx, sy), null);
      return { x: cx, y: cy, r, p, dir, moving };
    }

    /** Pílulas de progresso dos slides ("•••"): a atual é uma pílula larga. */
    function progress(options) {
      const o = options || {};
      const safe = C.safe;
      const total = Math.max(1, Number(o.total) || 1);
      const step = Math.min(total, Math.max(1, Number(o.step) || 1));
      const size = Number(o.size) || 10;
      const gap = o.gap === undefined ? 12 : Number(o.gap);
      const x = dimX(o.x, safe.x);
      const y = dimY(o.y, safe.y + safe.h - size / 2);
      const color = themeColor(o.color, theme.accent);
      const muted = themeColor(o.muted, rgba(theme.ink, 0.25));
      let cx = x;
      g.save();
      for (let i = 1; i <= total; i++) {
        const w = i === step ? size * 3.6 : size;
        g.fillStyle = i === step ? color : muted;
        M.roundRect(g, cx, y - size / 2, w, size, size / 2);
        g.fill();
        cx += w + gap;
      }
      g.restore();
      register("ui", x, y - size / 2, cx - gap - x, size, null);
      return { x, y, w: cx - gap - x, h: size };
    }

    /** Botão-pílula de chamada; `pulse` respira nas cabeças de compasso. */
    function cta(text, options) {
      const o = options || {};
      const safe = C.safe;
      const size = o.size === undefined ? 48 : Number(o.size);
      const padX = o.paddingX === undefined ? 60 : Number(o.paddingX);
      const h = o.h === undefined ? Math.round(size * 2.3) : dimY(o.h, 110);
      setFont(FONTS.display.weight, size, FONTS.display.family, -0.01);
      const tw = g.measureText(text).width;
      const w = Math.min(safe.w, o.w === undefined ? tw + padX * 2 : dimX(o.w, safe.w));
      const cx = dimX(o.x, C.W / 2);
      const cy = dimY(o.y, safe.y + safe.h * 0.72);
      const geometry = { x: cx - w / 2, y: cy - h / 2, w, h, bottom: cy + h / 2 };
      const style = o.in || "pop";
      const L = life(o, o.inBeats === undefined ? 1 : Number(o.inBeats), o.outBeats === undefined ? 0.5 : Number(o.outBeats), o.spring || "snappy");
      if (!L.visible) return geometry;
      const P = pose(style, L.p, L.q, o.outStyle || "fade", 30);
      if (P.alpha <= 0.002) return geometry;
      const breathe = o.pulse === false ? 1 : 1 + (o.pulseAmount === undefined ? 0.03 : Number(o.pulseAmount)) * downbeatBump(0.2);
      const s = P.scale * breathe;
      g.save();
      g.globalAlpha = P.alpha;
      g.translate(cx + P.dx, cy + P.dy);
      g.scale(s, s);
      M.roundRect(g, -w / 2, -h / 2, w, h, o.radius === undefined ? h / 2 : o.radius);
      g.fillStyle = themeColor(o.color, theme.accent);
      g.fill();
      g.fillStyle = themeColor(o.textColor, theme.bg);
      g.textAlign = "center";
      g.textBaseline = "middle";
      setFont(FONTS.display.weight, size, FONTS.display.family, -0.01);
      g.fillText(text, 0, 2);
      g.restore();
      if (P.alpha > 0.05) {
        register("ui", cx + P.dx - (w / 2) * s, cy + P.dy - (h / 2) * s, w * s, h * s, null);
        register("text", cx + P.dx - (tw / 2) * s, cy + P.dy - (size / 2) * s, tw * s, size * s, size, text);
      }
      return geometry;
    }

    /**
     * Seta pequena que cutuca a cada batida: "deslize". Fica na linha das pílulas de progresso, do lado direito,
     * antes do canto do botão de som, para nunca encostar no conteúdo; `x` e `y` mudam o lugar. Não use no último slide.
     */
    function swipeHint(options) {
      const o = options || {};
      const safe = C.safe;
      const side = o.side || "right";
      const size = Number(o.size) || 26;
      const dirSign = side === "right" ? 1 : -1;
      const x = dimX(o.x, side === "right" ? Math.min(safe.x + safe.w - size, safe.corners.sound.x - size * 3.5) : safe.x + size);
      const y = dimY(o.y, safe.y + safe.h - 5);
      const L = life(o, o.inBeats === undefined ? 1 : Number(o.inBeats), 0.5, "snappy");
      if (!L.visible) return null;
      const P = pose(o.in || "fade", L.p, L.q, "fade", 20);
      if (P.alpha <= 0.002) return null;
      const dx = dirSign * 10 * beatPulse(5);
      g.save();
      g.globalAlpha = P.alpha * 0.9;
      g.strokeStyle = themeColor(o.color, theme.muted);
      g.lineWidth = o.lineWidth || 5;
      g.lineCap = "round";
      g.lineJoin = "round";
      g.beginPath();
      g.moveTo(x + dx - dirSign * size * 0.4, y - size * 0.7);
      g.lineTo(x + dx + dirSign * size * 0.4, y);
      g.lineTo(x + dx - dirSign * size * 0.4, y + size * 0.7);
      g.stroke();
      g.restore();
      register("ui", x + dx - size * 0.5 - 4, y - size * 0.7 - 4, size + 8, size * 1.4 + 8, null);
      return { x: x + dx, y };
    }

    // ----- imagens (fotos, recortes, logos) -----

    /** Marca de uma imagem deixada de fora de propósito (caminho vazio em loadImages). */
    const NO_PICTURE = { empty: true };

    /**
     * Carrega as imagens do slide uma vez e devolve uma promessa. Na página:
     *   const ready = C.loadImages({ fundo: "../assets/fundo.jpg", assunto: "../assets/assunto.png" });
     *   window.seek = async (t) => { await ready; C.begin(t); C.image("fundo"); … return C.end(); };
     * Os caminhos são relativos à página. Uma imagem que não carrega fica como `null`: o slide é desenhado
     * sem ela e um aviso vai para o console, que o Motor repassa nos avisos do render.
     */
    function loadImages(map) {
      const entries = Object.entries(map || {});
      const one = (alias, src) => new Promise((resolve) => {
        const fail = () => {
          state.images.set(alias, null);
          C.images[alias] = null;
          if (global.console && global.console.warn) global.console.warn("carousel.js: não consegui carregar a imagem \"" + alias + "\" (" + src + ")");
          resolve();
        };
        // an empty path means "no picture here": nothing is drawn and nothing is reported
        if (!src) {
          state.images.set(alias, NO_PICTURE);
          C.images[alias] = null;
          resolve();
          return;
        }
        if (typeof global.Image !== "function") { fail(); return; }
        const img = new global.Image();
        const done = () => {
          state.images.set(alias, img);
          C.images[alias] = img;
          resolve();
        };
        img.onload = () => {
          if (typeof img.decode === "function") img.decode().then(done, done);
          else done();
        };
        img.onerror = fail;
        img.src = src;
      });
      return Promise.all(entries.map(([alias, src]) => one(alias, src))).then(() => C.images);
    }

    /** Onde uma imagem que cabe inteira encosta dentro da caixa: 0 = começo, 0.5 = centro, 1 = fim. */
    function anchorOf(anchor) {
      const a = String(anchor || "center");
      return {
        ax: a.indexOf("left") >= 0 ? 0 : a.indexOf("right") >= 0 ? 1 : 0.5,
        ay: a.indexOf("top") >= 0 ? 0 : a.indexOf("bottom") >= 0 ? 1 : 0.5,
      };
    }

    /**
     * Desenha uma imagem carregada com loadImages (pelo apelido) ou um <img>/<canvas>. Sem x, y, w, h ocupa o quadro inteiro.
     *   fit: "cover" (padrão) preenche a caixa e corta o que sobra, com o foco em focusX/focusY (0 a 1; padrão 0.5);
     *        "contain" mostra a imagem inteira dentro da caixa, encostada em `anchor` (center, bottom, top-left, bottom-right…).
     *   depth 0 a 1: paralaxe em laço fechado. A imagem deriva e respira ao longo do slide e volta exatamente ao lugar no fim;
     *        fundo perto de 0.3, assunto perto de 0.7, objetos soltos perto de 1. `drift` multiplica a deriva.
     *   dim 0 a 1 escurece a imagem com a cor de fundo do tema (texto por cima pede 0.35 ou mais); alpha, radius e shadow
     *        (sombra suave que segue o contorno de um recorte) completam.
     *   at, in (fade, rise, drop, pop, wipe, none), inBeats, out, outStyle, back: como nos outros elementos.
     *   role: "logo" ou "face" registram a caixa para a conferência da zona segura; sem role, a imagem não é conferida.
     * Devolve a caixa realmente desenhada ({ x, y, w, h, bottom, right, loaded }), para apoiar texto ao lado dela.
     */
    function image(source, options) {
      const o = options || {};
      const img = typeof source === "string" ? state.images.get(source) : source;
      const bx = dimX(o.x, 0);
      const by = dimY(o.y, 0);
      const bw = dimX(o.w, C.W - bx);
      const bh = dimY(o.h, C.H - by);
      // a picture left out on purpose (an empty path in loadImages) draws nothing at all
      if (img === NO_PICTURE) return { x: bx, y: by, w: bw, h: bh, bottom: by + bh, right: bx + bw, loaded: false, empty: true };
      const iw = img ? (img.naturalWidth || img.videoWidth || img.width || 0) : 0;
      const ih = img ? (img.naturalHeight || img.videoHeight || img.height || 0) : 0;
      const loaded = Boolean(img && iw > 0 && ih > 0);
      const cover = (o.fit || "cover") !== "contain";
      const depth = clamp(Number(o.depth) || 0);
      const amp = depth * (o.drift === undefined ? 1 : Number(o.drift));
      let dx = bx;
      let dy = by;
      let dw = bw;
      let dh = bh;
      if (loaded) {
        const scale = cover ? Math.max(bw / iw, bh / ih) : Math.min(bw / iw, bh / ih);
        dw = iw * scale;
        dh = ih * scale;
        if (cover) {
          dx = bx + (bw - dw) * clamp(o.focusX === undefined ? 0.5 : Number(o.focusX));
          dy = by + (bh - dh) * clamp(o.focusY === undefined ? 0.5 : Number(o.focusY));
        } else {
          const a = anchorOf(o.anchor);
          dx = bx + (bw - dw) * a.ax;
          dy = by + (bh - dh) * a.ay;
        }
      }
      const geometry = cover || !loaded ? { x: bx, y: by, w: bw, h: bh, bottom: by + bh, right: bx + bw, loaded } : { x: dx, y: dy, w: dw, h: dh, bottom: dy + dh, right: dx + dw, loaded };
      const full = bx <= 0 && by <= 0 && bw >= C.W && bh >= C.H;
      const style = o.in || (full ? "fade" : "rise");
      const L = life(o, o.inBeats === undefined ? 1 : Number(o.inBeats), o.outBeats === undefined ? 0.5 : Number(o.outBeats), o.spring || "default");
      if (!L.visible) return geometry;
      const P = pose(style, L.p, L.q, o.outStyle || "fade", 50);
      const alpha = P.alpha * (o.alpha === undefined ? 1 : clamp(Number(o.alpha)));
      if (alpha <= 0.002) return geometry;

      // closed-loop parallax: zero at t = 0 and back to zero at the end of the slide
      const ang = (state.t / T) * Math.PI * 2;
      const px = Math.sin(ang) * 0.012 * C.W * amp;
      const py = (1 - Math.cos(ang)) * 0.006 * C.H * amp;
      const breathe = 1 + 0.03 * amp * (1 - Math.cos(ang)) / 2;
      const overscan = cover ? 1 + 0.03 * amp : 1; // a covering picture never shows its edge while it drifts
      const cx = geometry.x + geometry.w / 2;
      const cy = geometry.y + geometry.h / 2;
      const radius = o.radius === undefined ? 0 : Number(o.radius);

      g.save();
      g.globalAlpha = alpha;
      g.translate(cx + P.dx, cy + P.dy);
      g.scale(P.scale, P.scale);
      g.translate(-cx, -cy);
      if (cover || radius > 0 || P.wipe !== null) {
        const clipW = P.wipe !== null ? geometry.w * P.wipe : geometry.w;
        M.roundRect(g, geometry.x, geometry.y, clipW, geometry.h, radius);
        g.clip();
      }
      if (loaded) {
        if (o.shadow && !cover) {
          g.shadowColor = "rgba(0,0,0,0.5)";
          g.shadowBlur = Math.round(C.W * 0.045);
          g.shadowOffsetY = Math.round(C.W * 0.02);
        }
        const k = overscan * breathe;
        const icx = dx + dw / 2 + px;
        const icy = dy + dh / 2 + py;
        g.drawImage(img, icx - (dw * k) / 2, icy - (dh * k) / 2, dw * k, dh * k);
        g.shadowColor = "rgba(0,0,0,0)";
        g.shadowBlur = 0;
        g.shadowOffsetY = 0;
      } else if (!full) {
        // the picture is missing: a quiet placeholder keeps the layout readable
        g.fillStyle = theme.surface;
        M.roundRect(g, geometry.x, geometry.y, geometry.w, geometry.h, radius || 24);
        g.fill();
      }
      const dim = clamp(Number(o.dim) || 0);
      if (dim > 0 && loaded) {
        g.globalAlpha = alpha * dim;
        g.fillStyle = theme.bg;
        g.fillRect(geometry.x, geometry.y, geometry.w, geometry.h);
      }
      g.restore();
      if (o.role && alpha > 0.05) register(o.role, cx + P.dx - (geometry.w / 2) * P.scale, cy + P.dy - (geometry.h / 2) * P.scale, geometry.w * P.scale, geometry.h * P.scale, null);
      return geometry;
    }

    /**
     * Várias imagens em camadas, da mais distante para a mais próxima: cada item é { src, …opções de image }.
     * Sem `depth`, a profundidade cresce de 0.3 (a primeira) a 1 (a última), o que dá o efeito de palco em 2.5D.
     */
    function layers(list, shared) {
      const items = Array.isArray(list) ? list : [];
      const n = items.length;
      return items.map((layer, i) => {
        const depth = n > 1 ? 0.3 + (0.7 * i) / (n - 1) : 0.3;
        return image(layer.src, Object.assign({ depth }, shared || {}, layer));
      });
    }

    /**
     * Degradê da cor de fundo do tema sobre uma foto, para o texto ficar legível: `side` top, bottom, left, right
     * (de onde ele parte, opaco, até sumir) ou full (véu uniforme); `size` é a fração do quadro que ele cobre
     * (padrão 0.6) e `alpha` a opacidade na borda (padrão 0.9). Nunca escreva texto sobre foto sem um destes ou sem `dim`.
     */
    function scrim(options) {
      const o = options || {};
      const side = o.side || "bottom";
      const size = clamp(o.size === undefined ? 0.6 : Number(o.size));
      const alpha = clamp(o.alpha === undefined ? 0.9 : Number(o.alpha));
      const color = themeColor(o.color, theme.bg);
      const L = life(o, o.inBeats === undefined ? 1 : Number(o.inBeats), o.outBeats === undefined ? 0.5 : Number(o.outBeats), "default", true);
      if (!L.visible) return;
      const a = alpha * (L.q > 0 ? 1 - L.q : L.p);
      if (a <= 0.002) return;
      g.save();
      if (side === "full") {
        g.globalAlpha = a;
        g.fillStyle = color;
        g.fillRect(0, 0, C.W, C.H);
        g.restore();
        return;
      }
      const vertical = side === "top" || side === "bottom";
      const length = (vertical ? C.H : C.W) * size;
      const x0 = side === "right" ? C.W : 0;
      const y0 = side === "bottom" ? C.H : 0;
      const x1 = side === "right" ? C.W - length : side === "left" ? length : 0;
      const y1 = side === "bottom" ? C.H - length : side === "top" ? length : 0;
      const grd = g.createLinearGradient(x0, y0, vertical ? x0 : x1, vertical ? y1 : y0);
      grd.addColorStop(0, rgba(color, a));
      grd.addColorStop(0.45, rgba(color, a * 0.72));
      grd.addColorStop(1, rgba(color, 0));
      g.fillStyle = grd;
      if (vertical) g.fillRect(0, Math.min(y0, y1), C.W, length);
      else g.fillRect(Math.min(x0, x1), 0, length, C.H);
      g.restore();
    }

    // ----- montagem -----

    global.setFormat = setFormat;
    if (typeof global.boxes !== "function") global.boxes = boxes;

    Object.assign(C, {
      setFormat, begin, end, boxes, beat, bar, beats: beat, loopT: (t) => M.loopT(t, T),
      beatPulse, downbeat, downbeatBump, life, pose, entrance, layoutText,
      headline, body, label, card, shape, counter, bars, ruler, ball, progress, cta, swipeHint, pulseBg, grain, glow,
      loadImages, image, layers, scrim,
      rgba, mix, formatNumber,
    });
    return C;
  }

  global.Carousel = { version: VERSION, setup, THEMES, FORMATS, FONTS, MARGIN, CORNERS, SETTLE, safeRect, entrance, formatNumber, hopProfile, hopAt, rgba, mix, resolveTheme };
})(typeof window !== "undefined" ? window : globalThis);
