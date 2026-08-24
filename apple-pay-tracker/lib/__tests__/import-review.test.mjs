/**
 * Le regole di `importReview` contro i casi veri.
 *
 * Ogni descrizione qui sotto e' stata presa dal database dopo l'import di due
 * estratti conto reali (Revolut e Trade Republic, gennaio-maggio 2026). Non
 * sono esempi inventati: sono le righe su cui queste regole devono decidere,
 * ed e' il motivo per cui `importReview` non legge dal database — cosi' si
 * puo' provare qui, senza niente davanti.
 *
 * Si esegue a mano, come gli altri test del progetto:
 *
 *   node lib/__tests__/import-review.test.mjs
 *
 * A differenza di quelli di `ingest-payment`, che girano su Deno e devono
 * ricopiarsi la logica, questo importa il modulo vero: Node 24 legge il
 * TypeScript da solo. Una regola che cambia e un test che non se ne accorge
 * sarebbe peggio di nessun test.
 */

import {
  applicaDecisione,
  containsOwnName,
  conteggia,
  decisioneIniziale,
  looksLikePerson,
  looksLikeTopUp,
  otherNamesBesideOwn,
  readCounterparty,
  rivedi,
} from "../importReview.ts";

const NOME = "Andrea De Caro";
let bad = 0;

function check(gruppo, etichetta, atteso, ottenuto) {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) bad++;
  console.log(
    `${ok ? "OK  " : "FAIL"}  ${gruppo.padEnd(14)} ${String(etichetta).slice(0, 58).padEnd(60)} atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`
  );
}

/* ---------------------------------------------------------------- *
 * Il nome dell'utente, nelle grafie in cui compare davvero
 * ---------------------------------------------------------------- */

// Maiuscole diverse e ordine nome/cognome invertito nello stesso estratto: e'
// il motivo per cui il confronto e' per insieme di parole e non per stringa.
for (const d of [
  "To Andrea De Caro",
  "Pagamento da ANDREA DE CARO",
  "Outgoing transfer for Andrea De Caro (IT80X03669000000000000000)",
  "Outgoing transfer for DE CARO ANDREA (IT33F03015000000000000000)",
  "Incoming transfer from Andrea De Caro (IT80X03669000000000000000)",
]) {
  check("nome proprio", d, true, containsOwnName(d, NOME));
}

for (const d of [
  "Pagamento a favore di LEONARDO BARESE",
  "SUPERMERCATO SGM SRL",
  "Outgoing transfer for Condominio Erzerun",
]) {
  check("nome proprio", d, false, containsOwnName(d, NOME));
}

// Senza nome in anagrafica la difesa non si applica: non si tira a indovinare
// quale conto sia "tuo".
check("nome proprio", "display_name assente", false, containsOwnName("To Andrea De Caro", null));

/* ---------------------------------------------------------------- *
 * Conto cointestato: si chiede, non si decide
 * ---------------------------------------------------------------- */

check(
  "cointestato",
  "ANDREA DE CARO & LEONARDO BARESE",
  true,
  otherNamesBesideOwn("Pagamento a favore di ANDREA DE CARO & LEONARDO BARESE", NOME).length > 0
);
check("cointestato", "solo il tuo nome", false, otherNamesBesideOwn("To Andrea De Caro", NOME).length > 0);

/* ---------------------------------------------------------------- *
 * Ricariche fra conti propri
 * ---------------------------------------------------------------- */

for (const d of [
  "Ricarica di Apple Pay con *3350",
  "Revolut**0519*",
  "REVOLUT**0519*",
  "Balance migration to another region or legal entity",
]) {
  check("ricarica", d, true, looksLikeTopUp(d));
}
check("ricarica", "SUPERMERCATO SGM SRL", false, looksLikeTopUp("SUPERMERCATO SGM SRL"));

/* ---------------------------------------------------------------- *
 * Prefisso, nome e IBAN
 * ---------------------------------------------------------------- */

const sepa = readCounterparty(
  "Sepa Direct Debit transfer to SANTANDER CONSUMER BANK SPA (IT71C0319101000000000000404)"
);
check("controparte", "tipo", "addebito_sepa", sepa.kind);
check("controparte", "nome nudo", "SANTANDER CONSUMER BANK SPA", sepa.name);
check("controparte", "IBAN conservato", "IT71C0319101000000000000404", sepa.iban);

