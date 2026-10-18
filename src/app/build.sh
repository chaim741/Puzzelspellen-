mk() { # $1 file, $2 title, $3 accent, $4 accent deep, $5 accent soft, $6 key, $7 pitch, $8 web folder, $9.. sources
  out=$1; t=$2; acc=$3; deep=$4; soft=$5; key=$6; pitch=$7; url=https://puzzellab-test.vercel.app/$8/; shift 8
  { sed "s/__TITLE__/$t/g; s/__ACCENT__/$acc/; s/__ACCENT_DEEP__/$deep/; s/__ACCENT_SOFT__/$soft/" shell.html; cat appfw.js; sed -n 1,47p ../lab/g1.js; cat "$@"; echo "LAB.boot({ key: '$key', name: '$t', pitch: '$pitch', url: '$url' });"; echo '</script>'; } > $out
  { echo '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>'; cat $out; echo '</body></html>'; } > test-$out
}
mk seamshift-app.html SeamShift '#2f7df6' '#1d5cc2' '#dde9fd' seamapp 'Pick a seam, squeeze the board and pop matching tiles.' seamshift seam-app.js
mk balance-app.html 'Balance Stack' '#8b5cf6' '#6438cf' '#ebe4fd' balanceapp 'Drop weights, merge them and keep the seesaw level.' balance ../lab/anim.js balance-app.js

# CrazyGames: the SDK script, the portal hooks, and the game starts once the SDK is ready (or failed)
mkcg() { # $1 file, $2 title, $3 accent, $4 deep, $5 soft, $6 key, $7 pitch, $8.. sources
  out=$1; t=$2; acc=$3; deep=$4; soft=$5; key=$6; pitch=$7; shift 7
  { sed "s/__TITLE__/$t/g; s/__ACCENT__/$acc/; s/__ACCENT_DEEP__/$deep/; s/__ACCENT_SOFT__/$soft/; s#^<script>\$#<script src=\"https://sdk.crazygames.com/crazygames-sdk-v3.js\"></script>\n<script>#" shell.html; cat cg.js appfw.js; sed -n 1,47p ../lab/g1.js; cat "$@"; echo "PLAT.init().then(() => LAB.boot({ key: '$key', name: '$t', pitch: '$pitch' }));"; echo '</script>'; } > $out
}
mkcg seamshift-cg.html SeamShift '#2f7df6' '#1d5cc2' '#dde9fd' seamapp 'Pick a seam, squeeze the board and pop matching tiles.' seam-app.js
