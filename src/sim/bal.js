// Balance Stack level designer: exact drop/merge/tilt logic with a careful-but-human bot
const seeded = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const hash = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const LIMIT = 16;
const torque = st => st.reduce((a, s, i) => a + (i - 3) * s.reduce((x, v) => x + Math.pow(2, v - 1), 0), 0);
function drop(st, slot, v) {
  const s = st[slot]; s.push(v); let merges = 0;
  while (s.length >= 2 && s[s.length - 1] === s[s.length - 2]) { s.pop(); s[s.length - 1]++; merges++; }
  return { merges, last: s[s.length - 1], h: s.length };
}
function run(level, seedStr, mistake) {
  const rng = seeded(hash(seedStr)), next = () => { const r = rng(); return r < 0.55 ? 1 : r < 0.9 ? 2 : 3; };
  const st = Array.from({ length: 7 }, () => []); let cur = next(), score = 0, t = 0;
  const got = level.goals.map(() => 0);
  const left = i => { const g = level.goals[i]; return g.k === 'score' ? Math.max(0, g.n - score) : g.k === 'make' ? (got[i] >= g.n ? 0 : 1) : Math.max(0, g.n - got[i]); };
  while (t < 120) {
    // evaluate each slot
    let best = 0, bv = -1e9; const vals = [];
    for (let i = 0; i < 7; i++) {
      const c = st.map(s => s.slice()), r = drop(c, i, cur), tq = torque(c);
      let v = -Math.abs(tq) * 0.6 + r.merges * 3 + r.last * 0.5 * (r.merges ? 1 : 0) - (r.h >= 5 ? (r.h - 4) * 4 : 0);
      if (Math.abs(tq) > LIMIT || r.h > 6) v -= 1000;
      if (tq === 0) v += 2;
      v += Math.random() * 1.5; vals.push(v);
      if (v > bv) { bv = v; best = i; }
    }
    if (Math.random() < mistake) { const ok = vals.map((v, i) => [v, i]).filter(([v]) => v > -500); if (ok.length) best = ok[Math.floor(Math.random() * ok.length)][1]; }
    t++;
    const r = drop(st, best, cur), tq = torque(st);
    if (r.merges) score += 10 * Math.pow(2, r.last) * r.merges;
    if (tq === 0 && st.some(q => q.length)) score += 25;
    level.goals.forEach((g, i) => {
      if (g.k === 'make') got[i] = Math.max(got[i], r.last);
      if (g.k === 'merge') got[i] += r.merges;
      if (g.k === 'perfect' && tq === 0) got[i] += 1;
    });
    if (Math.abs(tq) > LIMIT || r.h > 6) return { done: false, T: 999, died: t };
    if (level.goals.every((g, i) => left(i) === 0)) return { done: true, T: t };
    cur = next();
  }
  return { done: false, T: 999 };
}
module.exports = { run };
if (require.main === module) {
  for (const g of [[{ k: 'make', n: 3 }], [{ k: 'make', n: 4 }], [{ k: 'make', n: 5 }], [{ k: 'make', n: 6 }], [{ k: 'merge', n: 5 }], [{ k: 'merge', n: 10 }], [{ k: 'perfect', n: 3 }], [{ k: 'score', n: 300 }], [{ k: 'score', n: 800 }]]) {
    const R = 400, T = []; let died = 0;
    for (let i = 0; i < R; i++) { const r = run({ goals: g }, 'L' + (i % 30) + 'balancestack', 0.25); T.push(r.T); if (r.died) died++; }
    T.sort((a, b) => a - b); console.log(JSON.stringify(g), 'T q50/80/95', T[R * .5 | 0], T[R * .8 | 0], T[R * .95 | 0], 'died', died);
  }
}