// "da parte di" va provato prima di "da", altrimenti il prefisso corto vince e
// lascia "parte di" dentro al nome.
check("controparte", "prefisso lungo prima del corto", "ROSA PADUANO", readCounterparty("Pagamento da parte di ROSA PADUANO").name);

// Un nome svuotato dalla pulizia e' peggio del rumore.
check("controparte", "solo prefisso", "To", readCounterparty("To").name);

/* ---------------------------------------------------------------- *
 * Persone contro ragioni sociali
 * ---------------------------------------------------------------- */

const persona = (d) => {
  const c = readCounterparty(d);
  return c.kind !== "nessuno" && looksLikePerson(c.name);
};

for (const d of [
  "Pagamento da PUCCIARINI ANNA",
  "Pagamento da FRANCESCA PUCCIARINI",
  "Pagamento da parte di ALINA VOYCHAK",
  "Pagamento da parte di ROSA PADUANO",
  "Pagamento da parte di MATTIA DE BIANCHI",
  "Pagamento da parte di SAMUEL PETRUZZIELLO",
  "Pagamento a favore di MARGHERITA PALAZZOLO",
  // Quattro parole: a tre secche questo sarebbe rimasto fuori.
  "Outgoing transfer for ABDEL RAHMAN EL BELTAGY (BG48INTF40012097656282)",
  "Incoming transfer from BERARDI GIUSEPPE (IT46M0503401753000000080712)",
]) {
  check("persona", d, true, persona(d));
}

for (const d of [
  // Due parole alfabetiche e nessuna forma societaria: senza `COMPANY_WORDS`
  // questo passerebbe per una persona.
  "Outgoing transfer for Condominio Erzerun (IT59H0760103200001075039113)",
  "Outgoing transfer for LINEAR ASSICURAZIONI SPA (IT92J0538733710000035154289)",
  "Outgoing transfer for Wizz Air Hungary Kft (GB31CITI18500813479358)",
  "Sepa Direct Debit transfer to SANTANDER CONSUMER BANK SPA (IT71C0319101000000000000404)",
  "Rimborso da Paypal *ucirecupero",
  // Esercenti da carta che *sono* nomi di persona: quello che li distingue non
  // e' come sono scritti, e' che un acquisto non ha un prefisso davanti.
  "Giannantonio Giuseppe",
  "Emiliano Pilia",
  "MICCOLI FABIO",
  "Tomas Flor Di Jiani He",
  "Il Boss Della Pizza Di",
  "Lucosco83",
]) {
  check("persona", d, false, persona(d));
}

/* ---------------------------------------------------------------- *
 * La revisione d'insieme
 * ---------------------------------------------------------------- */

const riga = (giorno, testo, importo, verso, file = "revolut.csv") => ({
  fileName: file,
  row: {
    date: new Date(`${giorno}T00:00:00Z`),
    description: testo,
    rawDescription: testo,
    amount: importo,
    direction: verso,
    currency: null,
    dedupKey: `stmt:${giorno}|${importo}|${testo}|1`,
  },
});

const righe = [
  riga("2026-01-05", "To Andrea De Caro", 500, "out"),
  riga("2026-01-06", "Pagamento da ANDREA DE CARO", 500, "in", "tr.csv"),
  riga("2026-01-10", "Ricarica di Apple Pay con *3350", 100, "in"),
  riga("2026-01-12", "Pagamento a favore di ANDREA DE CARO & LEONARDO BARESE", 64.55, "out"),
  riga("2026-01-15", "Pagamento a favore di LEONARDO BARESE", 11.44, "out"),
  riga("2026-01-16", "Pagamento da parte di ROSA PADUANO", 47.5, "in"),
  riga("2026-02-02", "Savings plan execution IE00B5BMR087 iShares Core S&P 500", 111.2, "out"),
  riga("2026-02-02", "Savings plan execution IE00B5BMR087 iShares Core S&P 500", 111.2, "out"),
  riga("2026-03-02", "Sepa Direct Debit transfer to SANTANDER CONSUMER BANK SPA (IT71C0319101000000000000404)", 382.38, "out"),
  riga("2026-03-05", "KFC ROMA DA VINCI", 20.05, "out"),
];

