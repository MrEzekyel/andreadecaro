import { supabase } from "./supabase";
import type { ResolvedMerchant } from "./types";

/**
 * Trova o crea l'esercente, raggruppandolo sotto la sua insegna.
 *
 * Il lavoro vero lo fa `resolve_merchant()` nel database (migrazione 0036).
 * Qui c'e' solo la chiamata, per un motivo preciso: la stessa logica stava in
 * tre copie — questo foglio, il recupero da file, la Edge Function di
 * ingestione — e tre copie di una regola di raggruppamento non possono che
 * divergere. Una divergenza qui non da' errori: crea gruppi diversi a seconda
 * di *da dove* e' entrata la spesa, e ci si accorge del problema mesi dopo
 * guardando "dove spendo di piu'".
 *
 * Restituisce `null` quando la chiamata fallisce. Chi salva deve poter
 * decidere: una spesa senza esercente collegato e' molto meglio di una spesa
 * persa, quindi si insensce lo stesso col solo nome scritto.
 */
export async function resolveMerchant(
  userId: string,
  name: string
): Promise<ResolvedMerchant | null> {
  const { data, error } = await supabase.rpc("resolve_merchant", {
    p_user_id: userId,
    p_name: name.trim(),
  });

  if (error) {
    console.warn("resolve_merchant fallita", error.message);
    return null;
  }

  // `returns table` arriva come elenco anche quando la riga e' una sola.
  const rows = (data ?? []) as ResolvedMerchant[];
  return rows[0] ?? null;
}
