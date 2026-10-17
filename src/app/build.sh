mk() { # $1 file, $2 title, $3 accent, $4 key, $5 pitch, $6.. sources
  out=$1; t=$2; acc=$3; key=$4; pitch=$5; shift 5
  { sed "s/__TITLE__/$t/g; s/__ACCENT__/$acc/" shell.html; cat appfw.js; sed -n 1,47p ../lab/g1.js; cat "$@"; echo "LAB.boot({ key: '$key', name: '$t', pitch: '$pitch' });"; echo '</script>'; } > $out
  { echo '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>'; cat $out; echo '</body></html>'; } > test-$out
}
mk seamshift-app.html SeamShift '#48b8ff' seamapp 'Kies een naad, laat het bord samenknijpen en laat gelijke tegels knallen.' seam-app.js
mk balance-app.html 'Balance Stack' '#c58cff' balanceapp 'Laat gewichten vallen, smelt ze samen en houd de wip in balans.' ../lab/anim.js balance-app.js
