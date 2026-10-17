// ---------- 15. Balance Stack ----------
GAMES.push({
  id: 'balancestack', name: 'Balance Stack',
  pitch: 'Bouw hoger zonder dat de wip omslaat.',
  controls: 'Tik boven een plek om het gewicht te laten vallen',
  rules: [
    { t: 'Laat een gewicht vallen', d: 'Tik boven een van de zeven plekken op de wip. Het gewicht bovenin valt daar.' },
    { t: 'Afstand telt', d: 'Hoe verder van het midden, hoe harder het gewicht aan de wip trekt.' },
    { t: 'Gelijke gewichten smelten', d: 'Twee gelijke gewichten op elkaar worden één gewicht dat twee keer zo zwaar is.' },
    { t: 'Zoek de balans', d: 'Staat de wip precies recht, dan krijg je bonuspunten.' },
    { t: 'Pas op', d: 'Slaat de wip te ver door, of wordt een stapel te hoog, dan ben je af.' },
    { t: 'Haal de opdracht', d: 'Elk level heeft een opdracht, zoals een gewicht van 8 maken. Je krijgt een vast aantal gewichten. Hoe meer je overhoudt, hoe meer sterren.' },
  ],
  why: 'Leuk om naar te kijken, maar natuurkunde maakt het lastiger om goed af te stellen.',
  start(api, cfg) { Anim.setup(this); this.st = Array.from({ length: 7 }, () => []); this.slot = 3; this.limit = 16; this.shownT = 0; this.ang = 0; this.left = cfg ? cfg.moves : null; this.next(api); this.hud(api); },
  get movesLeft() { return this.left; },
  moveWord: ['gewicht', 'gewichten'],
  next(api) { const r = api.rand(); this.cur = r < 0.55 ? 1 : r < 0.9 ? 2 : 3; this.ct0 = performance.now(); },
  torque() { return this.st.reduce((a, s, i) => a + (i - 3) * s.reduce((x, t) => x + Math.pow(2, t.v - 1), 0), 0); },
  hud(api) { const t = this.torque(); api.info(`Kanteling ${t > 0 ? '→' : t < 0 ? '←' : '•'} ${Math.abs(t)}/${this.limit}`); if (this.left != null) api.setMoves(this.left); },
  // a crisp tick when your finger moves to another spot
  pick(p) { const s = this.slotAt(p); if (s !== this.slot) LAB.api.buzz('select'); this.slot = s; },
  slotAt(p) { return Math.max(0, Math.min(6, Math.floor((p.x / LAB.api.W - 0.08) / 0.84 * 7))); },
  hover(p) { this.slot = this.slotAt(p); }, down(p) { this.pick(p); }, move(p) { this.pick(p); },
  up(p, m, cancel) { if (cancel) return; this.slot = this.slotAt(p); const s = this.slot; Anim.input(this, () => this.drop(s)); },
  key(k) { if (k === 'ArrowLeft') { this.slot = Math.max(0, this.slot - 1); return true; } if (k === 'ArrowRight') { this.slot = Math.min(6, this.slot + 1); return true; } if (k === 'ArrowDown' || k === ' ' || k === 'Enter') { const s = this.slot; Anim.input(this, () => this.drop(s)); return true; } return false; },
  drop(slot) {
    const api = LAB.api, s = this.st[slot];
    if (this.left != null) { this.left--; api.setMoves(this.left); }
    // 1) the weight falls from the top and bounces onto its stack
    const t = Anim.tile(this, this.cur, 0, 0, { i: slot, h: s.length, f: 0, l: this.cur }); s.push(t);
    Anim.phase(this, 260 + (6 - s.length) * 25, () => [[Anim.s(this, t), { f: 1 }]], 'bounce');
    const w0 = this.cur;
    Anim.phase(this, 0, () => { api.sfx('land', w0); api.buzz('light'); });
    // 2) equal weights melt together: the top one sinks into the one below, which grows
    let merges = 0;
    while (s.length >= 2 && s[s.length - 1].v === s[s.length - 2].v) {
      const top = s.pop(), below = s[s.length - 1]; below.v++; merges++;
      const m = merges, nv = below.v, hb = s.length - 1;
      Anim.phase(this, 150, () => [[Anim.s(this, top), { h: hb, sc: 0.6 }]], 'in');
      Anim.phase(this, 140, () => {
        this.sp.delete(top.id); const b = Anim.s(this, below); b.l = nv;
        const [x, y] = this.slotXY(slot, hb); api.burst(x, y, api.COLORS[nv % 6], 14, 1 + m * 0.2); api.sfx('merge', nv + m); api.buzz(m >= 2 ? 'heavy' : 'medium');
        api.collect('merge', null, 1, x, y, api.COLORS[nv % 6]); api.collect('make', null, nv, x, y, api.COLORS[nv % 6]);
        if (m >= 2) api.banner(['Super!', 'Geweldig!', 'Fantastisch!'][Math.min(m - 2, 2)], m - 1);
        return [[b, { sc: 1.4 }]];
      });
      Anim.phase(this, 220, () => [[Anim.s(this, below), { sc: 1 }]], 'bounce');
    }
    const last = s[s.length - 1].v, tq = this.torque(), h = s.length;
    Anim.phase(this, 0, () => {
      // the seesaw only tilts once the weight has landed
      this.shownT = tq;
      const [x, y] = this.slotXY(slot, h - 1);
      if (merges) { api.add(10 * Math.pow(2, last) * merges, x, y); api.buzz(10); }
      if (tq === 0 && this.st.some(q => q.length)) { api.add(25); api.float('Perfect!', api.W / 2, api.W * 0.9, 1.3); api.sfx('star', 1); api.collect('perfect', null, 1, api.W / 2, api.W * 0.72, api.accent); }
      this.hud(api); this.next(api);
      if (Math.abs(tq) > this.limit) { api.shake(14); api.buzz('heavy'); return api.over('De wip sloeg om.'); }
      if (h > 6) return api.over('Een stapel werd te hoog.');
      api.turnEnd(this.left);
    });
  },
  slotXY(i, h) {
    const W = LAB.api.W, a = this.ang || 0, cx = W / 2, cy = W * 0.72, dx = (0.08 + (i + 0.5) * 0.84 / 7) * W - cx, up = W * 0.03 + (h + 0.5) * W * 0.085;
    return [cx + dx * Math.cos(a) + up * Math.sin(a), cy + dx * Math.sin(a) - up * Math.cos(a)];
  },
  draw(api, now, dt) {
    Anim.step(this, now);
    const { ctx, W } = api, target = Math.max(-1.3, Math.min(1.3, this.shownT / this.limit)) * 0.3;
    this.ang = (this.ang || 0) + (target - (this.ang || 0)) * Math.min(1, dt / 160);
    const cx = W / 2, cy = W * 0.72;
    this.base(ctx, cx, cy, W, api.accent);
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(this.ang);
    const hot = Math.abs(target) > 0.22, pw = W * 0.86, ph = W * 0.03, px = -pw / 2, py = -W * 0.012;
    ctx.fillStyle = 'rgba(70,50,30,.14)'; ctx.beginPath(); ctx.roundRect(px + 4, py + ph * 0.9, pw - 8, ph, ph / 2); ctx.fill();
    ctx.fillStyle = hot ? '#c4443a' : '#d9cfc0'; ctx.beginPath(); ctx.roundRect(px, py + ph * 0.35, pw, ph, ph / 2); ctx.fill();
    ctx.fillStyle = hot ? '#ef5b4c' : '#fff'; ctx.beginPath(); ctx.roundRect(px, py, pw, ph, ph / 2); ctx.fill();
    for (let i = 0; i < 7; i++) { ctx.fillStyle = hot ? 'rgba(255,255,255,.7)' : '#cfc5d6'; ctx.beginPath(); ctx.arc((0.08 + (i + 0.5) * 0.84 / 7) * W - cx, py + ph / 2, Math.max(2, W * 0.006), 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    for (const sp of this.sp.values()) {
      const [tx, ty] = this.slotXY(sp.i, sp.h), sx = (0.08 + (sp.i + 0.5) * 0.84 / 7) * W, sy = W * 0.1;
      this.ball(api, sx + (tx - sx) * sp.f, sy + (ty - sy) * sp.f, sp.l, sp.sc);
    }
    if (!api.ended && !Anim.busy(this)) {
      const x = (0.08 + (this.slot + 0.5) * 0.84 / 7) * W;
      ctx.strokeStyle = 'rgba(43,37,64,.18)'; ctx.lineCap = 'round'; ctx.setLineDash([2, 8]); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, W * 0.16); ctx.lineTo(x, W * 0.62); ctx.stroke(); ctx.setLineDash([]);
      this.ball(api, x, W * 0.1, this.cur, EASE.back(Math.max(0, Math.min(1, (now - (this.ct0 || 0)) / 260))));
    }
  },
  ball(api, x, y, l, sc = 1, c = api.ctx, rr) {
    const r = rr || api.W * (0.03 + l * 0.004) * sc;
    if (r <= 0.5) return;
    api.ball(x, y, r, api.COLORS[l % 6], c);
    const n = String(Math.pow(2, l - 1));
    c.font = `700 ${Math.round(r * (n.length > 2 ? 0.72 : 0.92))}px Fredoka, Nunito, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = 'rgba(40,30,60,.28)'; c.fillText(n, x, y + r * 0.1);
    c.fillStyle = '#fff'; c.fillText(n, x, y + r * 0.02);
  },
  // the stand under the seesaw: a two-tone wedge in the accent colour
  base(c, cx, cy, W, acc) {
    const top = cy + W * 0.01, bot = cy + W * 0.12, hw = W * 0.065;
    c.fillStyle = 'rgba(70,50,30,.14)'; c.beginPath(); c.ellipse(cx, bot + W * 0.008, hw * 1.5, W * 0.014, 0, 0, Math.PI * 2); c.fill();
    c.lineJoin = 'round'; c.lineWidth = W * 0.012;
    c.fillStyle = c.strokeStyle = acc; c.beginPath(); c.moveTo(cx, top); c.lineTo(cx - hw, bot); c.lineTo(cx, bot); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = c.strokeStyle = LAB.api.shade(acc, -0.25); c.beginPath(); c.moveTo(cx, top); c.lineTo(cx + hw, bot); c.lineTo(cx, bot); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(cx, top + W * 0.012, W * 0.008, 0, Math.PI * 2); c.fill();
  },
});


// ---------- levels: [weights, weights left for 2 stars, for 3 stars, ...goals]; a goal is [kind, amount].
// The numbers come from simulated play (scratchpad sim/bal-gen.js): early levels nearly always work out, later ones get tighter.
const BAL_LEVELS = [[10,4,6,["m",3]],[18,8,9,["mg",4]],[19,10,14,["m",4]],[10,8,9,["p",2]],[14,3,5,["s",300]],[20,5,6,["mg",8],["p",1]],[19,5,7,["m",4],["mg",6]],[18,5,7,["s",600]],[15,8,11,["p",4]],[52,20,32,["m",5]],[25,6,8,["mg",10]],[20,9,12,["m",4],["p",3]],[23,6,8,["s",900]],[26,4,6,["mg",12],["p",3]],[55,18,22,["m",5],["mg",14]],[54,15,31,["m",5]],[25,3,6,["mg",12],["s",550]],[27,4,6,["mg",14]],[24,5,7,["s",1000]],[23,3,5,["p",5],["mg",10]],[22,5,14,["m",4],["p",4]],[25,4,6,["m",4],["mg",12]],[24,2,3,["mg",13],["s",650]],[27,2,3,["mg",16]],[20,2,5,["s",1150]],[27,5,8,["p",6],["mg",11]],[22,6,8,["m",4],["p",4]],[38,9,20,["m",5]],[27,2,4,["mg",15],["s",750]],[30,1,3,["mg",18]],[26,4,9,["s",1300]],[29,6,9,["p",7],["mg",12]],[18,5,10,["m",4],["p",5]],[25,2,3,["m",4],["mg",14]],[29,2,4,["mg",16],["s",850]],[32,2,4,["mg",20]],[25,2,7,["s",1450]],[28,3,6,["p",7],["mg",13]],[21,4,8,["m",4],["p",5]],[34,13,18,["m",5]],[33,3,5,["mg",18],["s",900]],[36,1,3,["mg",22]],[29,3,4,["s",1600]],[29,4,6,["p",8],["mg",14]],[15,4,6,["m",4],["p",6]],[28,2,4,["m",4],["mg",17]],[31,1,3,["mg",19],["s",1000]],[39,2,4,["mg",24]],[31,3,8,["s",1750]],[30,2,4,["p",9],["mg",16]],[24,5,9,["m",4],["p",7]],[48,2,16,["m",5]],[32,1,3,["mg",20],["s",1100]],[37,1,3,["mg",24]],[27,4,5,["s",1900]],[40,8,12,["p",10],["mg",16]],[20,5,8,["m",4],["p",7]],[29,1,2,["m",4],["mg",18]],[32,2,3,["mg",20],["s",1200]],[36,1,3,["mg",24]]];
Object.assign(GAMES[GAMES.length - 1], {
  level(n) {
    const r = BAL_LEVELS[n <= BAL_LEVELS.length ? n - 1 : 20 + (n - 61) % 40];
    const kinds = { m: 'make', mg: 'merge', p: 'perfect', s: 'score' };
    return { moves: r[0], s2: r[1], s3: r[2], goals: r.slice(3).map(([k, amt]) => ({ k: kinds[k], n: amt, max: k === 'm' })) };
  },
  goalDesc(g) {
    if (g.k === 'make') return `maak een gewicht van ${2 ** (g.n - 1)}`;
    if (g.k === 'merge') return `laat ${g.n} keer gewichten samensmelten`;
    return `breng de wip ${g.n} keer precies in balans`;
  },
  goalText(g, left) {
    if (g.k === 'make') return `een gewicht van ${2 ** (g.n - 1)}`;
    if (g.k === 'merge') return `${left} keer samensmelten`;
    return `${left} keer precies in balans`;
  },
  // the small picture on a goal chip, drawn in a 100 x 100 box
  goalIcon(c, g, api) {
    if (g.k === 'make') return this.ball(api, 50, 48, g.n, 1, c, 40);
    if (g.k === 'merge') { this.ball(api, 32, 52, 2, 1, c, 26); this.ball(api, 68, 52, 2, 1, c, 26); return; }
    this.base(c, 50, 50, 100, api.accent);
    c.fillStyle = '#d9cfc0'; c.beginPath(); c.roundRect(8, 46, 84, 10, 5); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.roundRect(8, 42, 84, 9, 4.5); c.fill();
    c.strokeStyle = '#d9cfc0'; c.lineWidth = 2; c.beginPath(); c.roundRect(8, 42, 84, 9, 4.5); c.stroke();
  },
});

// ---------- app extras: first-play tutorial and the logo ----------
Object.assign(GAMES[GAMES.length - 1], {
  // first game: the first few weights come in an easy order (light ones that pair up well)
  friendly() { this.easy = [1, 1, 2, 1, 1, 2, 2, 1]; },
  tutorial(api) {
    // one weight already in the middle, and the same weight ready to drop on it
    this.st[3] = [Anim.tile(this, 1, 0, 0, { i: 3, h: 0, f: 1, l: 1 })];
    this.cur = 1; this.slot = 3;
    const hint = (api, now) => {
      const { ctx, W } = api, x = (0.08 + 3.5 * 0.84 / 7) * W, b = Math.sin(now / 200) * W * 0.012, y = W * 0.2 + b;
      ctx.globalAlpha = 0.14 + 0.08 * Math.sin(now / 200); api.rr(x - W * 0.06, W * 0.04, W * 0.12, W * 0.62, W * 0.04, api.accent); ctx.globalAlpha = 1;
      ctx.fillStyle = '#f2a01c'; ctx.strokeStyle = '#fff'; ctx.lineWidth = W * 0.008; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(x, y + W * 0.05); ctx.lineTo(x - W * 0.035, y); ctx.lineTo(x + W * 0.035, y); ctx.closePath(); ctx.stroke(); ctx.fill();
    };
    return [
      { text: 'Tik boven het midden.', hint, done: () => this.st.flat().length !== 1 || this.st[3].length !== 1 || this.st[3][0].v !== 1 },
      { text: 'Gelijke gewichten smelten samen.', wait: 4200 },
      { text: 'Ver van het midden trekt harder. Houd de wip in balans!', wait: 4500 },
    ];
  },
  drawLogo(c, now, api) {
    const g = c.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, '#fbf8f3'); g.addColorStop(1, '#efe6d8');
    c.fillStyle = g; c.fillRect(0, 0, 512, 512);
    const a = Math.sin(now / 900) * 0.06;
    this.base(c, 256, 330, 512, '#8b5cf6');
    c.save(); c.translate(256, 340); c.rotate(a);
    c.fillStyle = '#d9cfc0'; c.beginPath(); c.roundRect(-200, -6, 400, 22, 11); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.roundRect(-200, -14, 400, 22, 11); c.fill();
    const b = (x, h, l, r) => this.ball(api, x, -14 - r - h, l, 1, c, r);
    b(-140, 0, 2, 40); b(-140, 80, 1, 34);
    b(30, 0, 3, 46); b(30, 92, 2, 40); b(30, 172, 1, 34);
    b(150, 0, 1, 34);
    c.restore();
  },
});

// the easy order is used up before the normal random weights come back
{
  const g = GAMES[GAMES.length - 1], start0 = g.start, next0 = g.next;
  g.start = function (api, cfg) { this.easy = null; start0.call(this, api, cfg); };
  g.next = function (api) { if (this.easy && this.easy.length) { this.cur = this.easy.shift(); this.ct0 = performance.now(); return; } next0.call(this, api); };
}
