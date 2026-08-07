/**
 * Distinguere "non ho letto" da "non c'e' niente".
 *
 * Il modo naturale di scrivere una lettura da Supabase — `if (data) setX(data)`
 * — tratta l'errore come se fosse un elenco vuoto. In un'app di spese questo
 * non produce una schermata vuota ma una **frase falsa sui soldi**: l'utente
 * legge "Nessuna spesa in questo mese" quando la verita' e' che non siamo
 * riusciti a chiedere.
 *
 * Queste due funzioni esistono perche' applicare la distinzione ovunque sia
 * meccanico invece che una decisione da ripetere a ogni schermata.
 */

type Failed = { error: { message: string } | null };

/**
 * Primo errore fra piu' letture fatte in parallelo, altrimenti `null`.
 *
 * Si ferma al primo: quando la rete cade falliscono tutte insieme e mostrarne
 * cinque non aggiunge niente a mostrarne una.
 */
export function firstError(...results: Failed[]): string | null {
  for (const result of results) {
    if (result.error) return result.error.message;
  }
  return null;
}

/**
 * Traduce l'errore tecnico in una frase che dice cosa e' successo.
 *
 * Il messaggio grezzo di Postgres o del client ("JWT expired", "Network
 * request failed") non aiuta chi legge, ma buttarlo via renderebbe impossibile
 * capire un problema vero: resta come dettaglio sotto, in piccolo.
 */
export function describeLoadError(message: string) {
  if (/network|fetch|timeout|connection|abort/i.test(message)) {
    return "Non riesco a raggiungere il server. Controlla la connessione.";
  }
  if (/jwt|token|session|expired|refresh/i.test(message)) {
    return "La sessione è scaduta. Esci e rientra per continuare.";
  }
  return "Non è stato possibile leggere i dati.";
}
