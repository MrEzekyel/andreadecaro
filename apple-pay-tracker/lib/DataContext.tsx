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
import { Category, Person } from "./types";

type DataContextValue = {
  categories: Category[];
  categoryById: (id: string | null) => Category | undefined;
  people: Person[];
  personById: (id: string | null) => Person | undefined;
  reload: () => Promise<void>;
  loading: boolean;
  error: string | null;
};

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [categoriesResult, peopleResult] = await Promise.all([
      supabase.from("categories").select("*").order("sort_order"),
      supabase.from("people").select("*").order("name"),
    ]);

    const failure = firstError(categoriesResult, peopleResult);
    setError(failure);

    // Senza categorie ogni spesa diventa "Da categorizzare": tenere le vecchie
    // evita che un errore di rete riscriva a schermo la classificazione.
    if (!failure) {
      setCategories((categoriesResult.data ?? []) as Category[]);
      setPeople((peopleResult.data ?? []) as Person[]);
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

  const value = useMemo(
    () => ({ categories, categoryById, people, personById, reload, loading, error }),
    [categories, categoryById, people, personById, reload, loading, error]
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
