import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Copia locale dell'ultima lettura riuscita.
 *
 * Serve a due cose, e la seconda vale piu' della prima: aprire l'app senza
 * aspettare la rete, e non dover scegliere fra una schermata bianca e un
 * errore quando la rete non c'e'. "Questi sono i dati di stamattina" e' meglio
 * di entrambi — e resta vero, che e' la condizione a cui tutto il resto
 * dell'app e' tenuto.
 *
 * Non e' una cache di correttezza: i numeri veri restano quelli del database.
 * Quando la lettura riesce, quello che c'era qui non conta piu'.
 */

type Entry<T> = { at: string; value: T };

/** Le chiavi portano l'utente: al cambio account i dati non si mescolano. */
function scoped(userId: string, key: string) {
  return `cache:${userId}:${key}`;
}

export async function readCache<T>(
  userId: string,
  key: string
): Promise<Entry<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(scoped(userId, key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Entry<T>;
    // Una voce senza data non si sa quanto e' vecchia, e mostrare dati di eta'
    // ignota come se fossero freschi e' peggio che non mostrarli.
    if (!parsed?.at) return null;
    return parsed;
  } catch {
    // Storage corrotto o JSON illeggibile: si riparte dalla rete, che e'
    // esattamente il comportamento di prima che questa cache esistesse.
    return null;
  }
}

export async function writeCache<T>(userId: string, key: string, value: T) {
  try {
    const entry: Entry<T> = { at: new Date().toISOString(), value };
    await AsyncStorage.setItem(scoped(userId, key), JSON.stringify(entry));
  } catch {
    // Disco pieno o quota superata: la cache e' un'ottimizzazione, non un
    // requisito. Fallire qui non deve impedire di mostrare i dati appena letti.
  }
}

/** "aggiornato alle 09:14" oppure "aggiornato il 3 agosto". */
export function describeAge(at: string) {
  const when = new Date(at);
  if (Number.isNaN(when.getTime())) return "";

  const oggi = new Date();
  const stessoGiorno =
    when.getDate() === oggi.getDate() &&
    when.getMonth() === oggi.getMonth() &&
    when.getFullYear() === oggi.getFullYear();

  return stessoGiorno
    ? `aggiornato alle ${when.toLocaleTimeString("it-IT", {
        hour: "2-digit",
        minute: "2-digit",
      })}`
    : `aggiornato il ${when.toLocaleDateString("it-IT", {
        day: "numeric",
        month: "long",
      })}`;
}
