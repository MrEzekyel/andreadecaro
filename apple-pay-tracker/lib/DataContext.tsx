import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "./supabase";
import { Category } from "./types";

type DataContextValue = {
  categories: Category[];
  categoryById: (id: string | null) => Category | undefined;
  reloadCategories: () => Promise<void>;
  loading: boolean;
};

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const reloadCategories = useCallback(async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("sort_order", { ascending: true });

    if (!error && data) setCategories(data as Category[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    reloadCategories();
  }, [reloadCategories]);

  const index = useMemo(() => {
    const map = new Map<string, Category>();
    for (const category of categories) map.set(category.id, category);
    return map;
  }, [categories]);

  const categoryById = useCallback(
    (id: string | null) => (id ? index.get(id) : undefined),
    [index]
  );

  const value = useMemo(
    () => ({ categories, categoryById, reloadCategories, loading }),
    [categories, categoryById, reloadCategories, loading]
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
