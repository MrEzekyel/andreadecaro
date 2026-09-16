import { supabase } from "./supabase";

/**
 * PostgREST tronca la risposta a 1000 righe (500 su certi progetti hosted)
 * **senza restituire un errore**. Una `select` senza `.range()` su due anni di
 * spese torna le prime mille righe e sembra riuscita: `firstError()` non vede
 * niente, e la schermata dichiara come "mesi senza spese" dei mesi che non
 * abbiamo mai chiesto. E' il difetto piu' insidioso di questo progetto, perche'
 * non produce una schermata vuota ma **numeri plausibili e piu' bassi del vero**.
 *
 * `lib/exportData.ts` e `lib/statementWriter.ts` hanno gia' ciascuno il proprio
 * `readAll` perche' li' un troncamento rovinerebbe un file o un confronto
 * anti-doppione. Questo e' lo stesso meccanismo per le **letture di schermata**:
 * restituisce la stessa forma `{ data, error }` di una query Supabase, cosi'
 * entra in `Promise.all` e in `firstError()` senza che il chiamante cambi
 * struttura.
 */
const PAGE = 1000;

type Query = {
  range: (from: number, to: number) => PromiseLike<{
    data: unknown[] | null;
    error: { message: string } | null;
  }>;
};

/**
 * `build` viene richiamata per ogni pagina invece di riusare una query sola:
 * un builder Supabase e' consumabile una volta e ripassarlo a `.range()` due
 * volte non rifa' la richiesta.
 *
 * L'ordinamento lo decide il chiamante, ma deve esserci ed essere **non
 * ambiguo**: `occurred_at` ha duplicati (le rate di un piano cadono tutte alle
 * 10:00), e con un ordinamento ambiguo Postgres puo' restituire la stessa riga
 * in due pagine e saltarne un'altra.
 */
export async function readPaged<T>(
  build: () => Query
): Promise<{ data: T[] | null; error: { message: string } | null }> {
  const rows: T[] = [];

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1);
    if (error) return { data: null, error };

    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < PAGE) return { data: rows, error: null };
  }
}
