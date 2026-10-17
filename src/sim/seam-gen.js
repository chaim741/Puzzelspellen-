const { run } = require('./seam.js');
const T = (v, n) => ({ k: 'tile', v, n }), SC = n => ({ k: 'score', n }), CH = n => ({ k: 'chain', n });
const HAND = {
  1: [T(null, 12)], 2: [T(0, 10)], 3: [SC(500)], 4: [T(3, 12)], 5: [CH(2)], 6: [T(0, 10), T(2, 10)], 7: [T(null, 40)], 8: [SC(900)],
  9: [T(1, 18)], 10: [CH(3), T(3, 10)], 11: [T(2, 16)], 12: [T(0, 12), T(1, 12)], 13: [SC(1100)], 14: [CH(4)], 15: [T(3, 14), T(2, 14), T(0, 8)],
};
const ev = x => Math.round(x / 2) * 2;
function goals(n) {
  if (HAND[n]) return HAND[n];
  const c = n % 4, d = (n + 2) % 4, e = (n + 1) % 4;
  switch (n % 6) {
    case 0: return [T(c, ev(Math.min(40, 14 + n * 0.4)))];
    case 1: return [T(c, ev(Math.min(28, 10 + n * 0.3))), T(d, ev(Math.min(28, 10 + n * 0.3)))];
    case 2: return [SC(Math.round((400 + n * 16) / 50) * 50)];
    case 3: return [CH(Math.min(7, Math.ceil(2 + n / 10))), T(c, ev(Math.min(24, 8 + n * 0.2)))];
    case 4: return [T(c, ev(Math.min(20, 7 + n * 0.2))), T(d, ev(Math.min(20, 7 + n * 0.2))), T(e, ev(Math.min(20, 7 + n * 0.2)))];
    default: return [T(null, Math.min(90, 40 + n))];
  }
}
function target(n) {
  if (n <= 3) return 0.99;
  if (n <= 10) return n % 5 === 0 ? 0.88 : 0.94;
  let b = Math.max(0.62, 0.9 - (n - 10) * 0.007);
  if (n % 5 === 0) b -= 0.12; else if (n % 5 === 1) b += 0.06;
  return b;
}
const out = [], R = 600;
for (let n = 1; n <= 60; n++) {
  const g = goals(n), ts = [];
  for (let i = 0; i < R; i++) ts.push(run({ goals: g, noBonus: 1 }, 'L' + n + 'seamshift', 0.3).T || 99);
  ts.sort((a, b) => a - b);
  let M = ts[Math.min(R - 1, Math.floor(R * target(n)))] + (n <= 20 ? 2 : 1);
  M = Math.min(M, Math.ceil(ts[R >> 1] * 1.8) + 2);
  const left = ts.filter(t => t <= M).map(t => M - t).sort((a, b) => b - a);
  let s3 = left[Math.floor(left.length * 0.25)], s2 = left[Math.floor(left.length * 0.6)];
  s2 = Math.max(1, s2); s3 = Math.max(s3, s2 + 1);
  out.push({ m: M, s2, s3, g: g.map(x => x.k === 'tile' ? (x.v == null ? ['t', x.n] : ['t', x.n, x.v]) : [x.k[0], x.n]) });
  console.error(n, M, s2, s3, JSON.stringify(g), 'win%', (ts.filter(t => t <= M).length / R).toFixed(2));
}
console.log(JSON.stringify(out.map(o => [o.m, o.s2, o.s3, ...o.g])));
