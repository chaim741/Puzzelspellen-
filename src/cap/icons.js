const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  for (const a of ['seamshift', 'balance']) {
    const p = await b.newPage();
    await p.goto('file://' + process.cwd() + `/${a}/www/index.html`); await p.waitForTimeout(800);
    const out = await p.evaluate(() => {
      const g = GAMES[0], mk = (size, fn) => { const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d'); fn(x, size); return c.toDataURL('image/png'); };
      const full = (x, s) => { x.scale(s / 512, s / 512); g.drawLogo(x, 0, LAB.api); };
      const fg = (x, s) => { x.translate(s / 2, s / 2); x.scale(s / 512 * 0.62, s / 512 * 0.62); x.translate(-256, -256); x.fillRect = () => {}; g.drawLogo(x, 0, LAB.api); };
      const bg = (x, s) => { x.scale(s / 512, s / 512); const f = x.fillRect.bind(x); g.drawLogo(Object.assign(Object.create(x), {}), 0, LAB.api); };
      const bgOnly = (x, s) => { const real = x; x.scale(s / 512, s / 512); const orig = { ...{} }; let first = true; const proxy = new Proxy(real, { get(t, k) { if (!first) return () => {}; const v = t[k]; if (k === 'fillRect') return (...a) => { t.fillRect(...a); first = false; }; return typeof v === 'function' ? v.bind(t) : v; }, set(t, k, v) { if (first) t[k] = v; return true; } }); g.drawLogo(proxy, 0, LAB.api); };
      const splash = (x, s) => { x.fillStyle = '#0b0d1a'; x.fillRect(0, 0, s, s); const k = s * 0.22; x.save(); x.translate(s / 2 - k / 2, s / 2 - k / 2); x.beginPath(); x.roundRect(0, 0, k, k, k * 0.22); x.clip(); x.scale(k / 512, k / 512); g.drawLogo(x, 0, LAB.api); x.restore(); };
      return { icon: mk(1024, full), fg: mk(1024, fg), bg: mk(1024, bgOnly), splash: mk(2732, splash) };
    });
    fs.mkdirSync(`${a}/assets`, { recursive: true });
    const w = (n, d) => fs.writeFileSync(`${a}/assets/${n}.png`, Buffer.from(d.split(',')[1], 'base64'));
    w('icon-only', out.icon); w('icon-foreground', out.fg); w('icon-background', out.bg); w('splash', out.splash); w('splash-dark', out.splash);
  }
  await b.close();
})();
