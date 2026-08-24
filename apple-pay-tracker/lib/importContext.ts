import type { Contesto, ExistingRow } from "./importReview";
import type { StatementRow } from "./statementImport";
import { supabase } from "./supabase";

/**
 * Legge dal database cio' contro cui si confrontano le righe di un import.
 *
 * Sta fuori da `importReview` di proposito: li' dentro sono tutte funzioni
 * pure, che si possono provare sui casi veri senza un database davanti, ed e'
 * l'unico modo per cui regole come "questa e' una persona" o "questo e' un
 * doppione" restano verificabili invece che opinabili. Qui c'e' solo la
 * lettura.
 */

const DAY = 24 * 60 * 60 * 1000;
const PAGE = 1000;

/**
 * Finestra piu' larga della tolleranza massima del confronto.
 *
 * Sette giorni per una tolleranza di quattro: chi cade sul bordo della
 * finestra deve comunque avere i suoi quattro giorni di margine da entrambi i
 * lati, altrimenti le righe del primo e dell'ultimo giorno dell'estratto si
 * confronterebbero con meno storia di tutte le altre.
 */
const MARGINE = 7;

async function leggiTutto<T>(
  tabella: string,
  colonne: string,
  da: string,
  a: string,
  filtro?: (q: any) => any
): Promise<T[] | null> {
  const righe: T[] = [];

  for (let pagina = 0; ; pagina += 1) {
    let query = supabase
      .from(tabella)
      .select(colonne)
      .gte("occurred_at", da)
      .lte("occurred_at", a)
      .order("occurred_at", { ascending: true })
      .range(pagina * PAGE, pagina * PAGE + PAGE - 1);

    if (filtro) query = filtro(query);

    const { data, error } = await query;
    // PostgREST tronca a mille righe **senza errore**: senza paginare, cio'
    // che non si vede diventa "non c'era", e un doppione non riconosciuto e'
    // una spesa contata due volte.
    if (error) return null;

    const blocco = (data ?? []) as unknown as T[];
    righe.push(...blocco);
    if (blocco.length < PAGE) break;
  }

  return righe;
}

/**
 * Il contesto per le righe lette. `null` quando una lettura fallisce.
 *
 * Il `null` non e' pignoleria: se una lettura fallisse e si restituisse un
 * contesto vuoto, la revisione direbbe "nessun doppione trovato" a chi ne ha
 * cinquanta. Un elenco vuoto non deve mai poter significare "non ho letto".
 */
export async function readImportContext(
  rows: StatementRow[]
): Promise<Contesto | null> {
  if (rows.length === 0) return null;

  const tempi = rows.map((r) => r.date.getTime());
  const da = new Date(Math.min(...tempi) - MARGINE * DAY).toISOString();
  const a = new Date(Math.max(...tempi) + MARGINE * DAY).toISOString();

  const { data: auth } = await supabase.auth.getSession();
  const userId = auth.session?.user.id;
  if (!userId) return null;

  const profilo = await supabase
    .from("profiles")
    .select("display_name")
    // `user_id`, non `id`: la chiave di `profiles` e' quella.
    .eq("user_id", userId)
    .maybeSingle();
  if (profilo.error) return null;

  const [investimenti, ricorrenti, spese, entrate] = await Promise.all([
    leggiTutto<{ id: string; label: string; amount: number | string; occurred_at: string; settled_on: string | null }>(
      "investments",
      "id, label, amount, occurred_at, settled_on",
      da,
      a,
      // Solo il denaro che esce verso il broker: una vendita o un dividendo
      // non hanno un addebito corrispondente sull'estratto conto.
      (q) => q.eq("kind", "buy")
    ),
    leggiTutto<{ id: string; merchant_name: string; amount: number | string; occurred_at: string }>(
      "payments",
      "id, merchant_name, amount, occurred_at",
      da,
      a,
      // Le righe **vere** generate dalle regole, non le regole.
      //
      // Una `recurring_rule` non e' una spesa, e' la promessa di spese future:
      // confrontarsi col suo nome e col suo importo avrebbe fatto sparire
      // 1.911,90 € di rate Santander vere, perche' esiste una regola identica
      // che pero' parte ad agosto mentre l'estratto copre gennaio-maggio.
      (q) => q.eq("source", "recurring")
    ),
    leggiTutto<{ id: string; merchant_name: string; amount: number | string; occurred_at: string }>(
      "payments",
      "id, merchant_name, amount, occurred_at",
      da,
      a,
      (q) => q.neq("source", "recurring")
    ),
    leggiTutto<{ id: string; label: string; amount: number | string; occurred_at: string }>(
      "incomes",
      "id, label, amount, occurred_at",
      da,
      a
    ),
  ]);

  if (!investimenti || !ricorrenti || !spese || !entrate) return null;

  const giorno = (iso: string) => iso.slice(0, 10);

  return {
    displayName: profilo.data?.display_name ?? null,
    investimenti: investimenti.map<ExistingRow>((r) => ({
      id: r.id,
      label: r.label,
      amount: Number(r.amount),
      // Entrambe le date, perche' sui fondi private market fra l'addebito e
      // l'assegnazione delle quote passano settimane: l'estratto porta la
      // prima, `investments` mostra la seconda.
      days: r.settled_on && giorno(r.occurred_at) !== r.settled_on
        ? [giorno(r.occurred_at), r.settled_on]
        : [giorno(r.occurred_at)],
    })),
    ricorrenti: ricorrenti.map<ExistingRow>((r) => ({
      id: r.id,
      label: r.merchant_name,
      amount: Number(r.amount),
      days: [giorno(r.occurred_at)],
    })),
    spese: spese.map<ExistingRow>((r) => ({
      id: r.id,
      label: r.merchant_name,
      amount: Number(r.amount),
      days: [giorno(r.occurred_at)],
    })),
    entrate: entrate.map<ExistingRow>((r) => ({
      id: r.id,
      label: r.label,
      amount: Number(r.amount),
      days: [giorno(r.occurred_at)],
    })),
  };
}
