// ---------- shared animation engine: sprites + a queue of timed phases ----------
const EASE = {
  out: t => 1 - Math.pow(1 - t, 3),
  in: t => t * t,
  lin: t => t,
  back: t => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2),
  bounce: t => { const n = 7.5625, d = 2.75; return t < 1 / d ? n * t * t : t < 2 / d ? n * (t - 1.5 / d) ** 2 + 0.75 : t < 2.5 / d ? n * (t - 2.25 / d) ** 2 + 0.9375 : n * (t - 2.625 / d) ** 2 + 0.984375; },
};
const Anim = {
  // call in a game's start(): gives it sprites (o.sp), a phase queue and an input queue
  setup(o) { o.nid = 1; o.sp = new Map(); o.phases = []; o.ph = null; o.queued = null; },
  // a logic tile {id, v} with a sprite {x, y, sc, a, ...}
  tile(o, v, x, y, extra) { const t = { id: o.nid++, v }; o.sp.set(t.id, { v, x, y, sc: 1, a: 1, ...extra }); return t; },
  s(o, t) { return t && o.sp.get(t.id); },
  // fn runs when the phase starts and returns tweens: [[sprite, {prop: target}], ...]
  phase(o, dur, fn, ease = 'out') { o.phases.push({ dur, fn, ease }); },
  busy(o) { return !!(o.ph || o.phases.length); },
  // run fn now, or after the current animation if one is playing
  input(o, fn) { if (Anim.busy(o)) { o.queued = fn; return; } fn(); },
  step(o, now) {
    for (let guard = 0; guard < 50; guard++) {
      if (!o.ph) {
        const nx = o.phases.shift();
        if (!nx) { if (o.queued && !LAB.api.ended) { const f = o.queued; o.queued = null; f(); continue; } return; }
        const tw = (nx.fn ? nx.fn() || [] : []).filter(([sp]) => sp).map(([sp, to]) => ({ sp, to, from: Object.fromEntries(Object.keys(to).map(k => [k, sp[k] ?? 0])) }));
        o.ph = { ...nx, tw, t0: now, dur: LAB.api.reduce ? Math.min(nx.dur, 40) : nx.dur };
      }
      const ph = o.ph, t = ph.dur <= 0 ? 1 : Math.min(1, (now - ph.t0) / ph.dur), e = EASE[ph.ease](t);
      for (const { sp, from, to } of ph.tw) for (const k in to) sp[k] = from[k] + (to[k] - from[k]) * e;
      if (t < 1) return;
      for (const { sp, to } of ph.tw) Object.assign(sp, to);
      o.ph = null;
    }
  },
  // standard "light up then pop" for a list of [tile, px, py, color]
  pop(o, api, items, onPop) {
    Anim.phase(o, 120, () => items.map(([t]) => [Anim.s(o, t), { sc: 1.25 }]));
    Anim.phase(o, 170, () => {
      items.forEach(([, x, y, c]) => api.burst(x, y, c, 9));
      onPop && onPop();
      return items.map(([t]) => [Anim.s(o, t), { sc: 1.7, a: 0 }]);
    });
    Anim.phase(o, 0, () => { items.forEach(([t]) => o.sp.delete(t.id)); return []; });
  },
};
// drop tiles down in every column of b (tiles or null); newV() makes refills (or pass null for no refill).
// Logic changes now; returns a function for a phase that creates the new sprites above the board and returns the tweens.
Anim.fall = (o, b, newV) => {
  const R = b.length, C = b[0].length, moves = [], spawns = [];
  for (let x = 0; x < C; x++) {
    let y = R - 1;
    for (let yy = R - 1; yy >= 0; yy--) { const t = b[yy][x]; if (!t) continue; b[yy][x] = null; b[y][x] = t; moves.push([t, x, y]); y--; }
    const miss = y + 1;
    if (newV) for (; y >= 0; y--) { const t = { id: o.nid++, v: newV() }; b[y][x] = t; spawns.push([t, x, y, y - miss]); }
  }
  return () => {
    spawns.forEach(([t, x, , y0]) => o.sp.set(t.id, { v: t.v, x, y: y0, sc: 1, a: 1 }));
    return [...moves.map(([t, x, y]) => [o.sp.get(t.id), { x, y }]), ...spawns.map(([t, , y]) => [o.sp.get(t.id), { y }])];
  };
};
// clip drawing to a grid area so tiles sliding in from outside stay hidden
Anim.clip = (api, G, cols, rows, fn) => { const { ctx } = api; ctx.save(); ctx.beginPath(); ctx.roundRect(G.ox, G.oy, cols * G.cs, rows * G.cs, G.cs * 0.2); ctx.clip(); fn(); ctx.restore(); ctx.globalAlpha = 1; };
