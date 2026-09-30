/**
 * Il widget "Quanto resta": il semicerchio della Home in taglia piccola.
 *
 * Legge i numeri che l'app scrive nell'App Group (vedi lib/widget.ts), non
 * Supabase. I colori sono quelli di lib/theme.ts, chiaro e scuro: il widget
 * segue il tema del sistema da solo, tramite l'asset catalog.
 */
/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: "widget",
  name: "widget",
  displayName: "Clinck",
  deploymentTarget: "17.0",
  frameworks: ["SwiftUI", "WidgetKit"],
  entitlements: {
    "com.apple.security.application-groups": ["group.com.andreadecaro.clinck"],
  },
  colors: {
    $widgetBackground: { light: "#faf9f5", dark: "#1f1e1c" },
    $accent: { light: "#c2613f", dark: "#d97757" },
    ink: { light: "#141413", dark: "#f5f4ef" },
    ink2: { light: "#5f5e5a", dark: "#b0aea6" },
    track: { light: "#e3e1d9", dark: "#2e2d29" },
    over: { light: "#b4472c", dark: "#e0765a" },
  },
};
