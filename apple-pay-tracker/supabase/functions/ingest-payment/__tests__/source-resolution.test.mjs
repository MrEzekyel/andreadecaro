/**
 * Risoluzione di `source`: stessa logica di resolveSource() nella function.
 *
 * Il Comando Rapido manda la voce scelta da uno "Scegli da elenco", quindi
 * arriva l'etichetta leggibile e non il valore tecnico. Qui si verifica che
 * le due strade portino allo stesso posto, e che una voce sconosciuta non
 * faccia perdere la spesa.
 */

const ALLOWED_SOURCES = new Set([
  "shortcut",
  "shortcut_manual",
  "siri",
  "manual",
  "recurring",
]);

const SOURCE_ALIASES = {
  "apple pay": "shortcut",
  "apple pay automatico": "shortcut",
  wallet: "shortcut",
  "apple pay manuale": "shortcut_manual",
  "apple pay manual": "shortcut_manual",
  "apple pay a mano": "shortcut_manual",
  online: "shortcut_manual",
  "in app": "shortcut_manual",
  "inserito manualmente": "manual",
  "inserita a mano": "manual",
  "a mano": "manual",
  manuale: "manual",
  "dettata a siri": "siri",
};

function normalize(value) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function resolveSource(value) {
  if (typeof value !== "string") return "shortcut";
  const cleaned = normalize(value);
  if (!cleaned) return "shortcut";
  if (ALLOWED_SOURCES.has(cleaned)) return cleaned;
  return SOURCE_ALIASES[cleaned] ?? "shortcut";
}

const cases = [
  // Valori tecnici, come li manda l'automazione gia' configurata.
  ["shortcut", "shortcut"],
  ["shortcut_manual", "shortcut_manual"],
  ["manual", "manual"],
  ["siri", "siri"],

  // Etichette leggibili dallo "Scegli da elenco".
  ["Apple Pay", "shortcut"],
  ["Apple Pay manuale", "shortcut_manual"],
  ["Apple Pay Manual", "shortcut_manual"],
  ["Inserito manualmente", "manual"],
  ["Siri", "siri"],

  // Sciatterie di battitura dentro la Shortcut.
  ["  apple pay   manuale ", "shortcut_manual"],
  ["INSERITO MANUALMENTE", "manual"],

  // Casi limite: mai un errore, sempre un valore utile.
  ["", "shortcut"],
  [undefined, "shortcut"],
  [null, "shortcut"],
  [42, "shortcut"],
  ["provenienza inventata", "shortcut"],
];

let bad = 0;
for (const [input, expected] of cases) {
  const got = resolveSource(input);
  const ok = got === expected;
  if (!ok) bad++;
  console.log(
    `${ok ? "OK  " : "FAIL"}  ${String(JSON.stringify(input)).padEnd(26)} atteso=${expected.padEnd(16)} ottenuto=${got}`
  );
}
console.log(bad === 0 ? "\n✅ tutti i casi passano" : `\n❌ ${bad} casi falliti`);
