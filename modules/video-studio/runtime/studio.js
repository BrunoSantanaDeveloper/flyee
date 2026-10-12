/*
 * Estúdio de vídeo · biblioteca das páginas (studio.js)
 * Carregue depois de motion.js. Lê o roteiro que a página traz em <script id="roteiro" type="application/json">,
 * calcula a linha do tempo na grade de batidas, carrega as imagens e oferece os componentes de um vídeo animado:
 * fundo, título cinético, texto, rótulo, etiqueta, celular com a tela real, cartão, cursor, contador, preço,
 * item de lista, trilho de progresso, botão, logo com a chamada final e as transições conduzidas por um elemento.
 *
 * Tudo é função pura do tempo: sem timers, sem requestAnimationFrame, sem Math.random, sem estado entre quadros
 * (só os caches de medidas de texto). Os tempos dos componentes são em BATIDAS contadas do início da cena.
 *
 * Uso mínimo:
 *   Studio.load();                                              // lê o roteiro; as imagens carregam ao fundo
 *   const film = Motion.setup({ duration: Studio.timeline.duration, width: 1080, height: 1920, fps: 30, background: Studio.palette.background });
 *   film.cuts = Studio.timeline.cuts;
 *   const S = Studio.stage(document.getElementById("c"));
 *   S.scene("gancho", (c) => { Studio.headline(c, c.scene.text, { cover: true }); });
 *   window.seek = S.seek; window.setFormat = S.setFormat; window.boxes = S.boxes;
 */
