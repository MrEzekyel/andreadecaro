/**
 * Le rate ricorrenti ancora da addebitare nel mese, contro casi scritti a
 * mano. Importa il modulo vero (Node 24 legge il TypeScript da solo):
 *
 *   node lib/__tests__/fixed-costs.test.mjs
 */
import assert from "node:assert/strict";
import { upcomingRecurringTotal } from "../fixedCosts.ts";

const rule = (o) => ({ start_on: "2026-01-01", end_on: null, weekday: null, day_of_month: null, ...o });
const oct1 = new Date(2026, 9, 1, 9);
const oct20 = new Date(2026, 9, 20, 9);

// Il caso di Andrea: il primo del mese la rata del 15 conta gia'.
assert.equal(upcomingRecurringTotal([rule({ amount: 450, frequency: "monthly", day_of_month: 15, next_run_on: "2026-10-15" })], oct1), 450);
// Gia' addebitata (next_run_on spostato a novembre): non va contata due volte.
assert.equal(upcomingRecurringTotal([rule({ amount: 450, frequency: "monthly", day_of_month: 15, next_run_on: "2026-11-15" })], oct20), 0);
// Settimanale di lunedi' dal 5 ottobre: 5, 12, 19, 26 -> quattro rate.
assert.equal(upcomingRecurringTotal([rule({ amount: 10, frequency: "weekly", weekday: 1, next_run_on: "2026-10-05" })], oct1), 40);
// Annuale a marzo: non tocca ottobre.
assert.equal(upcomingRecurringTotal([rule({ amount: 99, frequency: "yearly", day_of_month: 3, next_run_on: "2027-03-03" })], oct1), 0);
// Regola che finisce prima della scadenza.
assert.equal(upcomingRecurringTotal([rule({ amount: 30, frequency: "monthly", day_of_month: 25, next_run_on: "2026-10-25", end_on: "2026-10-20" })], oct1), 0);
// Il 31 in un mese da 30: il database la mette il 30, qui pure.
assert.equal(upcomingRecurringTotal([rule({ amount: 5, frequency: "monthly", day_of_month: 31, next_run_on: "2026-09-30" })], new Date(2026, 8, 1)), 5);
// Scadenza di oggi non ancora creata dal cron: conta.
assert.equal(upcomingRecurringTotal([rule({ amount: 12, frequency: "monthly", day_of_month: 1, next_run_on: "2026-10-01" })], oct1), 12);

console.log("fixed-costs: 7 casi ok");
