import { supabase } from "./supabase";
import type { InstrumentCandidate } from "./types";

/**
 * Il lato "cercare uno strumento" del sistema ibrido di ricerca.
 *
 * La tabella `instruments` (curata, migrazione 0040) si legge direttamente
 * con supabase-js in `DataContext` — è statica e piccola, non serve una
 * funzione per un filtro che il client fa già in `InstrumentPicker`. Qui
 * vive solo il ripiego: Yahoo Finance via `search-instruments`, e la
 * verifica dal vivo che deve superare qualunque simbolo prima di diventare
 * un `assets`.
 */

const SEARCH_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/search-instruments`;
const SYNC_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/sync-prices`;

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessione scaduta: esci e rientra.");
  return { Authorization: `Bearer ${token}` };
}

/**
 * Cerca su Yahoo Finance quando la lista curata non basta.
 *
 * I risultati non sono ancora verificati: `currency` può mancare (Yahoo non
 * la dà nella ricerca), e un simbolo può comparire anche se nel frattempo è
 * stato delistato. `probeInstrument` è il passo che manca prima di poterli
 * salvare.
 */
export async function searchInstrumentsOnline(
  query: string
): Promise<InstrumentCandidate[]> {
  const res = await fetch(
    `${SEARCH_URL}?q=${encodeURIComponent(query)}`,
    { headers: await authHeaders() }
  );
  if (!res.ok) throw new Error("Ricerca online non riuscita.");
  const body = await res.json();
  return (body?.results ?? []) as InstrumentCandidate[];
}

export type ProbedInstrument = {
  symbol: string;
  name: string;
  currency: string;
  price: number;
};

/**
 * Verifica dal vivo che un simbolo abbia davvero una quotazione, prima che
 * possa diventare un `assets`.
 *
 * Non è un controllo opzionale: senza, la lista curata o un risultato Yahoo
 * mai verificato entrerebbero in `assets` sulla parola, e un simbolo
 * delistato o scritto male produrrebbe un asset che non si aggiornerà mai
 * più — un errore silenzioso, visibile solo mesi dopo come "il grafico è
 * fermo".
 */
export async function probeInstrument(symbol: string): Promise<ProbedInstrument | null> {
  const res = await fetch(
    `${SEARCH_URL}?probe=${encodeURIComponent(symbol)}`,
    { headers: await authHeaders() }
  );
  if (!res.ok) return null;
  const body = await res.json();
  return body?.ok ? (body.instrument as ProbedInstrument) : null;
}

/**
 * Recupera subito lo storico prezzi di un asset appena creato.
 *
 * Senza, un asset a prezzo pubblico resterebbe senza nessuna riga in
 * `asset_prices` fino al cron della notte — e nel frattempo non c'è un
 * prezzo a cui agganciare il primo investimento manuale che l'utente sta
 * per registrare nella stessa sessione in cui ha creato l'asset.
 *
 * Non fa fallire la creazione dell'asset se non riesce: l'asset resta
 * comunque valido, semplicemente senza storico fino al cron successivo.
 */
export async function backfillAssetPrices(assetId: string): Promise<void> {
  try {
    await fetch(`${SYNC_URL}?asset_id=${encodeURIComponent(assetId)}`, {
      headers: await authHeaders(),
    });
  } catch {
    // Silenzioso di proposito: vedi commento sopra.
  }
}
