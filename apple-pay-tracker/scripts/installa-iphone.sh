#!/bin/bash
# Firma l'app (con il widget) con l'Apple ID gratuito e la installa
# sull'iPhone collegato. Va rilanciato ogni 7 giorni, quando scade la firma.
#
#   apple-pay-tracker/scripts/installa-iphone.sh [percorso/Clinck-unsigned.ipa]
#
# Senza argomento usa l'ultima IPA salvata nella cartella di firma. Una IPA
# nuova (build EAS profilo "unsigned") viene copiata li' e diventa l'ultima.
#
# Stesso schema di MB Companion (app-mobile/scripts/installa-iphone.sh). Serve
# Xcode 26.3 in /Applications/Xcode-26.3.app, con il tuo Apple ID in
# Impostazioni › Accounts. Il progetto di supporto in
# ~/Library/Application Support/Clinck/firma e' l'output di `expo prebuild`
# (ios/ e targets/widget/, nessun Pod installato): serve solo perche' Xcode
# crei i profili gratuiti di app e widget, con l'App Group
# group.com.andreadecaro.clinck da cui il widget legge i numeri.
set -euo pipefail

export DEVELOPER_DIR=/Applications/Xcode-26.3.app/Contents/Developer
HELPER="$HOME/Library/Application Support/Clinck/firma"
PROFILES="$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles"
TEAM=J8S23W7H6M
APP_ID=com.andreadecaro.clinck
WIDGET_ID=$APP_ID.widget
APP_GROUP=group.$APP_ID

if [ $# -ge 1 ]; then cp "$1" "$HELPER/Clinck-unsigned.ipa"; fi
IPA="$HELPER/Clinck-unsigned.ipa"
[ -f "$IPA" ] || { echo "Manca l'IPA: passala come argomento."; exit 1; }

# Profilo piu' recente, ancora valido e con l'App Group per un bundle id
# (stampa il percorso).
profile_for() {
  local best="" best_exp=0 f tmp exp
  tmp=$(mktemp)
  for f in "$PROFILES"/*.mobileprovision; do
    [ -e "$f" ] || continue
    security cms -D -i "$f" > "$tmp" 2>/dev/null || continue
    [ "$(/usr/libexec/PlistBuddy -c 'Print :Entitlements:application-identifier' "$tmp")" = "$TEAM.$1" ] || continue
    /usr/libexec/PlistBuddy -c 'Print :Entitlements:com.apple.security.application-groups' "$tmp" 2>/dev/null | grep -q "$APP_GROUP" || continue
    exp=$(date -j -f "%a %b %d %T %Z %Y" "$(/usr/libexec/PlistBuddy -c 'Print :ExpirationDate' "$tmp")" +%s 2>/dev/null || echo 0)
    if [ "$exp" -gt "$best_exp" ]; then best="$f"; best_exp=$exp; fi
  done
  rm -f "$tmp"
  # Almeno un giorno di validita', altrimenti va rinnovato.
  if [ -n "$best" ] && [ "$best_exp" -gt $(( $(date +%s) + 86400 )) ]; then echo "$best"; fi
}

# FORZA_RINNOVO=1 chiede a Xcode di rinnovare anche se i profili sono ancora
# validi (senza cancellare niente): serve a tenere allineata la scadenza con
# quella di MB Companion, che rinnova lo stesso giorno.
if [ -n "${FORZA_RINNOVO:-}" ] || [ -z "$(profile_for $APP_ID)" ] || [ -z "$(profile_for $WIDGET_ID)" ]; then
  echo "Rinnovo i profili di firma..."
  # -project (non -workspace): il progetto di supporto non ha i Pod apposta,
  # serve solo a far risolvere la firma a Xcode. La compilazione fallisce piu'
  # avanti (Pods mancanti), ma i profili a quel punto sono gia' stati creati.
  xcodebuild -project "$HELPER/ios/Clinck.xcodeproj" -scheme Clinck \
    -destination 'generic/platform=iOS' -allowProvisioningUpdates \
    -allowProvisioningDeviceRegistration \
    CODE_SIGN_STYLE=Automatic DEVELOPMENT_TEAM=$TEAM \
    build >/dev/null 2>&1 || true
fi
APP_PROFILE=$(profile_for $APP_ID)
WIDGET_PROFILE=$(profile_for $WIDGET_ID)
if [ -z "$APP_PROFILE" ] || [ -z "$WIDGET_PROFILE" ]; then
  echo "Profili non rinnovati: apri $HELPER/ios/Clinck.xcodeproj in Xcode 26.3, premi Play una volta e rilancia."
  exit 1
fi

IDENTITY=$(security find-identity -v -p codesigning | awk '/Apple Development/{print $2; exit}')
[ -n "$IDENTITY" ] || { echo "Nessun certificato Apple Development: aggiungi l'Apple ID in Xcode."; exit 1; }

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
cd "$WORK"
unzip -q "$IPA"
APP=Payload/Clinck.app
WIDGET=$APP/PlugIns/widget.appex

entitlements() {
  cat > "$2" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>application-identifier</key><string>$TEAM.$1</string>
<key>com.apple.developer.team-identifier</key><string>$TEAM</string>
<key>get-task-allow</key><true/>
<key>keychain-access-groups</key><array><string>$TEAM.$1</string></array>
<key>com.apple.security.application-groups</key><array><string>$APP_GROUP</string></array>
</dict></plist>
EOF
}
entitlements $APP_ID app.entitlements
cp "$APP_PROFILE" $APP/embedded.mobileprovision

echo "Firmo..."
for f in $APP/Frameworks/*; do codesign --force --sign "$IDENTITY" --timestamp=none "$f" 2>/dev/null; done
# Un'IPA di prima del widget non ha l'estensione: si firma solo l'app.
if [ -d "$WIDGET" ]; then
  entitlements $WIDGET_ID widget.entitlements
  cp "$WIDGET_PROFILE" $WIDGET/embedded.mobileprovision
  codesign --force --sign "$IDENTITY" --timestamp=none --entitlements widget.entitlements $WIDGET
fi
codesign --force --sign "$IDENTITY" --timestamp=none --entitlements app.entitlements $APP
codesign --verify --deep --strict $APP

# Via cavo risulta "connected", via Wi-Fi "available (paired)": vanno bene tutti e due.
DEVICE=$(xcrun devicectl list devices 2>/dev/null | awk '/(connected|available)/ && /iPhone/ {for (i=1;i<=NF;i++) if ($i ~ /^[0-9A-F-]{36}$/) {print $i; exit}}')
[ -n "$DEVICE" ] || { echo "Collega e sblocca l'iPhone, poi rilancia."; exit 1; }
echo "Installo sull'iPhone..."
xcrun devicectl device install app --device "$DEVICE" $APP | grep -E "App installed|ERROR" || true
echo "Fatto. La firma scade il $(security cms -D -i "$APP_PROFILE" | plutil -extract ExpirationDate raw -)."
