// ---------- CrazyGames build: SDK v3 hooks for the app framework. Every call is guarded, so the game still runs when the SDK is blocked or missing. ----------
window.PLAT = (() => {
  let sdk = null, live = false, lastAd = performance.now();
  const ok = () => !!sdk;
  const call = f => { try { if (ok()) f(sdk); } catch {} };
  return {
    noShare: true, // no share links or links to other sites on a portal
    async init() {
      try {
        sdk = window.CrazyGames && window.CrazyGames.SDK;
        if (sdk) await Promise.race([sdk.init(), new Promise((_, no) => setTimeout(no, 6000))]);
        if (!sdk || sdk.environment === 'disabled') sdk = null;
      } catch { sdk = null; }
    },
    // progress is saved through the portal, so it follows a logged-in player to other devices
    get storage() { try { return ok() && sdk.data ? sdk.data : null; } catch { return null; } },
    gameplay(on) { if (on === live) return; live = on; call(s => on ? s.game.gameplayStart() : s.game.gameplayStop()); },
    happy() { call(s => s.game.happytime()); },
    // a midgame ad at most every 3 minutes; if nothing starts quickly the game just goes on
    ad(go, mute) {
      if (!ok() || performance.now() - lastAd < 180000) return go();
      let done = false, started = false;
      const end = () => { if (done) return; done = true; if (started) mute(false); go(); };
      setTimeout(() => { if (!started) end(); }, 4000);
      try {
        sdk.ad.requestAd('midgame', {
          adStarted: () => { started = true; lastAd = performance.now(); mute(true); },
          adFinished: end,
          adError: end,
        });
      } catch { end(); }
    },
  };
})();
