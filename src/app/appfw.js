// ---------- App framework: one game, home / play / settings, daily puzzle, first-play tutorial ----------
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
  let W = 0, dpr = 1, cur = null, fx = [], shakeAmt = 0, score = 0, ended = false, playing = false;
  let soundOn = true, vibOn = true, daily = false, tut = null;

  // the board is the largest square that fits the space between the top bar and the buttons
  function resize() {
    const r = well.getBoundingClientRect(), s = Math.max(200, Math.floor(Math.min(r.width, r.height, 460)));
    stage.style.width = s + 'px'; stage.style.height = s + 'px';
    dpr = Math.min(devicePixelRatio || 1, 3); W = s; cv.width = Math.round(W * dpr); cv.height = Math.round(W * dpr);
  }
  new ResizeObserver(resize).observe(well);

  // seeded randomness so everyone gets the same daily puzzle
  let rng = Math.random;
  const seeded = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const hash = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

  // sound
  let ac = null;
  function audio() { if (!soundOn) return null; try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state !== 'running') ac.resume(); } catch { ac = null; } return ac; }
  // iOS only lets sound start from the end of a tap; a silent blip on every tap keeps the audio unlocked
  const unlock = () => { const a = audio(); if (!a) return; try { const b = a.createBuffer(1, 1, 22050), src = a.createBufferSource(); src.buffer = b; src.connect(a.destination); src.start(0); } catch {} };
  for (const ev of ['touchend', 'pointerup', 'click']) addEventListener(ev, unlock, { passive: true, capture: true });
  function tone(freq, dur = 0.14, type = 'triangle', vol = 0.15, when = 0) {
    const a = audio(); if (!a) return;
    const t = a.currentTime + when, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
  const note = k => 392 * Math.pow(2, SCALE[Math.max(0, Math.min(k, SCALE.length - 1))] / 12);
  // in the store app the phone's own haptics are used (they also work on iPhone); in a browser, vibrate where supported
  const buzz = p => {
    if (!vibOn) return;
    const hp = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics;
    try {
      if (hp) { if (Array.isArray(p)) hp.notification({ type: 'WARNING' }); else hp.impact({ style: p >= 20 ? 'MEDIUM' : 'LIGHT' }); return; }
      navigator.vibrate && navigator.vibrate(p);
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

  // effects (pixel coordinates in board space)
  function burst(x, y, color, n = 12, power = 1) {
    fx.push({ k: 'ring', x, y, c: color, life: 0, max: 420, r: W * 0.05 * power });
    const parts = reduce ? 4 : n;
    for (let i = 0; i < parts; i++) {
      const a = Math.random() * Math.PI * 2, s = (0.5 + Math.random() * 1.6) * W * 0.004 * power;
      fx.push({ k: 'dot', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, c: color, life: 0, max: 400 + Math.random() * 300 });
    }
  }
  const float = (text, x, y, size = 1) => fx.push({ k: 'text', text, x, y, size, life: 0, max: 900 });
  const banner = text => fx.push({ k: 'banner', text, life: 0, max: 1200 });
  const shake = a => { shakeAmt = Math.max(shakeAmt, a); };


  const fmt = n => n.toLocaleString('nl-NL');
  const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const bestKey = () => daily ? 'daily_' + today() : 'best';
  function hud() {
    $('score').textContent = fmt(score);
    $('best').textContent = fmt(Math.max(store.get(bestKey(), 0), score));
  }
  const api = {
    get W() { return W; }, ctx, COLORS, shape, rr, grid, shade, block, ball, burst, float, banner, shake, tone, note, buzz, reduce,
    get accent() { return cssVar('--accent'); },
    get score() { return score; },
    add(n, x, y, size) { if (!n) return; score += Math.round(n); hud(); if (x != null) float('+' + Math.round(n), x, y, size); },
    info(t) { $('info').textContent = t || ''; },
    over(reason) {
      if (ended) return; ended = true;
      const prev = store.get(bestKey(), 0), isBest = score > prev;
      if (isBest) store.set(bestKey(), score);
      if (!daily) store.set('games', store.get('games', 0) + 1);
      const close = !daily && !isBest && prev > 0 && score >= prev * 0.8;
      tone(330, 0.25, 'sine', 0.14); tone(220, 0.45, 'sine', 0.14, 0.18); buzz([30, 60, 30]);
      setTimeout(() => {
        if (!ended || !playing) return;
        coach(null);
        $('overTitle').textContent = daily ? 'Dagpuzzel klaar' : isBest && score > 0 ? 'Nieuw record!' : close ? 'Bijna!' : 'Einde';
        $('overTitle').classList.toggle('new', (isBest && score > 0) || close);
        $('finalScore').textContent = fmt(score);
        // how far from the record: the "almost" feeling that makes you try again
        const gap = !daily && !isBest && prev > 0 ? ` Nog ${fmt(prev - score + 1)} punten tot je record.` : '';
        $('overText').textContent = (reason || '') + gap + (daily ? ' Morgen staat er een nieuwe dagpuzzel klaar.' : '');
        $('againBtn').textContent = daily ? 'Deel je score' : 'Nog een keer';
        // the buttons wait a moment so a last tap in the game doesn't press them by accident
        const bs = [$('againBtn'), $('toHomeBtn')]; bs.forEach(b => b.disabled = true);
        setTimeout(() => { bs.forEach(b => b.disabled = false); $('againBtn').focus({ preventScroll: true }); }, 650);
        $('over').hidden = false;
      }, 600);
    },
    get ended() { return ended; },
    get daily() { return daily; },
    rand: () => rng(),
    rnd: n => Math.floor(rng() * n),
  };

  // first-play tutorial: the game gives steps {text, hint(api, now), done(), wait}
  function coach(text) { const c = $('coach'); if (text) c.textContent = text; c.hidden = !text; }
  function tutStep() {
    if (!tut) return;
    const st = tut.steps[tut.i];
    if (!st) { tut = null; coach(null); store.set('tutDone', true); return; }
    if (tut.shown !== tut.i) { tut.shown = tut.i; tut.t0 = performance.now(); coach(st.text); }
    if (st.done ? st.done() : performance.now() - tut.t0 > (st.wait || 4000)) { tut.i++; }
  }

  function start(withTut) {
    score = 0; ended = false; fx = []; shakeAmt = 0;
    $('over').hidden = true; api.info(''); coach(null);
    rng = daily ? seeded(hash(today() + cur.id)) : Math.random;
    $('mode').innerHTML = daily ? `<b>Dagpuzzel</b> · ${new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}` : '';
    cur.start(api);
    // the very first game starts on a friendlier board (same rules)
    if (!daily && store.get('games', 0) === 0 && cur.friendly) cur.friendly(api);
    $('restartBtn').hidden = daily;
    if (daily) store.set(bestKey(), store.get(bestKey(), 0));
    tut = withTut && cur.tutorial ? { steps: cur.tutorial(api), i: 0, shown: -1 } : null;
    hud();
  }
  function show(id) {
    // leaving the daily puzzle halfway still uses up today's try
    if (id === 'home' && playing && daily && !ended) store.set(bestKey(), Math.max(store.get(bestKey(), 0), score));
    for (const s of ['home', 'play']) $(s).hidden = s !== id;
    playing = id === 'play';
    if (id === 'home') refreshHome(); else requestAnimationFrame(resize);
  }
  function refreshHome() {
    $('homeBest').textContent = fmt(store.get('best', 0));
    const d = store.get('daily_' + today(), null);
    $('homeDaily').textContent = d == null ? '–' : fmt(d);
    $('dailyDate').textContent = d == null ? 'nog niet gespeeld' : 'bekijk je score';
    $('dailyDay').textContent = new Date().getDate();
  }
  // time until the next daily puzzle
  function untilTomorrow() { const n = new Date(), m = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1), t = Math.max(0, m - n); return `${Math.floor(t / 3600000)} u ${Math.floor(t / 60000) % 60} min`; }
  const dateLabel = () => new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' });
  async function shareDaily(btn) {
    const sc = store.get('daily_' + today(), 0);
    const text = `${APPNAME} · dagpuzzel ${dateLabel()}\n${fmt(sc)} punten\nKun jij het beter?`;
    try { if (navigator.share) { await navigator.share({ text }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(text); const t = btn.textContent; btn.textContent = 'Gekopieerd!'; setTimeout(() => btn.textContent = t, 1800); } catch {}
  }
  let dailyTimer = 0;
  function dailyResult(open) {
    clearInterval(dailyTimer); $('dailySheet').hidden = !open; if (!open) return;
    $('dsTitle').textContent = 'Dagpuzzel ' + dateLabel();
    $('dsScore').textContent = fmt(store.get('daily_' + today(), 0));
    const tick = () => $('dsNext').textContent = 'Nieuwe puzzel over ' + untilTomorrow(); tick(); dailyTimer = setInterval(tick, 20000);
  }
  function play(isDaily) {
    if (isDaily && store.get('daily_' + today(), null) != null) return dailyResult(true);
    audio(); daily = isDaily; show('play');
    start(!isDaily && !store.get('tutDone', false));
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
  const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
  addEventListener('keydown', e => {
    if (!$('rulesSheet').hidden) { if (e.key === 'Escape') setRules(false); return; }
    if (!$('sheet').hidden) { if (e.key === 'Escape') setSheet(false); return; }
    if (!$('dailySheet').hidden) { if (e.key === 'Escape') dailyResult(false); return; }
    if (!playing) return;
    if (e.key === 'Escape') { show('home'); return; }
    if (e.target.tagName === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return;
    if (!$('over').hidden) { if ((e.key === 'Enter' || e.key === ' ') && !daily && !$('againBtn').disabled) { e.preventDefault(); start(false); } return; }
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
      else {
        ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
        const big = f.k === 'banner', size = big ? W * 0.058 : W * 0.05 * f.size;
        ctx.font = `700 ${Math.round(size * 1.15)}px Fredoka, "Arial Rounded MT Bold", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
        const x = big ? W / 2 : f.x, y = big ? W * 0.1 : f.y - W * 0.08 * (1 - Math.pow(1 - k, 3));
        ctx.lineWidth = size * 0.32; ctx.strokeStyle = '#fff'; ctx.strokeText(f.text, x, y);
        ctx.fillStyle = big ? '#f2a01c' : '#2b2540'; ctx.fillText(f.text, x, y);
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

  let APPNAME = '';
  function boot(app) {
    P = app.key; cur = GAMES[0]; APPNAME = app.name;
    soundOn = store.get('sound', true); vibOn = store.get('vib', true); syncSwitches();
    $('appPitch').textContent = app.pitch; $('ctl').textContent = cur.controls;
    $('dailyDate').textContent = '';
    // each rule is a small card: a short title and one or two lines
    cur.rules.forEach(r => { const li = document.createElement('li'), b = document.createElement('b'), sp = document.createElement('span'); b.textContent = r.t; sp.textContent = r.d; li.append(b, sp); $('rules').appendChild(li); });
    const tapThen = f => e => { f(); e.currentTarget.blur(); };
    $('playBtn').onclick = tapThen(() => play(false));
    $('dailyBtn').onclick = tapThen(() => play(true));
    $('homeBtn').onclick = tapThen(() => show('home'));
    $('toHomeBtn').onclick = tapThen(() => show('home'));
    $('againBtn').onclick = e => { if (daily) shareDaily(e.currentTarget); else { start(false); e.currentTarget.blur(); } };
    $('dsShare').onclick = e => shareDaily(e.currentTarget);
    $('dsClose').onclick = () => dailyResult(false);
    $('dailySheet').onclick = e => { if (e.target.id === 'dailySheet') dailyResult(false); };
    $('restartBtn').onclick = tapThen(() => start(false));
    $('setBtn1').onclick = $('setBtn2').onclick = () => setSheet(true);
    $('closeSet').onclick = () => setSheet(false);
    $('sheet').onclick = e => { if (e.target.id === 'sheet') setSheet(false); };
    $('sndSw').onclick = () => { soundOn = !soundOn; store.set('sound', soundOn); syncSwitches(); if (soundOn) tone(523, 0.1); };
    $('vibSw').onclick = () => { vibOn = !vibOn; store.set('vib', vibOn); syncSwitches(); buzz(20); };
    $('tutBtn').onclick = () => { setSheet(false); daily = false; show('play'); start(true); };
    $('helpBtn').onclick = () => setRules(true);
    $('rulesBtn').onclick = () => { setSheet(false); setRules(true); };
    $('closeRules').onclick = () => setRules(false);
    $('rulesSheet').onclick = e => { if (e.target.id === 'rulesSheet') setRules(false); };
    $('rulesPlay').onclick = () => { setRules(false); if (!playing) play(false); };
    show('home');
    // the very first time you open the app you go straight into the tutorial
    if (!store.get('tutDone', false)) play(false);
    requestAnimationFrame(frame);
  }
  return { boot, api };
})();
