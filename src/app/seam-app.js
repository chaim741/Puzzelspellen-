// ---------- 2. SeamShift ----------
GAMES.push({
  id: 'seamshift', name: 'SeamShift',
  pitch: 'Kies een naad. Het bord knijpt ernaartoe en gelijke tegels knallen.',
  controls: 'Swipe langs een lijn tussen de vakjes',
  rules: [
    { t: 'Kies een naad', d: 'Swipe langs een lijn tussen twee rijen of kolommen. Die lijn wordt de naad.' },
    { t: 'Het bord knijpt samen', d: 'De tegels aan beide kanten van de naad schuiven tegen elkaar aan.' },
    { t: 'Gelijke tegels knallen', d: 'Komen twee dezelfde tegels tegenover elkaar, dan knallen ze weg en schuiven er nieuwe in.' },
    { t: 'Maak kettingen', d: 'Ontstaan er daarna weer paren aan de naad, dan gaat het door en krijg je extra punten.' },
    { t: 'Haal de opdracht', d: 'Elk level heeft een opdracht, zoals een aantal rode tegels knallen. Lukt het binnen de zetten, dan ga je door. Hoe meer zetten over, hoe meer sterren.' },
    { t: 'Vrij spelen', d: 'Zonder opdracht spelen kan ook. Dan geven meerdere paren tegelijk zetten terug.' },
  ],
  why: 'Je kiest niet alleen een richting, maar ook waar de twee helften botsen.',
  start(api, cfg) {
    this.n = 4; this.nid = 1; this.sp = new Map();
    this.b = H.make(6, 6, (x, y) => this.tile(api.rnd(this.n), x, y));
    this.moves = cfg ? cfg.moves : 18; this.flash = null; this.prev = null; this.phases = []; this.ph = null; this.queued = null;
    this.hud(api);
  },
  tile(v, x, y, fromX = x, fromY = y, a = 1) {
    const t = { id: this.nid++, v };
    this.sp.set(t.id, { v, x: fromX, y: fromY, sc: 1, a });
    return t;
  },
  get movesLeft() { return this.moves; },
  hud(api) { if (api.mode === 'level') { api.info(''); api.setMoves(this.moves); } else api.info(`Nog ${this.moves} zetten`); },
  seamFrom(dir, p) {
    const G = LAB.api.grid(6, 6), f = p ? G.cellF(p.x, p.y) : { c: 3, r: 3 };
    if (dir === 'up' || dir === 'down') return { v: true, k: Math.max(1, Math.min(5, Math.round(f.c))) };
    return { v: false, k: Math.max(1, Math.min(5, Math.round(f.r))) };
  },
  down(p) { this.prev = null; this.sp0 = p; },
  move(p) {
    if (!this.sp0) return; const dx = p.x - this.sp0.x, dy = p.y - this.sp0.y;
    if (Math.hypot(dx, dy) <= 10) return;
    const s = this.seamFrom(Math.abs(dx) > Math.abs(dy) ? 'left' : 'up', this.sp0);
    // a crisp tick when the line under your finger lights up
    if (!this.prev || this.prev.v !== s.v || this.prev.k !== s.k) LAB.api.buzz('select');
    this.prev = s;
  },
  up() { this.prev = null; this.sp0 = null; },

  // queue an animation phase: tweens is a list of [sprite, {x,y,sc,a}] targets
  phase(dur, onStart, ease = 'out') { this.phases.push({ dur, onStart, ease }); },
  swipe(dir, p) {
    const api = LAB.api;
    if (this.ph || this.phases.length) { this.queued = [dir, p]; return; }
    const s = this.seamFrom(dir, p), b = this.b, G = api.grid(6, 6);
    this.flash = { ...s, t: performance.now() };
    // view helpers: line i runs across the seam, j is the position along it
    const xy = (i, j) => s.v ? [j, i] : [i, j];
    const get = (i, j) => { const [x, y] = xy(i, j); return b[y][x]; };
    const set = (i, j, t) => { const [x, y] = xy(i, j); b[y][x] = t; };
    const half = s.v ? [0.5, 0] : [0, 0.5];
    let wave = 0, total = 0, pairs = 0;
    this.moves--; this.hud(api);
    // every wave: tiles at the seam collide, matches pop, both sides close the gap, new tiles slide in from the edge
    while (wave < 8) {
      const hit = [];
      for (let i = 0; i < 6; i++) if (get(i, s.k - 1).v === get(i, s.k).v) hit.push(i);
      if (!wave && !hit.length) {
        // no match: a little bump so you can see the two sides meet
        const pairsAll = [...Array(6).keys()].map(i => [get(i, s.k - 1), get(i, s.k)]);
        this.phase(90, () => pairsAll.map(([l, r]) => { const a = this.sp.get(l.id), c = this.sp.get(r.id); return [[a, { x: a.x + half[0] * 0.3, y: a.y + half[1] * 0.3 }], [c, { x: c.x - half[0] * 0.3, y: c.y - half[1] * 0.3 }]]; }).flat());
        this.phase(160, () => pairsAll.map(([l, r]) => { const a = this.sp.get(l.id), c = this.sp.get(r.id); return [[a, { x: Math.round(a.x), y: Math.round(a.y) }], [c, { x: Math.round(c.x), y: Math.round(c.y) }]]; }).flat(), 'back');
        this.phase(1, () => { api.sfx('bump'); api.buzz('light'); api.shake(3); return []; });
        break;
      }
      if (!hit.length) break;
      const popped = [], moves = [], spawns = [];
      for (const i of hit) {
        const L = get(i, s.k - 1), R = get(i, s.k); popped.push([L, R, i]);
        for (let j = s.k - 1; j > 0; j--) { set(i, j, get(i, j - 1)); moves.push([get(i, j), xy(i, j)]); }
        const [x0, y0] = xy(i, 0), [ox, oy] = xy(i, -1), tl = this.tile(api.rnd(this.n), x0, y0, ox, oy, 0); set(i, 0, tl); spawns.push([tl, x0, y0]);
        for (let j = s.k; j < 5; j++) { set(i, j, get(i, j + 1)); moves.push([get(i, j), xy(i, j)]); }
        const [x5, y5] = xy(i, 5), [ex, ey] = xy(i, 6), tr = this.tile(api.rnd(this.n), x5, y5, ex, ey, 0); set(i, 5, tr); spawns.push([tr, x5, y5]);
      }
      const pts = (10 * hit.length + hit.length * hit.length * 5) * H.combo(wave);
      total += pts; pairs += hit.length;
      const w = wave;
      // 1) the matching pairs slide into each other at the seam
      this.phase(130, () => popped.flatMap(([L, R, i]) => { const [mx, my] = xy(i, s.k - 0.5); return [[this.sp.get(L.id), { x: mx, y: my }], [this.sp.get(R.id), { x: mx, y: my }]]; }), 'in');
      // 2) they pop
      this.phase(170, () => {
        popped.forEach(([L, , i], k) => { const [mx, my] = xy(i, s.k - 0.5); api.burst(G.x(mx), G.y(my), api.COLORS[L.v], 14); });
        const [cx, cy] = xy(popped[0][2], s.k - 0.5);
        api.add(pts, G.x(cx), G.y(cy), 1 + w * 0.15);
        // one soft low note per pair, a little higher with every wave of the chain
        popped.slice(0, 5).forEach((_, j) => api.sfx('pop', w * 2 + j, j * 0.055));
        api.buzz(w >= 2 ? 'heavy' : w || hit.length > 1 ? 'medium' : 'light'); api.shake(2 + w * 2 + hit.length);
        popped.forEach(([L, , i]) => { const [px, py] = xy(i, s.k - 0.5); api.collect('tile', L.v, 2, G.x(px), G.y(py), api.COLORS[L.v]); });
        const tier = (w ? w - 1 : -1) + (hit.length >= 3 ? 1 : 0) + (hit.length >= 4 ? 1 : 0);
        if (tier >= 0) api.banner(WORDS[Math.min(tier, WORDS.length - 1)], tier);
        return popped.flatMap(([L, R]) => [[this.sp.get(L.id), { sc: 1.6, a: 0 }], [this.sp.get(R.id), { sc: 1.6, a: 0 }]]);
      });
      // 3) both sides close the gap and new tiles drop in from the edges
      this.phase(260, () => {
        popped.forEach(([L, R]) => { this.sp.delete(L.id); this.sp.delete(R.id); });
        return [...moves.map(([t, [x, y]]) => [this.sp.get(t.id), { x, y }]), ...spawns.map(([t, x, y]) => [this.sp.get(t.id), { x, y, a: 1 }])];
      }, 'back');
      this.phase(70, () => []);
      wave++;
    }
    // free play: a big move gives moves back. Levels have a fixed number of moves.
    const bonus = api.mode === 'level' || !total ? 0 : Math.min(3, Math.floor(total / 60));
    this.moves += bonus;
    this.phase(1, () => {
      if (wave >= 2) api.collect('chain', null, 1, api.W / 2, api.W / 2, api.accent);
      if (bonus) api.float('+' + bonus + (bonus === 1 ? ' zet' : ' zetten'), api.W / 2, api.W * 0.2, 0.9);
      this.hud(api); api.turnEnd(this.moves); return [];
    });
  },
  step(now) {
    while (true) {
      if (!this.ph) {
        const nx = this.phases.shift();
        if (!nx) { if (this.queued && !LAB.api.ended) { const [d, p] = this.queued; this.queued = null; this.swipe(d, p); continue; } return; }
        const tw = (nx.onStart() || []).filter(([sp]) => sp).map(([sp, to]) => ({ sp, from: { x: sp.x, y: sp.y, sc: sp.sc, a: sp.a }, to }));
        this.ph = { ...nx, tw, t0: now, dur: LAB.api.reduce ? Math.min(nx.dur, 40) : nx.dur };
      }
      const ph = this.ph, t = Math.min(1, (now - ph.t0) / ph.dur);
      const e = ph.ease === 'in' ? t * t : ph.ease === 'back' ? 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2) : 1 - Math.pow(1 - t, 3);
      for (const { sp, from, to } of ph.tw) for (const k in to) sp[k] = from[k] + (to[k] - from[k]) * e;
      if (t < 1) return;
      for (const { sp, to } of ph.tw) Object.assign(sp, to);
      this.ph = null;
    }
  },
  draw(api, now) {
    this.step(now);
    const G = api.grid(6, 6), { ctx } = api, cs = G.cs; G.bg();
    // tiles slide in from outside the board, so they are clipped to it (with room for their shadow)
    ctx.save(); ctx.beginPath(); ctx.roundRect(G.ox, G.oy - cs * 0.06, 6 * cs, 6 * cs + cs * 0.12, cs * 0.2); ctx.clip();
    // draw back to front so lower tiles cover the shadows of the ones above
    const sps = [...this.sp.values()].sort((a, b) => a.y - b.y);
    for (const sp of sps) {
      ctx.globalAlpha = Math.max(0, Math.min(1, sp.a));
      const x = G.x(sp.x), y = G.y(sp.y), w = cs * 0.84 * sp.sc;
      const fy = api.block(x, y, w, api.COLORS[sp.v]);
      api.shape(sp.v, x, fy, cs * 0.16 * sp.sc, 'emboss');
    }
    ctx.restore(); ctx.globalAlpha = 1;
    const seam = this.prev || (this.flash && now - this.flash.t < 450 ? this.flash : null);
    if (seam) {
      ctx.globalAlpha = this.prev ? 0.9 : 1 - (now - seam.t) / 450; ctx.lineCap = 'round';
      ctx.beginPath();
      if (seam.v) { ctx.moveTo(G.ox + seam.k * cs, G.oy + cs * 0.1); ctx.lineTo(G.ox + seam.k * cs, G.oy + 6 * cs - cs * 0.1); }
      else { ctx.moveTo(G.ox + cs * 0.1, G.oy + seam.k * cs); ctx.lineTo(G.ox + 6 * cs - cs * 0.1, G.oy + seam.k * cs); }
      ctx.strokeStyle = api.accent; ctx.lineWidth = cs * 0.13; ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = cs * 0.045; ctx.stroke(); ctx.globalAlpha = 1;
    }
  },
});

