/*
 * Criativos para anúncios · biblioteca da peça (ad.js)
 * Uma peça é uma lista de cenas em segundos. Cada cena ocupa só a zona segura do anúncio, que o
 * app grava na página a partir da tabela das redes do Motor de vídeo, e empilha os seus itens:
 * título, legenda, citação, lista, cartão, tela, selo, logo e botão. Tudo o que aparece é função
 * de t: sem temporizador, sem transição de CSS, sem sorteio.
 *
 * Para nenhuma cena ficar parada, as palavras entram uma a uma, o trecho em destaque ganha um
 * sublinhado que corre, a tela do produto desce, os campos se digitam e o botão é tocado antes
 * do fim. Nenhuma escala passa de 1: o que o encaixe mediu é o maior tamanho que cada item tem.
 *
 * Uso: motion.js antes, depois Ad.start(peca, zonas). A página fica pronta para o Motor:
 * window.film, window.seek(t), window.setFormat({ name, width, height }) e window.boxes(t).
 */
(function (global) {
  "use strict";
  const M = global.Motion;

  /** Tamanhos de base por formato, em px de um quadro de 1080 de largura. */
  const SIZES = {
    "9:16": { width: 1080, height: 1920, title: 84, list: 92, caption: 58, quote: 60, when: 34, ui: 36, small: 28, pill: 52, stamp: 48, name: 66, gap: 34, logo: 380 },
    "4:5": { width: 1080, height: 1350, title: 76, list: 80, caption: 52, quote: 56, when: 32, ui: 34, small: 26, pill: 48, stamp: 46, name: 60, gap: 28, logo: 320 },
    "1:1": { width: 1080, height: 1080, title: 70, list: 72, caption: 50, quote: 52, when: 30, ui: 32, small: 26, pill: 46, stamp: 46, name: 56, gap: 24, logo: 280 },
  };
  /** O menor texto que a conferência aceita a 1080 px: o encaixe nunca desce disso. */
  const MIN_TEXT = 44;
  const MIN_UI = 24;
  const TYPE_SPEED = 34;
  const WORD_STEP = 0.07;
  const WORD_FADE = 0.12;
  const SWEEP = 0.5;
  const FADE_IN = 0.22;
  const FADE_OUT = 0.16;
  const TAP = 0.3;

  let peca = null;
  let still = false;
  let zones = {};
  let format = "9:16";
  let stage = null;
  let film = null;
  let live = [];
  let sized = [];
  let images = [];
  let logos = [];
  let fitted = null;

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  function el(tag, cls) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    return node;
  }

  /**
   * Texto em palavras, cada uma num span, com o trecho em destaque dentro de um span próprio.
   * Sempre por textContent: nada da peça vira HTML. Devolve as palavras e o destaque.
   */
  function setWords(node, text, accent) {
    node.textContent = "";
    const full = String(text || "");
    const mark = accent === true ? full : typeof accent === "string" ? accent : "";
    const at = mark ? full.indexOf(mark) : -1;
    const words = [];
    let accentNode = null;
    const addWords = (parent, part) => {
      const tokens = part.split(/(\s+)/);
      for (const token of tokens) {
        if (!token) continue;
        if (/^\s+$/.test(token)) {
          parent.appendChild(document.createTextNode(token));
          continue;
        }
        const word = el("span", "w");
        word.textContent = token;
        parent.appendChild(word);
        words.push(word);
      }
    };
    if (at < 0) addWords(node, full);
    else {
      addWords(node, full.slice(0, at));
      accentNode = el("span", "accent");
      addWords(accentNode, mark);
      node.appendChild(accentNode);
      addWords(node, full.slice(at + mark.length));
    }
    return { words: words, accent: accentNode };
  }

  /** Um elemento com tamanho de fonte que o encaixe pode reduzir, até o mínimo do papel. */
  function sizedFont(node, base, min) {
    sized.push({ node: node, base: base, min: Math.min(base, min) });
    node.style.fontSize = base + "px";
    return node;
  }

  const role = (node, name) => {
    node.setAttribute("data-role", name);
    return node;
  };

  /** Palavras que entram uma a uma a partir de `at`, e o sublinhado do destaque depois delas. */
  function animateText(parts, at, sweepAt) {
    if (parts.words.length) live.push({ kind: "words", words: parts.words, at: at });
    if (parts.accent) live.push({ kind: "sweep", el: parts.accent, at: typeof sweepAt === "number" ? sweepAt : at + parts.words.length * WORD_STEP + 0.25 });
  }

  function zoneOf(name) {
    const S = SIZES[name];
    const z = zones[name] || (M.SAFE[name] ? { top: M.SAFE[name].top, bottom: M.SAFE[name].bottom, left: M.SAFE[name].left, right: M.SAFE[name].right } : { top: 120, bottom: 200, left: 72, right: 72 });
    return { x: z.left, y: z.top, w: S.width - z.left - z.right, h: S.height - z.top - z.bottom };
  }

  function textItem(tag, cls, item, base) {
    const node = sizedFont(role(el(tag, cls), "text"), base, MIN_TEXT);
    animateText(setWords(node, item.text, item.accent), item.at, item.sweep_at);
    return node;
  }

  function makeItem(item, S, scene) {
    switch (item.type) {
      case "title":
        return textItem("p", "title" + (item.big ? " big" : ""), item, Math.round(S.title * (item.big ? 1.15 : 1)));
      case "caption":
        return textItem("p", "caption", item, S.caption);
      case "quote": {
        const box = el("div", "quote");
        if (item.when) box.appendChild(sizedFont(role(setTextPlain(el("span", "when"), item.when), "ui"), S.when, MIN_UI));
        box.appendChild(textItem("p", "quote-text", item, S.quote));
        return box;
      }
      case "list": {
        const box = el("div", "list");
        const every = typeof item.every === "number" ? item.every : 0.5;
        item.items.forEach(function (text, index) {
          const last = index === item.items.length - 1;
          const line = sizedFont(role(el("p", "list-item"), "text"), S.list, MIN_TEXT);
          const parts = setWords(line, text, last && item.accent_last ? true : null);
          box.appendChild(line);
          const at = Array.isArray(item.times) ? item.times[index] : item.at + index * every;
          live.push({ kind: "item", el: line, at: at, out: scene.out });
          if (parts.accent) live.push({ kind: "sweep", el: parts.accent, at: at + 0.35 });
        });
        return box;
      }
      case "card": {
        const card = role(el("div", "card"), "ui");
        if (item.title) card.appendChild(sizedFont(setTextPlain(el("div", "card-title"), item.title), S.ui + 6, MIN_UI));
        item.fields.forEach(function (field, index) {
          const row = el("div", "field");
          const head = el("div", "field-head");
          head.appendChild(sizedFont(setTextPlain(el("span", "label"), field.label), S.ui, MIN_UI));
          const meta = [];
          if (field.chip) {
            const chip = sizedFont(setTextPlain(el("span", "chip" + (field.blank ? " warn" : "")), field.chip), S.small, MIN_UI);
            head.appendChild(chip);
            meta.push(chip);
          }
          row.appendChild(head);
          const value = sizedFont(el("div", "value"), S.ui, MIN_UI);
          row.appendChild(value);
          card.appendChild(row);
          const at = typeof field.at === "number" ? field.at : item.at + 0.6 + index * 1.2;
          live.push({ kind: "field", at: at, text: String(field.value || ""), blank: Boolean(field.blank), typed: field.typed !== false, valueEl: value, meta: meta });
        });
        return card;
      }
      case "screen": {
        const frame = role(el("div", "screen" + (item.frame === "phone" ? " phone" : "")), "ui");
        const img = el("img", "screen-img");
        img.src = item.src;
        img.alt = "";
        frame.appendChild(img);
        images.push(img);
        frame.style.height = Math.round(clamp(item.height || 0.55, 0.25, 0.8) * 100) + "%";
        live.push({ kind: "screen", el: img, frame: frame, at: item.at, out: scene.out, motion: item.motion || "rolar" });
        return frame;
      }
      case "stamp": {
        const node = sizedFont(role(el("div", "stamp"), "text"), S.stamp, MIN_TEXT);
        animateText(setWords(node, "✓ " + item.text, null), item.at);
        return node;
      }
      case "pill": {
        const node = sizedFont(setTextPlain(role(el("div", "pill"), "text"), item.text), S.pill, MIN_TEXT);
        // o toque fica entre a entrada do botão e o fim da cena, para ela não ficar parada
        const end = scene.out === Infinity ? film.duration : scene.out;
        const tapAt = typeof item.tap_at === "number" ? item.tap_at : (item.at + 0.3 + end) / 2 - 0.15;
        live.push({ kind: "tap", el: node, at: tapAt });
        return node;
      }
      case "logo": {
        const brand = (peca && peca.brand) || {};
        if (brand.logo) {
          const img = role(el("img", "logo"), "logo");
          img.src = brand.logo;
          img.alt = brand.name || "";
          images.push(img);
          logos.push({ img: img, height: Math.round(S.logo * 0.32 * (item.scale || 1)), maxWidth: Math.round(S.logo * (item.scale || 1)) });
          return img;
        }
        return textItem("p", "brand-name", { text: brand.name || "", at: item.at }, S.name);
      }
      default:
        throw new Error("item desconhecido: " + item.type);
    }
  }

  function setTextPlain(node, text) {
    node.textContent = String(text || "");
    return node;
  }

  function build() {
    const S = SIZES[format];
    stage.innerHTML = "";
    live = [];
    sized = [];
    images = [];
    logos = [];
    fitted = null;
    stage.style.width = S.width + "px";
    stage.style.height = S.height + "px";
    for (let i = 0; i < 2; i++) {
      const blob = el("div", "blob blob-" + i);
      stage.appendChild(blob);
      live.push({ kind: "blob", el: blob, i: i });
    }
    const zone = zoneOf(format);
    const last = peca.scenes.length - 1;
    peca.scenes.forEach(function (source, index) {
      const scene = { from: source.from, to: source.to, out: index === last ? Infinity : source.to };
      const box = el("div", "scene" + (source.align === "center" ? " center" : ""));
      Object.assign(box.style, { left: zone.x + "px", top: zone.y + "px", width: zone.w + "px", height: zone.h + "px", gap: S.gap + "px" });
      box.dataset.scene = String(index);
      stage.appendChild(box);
      for (const item of source.items) {
        const at = typeof item.at === "number" ? item.at : source.from;
        const node = makeItem(Object.assign({}, item, { at: at }), S, scene);
        box.appendChild(node);
        if (item.type !== "list") live.push({ kind: "item", el: node, at: at, out: scene.out });
      }
    });
  }

  /** O logo pelo próprio desenho: a altura da marca, sem passar da largura máxima. */
  function sizeLogos() {
    for (const logo of logos) {
      const w = logo.img.naturalWidth || 1;
      const h = logo.img.naturalHeight || 1;
      const ratio = w / h;
      const width = Math.min(logo.maxWidth, Math.round(logo.height * ratio));
      logo.img.style.width = width + "px";
      logo.img.style.height = Math.round(width / ratio) + "px";
    }
  }

  /** O quanto os itens de uma cena passam da zona (todos estão no layout; só a opacidade muda). */
  function overflowOf(box) {
    const children = Array.prototype.slice.call(box.children);
    if (!children.length) return 0;
    const rect = box.getBoundingClientRect();
    let top = Infinity;
    let bottom = -Infinity;
    let wide = 0;
    for (const child of children) {
      const r = child.getBoundingClientRect();
      top = Math.min(top, r.top);
      bottom = Math.max(bottom, r.bottom);
      wide = Math.max(wide, child.scrollWidth - child.clientWidth, r.width - rect.width);
    }
    return Math.max(bottom - top - rect.height, wide);
  }

  /** Reduz as fontes de cada cena até caber na zona, sem descer do mínimo de cada papel. */
  function fit() {
    sizeLogos();
    const scenes = Array.prototype.slice.call(stage.querySelectorAll(".scene"));
    for (const box of scenes) {
      const mine = sized.filter(function (entry) {
        return box.contains(entry.node);
      });
      let factor = 1;
      for (let step = 0; step < 24 && overflowOf(box) > 1; step++) {
        factor *= 0.95;
        for (const entry of mine) entry.node.style.fontSize = Math.max(entry.min, Math.round(entry.base * factor)) + "px";
      }
    }
    fitted = format;
  }

  function settle() {
    const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    const decoded = images.map(function (img) {
      return img.decode ? img.decode().catch(function () {}) : Promise.resolve();
    });
    return Promise.all([fonts].concat(decoded)).then(function () {
      if (fitted !== format) fit();
    });
  }

  /** Entra a partir de `at`; sai cruzando o corte, metade antes e metade depois, sem quadro vazio. */
  function alphaOf(t, at, out) {
    return clamp((t - at) / FADE_IN, 0, 1) * (out === Infinity ? 1 : clamp((out + FADE_OUT / 2 - t) / FADE_OUT, 0, 1));
  }

  function draw(t) {
    const S = SIZES[format];
    for (const it of live) {
      if (it.kind === "blob") {
        const size = S.width * (it.i ? 0.95 : 1.15);
        const cx = S.width * (it.i ? 0.88 : 0.08) + Math.sin(t * 0.35 + it.i * 2.1) * 60;
        const cy = S.height * (it.i ? 0.84 : 0.1) + Math.cos(t * 0.28 + it.i) * 80;
        Object.assign(it.el.style, { width: size + "px", height: size + "px", left: cx - size / 2 + "px", top: cy - size / 2 + "px" });
      } else if (it.kind === "item") {
        const alpha = alphaOf(t, it.at, it.out);
        // a escala nasce menor e para em 1: nada passa do tamanho que o encaixe mediu
        const scale = 0.965 + 0.035 * clamp(M.springBy("default", Math.max(0, t - it.at)), 0, 1);
        it.el.style.opacity = String(Math.round(alpha * 1000) / 1000);
        it.el.style.visibility = alpha < 0.05 ? "hidden" : "visible";
        it.el.dataset.scale = String(scale);
        it.el.style.transform = "scale(" + scale.toFixed(4) + ")";
      } else if (it.kind === "words") {
        it.words.forEach(function (word, index) {
          word.style.opacity = String(Math.round(clamp((t - it.at - index * WORD_STEP) / WORD_FADE, 0, 1) * 1000) / 1000);
        });
      } else if (it.kind === "sweep") {
        const p = M.ease.inOutSine(clamp((t - it.at) / SWEEP, 0, 1));
        it.el.style.backgroundSize = (p * 100).toFixed(2) + "% 0.2em";
      } else if (it.kind === "screen") {
        const span = Math.max(0.5, (it.out === Infinity ? film.duration : it.out) - it.at);
        const p = clamp((t - it.at) / span, 0, 1);
        if (it.motion === "rolar") {
          const room = Math.max(0, it.el.offsetHeight - it.frame.clientHeight);
          it.el.style.transform = "translateY(" + (-room * M.ease.inOutSine(p)).toFixed(1) + "px)";
        } else if (it.motion === "zoom") {
          it.el.style.transform = "scale(" + (1 + 0.1 * p).toFixed(4) + ")";
        } else {
          it.el.style.transform = "none";
        }
      } else if (it.kind === "field") {
        const dt = t - it.at;
        const typing = it.typed && !it.blank;
        const count = dt < 0 ? 0 : typing ? Math.min(it.text.length, Math.floor(dt * TYPE_SPEED)) : it.text.length;
        const writing = dt >= 0 && count < it.text.length;
        it.valueEl.textContent = it.text.slice(0, count) + (writing ? "|" : "");
        it.valueEl.className = "value" + (it.blank && dt >= 0 ? " blank" : "") + (writing ? " focus" : "");
        const doneAt = it.at + (typing ? it.text.length / TYPE_SPEED : 0);
        for (const node of it.meta) node.style.opacity = String(clamp((t - doneAt) / 0.2, 0, 1));
      }
    }
    // o toque no botão vem depois da entrada dele: aperta a partir da escala que ela deixou
    for (const it of live) {
      if (it.kind !== "tap") continue;
      const press = 1 - 0.05 * Math.sin(Math.PI * clamp((t - it.at) / TAP, 0, 1));
      it.el.style.transform = "scale(" + (Number(it.el.dataset.scale || 1) * press).toFixed(4) + ")";
    }
    return true;
  }

  /** Uma imagem parada (kind "poster") é o fim da animação dela, em qualquer instante pedido. */
  const momentOf = (t) => (still ? 100 + t : t);

  function start(spec, safeZones) {
    peca = spec;
    still = spec.kind === "poster";
    zones = safeZones || {};
    format = SIZES[spec.format] ? spec.format : "9:16";
    stage = document.getElementById("stage");
    const S = SIZES[format];
    film = M.setup({
      duration: spec.duration,
      width: S.width,
      height: S.height,
      fps: 30,
      background: (spec.brand && spec.brand.colors && spec.brand.colors.background) || "#F6F4EE",
      cuts: spec.scenes.slice(1).map(function (scene) {
        return scene.from;
      }),
      formats: Object.keys(SIZES),
      title: spec.title || null,
    });
    build();
    global.setFormat = function (next) {
      const name = SIZES[next && next.name] ? next.name : next && next.width / next.height < 0.7 ? "9:16" : next && next.width / next.height < 0.95 ? "4:5" : "1:1";
      format = name;
      film.width = SIZES[name].width;
      film.height = SIZES[name].height;
      build();
    };
    global.seek = function (t) {
      return settle().then(function () {
        return draw(momentOf(t));
      });
    };
    global.boxes = function (t) {
      if (fitted === format) draw(momentOf(t));
      return M.domBoxes(stage);
    };
    return film;
  }

  global.Ad = { start: start, SIZES: SIZES };
})(window);
