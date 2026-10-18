// plays the CrazyGames build against the local SDK: logs SDK events, checks sharing is gone, triggers a midgame ad
const { chromium } = require('playwright');
const URL0 = process.argv[2], O = process.argv[3], vw = +(process.argv[4] || 390), vh = +(process.argv[5] || 844);
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1 });
  await p.addInitScript(() => { const n = performance.now.bind(performance); performance.now = () => n() + (window.__skip ? 400000 : 0); });
  const log = []; p.on('pageerror', e => log.push('PAGEERROR ' + e.message)); p.on('console', m => { const t = m.text().replace(/background-color[^;]*;[^%]*?(padding: 0px( 4px)?;|$)/g, '').replace(/%c/g, ''); if (!/DATA/.test(t)) log.push(m.type() + ': ' + t.slice(0, 200) + (m.type() === 'error' ? ' @' + JSON.stringify(m.location()) : '')); });
  p.on('requestfailed', r => log.push('REQFAIL ' + r.url()));
  if (process.argv[6] === 'block') await p.route('**/crazygames-sdk-v3.js', r => r.abort());
  await p.goto(URL0); await sleep(3000);
  await p.screenshot({ path: O + '/cg-1.png' });
  const box = await p.locator('#cv').boundingBox();
  const move = async () => {
    const s = await p.evaluate(() => {
      const G = GAMES[0], B = G.b; let best = null, bv = -1;
      for (let k = 1; k <= 5; k++) for (const v of [true, false]) {
        let n = 0; for (let i = 0; i < 6; i++) { const a = v ? B[i][k - 1] : B[k - 1][i], c = v ? B[i][k] : B[k][i]; if (a.v === c.v) n++; }
        n += Math.random() * 0.5; if (n > bv) { bv = n; best = { v, k }; }
      }
      const gr = LAB.api.grid(6, 6); return { ...best, ox: gr.ox, oy: gr.oy, cs: gr.cs, W: LAB.api.W };
    });
    const sc = box.width / s.W;
    const x0 = s.v ? s.ox + s.k * s.cs : s.ox + 1.5 * s.cs, y0 = s.v ? s.oy + 1.5 * s.cs : s.oy + s.k * s.cs;
    const x1 = s.v ? x0 : x0 + 2 * s.cs, y1 = s.v ? y0 + 2 * s.cs : y0;
    await p.mouse.move(box.x + x0 * sc, box.y + y0 * sc); await p.mouse.down();
    await p.mouse.move(box.x + x1 * sc, box.y + y1 * sc, { steps: 6 }); await p.mouse.up();
  };
  const overOpen = () => p.evaluate(() => !document.getElementById('over').hidden);
  for (let i = 0; i < 80 && !(await overOpen()); i++) { await move(); await sleep(900); }
  await sleep(1500);
  const st = await p.evaluate(() => ({ title: document.getElementById('overTitle').textContent, share: !document.getElementById('shareBtn').hidden, btn: document.getElementById('againBtn').textContent, env: window.CrazyGames && CrazyGames.SDK.environment, storeKeys: Object.keys(localStorage) }));
  log.push('STATE ' + JSON.stringify(st));
  await p.screenshot({ path: O + '/cg-2-over.png' });
  await p.evaluate(() => { window.__skip = 1; });
  await p.click('#againBtn'); await sleep(1500);
  await p.screenshot({ path: O + '/cg-3-ad.png' });
  await sleep(12000);
  await p.screenshot({ path: O + '/cg-4-after.png' });
  log.push('AFTER ' + JSON.stringify(await p.evaluate(() => ({ mode: document.getElementById('mode').textContent, over: !document.getElementById('over').hidden }))));
  console.log(log.join('\n'));
  await b.close();
})();
