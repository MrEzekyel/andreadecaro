const ALPHANUM = /[\p{L}\p{N}]/u;
const PREFIX_MIN = 5;

/**
 * La chiave deve iniziare a inizio parola.
 * Le chiavi corte (< 5 caratteri) devono anche FINIRE a fine parola: sono
 * troppo ambigue per il match a prefisso ("ip" prenderebbe "iphone").
 * Quelle lunghe restano libere in coda, cosi' "supermercat" prende sia
 * "supermercato" sia "supermercati".
 */
function matches(haystack, keyword) {
  const k = keyword.trim().toLowerCase();
  if (!k) return false;
  const wholeWord = k.replace(/[^\p{L}\p{N}]/gu, "").length < PREFIX_MIN;

  let from = 0;
  for (;;) {
    const i = haystack.indexOf(k, from);
    if (i === -1) return false;
    const before = i === 0 ? "" : haystack[i - 1];
    const after = haystack[i + k.length] ?? "";
    const okBefore = !before || !ALPHANUM.test(before);
    const okAfter = !wholeWord || !after || !ALPHANUM.test(after);
    if (okBefore && okAfter) return true;
    from = i + 1;
  }
}

function pick(name, rules) {
  const n = name.trim().toLowerCase().replace(/\s+/g, " ");
  return [...rules]
    .sort((a, b) => b.keyword.trim().length - a.keyword.trim().length)
    .find((r) => matches(n, r.keyword))?.category ?? null;
}

const rules = [
  { keyword: "uber", category: "Trasporti" },
  { keyword: "uber eats", category: "Ristorazione" },
  { keyword: "lime", category: "Trasporti" },
  { keyword: "alimentari", category: "Spesa" },
  { keyword: "eni", category: "Trasporti" },
  { keyword: "tezenis", category: "Shopping" },
  { keyword: "sorgenia", category: "Utenze" },
  { keyword: "todis", category: "Spesa" },
  { keyword: "supermercat", category: "Spesa" },
  { keyword: "action", category: "Shopping" },
  { keyword: "pam", category: "Spesa" },
  { keyword: "coop", category: "Spesa" },
  { keyword: "iper", category: "Spesa" },
  { keyword: "ipercoop", category: "Spesa" },
  { keyword: "ip", category: "Trasporti" },
  { keyword: "tim", category: "Utenze" },
  { keyword: "apple.com/bill", category: "Abbonamenti" },
  { keyword: "h&m", category: "Shopping" },
  { keyword: "farmacia", category: "Salute" },
];

const cases = [
  ["Todis-Casci v.romagnoli", "Spesa"],
  ["UBER EATS", "Ristorazione"],
  ["UBER TRIP", "Trasporti"],
  ["ALIMENTARI ROSSI", "Spesa"],
  ["TEZENIS MILANO", "Shopping"],
  ["SORGENIA SPA", "Utenze"],
  ["ENI STAZIONE 42", "Trasporti"],
  ["SUPERMERCATO GALLI", "Spesa"],
  ["SUPERMERCATI PIU", "Spesa"],
  ["TRANSACTION SRL", null],
  ["CLIMEX SRL", null],
  ["PAM PANORAMA", "Spesa"],
  ["SUPER PAM", "Spesa"],
  ["PAMPERS SHOP", null],
  ["COOP CENTRO", "Spesa"],
  ["COOPERATIVA EDILE", null],
  ["IPERCOOP LIVORNO", "Spesa"],
  ["IP GAS ROMA", "Trasporti"],
  ["IPHONE STORE", null],
  ["TIM SPA", "Utenze"],
  ["TIMBERLAND", null],
  ["APPLE.COM/BILL", "Abbonamenti"],
  ["H&M ROMA", "Shopping"],
  ["FARMACIA COMUNALE 3", "Salute"],
  ["Amf S.r.l.", null],
];

let bad = 0;
for (const [name, expected] of cases) {
  const got = pick(name, rules);
  const ok = got === expected;
  if (!ok) bad++;
  console.log(`${ok ? "OK  " : "FAIL"}  ${name.padEnd(24)} atteso=${String(expected).padEnd(13)} ottenuto=${got}`);
}
console.log(bad === 0 ? "\n✅ tutti i casi passano" : `\n❌ ${bad} casi falliti`);
