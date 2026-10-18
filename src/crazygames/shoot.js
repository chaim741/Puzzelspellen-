const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  for (const [l, w, h] of [['land', 1920, 1080], ['port', 800, 1200], ['sq', 800, 800]]) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await p.goto('file://' + __dirname + '/cover.html?l=' + l); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(400);
    await p.screenshot({ path: `${__dirname}/seamshift-cover-${w}x${h}.png` });
  }
  await b.close();
})();