(function (global) {
  "use strict";

  const M = global.Motion;
  if (!M) throw new Error("studio.js precisa de motion.js carregado antes dele.");

  const VERSION = 1;
  const clamp = M.clamp;
  const lerp = M.lerp;
  const phase = M.phase;
  const ease = M.ease;
  /** Um quadro da gramática de movimento (30 fps), em segundos: as anatomias das transições são contadas nele. */
  const Q = 1 / 30;

  const STYLE_IDS = ["interface-narra", "interface-que-se-transforma", "limpo", "tipografia-cinetica", "vitrine"];
  const GENERIC_FAMILY = /(sans-serif|serif|monospace|system-ui|cursive|fantasy)\s*$/i;
  const FALLBACK_SANS = '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  /** Tempo (s) em que cada mola de Motion assenta a 1%. */
  const SETTLE = { snappy: 0.24, default: 0.51, type: 0.61, heavy: 0.7, playful: 0.62 };

  const num = (v, fallback) => (typeof v === "number" && isFinite(v) ? v : fallback);
  const filled = (v) => typeof v === "string" && v.trim().length > 0;
  const round6 = (x) => Math.round(x * 1e6) / 1e6;
  const r1 = (x) => Math.round(x * 10) / 10;

  /** Semente estável a partir de um texto (o título do roteiro, por exemplo). */
  function hashSeed(text) {
    let h = 2166136261;
    for (const ch of String(text)) {
      h ^= ch.codePointAt(0);
      h = Math.imul(h, 16777619);
    }
    return ((h >>> 0) % 99991) + 1;
  }

  // ---------------------------------------------------------------------------------------------
  // Cores
  // ---------------------------------------------------------------------------------------------

  /** "#E8473C", "#fff", "rgb(1, 2, 3)" ou [r, g, b] → [r, g, b]; null quando não é uma cor. */
  function parseColor(value) {
    if (Array.isArray(value)) return value.length >= 3 ? value.slice(0, 3).map((v) => clamp(Math.round(Number(v) || 0), 0, 255)) : null;
    const s = String(value === undefined || value === null ? "" : value).trim();
    let m = /^#?([0-9a-f]{3})$/i.exec(s);
    if (m) return m[1].split("").map((ch) => parseInt(ch + ch, 16));
    m = /^#?([0-9a-f]{6})(?:[0-9a-f]{2})?$/i.exec(s);
    if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
    m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(s);
    if (m) return [m[1], m[2], m[3]].map((v) => clamp(Math.round(Number(v)), 0, 255));
    return null;
  }

  const toHex = (rgb) => "#" + rgb.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("").toUpperCase();

  /** A cor normalizada ("#RRGGBB") ou null. */
  function color(value) {
    const c = parseColor(value);
    return c ? toHex(c) : null;
  }

  /** Mistura duas cores (t = 0 → a, t = 1 → b). */
  function mix(a, b, t) {
    const A = parseColor(a);
    const B = parseColor(b);
    if (!A || !B) return color(a) || color(b) || "#000000";
    return toHex(A.map((v, i) => lerp(v, B[i], clamp(t))));
  }

  /** Cor com transparência: rgba("#E8473C", 0.3) → "rgba(232,71,60,0.3)". */
  function rgba(value, alpha) {
    const c = parseColor(value);
    if (!c) return String(value);
    return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + Math.round(clamp(alpha) * 1000) / 1000 + ")";
  }

  /** Luminância relativa (0 preto, 1 branco), como nas regras de contraste. */
  function luminance(value) {
    const c = parseColor(value);
    if (!c) return 0;
    const lin = (v) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  }

  /** Contraste entre duas cores, de 1 (iguais) a 21 (preto no branco). Texto corrido pede 4,5; letra grande, 3. */
  function contrast(a, b) {
    const la = luminance(a);
    const lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  /** A primeira candidata legível sobre `bg` (contraste ≥ min); nenhuma serve: a melhor entre elas, o branco e o quase preto. */
  function readableOn(bg, candidates, min) {
    const need = min === undefined ? 4.5 : min;
    const list = (candidates || []).map(color).filter(Boolean);
    for (const c of list) if (contrast(c, bg) >= need) return c;
    let best = null;
    for (const c of list.concat(["#FFFFFF", "#0B0B0C"])) {
      const k = contrast(c, bg);
      if (!best || k > best.k + 1e-9) best = { c, k };
    }
    return color(best.c);
  }

  /** Um mundo: o fundo, a tinta e tudo o que se deriva deles com contraste garantido. */
  function makeWorld(name, bg, ink, accent, given) {
    const g = given || {};
    const light = luminance(bg) > 0.35;
    const text = contrast(ink, bg) >= 4.5 ? ink : readableOn(bg, [], 4.5);
    const surfaceOk = g.surface && contrast(g.surface, bg) >= 1.03 && contrast(text, g.surface) >= 4.5;
    const surface = surfaceOk ? g.surface : mix(bg, text, light ? 0.06 : 0.1);
    let muted = g.muted && contrast(g.muted, bg) >= 4.5 && contrast(g.muted, surface) >= 3.5 ? g.muted : null;
    if (!muted) {
      let k = 0.42;
      muted = mix(text, bg, k);
      while ((contrast(muted, bg) < 4.5 || contrast(muted, surface) < 4.5) && k > 0) {
        k = Math.max(0, k - 0.04);
        muted = mix(text, bg, k);
      }
    }
    let soft = mix(text, bg, 0.14);
    if (contrast(soft, bg) < 4.5) soft = text;
    const fill = contrast(accent, bg) >= 1.3 ? accent : text;
    const accentText = contrast(accent, bg) >= 3 ? accent : text;
    const onAccent = readableOn(fill, [bg, text], 4.5);
    return { name, light, bg, ink: text, surface, muted, soft, line: rgba(text, 0.16), accent: fill, accentText, onAccent, onSurface: text };
  }

  /**
   * A paleta completa a partir de { background, text, accent, surface?, muted? }: completa o que falta, troca a tinta
   * que não dá leitura e monta os dois mundos da marca (o nativo e o invertido). `prefer` = "dark" | "light" | "native".
   */
  function derivePalette(input, prefer) {
    const p = input || {};
    const bg = color(p.background) || "#101012";
    const rawText = color(p.text) || (luminance(bg) > 0.35 ? "#141414" : "#F5F3EE");
    const text = contrast(rawText, bg) >= 4.5 ? rawText : readableOn(bg, [], 4.5);
    const accent = color(p.accent) || text;
    const native = makeWorld("native", bg, text, accent, { surface: color(p.surface), muted: color(p.muted) });
    const nativeLight = native.light;
    // o mundo invertido: o texto da marca vira o fundo, levado ao extremo quando é um tom médio
    let invBg = text;
    for (let k = 0.1; k <= 1.0001; k += 0.1) {
      if (nativeLight ? luminance(invBg) <= 0.045 : luminance(invBg) >= 0.8) break;
      invBg = mix(text, nativeLight ? "#000000" : "#FFFFFF", k);
    }
    const invInk = contrast(bg, invBg) >= 7 ? bg : readableOn(invBg, [bg], 7);
    const inverse = makeWorld("inverse", invBg, invInk, accent, {});
    const light = nativeLight ? native : inverse;
    const dark = nativeLight ? inverse : native;
    const main = prefer === "dark" ? dark : prefer === "light" ? light : native;
    const alt = main === native ? inverse : native;
    return {
      background: main.bg, surface: main.surface, text: main.ink, accent: main.accent, muted: main.muted,
      onAccent: main.onAccent, accentText: main.accentText, line: main.line,
      brand: { background: bg, text, accent },
      worlds: { main, alt, native, inverse, light, dark },
    };
  }

  /** Retângulo arredondado que aceita qualquer medida: largura ou altura sem área não desenha nada, e o raio nunca é negativo. */
  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    if (!(w > 0) || !(h > 0)) return false;
    M.roundRect(g, x, y, w, h, Math.max(0, Math.min(Number(r) || 0, w / 2, h / 2)));
    return true;
  }

  // ---------------------------------------------------------------------------------------------
  // Números
  // ---------------------------------------------------------------------------------------------

  /** Número no padrão brasileiro: 1234.5 → "1.234,5"; formatNumber(199.9, 2) → "199,90". Sem `decimals`, até duas casas. */
  function formatNumber(value, decimals) {
    const v = Number(value);
    if (!isFinite(v)) return String(value);
    let d = decimals;
    if (d === undefined || d === null) {
      if (Math.abs(v - Math.round(v)) < 1e-9) d = 0;
      else d = Math.abs(v * 10 - Math.round(v * 10)) < 1e-9 ? 1 : 2;
    }
    d = Math.max(0, d | 0);
    const fixed = Math.abs(v).toFixed(d);
    const parts = fixed.split(".");
    const int = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return (v < 0 ? "-" : "") + int + (d ? "," + parts[1] : "");
  }

  /** "1.234,56" → 1234.56; "2.000" → 2000; "1.5" → 1.5 (ponto seguido de três dígitos é milhar). */
  function parsePtNumber(raw) {
    const text = String(raw);
    let int = text;
    let dec = "";
    const comma = text.lastIndexOf(",");
    if (comma >= 0) {
      int = text.slice(0, comma);
      dec = text.slice(comma + 1);
    } else {
      const dot = text.lastIndexOf(".");
      if (dot >= 0 && text.length - dot - 1 !== 3) {
        int = text.slice(0, dot);
        dec = text.slice(dot + 1);
      }
    }
    dec = dec.replace(/\D/g, "");
    const value = Number(int.replace(/\D/g, "") + (dec ? "." + dec : ""));
    return { value: isFinite(value) ? value : null, decimals: dec ? Math.min(2, dec.length) : 0 };
  }

  /**
   * Um valor como aparece num anúncio → as partes para desenhar: parseAmount("12x de R$ 49,90") =
   * { prefix: "12x de R$ ", value: 49.9, decimals: 2, suffix: "" }. Um número puro ganha as casas que tiver.
   */
  function parseAmount(input) {
    if (typeof input === "number" && isFinite(input)) {
      return { prefix: "", value: input, decimals: Math.abs(input - Math.round(input)) < 1e-9 ? 0 : 2, suffix: "", text: null };
    }
    const s = String(input === undefined || input === null ? "" : input).trim();
    const found = [];
    const re = /\d[\d.,]*/g;
    let m;
    while ((m = re.exec(s))) found.push({ raw: m[0].replace(/[.,]+$/, ""), index: m.index });
    if (!found.length) return { prefix: "", value: null, decimals: 0, suffix: "", text: s };
    let pick = found[found.length - 1];
    for (const item of found) {
      if (/(R\$|US\$|\$|€|£)\s*$/i.test(s.slice(0, item.index))) {
        pick = item;
        break;
      }
    }
    const parsed = parsePtNumber(pick.raw);
    return { prefix: s.slice(0, pick.index), value: parsed.value, decimals: parsed.decimals, suffix: s.slice(pick.index + pick.raw.length), text: s };
  }

  // ---------------------------------------------------------------------------------------------
  // Linha do tempo
  // ---------------------------------------------------------------------------------------------

  /**
   * As cenas na grade de batidas: beat_s = 60 / bpm; bar_s = beats_per_bar × beat_s; a cena k começa na soma dos
   * compassos anteriores. Devolve { scenes: [{ ...cena, index, start, end, duration, beats, events }], beat_s, bar_s,
   * bars, duration, cuts }, com os cortes nos inícios das cenas 2…n e cada evento com o seu tempo absoluto `t`.
   */
  function computeTimeline(roteiro) {
    const r = roteiro || {};
    const bpm = Number(r.bpm) > 0 ? Number(r.bpm) : 120;
    const per = Number(r.beats_per_bar) > 0 ? Number(r.beats_per_bar) : 4;
    const fps = Number(r.fps) > 0 ? Number(r.fps) : 30;
    const beatS = 60 / bpm;
    const barS = per * beatS;
    const list = Array.isArray(r.scenes) ? r.scenes.filter((s) => s && typeof s === "object") : [];
    const scenes = [];
    let bars = 0;
    list.forEach((scene, index) => {
      const own = Number(scene.bars) > 0 ? Number(scene.bars) : 1;
      const start = round6(bars * barS);
      bars = round6(bars + own);
      const end = round6(bars * barS);
      const events = (Array.isArray(scene.events) ? scene.events : [])
        .filter((e) => e && isFinite(Number(e.beat)) && filled(e.type))
        .map((e) => Object.assign({}, e, { beat: Number(e.beat), t: round6(start + Number(e.beat) * beatS) }));
      scenes.push(Object.assign({}, scene, { index, bars: own, start, end, duration: round6(end - start), beats: round6(own * per), events }));
    });
    return { bpm, beats_per_bar: per, fps, beat_s: beatS, bar_s: barS, bars, duration: round6(bars * barS), scenes, cuts: scenes.slice(1).map((s) => s.start) };
  }

  // ---------------------------------------------------------------------------------------------
  // Texto que cabe (matemática pura: recebe uma função que mede)
  // ---------------------------------------------------------------------------------------------

  const splitWords = (text) => String(text).trim().split(/\s+/).filter(Boolean);

  const STOP = new Set("a o as os um uma uns umas de da do das dos e em no na nos nas por para pra com sem que se seu sua seus suas meu minha teu tua ao aos à às é só já the of to and in on for your an is".split(" "));
  const CURRENCY = /^(r\$|us\$|\$|€|£)$/i;

  const bare = (word) => String(word).toLocaleLowerCase("pt-BR").replace(/^[^\p{L}\p{N}%$€£]+|[^\p{L}\p{N}%$€£]+$/gu, "");

  /**
   * Qual palavra carrega o destaque. `hint` pode ser a própria palavra (ou expressão), um índice ou false (nenhuma).
   * Sem pista: um número (com a moeda antes e a unidade depois), senão a última palavra de conteúdo.
   * Devolve { from, to } (índices das palavras) ou null.
   */
  function pickEmphasis(words, hint) {
    if (hint === false) return null;
    const list = (words || []).map(bare);
    if (!list.length) return null;
    if (typeof hint === "number" && list[hint] !== undefined) return { from: hint, to: hint };
    if (filled(hint)) {
      const want = splitWords(hint).map(bare).filter(Boolean);
      for (let i = 0; want.length && i + want.length <= list.length; i++) {
        let ok = true;
        for (let j = 0; j < want.length; j++) if (list[i + j] !== want[j]) ok = false;
        if (ok) return { from: i, to: i + want.length - 1 };
      }
    }
    const digit = list.findIndex((w) => /\d/.test(w));
    if (digit >= 0) {
      const from = digit > 0 && CURRENCY.test(list[digit - 1]) ? digit - 1 : digit;
      const next = list[digit + 1];
      const unit = next !== undefined && next.length >= 2 && !STOP.has(next) && !/\d/.test(next);
      return { from, to: unit ? digit + 1 : digit };
    }
    for (let i = list.length - 1; i >= 0; i--) if (list[i].length >= 3 && !STOP.has(list[i])) return { from: i, to: i };
    return { from: list.length - 1, to: list.length - 1 };
  }

  /**
   * Onde quebrar para as linhas ficarem equilibradas: `count` linhas com larguras tão parecidas quanto der
   * (a menor soma dos quadrados). widths = largura de cada palavra; space = largura do espaço. Devolve o índice
   * da primeira palavra de cada linha, ou null quando não cabe em `count` linhas dentro de maxWidth.
   */
  function balanceBreaks(widths, space, count, maxWidth) {
    const n = widths.length;
    if (count < 1 || count > n) return null;
    const prefix = [0];
    for (let i = 0; i < n; i++) prefix.push(prefix[i] + widths[i]);
    const lineWidth = (a, b) => prefix[b] - prefix[a] + space * (b - a - 1);
    const best = [];
    const cut = [];
    for (let l = 0; l <= count; l++) {
      best.push(new Array(n + 1).fill(Infinity));
      cut.push(new Array(n + 1).fill(-1));
    }
    best[0][0] = 0;
    for (let l = 1; l <= count; l++) {
      for (let i = l; i <= n; i++) {
        for (let j = l - 1; j < i; j++) {
          if (best[l - 1][j] === Infinity) continue;
          const w = lineWidth(j, i);
          if (w > maxWidth + 0.5) continue;
          const cost = best[l - 1][j] + w * w;
          if (cost < best[l][i] - 1e-9) {
            best[l][i] = cost;
            cut[l][i] = j;
          }
        }
      }
    }
    if (best[count][n] === Infinity) return null;
    const starts = [];
    let i = n;
    for (let l = count; l >= 1; l--) {
      starts.unshift(cut[l][i]);
      i = cut[l][i];
    }
    return starts;
  }

  /** Quantas linhas a quebra gulosa precisa (Infinity quando uma palavra sozinha não cabe). */
  function greedyCount(widths, space, maxWidth) {
    let lines = 1;
    let w = 0;
    for (let i = 0; i < widths.length; i++) {
      if (widths[i] > maxWidth + 0.5) return Infinity;
      const next = w === 0 ? widths[i] : w + space + widths[i];
      if (next > maxWidth + 0.5) {
        lines++;
        w = widths[i];
      } else w = next;
    }
    return lines;
  }

  /** Parte uma palavra longa demais em pedaços que cabem (de preferência depois de "/", ".", "-" ou "_"). */
  function breakWord(measure, word, size, maxWidth) {
    const out = [];
    let rest = word;
    while (rest.length > 1 && measure(rest, size) > maxWidth) {
      let end = rest.length - 1;
      while (end > 1 && measure(rest.slice(0, end), size) > maxWidth) end--;
      let soft = -1;
      for (let i = end; i > Math.max(1, end - 8); i--) {
        if ("/.-_".indexOf(rest[i - 1]) >= 0) {
          soft = i;
          break;
        }
      }
      const at = soft > 0 ? soft : end;
      out.push(rest.slice(0, at));
      rest = rest.slice(at);
    }
    out.push(rest);
    return out;
  }

  /**
   * O maior tamanho de fonte (de `size` até `minSize`) em que o texto cabe em maxWidth × maxHeight com no máximo
   * maxLines linhas equilibradas. `measure(texto, tamanho)` devolve a largura em px. "\n" no texto força a quebra.
   * Devolve { size, lineHeight, lines: [{ text, width, words: [{ text, x, width, index }] }], width, height, fits }.
   */
  function fitText(measure, text, options) {
    const o = options || {};
    let paragraphs = String(text === undefined || text === null ? "" : text).split(/\n/).map(splitWords).filter((p) => p.length);
    if (!paragraphs.length) paragraphs = [[""]];
    const maxLines = Math.max(paragraphs.length, o.maxLines || 3);
    const lh = o.lineHeight || 1.05;
    const top = Math.max(1, Math.round(o.size || 100));
    const min = Math.max(1, Math.min(top, Math.round(o.minSize || top * 0.5)));
    const step = o.step || 2;
    const maxWidth = Math.max(1, o.maxWidth || 1000);

    const compose = (size, last) => {
      const space = measure(" ", size);
      let total = 0;
      const plan = [];
      for (const source of paragraphs) {
        let words = source;
        let widths = words.map((w) => measure(w, size));
        if (last && widths.some((w) => w > maxWidth + 0.5)) {
          words = [].concat.apply([], words.map((w, i) => (widths[i] > maxWidth + 0.5 ? breakWord(measure, w, size, maxWidth) : [w])));
          widths = words.map((w) => measure(w, size));
        }
        const need = greedyCount(widths, space, maxWidth);
        total += need;
        plan.push({ words, widths, need });
      }
      const heightOk = !o.maxHeight || total * size * lh <= o.maxHeight + 0.5;
      const fits = total <= maxLines && heightOk && isFinite(total);
      if (!fits && !last) return null;
      const lines = [];
      let index = 0;
      for (const item of plan) {
        const count = isFinite(item.need) ? item.need : item.words.length;
        const starts = balanceBreaks(item.widths, space, count, maxWidth) || item.words.map((_, i) => i);
        for (let l = 0; l < starts.length; l++) {
          const from = starts[l];
          const to = l + 1 < starts.length ? starts[l + 1] : item.words.length;
          const slice = item.words.slice(from, to);
          const lineText = slice.join(" ");
          const words = [];
          let prefix = "";
          for (const w of slice) {
            words.push({ text: w, x: prefix ? measure(prefix, size) : 0, width: measure(w, size), index: index++ });
            prefix += w + " ";
          }
          lines.push({ text: lineText, width: measure(lineText, size), words });
        }
      }
      const width = lines.reduce((a, l) => Math.max(a, l.width), 0);
      const lineHeight = Math.round(size * lh);
      return { size, lineHeight, lines, width, height: lineHeight * lines.length, fits };
    };

    for (let size = top; ; size = Math.max(min, size - step)) {
      const done = compose(size, size === min);
      if (done) return done;
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Estilos
  // ---------------------------------------------------------------------------------------------

  /**
   * Os cinco estilos. Cada um muda coisas concretas: o mundo (claro ou escuro), a escala e o peso do tipo, como o
   * destaque aparece, como as imagens são emolduradas, quais transições ligam as cenas e quanta coisa cabe na tela.
   */
  const STYLES = {
    "interface-narra": {
      id: "interface-narra", label: "A interface narra",
      world: "dark",
      type: { scale: 1, weight: 800, uppercase: false, tracking: -0.022, lineHeight: 1.02, maxLines: 3 },
      emphasis: "block", frame: "device", visual: 0.62, radius: 44, shadow: 0.42,
      hookExit: "zoom", between: "whip", echo: true, chips: true, cursor: true, detail: true, drift: 0.025,
      springs: { type: "heavy", ui: "snappy", move: "default" },
    },
    "interface-que-se-transforma": {
      id: "interface-que-se-transforma", label: "Interface que se transforma",
      world: "light",
      type: { scale: 0.9, weight: 700, uppercase: false, tracking: -0.02, lineHeight: 1.05, maxLines: 3 },
      emphasis: "underline", frame: "device", visual: 0.58, radius: 56, shadow: 0.2,
      hookExit: "lift", between: "push", echo: false, chips: false, cursor: true, detail: true, drift: 0.02,
      springs: { type: "type", ui: "snappy", move: "default" },
    },
    limpo: {
      id: "limpo", label: "Limpo",
      world: "native",
      type: { scale: 0.82, weight: 700, uppercase: false, tracking: -0.018, lineHeight: 1.08, maxLines: 3 },
      emphasis: "underline", frame: "card", visual: 0.52, radius: 36, shadow: 0.16,
      hookExit: "lift", between: "push", echo: false, chips: false, cursor: false, detail: true, drift: 0.015,
      springs: { type: "heavy", ui: "default", move: "heavy" },
    },
    "tipografia-cinetica": {
      id: "tipografia-cinetica", label: "Tipografia cinética",
      world: "dark",
      type: { scale: 1.22, weight: 900, uppercase: true, tracking: -0.03, lineHeight: 0.95, maxLines: 5 },
      emphasis: "block", frame: "card", visual: 0.42, radius: 18, shadow: 0,
      hookExit: "zoom", between: "streak", echo: true, chips: true, cursor: false, detail: false, drift: 0.03,
      springs: { type: "heavy", ui: "snappy", move: "snappy" },
    },
    vitrine: {
      id: "vitrine", label: "Vitrine",
      world: "light",
      type: { scale: 0.94, weight: 800, uppercase: false, tracking: -0.022, lineHeight: 1.03, maxLines: 3 },
      emphasis: "block", frame: "bleed", visual: 0.68, radius: 52, shadow: 0.3,
      hookExit: "zoom", between: "whip", echo: true, chips: true, cursor: true, detail: true, drift: 0.03,
      springs: { type: "heavy", ui: "snappy", move: "default" },
    },
  };

  const DEFAULT_STYLE = { lancamento: "interface-narra", interface: "interface-que-se-transforma", oferta: "vitrine", lista: "tipografia-cinetica" };

  /** O estilo de um id; um id desconhecido (ou um estilo descrito por referência) cai no padrão do roteiro. */
  function styleFor(id, template) {
    const key = typeof id === "string" && STYLES[id] ? id : DEFAULT_STYLE[template] || "interface-narra";
    return STYLES[key];
  }

  // ---------------------------------------------------------------------------------------------
  // Geometria
  // ---------------------------------------------------------------------------------------------

  /** A área segura de um tamanho de quadro: a do formato de mesma proporção (ou da mais próxima), na escala do quadro. */
  function safeRect(width, height) {
    let best = null;
    for (const name of Object.keys(M.SAFE)) {
      const s = M.SAFE[name];
      const ratio = s.width / s.height;
      const diff = Math.abs(width / height - ratio) / ratio;
      if (!best || diff < best.diff - 1e-9) best = { name, diff, s };
    }
    const s = best.s;
    const sx = width / s.width;
    const sy = height / s.height;
    return { x: s.left * sx, y: s.top * sy, w: width - (s.left + s.right) * sx, h: height - (s.top + s.bottom) * sy, format: best.name };
  }

  /** Um retângulo com vários alvos no tempo: keys = [[tempo, { x, y, w, h, r }], ...]; uma mola por mudança, nada reinicia. */
  function rectAt(t, keys, k, d) {
    const out = {};
    for (const prop of ["x", "y", "w", "h", "r"]) {
      out[prop] = M.track(t, keys.map((key) => [key[0], num(key[1][prop], 0)]), k === undefined ? 170 : k, d === undefined ? 26 : d);
    }
    out.w = Math.max(0, out.w);
    out.h = Math.max(0, out.h);
    out.r = Math.max(0, out.r);
    return out;
  }

  /** Um número com vários alvos no tempo: valueAt(t, [[tempo, valor], ...], "default"). */
  function valueAt(t, keys, preset) {
    const p = M.SPRINGS[preset] || M.SPRINGS.default;
    return M.track(t, keys, p[0], p[1]);
  }

  /** Que moldura combina com uma imagem de tela: celular para telas em pé; janela para telas deitadas e páginas largas. */
  function frameFor(record) {
    if (!record || !record.ok || !record.w || !record.h) return { kind: "phone", aspect: 2.1, scrollable: false };
    const a = record.h / record.w;
    if (a >= 2.4) return record.w <= 900 ? { kind: "phone", aspect: 2.1, scrollable: true } : { kind: "window", aspect: 0.66, scrollable: true };
    if (a >= 1.5) return { kind: "phone", aspect: clamp(a, 1.9, 2.17), scrollable: false };
    return { kind: "window", aspect: clamp(a, 0.56, 1.25), scrollable: false };
  }

  /**
   * A rolagem (0–1) que põe um ponto da página no meio da parte da tela que se vê. `at` é a altura do ponto na imagem,
   * de 0 (o topo da página) a 1 (o fim); `rect` é a tela no quadro; `window` é o trecho vertical visível do quadro
   * ({ y, h }, em geral a área segura); `zoom` como em device().
   */
  function scrollFor(record, rect, at, window, zoom) {
    if (!record || !record.w || !record.h || !rect || rect.w <= 0) return clamp(at);
    const vw = record.w / Math.max(1, num(zoom, 1));
    const k = rect.w / vw;
    const room = record.h - rect.h / k;
    if (room <= 1) return clamp(at);
    const top = window ? Math.max(rect.y, window.y) : rect.y;
    const bottom = window ? Math.min(rect.y + rect.h, window.y + window.h) : rect.y + rect.h;
    const middle = ((top + bottom) / 2 - rect.y) / k;
    return clamp((clamp(at) * record.h - middle) / room);
  }

  // ---------------------------------------------------------------------------------------------
  // Carga: o roteiro, a linha do tempo, a paleta, as fontes, o estilo e as imagens
  // ---------------------------------------------------------------------------------------------

  const Studio = { version: VERSION, ready: false, loading: null, roteiro: null, timeline: null, palette: null, worlds: null, fonts: null, style: null, seed: 1, images: {}, logoImage: null };

  function family(value, fallback) {
    const f = filled(value) ? value.trim() : "";
    if (!f) return fallback;
    return GENERIC_FAMILY.test(f) ? f : f + ", " + FALLBACK_SANS;
  }

  function readRoteiro() {
    const doc = global.document;
    const node = doc && doc.getElementById ? doc.getElementById("roteiro") : null;
    if (!node) throw new Error('A página não traz o roteiro: falta o bloco <script id="roteiro" type="application/json">.');
    const source = String(node.textContent || "").trim();
    if (!source || source.indexOf("__ROTEIRO") === 0) throw new Error("A página ainda não recebeu o roteiro: o bloco de dados está vazio.");
    try {
      return JSON.parse(source);
    } catch (error) {
      throw new Error("O roteiro da página não é um JSON válido: " + error.message);
    }
  }

  /** O que dá para saber de uma imagem olhando os pixels (o tom e a transparência); null quando o navegador não deixa ler. */
  function inspectImage(img) {
    try {
      const doc = global.document;
      const N = 40;
      const off = doc.createElement("canvas");
      off.width = N;
      off.height = N;
      const og = off.getContext("2d", { willReadFrequently: true });
      og.drawImage(img, 0, 0, N, N);
      const data = og.getImageData(0, 0, N, N).data;
      let weight = 0;
      let r = 0;
      let gr = 0;
      let b = 0;
      let opaque = 0;
      for (let i = 0; i < N * N; i++) {
        const a = data[i * 4 + 3] / 255;
        if (a > 0.5) opaque++;
        weight += a;
        r += data[i * 4] * a;
        gr += data[i * 4 + 1] * a;
        b += data[i * 4 + 2] * a;
      }
      if (weight <= 0) return { coverage: 0, color: null };
      return { coverage: opaque / (N * N), color: toHex([r / weight, gr / weight, b / weight]) };
    } catch (error) {
      return null;
    }
  }

  function loadImage(src) {
    const record = { src, img: null, ok: false, w: 0, h: 0, info: null };
    if (typeof global.Image !== "function") return Promise.resolve(record);
    return new Promise((resolve) => {
      const img = new global.Image();
      const done = (ok) => {
        record.ok = Boolean(ok) && (img.naturalWidth || img.width) > 0;
        record.img = img;
        record.w = img.naturalWidth || img.width || 0;
        record.h = img.naturalHeight || img.height || 0;
        resolve(record);
      };
      img.onload = () => {
        if (typeof img.decode === "function") img.decode().then(() => done(true), () => done(true));
        else done(true);
      };
      img.onerror = () => done(false);
      img.src = src;
    });
  }

  /**
   * Lê o roteiro da página (ou o objeto passado em { roteiro }), calcula Studio.timeline, Studio.palette, Studio.fonts
   * e Studio.style na hora, e começa a carregar as imagens que o roteiro cita. Devolve uma promessa que resolve quando
   * a página pode desenhar; imagem ausente ou quebrada também resolve, e o componente desenha a alternativa.
   */
  function load(options) {
    const o = options || {};
    const raw = o.roteiro || readRoteiro();
    const r = Object.assign({}, raw);
    r.width = Number(r.width) > 0 ? Number(r.width) : 1080;
    r.height = Number(r.height) > 0 ? Number(r.height) : 1920;
    r.fps = Number(r.fps) > 0 ? Number(r.fps) : 30;
    r.brand = Object.assign({ name: "", site: "", handle: "", logo: null }, r.brand || {});
    r.scenes = Array.isArray(r.scenes) ? r.scenes : [];
    Studio.roteiro = r;
    Studio.timeline = computeTimeline(r);
    Studio.style = styleFor(r.style, r.template);
    Studio.palette = derivePalette(r.palette, Studio.style.world);
    Studio.worlds = Studio.palette.worlds;
    const fonts = r.fonts || {};
    Studio.fonts = { headline: family(fonts.headline, FALLBACK_SANS), body: family(fonts.body || fonts.headline, FALLBACK_SANS) };
    Studio.seed = Number(r.music && r.music.seed) > 0 ? Math.round(Number(r.music.seed)) : hashSeed(r.title || r.template || "video");
    Studio.images = {};
    Studio.logoImage = null;
    Studio.logoNote = null;
    Studio.ready = false;

    const wanted = [];
    const want = (src) => {
      if (filled(src) && wanted.indexOf(src) < 0) wanted.push(src);
    };
    want(r.brand.logo);
    for (const scene of r.scenes) {
      want(scene.screen);
      want(scene.image);
    }
    Studio.loading = Promise.all(wanted.map(loadImage)).then((records) => {
      for (const record of records) Studio.images[record.src] = record;
      const logo = filled(r.brand.logo) ? Studio.images[r.brand.logo] : null;
      if (logo && logo.ok) {
        // um logo vetorial cresce sem perder nitidez; um logo de pixels só cresce até 25% além do tamanho dele, e
        // abaixo de 80 px de altura ele ficaria borrado nos 100 px mínimos: nesse caso entra o nome da marca
        logo.vector = /\.svg(?:[?#].*)?$/i.test(logo.src) || /^data:image\/svg/i.test(logo.src);
        logo.maxH = logo.vector ? Infinity : logo.h * 1.25;
        if (logo.vector || logo.h >= 80) {
          logo.info = inspectImage(logo.img);
          Studio.logoImage = logo;
        } else Studio.logoNote = "pequeno";
      }
      Studio.ready = true;
      return Studio;
    });
    return Studio.loading;
  }

  /** A imagem carregada de um caminho do roteiro, ou null quando ele não existe ou não abriu. */
  function image(src) {
    const record = filled(src) ? Studio.images[src] : null;
    return record && record.ok ? record : null;
  }

  // ---------------------------------------------------------------------------------------------
  // O palco: o canvas, o quadro, as cenas, as caixas
  // ---------------------------------------------------------------------------------------------

  function stage(canvas, options) {
    if (!Studio.timeline) throw new Error("Chame Studio.load() antes de Studio.stage().");
    if (!canvas || typeof canvas.getContext !== "function") throw new Error('A página precisa de um <canvas> (id "c").');
    const o = options || {};
    const R = Studio.roteiro;
    const TL = Studio.timeline;
    const g = canvas.getContext("2d");
    const noise = M.noise1d(Studio.seed);
    const renderers = {};
    const overrides = {};
    const under = [];
    const over = [];
    const worldByRole = {};
    const layoutCache = new Map();
    const metricsCache = new Map();
    const inkCache = new Map();
    let boxList = [];
    let deferred = [];
    let lastT = null;
    const xf = [{ a: 1, e: 0, f: 0, alpha: 1 }];

    const S = {
      canvas, g, noise, fps: TL.fps, q: Q,
      hasSpacing: typeof g.letterSpacing === "string",
      W: 0, H: 0, u: 1, minText: 44, vertical: true, format: "9:16", safe: null, area: null, T: 0, index: 0,
    };

    function resize(width, height, name) {
      canvas.width = width;
      canvas.height = height;
      S.W = width;
      S.H = height;
      S.vertical = height >= width;
      S.u = Math.min(width, height) / 1080;
      S.minText = Math.ceil((44 * width) / 1080);
      const safe = safeRect(width, height);
      S.safe = { x: safe.x, y: safe.y, w: safe.w, h: safe.h };
      S.format = name || safe.format;
      const pad = Math.round(20 * S.u);
      S.area = { x: safe.x + pad, y: safe.y + pad, w: safe.w - 2 * pad, h: safe.h - 2 * pad };
      layoutCache.clear();
      S.rev = (S.rev || 0) + 1;
      if (global.film) {
        global.film.width = width;
        global.film.height = height;
      }
    }

    /** O Motor chama antes do primeiro quadro quando o formato muda: a página recompõe, nunca corta. */
    S.setFormat = (f) => {
      const width = Number(f && f.width) || S.W;
      const height = Number(f && f.height) || S.H;
      resize(width, height, f && f.name);
      lastT = null;
    };

    S.px = (n) => Math.round(n * S.u);
    /** Tamanho de um texto de apoio: nunca abaixo do mínimo legível do formato. */
    S.type = (n) => Math.max(S.minText, Math.round(n * S.u));

    // ----- transformações de grupo (escala uniforme e deslocamento) e transparência herdada -----

    /**
     * Desenha `fn` dentro de um grupo: { scale, about: [x, y], dx, dy, alpha, report }. As caixas declaradas dentro
     * acompanham a transformação; com report: false (um grupo saindo num chicote) elas não são declaradas.
     */
    S.group = (p, fn) => {
      const q = p || {};
      const top = xf[xf.length - 1];
      const scale = num(q.scale, 1);
      const cx = q.about ? q.about[0] : S.W / 2;
      const cy = q.about ? q.about[1] : S.H / 2;
      const e = cx + num(q.dx, 0) - cx * scale;
      const f = cy + num(q.dy, 0) - cy * scale;
      xf.push({ a: top.a * scale, e: top.a * e + top.e, f: top.a * f + top.f, alpha: top.alpha * clamp(num(q.alpha, 1)), mute: top.mute || q.report === false });
      g.save();
      g.translate(e, f);
      g.scale(scale, scale);
      try {
        return fn();
      } finally {
        g.restore();
        xf.pop();
      }
    };
    S.alpha = () => xf[xf.length - 1].alpha;
    S.setAlpha = (a) => {
      g.globalAlpha = clamp(S.alpha() * (a === undefined ? 1 : a));
    };

    // ----- caixas para a conferência -----

    /** Declara uma caixa (role: "text", "logo" ou "ui") do que está legível agora; `size` é o tamanho da letra em px. */
    S.box = (role, x, y, w, h, size, text) => {
      if (!(w > 0) || !(h > 0)) return;
      const m = xf[xf.length - 1];
      if (m.alpha < 0.5 || m.mute) return;
      const box = { role, x: r1(m.a * x + m.e), y: r1(m.a * y + m.f), w: r1(m.a * w), h: r1(m.a * h) };
      if (size) box.size = r1(size * m.a);
      if (text !== undefined && text !== null) box.text = String(text).slice(0, 80);
      boxList.push(box);
    };

    /**
     * Quanto uma caixa (no sistema do grupo atual) ainda pode crescer em volta de um ponto sem sair da área segura:
     * 1 = nada; 1,1 = 10%. Serve para limitar socos e antecipações de texto que ainda está sendo lido.
     */
    S.room = (box, about) => {
      const m = xf[xf.length - 1];
      const bx = m.a * box.x + m.e;
      const by = m.a * box.y + m.f;
      const bw = m.a * box.w;
      const bh = m.a * box.h;
      const px = m.a * about[0] + m.e;
      const py = m.a * about[1] + m.f;
      const s = S.safe;
      let z = Infinity;
      if (bx < px - 0.5) z = Math.min(z, (px - s.x) / (px - bx));
      if (bx + bw > px + 0.5) z = Math.min(z, (s.x + s.w - px) / (bx + bw - px));
      if (by < py - 0.5) z = Math.min(z, (py - s.y) / (py - by));
      if (by + bh > py + 0.5) z = Math.min(z, (s.y + s.h - py) / (by + bh - py));
      return Math.max(1, isFinite(z) ? z - 0.002 : 4);
    };

    /** As caixas do instante t (redesenha quando t não é o último quadro desenhado). */
    S.boxes = (t) => {
      const stale = lastT === null || (t !== undefined && t !== null && Math.abs(Number(t) - lastT) > 1e-6);
      if (stale && Studio.ready) draw(t === undefined || t === null ? 0 : Number(t));
      return boxList.slice();
    };

    // ----- texto: fonte, medidas e composição com cache -----

    S.setFont = (font, size) => {
      g.font = font.weight + " " + size + "px " + font.family;
      if (S.hasSpacing) g.letterSpacing = (font.tracking ? Math.round(font.tracking * size * 100) / 100 : 0) + "px";
    };
    /** Mede sem mudar a fonte do contexto: quem mede no meio de um desenho não estraga o texto que vem em seguida. */
    const keepFont = (fn) => {
      const font = g.font;
      const spacing = S.hasSpacing ? g.letterSpacing : null;
      try {
        return fn();
      } finally {
        g.font = font;
        if (S.hasSpacing) g.letterSpacing = spacing;
      }
    };
    S.measure = (text, font, size) =>
      keepFont(() => {
        S.setFont(font, size);
        return g.measureText(text).width;
      });

    /** Medidas de uma fonte como frações do tamanho: altura das maiúsculas, dos acentos, das descendentes e dos dígitos. */
    S.metrics = (font) => {
      const key = font.family + "|" + font.weight;
      const cached = metricsCache.get(key);
      if (cached) return cached;
      return keepFont(() => {
      const size = 200;
      S.setFont({ family: font.family, weight: font.weight, tracking: 0 }, size);
      const read = (text, field, fallback) => {
        const value = g.measureText(text)[field];
        return typeof value === "number" && isFinite(value) && value > 0 ? value / size : fallback;
      };
      const cap = read("H", "actualBoundingBoxAscent", 0.72);
      const asc = Math.max(cap, read("ÁÊÔ", "actualBoundingBoxAscent", 0.94));
      const desc = read("gjpqy", "actualBoundingBoxDescent", 0.22);
      let digitW = 0;
      let lowest = cap;
      let deepest = 0;
      for (const d of "0123456789") {
        const m = g.measureText(d);
        digitW = Math.max(digitW, m.width / size);
        lowest = Math.min(lowest, typeof m.actualBoundingBoxAscent === "number" ? m.actualBoundingBoxAscent / size : cap);
        deepest = Math.max(deepest, typeof m.actualBoundingBoxDescent === "number" ? m.actualBoundingBoxDescent / size : 0);
      }
      const result = { cap, asc, desc, digitW: digitW || 0.6, oldstyle: deepest > 0.08 || lowest < cap * 0.82 };
      metricsCache.set(key, result);
      return result;
      });
    };

    /** A tinta de um texto: quanto ele sobe e desce a partir da linha de base, em px (acentos e descendentes só quando existem). */
    S.ink = (text, font, size) => {
      const key = font.family + "|" + font.weight + "|" + size + "|" + text;
      const cached = inkCache.get(key);
      if (cached) return cached;
      const met = S.metrics(font);
      const m = keepFont(() => {
        S.setFont(font, size);
        return g.measureText(text);
      });
      const up = typeof m.actualBoundingBoxAscent === "number" && isFinite(m.actualBoundingBoxAscent) ? m.actualBoundingBoxAscent : met.cap * size;
      const down = typeof m.actualBoundingBoxDescent === "number" && isFinite(m.actualBoundingBoxDescent) ? m.actualBoundingBoxDescent : met.desc * size;
      const result = { asc: Math.max(up, met.cap * size * 0.7), desc: Math.max(0, down) };
      if (inkCache.size > 800) inkCache.clear();
      inkCache.set(key, result);
      return result;
    };

    /** A fonte dos números: a do título, a não ser que os dígitos dela subam e desçam (algarismos de texto). */
    S.numberFont = (weight) => {
      const st = Studio.style.type;
      const head = { family: Studio.fonts.headline, weight: weight || st.weight, tracking: -0.02 };
      if (!S.metrics(head).oldstyle) return head;
      const body = { family: Studio.fonts.body, weight: 800, tracking: -0.02 };
      if (!S.metrics(body).oldstyle) return body;
      return { family: FALLBACK_SANS, weight: 800, tracking: -0.02 };
    };

    /** Compõe um texto na caixa pedida (linhas equilibradas, o maior tamanho que cabe). Resultado em cache. */
    S.layout = (text, q) => {
      const key = [text, q.family, q.weight, q.tracking, q.size, q.minSize, Math.round(q.maxWidth), Math.round(q.maxHeight || 0), q.maxLines, q.lineHeight].join("\u0001");
      const cached = layoutCache.get(key);
      if (cached) return cached;
      const font = { family: q.family, weight: q.weight, tracking: q.tracking };
      const result = fitText((value, size) => S.measure(value, font, size), text, q);
      if (layoutCache.size > 600) layoutCache.clear();
      layoutCache.set(key, result);
      return result;
    };

    // ----- cenas e camadas -----

    /** Registra o desenho de um papel: S.scene("gancho", { lead, tail }, (c) => {...}); lead e tail em segundos. */
    S.scene = (role, a, b) => {
      const fn = typeof a === "function" ? a : b;
      const opts = typeof a === "function" ? {} : a || {};
      renderers[role] = { fn, lead: num(opts.lead, 0), tail: num(opts.tail, 0) };
      return S;
    };
    /** Troca o desenho de uma cena só, pelo número dela (`n` no roteiro): S.sceneAt(3, { lead, tail }, (c) => {...}). */
    S.sceneAt = (n, a, b) => {
      const fn = typeof a === "function" ? a : b;
      const opts = typeof a === "function" ? {} : a || {};
      overrides[String(n)] = { fn, lead: num(opts.lead, 0), tail: num(opts.tail, 0) };
      return S;
    };
    /** Camadas do filme inteiro: `under` desenha depois do fundo, `over` por cima de todas as cenas (o cursor, o trilho). */
    S.under = (fn) => {
      under.push(fn);
      return S;
    };
    S.over = (fn) => {
      over.push(fn);
      return S;
    };
    /** Em que mundo cada papel acontece: S.worlds({ prova: "alt", fechamento: "native" }). O padrão é "main". */
    S.worlds = (map) => {
      Object.assign(worldByRole, map || {});
      return S;
    };
    S.worldOf = (scene) => {
      const pick = scene ? worldByRole[scene.role] : null;
      const name = typeof pick === "function" ? pick(scene) : pick;
      return Studio.worlds[name] || Studio.worlds.main;
    };

    const rendererOf = (scene) => overrides[String(scene.n)] || renderers[scene.role] || null;

    function indexAt(T) {
      const list = TL.scenes;
      for (let i = list.length - 1; i >= 0; i--) if (T >= list[i].start - 1e-9) return i;
      return 0;
    }

    /** O contexto de uma cena no instante T: o tempo local, a batida local, o mundo e as ajudas de grade. */
    function contextFor(j, T) {
      const scene = TL.scenes[j];
      const t = T - scene.start;
      const c = {
        S, g, T, t, b: t / TL.beat_s, q: Q, dur: scene.duration, beats: scene.beats, left: scene.end - T,
        scene, index: j, count: TL.scenes.length, prev: TL.scenes[j - 1] || null, next: TL.scenes[j + 1] || null, role: scene.role,
        live: T >= scene.start - 1e-9 && T < scene.end - 1e-9, world: S.worldOf(scene),
        W: S.W, H: S.H, safe: S.safe, area: S.area, u: S.u,
      };
      /** Segundos locais da batida n. */
      c.beat = (n) => n * TL.beat_s;
      /** Segundos desde a batida n desta cena (negativo antes dela): o argumento das molas. */
      c.since = (n) => t - n * TL.beat_s;
      /** A batida do primeiro evento de um tipo nesta cena, ou `fallback`. */
      c.hit = (type, fallback) => {
        const found = scene.events.find((e) => e.type === type);
        return found ? found.beat : fallback;
      };
      /** As batidas de todos os eventos de um tipo nesta cena. */
      c.hits = (type) => scene.events.filter((e) => e.type === type).map((e) => e.beat);
      /** Desenha por cima de todas as cenas deste quadro. */
      c.top = (fn) => deferred.push(fn);
      return c;
    }
    S.context = (j, T) => contextFor(j, T === undefined ? S.T : T);

    function reset() {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
      g.shadowColor = "rgba(0,0,0,0)";
      g.shadowBlur = 0;
      g.shadowOffsetX = 0;
      g.shadowOffsetY = 0;
      g.lineCap = "butt";
      g.lineJoin = "miter";
      g.textAlign = "left";
      g.textBaseline = "alphabetic";
      if (S.hasSpacing) g.letterSpacing = "0px";
    }

    function draw(t) {
      const T = clamp(Number(t) || 0, 0, Math.max(0, TL.duration - 1e-4));
      lastT = Number(t) || 0;
      boxList = [];
      deferred = [];
      xf.length = 1;
      reset();
      if (!TL.scenes.length) {
        g.fillStyle = Studio.palette.background;
        g.fillRect(0, 0, S.W, S.H);
        return true;
      }
      const k = indexAt(T);
      S.T = T;
      S.index = k;
      const current = TL.scenes[k];
      const world = S.worldOf(current);
      const frame = { S, g, T, t: T, b: T / TL.beat_s, q: Q, W: S.W, H: S.H, safe: S.safe, area: S.area, u: S.u, index: k, scene: current, world, count: TL.scenes.length };
      frame.since = (seconds) => T - seconds;
      frame.context = (j) => contextFor(j, T);
      if (o.background !== false) background(frame);
      for (const fn of under) fn(frame);
      for (let j = TL.scenes.length - 1; j >= 0; j--) {
        const scene = TL.scenes[j];
        const r = rendererOf(scene);
        if (!r) continue;
        if (T >= scene.start - r.lead - 1e-9 && T < scene.end + r.tail - 1e-9) {
          reset();
          r.fn(contextFor(j, T));
        }
      }
      for (const fn of deferred) {
        reset();
        fn();
      }
      for (const fn of over) {
        reset();
        fn(frame);
      }
      reset();
      return true;
    }
    S.draw = draw;

    /** window.seek: desenha o instante t. Antes de as imagens carregarem, devolve a promessa da carga e desenha em seguida. */
    S.seek = (t) => {
      if (Studio.ready) return draw(t);
      return (Studio.loading || Promise.resolve()).then(() => draw(t));
    };

    resize(num(o.width, R.width), num(o.height, R.height), R.format);
    return S;
  }

  // ---------------------------------------------------------------------------------------------
  // Fundo e deriva
  // ---------------------------------------------------------------------------------------------

  /** O fundo do mundo da cena com uma forma enorme a cerca de 3% de contraste, derivando devagar (com semente). */
  function background(c, world) {
    const S = c.S;
    const g = S.g;
    const W = world || c.world;
    const T = num(c.T, 0);
    g.globalAlpha = 1;
    g.fillStyle = W.bg;
    g.fillRect(0, 0, S.W, S.H);
    const span = Math.max(S.W, S.H);
    const x = S.W * 0.5 + S.noise(T * 0.11 + 3) * S.W * 0.12;
    const y = S.H * 0.58 + S.noise(T * 0.11 + 47) * S.H * 0.06;
    const kick = bump({ b: T / Studio.timeline.beat_s }, 2, 0);              // a forma respira a cada 2 batidas
    const r = span * 0.44 * (1 + 0.05 * S.noise(T * 0.07 + 91)) * (1 + 0.02 * kick);
    g.fillStyle = rgba(W.light ? "#000000" : "#FFFFFF", W.light ? 0.03 : 0.035);
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }

  /** A deriva de uma segura: de 1 até 1 + amount ao longo da cena (até 3%). Use como escala de um S.group. */
  function drift(c, amount) {
    const a = Math.min(0.03, amount === undefined ? Studio.style.drift : amount);
    return 1 + a * clamp(c.t / Math.max(1e-6, c.dur));
  }

  /**
   * O respiro na batida: 0 na maior parte do tempo e 1 em cada batida `from`, `from + every`, … (sobe num quadro e
   * desce em meia batida). Multiplicado por 1,5 a 3% de escala, mantém viva uma cena que segura, no ritmo da música.
   */
  function bump(c, every, from) {
    const per = Math.max(0.25, num(every, 2));
    const start = num(from, 0);
    const k = Math.max(0, Math.round((c.b - start) / per));
    const d = c.b - (start + k * per);
    if (c.b < start - per / 2) return 0;
    // sobe em um quadro e desce em meia batida: um tranco leve no tempo da música
    return d < 0 ? Math.exp(-(d * d) / (0.05 * 0.05)) : Math.exp(-d / 0.14);
  }

  /** O fator de escala de um respiro: breathe = { amount, every, from } (padrão 1,5% a cada 2 batidas). */
  function breathOf(c, breathe, room) {
    if (!breathe) return 1;
    const amount = Math.min(num(breathe.amount, 0.015), Math.max(0, num(room, Infinity) - 1));
    return 1 + amount * bump(c, breathe.every, breathe.from);
  }

  /** A cena nova que nasce em 55% e assenta em 12 quadros, depois de uma travessia: escala para um S.group. */
  function born(c, atBeat) {
    const T = c.beat(num(atBeat, 0));
    return 0.55 + 0.45 * ease.outExpo(phase(c.t, T - Q, T + 11 * Q));
  }


  // ---------------------------------------------------------------------------------------------
  // Texto: título cinético, corpo e rótulo
  // ---------------------------------------------------------------------------------------------

  function typeSpec(S, kind, o) {
    const st = Studio.style.type;
    const F = Studio.fonts;
    if (kind === "body") {
      return { family: F.body, weight: num(o.weight, 500), tracking: num(o.tracking, 0), lineHeight: num(o.lineHeight, 1.22), uppercase: Boolean(o.uppercase), size: S.type(54), minSize: S.minText, maxLines: 3 };
    }
    if (kind === "label") {
      return { family: F.body, weight: num(o.weight, 700), tracking: num(o.tracking, 0.08), lineHeight: num(o.lineHeight, 1.15), uppercase: o.uppercase !== false, size: S.type(46), minSize: S.minText, maxLines: 1 };
    }
    return {
      family: F.headline, weight: num(o.weight, st.weight), tracking: num(o.tracking, st.tracking), lineHeight: num(o.lineHeight, st.lineHeight),
      uppercase: o.uppercase === undefined ? st.uppercase : Boolean(o.uppercase), size: S.px(150 * st.scale), minSize: Math.max(S.minText, S.px(60)), maxLines: st.maxLines,
    };
  }

  /**
   * Um bloco de texto na caixa { x, y, w, h } (padrão: a área útil), no maior tamanho que cabe.
   *   kind: "headline" | "body" | "label"; align, valign; size, minSize, maxLines; color.
   *   cover: true        já assentado desde o início da cena (o quadro 0 é a capa); punch: batida do soco de entrada.
   *   at: batida         entra nessa batida; by: "line" | "word" | "block"; stagger: batidas entre uma unidade e a seguinte;
   *                      in: "rise" (sobe por trás de uma máscara) | "slam" (entra maior e pousa) | "fade" (só para apoio).
   *   emphasis: { words, at, style: "block" | "underline" }   o destaque de uma palavra, que pousa na batida `at`.
   *   out: { at, style: "zoom" | "whip" | "lift" | "cut", dir: [dx, dy] }   como sai (padrão: corte no fim da cena).
   * Devolve a geometria final { x, y, w, h, top, bottom, right, size, lines, key } mesmo quando ainda não desenhou.
   */
  function text(c, value, options) {
    const o = options || {};
    const S = c.S;
    const g = S.g;
    const W = o.world || c.world;
    const kind = o.kind || "headline";
    const spec = typeSpec(S, kind, o);
    if (o.font) Object.assign(spec, { family: o.font.family || spec.family, weight: o.font.weight || spec.weight, tracking: o.font.tracking === undefined ? spec.tracking : o.font.tracking });
    const A = c.area;
    const box = { x: num(o.x, A.x), y: num(o.y, A.y), w: Math.max(10, num(o.w, A.w)), h: Math.max(10, num(o.h, A.h)) };
    const raw = spec.uppercase ? String(value).toLocaleUpperCase("pt-BR") : String(value === undefined || value === null ? "" : value);
    const font = { family: spec.family, weight: spec.weight, tracking: spec.tracking };
    const minSize = Math.max(S.minText, Math.round(num(o.minSize, spec.minSize)));
    const lay = S.layout(raw, {
      family: spec.family, weight: spec.weight, tracking: spec.tracking, lineHeight: spec.lineHeight,
      size: Math.max(minSize, Math.round(num(o.size, spec.size))), minSize,
      maxWidth: box.w, maxHeight: box.h, maxLines: o.maxLines || spec.maxLines,
    });
    const met = S.metrics(font);
    const size = lay.size;
    const lh = lay.lineHeight;
    const count = lay.lines.length;
    const cap = met.cap * size;
    const asc = met.asc * size;
    const desc = met.desc * size;
    const inkH = (count - 1) * lh + cap;
    const align = o.align || "left";
    const valign = o.valign || "top";
    const inks = lay.lines.map((line) => S.ink(line.text, font, size));
    // no topo, a tinta mais alta da primeira linha (um acento, por exemplo) encosta em y; sem acento, as maiúsculas
    const rise = Math.max(0, inks[0].asc - cap);
    const sink = inks[count - 1].desc;
    const top = valign === "middle" ? box.y + (box.h - inkH) / 2 : valign === "bottom" ? box.y + box.h - inkH - sink : box.y + rise;
    const lines = lay.lines.map((line, i) => ({
      text: line.text, width: line.width, words: line.words, base: top + cap + i * lh, asc: inks[i].asc, desc: inks[i].desc,
      x: align === "center" ? box.x + (box.w - line.width) / 2 : align === "right" ? box.x + box.w - line.width : box.x,
    }));
    const left = lines.reduce((a, l) => Math.min(a, l.x), Infinity);
    const right = lines.reduce((a, l) => Math.max(a, l.x + l.width), -Infinity);
    const geometry = { x: left, y: top - rise, w: right - left, h: inkH + rise + sink, top, bottom: top + inkH + sink, right, size, lineHeight: lh, lines, key: null, font };

    // o destaque: uma palavra (ou duas vizinhas na mesma linha)
    const em = o.emphasis && o.emphasis !== false ? (typeof o.emphasis === "object" ? o.emphasis : {}) : null;
    const emStyle = em ? em.style || Studio.style.emphasis : null;
    let keyLine = -1;
    if (em) {
      const total = lines.reduce((a, l) => a + l.words.length, 0);
      const all = [];
      for (const l of lines) for (const w of l.words) all.push(w.text);
      const pick = total ? pickEmphasis(all, em.words) : null;
      if (pick) {
        for (let i = 0; i < lines.length && keyLine < 0; i++) {
          const inside = lines[i].words.filter((w) => w.index >= pick.from && w.index <= pick.to);
          if (inside.length) {
            const first = inside[0];
            const last = inside[inside.length - 1];
            const padX = emStyle === "block" ? size * 0.13 : 0;
            const padY = emStyle === "block" ? size * 0.13 : 0;
            keyLine = i;
            const words = inside.map((w) => w.text).join(" ");
            const wink = S.ink(words, font, size);
            const up = Math.max(cap, wink.asc);
            const down = Math.max(desc * 0.25, wink.desc);
            geometry.key = emStyle === "block"
              ? { x: lines[i].x + first.x - padX, y: lines[i].base - up - padY, w: last.x + last.width - first.x + 2 * padX, h: up + down + 2 * padY, r: size * 0.1, from: first.index, to: last.index }
              : { x: lines[i].x + first.x, y: lines[i].base + size * 0.11, w: last.x + last.width - first.x, h: Math.max(S.px(8), size * 0.085), r: size * 0.04, from: first.index, to: last.index };
          }
        }
      }
    }
    if (o.measure) return geometry;

    // tempo
    const bs = c.beat(1);
    const cover = Boolean(o.cover) || o.at === undefined || o.at === null;
    const at = cover ? 0 : Number(o.at);
    const by = o.by || "line";
    const stagger = num(o.stagger, by === "word" ? 0.25 : 0.5);
    const style = o.in || "rise";
    const preset = o.spring || (kind === "headline" ? Studio.style.springs.type : "type");
    const out = o.out || {};
    const outAt = out.at === undefined || out.at === null ? c.beats : Number(out.at);
    const outStyle = out.style || "cut";
    const Tout = outAt * bs;
    const dir = out.dir || [0, -1];
    const punchAt = o.punch === undefined || o.punch === null || o.punch === false ? null : Number(o.punch) * bs;
    const punchAmount = num(o.punchAmount, 0.045);
    const ink = o.color || (kind === "label" ? W.muted : kind === "body" ? W.soft : W.ink);
    const cx = geometry.x + geometry.w / 2;
    const cy = geometry.y + geometry.h / 2;
    const pivot = geometry.key ? [geometry.key.x + geometry.key.w / 2, geometry.key.y + geometry.key.h / 2] : [cx, cy];
    const emAt = em ? (em.at === undefined || em.at === null ? null : Number(em.at) * bs) : null;
    const emColor = em ? em.color || W.accent : null;
    const emInk = em ? em.textColor || (emStyle === "block" ? W.onAccent : null) : null;

    function paint(tt, alphaMul, report) {
      if (tt < (cover ? -1e-9 : at * bs - 1e-9)) return;
      if (outStyle === "zoom" ? tt >= Tout : tt >= Tout - 1e-9) return;
      // o bloco inteiro: soco de entrada, antecipação e saída
      let scale = 1;
      let dx = 0;
      let dy = 0;
      let alpha = 1;
      let about = [cx, cy];
      let leaving = 0;
      const inkBox = { x: geometry.x, y: geometry.y, w: geometry.w, h: geometry.h };
      if (punchAt !== null && tt >= punchAt) scale *= 1 + Math.min(punchAmount, S.room(inkBox, [cx, cy]) - 1) * (1 - ease.outExpo(phase(tt, punchAt, punchAt + 12 * Q)));
      if (o.breathe && tt < Tout - 14 * Q) scale *= breathOf({ b: tt / bs }, o.breathe, S.room(inkBox, [cx, cy]) / scale);
      if (outStyle === "zoom") {
        // antecipação: o texto ainda é lido, então cresce só até a borda da área segura; a rajada é a travessia
        const ant = ease.inQuad(phase(tt, Tout - 14 * Q, Tout - 4 * Q));
        const raj = Math.pow(phase(tt, Tout - 4 * Q, Tout), 3);
        const z = 1 + Math.min(0.15, S.room(inkBox, pivot) - 1) * ant + 6 * raj;
        if (z !== 1) {
          about = pivot;
          scale *= z;
        }
        alpha *= 1 - 0.45 * phase(tt, Tout - 2 * Q, Tout);
        leaving = tt >= Tout - 4 * Q ? 1 : 0;
      } else if (outStyle === "whip") {
        const ant = Math.sin(Math.PI * phase(tt, Tout - 13 * Q, Tout - 4 * Q));
        const raj = ease.inExpo(phase(tt, Tout - 4 * Q, Tout));
        const dist = dir[0] !== 0 ? S.W * 1.1 : S.H * 0.7;
        dx += dir[0] * (dist * raj - S.px(14) * ant);
        dy += dir[1] * (dist * raj - S.px(14) * ant);
        alpha *= 1 - phase(tt, Tout - 1 * Q, Tout);
        leaving = tt >= Tout - 4 * Q ? 1 : 0;
      }
      if (alpha * alphaMul <= 0.003) return;

      S.group({ scale, about, dx, dy, alpha: alpha * alphaMul }, () => {
        // o destaque por baixo do texto
        let emGrow = 0;
        if (geometry.key && emAt !== null) emGrow = tt >= emAt ? M.springBy("snappy", tt - emAt) : 0;
        else if (geometry.key) emGrow = 1;
        if (geometry.key && outStyle === "lift") emGrow *= 1 - ease.inOutCubic(phase(tt, Tout - 12 * Q, Tout - 5 * Q));
        if (geometry.key && emGrow > 0.001) {
          const k = geometry.key;
          S.setAlpha(1);
          g.fillStyle = emColor;
          roundRect(g, k.x, k.y, Math.max(0, k.w * emGrow), k.h, k.r);
          g.fill();
        }
        let union = null;
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const lineTop = line.base - asc - 2;
          const lineH = asc + desc + 4;
          for (let j = 0; j < line.words.length; j++) {
            const word = line.words[j];
            const order = by === "word" ? word.index : by === "line" ? i : 0;
            const t0 = (at + order * stagger) * bs;
            let s = cover ? 1 : tt >= t0 ? M.springBy(preset, tt - t0) : 0;
            if (!cover && tt < t0) continue;
            let wy = 0;
            let wAlpha = 1;
            let wScale = 1;
            let clip = null;
            if (!cover && s < 0.9995) {
              if (style === "rise") {
                wy = (1 - s) * lineH;
                clip = [line.x - size * 0.12, lineTop, line.width + size * 0.24, lineH];
              } else if (style === "slam") {
                const e = ease.outExpo(phase(tt, t0, t0 + 12 * Q));
                wScale = 1 + 0.35 * (1 - e);
                wAlpha = clamp((tt - t0) / Q + 1);
                s = e;
              } else if (style === "fade") {
                wAlpha = clamp(s * 1.4);
                wy = (1 - s) * S.px(22);
              }
            }
            // saída calma: cada linha sobe por trás da própria máscara
            if (outStyle === "lift") {
              const e = ease.inOutCubic(phase(tt, Tout - (11 - Math.min(i, 3)) * Q, Tout - Q));
              if (e > 0) {
                wy -= e * lineH;
                clip = [line.x - size * 0.12, lineTop, line.width + size * 0.24, lineH];
                leaving = Math.max(leaving, e);
              }
            }
            if (wAlpha <= 0.003) continue;
            const wx = line.x + word.x;
            g.save();
            if (clip) {
              g.beginPath();
              g.rect(clip[0], clip[1], clip[2], clip[3]);
              g.clip();
            }
            if (wScale !== 1) {
              const px = wx + word.width / 2;
              const py = line.base - cap / 2;
              g.translate(px, py);
              g.scale(wScale, wScale);
              g.translate(-px, -py);
            }
            S.setAlpha(wAlpha);
            S.setFont(font, size);
            g.textAlign = "left";
            g.textBaseline = "alphabetic";
            g.fillStyle = ink;
            g.fillText(word.text, wx, line.base + wy);
            // a palavra em destaque muda de tinta onde o bloco já passou
            if (geometry.key && emInk && emGrow > 0.001 && i === keyLine && word.index >= geometry.key.from && word.index <= geometry.key.to) {
              g.beginPath();
              g.rect(geometry.key.x, lineTop, geometry.key.w * emGrow, lineH);
              g.clip();
              g.fillStyle = emInk;
              g.fillText(word.text, wx, line.base + wy);
            }
            g.restore();
            if (s >= 0.6 && wAlpha >= 0.5 && wScale <= 1.02) {
              const px = wx + word.width / 2;
              const py = line.base - cap / 2;
              const bx = px + (wx - px) * wScale;
              const shift = clip ? 0 : wy;                                   // com máscara, o que se vê fica na linha
              const byTop = py + (line.base - line.asc + shift - py) * wScale;
              const r = px + (wx + word.width - px) * wScale;
              const b = py + (line.base + line.desc + shift - py) * wScale;
              union = union ? { x: Math.min(union.x, bx), y: Math.min(union.y, byTop), r: Math.max(union.r, r), b: Math.max(union.b, b) } : { x: bx, y: byTop, r, b };
            }
          }
        }
        if (report && union && leaving < 0.5 && o.report !== false) {
          S.box(o.role || "text", union.x, union.y, union.r - union.x, union.b - union.y, size, raw);
        }
      });

      // travessia: as bordas do destaque viram dois riscos que atravessam o quadro
      if (outStyle === "zoom" && out.streaks !== false && alphaMul >= 1) {
        const raj = Math.pow(phase(tt, Tout - 4 * Q, Tout), 3);
        if (raj > 0.001) {
          const z = 1 + 0.15 + 6 * raj;
          const k = geometry.key || { x: cx - geometry.w * 0.25, y: cy - size * 0.4, w: geometry.w * 0.5, h: size * 0.8 };
          const half = (k.h / 2) * z;
          const x = k.x - S.W * 1.5 * raj;
          const w = k.w + S.W * 3 * raj;
          const thick = Math.max(3, S.px(10));
          S.setAlpha(1);
          g.fillStyle = (em && em.color) || W.accent;
          g.fillRect(x, pivot[1] - half - thick / 2, w, thick);
          g.fillRect(x, pivot[1] + half - thick / 2, w, thick);
        }
      }
    }

    // rastro (eco) só na rajada de um chicote
    if (outStyle === "whip" && Studio.style.echo && out.echo !== false && c.t > Tout - 4 * Q && c.t < Tout) {
      paint(c.t - 3 * Q, 0.12, false);
      paint(c.t - 2 * Q, 0.25, false);
      paint(c.t - 1 * Q, 0.45, false);
    }
    paint(c.t, 1, true);

    // os riscos da travessia duram dois quadros depois do corte
    if (outStyle === "zoom" && out.streaks !== false && c.t >= Tout && c.t < Tout + 2 * Q) {
      const k = geometry.key || { x: cx - geometry.w * 0.25, y: cy - size * 0.4, w: geometry.w * 0.5, h: size * 0.8 };
      const half = (k.h / 2) * 7.15;
      const thick = Math.max(3, S.px(10));
      S.setAlpha(1 - phase(c.t, Tout, Tout + 2 * Q));
      g.fillStyle = (em && em.color) || W.accent;
      g.fillRect(-S.W, pivot[1] - half - thick / 2, S.W * 3, thick);
      g.fillRect(-S.W, pivot[1] + half - thick / 2, S.W * 3, thick);
    }
    return geometry;
  }

  /** Título cinético: o maior tipo da cena, com o destaque de uma palavra ligado por padrão. */
  const headline = (c, value, o) => text(c, value, Object.assign({ kind: "headline", emphasis: {} }, o || {}));
  /** Texto de apoio (uma a três linhas). */
  const body = (c, value, o) => text(c, value, Object.assign({ kind: "body", in: "fade" }, o || {}));
  /** Rótulo: CAIXA ALTA, espaçado, uma linha. */
  const label = (c, value, o) => text(c, value, Object.assign({ kind: "label", in: "rise" }, o || {}));

  // ---------------------------------------------------------------------------------------------
  // Etiqueta (chip) que nasce, fica e pode virar risco
  // ---------------------------------------------------------------------------------------------

  /**
   * Uma etiqueta em pílula: chip(c, "01", { x, y, at, size, color, textColor, align, out: { at, style } }).
   * Nasce esticando a partir de um círculo (mola ágil) e o texto aparece depois do começo da mudança. Saídas:
   * "cut" (some no corte), "whip" (sai num chicote, como o texto ao lado) e "streak" (estica até virar um risco
   * de tela inteira; o corte acontece atrás dele, na batida).
   */
  function chip(c, value, options) {
    const o = options || {};
    const S = c.S;
    const g = S.g;
    const W = o.world || c.world;
    const font = { family: Studio.fonts.body, weight: 800, tracking: 0.04 };
    const str = String(value);
    const A = c.area;
    let size = Math.round(num(o.size, S.type(44)));
    const limit = num(o.maxWidth, A.w);
    while (size > S.minText && S.measure(str, font, size) + Math.round(size * 0.72) * 2 > limit) size -= 2;
    const tw = S.measure(str, font, size);
    const h = Math.round(size * 1.85);
    const padX = Math.round(size * 0.72);
    const w = Math.max(h, tw + padX * 2);
    const x = o.align === "right" ? num(o.x, A.x + A.w) - w : o.align === "center" ? num(o.x, A.x + A.w / 2) - w / 2 : num(o.x, A.x);
    const y = num(o.y, A.y);
    const geometry = { x, y, w, h, r: h / 2, bottom: y + h, right: x + w, size };
    if (o.measure) return geometry;
    const bs = c.beat(1);
    const at = o.at === undefined || o.at === null ? null : Number(o.at) * bs;
    const out = o.out || {};
    const Tout = (out.at === undefined || out.at === null ? c.beats : Number(out.at)) * bs;
    const dir = out.dir || [0, -1];

    function paint(t, alphaMul, report) {
      if (at !== null && t < at) return;
      if (t >= Tout + (out.style === "streak" ? 2 * Q : 0)) return;
      const grow = at === null ? 1 : M.springBy("snappy", t - at);
      let sx = 1;
      let sy = 1;
      let alpha = 1;
      let dx = 0;
      let dy = 0;
      let leaving = 0;
      let textFade = 0;
      if (out.style === "streak") {
        // estica um fio em 1 quadro, vira risco de tela inteira em 4 e o corte acontece atrás dele
        const stretch = 0.3 * phase(t, Tout - 5 * Q, Tout - 4 * Q);
        leaving = Math.pow(phase(t, Tout - 4 * Q, Tout), 2);
        sx = 1 + stretch + ((S.W * 2.4) / w) * leaving;
        sy = 1 - 0.45 * leaving;
        alpha = 1 - phase(t, Tout, Tout + 2 * Q);
        textFade = clamp(leaving * 6 + stretch * 3.4);
      } else if (out.style === "whip" || out.style === "lift") {
        const ant = Math.sin(Math.PI * phase(t, Tout - 13 * Q, Tout - 4 * Q));
        leaving = ease.inExpo(phase(t, Tout - 4 * Q, Tout));
        const dist = dir[0] !== 0 ? S.W * 1.1 : S.H * 0.7;
        dx = dir[0] * (dist * leaving - S.px(14) * ant);
        dy = dir[1] * (dist * leaving - S.px(14) * ant);
        alpha = 1 - phase(t, Tout - Q, Tout);
      }
      if (alpha * alphaMul <= 0.003) return;
      const base = lerp(h, w, grow);
      const cw = base * sx;
      const ch = h * sy;
      const cx = x + base / 2 + (out.style === "streak" ? (S.W / 2 - (x + w / 2)) * leaving : 0) + dx;
      const cy = y + h / 2 + dy;
      S.setAlpha(alpha * alphaMul);
      g.fillStyle = o.color || W.accent;
      roundRect(g, cx - cw / 2, cy - ch / 2, cw, ch, ch / 2);
      g.fill();
      const textAlpha = (at === null ? 1 : clamp((t - at - 0.06) / 0.1)) * (1 - textFade);
      if (textAlpha > 0.01) {
        g.save();
        roundRect(g, x + dx, y + dy, base, h, h / 2);
        g.clip();
        S.setAlpha(alpha * alphaMul * textAlpha);
        S.setFont(font, size);
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillStyle = o.textColor || W.onAccent;
        g.fillText(str, x + w / 2 + dx, y + h / 2 + size * 0.04 + dy);
        g.restore();
        if (report && textAlpha >= 0.5 && grow > 0.9 && leaving < 0.02) S.box("text", x + padX, y + (h - size * 1.1) / 2, tw, size * 1.1, size, str);
      }
      if (report && leaving < 0.02) S.box("ui", x, y, base, h);
    }

    if (out.style === "whip" && Studio.style.echo && c.t > Tout - 4 * Q && c.t < Tout) {
      paint(c.t - 3 * Q, 0.12, false);
      paint(c.t - 2 * Q, 0.25, false);
      paint(c.t - 1 * Q, 0.45, false);
    }
    paint(c.t, 1, true);
    return geometry;
  }

  // ---------------------------------------------------------------------------------------------
  // Tela em moldura (celular ou janela) e cartão de imagem
  // ---------------------------------------------------------------------------------------------

  function softShadow(S, strength, size) {
    const g = S.g;
    const k = clamp(strength);
    if (k <= 0.001) return;
    g.shadowColor = "rgba(0,0,0," + Math.round(0.5 * k * 1000) / 1000 + ")";
    g.shadowBlur = Math.round(size * 0.11 + 24 * S.u);
    g.shadowOffsetY = Math.round(size * 0.05 + 10 * S.u);
    g.shadowOffsetX = 0;
  }

  /**
   * Uma tela real dentro de uma moldura: device(c, { rect, kind, image, scroll, blur, assemble, chrome, fill, monogram }).
   *   rect: { x, y, w, h, r } é a TELA (a moldura cresce em volta); kind: "phone" | "window".
   *   image: a imagem carregada (Studio.image(caminho)); scroll: 0–1 de uma tela alta, ou função (quadrosAtrás) → 0–1
   *   para o borrão direcional do chicote (blur: true mistura 8 posições dentro de um quadro); zoom: aproxima o conteúdo.
   *   assemble: 0–1, a tela se monta em faixas que sobem (0 = só a cor da marca, 1 = tela completa).
   *   chrome: 0–1, quanto da moldura aparece. Sem imagem: a cor da marca, a inicial dela e barras de conteúdo ilegíveis.
   */
  function device(c, options) {
    const o = options || {};
    const S = c.S;
    const g = S.g;
    const W = o.world || c.world;
    const r = o.rect;
    const kind = o.kind || "phone";
    const alpha = num(o.alpha, 1);
    if (!r || r.w <= 1 || r.h <= 1 || alpha <= 0.003) return r;
    const chrome = clamp(num(o.chrome, 1));
    const phone = kind === "phone";
    const bezel = phone ? r.w * 0.03 * chrome : 0;
    const rad = Math.min(num(r.r, phone ? r.w * 0.105 : S.px(26)), r.w / 2, r.h / 2);
    const shadow = num(o.shadow, Studio.style.shadow);
    S.setAlpha(alpha);
    g.save();
    softShadow(S, shadow * chrome, r.w);
    g.fillStyle = phone ? "#0B0B0D" : o.fill || W.surface;
    roundRect(g, r.x - bezel, r.y - bezel, r.w + 2 * bezel, r.h + 2 * bezel, rad + bezel);
    g.fill();
    g.restore();
    if (phone && chrome > 0.05) {
      S.setAlpha(alpha * chrome);
      g.lineWidth = Math.max(1, S.px(2));
      g.strokeStyle = W.light ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.2)";
      roundRect(g, r.x - bezel, r.y - bezel, r.w + 2 * bezel, r.h + 2 * bezel, rad + bezel);
      g.stroke();
    }
    S.setAlpha(alpha);
    g.save();
    roundRect(g, r.x, r.y, r.w, r.h, rad);
    g.clip();
    g.fillStyle = o.fill || W.accent;
    g.fillRect(r.x, r.y, r.w, r.h);
    const rec = o.image && o.image.ok ? o.image : null;
    const assemble = clamp(num(o.assemble, 1));
    if (rec) {
      const scrollAt = typeof o.scroll === "function" ? o.scroll : () => num(o.scroll, 0);
      const zoom = Math.max(1, num(o.zoom, 1));
      // a janela da imagem que a tela mostra: a largura inteira (dividida pelo zoom); numa imagem baixa, a altura inteira
      let vw = rec.w / zoom;
      let vh = (vw * r.h) / r.w;
      if (vh > rec.h) {
        vh = rec.h / zoom;
        vw = (vh * r.w) / r.h;
      }
      const sx = (rec.w - vw) * clamp(o.anchor === undefined ? 0.5 : o.anchor);
      const room = Math.max(0, rec.h - vh);
      const taps = o.blur && room > 1 ? [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875] : [0];
      const bands = assemble >= 0.999 ? 1 : 5;
      const bandH = r.h / bands;
      taps.forEach((back, i) => {
        const a = alpha / (i + 1);
        const sy = room * clamp(scrollAt(back));
        for (let j = 0; j < bands; j++) {
          const e = bands === 1 ? 1 : clamp(assemble * (1 + 0.3 * (bands - 1)) - 0.3 * j);
          if (e <= 0.001) continue;
          const k = ease.outExpo(e);
          S.setAlpha(a);
          if (bands === 1) g.drawImage(rec.img, sx, sy, vw, vh, r.x, r.y, r.w, r.h);
          else {
            // cada faixa sobe para o lugar por trás da própria máscara: sólida desde o primeiro quadro
            g.save();
            g.beginPath();
            g.rect(r.x, r.y + j * bandH - 0.5, r.w, bandH + 1);
            g.clip();
            g.drawImage(rec.img, sx, sy + (j * vh) / bands, vw, vh / bands, r.x, r.y + j * bandH + (1 - k) * bandH, r.w, bandH + 0.6);
            g.restore();
          }
        }
      });
    } else {
      // sem tela: a cor da marca, a inicial e barras de conteúdo ilegíveis de propósito
      const onFill = readableOn(o.fill || W.accent, [W.onAccent, W.bg, W.ink], 3);
      const mono = filled(o.monogram) ? o.monogram.trim().slice(0, 1).toLocaleUpperCase("pt-BR") : "";
      if (mono) {
        const font = { family: Studio.fonts.headline, weight: Studio.style.type.weight, tracking: 0 };
        const size = Math.round(r.w * 0.42);
        S.setAlpha(alpha);
        S.setFont(font, size);
        g.textAlign = "center";
        g.textBaseline = "alphabetic";
        g.fillStyle = onFill;
        g.fillText(mono, r.x + r.w / 2, r.y + r.h * 0.3 + S.metrics(font).cap * size * 0.5);
      }
      const rows = [0.66, 0.5, 0.58];
      rows.forEach((wide, j) => {
        const e = clamp(assemble * 1.6 - 0.2 * (j + 1));
        if (e <= 0.001) return;
        const k = ease.outCubic(e);
        S.setAlpha(alpha * 0.26 * clamp(e * 2));
        g.fillStyle = onFill;
        const bh = r.w * 0.05;
        roundRect(g, r.x + r.w * 0.17, r.y + r.h * (0.5 + j * 0.075) + (1 - k) * r.h * 0.05, r.w * wide, bh, bh / 2);
        g.fill();
      });
    }
    g.restore();
    S.setAlpha(1);
    S.box("ui", r.x - bezel, r.y - bezel, r.w + 2 * bezel, r.h + 2 * bezel);
    return r;
  }

  /**
   * Um cartão: uma imagem recortada (cobre o cartão) ou uma cor. card(c, { rect, image, color, zoom, anchor, alpha, shadow }).
   * `zoom` aproxima a imagem (1 = encaixe exato; a deriva de até 3% entra aqui); `anchor` [x, y] de 0 a 1 escolhe o recorte.
   */
  function card(c, options) {
    const o = options || {};
    const S = c.S;
    const g = S.g;
    const W = o.world || c.world;
    const r = o.rect;
    const alpha = num(o.alpha, 1);
    if (!r || r.w <= 1 || r.h <= 1 || alpha <= 0.003) return r;
    const rad = Math.min(num(r.r, S.px(Studio.style.radius)), r.w / 2, r.h / 2);
    S.setAlpha(alpha);
    g.save();
    softShadow(S, num(o.shadow, Studio.style.shadow), Math.min(r.w, r.h));
    g.fillStyle = o.color || W.surface;
    roundRect(g, r.x, r.y, r.w, r.h, rad);
    g.fill();
    g.restore();
    const rec = o.image && o.image.ok ? o.image : null;
    g.save();
    roundRect(g, r.x, r.y, r.w, r.h, rad);
    g.clip();
    if (rec) {
      const zoom = Math.max(1, num(o.zoom, 1));
      const cover = Math.max(r.w / rec.w, r.h / rec.h) * zoom;
      const sw = r.w / cover;
      const sh = r.h / cover;
      const anchor = o.anchor || [0.5, 0.5];
      S.setAlpha(alpha);
      g.drawImage(rec.img, (rec.w - sw) * clamp(anchor[0]), (rec.h - sh) * clamp(anchor[1]), sw, sh, r.x, r.y, r.w, r.h);
    } else if (o.pattern !== false) {
      // um cartão de cor nunca é chapado: uma forma grande a baixo contraste
      const onFill = readableOn(o.color || W.surface, [W.onAccent, W.ink, W.bg], 3);
      S.setAlpha(alpha * 0.08);
      g.fillStyle = onFill;
      g.beginPath();
      g.arc(r.x + r.w * 0.82, r.y + r.h * 0.2, Math.max(r.w, r.h) * 0.46, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    S.setAlpha(1);
    S.box("ui", r.x, r.y, r.w, r.h);
    return r;
  }

  // ---------------------------------------------------------------------------------------------
  // Cursor
  // ---------------------------------------------------------------------------------------------

  /**
   * O cursor: anda por uma trilha de alvos e aperta nas batidas. cursor(f, { keys: [[t, x, y], ...], presses: [t, ...],
   * until, kind: "arrow" | "touch", color }) com os tempos na mesma base de `f.t` (segundos do filme numa camada
   * `over`; segundos da cena num contexto de cena). O aperto desce em dois quadros, pousa na batida com um pulso de
   * escala e solta uma onda.
   */
  function cursor(f, options) {
    const o = options || {};
    const S = f.S;
    const g = S.g;
    const t = f.t;
    const keys = (o.keys || []).filter((k) => k && k.length >= 3);
    if (!keys.length) return null;
    if (t < keys[0][0] - 1e-9) return null;
    if (o.until !== undefined && o.until !== null && t >= o.until) return null;
    const x = M.track(t, keys.map((k) => [k[0], k[1]]), 150, 25);
    const y = M.track(t, keys.map((k) => [k[0], k[2]]), 150, 25);
    const appear = clamp((t - keys[0][0]) / (3 * Q));
    let press = 0;
    const W = f.world;
    for (const p of o.presses || []) {
      const dt = t - p;
      if (dt >= -2 * Q && dt < 0) press = Math.max(press, ease.outQuad((dt + 2 * Q) / (2 * Q)));
      else if (dt >= 0) press = Math.max(press, 1 - M.springBy("snappy", dt));
      if (dt >= 0 && dt < 14 * Q) {
        const e = ease.outCubic(dt / (14 * Q));
        S.setAlpha(0.55 * (1 - e));
        g.lineWidth = Math.max(2, S.px(6) * (1 - 0.5 * e));
        g.strokeStyle = o.color || (W ? W.accent : "#FFFFFF");
        g.beginPath();
        g.arc(x, y, lerp(S.px(14), S.px(92), e), 0, Math.PI * 2);
        g.stroke();
      }
    }
    const scale = (1 - 0.2 * press) * S.u * num(o.scale, 1.3);
    g.save();
    g.translate(x, y);
    g.scale(scale, scale);
    S.setAlpha(appear);
    g.shadowColor = "rgba(0,0,0,0.35)";
    g.shadowBlur = 14 * S.u;
    g.shadowOffsetY = 5 * S.u;
    if (o.kind === "touch") {
      g.fillStyle = "rgba(255,255,255,0.92)";
      g.beginPath();
      g.arc(0, 0, 26, 0, Math.PI * 2);
      g.fill();
      g.shadowColor = "rgba(0,0,0,0)";
      g.lineWidth = 3;
      g.strokeStyle = "rgba(0,0,0,0.4)";
      g.stroke();
    } else {
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(0, 50);
      g.lineTo(12, 39);
      g.lineTo(20.5, 58);
      g.lineTo(30, 54);
      g.lineTo(21.5, 35.5);
      g.lineTo(37, 35.5);
      g.closePath();
      g.fillStyle = "#FFFFFF";
      g.fill();
      g.shadowColor = "rgba(0,0,0,0)";
      g.lineJoin = "round";
      g.lineWidth = 3.4;
      g.strokeStyle = "#111113";
      g.stroke();
    }
    g.restore();
    S.setAlpha(1);
    S.box("ui", x - 4, y - 4, 44 * scale, 64 * scale);
    return { x, y, press };
  }

  // ---------------------------------------------------------------------------------------------
  // Contador e preço
  // ---------------------------------------------------------------------------------------------

  /** Desenha uma sequência de caracteres em que os dígitos ocupam células iguais (não treme ao rolar). */
  function tabular(S, font, size, chars) {
    const met = S.metrics(font);
    S.setFont(font, size);
    const cell = met.digitW * size + (font.tracking || 0) * size;
    let x = 0;
    const cells = chars.map((ch) => {
      const digit = /\d/.test(ch);
      const w = digit ? cell : S.g.measureText(ch).width;
      const item = { ch, digit, x, w };
      x += w;
      return item;
    });
    return { cells, width: x, cap: met.cap * size, asc: met.asc * size, desc: met.desc * size, cell };
  }

  /**
   * Um número que rola até o valor e fica: counter(c, { value, prefix, suffix, decimals, at, beats, ticks, x, y, w, h,
   * align, size, color }). A rolagem começa na batida `at` e dura `beats` batidas (padrão 1); com `ticks` (uma lista
   * de batidas) ela anda um passo em cada uma. Os dígitos rolam em colunas e param da esquerda para a direita.
   * Formato brasileiro: ponto no milhar, vírgula nas casas. Um sufixo longo (uma palavra) sai menor, na mesma linha.
   */
  function counter(c, options) {
    const o = options || {};
    const S = c.S;
    const g = S.g;
    const W = o.world || c.world;
    const value = Number(o.value) || 0;
    const bodyText = formatNumber(value, o.decimals);
    const prefix = String(o.prefix === undefined || o.prefix === null ? "" : o.prefix);
    const suffixRaw = String(o.suffix === undefined || o.suffix === null ? "" : o.suffix);
    const shortSuffix = suffixRaw.trim().length <= 2 ? suffixRaw.trim() : "";
    const longSuffix = shortSuffix ? "" : suffixRaw.trim();
    const font = S.numberFont(o.weight);
    const small = { family: Studio.fonts.headline, weight: font.weight, tracking: -0.01 };
    const A = c.area;
    const box = { x: num(o.x, A.x), y: num(o.y, A.y), w: Math.max(10, num(o.w, A.w)), h: Math.max(10, num(o.h, A.h)) };
    const chars = Array.from(prefix + bodyText + shortSuffix);
    const gap = (s) => (longSuffix ? s * 0.16 : 0);
    const smallSize = (s) => Math.max(S.minText, Math.round(s * 0.36));
    const widthAt = (s) => tabular(S, font, s, chars).width + gap(s) + (longSuffix ? S.measure(longSuffix, small, smallSize(s)) : 0);
    let size = Math.round(num(o.size, S.px(300)));
    const min = Math.round(num(o.minSize, S.px(96)));
    while (size > min && (widthAt(size) > box.w || size * S.metrics(font).cap > box.h)) size -= 2;
    const row = tabular(S, font, size, chars);
    const total = widthAt(size);
    const align = o.align || "left";
    const left = align === "center" ? box.x + (box.w - total) / 2 : align === "right" ? box.x + box.w - total : box.x;
    const top = o.valign === "middle" ? box.y + (box.h - row.cap) / 2 : box.y;
    const base = top + row.cap;
    const sink = Math.max(0, ...chars.map((ch) => S.ink(ch, font, size).desc));
    const geometry = { x: left, y: top, w: total, h: row.cap + sink, top, base, bottom: base + sink, right: left + total, size };
    if (o.measure) return geometry;

    const at = num(o.at, 0);
    const beats = Math.max(1e-6, num(o.beats, 1));
    if (c.since(at) < 0) return geometry;
    let p;
    if (Array.isArray(o.ticks) && o.ticks.length > 1) {
      p = 0;
      for (const tick of o.ticks) p += M.springBy("snappy", c.since(tick)) / o.ticks.length;
      p = clamp(p);
    } else p = clamp((c.b - at) / beats);
    const slam = 1 + Math.min(0.16, S.room({ x: left, y: base - row.cap, w: total, h: row.cap + row.desc * 0.4 }, [left + total / 2, base - row.cap / 2]) - 1) * (1 - ease.outExpo(phase(c.t, c.beat(at), c.beat(at) + 10 * Q)));
    const boxNow = { x: left, y: base - row.cap, w: total, h: row.cap + row.desc * 0.4 };
    const breath = breathOf(c, o.breathe, S.room(boxNow, [left + total / 2, base - row.cap / 2]) / slam);
    const digits = row.cells.filter((cell) => cell.digit);
    const n = digits.length;
    const rollH = size * 1.02;
    const ink = o.color || W.accentText;
    S.group({ scale: slam * breath, about: [left + total / 2, base - row.cap / 2] }, () => {
      S.setAlpha(1);
      S.setFont(font, size);
      g.textBaseline = "alphabetic";
      g.fillStyle = ink;
      let di = 0;
      for (const cell of row.cells) {
        const x = left + cell.x;
        if (!cell.digit) {
          g.textAlign = "left";
          g.fillText(cell.ch, x, base);
          continue;
        }
        const i = di++;
        const stop = n > 1 ? lerp(0.62, 1, i / (n - 1)) : 1;
        const e = ease.outCubic(clamp(p / stop));
        const pos = Number(cell.ch) - (1 - e) * (6 + 3 * i);
        const d0 = Math.floor(pos);
        const frac = pos - d0;
        g.save();
        g.beginPath();
        g.rect(x - 2, base - row.asc - 2, cell.w + 4, row.asc + row.desc * 0.5 + 4);
        g.clip();
        g.textAlign = "center";
        const cx = x + cell.w / 2;
        g.fillText(String(((d0 % 10) + 10) % 10), cx, base - frac * rollH);
        if (frac > 0.001) g.fillText(String((((d0 + 1) % 10) + 10) % 10), cx, base + (1 - frac) * rollH);
        g.restore();
      }
      if (longSuffix) {
        S.setFont(small, smallSize(size));
        g.textAlign = "left";
        g.fillStyle = o.suffixColor || W.ink;
        g.fillText(longSuffix, left + row.width + gap(size), base);
      }
      {
        S.box("text", left, base - row.cap * 1.03, row.width, row.cap * 1.06, size, prefix + bodyText + shortSuffix);
        if (longSuffix) S.box("text", left + row.width + gap(size), base - smallSize(size), S.measure(longSuffix, small, smallSize(size)), smallSize(size) * 1.25, smallSize(size), longSuffix);
      }
    });
    return geometry;
  }

  /**
   * A etiqueta de preço: o valor grande (a moeda e os centavos menores, no alto), o valor antigo riscado acima.
   * price(c, { value, old, at, oldAt, x, y, w, h, align, size, color }). `value` e `old` aceitam número (199.9) ou
   * o texto como aparece ("R$ 199,90", "12x de R$ 49,90"). O valor entra com um soco na batida `at`.
   */
  function price(c, options) {
    const o = options || {};
    const S = c.S;
    const g = S.g;
    const W = o.world || c.world;
    const P = parseAmount(o.value);
    const A = c.area;
    const box = { x: num(o.x, A.x), y: num(o.y, A.y), w: Math.max(10, num(o.w, A.w)), h: Math.max(10, num(o.h, A.h)) };
    const at = num(o.at, 0);
    if (P.value === null) {
      // não é um número: o texto como veio, com o mesmo soco
      return text(c, P.text || "", { kind: "headline", x: box.x, y: box.y, w: box.w, h: box.h, at, in: "slam", align: o.align, color: o.color || W.accentText, emphasis: false, measure: o.measure, out: o.out || { at: 1e9 }, world: W });
    }
    const font = S.numberFont(o.weight);
    const small = { family: font.family, weight: font.weight, tracking: 0 };
    const sub = { family: Studio.fonts.body, weight: 600, tracking: 0 };
    const hasCurrencyOnly = typeof o.value === "number";
    const prefixRaw = hasCurrencyOnly ? num(o.currency, null) === null && o.currency !== "" ? "R$ " : String(o.currency || "") : P.prefix;
    const cm = /(R\$|US\$|\$|€|£)\s*$/i.exec(prefixRaw);
    const mark = cm ? cm[1] : prefixRaw.trim() && !/\s/.test(prefixRaw.trim()) && prefixRaw.trim().length <= 3 ? prefixRaw.trim() : "";
    const lead = (cm ? prefixRaw.slice(0, cm.index) : mark ? "" : prefixRaw).trim();
    const whole = formatNumber(Math.trunc(Math.abs(P.value)), 0);
    const cents = P.decimals ? "," + Math.abs(P.value).toFixed(P.decimals).split(".")[1] : "";
    const suffix = P.suffix.trim();
    const shortSuffix = suffix.length <= 2 ? suffix : "";
    const longSuffix = shortSuffix ? "" : suffix;
    const oldP = o.old === undefined || o.old === null || o.old === "" ? null : parseAmount(o.old);
    const oldText = oldP ? (typeof o.old === "number" ? "R$ " + formatNumber(o.old, oldP.decimals) : String(o.old).trim()) : "";
    const smallOf = (s) => Math.max(S.minText, Math.round(s * 0.4));
    const subOf = (s) => Math.max(S.minText, Math.round(s * 0.27));
    const rowWidth = (s) => {
      let w = tabular(S, font, s, Array.from(whole + shortSuffix)).width;
      if (mark) w += S.measure(mark, small, smallOf(s)) + s * 0.08;
      if (cents) w += S.measure(cents, small, smallOf(s)) + s * 0.03;
      return w;
    };
    const stackHeight = (s) => S.metrics(font).cap * s + (oldText ? subOf(s) * 1.6 : 0) + (lead ? subOf(s) * 1.5 : 0) + (longSuffix ? subOf(s) * 1.5 : 0);
    let size = Math.round(num(o.size, S.px(290)));
    const min = Math.round(num(o.minSize, S.px(110)));
    while (size > min && (rowWidth(size) > box.w || stackHeight(size) > box.h)) size -= 2;
    const met = S.metrics(font);
    const cap = met.cap * size;
    const total = rowWidth(size);
    const align = o.align || "left";
    const left = align === "center" ? box.x + (box.w - total) / 2 : align === "right" ? box.x + box.w - total : box.x;
    const oldSize = subOf(size);
    const oldH = oldText ? oldSize * 1.6 : 0;
    const leadH = lead ? oldSize * 1.5 : 0;
    const top = box.y + oldH + leadH;
    const base = top + cap;
    const geometry = { x: left, y: box.y, w: total, h: oldH + leadH + cap + (longSuffix ? oldSize * 1.5 : 0), top, base, bottom: base + (longSuffix ? oldSize * 1.5 : met.desc * size * 0.3), right: left + total, size };
    if (o.measure) return geometry;

    const bs = c.beat(1);
    const t = c.t;
    // o valor antigo chega antes e é riscado meia batida depois
    if (oldText) {
      const oldAt = num(o.oldAt, Math.max(0, at - 1));
      if (c.since(oldAt) >= 0) {
        const s = M.springBy("type", c.since(oldAt));
        const ox = align === "center" ? box.x + (box.w - S.measure(oldText, sub, oldSize)) / 2 : align === "right" ? box.x + box.w - S.measure(oldText, sub, oldSize) : box.x;
        const ow = S.measure(oldText, sub, oldSize);
        const oy = box.y + oldSize * 0.95;
        g.save();
        g.beginPath();
        g.rect(ox - 4, box.y - oldSize * 0.2, ow + 8, oldSize * 1.5);
        g.clip();
        S.setAlpha(1);
        S.setFont(sub, oldSize);
        g.textAlign = "left";
        g.textBaseline = "alphabetic";
        g.fillStyle = W.muted;
        g.fillText(oldText, ox, oy + (1 - s) * oldSize * 1.3);
        g.restore();
        const strike = M.springBy("snappy", c.since(oldAt + 0.5));
        if (strike > 0.001) {
          S.setAlpha(1);
          g.fillStyle = o.strikeColor || W.accent;
          const th = Math.max(4, oldSize * 0.1);
          g.fillRect(ox - oldSize * 0.08, oy - oldSize * 0.34 - th / 2, (ow + oldSize * 0.16) * strike, th);
        }
        if (s > 0.6) S.box("text", ox, oy - oldSize * 0.9, ow, oldSize * 1.2, oldSize, oldText);
      }
    }
    // o que vem antes do valor ("12x de") não leva o soco: entra subindo, meia batida antes
    if (lead) {
      const s = M.springBy("type", c.since(at - 0.5));
      if (s > 0.001) {
        const ink = S.ink(lead, sub, oldSize);
        g.save();
        g.beginPath();
        g.rect(left - 4, top - oldSize * 0.45 - ink.asc - 4, S.measure(lead, sub, oldSize) + 8, ink.asc + ink.desc + 8);
        g.clip();
        S.setAlpha(1);
        S.setFont(sub, oldSize);
        g.textAlign = "left";
        g.textBaseline = "alphabetic";
        g.fillStyle = W.ink;
        g.fillText(lead, left, top - oldSize * 0.45 + (1 - s) * oldSize * 1.2);
        g.restore();
        if (s > 0.6) S.box("text", left, top - oldSize * 0.45 - ink.asc, S.measure(lead, sub, oldSize), ink.asc + ink.desc, oldSize, lead);
      }
    }
    if (c.since(at) < 0) return geometry;
    const pivot = [left + total * (align === "center" ? 0.5 : align === "right" ? 1 : 0), top];
    const punch = 1 + Math.min(0.4, S.room({ x: left, y: top - cap * 0.05, w: total, h: cap * 1.1 + (longSuffix ? oldSize * 1.5 : 0) }, pivot) - 1) * (1 - ease.outExpo(phase(t, at * bs, at * bs + 15 * Q)));
    const ink = o.color || W.accentText;
    const breath = breathOf(c, o.breathe, S.room({ x: left, y: top - cap * 0.05, w: total, h: cap * 1.1 }, pivot) / punch);
    S.group({ scale: punch * breath, about: pivot }, () => {
      let x = left;
      S.setAlpha(1);
      g.textBaseline = "alphabetic";
      g.textAlign = "left";
      if (mark) {
        S.setFont(small, smallOf(size));
        g.fillStyle = ink;
        g.fillText(mark, x, top + S.metrics(small).cap * smallOf(size));
        x += S.measure(mark, small, smallOf(size)) + size * 0.08;
      }
      const row = tabular(S, font, size, Array.from(whole + shortSuffix));
      S.setFont(font, size);
      g.fillStyle = ink;
      for (const cell of row.cells) {
        g.textAlign = cell.digit ? "center" : "left";
        g.fillText(cell.ch, cell.digit ? x + cell.x + cell.w / 2 : x + cell.x, base);
      }
      x += row.width;
      if (cents) {
        S.setFont(small, smallOf(size));
        g.textAlign = "left";
        g.fillText(cents, x + size * 0.03, top + S.metrics(small).cap * smallOf(size));
      }
      if (longSuffix) {
        S.setFont(sub, oldSize);
        g.textAlign = "left";
        g.fillStyle = W.ink;
        g.fillText(longSuffix, left, base + oldSize * 1.25);
      }
      {
        const full = (lead ? lead + " " : "") + (mark ? mark + " " : "") + whole + cents + shortSuffix + (longSuffix ? " " + longSuffix : "");
        S.box("text", left, top - cap * 0.03, total, cap * 1.06, size, full);
        if (mark) S.box("text", left, top, S.measure(mark, small, smallOf(size)), smallOf(size), smallOf(size), mark);
        if (longSuffix) S.box("text", left, base + oldSize * 0.4, S.measure(longSuffix, sub, oldSize), oldSize * 1.2, oldSize, longSuffix);
      }
    });
    return geometry;
  }

  // ---------------------------------------------------------------------------------------------
  // Item de lista, trilho de progresso, botão
  // ---------------------------------------------------------------------------------------------

  /**
   * Um item de lista numa linha: o índice num círculo, o texto e um detalhe opcional.
   * listItem(c, { index, text, detail, x, y, w, at, size, color }) devolve { x, y, w, h, bottom }.
   */
  function listItem(c, options) {
    const o = options || {};
    const S = c.S;
    const g = S.g;
    const W = o.world || c.world;
    const A = c.area;
    const x = num(o.x, A.x);
    const y = num(o.y, A.y);
    const w = num(o.w, A.w);
    const size = Math.round(num(o.size, S.type(52)));
    const dot = Math.round(size * 1.5);
    const gapX = Math.round(size * 0.5);
    const at = o.at === undefined || o.at === null ? null : Number(o.at);
    const title = text(c, o.text || "", { kind: "body", weight: 700, x: x + dot + gapX, y: y + (dot - S.metrics({ family: Studio.fonts.body, weight: 700 }).cap * size) / 2, w: w - dot - gapX, h: size * 2.6, size, minSize: S.minText, maxLines: 2, color: o.color || W.ink, at, cover: at === null, in: "rise", measure: o.measure, out: o.out, lineHeight: 1.12 });
    let bottom = Math.max(y + dot, title.bottom);
    let detail = null;
    if (filled(o.detail)) {
      detail = text(c, o.detail, { kind: "body", x: x + dot + gapX, y: bottom + size * 0.3, w: w - dot - gapX, h: size * 2.6, size: Math.max(S.minText, Math.round(size * 0.86)), maxLines: 2, color: W.muted, at: at === null ? null : at + 0.5, cover: at === null, in: "fade", measure: o.measure, out: o.out });
      bottom = detail.bottom;
    }
    const geometry = { x, y, w, h: bottom - y, bottom, title, detail };
    if (o.measure) return geometry;
    const since = at === null ? 1 : c.since(at);
    if (since < 0) return geometry;
    const s = at === null ? 1 : M.springBy("snappy", since);
    const font = { family: Studio.fonts.body, weight: 800, tracking: 0 };
    const numSize = Math.max(S.minText, Math.round(size * 0.86));
    S.setAlpha(clamp(s * 1.5));
    g.fillStyle = o.dotColor || W.accent;
    g.beginPath();
    g.arc(x + dot / 2, y + dot / 2, (dot / 2) * (0.6 + 0.4 * s), 0, Math.PI * 2);
    g.fill();
    if (o.index !== undefined && o.index !== null && o.index !== "") {
      S.setFont(font, numSize);
      g.textAlign = "center";
      g.textBaseline = "alphabetic";
      g.fillStyle = o.dotText || W.onAccent;
      g.fillText(String(o.index), x + dot / 2, y + dot / 2 + S.metrics(font).cap * numSize * 0.5);
      if (s > 0.8) S.box("text", x + dot / 2 - numSize * 0.4, y + dot / 2 - numSize * 0.55, numSize * 0.8, numSize * 1.1, numSize, String(o.index));
    }
    S.setAlpha(1);
    return geometry;
  }

  /**
   * O trilho de progresso: `n` trechos; os que já passaram ficam cheios, o atual enche batida a batida.
   * rail(f, { x, y, w, n, index, fill, h, gap, color, base }) com `fill` de 0 a 1 para o trecho `index`.
   */
  function rail(f, options) {
    const o = options || {};
    const S = f.S;
    const g = S.g;
    const W = o.world || f.world;
    const A = f.area;
    const n = Math.max(1, o.n | 0);
    const x = num(o.x, A.x);
    const y = num(o.y, A.y);
    const w = num(o.w, A.w);
    const h = num(o.h, S.px(10));
    const gap = num(o.gap, S.px(12));
    const seg = (w - gap * (n - 1)) / n;
    const alpha = num(o.alpha, 1);
    if (alpha <= 0.003) return { x, y, w, h };
    for (let i = 0; i < n; i++) {
      const sx = x + i * (seg + gap);
      S.setAlpha(alpha);
      g.fillStyle = o.base || rgba(W.ink, 0.18);
      roundRect(g, sx, y, seg, h, h / 2);
      g.fill();
      const fill = i < o.index ? 1 : i === o.index ? clamp(num(o.fill, 0)) : 0;
      if (fill > 0.001) {
        g.fillStyle = i === o.index ? o.color || W.accent : o.done || rgba(W.ink, 0.6);
        roundRect(g, sx, y, Math.max(h, seg * fill), h, h / 2);
        g.fill();
      }
    }
    S.setAlpha(1);
    S.box("ui", x, y, w, h);
    return { x, y, w, h, seg, gap };
  }

  /**
   * Um botão: a chamada dentro de uma pílula na cor de destaque. button(c, texto, { rect ou x, y, w, h, at, press: [batidas],
   * color, textColor, size }). Com `rect` ({ x, y, w, h, r }) ele acompanha um contêiner que se transforma.
   */
  function button(c, value, options) {
    const o = options || {};
    const S = c.S;
    const g = S.g;
    const W = o.world || c.world;
    const A = c.area;
    const font = { family: Studio.fonts.headline, weight: Studio.style.type.weight, tracking: -0.01 };
    const str = String(value === undefined || value === null ? "" : value);
    const maxW = num(o.w, A.w);
    const min = Math.max(S.minText, S.px(46));
    const padOf = (s) => s * 0.85;
    const top = Math.max(min, Math.round(num(o.size, S.px(96))));
    // o maior tamanho em que a chamada cabe em uma linha, ou em duas linhas equilibradas
    const lay = S.layout(str, { family: font.family, weight: font.weight, tracking: font.tracking, lineHeight: 1.08, size: top, minSize: min, maxWidth: Math.max(10, maxW - 2 * padOf(top)), maxLines: 2 });
    const size = lay.size;
    const lines = lay.lines.map((l) => l.text);
    const tw = lay.width;
    const lh = Math.round(size * 1.08);
    const h = o.rect ? o.rect.h : Math.round(size * 1.3 + lines.length * lh);
    const w = o.rect ? o.rect.w : Math.min(maxW, tw + 2 * padOf(size));
    const x = o.rect ? o.rect.x : o.align === "center" ? num(o.x, A.x + A.w / 2) - w / 2 : num(o.x, A.x);
    const y = o.rect ? o.rect.y : num(o.y, A.y);
    const rad = o.rect ? num(o.rect.r, h / 2) : Math.min(h / 2, S.px(84));
    const geometry = { x, y, w, h, r: rad, bottom: y + h, right: x + w, size, cx: x + w / 2, cy: y + h / 2 };
    if (o.measure) return geometry;
    const at = o.at === undefined || o.at === null ? null : Number(o.at);
    if (at !== null && c.since(at) < 0) return geometry;
    const center = [x + w / 2, y + h / 2];
    // a entrada cresce só até a borda da área segura; o aperto encolhe a chapa, não o texto
    const pop = at === null || o.rect ? 1 : 1 + Math.min(0.22, S.room({ x, y, w, h }, center) - 1) * (1 - ease.outExpo(phase(c.t, c.beat(at), c.beat(at) + 12 * Q)));
    let press = 0;
    for (const b of o.press || []) {
      const dt = c.since(b);
      if (dt >= -2 * Q && dt < 0) press = Math.max(press, ease.outQuad((dt + 2 * Q) / (2 * Q)));
      else if (dt >= 0) press = Math.max(press, 1 - M.springBy("snappy", dt));
    }
    const textAlpha = num(o.textAlpha, 1);
    const breath = breathOf(c, o.breathe, S.room({ x, y, w, h }, center) / pop);
    S.group({ scale: pop * breath, about: center }, () => {
      S.group({ scale: 1 - 0.05 * press, about: center }, () => {
        if (o.plate !== false) {
          S.setAlpha(num(o.alpha, 1));
          g.fillStyle = o.color || W.accent;
          roundRect(g, x, y, w, h, rad);
          g.fill();
        }
        S.box("ui", x, y, w, h);
      });
      if (textAlpha > 0.01) {
        S.setAlpha(textAlpha);
        S.setFont(font, size);
        g.textAlign = "center";
        g.textBaseline = "alphabetic";
        g.fillStyle = o.textColor || W.onAccent;
        const cap = S.metrics(font).cap * size;
        const first = y + h / 2 - ((lines.length - 1) * lh) / 2 + cap / 2;
        lines.forEach((line, i) => g.fillText(line, x + w / 2, first + i * lh));
        if (textAlpha >= 0.5) S.box("text", x + (w - tw) / 2, first - cap * 1.2, tw, (lines.length - 1) * lh + cap * 1.5, size, str);
      }
    });
    S.setAlpha(1);
    return geometry;
  }

  // ---------------------------------------------------------------------------------------------
  // Logo e fecho
  // ---------------------------------------------------------------------------------------------

  /** O tamanho do logo dentro de uma caixa: nunca abaixo de 100 px de altura (na escala do quadro), escala uniforme. */
  function logoSize(S, record, maxW, maxH) {
    const aspect = record.w / Math.max(1, record.h);
    const minH = 100 * S.u;
    let h = aspect < 1.6 ? Math.min(maxH, 270 * S.u) : Math.min(maxH, 180 * S.u);
    h = Math.max(minH, Math.min(h, num(record.maxH, Infinity)));
    let w = h * aspect;
    if (w > maxW) {
      w = maxW;
      h = w / aspect;
    }
    return { w, h };
  }

  /**
   * O logo da marca: a imagem em escala uniforme, com 100 px de altura ou mais, sem desfoque, rotação nem troca de cor
   * (só corte, fade, deslocamento e escala uniforme); sem arquivo de logo, o nome da marca na fonte do título.
   * logo(c, { x, y, w, h, align, at, plate }) devolve { x, y, w, h, bottom, kind: "image" | "name" | "none" }.
   * `plate` é a cor de fundo onde o logo vai pousar: quando o logo sumiria nela, ele ganha uma chapa na outra tinta.
   */
  function logo(c, options) {
    const o = options || {};
    const S = c.S;
    const g = S.g;
    const W = o.world || c.world;
    const A = c.area;
    const box = { x: num(o.x, A.x), y: num(o.y, A.y), w: Math.max(10, num(o.w, A.w)), h: Math.max(10, num(o.h, A.h * 0.3)) };
    const align = o.align || "left";
    const at = o.at === undefined || o.at === null ? null : Number(o.at);
    const rec = o.image === false ? null : Studio.logoImage;
    const name = filled(o.name) ? o.name : Studio.roteiro.brand.name || "";
    if (!rec) {
      if (!filled(name)) return { x: box.x, y: box.y, w: 0, h: 0, bottom: box.y, kind: "none" };
      const t = text(c, name, { kind: "headline", x: box.x, y: box.y, w: box.w, h: box.h, align, size: num(o.size, S.px(130)), maxLines: 2, at, cover: at === null, in: "rise", emphasis: false, color: o.color || W.ink, measure: o.measure, out: o.out, uppercase: false });
      return { x: t.x, y: t.y, w: t.w, h: t.h, bottom: t.bottom, kind: "name", text: t };
    }
    const dim = logoSize(S, rec, box.w, box.h);
    const x = align === "center" ? box.x + (box.w - dim.w) / 2 : align === "right" ? box.x + box.w - dim.w : box.x;
    const y = o.valign === "middle" ? box.y + (box.h - dim.h) / 2 : box.y;
    const geometry = { x, y, w: dim.w, h: dim.h, bottom: y + dim.h, kind: "image" };
    if (o.measure) return geometry;
    if (at !== null && c.since(at) < 0) return geometry;
    // movimentos permitidos num logo: corte, fade, deslocamento e escala uniforme
    let s = 1;
    let alpha = 1;
    let scale = 1;
    let dy = 0;
    if (at !== null && o.in === "cut") {
      scale = 1 + 0.1 * (1 - ease.outExpo(phase(c.t, c.beat(at), c.beat(at) + 14 * Q)));
    } else if (at !== null) {
      s = M.springBy("heavy", c.since(at));
      alpha = clamp(s * 1.6);
      scale = 0.94 + 0.06 * s;
      dy = (1 - s) * S.px(36);
    }
    const ground = o.plate || W.bg;
    const lost = rec.info && rec.info.color && rec.info.coverage < 0.9 && contrast(rec.info.color, ground) < 1.35;
    S.group({ scale, about: [x + dim.w / 2, y + dim.h / 2], dy, alpha: num(o.alpha, 1) * alpha }, () => {
      if (lost) {
        const pad = dim.h * 0.22;
        S.setAlpha(1);
        g.fillStyle = W.ink;
        roundRect(g, x - pad, y - pad, dim.w + 2 * pad, dim.h + 2 * pad, pad * 0.9);
        g.fill();
      }
      S.setAlpha(1);
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = "high";
      g.drawImage(rec.img, x, y, dim.w, dim.h);
      if (alpha >= 0.5) S.box("logo", x, y, dim.w, dim.h);
    });
    return geometry;
  }

  /**
   * O fecho: o logo e a chamada, parados. lockup(c, { text, words, logo, x, y, w, h, align, at, textAt, button, press, breathe }).
   * O logo entra na batida `at` (fade, deslocamento e escala uniforme); a chamada entra com um soco em `textAt`;
   * com `button: true` a chamada vem dentro de um botão. Devolve { logo, text }.
   */
  function lockup(c, options) {
    const o = options || {};
    const S = c.S;
    const W = o.world || c.world;
    const A = c.area;
    const box = { x: num(o.x, A.x), y: num(o.y, A.y), w: num(o.w, A.w), h: num(o.h, A.h) };
    const align = o.align || "center";
    const at = o.at === undefined ? 0 : o.at;
    const textAt = o.textAt === undefined ? (at === null ? null : at + 1) : o.textAt;
    const showLogo = o.logo !== false;
    const gap = S.px(72);
    const logoH = box.h * 0.4;
    const mark = showLogo ? logo(c, { x: box.x, y: box.y, w: box.w, h: logoH, align, measure: true, world: W }) : { h: 0, kind: "none" };
    const closing = String(o.text === undefined || o.text === null ? "" : o.text);
    const textH = Math.max(S.px(120), Math.min(box.h - mark.h - gap, S.px(360)));
    const address = /[.@\/]/.test(closing) && !/\s/.test(closing.trim());          // um endereço não ganha sublinhado
    const spec = { kind: "headline", x: box.x, w: box.w, h: textH, align, size: S.px(118 * Studio.style.type.scale), maxLines: 3, world: W, uppercase: address ? false : undefined };
    const measured = closing
      ? o.button
        ? button(c, closing, { x: align === "center" ? box.x + box.w / 2 : box.x, y: 0, w: box.w, align, measure: true, world: W })
        : text(c, closing, Object.assign({ y: 0, measure: true }, spec))
      : { h: 0 };
    const total = mark.h + (mark.h && measured.h ? gap : 0) + measured.h;
    const top = box.y + Math.max(0, (box.h - total) / 2);
    const drawnLogo = showLogo ? logo(c, { x: box.x, y: top, w: box.w, h: logoH, align, at, in: o.in, world: W, plate: o.plate }) : mark;
    let drawnText = null;
    if (closing) {
      const ty = top + (drawnLogo.h ? drawnLogo.h + gap : 0);
      const emphasis = o.emphasis === undefined ? (address ? false : { words: o.words, at: textAt === null ? null : textAt + 1, style: "underline" }) : o.emphasis;
      drawnText = o.button
        ? button(c, closing, { x: align === "center" ? box.x + box.w / 2 : box.x, y: ty, w: box.w, align, at: textAt, press: o.press, breathe: o.breathe, world: W })
        : text(c, closing, Object.assign({ y: ty + (measured.top - measured.y), at: textAt, cover: textAt === null, in: o.textIn || "rise", by: "line", stagger: 0.25, emphasis, breathe: o.breathe }, spec));
    }
    return { logo: drawnLogo, text: drawnText, top, bottom: top + total };
  }

  // ---------------------------------------------------------------------------------------------
  // Transições conduzidas por um elemento e pequenos desenhos de interface
  // ---------------------------------------------------------------------------------------------

  /**
   * Cartão que vira a tela: o retângulo `from` cresce até cobrir o quadro e pousa exatamente na batida `at`
   * (15 quadros, acelera e desacelera). dive(c, { from: { x, y, w, h, r }, at, frames }) devolve { k, rect, wash }:
   * desenhe o seu elemento em `rect` e cubra-o com a cor da cena seguinte na transparência `wash`; quando pousa,
   * o quadro inteiro já é o fundo novo e o corte acontece atrás do próprio elemento.
   */
  function dive(c, options) {
    const o = options || {};
    const S = c.S;
    const T = c.beat(num(o.at, c.beats));
    const n = num(o.frames, 15);
    const k = ease.inOutCubic(phase(c.t, T - n * Q, T));
    const f = o.from;
    const m = Math.max(S.W, S.H) * 0.08;
    return {
      k,
      wash: ease.inQuad(phase(c.t, T - n * Q * 0.5, T - Q)),
      rect: { x: lerp(f.x, -m, k), y: lerp(f.y, -m, k), w: lerp(f.w, S.W + 2 * m, k), h: lerp(f.h, S.H + 2 * m, k), r: lerp(num(f.r, 0), 0, k) },
    };
  }

  /**
   * O mesmo mergulho para um elemento de cor chapada: flood(c, { from, color, at, frames }) desenha o retângulo
   * crescendo na cor da cena seguinte e devolve o progresso (0→1).
   */
  function flood(c, options) {
    const o = options || {};
    const S = c.S;
    const g = S.g;
    const T = c.beat(num(o.at, c.beats));
    const n = num(o.frames, 12);
    if (c.t < T - n * Q || c.t >= T) return c.t >= T ? 1 : 0;
    const d = dive(c, { from: o.from, at: o.at, frames: n });
    S.setAlpha(1);
    g.fillStyle = o.color;
    roundRect(g, d.rect.x, d.rect.y, d.rect.w, d.rect.h, d.rect.r);
    g.fill();
    return d.k;
  }

  /**
   * O deslocamento de um chicote: o grupo atravessa o quadro em 4 quadros e some no corte, na batida `at`.
   * whip(c, { at, dir: [dx, dy], distance }) devolve { dx, dy, alpha, burst, echoes: [{ dx, dy, alpha }] }.
   * Desenhe o grupo uma vez por eco (por baixo) e uma vez no lugar atual: é o borrão direcional do corte.
   */
  function whip(c, options) {
    const o = options || {};
    const S = c.S;
    const T = c.beat(num(o.at, c.beats));
    const dir = o.dir || [0, -1];
    const dist = num(o.distance, dir[0] !== 0 ? S.W * 1.15 : S.H * 0.8);
    const at = (tt) => {
      const ant = Math.sin(Math.PI * phase(tt, T - 13 * Q, T - 4 * Q));
      const raj = ease.inExpo(phase(tt, T - 4 * Q, T));
      const d = dist * raj - S.px(14) * ant;
      return { dx: dir[0] * d, dy: dir[1] * d, burst: raj };
    };
    const now = at(c.t);
    const echoes = [];
    if (Studio.style.echo && o.echo !== false && c.t > T - 4 * Q && c.t < T) {
      [[3, 0.12], [2, 0.25], [1, 0.45]].forEach((pair) => {
        const e = at(c.t - pair[0] * Q);
        echoes.push({ dx: e.dx, dy: e.dy, alpha: pair[1] });
      });
    }
    return { dx: now.dx, dy: now.dy, burst: now.burst, alpha: c.t >= T ? 0 : 1 - phase(c.t, T - Q, T), echoes };
  }

  /** Um sinal de certo que se desenha: check(c, { cx, cy, r, at, color, width }) começa na batida `at`. */
  function check(c, options) {
    const o = options || {};
    const S = c.S;
    const g = S.g;
    const p = ease.outCubic(phase(c.t, c.beat(num(o.at, 0)), c.beat(num(o.at, 0)) + 9 * Q));
    if (p <= 0.001) return;
    const r = num(o.r, S.px(60));
    const pts = [[-0.46, 0.02], [-0.12, 0.36], [0.5, -0.32]];
    const lens = [Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]), Math.hypot(pts[2][0] - pts[1][0], pts[2][1] - pts[1][1])];
    const total = lens[0] + lens[1];
    const d = p * total;
    S.setAlpha(num(o.alpha, 1));
    g.lineWidth = num(o.width, r * 0.22);
    g.lineCap = "round";
    g.lineJoin = "round";
    g.strokeStyle = o.color || c.world.onAccent;
    g.beginPath();
    g.moveTo(o.cx + pts[0][0] * r, o.cy + pts[0][1] * r);
    if (d <= lens[0]) {
      const k = d / lens[0];
      g.lineTo(o.cx + lerp(pts[0][0], pts[1][0], k) * r, o.cy + lerp(pts[0][1], pts[1][1], k) * r);
    } else {
      const k = (d - lens[0]) / lens[1];
      g.lineTo(o.cx + pts[1][0] * r, o.cy + pts[1][1] * r);
      g.lineTo(o.cx + lerp(pts[1][0], pts[2][0], k) * r, o.cy + lerp(pts[1][1], pts[2][1], k) * r);
    }
    g.stroke();
    S.setAlpha(1);
  }

  /**
   * Barras que crescem, uma a cada `stagger` batidas: bars(c, { x, y, w, h, values, at, stagger, color, base, alpha }).
   * Sem `values`, um desenho crescente com semente (um pictograma, sem eixo nem número: não é um dado).
   */
  function bars(c, options) {
    const o = options || {};
    const S = c.S;
    const g = S.g;
    const W = o.world || c.world;
    let values = Array.isArray(o.values) && o.values.length ? o.values.map(Number) : null;
    if (!values) {
      const rnd = M.rng(Studio.seed * 31 + num(o.seed, 7));
      values = [];
      for (let i = 0; i < 6; i++) values.push(0.28 + 0.12 * i + rnd() * 0.1);
    }
    const max = Math.max.apply(null, values.concat([1e-9]));
    const n = values.length;
    const slot = o.w / n;
    const bw = slot * 0.62;
    const at = num(o.at, 0);
    const stagger = num(o.stagger, 0.25);
    const alpha = num(o.alpha, 1);
    for (let i = 0; i < n; i++) {
      const s = M.springBy("default", c.since(at + i * stagger));
      if (s <= 0.001) continue;
      const h = Math.max(0, o.h * (values[i] / max) * s);
      S.setAlpha(alpha);
      g.fillStyle = i === n - 1 ? o.color || W.accent : o.base || rgba(W.ink, 0.2);
      roundRect(g, o.x + i * slot + (slot - bw) / 2, o.y + o.h - h, bw, h, Math.min(bw / 2, S.px(10), h / 2));
      g.fill();
    }
    S.setAlpha(1);
  }

  /** Barras cinzas no lugar de texto de preenchimento (ilegíveis de propósito): skeleton(c, { x, y, w, rows, size, alpha, at }). */
  function skeleton(c, options) {
    const o = options || {};
    const S = c.S;
    const g = S.g;
    const W = o.world || c.world;
    const size = num(o.size, S.px(26));
    const widths = o.widths || [0.92, 0.74, 0.84, 0.6];
    const rows = Math.max(1, o.rows | 0 || 2);
    for (let i = 0; i < rows; i++) {
      const s = o.at === undefined || o.at === null ? 1 : M.springBy("default", c.since(Number(o.at) + i * num(o.stagger, 0.25)));
      if (s <= 0.001) continue;
      S.setAlpha(num(o.alpha, 1) * clamp(s * 1.5));
      g.fillStyle = o.color || rgba(W.ink, 0.14);
      roundRect(g, o.x, o.y + i * size * 1.9, o.w * widths[i % widths.length] * (0.5 + 0.5 * s), size, size / 2);
      g.fill();
    }
    S.setAlpha(1);
  }

  // ---------------------------------------------------------------------------------------------
  // Montagem
  // ---------------------------------------------------------------------------------------------

  Object.assign(Studio, {
    STYLES, STYLE_IDS, SETTLE, Q,
    // carga e palco
    load, image, stage,
    // componentes
    background, drift, born, bump, text, headline, body, label, chip, device, card, cursor, counter, price, listItem, rail, button, logo, lockup,
    // transições e desenhos de interface
    dive, flood, whip, check, bars, skeleton,
    // matemática pura
    computeTimeline, derivePalette, makeWorld, styleFor, fitText, balanceBreaks, pickEmphasis, splitWords, formatNumber, parseAmount, parsePtNumber,
    roundRect, parseColor, color, mix, rgba, luminance, contrast, readableOn, safeRect, rectAt, valueAt, frameFor, scrollFor, hashSeed,
  });

  global.Studio = Studio;
})(typeof window !== "undefined" ? window : globalThis);
