import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { firstError } from "./loadError";
import { supabase } from "./supabase";
import { Category, Merchant, Payment, Person } from "./types";

type DataContextValue = {
  categories: Category[];
  categoryById: (id: string | null) => Category | undefined;
  people: Person[];
  personById: (id: string | null) => Person | undefined;
  merchants: Merchant[];
  merchantById: (id: string | null) => Merchant | undefined;
  /**
   * Il nome da mostrare in un elenco: l'insegna se la spesa viene da un punto
   * vendita di un gruppo, altrimenti il nome della spesa cosi' com'e'.
   *
   * Il brand si risolve **qui e non in `payments.merchant_name`**: quel campo
   * resta il nome come e' arrivato quel giorno. Scriverci dentro l'insegna
   * significherebbe che, il giorno in cui un raggruppamento cambia, le spese
   * vecchie continuano a mostrare il nome di un gruppo che non esiste piu'.
   */
  brandLabel: (payment: Pick<Payment, "merchant_id" | "merchant_name">) => string;
  reload: () => Promise<void>;
  loading: boolean;
  error: string | null;
};

const DataContext = createContext<DataContextValue | null>(null);

const PAGE = 1000;

/**
 * Tutti gli esercenti, a pagine, con la stessa forma di risultato delle altre
 * letture cosi' che `firstError` possa trattarle tutte allo stesso modo.
 *
 * L'ordinamento secondario su `id` serve perche' `display_name` ha duplicati
 * (due utenti, o due insegne scritte uguale): un ordinamento ambiguo farebbe
 * comparire la stessa riga in due pagine saltandone un'altra.
 */
async function readAllMerchants(): Promise<{
  data: Merchant[] | null;
  error: { message: string } | null;
}> {
  const rows: Merchant[] = [];

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("merchants")
      .select("*")
      .order("display_name", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);

    if (error) return { data: null, error };

    const page = (data ?? []) as Merchant[];
    rows.push(...page);
    if (page.length < PAGE) break;
  }

  return { data: rows, error: null };
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [categoriesResult, peopleResult, merchantsResult] = await Promise.all([
      supabase.from("categories").select("*").order("sort_order"),
      supabase.from("people").select("*").order("name"),
      // Paginato: gli esercenti crescono di una riga per ogni posto nuovo in
      // cui si paga, e PostgREST tronca a 1000 righe **senza dare errore**.
      // Oltre quella soglia il selettore smetterebbe di proporre gli esercenti
      // piu' vecchi senza che niente lo segnali.
      readAllMerchants(),
    ]);

    const failure = firstError(categoriesResult, peopleResult, merchantsResult);
    setError(failure);

    // Senza categorie ogni spesa diventa "Da categorizzare": tenere le vecchie
    // evita che un errore di rete riscriva a schermo la classificazione.
    if (!failure) {
      setCategories((categoriesResult.data ?? []) as Category[]);
      setPeople((peopleResult.data ?? []) as Person[]);
      setMerchants((merchantsResult.data ?? []) as Merchant[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const categoryIndex = useMemo(() => {
    const map = new Map<string, Category>();
    for (const category of categories) map.set(category.id, category);
    return map;
  }, [categories]);

  const peopleIndex = useMemo(() => {
    const map = new Map<string, Person>();
    for (const person of people) map.set(person.id, person);
    return map;
  }, [people]);

  const categoryById = useCallback(
    (id: string | null) => (id ? categoryIndex.get(id) : undefined),
    [categoryIndex]
  );

  const personById = useCallback(
    (id: string | null) => (id ? peopleIndex.get(id) : undefined),
    [peopleIndex]
  );

  const merchantIndex = useMemo(() => {
    const map = new Map<string, Merchant>();
    for (const merchant of merchants) map.set(merchant.id, merchant);
    return map;
  }, [merchants]);

  const merchantById = useCallback(
    (id: string | null) => (id ? merchantIndex.get(id) : undefined),
    [merchantIndex]
  );

  const brandLabel = useCallback(
    (payment: Pick<Payment, "merchant_id" | "merchant_name">) => {
      const merchant = payment.merchant_id
        ? merchantIndex.get(payment.merchant_id)
        : undefined;
      if (!merchant?.parent_id) return payment.merchant_name;
      // Se gli esercenti non sono stati letti si ricade sul nome della spesa,
      // che e' comunque vero: mai una riga senza nome.
      return merchantIndex.get(merchant.parent_id)?.display_name ?? payment.merchant_name;
    },
    [merchantIndex]
  );

  const value = useMemo(
    () => ({
      categories,
      categoryById,
      people,
      personById,
      merchants,
      merchantById,
      brandLabel,
      reload,
      loading,
      error,
    }),
    [
      categories,
      categoryById,
      people,
      personById,
      merchants,
      merchantById,
      brandLabel,
      reload,
      loading,
      error,
    ]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error("useData deve essere usato dentro <DataProvider>");
  }
  return context;
}