const WORDS = ['Mooi!', 'Super!', 'Geweldig!', 'Fantastisch!', 'Ongelooflijk!'];

// ---------- levels: [moves, moves left for 2 stars, for 3 stars, ...goals]; a goal is [kind, amount, colour].
// Move limits come from simulated play (scratchpad sim/seam-gen.js): early levels nearly always work out, later ones get tighter.
const SEAM_LEVELS = [[6,2,4,["t",12]],[15,6,8,["t",10,0]],[10,6,7,["s",500]],[12,4,5,["t",12,3]],[8,5,6,["c",2]],[14,4,6,["t",10,0],["t",10,2]],[11,4,5,["t",40]],[18,5,8,["s",900]],[17,5,7,["t",18,1]],[10,4,5,["c",3],["t",10,3]],[17,5,7,["t",16,2]],[10,3,4,["t",12,0],["t",12,1]],[20,5,7,["s",1100]],[13,5,7,["c",4]],[15,3,5,["t",14,3],["t",14,2],["t",8,0]],[11,4,5,["t",10,0],["t",10,2],["t",10,1]],[13,4,5,["t",57]],[16,4,6,["t",22,2]],[13,4,5,["t",16,3],["t",16,1]],[11,3,4,["s",700]],[14,5,6,["c",5],["t",12,1]],[11,3,4,["t",12,2],["t",12,0],["t",12,3]],[14,3,4,["t",63]],[17,2,4,["t",24,0]],[14,1,3,["t",18,1],["t",18,3]],[13,3,5,["s",800]],[13,3,5,["c",5],["t",14,3]],[12,2,4,["t",12,0],["t",12,2],["t",12,1]],[13,2,3,["t",69]],[18,2,3,["t",26,2]],[13,2,4,["t",20,3],["t",20,1]],[13,2,4,["s",900]],[17,4,6,["c",6],["t",14,1]],[15,2,3,["t",14,2],["t",14,0],["t",14,3]],[12,1,2,["t",75]],[20,3,5,["t",28,0]],[15,2,4,["t",22,1],["t",22,3]],[14,2,4,["s",1000]],[16,3,6,["c",6],["t",16,3]],[15,1,3,["t",16,0],["t",16,2],["t",16,1]],[15,2,4,["t",81]],[22,2,4,["t",30,2]],[15,2,3,["t",22,3],["t",22,1]],[17,2,4,["s",1100]],[15,2,4,["c",7],["t",18,1]],[13,2,3,["t",16,2],["t",16,0],["t",16,3]],[15,2,3,["t",87]],[23,2,4,["t",34,0]],[16,2,3,["t",24,1],["t",24,3]],[15,1,3,["s",1200]],[16,2,4,["c",7],["t",18,3]],[11,2,3,["t",18,0],["t",18,2],["t",18,1]],[16,1,3,["t",90]],[27,2,4,["t",36,2]],[17,2,3,["t",26,3],["t",26,1]],[19,2,5,["s",1300]],[18,3,5,["c",7],["t",20,1]],[15,1,3,["t",18,2],["t",18,0],["t",18,3]],[15,1,2,["t",90]],[21,1,3,["t",38,0]]];
const COLOR_NAMES = ['rode', 'oranje', 'groene', 'blauwe'];
Object.assign(GAMES[GAMES.length - 1], {
  level(n) {
    const r = SEAM_LEVELS[n <= SEAM_LEVELS.length ? n - 1 : 20 + (n - 61) % 40];
    const kinds = { t: 'tile', s: 'score', c: 'chain' };
    return { moves: r[0], s2: r[1], s3: r[2], goals: r.slice(3).map(([k, amt, v]) => ({ k: kinds[k], n: amt, v: v == null ? null : v })) };
  },
  goalDesc(g) {
    if (g.k === 'chain') return `maak ${g.n} ${g.n === 1 ? 'ketting' : 'kettingen'}`;
    return `knal ${g.n} ${g.v == null ? '' : COLOR_NAMES[g.v] + ' '}tegels`;
  },
  goalText(g, left) {
    if (g.k === 'chain') return `${left} ${left === 1 ? 'ketting' : 'kettingen'}`;
    return `${left} ${g.v == null ? '' : COLOR_NAMES[g.v] + ' '}${left === 1 ? 'tegel' : 'tegels'}`;
  },
  // the small picture on a goal chip, drawn in a 100 x 100 box
  goalIcon(c, g, api) {
    if (g.k === 'chain') {
      c.lineWidth = 11; c.strokeStyle = api.accent;
      c.beginPath(); c.roundRect(10, 32, 46, 36, 18); c.stroke(); c.beginPath(); c.roundRect(44, 32, 46, 36, 18); c.stroke();
      return;
    }
    if (g.v == null) { [[30, 32, 0], [70, 32, 3], [30, 72, 2], [70, 72, 1]].forEach(([x, y, v]) => api.block(x, y, 36, api.COLORS[v], 9, c)); return; }
    const fy = api.block(50, 50, 82, api.COLORS[g.v], 20, c); api.shape(g.v, 50, fy, 16, 'emboss', null, c);
  },
});

