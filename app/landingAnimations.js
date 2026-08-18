/* global document, window, console, setTimeout, setInterval, clearTimeout, clearInterval, requestAnimationFrame, cancelAnimationFrame, performance, ImageData, IntersectionObserver */
// This file is pure browser-runtime DOM script (not bundler/Node code), so
// the browser globals above are declared explicitly for ESLint's no-undef
// rule rather than relying on `/* eslint-env browser */`, which is a legacy
// feature not honoured by this project's flat eslint.config.mjs.
//
// Runs the landing page's canvas nebula rendering, hero animation timeline,
// and scroll/hover effects. Ported from a static HTML/CSS/JS demo as
// imperative DOM code (not React state) to preserve the exact hand-tuned
// timings and canvas rendering. Deliberately kept as plain JS (not .ts) —
// this file isn't type-checked by the project (checkJs is off in
// tsconfig.json), which is intentional here given how much of this is
// direct DOM querying that doesn't map cleanly onto strict TypeScript.
//
// Call from a useEffect in the page component:
//   useEffect(() => {
//     const cleanup = runLandingAnimations({ isMobile, MOBILE_NEBULA_ENABLED });
//     return cleanup;
//   }, [isMobile]);
//
// Returns a cleanup function that clears every timeout/interval/animation
// frame this code scheduled, so nothing leaks if the component unmounts
// mid-animation.
export function runLandingAnimations({ isMobile, MOBILE_NEBULA_ENABLED }) {
  console.log("[vantio-hero] runLandingAnimations() started, isMobile:", isMobile);
  const timeouts = [];
  const intervals = [];
  const rafs = [];
  const observers = [];
  const scopedSetTimeout = (fn, ms) => {
    const id = setTimeout(fn, ms);
    timeouts.push(id);
    return id;
  };
  const scopedSetInterval = (fn, ms) => {
    const id = setInterval(fn, ms);
    intervals.push(id);
    return id;
  };
  const scopedRAF = (fn) => {
    const id = requestAnimationFrame(fn);
    rafs.push(id);
    return id;
  };

  // ── Nebula rendering — faithful port of the real algorithm from app/page.tsx ──
  function nbLerp(a, b, t) {
    return a + (b - a) * t;
  }
  function nbValueNoise(x, y, seed) {
    const ix = Math.floor(x),
      iy = Math.floor(y);
    const fx = x - ix,
      fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx),
      uy = fy * fy * (3 - 2 * fy);
    function h(a, b) {
      const n = Math.sin(a * 127.1 + b * 311.7 + seed * 74.3) * 43758.5453;
      return n - Math.floor(n);
    }
    return nbLerp(nbLerp(h(ix, iy), h(ix + 1, iy), ux), nbLerp(h(ix, iy + 1), h(ix + 1, iy + 1), ux), uy);
  }
  function nbFbm(x, y, seed, oct) {
    let v = 0,
      a = 0.5,
      f = 1,
      mx = 0;
    for (let i = 0; i < oct; i++) {
      v += nbValueNoise(x * f, y * f, seed + i) * a;
      mx += a;
      a *= 0.52;
      f *= 2.1;
    }
    return v / mx;
  }
  function nbCloud(x, y, seed, warp) {
    const ox = nbFbm(x + 0.0, y + 0.0, seed, 5) * warp;
    const oy = nbFbm(x + 5.2, y + 1.3, seed + 7, 5) * warp;
    return nbFbm(x + ox, y + oy, seed + 3, 7);
  }
  function nbBuildCloud(W, H, cfg) {
    const { cx, cy, rx, ry, rot, seed, warp, thresh, intensity, es, c0, c1, c2, c3 } = cfg;
    const data = new Uint8ClampedArray(W * H * 4);
    const cosR = Math.cos(rot),
      sinR = Math.sin(rot);
    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        const dx = px - cx,
          dy = py - cy;
        const rx2 = (dx * cosR + dy * sinR) / rx;
        const ry2 = (-dx * sinR + dy * cosR) / ry;
        const d2 = rx2 * rx2 + ry2 * ry2;
        if (d2 > 4.84) continue;
        const n = nbCloud(rx2 * 1.2, ry2 * 1.2, seed, warp);
        const raw = Math.max(0, n - thresh);
        if (raw <= 0) continue;
        const dens = Math.min(1, raw / (1 - thresh));
        const edge = Math.exp(-es * d2);
        const fin = dens * edge * intensity;
        if (fin < 0.003) continue;
        let r, g, b;
        if (dens > 0.75) {
          const t = (dens - 0.75) / 0.25;
          r = nbLerp(c2[0], c3[0], t);
          g = nbLerp(c2[1], c3[1], t);
          b = nbLerp(c2[2], c3[2], t);
        } else if (dens > 0.45) {
          const t = (dens - 0.45) / 0.3;
          r = nbLerp(c1[0], c2[0], t);
          g = nbLerp(c1[1], c2[1], t);
          b = nbLerp(c1[2], c2[2], t);
        } else if (dens > 0.15) {
          const t = (dens - 0.15) / 0.3;
          r = nbLerp(c0[0], c1[0], t);
          g = nbLerp(c0[1], c1[1], t);
          b = nbLerp(c0[2], c1[2], t);
        } else {
          const t = dens / 0.15;
          r = c0[0] * t;
          g = c0[1] * t;
          b = c0[2] * t;
        }
        const i4 = (py * W + px) * 4;
        data[i4] = Math.min(255, data[i4] + r * fin * 255);
        data[i4 + 1] = Math.min(255, data[i4 + 1] + g * fin * 255);
        data[i4 + 2] = Math.min(255, data[i4 + 2] + b * fin * 255);
        data[i4 + 3] = 255;
      }
    }
    return new ImageData(data, W, H);
  }
  function nbScreenBlit(ctx, W, H, img) {
    const tmp = document.createElement("canvas");
    tmp.width = W;
    tmp.height = H;
    tmp.getContext("2d").putImageData(img, 0, 0);
    ctx.globalCompositeOperation = "screen";
    ctx.drawImage(tmp, 0, 0);
    ctx.globalCompositeOperation = "source-over";
  }
  function renderNebulaOnCanvas(canvasId, clouds) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const W = Math.max(200, Math.round(rect.width));
    const H = Math.max(200, Math.round(rect.height));
    canvas.width = W;
    canvas.height = H;
    // S controls the low-res buffer's downscale factor before it gets
    // smoothly upscaled to the real canvas size. Raised from 2.5 to 4.5:
    // since sections are now full-viewport-width (not the previous
    // ~1100px confined box), the pixel count this loop below has to
    // process roughly doubled — this cuts total iterations by ~67%
    // (quadratic effect: both width and height shrink), which is a real,
    // measurable chunk of main-thread time back. The result is
    // indistinguishable after the smooth upscale since this is a soft,
    // blurry cloud effect, not sharp detail.
    const S = 4.5;
    const LW = Math.ceil(W / S),
      LH = Math.ceil(H / S);
    const lo = document.createElement("canvas");
    lo.width = LW;
    lo.height = LH;
    const loCtx = lo.getContext("2d");
    loCtx.globalCompositeOperation = "screen";
    clouds.forEach((cfg) => {
      const scaled = { ...cfg, cx: cfg.cx * LW, cy: cfg.cy * LH, rx: cfg.rx * LW, ry: cfg.ry * LW };
      nbScreenBlit(loCtx, LW, LH, nbBuildCloud(LW, LH, scaled));
    });
    loCtx.globalCompositeOperation = "source-over";
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(lo, 0, 0, W, H);
  }

  const SECTION_NEBULAS = {
    "nebula-hero": [
      {
        cx: 0.22,
        cy: 0.32,
        rx: 0.65,
        ry: 0.55,
        rot: 0.28,
        seed: 1.0,
        warp: 3.2,
        thresh: 0.3,
        intensity: 1.02,
        es: 1.0,
        c0: [0.018, 0.027, 0.099],
        c1: [0.0864, 0.1152, 0.3024],
        c2: [0.2, 0.24, 0.58],
        c3: [0.3, 0.3, 0.66],
      },
      {
        cx: 0.19,
        cy: 0.28,
        rx: 0.55,
        ry: 0.45,
        rot: 0.24,
        seed: 2.2,
        warp: 3.5,
        thresh: 0.33,
        intensity: 1.44,
        es: 1.2,
        c0: [0.135, 0.072, 0.018],
        c1: [0.4464, 0.3024, 0.0648],
        c2: [0.88, 0.68, 0.18],
        c3: [0.98, 0.88, 0.36],
      },
      {
        cx: 0.16,
        cy: 0.23,
        rx: 0.36,
        ry: 0.3,
        rot: 0.18,
        seed: 3.5,
        warp: 3.8,
        thresh: 0.37,
        intensity: 1.44,
        es: 1.6,
        c0: [0.2925, 0.207, 0.0495],
        c1: [0.6336, 0.504, 0.1872],
        c2: [0.96, 0.88, 0.5],
        c3: [1.0, 0.99, 0.8],
      },
      {
        cx: 0.14,
        cy: 0.19,
        rx: 0.18,
        ry: 0.16,
        rot: 0.12,
        seed: 4.8,
        warp: 4.0,
        thresh: 0.42,
        intensity: 1.32,
        es: 2.0,
        c0: [0.414, 0.36, 0.18],
        c1: [0.6984, 0.6696, 0.4608],
        c2: [0.99, 0.98, 0.84],
        c3: [1.0, 1.0, 0.97],
      },
    ],
    "nebula-cta": [
      {
        cx: 0.5,
        cy: 0.82,
        rx: 0.48,
        ry: 0.34,
        rot: 0.05,
        seed: 20.0,
        warp: 2.9,
        thresh: 0.3,
        intensity: 0.75,
        es: 1.1,
        c0: [0.045, 0.0135, 0.09],
        c1: [0.1584, 0.0504, 0.2592],
        c2: [0.34, 0.1, 0.48],
        c3: [0.42, 0.14, 0.58],
      },
      {
        cx: 0.5,
        cy: 0.79,
        rx: 0.38,
        ry: 0.26,
        rot: 0.04,
        seed: 21.5,
        warp: 3.3,
        thresh: 0.34,
        intensity: 1.05,
        es: 1.4,
        c0: [0.153, 0.036, 0.081],
        c1: [0.4752, 0.144, 0.2304],
        c2: [0.88, 0.36, 0.48],
        c3: [0.96, 0.56, 0.64],
      },
      {
        cx: 0.49,
        cy: 0.76,
        rx: 0.22,
        ry: 0.15,
        rot: 0.03,
        seed: 22.8,
        warp: 3.5,
        thresh: 0.39,
        intensity: 1.05,
        es: 1.8,
        c0: [0.342, 0.144, 0.189],
        c1: [0.648, 0.3888, 0.432],
        c2: [0.96, 0.72, 0.76],
        c3: [0.99, 0.88, 0.9],
      },
    ],
    "nebula-problem": [
      {
        cx: 0.78,
        cy: 0.25,
        rx: 0.5,
        ry: 0.4,
        rot: -0.3,
        seed: 30.0,
        warp: 2.2,
        thresh: 0.4,
        intensity: 0.8,
        es: 1.3,
        c0: [0.081, 0.0135, 0.0135],
        c1: [0.2592, 0.0432, 0.0432],
        c2: [0.52, 0.1, 0.1],
        c3: [0.62, 0.16, 0.14],
      },
      {
        cx: 0.8,
        cy: 0.2,
        rx: 0.32,
        ry: 0.26,
        rot: -0.28,
        seed: 31.5,
        warp: 2.5,
        thresh: 0.44,
        intensity: 1.1,
        es: 1.7,
        c0: [0.18, 0.036, 0.027],
        c1: [0.432, 0.1152, 0.0864],
        c2: [0.76, 0.28, 0.2],
        c3: [0.86, 0.42, 0.32],
      },
      {
        cx: 0.82,
        cy: 0.16,
        rx: 0.16,
        ry: 0.14,
        rot: -0.26,
        seed: 32.8,
        warp: 2.8,
        thresh: 0.48,
        intensity: 1.05,
        es: 2.2,
        c0: [0.315, 0.135, 0.099],
        c1: [0.612, 0.3312, 0.2448],
        c2: [0.92, 0.6, 0.46],
        c3: [0.96, 0.74, 0.62],
      },
    ],
    "nebula-transform": [
      {
        cx: 0.5,
        cy: 0.35,
        rx: 0.55,
        ry: 0.36,
        rot: 0.0,
        seed: 40.0,
        warp: 4.2,
        thresh: 0.26,
        intensity: 0.75,
        es: 1.0,
        c0: [0.009, 0.063, 0.045],
        c1: [0.036, 0.1872, 0.1296],
        c2: [0.08, 0.4, 0.28],
        c3: [0.12, 0.5, 0.36],
      },
      {
        cx: 0.5,
        cy: 0.32,
        rx: 0.4,
        ry: 0.26,
        rot: 0.0,
        seed: 41.5,
        warp: 4.6,
        thresh: 0.3,
        intensity: 1.05,
        es: 1.3,
        c0: [0.027, 0.144, 0.099],
        c1: [0.0864, 0.36, 0.2448],
        c2: [0.2, 0.68, 0.46],
        c3: [0.32, 0.82, 0.58],
      },
      {
        cx: 0.5,
        cy: 0.29,
        rx: 0.22,
        ry: 0.15,
        rot: 0.0,
        seed: 42.8,
        warp: 4.9,
        thresh: 0.35,
        intensity: 1.05,
        es: 1.8,
        c0: [0.099, 0.279, 0.198],
        c1: [0.2592, 0.5616, 0.4176],
        c2: [0.5, 0.9, 0.72],
        c3: [0.72, 0.98, 0.86],
      },
    ],
    "nebula-diff": [
      {
        cx: 0.5,
        cy: 0.08,
        rx: 0.5,
        ry: 0.28,
        rot: 0.0,
        seed: 50.0,
        warp: 3.0,
        thresh: 0.34,
        intensity: 0.7,
        es: 1.3,
        c0: [0.036, 0.018, 0.09],
        c1: [0.1152, 0.0648, 0.2592],
        c2: [0.24, 0.15, 0.5],
        c3: [0.32, 0.22, 0.6],
      },
      {
        cx: 0.5,
        cy: 0.06,
        rx: 0.32,
        ry: 0.18,
        rot: 0.0,
        seed: 51.5,
        warp: 3.4,
        thresh: 0.38,
        intensity: 0.95,
        es: 1.7,
        c0: [0.09, 0.054, 0.189],
        c1: [0.2304, 0.144, 0.4176],
        c2: [0.44, 0.32, 0.72],
        c3: [0.56, 0.46, 0.82],
      },
      {
        cx: 0.5,
        cy: 0.92,
        rx: 0.5,
        ry: 0.28,
        rot: 0.0,
        seed: 55.0,
        warp: 3.1,
        thresh: 0.34,
        intensity: 0.7,
        es: 1.3,
        c0: [0.036, 0.018, 0.09],
        c1: [0.1152, 0.0648, 0.2592],
        c2: [0.24, 0.15, 0.5],
        c3: [0.32, 0.22, 0.6],
      },
      {
        cx: 0.5,
        cy: 0.94,
        rx: 0.32,
        ry: 0.18,
        rot: 0.0,
        seed: 56.5,
        warp: 3.5,
        thresh: 0.38,
        intensity: 0.95,
        es: 1.7,
        c0: [0.09, 0.054, 0.189],
        c1: [0.2304, 0.144, 0.4176],
        c2: [0.44, 0.32, 0.72],
        c3: [0.56, 0.46, 0.82],
      },
    ],
    "nebula-product": [
      {
        cx: 0.82,
        cy: 0.8,
        rx: 0.42,
        ry: 0.34,
        rot: 0.4,
        seed: 60.0,
        warp: 2.0,
        thresh: 0.42,
        intensity: 0.8,
        es: 1.8,
        c0: [0.018, 0.045, 0.072],
        c1: [0.0576, 0.144, 0.216],
        c2: [0.14, 0.32, 0.44],
        c3: [0.22, 0.44, 0.56],
      },
      {
        cx: 0.84,
        cy: 0.77,
        rx: 0.26,
        ry: 0.2,
        rot: 0.38,
        seed: 61.5,
        warp: 2.3,
        thresh: 0.46,
        intensity: 1.1,
        es: 2.2,
        c0: [0.054, 0.135, 0.189],
        c1: [0.1584, 0.3312, 0.4176],
        c2: [0.36, 0.62, 0.72],
        c3: [0.56, 0.78, 0.86],
      },
      {
        cx: 0.86,
        cy: 0.74,
        rx: 0.13,
        ry: 0.1,
        rot: 0.36,
        seed: 62.8,
        warp: 2.6,
        thresh: 0.5,
        intensity: 1.05,
        es: 2.8,
        c0: [0.18, 0.27, 0.315],
        c1: [0.4176, 0.5472, 0.6048],
        c2: [0.74, 0.88, 0.92],
        c3: [0.9, 0.96, 0.98],
      },
    ],
    "nebula-compound": [
      {
        cx: 0.5,
        cy: 0.5,
        rx: 0.5,
        ry: 0.4,
        rot: 0.15,
        seed: 70.0,
        warp: 2.8,
        thresh: 0.32,
        intensity: 0.7,
        es: 1.1,
        c0: [0.072, 0.027, 0.027],
        c1: [0.2448, 0.1008, 0.072],
        c2: [0.5, 0.24, 0.16],
        c3: [0.62, 0.34, 0.22],
      },
      {
        cx: 0.5,
        cy: 0.5,
        rx: 0.32,
        ry: 0.26,
        rot: 0.12,
        seed: 71.5,
        warp: 3.1,
        thresh: 0.36,
        intensity: 1.0,
        es: 1.5,
        c0: [0.189, 0.09, 0.054],
        c1: [0.4464, 0.2592, 0.144],
        c2: [0.78, 0.52, 0.3],
        c3: [0.88, 0.66, 0.42],
      },
      {
        cx: 0.5,
        cy: 0.5,
        rx: 0.16,
        ry: 0.13,
        rot: 0.1,
        seed: 72.8,
        warp: 3.4,
        thresh: 0.4,
        intensity: 1.0,
        es: 2.0,
        c0: [0.324, 0.225, 0.135],
        c1: [0.6192, 0.4752, 0.3168],
        c2: [0.94, 0.8, 0.6],
        c3: [0.99, 0.92, 0.78],
      },
    ],
    "nebula-whofor": [
      {
        cx: 0.18,
        cy: 0.82,
        rx: 0.48,
        ry: 0.38,
        rot: 0.9,
        seed: 80.0,
        warp: 2.6,
        thresh: 0.34,
        intensity: 0.95,
        es: 1.2,
        c0: [0.009, 0.018, 0.072],
        c1: [0.036, 0.072, 0.216],
        c2: [0.08, 0.18, 0.44],
        c3: [0.13, 0.26, 0.56],
      },
      {
        cx: 0.16,
        cy: 0.79,
        rx: 0.3,
        ry: 0.24,
        rot: 0.85,
        seed: 81.5,
        warp: 3.0,
        thresh: 0.38,
        intensity: 1.25,
        es: 1.6,
        c0: [0.0315, 0.072, 0.18],
        c1: [0.0936, 0.2016, 0.4032],
        c2: [0.22, 0.42, 0.68],
        c3: [0.34, 0.56, 0.78],
      },
    ],
  };

  // Cursor-tracking glow for all buttons
  document.querySelectorAll(".btn, .start-here-btn, .btn-outline").forEach((el) => {
    el.addEventListener("mousemove", (e) => {
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      el.style.setProperty("--mx", x + "%");
      el.style.setProperty("--my", y + "%");
    });
  });

  const query = "web agencies · stockholm";
  // Every one of these is a live getter, not a cached reference — see the
  // comment above typeQuery() for why: a long-held DOM reference can go
  // stale if React ever replaces the underlying node after mount, and it
  // fails completely silently (no error, just invisible no-op writes).
  // Accessing els.whatever always re-queries the live DOM.
  const els = {
    get typedEl() {
      return document.getElementById("typed-text");
    },
    get searchBar() {
      return document.getElementById("search-bar");
    },
    get submitBtn() {
      return document.getElementById("search-submit");
    },
    get typingCursor() {
      return document.getElementById("cursor");
    },
    get loadingBlock() {
      return document.getElementById("loading-block");
    },
    get statusEl() {
      return document.getElementById("status-text");
    },
    get unfoldOuter() {
      return document.getElementById("unfold-outer");
    },
    get unfoldInner() {
      return document.getElementById("unfold-inner");
    },
    get rawListEl() {
      return document.getElementById("raw-list");
    },
    get phase1() {
      return document.getElementById("phase1");
    },
    get track() {
      return document.getElementById("track");
    },
    get dots() {
      return document.querySelectorAll(".phase-dot");
    },
    get barLabel() {
      return document.getElementById("bar-label");
    },
    get prepBtnSelected() {
      return document.getElementById("prep-btn-3");
    },
    get cardSelected() {
      return document.getElementById("card-3");
    },
    get tp3Panel() {
      return document.getElementById("tp3");
    },
    get chipEmail() {
      return document.getElementById("chip-email");
    },
    get chipConsultative() {
      return document.getElementById("chip-consultative");
    },
    get msgLabel() {
      return document.getElementById("msg-label");
    },
    get msgBox() {
      return document.getElementById("msg-box");
    },
    get sendBtn() {
      return document.getElementById("send-btn");
    },
    get sentToast() {
      return document.getElementById("sent-toast");
    },
    get demoWrap() {
      return document.querySelector(".demo-wrap");
    },
    get stageEl() {
      return document.querySelector(".stage");
    },
    get mouseCursor() {
      return document.getElementById("cursor-el");
    },
    get clickRing() {
      return document.getElementById("click-ring");
    },
    get snapshotCount() {
      return document.getElementById("snapshot-count");
    },
    get legendRows() {
      return document.querySelectorAll(".snap-legend-row");
    },
    get snapStatBoxes() {
      return document.querySelector(".snap-stat-boxes");
    },
    get segHigh() {
      return document.getElementById("seg-high");
    },
    get segGood() {
      return document.getElementById("seg-good");
    },
    get segLow() {
      return document.getElementById("seg-low");
    },
    get segContacted() {
      return document.getElementById("seg-contacted");
    },
  };

  // Brings the market snapshot to life on entry: donut segments draw in
  // one after another, the total count counts up, legend rows and the
  // stat boxes stagger in — instead of the whole panel just appearing
  // fully formed and static.
  function animateSnapshot() {
    els.segHigh.style.strokeDasharray = "0 238.76";
    els.segGood.style.strokeDasharray = "0 238.76";
    els.segLow.style.strokeDasharray = "0 238.76";
    els.segContacted.style.strokeDasharray = "0 238.76";
    els.snapshotCount.textContent = "0";
    els.legendRows.forEach((r) => {
      r.style.opacity = "0";
      r.style.transform = "translateX(-8px)";
    });
    els.snapStatBoxes.style.opacity = "0";
    els.snapStatBoxes.style.transform = "translateY(6px)";

    // Each segment's fill now takes 350ms (down from 700ms) and they're
    // scheduled fully sequentially — each starts exactly when the
    // previous one finishes — so the whole donut fills as one
    // continuous sweep, like a clock hand moving around, rather than
    // multiple segments growing from different points at once.
    scopedSetTimeout(() => {
      els.segHigh.style.strokeDasharray = "36.01 238.76";
    }, 0);
    scopedSetTimeout(() => {
      els.segGood.style.strokeDasharray = "60.97 238.76";
    }, 350);
    scopedSetTimeout(() => {
      els.segLow.style.strokeDasharray = "95.28 238.76";
    }, 700);
    scopedSetTimeout(() => {
      els.segContacted.style.strokeDasharray = "46.50 238.76";
    }, 1050);

    const target = 842;
    const duration = 900;
    const startTime = performance.now();
    function tick(now) {
      const progress = Math.min(1, (now - startTime) / duration);
      els.snapshotCount.textContent = Math.round(progress * target);
      if (progress < 1) scopedRAF(tick);
    }
    scopedRAF(tick);

    els.legendRows.forEach((row, i) => {
      scopedSetTimeout(
        () => {
          row.style.opacity = "1";
          row.style.transform = "translateX(0)";
        },
        600 + i * 150,
      );
    });

    scopedSetTimeout(() => {
      els.snapStatBoxes.style.opacity = "1";
      els.snapStatBoxes.style.transform = "translateY(0)";
    }, 1500);
  }

  const statuses = ["Scanning the market…", "Checking web presence…", "Detecting opportunity signals…"];
  const rawNames = [
    "Baltic Digital AB",
    "Kvist & Partners",
    "North Signal Media",
    "Örn Consulting",
    "Fyra Studios",
    "Reva Marketing Group",
    "Hallonberg Media",
    "Stensson Digital",
    "Klarvik Studio",
    "Ängby Consulting",
  ];

  function setDot(i) {
    els.dots.forEach((d, idx) => (d.style.background = idx === i ? "#e8b72d" : "#333"));
  }

  // Custom-duration scroll (native smooth-scroll is too fast, typically
  // 300-500ms, to read as someone genuinely browsing a list).
  function slowScrollTo(el, targetTop, duration, onDone) {
    const startTop = el.scrollTop;
    const distance = targetTop - startTop;
    const startTime = performance.now();
    function tick(now) {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      el.scrollTop = startTop + distance * eased;
      if (progress < 1) scopedRAF(tick);
      else if (onDone) onDone();
    }
    scopedRAF(tick);
  }

  function typeQuery(cb) {
    console.log(
      "[vantio-hero] typeQuery() started, els.typedEl found:",
      !!els.typedEl,
      "query:",
      JSON.stringify(query),
    );
    let i = 0;
    (function step() {
      if (i <= query.length) {
        const text = query.slice(0, i);
        // els.typedEl is a live getter (see the `els` object above) — this
        // always writes to whatever's actually on screen right now, so it
        // can't silently go stale even if React replaces this node.
        if (els.typedEl) els.typedEl.textContent = text;
        console.log(`[vantio-hero] step() i=${i} set textContent to "${text}"`);
        i++;
        scopedSetTimeout(step, 65);
      } else {
        console.log("[vantio-hero] typeQuery() finished, calling cb()");
        cb();
      }
    })();
  }

  // Moves the mouse cursor to the center of a target element, pauses
  // briefly as if arriving, plays a click pulse + expanding ring, then
  // fires onArrive. Positions are calculated live against demoWrap so
  // this works regardless of which track panel is currently visible.
  function clickOn(targetEl, onArrive, onDone) {
    const wrapRect = els.demoWrap.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();
    const x = targetRect.left - wrapRect.left + targetRect.width / 2 - 8;
    const y = targetRect.top - wrapRect.top + targetRect.height / 2 - 8;

    els.mouseCursor.style.left = x + "px";
    els.mouseCursor.style.top = y + "px";
    els.mouseCursor.classList.add("visible");

    scopedSetTimeout(() => {
      els.mouseCursor.classList.add("clicking");
      els.clickRing.classList.add("pinging");
      onArrive();
      scopedSetTimeout(() => {
        els.mouseCursor.classList.remove("clicking");
        els.clickRing.classList.remove("pinging");
        scopedSetTimeout(() => {
          els.mouseCursor.classList.remove("visible");
          if (onDone) onDone();
        }, 350);
      }, 350);
    }, 750);
  }

  function resetAll() {
    els.typedEl.textContent = "";
    els.searchBar.classList.remove("submitted");
    els.submitBtn.classList.remove("clicked");
    els.loadingBlock.classList.remove("visible");
    els.unfoldInner.classList.remove("open");
    els.unfoldOuter.classList.remove("faded");
    els.rawListEl.innerHTML = "";
    els.phase1.classList.remove("swiping-out");
    els.phase1.style.opacity = "1";
    els.prepBtnSelected.classList.remove("clicked");
    els.cardSelected.classList.remove("pressed");
    els.chipEmail.classList.remove("active");
    els.chipConsultative.classList.remove("active");
    els.msgLabel.style.opacity = "0";
    els.msgBox.style.opacity = "0";
    els.sendBtn.style.opacity = "0";
    els.sendBtn.classList.remove("sent");
    els.sentToast.style.opacity = "0";
    els.sentToast.style.transform = "translateX(-6px)";
    els.mouseCursor.classList.remove("visible");
    els.tp3Panel.scrollTop = 0;
    els.segHigh.style.strokeDasharray = "0 238.76";
    els.segGood.style.strokeDasharray = "0 238.76";
    els.segLow.style.strokeDasharray = "0 238.76";
    els.segContacted.style.strokeDasharray = "0 238.76";
    els.snapshotCount.textContent = "0";
    els.legendRows.forEach((r) => {
      r.style.opacity = "0";
      r.style.transform = "translateX(-8px)";
    });
    els.snapStatBoxes.style.opacity = "0";
    els.snapStatBoxes.style.transform = "translateY(6px)";
    els.track.style.transition = "none";
    els.track.style.transform = "translateX(0)";
    void els.track.offsetWidth;
    els.track.style.transition = "transform 0.8s cubic-bezier(0.65,0,0.35,1)";
    setDot(0);
    els.barLabel.textContent = "vantioapp.com — Lead Tool";
    els.typingCursor.style.display = "inline-block";
  }

  function runSequence() {
    console.log("[vantio-hero] runSequence() called");
    try {
      resetAll();
      console.log("[vantio-hero] resetAll() completed");
    } catch (err) {
      console.error("[vantio-hero] resetAll() threw:", err);
      return;
    }

    typeQuery(() => {
      els.typingCursor.style.display = "none";

      // Cursor clicks the SCAN button to submit the search
      clickOn(els.submitBtn, () => {
        els.submitBtn.classList.add("clicked");
        scopedSetTimeout(() => els.submitBtn.classList.remove("clicked"), 200);
        els.searchBar.classList.add("submitted");
      });

      scopedSetTimeout(() => {
        els.loadingBlock.classList.add("visible");
        let si = 0;
        els.statusEl.textContent = statuses[0];
        const statusTimer = scopedSetInterval(() => {
          si = (si + 1) % statuses.length;
          els.statusEl.textContent = statuses[si];
        }, 900);

        scopedSetTimeout(() => {
          clearInterval(statusTimer);
          els.loadingBlock.classList.remove("visible");
          rawNames.forEach((n, i) => {
            const row = document.createElement("div");
            row.className = "raw-row";
            row.style.animationDelay = i * 0.12 + "s";
            row.innerHTML = `<div class="raw-dot"></div><span style="font-size:12px; color:#aaa;">${n}</span>`;
            els.rawListEl.appendChild(row);
          });
          els.unfoldInner.classList.add("open");
          scopedSetTimeout(() => els.unfoldOuter.classList.add("faded"), 700);
          setDot(1);

          scopedSetTimeout(() => {
            els.phase1.classList.add("swiping-out");
            els.track.style.transform = "translateX(-33.333%)";
            els.barLabel.textContent = "vantioapp.com — Home";
            setDot(1);
            scopedSetTimeout(animateSnapshot, 850);

            scopedSetTimeout(() => {
              els.track.style.transform = "translateX(-66.666%)";
              setDot(2);

              // Single scroll down — stops at a position where the
              // selected (3rd) card is visible but the 5th lead is not
              // yet even half revealed, then clicks and transitions
              // right there rather than scrolling further and back.
              scopedSetTimeout(() => {
                const lastCard = els.tp3Panel.querySelector(".score-card:last-child");
                const halfLastCardLimit = lastCard.offsetTop + lastCard.offsetHeight / 2 - els.tp3Panel.clientHeight;
                const selectedVisibleTarget = Math.max(0, els.cardSelected.offsetTop - 20);
                const targetTop = Math.max(0, Math.min(selectedVisibleTarget, halfLastCardLimit));

                slowScrollTo(els.tp3Panel, targetTop, 2800, () => {
                  clickOn(els.prepBtnSelected, () => {
                    els.cardSelected.classList.add("pressed");
                    els.prepBtnSelected.classList.add("clicked");
                  });
                });

                scopedSetTimeout(() => {
                  els.track.style.transform = "translateX(-100%)";
                  setDot(3);
                  els.barLabel.textContent = "vantioapp.com — Outreach";

                  // Cursor selects channel, then tone (chained via onDone so the
                  // second click never starts until the first cursor animation
                  // has genuinely finished — fixed timing offsets caused the
                  // cursor to reposition mid-fade before).
                  scopedSetTimeout(() => {
                    clickOn(
                      els.chipEmail,
                      () => els.chipEmail.classList.add("active"),
                      () => {
                        clickOn(
                          els.chipConsultative,
                          () => els.chipConsultative.classList.add("active"),
                          () => {
                            els.msgLabel.style.opacity = "1";
                            els.msgBox.style.opacity = "1";
                            els.sendBtn.style.opacity = "1";

                            // Cursor clicks Send as the final action of the sequence
                            scopedSetTimeout(() => {
                              clickOn(els.sendBtn, () => {
                                els.sendBtn.classList.add("sent");
                                els.sendBtn.style.transform = "scale(0.94)";
                                scopedSetTimeout(() => {
                                  els.sendBtn.style.transform = "scale(1)";
                                }, 150);

                                els.sentToast.style.opacity = "1";
                                els.sentToast.style.transform = "translateX(0)";
                                scopedSetTimeout(() => {
                                  els.sentToast.style.opacity = "0";
                                  els.sentToast.style.transform = "translateX(-6px)";
                                }, 1350);
                              });
                            }, 525);
                          },
                        );
                      },
                    );
                  }, 900);

                  scopedSetTimeout(() => {
                    els.stageEl.classList.add("fading");
                    scopedSetTimeout(() => {
                      runSequence();
                      scopedSetTimeout(() => els.stageEl.classList.remove("fading"), 50);
                    }, 500);
                  }, 7625);
                }, 4550);
              }, 900);
            }, 5200);
          }, 3400);
        }, 2600);
      }, 900);
    });
  }

  console.log("[vantio-hero] about to call runSequence() for the first time");
  try {
    runSequence();

    // Scheduled after the first runSequence() call above (not before)
    // so the hero typing animation's own timer gets queued first — the
    // nebula rendering below is real CPU work (canvas noise generation
    // across up to 8 sections) and shouldn't get a head start competing
    // with the more visually important, attention-grabbing typing effect
    // for the first paint after mount.
    // Mobile gating matches the rest of the app (see lib/config/mobileVisuals.ts):
    // skip the animated nebula canvases on mobile, keep the static star fields.
    //
    // The initial render is deferred by two animation frames rather than run
    // synchronously here. In the original static HTML file this script ran
    // after the browser had already fully laid out the whole page, so every
    // canvas's getBoundingClientRect() was accurate immediately. In a React/
    // Next.js client component, this effect can fire before the browser has
    // finished laying out a page this tall (especially right after a large
    // injected <style> block and dangerouslySetInnerHTML block land in the
    // same commit) — measuring too early risks reading a canvas's size before
    // its real layout has settled. Two rAFs is the standard, cheap way to
    // guarantee a layout/paint has actually completed before measuring.
    if (!isMobile || MOBILE_NEBULA_ENABLED) {
      const renderOneNebula = (id) => {
        // Each canvas is rendered in its own try/catch so a failure on any
        // single one can't affect any other, or the lazy-observer loop
        // below.
        try {
          renderNebulaOnCanvas(id, SECTION_NEBULAS[id]);
        } catch (err) {
          console.error(`Nebula render failed for #${id}:`, err);
        }
      };

      // Only the hero's nebula renders immediately — it's the only one
      // actually visible on first paint. Deferred two animation frames for
      // the same layout-timing reason as before.
      scopedRAF(() => {
        scopedRAF(() => renderOneNebula("nebula-hero"));
      });

      // Every other section's nebula is lazy-rendered via
      // IntersectionObserver, firing just before that section actually
      // scrolls into view (400px rootMargin gives it a head start so
      // there's no visible pop-in). This is the fix for the multi-second
      // delay before anything visually updates on load: rendering all 8
      // sections' nebulas eagerly meant several million pixel evaluations
      // of noise math blocking the main thread before the browser could
      // even paint the hero's typed text — 7 of those 8 sections aren't
      // even visible yet at that point.
      const lazyIds = Object.keys(SECTION_NEBULAS).filter((id) => id !== "nebula-hero");
      if ("IntersectionObserver" in window) {
        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                renderOneNebula(entry.target.id);
                observer.unobserve(entry.target);
              }
            });
          },
          { rootMargin: "400px 0px" },
        );
        lazyIds.forEach((id) => {
          const el = document.getElementById(id);
          if (el) observer.observe(el);
        });
        observers.push(observer);
      } else {
        // No IntersectionObserver support: fall back to rendering
        // everything up front rather than never rendering it at all.
        lazyIds.forEach(renderOneNebula);
      }
    }
  } catch (err) {
    console.error("[vantio-hero] runSequence() threw synchronously:", err);
  }
  console.log("[vantio-hero] runLandingAnimations() setup finished (async timers now scheduled)");

  return () => {
    timeouts.forEach((id) => clearTimeout(id));
    intervals.forEach((id) => clearInterval(id));
    rafs.forEach((id) => cancelAnimationFrame(id));
    observers.forEach((observer) => observer.disconnect());
  };
}