const contesto = {
  displayName: NOME,
  investimenti: [
    { id: "inv-1", label: "iShares Core S&P 500", amount: 111.2, days: ["2026-02-02"] },
    { id: "inv-2", label: "iShares Core S&P 500", amount: 111.2, days: ["2026-02-03"] },
  ],
  // Le righe VERE della regola Santander: partono ad agosto, mentre l'estratto
  // copre gennaio-maggio. Nessuna sovrapposizione, quindi nessun doppione —
  // confrontarsi col nome della regola avrebbe cancellato 1.911,90 € di rate vere.
  ricorrenti: [
    { id: "ric-1", label: "Santander", amount: 382.38, days: ["2026-08-29"] },
    { id: "ric-2", label: "Santander", amount: 382.38, days: ["2026-09-29"] },
  ],
  spese: [],
  entrate: [],
};

const out = rivedi(righe, contesto);
const tipi = (i) => out[i].sospetti.map((s) => s.tipo).sort();

check("revisione", "giro interno + coppia sull'uscita", ["coppia", "trasferimento_interno"], tipi(0));
check("revisione", "giro interno + coppia sull'entrata", ["coppia", "trasferimento_interno"], tipi(1));
check("revisione", "ricarica", ["ricarica"], tipi(2));
check("revisione", "cointestato zittisce «persona»", ["conto_condiviso"], tipi(3));
check("revisione", "cointestato non si esclude", false, out[3].escludiProposto);
check("revisione", "denaro a una persona", ["persona"], tipi(4));
check("revisione", "rimborso da una persona", ["persona"], tipi(5));
check("revisione", "le persone si tengono", [false, false], [out[4].escludiProposto, out[5].escludiProposto]);
// Due rate identiche lo stesso giorno devono trovare due riscontri distinti:
// senza il consumo, la seconda si aggancerebbe di nuovo alla prima.
check("revisione", "prima rata del PAC riconosciuta", ["gia_presente"], tipi(6));
check("revisione", "seconda rata, riscontro distinto", ["gia_presente"], tipi(7));
check("revisione", "Santander NON e' un doppione", [], tipi(8));
check("revisione", "Santander si tiene", false, out[8].escludiProposto);
check("revisione", "spesa da carta senza sospetti", [], tipi(9));

const decisioni = out.map(decisioneIniziale);
const c = conteggia(out, decisioni);
check("conteggi", "lette = tenute + escluse", righe.length, c.uscite + c.entrate + c.escluse);
check("conteggi", "escluse proposte", 5, c.escluse);

// La testata segue le decisioni, non le proposte: reincludere una riga la
// deve far ricomparire nei totali.
const riprese = out.map((r, i) => (i === 2 ? { esclusa: false } : decisioneIniziale(r)));
check("conteggi", "reincludere una riga aggiorna i totali", 4, conteggia(out, riprese).escluse);

// Correggere una riga non tocca la chiave che rende innocuo reimportare lo
// stesso file: e' la riga del file, non cio' che ne hai fatto.
const corretta = applicaDecisione(out[9], {
  esclusa: false,
  descrizione: "KFC Roma Da Vinci",
  importo: 25,
  direzione: "in",
  categoriaId: null,
});
check("decisioni", "dedupKey invariato dopo la correzione", out[9].row.dedupKey, corretta.dedupKey);
check("decisioni", "esercente corretto", "KFC Roma Da Vinci", corretta.description);
check("decisioni", "importo corretto", 25, corretta.amount);
check("decisioni", "verso corretto", "in", corretta.direction);
check("decisioni", "categoria volutamente vuota", null, corretta.categoryId);

// `undefined` e `null` non sono la stessa cosa: il primo lascia decidere
// l'esercente, il secondo toglie la categoria apposta.
check("decisioni", "categoria non toccata resta assente", undefined,
  applicaDecisione(out[9], { esclusa: false }).categoryId);

console.log(bad === 0 ? "\n✅ tutti i casi passano" : `\n❌ ${bad} casi falliti`);
process.exit(bad === 0 ? 0 : 1);
