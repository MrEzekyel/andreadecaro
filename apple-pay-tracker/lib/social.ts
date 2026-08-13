import { supabase } from "./supabase";
import type { Connection, FoundProfile, IncomingSplit } from "./types";

/**
 * Il lato "fra due account" dell'app: tag, amici, quote condivise.
 *
 * Ogni funzione qui e' una RPC, mai una lettura diretta di tabella. Non e'
 * una preferenza di stile: leggere la quota che un amico mi ha mandato vuol
 * dire leggere anche la **sua** spesa, e una policy abbastanza larga da
 * permetterlo aprirebbe anche nota, carta, categoria e la sua quota di
 * competenza. Nelle RPC (`security definer`) le colonne che attraversano il
 * confine sono scritte a mano, una per una.
 */

/** Errore leggibile, con dentro il messaggio che scrivono le RPC. */
function fail(message: string): never {
  throw new Error(message);
}

/**
 * Il nome con cui gli amici ti vedono.
 *
 * È l'unica cosa che si sceglie di se': il tag lo assegna il database alla
 * creazione dell'account (`generate_clinck_tag`), e non e' modificabile —
 * altrimenti l'unicita' garantita dal generatore dipenderebbe da cosa manda
 * il client.
 */
export async function setDisplayName(name: string) {
  const { data, error } = await supabase.rpc("set_display_name", {
    p_display_name: name,
  });
  if (error) fail(error.message);
  return data as string;
}

/**
 * Cerca una persona dal tag **esatto**.
 *
 * Non c'e' una ricerca "che inizia per", ed e' una scelta: su una tabella di
 * profili sarebbe un modo per farsi enumerare tutta l'utenza sei cifre alla
 * volta. Il tag si condivide, non si indovina. Il database tollera solo le
 * differenze di forma (minuscole, spazi, le sole cifre senza `CLI-`).
 */
export async function findByHandle(handle: string): Promise<FoundProfile | null> {
  const { data, error } = await supabase.rpc("find_profile_by_handle", {
    p_handle: handle,
  });
  if (error) fail(error.message);
  return ((data ?? []) as FoundProfile[])[0] ?? null;
}

export async function requestConnection(userId: string) {
  const { error } = await supabase.rpc("request_connection", { p_user_id: userId });
  if (error) fail(error.message);
}

export async function respondConnection(connectionId: string, accept: boolean) {
  const { error } = await supabase.rpc("respond_connection", {
    p_connection_id: connectionId,
    p_accept: accept,
  });
  if (error) fail(error.message);
}

export async function listConnections(): Promise<Connection[]> {
  const { data, error } = await supabase.rpc("list_connections");
  if (error) fail(error.message);
  return (data ?? []) as Connection[];
}

export async function incomingSplits(): Promise<IncomingSplit[]> {
  const { data, error } = await supabase.rpc("incoming_splits");
  if (error) fail(error.message);
  return (data ?? []) as IncomingSplit[];
}

/**
 * Accetta o rifiuta una quota.
 *
 * Accettare crea la spesa nel proprio conto — e' il punto della funzione:
 * senza, si accetterebbe un debito che nei propri numeri non compare da
 * nessuna parte. Rifiutare non tocca la spesa di chi ha pagato.
 */
export async function respondToSplit(splitId: string, accept: boolean) {
  const { error } = await supabase.rpc("respond_to_split", {
    p_split_id: splitId,
    p_accept: accept,
  });
  if (error) fail(error.message);
}

/** "Ho pagato": lo dichiara chi deve, lo conferma chi ha pagato. */
export async function requestSettle(splitId: string) {
  const { error } = await supabase.rpc("request_settle", { p_split_id: splitId });
  if (error) fail(error.message);
}

/**
 * Collega un contatto della rubrica a un account Clinck.
 *
 * Restituisce quante quote aperte sono passate all'account: e' il numero da
 * mostrare, perche' e' l'unica cosa che rende visibile cos'e' successo.
 */
export async function linkPerson(personId: string, userId: string): Promise<number> {
  const { data, error } = await supabase.rpc("link_person", {
    p_person_id: personId,
    p_user_id: userId,
  });
  if (error) fail(error.message);
  return (data as number) ?? 0;
}

export async function unlinkPerson(personId: string) {
  const { error } = await supabase.rpc("unlink_person", { p_person_id: personId });
  if (error) fail(error.message);
}
