// ---------- App framework: one game, home / play / settings, daily puzzle, first-play tutorial ----------
const GAMES = [];
const LAB = (() => {
  const COLORS = ['#ff6b57', '#ffc93c', '#2fe0a0', '#48b8ff', '#c58cff', '#ff8fc7'];
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
  function audio() { if (!soundOn) return null; try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch { ac = null; } return ac; }
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
  function shape(s, x, y, r, mode = 'fill', color) {
    const c = color || COLORS[s % COLORS.length];
    ctx.beginPath();
    const k = s % 6;
    if (k === 0) ctx.arc(x, y, r, 0, Math.PI * 2);
    else if (k === 1) { const h = r * 1.15; ctx.moveTo(x, y - h); ctx.lineTo(x + h * 0.95, y + h * 0.62); ctx.lineTo(x - h * 0.95, y + h * 0.62); ctx.closePath(); }
    else if (k === 2) ctx.roundRect(x - r * 0.88, y - r * 0.88, r * 1.76, r * 1.76, r * 0.3);
    else if (k === 3) { const h = r * 1.2; ctx.moveTo(x, y - h); ctx.lineTo(x + h, y); ctx.lineTo(x, y + h); ctx.lineTo(x - h, y); ctx.closePath(); }
    else if (k === 4) { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.5 : r * 1.15; ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); }
    else { for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r * 1.05, y + Math.sin(a) * r * 1.05); } ctx.closePath(); }
    if (mode === 'fill') {
      ctx.fillStyle = c; ctx.fill(); ctx.lineWidth = Math.max(1.5, r * 0.16); ctx.strokeStyle = '#fff4e0'; ctx.lineJoin = 'round'; ctx.stroke();
    } else { ctx.lineWidth = Math.max(2, r * 0.32); ctx.strokeStyle = c; ctx.lineJoin = 'round'; ctx.stroke(); }
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
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
          rr(ox + c * cs + cs * 0.05, oy + r * cs + cs * 0.05, cs * 0.9, cs * 0.9, cs * 0.16, danger ? '#2a1e3a' : '#1c2142');
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
  const bestKey = () => daily ? 'daily_' + today() : 'best';
  function hud() {
    $('score').textContent = fmt(score);
    $('best').textContent = fmt(Math.max(store.get(bestKey(), 0), score));
  }
  const api = {
    get W() { return W; }, ctx, COLORS, shape, rr, grid, burst, float, banner, shake, tone, note, buzz, reduce,
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
    rr(0, 0, W, W, 22, '#141833');
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
        ctx.font = `800 ${Math.round(size)}px Unbounded, "Arial Black", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const x = big ? W / 2 : f.x, y = big ? W * 0.1 : f.y - W * 0.08 * (1 - Math.pow(1 - k, 3));
        ctx.lineWidth = size * 0.22; ctx.strokeStyle = '#0b0d1a'; ctx.strokeText(f.text, x, y);
        ctx.fillStyle = big ? '#ffc93c' : '#fff4e0'; ctx.fillText(f.text, x, y);
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
  function syncSwitches() { $('sndSw').setAttribute('aria-checked', String(soundOn)); $('vibSw').setAttribute('aria-checked', String(vibOn)); }

  let APPNAME = '';
  function boot(app) {
    P = app.key; cur = GAMES[0]; APPNAME = app.name;
    soundOn = store.get('sound', true); vibOn = store.get('vib', true); syncSwitches();
    $('appPitch').textContent = app.pitch; $('ctl').textContent = cur.controls;
    $('dailyDate').textContent = '';
    cur.rules.forEach(r => { const li = document.createElement('li'); li.textContent = r; $('rules').appendChild(li); });
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
    show('home');
    // the very first time you open the app you go straight into the tutorial
    if (!store.get('tutDone', false)) play(false);
    requestAnimationFrame(frame);
  }
  return { boot, api };
})();
