// plays both apps in a phone-sized browser with a simple bot and takes screenshots along the way
const { chromium } = require('playwright');
const D = process.argv[2], O = process.argv[3], only = process.argv[4];
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  for (const g of ['seamshift', 'balance']) {
    if (only && only !== g) continue;
    const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: false });
    const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await p.goto('file://' + D + '/test-' + g + '-app.html'); await sleep(1200);
    const shot = async n => p.screenshot({ path: `${O}/${g}-${n}.png` });
    await shot('01-first');
    const box = await p.locator('#cv').boundingBox();
    // one bot move
    const move = async () => {
      if (g === 'seamshift') {
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
      } else {
        const slot = await p.evaluate(() => {
          const G = GAMES[0]; let best = 3, bv = -1e9;
          for (let i = 0; i < 7; i++) {
            const st = G.st.map(s => s.map(t => t.v)); const s = st[i]; s.push(G.cur); let m = 0;
            while (s.length >= 2 && s[s.length - 1] === s[s.length - 2]) { s.pop(); s[s.length - 1]++; m++; }
            const tq = st.reduce((a, q, j) => a + (j - 3) * q.reduce((x, v) => x + 2 ** (v - 1), 0), 0);
            let v = -Math.abs(tq) + m * 3 - (s.length >= 5 ? 5 : 0) + Math.random(); if (Math.abs(tq) > 16 || s.length > 6) v -= 999;
            if (v > bv) { bv = v; best = i; }
          }
          return best;
        });
        await p.mouse.click(box.x + box.width * (0.08 + (slot + 0.5) * 0.84 / 7), box.y + box.height * 0.3);
      }
    };
    const overOpen = () => p.evaluate(() => !document.getElementById('over').hidden);
    // level 1 (with the tutorial), then keep playing levels
    let shots = 0;
    for (let lv = 0; lv < 4; lv++) {
      for (let i = 0; i < 80 && !(await overOpen()); i++) {
        await move(); await sleep(g === 'seamshift' ? 700 : 450);
        if (i === 2 && shots < 3) { await shot(`10-play-${lv}`); shots++; }
        if (await p.evaluate(() => LAB.api.ended)) { await sleep(400); await shot(`2${lv}-finale`); await sleep(5000); break; }
      }
      await sleep(2200); await shot(`3${lv}-card`);
      const txt = await p.evaluate(() => document.getElementById('overTitle').textContent + ' | ' + document.getElementById('overText').textContent + ' | stars ' + document.querySelectorAll('#overStars svg.on').length);
      console.log(g, 'level', lv + 1, txt);
      await p.click('#againBtn'); await sleep(900);
    }
    await shot('40-next');
    await p.click('#homeBtn'); await sleep(700); await shot('50-home');
    await p.click('#starsBtn'); await sleep(600); await shot('60-levels');
    await p.click('#closeLevels'); await sleep(400);
    await p.click('#freeBtn'); await sleep(900); for (let i = 0; i < 6; i++) { await move(); await sleep(650); } await shot('70-free');
    console.log(g, 'errors:', errs);
    await p.close();
  }
  await b.close();
})();
