# Puzzelspellen: SeamShift en Balance Stack

- `seamshift/` en `balance/`: Capacitor-projecten (iOS) met de spelpagina in `www/`.
- `src/`: bronbestanden waarmee de spelpagina's gebouwd worden.
- `.github/workflows/ios-test-build.yml`: bouwt ongetekende `.ipa`-bestanden en zet ze bij **Releases**.

De testversie laadt het spel van https://puzzellab-test.vercel.app, zodat aanpassingen vanzelf binnenkomen.
Haal `server` uit `capacitor.config.json` voor de versie die naar de App Store gaat.
