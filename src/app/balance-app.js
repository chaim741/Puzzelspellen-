// ---------- 15. Balance Stack ----------
GAMES.push({
  id: 'balancestack', name: 'Balance Stack',
  pitch: 'Bouw hoger zonder dat de wip omslaat.',
  controls: 'Tik boven een plek om te laten vallen (of ← → en ↓)',
  rules: [
    'Tik boven een van de zeven plekken op de wip. Het getoonde gewicht valt daar.',
    'Hoe verder van het midden, hoe harder het gewicht trekt.',
    'Komen twee gelijke gewichten op elkaar, dan smelten ze samen tot één dubbel zo zwaar.',
    'Precies in balans geeft bonuspunten.',
    'Slaat de wip te ver door, of wordt een stapel te hoog, dan ben je af.',
  ],
  why: 'Leuk om naar te kijken, maar natuurkunde maakt het lastiger om goed af te stellen.',
  start(api) { Anim.setup(this); this.st = Array.from({ length: 7 }, () => []); this.slot = 3; this.limit = 16; this.shownT = 0; this.ang = 0; this.next(api); this.hud(api); },
  next(api) { const r = api.rand(); this.cur = r < 0.55 ? 1 : r < 0.9 ? 2 : 3; this.ct0 = performance.now(); },
  torque() { return this.st.reduce((a, s, i) => a + (i - 3) * s.reduce((x, t) => x + Math.pow(2, t.v - 1), 0), 0); },
  hud(api) { const t = this.torque(); api.info(`Kanteling ${t > 0 ? '→' : t < 0 ? '←' : '•'} ${Math.abs(t)}/${this.limit}`); },
  slotAt(p) { return Math.max(0, Math.min(6, Math.floor((p.x / LAB.api.W - 0.08) / 0.84 * 7))); },
  hover(p) { this.slot = this.slotAt(p); }, down(p) { this.slot = this.slotAt(p); }, move(p) { this.slot = this.slotAt(p); },
  up(p, m, cancel) { if (cancel) return; this.slot = this.slotAt(p); const s = this.slot; Anim.input(this, () => this.drop(s)); },
  key(k) { if (k === 'ArrowLeft') { this.slot = Math.max(0, this.slot - 1); return true; } if (k === 'ArrowRight') { this.slot = Math.min(6, this.slot + 1); return true; } if (k === 'ArrowDown' || k === ' ' || k === 'Enter') { const s = this.slot; Anim.input(this, () => this.drop(s)); return true; } return false; },
  drop(slot) {
    const api = LAB.api, s = this.st[slot];
    // 1) the weight falls from the top and bounces onto its stack
    const t = Anim.tile(this, this.cur, 0, 0, { i: slot, h: s.length, f: 0, l: this.cur }); s.push(t);
    Anim.phase(this, 260 + (6 - s.length) * 25, () => [[Anim.s(this, t), { f: 1 }]], 'bounce');
    Anim.phase(this, 0, () => api.tone(200, 0.06, 'sine', 0.06));
    // 2) equal weights melt together: the top one sinks into the one below, which grows
    let merges = 0;
    while (s.length >= 2 && s[s.length - 1].v === s[s.length - 2].v) {
      const top = s.pop(), below = s[s.length - 1]; below.v++; merges++;
      const m = merges, nv = below.v, hb = s.length - 1;
      Anim.phase(this, 150, () => [[Anim.s(this, top), { h: hb, sc: 0.6 }]], 'in');
      Anim.phase(this, 140, () => {
        this.sp.delete(top.id); const b = Anim.s(this, below); b.l = nv;
        const [x, y] = this.slotXY(slot, hb); api.burst(x, y, api.COLORS[nv % 6], 12); api.tone(api.note(nv + m), 0.16, 'triangle', 0.14);
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
      if (tq === 0 && this.st.some(q => q.length)) { api.add(25, api.W / 2, api.W * 0.62); api.banner('Perfect in balans!'); }
      this.hud(api); this.next(api);
      if (Math.abs(tq) > this.limit) { api.shake(14); return api.over('De wip sloeg om.'); }
      if (h > 6) return api.over('Een stapel werd te hoog.');
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
    ctx.beginPath(); ctx.moveTo(cx, cy + W * 0.01); ctx.lineTo(cx - W * 0.06, cy + W * 0.12); ctx.lineTo(cx + W * 0.06, cy + W * 0.12); ctx.closePath(); ctx.fillStyle = '#2a3060'; ctx.fill();
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(this.ang);
    api.rr(-W * 0.43, -W * 0.012, W * 0.86, W * 0.03, W * 0.015, Math.abs(target) > 0.22 ? '#ff6b57' : '#fff4e0');
    for (let i = 0; i < 7; i++) { ctx.fillStyle = '#9aa0c8'; ctx.beginPath(); ctx.arc((0.08 + (i + 0.5) * 0.84 / 7) * W - cx, W * 0.035, 2.5, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    for (const sp of this.sp.values()) {
      const [tx, ty] = this.slotXY(sp.i, sp.h), sx = (0.08 + (sp.i + 0.5) * 0.84 / 7) * W, sy = W * 0.1;
      this.ball(api, sx + (tx - sx) * sp.f, sy + (ty - sy) * sp.f, sp.l, sp.sc);
    }
    if (!api.ended && !Anim.busy(this)) {
      const x = (0.08 + (this.slot + 0.5) * 0.84 / 7) * W;
      ctx.strokeStyle = '#fff4e033'; ctx.setLineDash([4, 6]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, W * 0.16); ctx.lineTo(x, W * 0.62); ctx.stroke(); ctx.setLineDash([]);
      this.ball(api, x, W * 0.1, this.cur, EASE.back(Math.max(0, Math.min(1, (now - (this.ct0 || 0)) / 260))));
    }
  },
  ball(api, x, y, l, sc = 1) {
    const { ctx, W } = api, r = W * (0.03 + l * 0.004) * sc;
    if (r <= 0.5) return;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = api.COLORS[l % 6]; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff4e0'; ctx.stroke();
    ctx.fillStyle = '#0b0d1a'; ctx.font = `800 ${Math.round(r * 0.9)}px Unbounded, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(Math.pow(2, l - 1), x, y + 1);
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
      ctx.fillStyle = '#ffc93c'; ctx.beginPath(); ctx.moveTo(x, y + W * 0.05); ctx.lineTo(x - W * 0.035, y); ctx.lineTo(x + W * 0.035, y); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 0.12 + 0.08 * Math.sin(now / 200); api.rr(x - W * 0.06, W * 0.04, W * 0.12, W * 0.62, W * 0.04, '#fff4e0'); ctx.globalAlpha = 1;
    };
    return [
      { text: 'Tik boven het midden.', hint, done: () => this.st.flat().length !== 1 || this.st[3].length !== 1 || this.st[3][0].v !== 1 },
      { text: 'Gelijke gewichten smelten samen.', wait: 4200 },
      { text: 'Ver van het midden trekt harder. Houd de wip in balans!', wait: 4500 },
    ];
  },
  drawLogo(c, now) {
    const g = c.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, '#2a2466'); g.addColorStop(1, '#0d1028');
    c.fillStyle = g; c.fillRect(0, 0, 512, 512);
    const cols = ['#ff6b57', '#ffc93c', '#2fe0a0', '#48b8ff', '#c58cff'], a = Math.sin(now / 900) * 0.06;
    c.fillStyle = '#3a4290'; c.beginPath(); c.moveTo(256, 340); c.lineTo(206, 430); c.lineTo(306, 430); c.closePath(); c.fill();
    c.save(); c.translate(256, 340); c.rotate(a);
    c.fillStyle = '#fff4e0'; c.beginPath(); c.roundRect(-200, -12, 400, 24, 12); c.fill();
    const ball = (x, h, l, r) => { const y = -12 - r - h; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = cols[l]; c.fill(); c.lineWidth = 6; c.strokeStyle = '#fff4e0'; c.stroke();
      c.fillStyle = '#0b0d1a'; c.font = `800 ${Math.round(r * 0.9)}px Unbounded, "Arial Black", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(2 ** (l - 1)), x, y + 2); };
    ball(-140, 0, 2, 40); ball(-140, 80, 1, 34);
    ball(30, 0, 3, 46); ball(30, 92, 2, 40); ball(30, 172, 1, 34);
    ball(150, 0, 1, 34);
    c.restore();
  },
});

// the easy order is used up before the normal random weights come back
{
  const g = GAMES[GAMES.length - 1], start0 = g.start, next0 = g.next;
  g.start = function (api) { this.easy = null; start0.call(this, api); };
  g.next = function (api) { if (this.easy && this.easy.length) { this.cur = this.easy.shift(); this.ct0 = performance.now(); return; } next0.call(this, api); };
}
