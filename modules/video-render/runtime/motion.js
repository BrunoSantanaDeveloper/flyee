/*
 * Motor de vídeo · biblioteca da página (motion.js)
 * Funções puras de tempo para páginas renderizadas quadro a quadro: molas de forma fechada,
 * trilhas com vários alvos, grade de batidas, ruído com semente, texto que cabe, vídeo que
 * busca o instante certo e um modo de prévia ao vivo no navegador comum.
 *
 * Uso: <script src="motion.js"></script> e depois Motion.setup({...}) e window.seek = (t) => {...}.
 * Durante o render, window.__FLYEE_RENDER__ é true e nada aqui usa timer, RAF ou Math.random.
 */
(function (global) {
  "use strict";

  const clamp = (x, lo, hi) => Math.min(hi === undefined ? 1 : hi, Math.max(lo === undefined ? 0 : lo, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = (a, b, x) => {
    const t = clamp((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  };

  /** Progresso 0→1 entre dois instantes (preso fora deles). */
  const phase = (t, from, to) => clamp((t - from) / Math.max(1e-9, to - from));
  const between = (t, from, to) => t >= from && t < to;

  /** Mola amortecida de forma fechada, 0→1, função pura do tempo. k = rigidez, d = amortecimento. */
  function spring(t, k, d) {
    if (k === undefined) k = 170;
    if (d === undefined) d = 26;
    if (t <= 0) return 0;
    const w0 = Math.sqrt(k);
    const z = d / (2 * w0);
    if (z < 1) {
      const wd = w0 * Math.sqrt(1 - z * z);
      return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0) / wd) * Math.sin(wd * t));
    }
    return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  }

  /** Presets de mola por papel: UI ágil, padrão, pesado (tipografia grande, logo), brincalhão. */
  const SPRINGS = {
    snappy: [320, 30],
    default: [170, 26],
    heavy: [90, 20],
    playful: [200, 14],
    type: [120, 24],
  };
  function springBy(name, t) {
    const p = SPRINGS[name] || SPRINGS.default;
    return spring(t, p[0], p[1]);
  }

  /**
   * Valor no instante t de uma trilha com vários alvos: keys = [[tempo, valor], ...] em ordem.
   * Cada mudança soma a própria mola a partir do seu tempo; nada reinicia, e qualquer quadro é
   * calculável sem simular os anteriores.
   */
  function track(t, keys, k, d) {
    let v = keys[0][1];
    for (let i = 1; i < keys.length; i++) v += (keys[i][1] - keys[i - 1][1]) * spring(t - keys[i][0], k, d);
    return v;
  }

  /** Indicador que estica: a borda da frente é mais rígida que a de trás. stops = [[tempo, x], ...]. */
  function indicator(t, stops, width) {
    const lead = track(t, stops, 320, 30);
    const trail = track(t, stops, 140, 22);
    return { left: Math.min(lead, trail), right: Math.max(lead, trail) + (width || 0) };
  }

  /** Opacidade de um texto dentro de um contêiner que se transforma: entra depois do início, sai antes do próximo. */
  function swapAlpha(t, tIn, tOut) {
    return Math.min(clamp((t - tIn - 0.08) / 0.12), clamp((tOut - 0.1 - t) / 0.1));
  }

  /** Curvas clássicas, todas 0→1. */
  const ease = {
    linear: (x) => x,
    inQuad: (x) => x * x,
    outQuad: (x) => 1 - (1 - x) * (1 - x),
    inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    outCubic: (x) => 1 - Math.pow(1 - x, 3),
    outQuart: (x) => 1 - Math.pow(1 - x, 4),
    outExpo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
    inExpo: (x) => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10)),
    outBack: (x) => {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
    },
    inOutSine: (x) => -(Math.cos(Math.PI * x) - 1) / 2,
  };

  /**
   * Antecipação → rajada → assentamento: a física das transições (quadros a 30 fps).
   * Devolve 0→1 com um recuo pequeno antes de disparar e um assentamento longo.
   */
  function anticipate(t, duration, back) {
    if (back === undefined) back = 0.08;
    const x = clamp(t / duration);
    if (x < 0.3) return -back * Math.sin((x / 0.3) * Math.PI);
    return ease.outExpo((x - 0.3) / 0.7);
  }

  /** Gerador com semente (mulberry32): a mesma semente dá a mesma sequência em todo render. */
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Ruído suave 1D com semente, para derivas de fundo (≤3% de escala nas seguras). */
  function noise1d(seed) {
    const r = rng(seed);
    const grid = [];
    for (let i = 0; i < 1024; i++) grid.push(r() * 2 - 1);
    return function (x) {
      const i = Math.floor(x);
      const f = x - i;
      const a = grid[((i % 1024) + 1024) % 1024];
      const b = grid[(((i + 1) % 1024) + 1024) % 1024];
      return lerp(a, b, f * f * (3 - 2 * f));
    };
  }

  /** Loop perfeito: o último quadro prepara o primeiro. */
  const loopT = (t, duration) => ((t % duration) + duration) % duration;

  /** Arredonda ao quadro, para cortes caírem em quadro inteiro. */
  const toFrame = (t, fps) => Math.round(t * fps) / fps;

  /** Grade de batidas: b = 60/bpm; beat(n), bar(n), nearest(t), index(t). offset = tempo da batida 0. */
  function beatGrid(bpm, offset, beatsPerBar) {
    const b = 60 / bpm;
    const off = offset || 0;
    const per = beatsPerBar || 4;
    return {
      bpm,
      b,
      offset: off,
      beat: (n) => off + n * b,
      bar: (bar, beat) => off + (bar * per + (beat || 0)) * b,
      index: (t) => Math.floor((t - off) / b),
      nearest: (t) => off + Math.round((t - off) / b) * b,
      phaseInBeat: (t) => (((t - off) / b) % 1 + 1) % 1,
      pulse: (t, decay) => Math.exp(-((((t - off) / b) % 1 + 1) % 1) * (decay || 6)),
    };
  }

  /** Cortes a partir de um beats.json ({beats:[…]}) e índices: cuts(grid, [0, 4, 6, 7]). */
  function cutsAt(grid, indexes) {
    return indexes.map((n) => grid.beat(n));
  }

  /** Tamanho de fonte (px) para um texto caber numa largura, no canvas. */
  function fitText(ctx, text, maxWidth, options) {
    const o = options || {};
    const family = o.family || "sans-serif";
    const weight = o.weight || 700;
    let size = o.max || 200;
    const min = o.min || 24;
    while (size > min) {
      ctx.font = weight + " " + size + "px " + family;
      if (ctx.measureText(text).width <= maxWidth) break;
      size -= 2;
    }
    ctx.font = weight + " " + size + "px " + family;
    return size;
  }

  /** Quebra um texto em linhas que cabem na largura (a fonte atual do ctx). */
  function wrapText(ctx, text, maxWidth) {
    const words = String(text).split(/\s+/);
    const lines = [];
    let line = "";
    for (const word of words) {
      const candidate = line ? line + " " + word : word;
      if (ctx.measureText(candidate).width <= maxWidth || !line) line = candidate;
      else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  /** Retângulo arredondado no canvas. */
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    // uma forma que encolheu a nada (mola no início, barra em zero) não desenha, em vez de dar erro
    if (!(w > 0) || !(h > 0)) {
      ctx.closePath();
      return;
    }
    const rr = Math.max(0, Math.min(Number(r) || 0, w / 2, h / 2));
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  /** Área segura por formato (px, no tamanho padrão): onde texto, logo e rosto ficam fora dos botões das redes. */
  const SAFE = {
    "9:16": { width: 1080, height: 1920, top: 250, bottom: 500, left: 70, right: 180 },
    "4:5": { width: 1080, height: 1350, top: 120, bottom: 200, left: 72, right: 72 },
    "3:4": { width: 1080, height: 1440, top: 120, bottom: 200, left: 72, right: 72 },
    "1:1": { width: 1080, height: 1080, top: 80, bottom: 120, left: 60, right: 60 },
    "16:9": { width: 1920, height: 1080, top: 80, bottom: 150, left: 100, right: 100 },
  };
  function safeArea(format) {
    const s = SAFE[format] || SAFE["9:16"];
    return { x: s.left, y: s.top, w: s.width - s.left - s.right, h: s.height - s.top - s.bottom, format: format || "9:16" };
  }

  /**
   * Busca o instante t num <video>, com promessa que resolve quando o quadro está pronto.
   * Repetir o mesmo t devolve o mesmo quadro: o render fica determinístico.
   */
  function seekVideo(video, t) {
    const target = Math.max(0, Math.min(isFinite(video.duration) ? video.duration - 0.001 : t, t));
    if (Math.abs(video.currentTime - target) < 0.0005 && video.readyState >= 2) return Promise.resolve(video);
    return new Promise(function (resolve) {
      const done = function () {
        video.removeEventListener("seeked", done);
        resolve(video);
      };
      video.addEventListener("seeked", done);
      video.currentTime = target;
    });
  }

  /** Espera um <video> carregar o primeiro quadro (chame uma vez, antes do primeiro seek). */
  function loadVideo(video) {
    if (video.readyState >= 2) return Promise.resolve(video);
    return new Promise(function (resolve, reject) {
      video.addEventListener("loadeddata", function () { resolve(video); }, { once: true });
      video.addEventListener("error", function () { reject(new Error("não consegui carregar o vídeo " + video.currentSrc)); }, { once: true });
      video.load();
    });
  }

  /**
   * Caixas declaradas pelos elementos com data-role="text|logo|face|ui" (DOM), com o tamanho da
   * fonte, para a conferência de zonas seguras e legibilidade. Páginas de canvas devolvem a própria lista.
   */
  function domBoxes(root) {
    const out = [];
    const nodes = (root || document).querySelectorAll("[data-role]");
    for (const el of nodes) {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || Number(cs.opacity) < 0.05) continue;
      out.push({ role: el.getAttribute("data-role"), x: r.left, y: r.top, w: r.width, h: r.height, size: parseFloat(cs.fontSize) || null, text: el.getAttribute("data-role") === "text" ? (el.textContent || "").trim().slice(0, 80) : undefined });
    }
    return out;
  }

  /**
   * Declara o filme (window.film) e, fora do render, liga uma prévia ao vivo: espaço pausa,
   * setas andam um quadro, Home volta ao início. Durante o render nada disso roda.
   */
  function setup(film) {
    const f = Object.assign({ duration: 15, width: 1080, height: 1920, fps: 30, background: "#141413" }, film || {});
    global.film = f;
    const rendering = Boolean(global.__FLYEE_RENDER__ || (navigator && navigator.webdriver));
    if (rendering || !global.requestAnimationFrame) return f;
    let playing = true;
    let t0 = performance.now();
    let paused = 0;
    const step = function () {
      const t = loopT(playing ? (performance.now() - t0) / 1000 : paused, f.duration);
      if (typeof global.seek === "function") {
        try {
          global.seek(toFrame(t, f.fps));
        } catch (error) {
          console.error(error);
        }
      }
      global.requestAnimationFrame(step);
    };
    global.addEventListener("keydown", function (event) {
      const now = (performance.now() - t0) / 1000;
      if (event.code === "Space") {
        event.preventDefault();
        if (playing) paused = loopT(now, f.duration);
        else t0 = performance.now() - paused * 1000;
        playing = !playing;
      } else if (event.code === "ArrowRight" || event.code === "ArrowLeft") {
        const delta = (event.code === "ArrowRight" ? 1 : -1) / f.fps;
        paused = loopT((playing ? now : paused) + delta, f.duration);
        playing = false;
      } else if (event.code === "Home") {
        t0 = performance.now();
        paused = 0;
      }
    });
    global.requestAnimationFrame(step);
    return f;
  }

  global.Motion = {
    clamp, lerp, smoothstep, phase, between,
    spring, SPRINGS, springBy, track, indicator, swapAlpha, ease, anticipate,
    rng, noise1d, loopT, toFrame, beatGrid, cutsAt,
    fitText, wrapText, roundRect, safeArea, SAFE,
    seekVideo, loadVideo, domBoxes, setup,
  };
})(typeof window !== "undefined" ? window : globalThis);