// ---------- app extras: first-play tutorial and the logo ----------
Object.assign(GAMES[GAMES.length - 1], {
  // first game: of a handful of random boards, keep the one with the most ready pairs at its seams
  friendly(api) {
    const pairs = () => { let n = 0; for (let k = 1; k < 6; k++) for (let i = 0; i < 6; i++) { if (this.b[i][k - 1].v === this.b[i][k].v) n++; if (this.b[k - 1][i].v === this.b[k][i].v) n++; } return n; };
    let best = this.b, bestSp = this.sp, bn = pairs();
    for (let t = 0; t < 40; t++) { this.start(api); const n = pairs(); if (n > bn) { bn = n; best = this.b; bestSp = this.sp; } }
    this.b = best; this.sp = bestSp; this.hud(api);
  },
  tutorial(api) {
    // make sure a swipe along the middle line gives two pairs
    const paint = (x, y, v) => { const t = this.b[y][x]; t.v = v; this.sp.get(t.id).v = v; };
    const a = this.b[1][2].v, c = (a + 1) % this.n;
    paint(3, 1, a); paint(2, 4, c); paint(3, 4, c);
    for (const y of [0, 2, 3, 5]) if (this.b[y][2].v === this.b[y][3].v) paint(3, y, (this.b[y][2].v + 2) % this.n);
    const hint = (api, now) => {
      const G = api.grid(6, 6), cs = G.cs, { ctx } = api, k = (now % 1400) / 1400, x = G.ox + 3 * cs;
      ctx.globalAlpha = 0.55 + 0.45 * Math.sin(now / 180); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, G.oy + cs * 0.2); ctx.lineTo(x, G.oy + 6 * cs - cs * 0.2);
      ctx.strokeStyle = api.accent; ctx.lineWidth = cs * 0.13; ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = cs * 0.045; ctx.stroke(); ctx.lineCap = 'butt';
      ctx.globalAlpha = 1;
      for (const y of [1, 4]) api.rr(G.ox + 2 * cs + 2, G.oy + y * cs + 1, 2 * cs - 4, cs - 2, cs * 0.24, null, '#f2a01c', 4);
      const fy = G.oy + cs * (1 + 4 * EASEIO(Math.min(1, k * 1.4)));
      ctx.globalAlpha = k > 0.85 ? (1 - k) / 0.15 : 1;
      ctx.beginPath(); ctx.arc(x, fy, cs * 0.28, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.shadowColor = 'rgba(40,30,60,.3)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4; ctx.fill();
      ctx.shadowColor = 'transparent'; ctx.lineWidth = 4; ctx.strokeStyle = api.accent; ctx.stroke();
      ctx.globalAlpha = 1;
    };
    return [
      { text: 'Swipe omlaag langs de lichtende lijn.', hint, done: () => api.score > 0 },
      { text: 'Gelijke tegels botsen en knallen weg.', wait: 4500 },
      { text: 'Kies nu zelf een naad. Succes!', wait: 4000 },
    ];
  },
  drawLogo(c, now, api) {
    const g = c.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, '#fffdf8'); g.addColorStop(1, '#efe6d8');
    c.fillStyle = g; c.fillRect(0, 0, 512, 512);
    // a 4x4 board split by a glowing seam; the two halves breathe toward each other
    const cols = api.COLORS, cs = 96, gap = 20 + 12 * (0.5 + 0.5 * Math.sin(now / 700));
    const grid = [[0, 2, 1, 3], [3, 1, 1, 0], [2, 0, 3, 2], [1, 3, 0, 1]];
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const side = x < 2 ? -1 : 1, px = 256 + (x - 1.5) * cs + side * gap / 2, py = 262 + (y - 1.5) * cs, v = grid[y][x];
      const fy = api.block(px, py, cs * 0.84, cols[v], cs * 0.22, c);
      api.shape(v, px, fy, cs * 0.16, 'emboss', null, c);
    }
    c.lineCap = 'round'; c.beginPath(); c.moveTo(256, 70); c.lineTo(256, 450);
    c.strokeStyle = '#2f7df6'; c.lineWidth = 16; c.stroke(); c.strokeStyle = '#fff'; c.lineWidth = 6; c.stroke(); c.lineCap = 'butt';
  },

});
const EASEIO = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
