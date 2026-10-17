// renders each sound offline and reports loudness, peak and where the energy sits (to check it is low and soft, never clipping)
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const tests = { pop1: "sfx('pop',0)", popChain5: "[0,1,2,3,4].forEach(j=>sfx('pop',6+j,j*0.055))", bump: "sfx('bump')", land: "sfx('land',2)", merge: "sfx('merge',5)", win: "sfx('win')", star: "sfx('star',2)", lose: "sfx('lose')", tick: "sfx('tick',8)", tap: "sfx('tap')" };
  for (const [name, code] of Object.entries(tests)) {
    const p = await b.newPage();
    await p.addInitScript(() => { window.AudioContext = function () { const c = new OfflineAudioContext(1, 44100 * 2, 44100); window.__oac = c; return c; }; });
    await p.goto('file://' + process.argv[2]); await p.waitForTimeout(600);
    const r = await p.evaluate(async code => {
      const sfx = LAB.api.sfx; eval(code);
      const buf = await window.__oac.startRendering(), d = buf.getChannelData(0);
      let peak = 0, sum = 0, zc = 0, end = 0;
      for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); peak = Math.max(peak, a); sum += d[i] * d[i]; if (i && (d[i] > 0) !== (d[i - 1] > 0)) zc++; if (a > 0.003) end = i; }
      return { peak: +peak.toFixed(3), rmsDb: +(10 * Math.log10(sum / d.length + 1e-12)).toFixed(1), approxHz: Math.round(zc / 2 / 2), lengthS: +(end / 44100).toFixed(2), wav: Array.from(d.slice(0, Math.min(d.length, end + 2000))) };
    }, code);
    const { wav, ...info } = r; console.log(name.padEnd(10), JSON.stringify(info));
    // also save a wav so the sound can be listened to
    const n = wav.length, bufW = Buffer.alloc(44 + n * 2);
    bufW.write('RIFF', 0); bufW.writeUInt32LE(36 + n * 2, 4); bufW.write('WAVEfmt ', 8); bufW.writeUInt32LE(16, 16); bufW.writeUInt16LE(1, 20); bufW.writeUInt16LE(1, 22);
    bufW.writeUInt32LE(44100, 24); bufW.writeUInt32LE(88200, 28); bufW.writeUInt16LE(2, 32); bufW.writeUInt16LE(16, 34); bufW.write('data', 36); bufW.writeUInt32LE(n * 2, 40);
    wav.forEach((v, i) => bufW.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v * 32767))), 44 + i * 2));
    fs.mkdirSync(process.argv[3], { recursive: true }); fs.writeFileSync(`${process.argv[3]}/${name}.wav`, bufW);
    await p.close();
  }
  await b.close();
})();
