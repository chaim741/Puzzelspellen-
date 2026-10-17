// SeamShift level designer: replays the exact game logic with a "decent human" bot and picks move limits per level
const seeded = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const hash = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const combo = w => [1, 1.5, 2, 3, 4, 5][Math.min(w, 5)];
const N = 4;
function seams() { const a = []; for (let k = 1; k <= 5; k++) { a.push({ v: true, k }); a.push({ v: false, k }); } return a; }
const SEAMS = seams();
// one move; returns {pops:[[v,count]], waves, total}
function resolve(b, s, rnd) {
  const xy = (i, j) => s.v ? [j, i] : [i, j];
  const get = (i, j) => { const [x, y] = xy(i, j); return b[y][x]; };
  const set = (i, j, t) => { const [x, y] = xy(i, j); b[y][x] = t; };
  let wave = 0, total = 0; const pops = [];
  while (wave < 8) {
    const hit = [];
    for (let i = 0; i < 6; i++) if (get(i, s.k - 1) === get(i, s.k)) hit.push(i);
    if (!hit.length) break;
    for (const i of hit) {
      pops.push(get(i, s.k - 1));
      for (let j = s.k - 1; j > 0; j--) set(i, j, get(i, j - 1));
      set(i, 0, rnd());
      for (let j = s.k; j < 5; j++) set(i, j, get(i, j + 1));
      set(i, 5, rnd());
    }
    total += (10 * hit.length + hit.length * hit.length * 5) * combo(wave);
    wave++;
  }
  return { pops, waves: wave, total };
}
function immediate(b, s) { const out = []; for (let i = 0; i < 6; i++) { const [x1, y1] = s.v ? [s.k - 1, i] : [i, s.k - 1], [x2, y2] = s.v ? [s.k, i] : [i, s.k]; if (b[y1][x1] === b[y2][x2]) out.push(b[y1][x1]); } return out; }
// play until goals done (cap moves); returns {T, B: bonus by move, need, done}
function run(level, seedStr, mistake) {
  const rng = seeded(hash(seedStr)), rnd = () => Math.floor(rng() * N);
  const b = Array.from({ length: 6 }, () => Array.from({ length: 6 }, () => rnd()));
  const got = level.goals.map(() => 0); let score = 0, t = 0, bonus = 0, need = 1;
  const left = gi => { const g = level.goals[gi]; return g.k === 'score' ? Math.max(0, g.n - score) : Math.max(0, g.n - got[gi]); };
  const done = () => level.goals.every((g, i) => left(i) === 0);
  while (t < 80) {
    // choose a seam
    let best = null, bv = -1; const withPairs = [];
    for (const s of SEAMS) {
      const im = immediate(b, s); if (im.length) withPairs.push(s);
      let v = 0;
      for (const c of im) { let w = 1; level.goals.forEach((g, i) => { if (left(i) && g.k === 'tile' && (g.v == null || g.v === c)) w += g.v == null ? 1 : 3; }); v += w; }
      v += im.length * im.length * 0.3 + Math.random() * 0.5;
      if (v > bv) { bv = v; best = s; }
    }
    if (withPairs.length && Math.random() < mistake) best = withPairs[Math.floor(Math.random() * withPairs.length)];
    if (!withPairs.length) best = SEAMS[Math.floor(Math.random() * 10)];
    t++;
    const r = resolve(b, best, rnd);
    score += r.total;
    for (const c of r.pops) level.goals.forEach((g, i) => { if (g.k === 'tile' && (g.v == null || g.v === c)) got[i] += 2; });
    if (r.waves >= 2) level.goals.forEach((g, i) => { if (g.k === 'chain') got[i] += 1; });
    if (r.total && !level.noBonus) bonus += Math.min(3, Math.floor(r.total / 60));
    if (done()) return { T: t, B: bonus, need, done: true };
    need = Math.max(need, t - bonus + 1);
  }
  return { done: false, need: 999 };
}
module.exports = { run };
if (require.main === module) {
  const lv = { goals: JSON.parse(process.argv[2]) };
  const R = 400, res = []; for (let i = 0; i < R; i++) res.push(run(lv, 'L' + (process.argv[3] || 5) + 'seamshift', 0.3));
  const needs = res.map(r => r.need).sort((a, b) => a - b);
  console.log('need quantiles 50/75/90:', needs[R * .5 | 0], needs[R * .75 | 0], needs[R * .9 | 0]);
}
