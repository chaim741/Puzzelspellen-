// ---------- App framework: one game, home / play / settings, levels, daily puzzle, first-play tutorial ----------
// iOS 15 Safari has no canvas roundRect yet
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    r = Math.max(0, Math.min(+r || 0, Math.abs(w) / 2, Math.abs(h) / 2));
    this.moveTo(x + r, y); this.arcTo(x + w, y, x + w, y + h, r); this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r); this.closePath();
  };
}
const GAMES = [];
const LAB = (() => {
  const COLORS = ['#ef5b4c', '#f5a524', '#2dbf84', '#3b8cff', '#8b5cf6', '#ff6fa8'];
  const $ = id => document.getElementById(id);
  const cv = $('cv'), ctx = cv.getContext('2d'), stage = $('stage'), well = $('well');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let P = 'app';
  const store = {
    get(k, d) { try { const v = localStorage.getItem(P + '_' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(P + '_' + k, JSON.stringify(v)); } catch {} },
  };
  let W = 0, dpr = 1, cur = null, fx = [], shakeAmt = 0, score = 0, shownScore = 0, ended = false, playing = false;
  let soundOn = true, vibOn = true, mode = 'free', tut = null;
  // the level being played: {n, moves, goals: [{k, v, n, max, got}], s2, s3}
  let lvl = null;

  // the board is the largest square that fits the space between the top bar and the buttons
  function resize() {
    const r = well.getBoundingClientRect(), s = Math.max(200, Math.floor(Math.min(r.width, r.height, 460)));
    stage.style.width = s + 'px'; stage.style.height = s + 'px';
    dpr = Math.min(devicePixelRatio || 1, 3); W = s; cv.width = Math.round(W * dpr); cv.height = Math.round(W * dpr);
  }
  new ResizeObserver(resize).observe(well);

  // seeded randomness so everyone gets the same daily puzzle, and a level always starts the same way
  let rng = Math.random;
  const seeded = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const hash = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

  // ---- sound: soft, low "bloops" through a small room echo. Everything passes one compressor, so stacked sounds never clip.
  let ac = null, out = null, verb = null, noiseBuf = null;
  function audio() {
    if (!soundOn) return null;
    try {
      if (!ac) {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4;
        const master = ac.createGain(); master.gain.value = 0.95; comp.connect(master); master.connect(ac.destination);
        // the room: a burst of fading noise used as the echo of every sound
        const len = Math.floor(ac.sampleRate * 1.2), ir = ac.createBuffer(2, len, ac.sampleRate);
        for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4); }
        const conv = ac.createConvolver(); conv.buffer = ir; const wet = ac.createGain(); wet.gain.value = 0.2; conv.connect(wet); wet.connect(comp);
        noiseBuf = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.2), ac.sampleRate);
        const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
        out = comp; verb = conv;
      }
      if (ac.state !== 'running') ac.resume();
    } catch { ac = null; }
    return ac;
  }
  // iOS only lets sound start from the end of a tap; a silent blip on every tap keeps the audio unlocked
  const unlock = () => { const a = audio(); if (!a) return; try { const b = a.createBuffer(1, 1, 22050), src = a.createBufferSource(); src.buffer = b; src.connect(a.destination); src.start(0); } catch {} };
  for (const ev of ['touchend', 'pointerup', 'click']) addEventListener(ev, unlock, { passive: true, capture: true });
  // one voice: a sine that slides a little in pitch as it starts (the "bloop"), an optional soft overtone, low-passed to stay warm
  function voice(f, { dur = 0.3, vol = 0.3, drop = 0.4, harm = 0.2, h3 = 0, lp = 1600, when = 0, wet = 1 } = {}) {
    const a = audio(); if (!a || !out) return;
    const t = a.currentTime + 0.005 + when, g = a.createGain(), filt = a.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = lp; filt.Q.value = 0.4;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(filt); filt.connect(out);
    if (wet) { const s = a.createGain(); s.gain.value = wet; filt.connect(s); s.connect(verb); }
    const osc = (freq, v) => {
      const o = a.createOscillator(), og = a.createGain(); o.type = 'sine';
      o.frequency.setValueAtTime(freq * (1 + drop), t); o.frequency.exponentialRampToValueAtTime(freq, t + 0.07);
      og.gain.value = v; o.connect(og); og.connect(g); o.start(t); o.stop(t + dur + 0.05);
    };
    // phone speakers barely play the deepest notes, so soft overtones carry the low pitch to the ear
    osc(f, 1); if (harm) osc(f * 2, harm); if (h3) osc(f * 3, h3);
  }
  // a short soft knock of filtered noise: gives a sound a physical "touch"
  function knock({ dur = 0.05, vol = 0.12, lp = 900, when = 0 } = {}) {
    const a = audio(); if (!a || !out) return;
    const t = a.currentTime + 0.005 + when, src = a.createBufferSource(), g = a.createGain(), filt = a.createBiquadFilter();
    src.buffer = noiseBuf; filt.type = 'lowpass'; filt.frequency.value = lp;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt); filt.connect(g); g.connect(out); src.start(t); src.stop(t + dur + 0.02);
  }
  // notes of a pentatonic scale from a low C up: every combination sounds pleasant together
  const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28];
  const low = k => 130.81 * Math.pow(2, PENTA[Math.max(0, Math.min(Math.round(k), PENTA.length - 1))] / 12);
  const SFX = {
    pop(k = 0, when = 0) { const f = low(k); voice(f, { when, dur: 0.45, vol: 0.4, drop: 0.5, harm: 0.35, h3: 0.1, lp: 1400 }); voice(f / 2, { when, dur: 0.26, vol: 0.24, drop: 0.35, harm: 0, lp: 380, wet: 0 }); knock({ when, dur: 0.035, vol: 0.1, lp: 1000 }); },
    bump() { voice(70, { dur: 0.2, vol: 0.36, drop: 0.7, harm: 0.3, h3: 0.15, lp: 700, wet: 0.3 }); knock({ dur: 0.06, vol: 0.12, lp: 450 }); },
    land(k = 0) { voice(98 - k * 8, { dur: 0.26, vol: 0.4, drop: 0.8, harm: 0.4, h3: 0.2, lp: 900, wet: 0.4 }); knock({ dur: 0.05, vol: 0.14, lp: 600 }); },
    merge(k = 0) { const f = low(k); voice(f, { dur: 0.55, vol: 0.36, drop: -0.3, harm: 0.35, h3: 0.08, lp: 1700 }); voice(f * 1.5, { when: 0.07, dur: 0.45, vol: 0.12, drop: -0.2, harm: 0, lp: 1700 }); voice(f / 2, { dur: 0.3, vol: 0.2, drop: 0.2, harm: 0, lp: 360, wet: 0 }); },
    tick(k = 0) { voice(low(k + 2), { dur: 0.18, vol: 0.2, drop: 0.3, harm: 0.12, lp: 2000 }); },
    star(i = 0) { const f = low(5 + i * 2); voice(f, { dur: 0.8, vol: 0.26, drop: -0.08, harm: 0.3, lp: 2400 }); voice(f / 2, { dur: 0.45, vol: 0.18, drop: 0, harm: 0, lp: 420, wet: 0 }); },
    win() { [0, 2, 4, 5].forEach((k, i) => voice(low(k), { when: i * 0.09, dur: 0.7, vol: 0.22, drop: 0.2, harm: 0.22, lp: 1700 })); voice(65.41, { when: 0.27, dur: 1.3, vol: 0.2, drop: 0, harm: 0, lp: 260 }); },
    lose() { voice(low(2), { dur: 0.45, vol: 0.22, drop: 0.08, harm: 0.1 }); voice(low(0) * 0.75, { when: 0.22, dur: 0.8, vol: 0.24, drop: 0.08, harm: 0.1 }); },
    tap() { knock({ dur: 0.03, vol: 0.05, lp: 2200 }); },
  };
  const sfx = (name, ...a) => { try { SFX[name] && SFX[name](...a); } catch {} };
  // kept for older game code: a soft voice at the given pitch
  function tone(freq, dur = 0.14, type, vol = 0.15, when = 0) { voice(Math.min(freq, 600), { dur: Math.max(dur, 0.2), vol: Math.min(0.3, vol * 1.6), when, harm: 0.15 }); }
  const note = k => low(k);

  // ---- haptics: in the app the phone's own Taptic engine; in a browser, vibrate where supported.
  // kinds: select (the crisp tick of a picker), light / medium / heavy (a knock), success / warning (a pattern)
  let lastBuzz = 0;
  const VIB = { select: 4, light: 10, medium: 18, heavy: 30, success: [12, 50, 20], warning: [30, 60, 30] };
  const quiet = r => { try { r && r.catch && r.catch(() => {}); } catch {} };
  const buzz = p => {
    if (!vibOn) return;
    if (typeof p === 'number') p = p >= 20 ? 'medium' : 'light'; else if (Array.isArray(p)) p = 'warning';
    const now = performance.now(), pattern = p === 'success' || p === 'warning';
    if (!pattern && now - lastBuzz < 40) return; lastBuzz = now;
    const hp = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics;
    try {
      if (hp) {
        if (p === 'select') { quiet(hp.selectionStart()); quiet(hp.selectionChanged()); quiet(hp.selectionEnd()); }
        else if (pattern) quiet(hp.notification({ type: p.toUpperCase() }));
        else quiet(hp.impact({ style: p.toUpperCase() }));
        return;
      }
      navigator.vibrate && navigator.vibrate(VIB[p] || 10);
    } catch {}
  };

  // drawing helpers
  const hex = c => { const n = parseInt(c.slice(1, 7), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  // mix a colour toward white (amt > 0) or toward a deep ink (amt < 0)
  const shade = (c, amt) => { const [r, g, b] = hex(c), t = amt > 0 ? [255, 255, 255] : [40, 30, 60], k = Math.abs(amt); return `rgb(${Math.round(r + (t[0] - r) * k)},${Math.round(g + (t[1] - g) * k)},${Math.round(b + (t[2] - b) * k)})`; };
  // a raised rounded block: soft shadow, darker side, lit face, a little gloss
  function block(x, y, w, color, r = w * 0.24, c = ctx) {
    const d = w * 0.09, h = w - d;
    c.fillStyle = 'rgba(70,50,30,.16)'; c.beginPath(); c.roundRect(x - w / 2 + w * 0.04, y - h / 2 + d + w * 0.06, w - w * 0.08, h, r); c.fill();
    c.fillStyle = shade(color, -0.28); c.beginPath(); c.roundRect(x - w / 2, y - h / 2 + d * 0.2, w, h + d * 0.8, r); c.fill();
    const g = c.createLinearGradient(0, y - h / 2 - d * 0.4, 0, y + h / 2); g.addColorStop(0, shade(color, 0.2)); g.addColorStop(1, color);
    c.fillStyle = g; c.beginPath(); c.roundRect(x - w / 2, y - h / 2 - d * 0.4, w, h, r); c.fill();
    c.fillStyle = 'rgba(255,255,255,.28)'; c.beginPath(); c.roundRect(x - w / 2 + w * 0.12, y - h / 2 - d * 0.4 + w * 0.07, w * 0.76, h * 0.26, r * 0.6); c.fill();
    return y - d * 0.4;
  }
  // a glossy ball lit from the top left
  function ball(x, y, r, color, c = ctx) {
    c.fillStyle = 'rgba(70,50,30,.18)'; c.beginPath(); c.ellipse(x + r * 0.08, y + r * 0.92, r * 0.78, r * 0.2, 0, 0, Math.PI * 2); c.fill();
    const g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    g.addColorStop(0, shade(color, 0.45)); g.addColorStop(0.55, color); g.addColorStop(1, shade(color, -0.3));
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(x - r * 0.32, y - r * 0.45, r * 0.32, r * 0.18, -0.6, 0, Math.PI * 2); c.fill();
  }
  function shape(s, x, y, r, mode = 'fill', color, c2 = ctx) {
    const c = color || COLORS[s % COLORS.length];
    c2.beginPath();
    const k = s % 6;
    if (k === 0) c2.arc(x, y, r, 0, Math.PI * 2);
    else if (k === 1) { const h = r * 1.15; c2.moveTo(x, y - h); c2.lineTo(x + h * 0.95, y + h * 0.62); c2.lineTo(x - h * 0.95, y + h * 0.62); c2.closePath(); }
    else if (k === 2) c2.roundRect(x - r * 0.88, y - r * 0.88, r * 1.76, r * 1.76, r * 0.3);
    else if (k === 3) { const h = r * 1.2; c2.moveTo(x, y - h); c2.lineTo(x + h, y); c2.lineTo(x, y + h); c2.lineTo(x - h, y); c2.closePath(); }
    else if (k === 4) { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.5 : r * 1.15; c2[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c2.closePath(); }
    else { for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; c2[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r * 1.05, y + Math.sin(a) * r * 1.05); } c2.closePath(); }
    if (mode === 'emboss') {
      c2.fillStyle = '#fff'; c2.shadowColor = 'rgba(40,30,60,.3)'; c2.shadowOffsetY = r * 0.14; c2.shadowBlur = r * 0.2; c2.fill();
      c2.shadowColor = 'transparent'; c2.shadowOffsetY = 0; c2.shadowBlur = 0; c2.lineJoin = 'round'; c2.lineWidth = r * 0.12; c2.strokeStyle = '#fff'; c2.stroke();
    } else if (mode === 'fill') {
      c2.fillStyle = c; c2.fill(); c2.lineWidth = Math.max(1.5, r * 0.16); c2.strokeStyle = '#fff'; c2.lineJoin = 'round'; c2.stroke();
    } else { c2.lineWidth = Math.max(2, r * 0.32); c2.strokeStyle = c; c2.lineJoin = 'round'; c2.stroke(); }
  }
  // a five-pointed star path
  function starPath(c, x, y, r) { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * 0.48 : r; c[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * q, y + Math.sin(a) * q); } c.closePath(); }
  function rr(x, y, w, h, r, fill, stroke, lw = 1) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  }
  // grid fitted into the square board
  function grid(cols, rows, padF = 0.035) {
    const pad = W * padF, cs = (W - 2 * pad) / Math.max(cols, rows);
    const ox = (W - cs * cols) / 2, oy = (W - cs * rows) / 2;
    return {
      cols, rows, cs, ox, oy,
      x: c => ox + (c + 0.5) * cs, y: r => oy + (r + 0.5) * cs,
      cell(px, py) { const c = Math.floor((px - ox) / cs), r = Math.floor((py - oy) / cs); return c >= 0 && r >= 0 && c < cols && r < rows ? { c, r } : null; },
      cellF(px, py) { return { c: (px - ox) / cs, r: (py - oy) / cs }; },
      bg(danger) {
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const x = ox + c * cs + cs * 0.06, y = oy + r * cs + cs * 0.06, w = cs * 0.88;
          rr(x, y, w, w, cs * 0.2, danger ? '#ecc9c2' : '#dcd2c3');
          rr(x, y + cs * 0.05, w, w - cs * 0.05, cs * 0.2, danger ? '#f3d8d2' : '#e6ddcf');
        }
      },
    };
  }

  // ---- effects (pixel coordinates in board space)
  function burst(x, y, color, n = 12, power = 1) {
    fx.push({ k: 'ring', x, y, c: color, life: 0, max: 420, r: W * 0.05 * power });
    const parts = reduce ? 4 : n;
    for (let i = 0; i < parts; i++) {
      const a = Math.random() * Math.PI * 2, s = (0.5 + Math.random() * 1.6) * W * 0.004 * power;
      fx.push({ k: 'dot', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, c: color, life: 0, max: 400 + Math.random() * 300 });
    }
    // a few white sparkles on top
    if (!reduce) for (let i = 0; i < 3 + power * 2; i++) {
      const a = Math.random() * Math.PI * 2, s = (0.8 + Math.random()) * W * 0.004 * power;
      fx.push({ k: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: 450 + Math.random() * 250, rot: Math.random() * 3 });
    }
  }
  function confetti(n = 70) {
    if (reduce) return;
    for (let i = 0; i < n; i++) fx.push({ k: 'conf', x: W * Math.random(), y: -W * 0.05 - Math.random() * W * 0.3, vx: (Math.random() - 0.5) * W * 0.004, vy: W * (0.002 + Math.random() * 0.004), rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, c: COLORS[i % 5], life: 0, max: 1800 + Math.random() * 900 });
  }
  const float = (text, x, y, size = 1) => fx.push({ k: 'text', text, x, y, size, life: 0, max: 900 });
  // big words in the middle of the board; a higher tier is bigger and more colourful
  const BANNER = ['#f2a01c', '#2dbf84', '#3b8cff', '#ef5b4c', '#8b5cf6'];
  const banner = (text, tier = 0) => { fx = fx.filter(f => f.k !== 'banner'); fx.push({ k: 'banner', text, tier: Math.min(tier, 4), life: 0, max: 1250 }); };
  const shake = a => { shakeAmt = Math.max(shakeAmt, a); };

  const fmt = n => n.toLocaleString('nl-NL');
  // what one move is called in this game: a move, or a weight
  const MW = () => cur.moveWord || ['zet', 'zetten'];
  const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const bestKey = () => mode === 'daily' ? 'daily_' + today() : 'best';
  function hud() {
    if (mode !== 'level') $('best').textContent = fmt(Math.max(store.get(bestKey(), 0), score));
    updateChips();
  }

  // ---- levels: goals, the goal chips above the board, stars
  const stars = () => store.get('stars', {});
  const totalStars = () => Object.values(stars()).reduce((a, b) => a + b, 0);
  const unlocked = () => store.get('level', 1);
  const goalLeft = g => g.max ? (g.got >= g.n ? 0 : 1) : Math.max(0, g.n - g.got);
  const goalsDone = () => lvl && lvl.goals.every(g => g.k === 'score' ? score >= g.n : goalLeft(g) === 0);
  function goalText(g) {
    if (g.k === 'score') return `${fmt(Math.max(0, g.n - score))} punten`;
    return cur.goalText ? cur.goalText(g, goalLeft(g)) : String(goalLeft(g));
  }
  function buildChips() {
    const box = $('goals'); box.innerHTML = ''; box.hidden = !lvl;
    if (!lvl) return;
    lvl.goals.forEach(g => {
      const el = document.createElement('div'), c = document.createElement('canvas'), b = document.createElement('b');
      el.className = 'chip'; c.width = c.height = 72; b.textContent = '';
      el.append(c, b); box.appendChild(el); g.el = el; g.shown = g.k === 'score' ? 0 : g.got;
      const x = c.getContext('2d'); x.scale(72 / 100, 72 / 100);
      if (g.k === 'score') { x.fillStyle = '#f2a01c'; starPath(x, 50, 52, 40); x.fill(); x.lineWidth = 6; x.strokeStyle = '#fff'; x.lineJoin = 'round'; x.stroke(); }
      else cur.goalIcon(x, g, api);
    });
    updateChips();
  }
  function updateChips() {
    if (!lvl) return;
    for (const g of lvl.goals) {
      if (!g.el) continue;
      const done = g.k === 'score' ? score >= g.n : goalLeft({ ...g, got: g.shown }) === 0;
      const t = g.k === 'score' ? fmt(g.n) : g.max ? '' : String(Math.max(0, g.n - g.shown));
      const b = g.el.querySelector('b');
      if (done) { if (!g.el.classList.contains('done')) { g.el.classList.add('done'); b.textContent = '✓'; bump(g.el); } }
      else if (b.textContent !== t) b.textContent = t;
    }
  }
  const bump = el => { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); };
  // a small dot flies from the board to the goal it counts for
  function fly(x, y, g, color, delay = 0) {
    const r = cv.getBoundingClientRect(), to = g.el.getBoundingClientRect(), d = document.createElement('div');
    const sx = r.left + x * r.width / W, sy = r.top + y * r.height / W;
    d.className = 'fly'; d.style.background = color; d.style.left = sx + 'px'; d.style.top = sy + 'px';
    document.body.appendChild(d);
    setTimeout(() => { d.style.transform = `translate(${to.left + to.width * 0.3 - sx}px, ${to.top + to.height / 2 - sy}px) scale(.55)`; d.style.opacity = '.9'; }, 20 + delay);
    setTimeout(() => d.remove(), 560 + delay);
  }
  function setMoves(n) {
    const el = $('moves'); if (!el) return;
    const t = String(Math.max(0, n));
    if (el.textContent !== t) { el.textContent = t; bump($('movesStat')); }
    $('movesStat').classList.toggle('low', mode === 'level' && n <= 3 && !ended);
  }

  const api = {
    get W() { return W; }, ctx, COLORS, shape, rr, grid, shade, block, ball, starPath, burst, confetti, float, banner, shake, tone, note, sfx, buzz, reduce,
    get accent() { return cssVar('--accent'); },
    get score() { return score; },
    get mode() { return mode; },
    get level() { return lvl; },
    add(n, x, y, size) { if (!n) return; score += Math.round(n); hud(); if (x != null) float('+' + Math.round(n), x, y, size); },
    info(t) { $('info').textContent = t || ''; },
    setMoves,
    // the game reports progress: kind k (with value v) by amount; x, y is where on the board it happened
    collect(k, v, amt = 1, x, y, color) {
      if (!lvl || ended) return;
      lvl.goals.forEach(g => {
        if (g.k !== k || (g.v != null && g.v !== v)) return;
        const before = goalLeft(g);
        g.got = g.max ? Math.max(g.got, amt) : g.got + amt;
        if (!before) return;
        const target = g.got;
        if (x != null && g.el && !reduce) { const n = Math.min(4, g.max ? 1 : Math.ceil(amt / 2)); for (let i = 0; i < n; i++) fly(x, y, g, color || COLORS[(v || 0) % 6], i * 60); }
        setTimeout(() => { g.shown = Math.max(g.shown, target); updateChips(); bump(g.el); }, x != null && !reduce ? 520 : 0);
      });
    },
    // the game calls this when a turn has finished animating; movesLeft is null for games without a move limit
    turnEnd(movesLeft) {
      if (ended) return;
      if (mode === 'level') { if (goalsDone()) return levelWin(movesLeft || 0); if (movesLeft != null && movesLeft <= 0) return api.over(`Je ${MW()[1]} zijn op.`); return; }
      if (movesLeft != null && movesLeft <= 0) api.over('Je zetten zijn op.');
    },
    over(reason) {
      if (ended) return; ended = true;
      if (mode === 'level') { $('movesStat').classList.remove('low'); return levelLose(reason); }
      const prev = store.get(bestKey(), 0), isBest = score > prev;
      if (isBest) store.set(bestKey(), score);
      if (mode === 'free') store.set('games', store.get('games', 0) + 1);
      const close = mode === 'free' && !isBest && prev > 0 && score >= prev * 0.8;
      if (isBest && score > 0 && mode === 'free') { sfx('win'); buzz('success'); confetti(50); } else { sfx('lose'); buzz('warning'); }
      setTimeout(() => {
        if (!ended || !playing) return;
        coach(null);
        $('overStars').hidden = true;
        $('overTitle').textContent = mode === 'daily' ? 'Dagpuzzel klaar' : isBest && score > 0 ? 'Nieuw record!' : close ? 'Bijna!' : 'Einde';
        $('overTitle').classList.toggle('new', (isBest && score > 0) || close);
        $('finalScore').textContent = fmt(score); $('finalScore').hidden = false;
        // how far from the record: the "almost" feeling that makes you try again
        const gap = mode === 'free' && !isBest && prev > 0 ? ` Nog ${fmt(prev - score + 1)} punten tot je record.` : '';
        $('overText').textContent = (reason || '') + gap + (mode === 'daily' ? ' Morgen staat er een nieuwe dagpuzzel klaar.' : '');
        $('againBtn').textContent = mode === 'daily' ? 'Deel je score' : 'Nog een keer';
        $('shareBtn').hidden = true;
        openOver();
      }, 600);
    },
    get ended() { return ended; },
    get daily() { return mode === 'daily'; },
    rand: () => rng(),
    rnd: n => Math.floor(rng() * n),
  };

  function openOver() {
    // the buttons wait a moment so a last tap in the game doesn't press them by accident
    const bs = [$('againBtn'), $('toHomeBtn'), $('shareBtn')]; bs.forEach(b => b.disabled = true);
    setTimeout(() => { bs.forEach(b => b.disabled = false); if (matchMedia('(hover: hover)').matches) $('againBtn').focus({ preventScroll: true }); }, 650);
    $('over').hidden = false;
  }
  let winTimers = [];
  const later = (f, ms) => winTimers.push(setTimeout(f, ms));
  function levelWin(left) {
    ended = true; coach(null); $('movesStat').classList.remove('low');
    const n = lvl.n, st = left >= lvl.s3 ? 3 : left >= lvl.s2 ? 2 : 1;
    sfx('win'); buzz('success'); confetti(); banner('Level gehaald!', 1);
    // save right away: closing the app during the celebration keeps the stars
    const all = stars(); all[n] = Math.max(all[n] || 0, st); store.set('stars', all);
    if (unlocked() <= n) store.set('level', n + 1);
    // every move you have left becomes bonus points, one after another
    const per = 30 + 5 * Math.min(n, 30);
    let i = 0;
    const step = () => {
      if (!playing || mode !== 'level') return;
      if (i < left) {
        i++; score += per; setMoves(left - i);
        const x = W * (0.15 + Math.random() * 0.7), y = W * (0.18 + Math.random() * 0.64);
        burst(x, y, COLORS[i % 5], 10); float('+' + per, x, y, 0.9); sfx('tick', Math.min(i, 10)); buzz('light');
        later(step, Math.max(70, 150 - i * 6));
      } else later(() => showWin(st, left), 500);
    };
    later(step, 900);
  }
  function showWin(st, left) {
    if (!playing || mode !== 'level') return;
    $('overTitle').textContent = `Level ${lvl.n} gehaald!`; $('overTitle').classList.add('new');
    $('finalScore').textContent = fmt(score); $('finalScore').hidden = false;
    $('overText').textContent = left ? `Met ${left} ${MW()[left === 1 ? 0 : 1]} over.` : 'Precies op tijd!';
    $('againBtn').textContent = 'Volgende level';
    $('shareBtn').hidden = false;
    const box = $('overStars'); box.hidden = false;
    [...box.children].forEach((s, k) => { s.classList.remove('on'); if (k < st) later(() => { s.classList.add('on'); sfx('star', k); buzz('medium'); }, 450 + k * 380); });
    lvl.result = { st, left };
    openOver();
  }
  function levelLose(reason) {
    sfx('lose'); buzz('warning');
    const missing = lvl.goals.filter(g => g.k === 'score' ? score < g.n : goalLeft(g) > 0);
    const total = lvl.goals.reduce((a, g) => a + (g.k === 'score' ? g.n / 50 : g.max ? 1 : g.n), 0);
    const rest = missing.reduce((a, g) => a + (g.k === 'score' ? (g.n - score) / 50 : goalLeft(g)), 0);
    const close = rest <= Math.max(2, total * 0.25);
    setTimeout(() => {
      if (!ended || !playing) return;
      coach(null);
      $('overStars').hidden = true;
      $('overTitle').textContent = close ? 'Bijna!' : `Level ${lvl.n}`; $('overTitle').classList.toggle('new', close);
      $('finalScore').hidden = true;
      $('overText').textContent = (reason ? reason + ' ' : '') + (missing.length ? 'Je had nog nodig: ' + missing.map(goalText).join(' en ') + '.' : '');
      $('againBtn').textContent = 'Opnieuw'; $('shareBtn').hidden = true;
      openOver();
    }, 600);
  }

  // first-play tutorial: the game gives steps {text, hint(api, now), done(), wait}
  function coach(text) { const c = $('coach'); if (text) c.textContent = text; c.hidden = !text; }
  let coachTimer = 0;
  function tutStep() {
    if (!tut) return;
    const st = tut.steps[tut.i];
    if (!st) { tut = null; coach(null); store.set('tutDone', true); return; }
    if (tut.shown !== tut.i) { tut.shown = tut.i; tut.t0 = performance.now(); coach(st.text); }
    if (st.done ? st.done() : performance.now() - tut.t0 > (st.wait || 4000)) { tut.i++; }
  }

  function start(withTut) {
    winTimers.forEach(clearTimeout); winTimers = []; clearTimeout(coachTimer);
    score = 0; shownScore = 0; $('score').textContent = '0'; ended = false; fx = []; shakeAmt = 0;
    $('over').hidden = true; api.info(''); coach(null);
    rng = mode === 'daily' ? seeded(hash(today() + cur.id)) : mode === 'level' ? seeded(hash('L' + lvl.n + cur.id)) : Math.random;
    if (lvl) { lvl.result = null; lvl.goals.forEach(g => { g.got = 0; g.shown = 0; }); }
    $('mode').innerHTML = mode === 'daily' ? `<b>Dagpuzzel</b> · ${new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}` : mode === 'level' ? `<b>Level ${lvl.n}</b>` : '<b>Vrij spelen</b>';
    $('movesStat').hidden = mode !== 'level'; $('bestStat').hidden = mode === 'level';
    cur.start(api, mode === 'level' ? lvl : null);
    // the very first free game starts on a friendlier board (same rules)
    if (mode === 'free' && store.get('games', 0) === 0 && cur.friendly) cur.friendly(api);
    $('restartBtn').hidden = mode === 'daily';
    if (mode === 'daily') store.set(bestKey(), store.get(bestKey(), 0));
    tut = withTut && cur.tutorial ? { steps: cur.tutorial(api), i: 0, shown: -1 } : null;
    buildChips(); hud();
    if (mode === 'level') {
      setMoves(lvl.moves);
      // say the assignment at the start of a level
      if (!tut) { coach('Opdracht: ' + lvl.goals.map(g => g.k === 'score' ? `haal ${fmt(g.n)} punten` : cur.goalDesc(g)).join(' en ') + '.'); coachTimer = setTimeout(() => { if (!tut) coach(null); }, 3800); }
    }
  }
  function show(id) {
    // leaving the daily puzzle halfway still uses up today's try
    if (id === 'home' && playing && mode === 'daily' && !ended) store.set(bestKey(), Math.max(store.get(bestKey(), 0), score));
    if (id === 'home') { winTimers.forEach(clearTimeout); winTimers = []; }
    for (const s of ['home', 'play']) $(s).hidden = s !== id;
    playing = id === 'play';
    if (id === 'home') refreshHome(); else requestAnimationFrame(resize);
  }
  function refreshHome() {
    $('homeStars').textContent = fmt(totalStars());
    $('homeBest').textContent = fmt(store.get('best', 0));
    const d = store.get('daily_' + today(), null);
    $('dailyDate').textContent = d == null ? 'nog niet gespeeld' : fmt(d) + ' punten';
    $('dailyDay').textContent = new Date().getDate();
    $('playBtn').textContent = 'Level ' + unlocked();
  }
  // time until the next daily puzzle
  function untilTomorrow() { const n = new Date(), m = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1), t = Math.max(0, m - n); return `${Math.floor(t / 3600000)} u ${Math.floor(t / 60000) % 60} min`; }
  const dateLabel = () => new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' });
  async function share(text, btn) {
    try { if (navigator.share) { await navigator.share({ text }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(text); const t = btn.textContent; btn.textContent = 'Gekopieerd!'; setTimeout(() => btn.textContent = t, 1800); } catch {}
  }
  const link = () => APPURL ? '\n' + APPURL : '';
  const shareDaily = btn => share(`${APPNAME} · dagpuzzel ${dateLabel()}\n${fmt(store.get('daily_' + today(), 0))} punten\nKun jij het beter?${link()}`, btn);
  const shareLevel = btn => { const r = lvl.result || { st: 1 }; share(`${APPNAME} · level ${lvl.n} ${'⭐'.repeat(r.st)}\n${fmt(score)} punten\nKun jij het beter?${link()}`, btn); };
  let dailyTimer = 0;
  function dailyResult(open) {
    clearInterval(dailyTimer); $('dailySheet').hidden = !open; if (!open) return;
    $('dsTitle').textContent = 'Dagpuzzel ' + dateLabel();
    $('dsScore').textContent = fmt(store.get('daily_' + today(), 0));
    const tick = () => $('dsNext').textContent = 'Nieuwe puzzel over ' + untilTomorrow(); tick(); dailyTimer = setInterval(tick, 20000);
  }
  function play(m, n) {
    if (m === 'daily' && store.get('daily_' + today(), null) != null) return dailyResult(true);
    audio(); mode = m;
    if (m === 'level') {
      n = Math.max(1, Math.min(n || unlocked(), unlocked()));
      const cfg = cur.level(n);
      lvl = { n, ...cfg, goals: cfg.goals.map(g => ({ ...g, got: 0 })) };
    } else lvl = null;
    show('play');
    start(m === 'level' && n === 1 && !store.get('tutDone', false));
  }
  // the levels sheet: every unlocked level with its stars, and a few locked ones ahead
  function levels(open) {
    $('levelsSheet').hidden = !open; if (!open) return;
    const grid = $('lvGrid'), all = stars(), top = unlocked(); grid.innerHTML = '';
    $('lvStars').textContent = `${fmt(totalStars())} van ${fmt((top - 1) * 3)} sterren`;
    for (let n = 1; n <= top + 3; n++) {
      const b = document.createElement('button'), s = all[n] || 0;
      b.className = 'lv' + (n > top ? ' locked' : '') + (n === top ? ' next' : ''); b.disabled = n > top;
      b.innerHTML = `<b>${n}</b><i>${n > top ? '' : '★'.repeat(s) + '<em>' + '★'.repeat(3 - s) + '</em>'}</i>`;
      b.onclick = () => { levels(false); play('level', n); };
      grid.appendChild(b);
    }
    setTimeout(() => { const nx = grid.querySelector('.next'); nx && nx.scrollIntoView({ block: 'center' }); }, 30);
  }

  // input: tap, swipe (with start point), raw down/move/up
  let ptr = null;
  const local = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * W / r.height }; };
  stage.addEventListener('pointerdown', e => {
    if (!$('over').hidden || ended || !playing) return;
    audio(); const p = local(e);
    ptr = { id: e.pointerId, sx: p.x, sy: p.y, t: performance.now(), swiped: false };
    try { stage.setPointerCapture(e.pointerId); } catch {}
    cur.down && cur.down(p);
  });
  stage.addEventListener('pointermove', e => {
    if (!playing) return;
    const p = local(e);
    if (!ptr) { cur.hover && cur.hover(p); return; }
    if (e.pointerId !== ptr.id) return;
    cur.move && cur.move(p);
    if (!ptr.swiped && cur.swipe) {
      const dx = p.x - ptr.sx, dy = p.y - ptr.sy;
      if (Math.hypot(dx, dy) > Math.max(22, W * 0.06)) { ptr.swiped = true; cur.swipe(dirOf(dx, dy), { x: ptr.sx, y: ptr.sy }, { dx, dy }); }
    }
  });
  const dirOf = (dx, dy) => Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  function up(e) {
    if (!ptr || e.pointerId !== ptr.id) return;
    const p = local(e), moved = Math.hypot(p.x - ptr.sx, p.y - ptr.sy);
    const wasSwipe = ptr.swiped; ptr = null;
    if (cur.up) cur.up(p, moved);
    if (!wasSwipe && moved < Math.max(14, W * 0.04) && cur.tap) cur.tap(p);
  }
  stage.addEventListener('pointerup', up);
  stage.addEventListener('pointercancel', e => { ptr = null; cur.up && cur.up(local(e), 0, true); });
  document.addEventListener('touchmove', e => { if (!e.target.closest || !e.target.closest('.sheet')) e.preventDefault(); }, { passive: false });
  // every button gives a tiny tick under your finger
  document.addEventListener('pointerdown', e => { const b = e.target.closest && e.target.closest('button'); if (b && !b.disabled) { buzz('select'); sfx('tap'); } }, true);
  const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
  addEventListener('keydown', e => {
    for (const [id, close] of [['levelsSheet', () => levels(false)], ['rulesSheet', () => setRules(false)], ['sheet', () => setSheet(false)], ['dailySheet', () => dailyResult(false)]]) {
      if (!$(id).hidden) { if (e.key === 'Escape') close(); return; }
    }
    if (!playing) return;
    if (e.key === 'Escape') { show('home'); return; }
    if (e.target.tagName === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return;
    if (!$('over').hidden) { if ((e.key === 'Enter' || e.key === ' ') && mode !== 'daily' && !$('againBtn').disabled) { e.preventDefault(); $('againBtn').click(); } return; }
    if (ended) return;
    if (cur.key && cur.key(e.key) === true) { e.preventDefault(); return; }
    if (KEYS[e.key] && cur.swipe) { e.preventDefault(); audio(); cur.swipe(KEYS[e.key], null, null); }
    else if (e.key === ' ' && cur.action) { e.preventDefault(); audio(); cur.action(); }
  });

  // main loop
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(50, now - last); last = now;
    if (cur && cur.drawLogo && !playing) drawLogo(now);
    if (!W || !cur || !playing) return;
    // the score counts up instead of jumping
    if (shownScore !== score) { shownScore += Math.max(1, Math.ceil((score - shownScore) * 0.18)); if (shownScore > score) shownScore = score; $('score').textContent = fmt(shownScore); }
    if (cur.update && !ended) cur.update(dt, now);
    tutStep();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, W);
    if (shakeAmt > 0.3 && !reduce) { ctx.translate((Math.random() - 0.5) * shakeAmt, (Math.random() - 0.5) * shakeAmt); shakeAmt *= 0.84; } else shakeAmt = 0;
    const tray = ctx.createLinearGradient(0, 0, 0, W); tray.addColorStop(0, '#fffdf9'); tray.addColorStop(1, '#f3ece2');
    rr(0, 0, W, W, 26, tray);
    cur.draw(api, now, dt);
    if (tut && tut.steps[tut.i] && tut.steps[tut.i].hint && !ended) tut.steps[tut.i].hint(api, now);
    fx = fx.filter(f => (f.life += dt) < f.max);
    for (const f of fx) {
      const k = f.life / f.max;
      ctx.globalAlpha = 1 - k;
      if (f.k === 'ring') { ctx.strokeStyle = f.c; ctx.lineWidth = f.r * 0.3 * (1 - k); ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.6 + 2 * (1 - Math.pow(1 - k, 3))), 0, Math.PI * 2); ctx.stroke(); }
      else if (f.k === 'dot') { f.x += f.vx * dt / 16; f.y += f.vy * dt / 16; f.vy += 0.03 * W / 400; f.vx *= 0.97; ctx.fillStyle = f.c; ctx.beginPath(); ctx.arc(f.x, f.y, W * 0.009 * (1 - k * 0.6), 0, Math.PI * 2); ctx.fill(); }
      else if (f.k === 'spark') {
        f.x += f.vx * dt / 16; f.y += f.vy * dt / 16; f.vx *= 0.95; f.vy *= 0.95; f.rot += dt / 200;
        const s = W * 0.014 * (1 - k); ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot); ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.moveTo(0, -s); ctx.quadraticCurveTo(0, 0, s, 0); ctx.quadraticCurveTo(0, 0, 0, s); ctx.quadraticCurveTo(0, 0, -s, 0); ctx.quadraticCurveTo(0, 0, 0, -s); ctx.fill(); ctx.restore();
      }
      else if (f.k === 'conf') {
        ctx.globalAlpha = k < 0.8 ? 1 : (1 - k) / 0.2;
        f.x += f.vx * dt / 16; f.y += f.vy * dt / 16; f.vy += 0.012 * W / 400; f.vx *= 0.99; f.rot += f.vr * dt / 16;
        ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot); ctx.scale(1, Math.cos(f.rot * 2)); ctx.fillStyle = f.c; ctx.fillRect(-W * 0.012, -W * 0.007, W * 0.024, W * 0.014); ctx.restore();
      }
      else {
        ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
        if (f.k === 'banner') {
          // the word pops in with a little overshoot, then hangs still
          const q = k / 0.14 - 1, s = k < 0.14 ? 1 + 2.2 * q * q * q + 1.2 * q * q : 1, size = W * (0.085 + f.tier * 0.008);
          ctx.save(); ctx.translate(W / 2, W * 0.44); ctx.rotate(-0.06); ctx.scale(Math.max(0.01, s), Math.max(0.01, s));
          ctx.font = `700 ${Math.round(size)}px Fredoka, "Arial Rounded MT Bold", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
          ctx.lineWidth = size * 0.36; ctx.strokeStyle = shade(BANNER[f.tier], -0.35); ctx.strokeText(f.text, 0, size * 0.06);
          ctx.lineWidth = size * 0.2; ctx.strokeStyle = '#fff'; ctx.strokeText(f.text, 0, 0);
          ctx.fillStyle = BANNER[f.tier]; ctx.fillText(f.text, 0, 0);
          ctx.restore();
        } else {
          const size = W * 0.05 * f.size;
          ctx.font = `700 ${Math.round(size * 1.15)}px Fredoka, "Arial Rounded MT Bold", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
          const y = f.y - W * 0.08 * (1 - Math.pow(1 - k, 3));
          ctx.lineWidth = size * 0.32; ctx.strokeStyle = '#fff'; ctx.strokeText(f.text, f.x, y);
          ctx.fillStyle = '#2b2540'; ctx.fillText(f.text, f.x, y);
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  // the home-screen logo is the app icon, drawn live by the game
  const lg = $('logo'), lctx = lg.getContext('2d');
  function drawLogo(now) {
    const s = lg.clientWidth; if (!s) return;
    const d = Math.min(devicePixelRatio || 1, 3); if (lg.width !== Math.round(s * d)) { lg.width = lg.height = Math.round(s * d); }
    lctx.setTransform(lg.width / 512, 0, 0, lg.width / 512, 0, 0); lctx.clearRect(0, 0, 512, 512);
    cur.drawLogo(lctx, now, api);
  }

  function setSheet(open) { $('sheet').hidden = !open; if (open) $('closeSet').focus({ preventScroll: true }); }
  function setRules(open) { $('rulesSheet').hidden = !open; if (open) $('closeRules').focus({ preventScroll: true }); }
  function syncSwitches() { $('sndSw').setAttribute('aria-checked', String(soundOn)); $('vibSw').setAttribute('aria-checked', String(vibOn)); }

  let APPNAME = '', APPURL = '';
  function boot(app) {
    P = app.key; cur = GAMES[0]; APPNAME = app.name; APPURL = app.url || '';
    soundOn = store.get('sound', true); vibOn = store.get('vib', true); syncSwitches();
    $('appPitch').textContent = app.pitch; $('ctl').textContent = cur.controls;
    $('movesLbl').textContent = MW()[1][0].toUpperCase() + MW()[1].slice(1);
    // each rule is a small card: a short title and one or two lines
    cur.rules.forEach(r => { const li = document.createElement('li'), b = document.createElement('b'), sp = document.createElement('span'); b.textContent = r.t; sp.textContent = r.d; li.append(b, sp); $('rules').appendChild(li); });
    const tapThen = f => e => { f(); e.currentTarget.blur(); };
    $('playBtn').onclick = tapThen(() => play('level'));
    $('freeBtn').onclick = tapThen(() => play('free'));
    $('dailyBtn').onclick = tapThen(() => play('daily'));
    $('starsBtn').onclick = () => levels(true);
    $('closeLevels').onclick = () => levels(false);
    $('levelsSheet').onclick = e => { if (e.target.id === 'levelsSheet') levels(false); };
    $('homeBtn').onclick = tapThen(() => show('home'));
    $('toHomeBtn').onclick = tapThen(() => show('home'));
    $('againBtn').onclick = e => {
      if (mode === 'daily') return shareDaily(e.currentTarget);
      if (mode === 'level' && lvl.result) return play('level', lvl.n + 1);
      start(false); e.currentTarget.blur();
    };
    $('shareBtn').onclick = e => shareLevel(e.currentTarget);
    $('dsShare').onclick = e => shareDaily(e.currentTarget);
    $('dsClose').onclick = () => dailyResult(false);
    $('dailySheet').onclick = e => { if (e.target.id === 'dailySheet') dailyResult(false); };
    $('restartBtn').onclick = tapThen(() => start(false));
    $('setBtn1').onclick = $('setBtn2').onclick = () => setSheet(true);
    $('closeSet').onclick = () => setSheet(false);
    $('sheet').onclick = e => { if (e.target.id === 'sheet') setSheet(false); };
    $('sndSw').onclick = () => { soundOn = !soundOn; store.set('sound', soundOn); syncSwitches(); if (soundOn) sfx('pop', 4); };
    $('vibSw').onclick = () => { vibOn = !vibOn; store.set('vib', vibOn); syncSwitches(); buzz('medium'); };
    $('tutBtn').onclick = () => { setSheet(false); mode = 'level'; const cfg = cur.level(1); lvl = { n: 1, ...cfg, goals: cfg.goals.map(g => ({ ...g, got: 0 })) }; show('play'); start(true); };
    $('helpBtn').onclick = () => setRules(true);
    $('rulesBtn').onclick = () => { setSheet(false); setRules(true); };
    $('closeRules').onclick = () => setRules(false);
    $('rulesSheet').onclick = e => { if (e.target.id === 'rulesSheet') setRules(false); };
    $('rulesPlay').onclick = () => { setRules(false); if (!playing) play('level'); };
    show('home');
    // the very first time you open the app you go straight into level 1 with the tutorial
    if (!store.get('tutDone', false)) play('level', 1);
    requestAnimationFrame(frame);
  }
  return { boot, api };
})();
