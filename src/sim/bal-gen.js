const { run } = require('./bal.js');
const MK = n => ({ k: 'make', n }), MG = n => ({ k: 'merge', n }), PF = n => ({ k: 'perfect', n }), SC = n => ({ k: 'score', n });
const HAND = {
  1: [MK(3)], 2: [MG(4)], 3: [MK(4)], 4: [PF(2)], 5: [SC(300)], 6: [MG(8), PF(1)], 7: [MK(4), MG(6)], 8: [SC(600)],
  9: [PF(4)], 10: [MK(5)], 11: [MG(10)], 12: [MK(4), PF(3)], 13: [SC(900)], 14: [MG(12), PF(3)], 15: [MK(5), MG(14)],
};
function goals(n) {
  if (HAND[n]) return HAND[n];
  switch (n % 6) {
    case 0: return [MG(Math.min(24, 8 + Math.floor(n / 3)))];
    case 1: return [SC(Math.round((500 + n * 25) / 50) * 50)];
    case 2: return [PF(Math.min(10, 3 + Math.floor(n / 8))), MG(Math.min(16, 6 + Math.floor(n / 5)))];
    case 3: return [MK(4), PF(Math.min(8, 2 + Math.floor(n / 10)))];
    case 4: return n % 12 === 4 ? [MK(5)] : [MK(4), MG(Math.min(18, 8 + Math.floor(n / 5)))];
    default: return [MG(Math.min(20, 8 + Math.floor(n / 4))), SC(Math.round((300 + n * 15) / 50) * 50)];
  }
}
function target(n) {
  if (n <= 3) return 0.99;
  if (n <= 10) return n % 5 === 0 ? 0.88 : 0.94;
  let b = Math.max(0.62, 0.9 - (n - 10) * 0.007);
  if (n % 5 === 0) b -= 0.12; else if (n % 5 === 1) b += 0.06;
  return b;
}
const out = [], R = 500;
for (let n = 1; n <= 60; n++) {
  const g = goals(n), ts = [];
  for (let i = 0; i < R; i++) ts.push(run({ goals: g }, 'L' + n + 'balancestack', 0.25).T);
  ts.sort((a, b) => a - b);
  let M = Math.min(80, ts[Math.min(R - 1, Math.floor(R * target(n)))] + (n <= 20 ? 2 : 1));
  M = Math.min(M, Math.ceil(ts[R >> 1] * 1.8) + 2);
  const left = ts.filter(t => t <= M).map(t => M - t).sort((a, b) => b - a);
  let s3 = left[Math.floor(left.length * 0.25)], s2 = left[Math.floor(left.length * 0.6)];
  s2 = Math.max(1, s2); s3 = Math.max(s3, s2 + 1);
  out.push([M, s2, s3, ...g.map(x => [x.k[0] + (x.k === 'merge' ? 'g' : ''), x.n])]);
  console.error(n, M, s2, s3, JSON.stringify(g), 'win%', (ts.filter(t => t <= M).length / R).toFixed(2));
}
console.log(JSON.stringify(out));
