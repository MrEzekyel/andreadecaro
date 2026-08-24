import { supabase } from "./supabase";
import type { ImportBatch } from "./types";

/**
 * Gli import fatti, e il modo di disfarli.
 *
 * Prima di questo modulo un import non si poteva annullare, ed e' la cosa che
 * fa piu' paura di tutto l'import: le righe scritte da un file portavano
 * `source = 'import'` come quelle di ogni altro file, quindi due import
 * diversi si distinguevano solo guardando `created_at` a mano sul database.
 * Chi sbagliava non aveva nessuna strada per tornare indietro, se non
 * cancellare le spese una per una riconoscendole a occhio.
 *
 * E' la rete di sicurezza sotto tutto il resto: dare piu' modi di intervenire
 * su un import ha senso solo dopo che sbagliare e' diventato reversibile.
 */

export type BatchSummary = ImportBatch & {
  /**
   * Quante righe di questo lotto sono ancora nel database.
   *
   * Non e' `spese + entrate`: quello e' il conto di **quando l'import e'
   * avvenuto**, e nel frattempo l'utente puo' aver cancellato o modificato
   * delle spese a mano. Annullare toglie cio' che resta, e il numero mostrato
   * deve essere quello, altrimenti la conferma prometterebbe di togliere
   * righe che non esistono piu'.
   */
  ancora: number;
  /**
   * Quante di quelle spese sono divise con qualcuno.
   *
   * Va detto prima di annullare: `payment_splits.payment_id` cancella a
   * cascata, quindi togliere il lotto porta via anche le divisioni e i debiti
   * collegati. E' l'unico effetto dell'annullamento che va oltre le righe
   * importate, ed e' esattamente quello che nessuno si aspetta.
   */
  divise: number;
};

/** Gli import fatti, dal piu' recente. `null` quando la lettura fallisce. */
export async function readImportBatches(): Promise<BatchSummary[] | null> {
  const { data, error } = await supabase
    .from("import_batches")
    .select("*")
    .order("created_at", { ascending: false });

  // Un elenco vuoto non puo' voler dire "non ho letto": qui significherebbe
  // "non hai mai importato niente", detto a chi ha appena importato.
  if (error || !data) return null;

  const batches = data as ImportBatch[];
  if (batches.length === 0) return [];

  const ids = batches.map((b) => b.id);

  const [spese, entrate] = await Promise.all([
    supabase
      .from("payments")
      // Il vincolo va nominato: `payment_splits` punta a `payments` due volte
      // (`payment_id` e `mirror_payment_id`), e senza disambiguare PostgREST
      // rifiuta l'incorporamento come ambiguo.
      .select("import_batch_id, payment_splits!payment_splits_payment_id_fkey(id)")
      .in("import_batch_id", ids),
    supabase
      .from("incomes")
      .select("import_batch_id")
      .in("import_batch_id", ids),
  ]);

  if (spese.error || entrate.error) return null;

  const ancora = new Map<string, number>();
  const divise = new Map<string, number>();

  for (const riga of (spese.data ?? []) as {
    import_batch_id: string | null;
    payment_splits: { id: string }[] | null;
  }[]) {
    if (!riga.import_batch_id) continue;
    ancora.set(riga.import_batch_id, (ancora.get(riga.import_batch_id) ?? 0) + 1);
    if ((riga.payment_splits ?? []).length > 0) {
      divise.set(riga.import_batch_id, (divise.get(riga.import_batch_id) ?? 0) + 1);
    }
  }

  for (const riga of (entrate.data ?? []) as { import_batch_id: string | null }[]) {
    if (!riga.import_batch_id) continue;
    ancora.set(riga.import_batch_id, (ancora.get(riga.import_batch_id) ?? 0) + 1);
  }

  return batches.map((b) => ({
    ...b,
    ancora: ancora.get(b.id) ?? 0,
    divise: divise.get(b.id) ?? 0,
  }));
}

/**
 * Annulla un import.
 *
 * Il lavoro lo fa `undo_import_batch()` nel database, in una transazione
 * sola: le tre cancellazioni separate che servirebbero da qui possono uscire
 * a meta', lasciando le spese tolte e le entrate dentro, e in quel caso il
 * lotto risulterebbe annullato senza esserlo — lo stato peggiore, perche'
 * l'elenco direbbe di si'.
 */
export async function undoImportBatch(
  batchId: string
): Promise<{ spese: number; entrate: number } | null> {
  const { data, error } = await supabase.rpc("undo_import_batch", {
    p_batch: batchId,
  });

  if (error) return null;

  // `returns table` arriva come elenco anche con una riga sola.
  const rows = (data ?? []) as { spese: number; entrate: number }[];
  return rows[0] ?? { spese: 0, entrate: 0 };
}
