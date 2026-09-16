import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useExplorer } from "../components/Explorer";
import ImportScreen from "./ImportScreen";
import { EditIncomeSheet } from "../components/EditIncomeSheet";
import { Icon } from "../components/Icon";
import { LoadError } from "../components/LoadError";
import { ScreenHeader } from "../components/ScreenHeader";
import { StaleNote } from "../components/StaleNote";
import { PaymentRow } from "../components/PaymentRow";
import { TwoColumns } from "../components/TwoColumns";
import { useData } from "../lib/DataContext";
import { useTheme } from "../lib/ThemeContext";
import {
  dayKey,
  dayLabel,
  formatAmount,
  monthName,
  shortDateTime,
} from "../lib/format";
import { useScrollRestoration } from "../lib/scrollRestoration";
import { supabase } from "../lib/supabase";
import { categoryColor, radius, space, tint, type } from "../lib/theme";
import { Income, Payment } from "../lib/types";
import { monthRange, usePayments } from "../lib/usePayments";
import { MoneyMode } from "../lib/moneyMode";

type Props = {
  mode: MoneyMode;
  onModeChange: (mode: MoneyMode) => void;
};

/**
 * La stessa scheda che prima si chiamava "Spese" e mostrava solo le uscite:
 * ora ha lo stesso segmented control Uscite/Entrate della Home, con lo
 * stesso motivo — sono due elenchi che rispondono a domande opposte, e
 * tenerli su due schede separate avrebbe raddoppiato una scelta che la Home
 * fa gia' una volta sola. `mode` e' controllato da `App.tsx` e non locale:
 * e' lo stesso stato che decide cosa apre il tasto centrale della tabbar.
 */
export default function MovementsScreen({ mode, onModeChange }: Props) {
  const { palette } = useTheme();
  const [month, setMonth] = useState(() => new Date());
  const [importing, setImporting] = useState(false);
  // Cambia dopo un import: gli elenchi tengono i propri dati in stato interno
  // e devono rileggerli, altrimenti si torna indietro su una schermata che non
  // mostra ancora cio' che si e' appena importato.
  const [importedAt, setImportedAt] = useState(0);

  function shiftMonth(delta: number) {
    setMonth((current) => {
      const next = new Date(current);
      next.setDate(1);
      next.setMonth(next.getMonth() + delta);
      return next;
    });
  }

  if (importing) {
    return (
      <ImportScreen
        onBack={() => setImporting(false)}
        onImported={() => setImportedAt(Date.now())}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: palette.ground }]}>
      <View style={styles.head}>
        <ScreenHeader title="Movimenti" />

        <View style={[styles.seg, { backgroundColor: palette.surface2 }]}>
          {(["uscite", "entrate"] as const).map((value) => {
            const on = mode === value;
            return (
              <TouchableOpacity
                key={value}
                onPress={() => onModeChange(value)}
                style={[styles.segItem, on && { backgroundColor: palette.surface }]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text
                  style={[
                    styles.segText,
                    {
                      color: on
                        ? value === "entrate"
                          ? palette.good
                          : palette.ink
                        : palette.ink3,
                    },
                  ]}
                >
                  {value === "uscite" ? "Uscite" : "Entrate"}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.monthNav}>
          <TouchableOpacity
            onPress={() => shiftMonth(-1)}
            accessibilityLabel="Mese precedente"
          >
            <Icon name="chevron-left" size={16} color={palette.ink3} />
          </TouchableOpacity>
          <Text style={[styles.month, { color: palette.ink3 }]}>
            {monthName(month)} {month.getFullYear()}
          </Text>
          <TouchableOpacity
            onPress={() => shiftMonth(1)}
            accessibilityLabel="Mese successivo"
          >
            <Icon name="chevron-right" size={16} color={palette.ink3} />
          </TouchableOpacity>
        </View>
      </View>

      {mode === "uscite" ? (
        <ExpensesList
          key={`spese-${importedAt}`}
          month={month}
          onImport={() => setImporting(true)}
        />
      ) : (
        <IncomeList key={`entrate-${importedAt}`} month={month} />
      )}
    </View>
  );
}

/** L'elenco spese di sempre, solo senza il proprio titolo/mese in testa —
 *  li mostra ormai la testata condivisa sopra. */
function ExpensesList({
  month,
  onImport,
}: {
  month: Date;
  onImport: () => void;
}) {
  const { palette, dark } = useTheme();
  const { categories, categoryById, brandLabel } = useData();
  const { payments, error, staleLabel, staleReason, reload } = usePayments(month);
  const [refreshing, setRefreshing] = useState(false);
  const explorer = useExplorer(reload);
  const scrollRestoration = useScrollRestoration("movements-expenses");

  const [query, setQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return payments.filter((payment) => {
      // Si cerca sia sul nome scritto sulla spesa sia sull'insegna: la riga
      // mostra l'insegna, e cercare esattamente la parola che si sta leggendo
      // a schermo non deve poter dare zero risultati.
      if (
        needle &&
        !payment.merchant_name.toLowerCase().includes(needle) &&
        !brandLabel(payment).toLowerCase().includes(needle)
      ) {
        return false;
      }
      if (filterCategory !== null && payment.category_id !== filterCategory) {
        return false;
      }
      return true;
    });
  }, [payments, query, filterCategory, brandLabel]);

  const sections = useMemo(() => {
    const groups: { title: string; total: number; data: Payment[] }[] = [];
    let currentKey: string | null = null;

    for (const payment of filtered) {
      const key = dayKey(payment.occurred_at);
      if (key !== currentKey) {
        groups.push({ title: dayLabel(payment.occurred_at), total: 0, data: [] });
        currentKey = key;
      }
      const group = groups[groups.length - 1];
      group.data.push(payment);
      group.total += Number(payment.effective_amount);
    }

    return groups;
  }, [filtered]);

  async function onRefresh() {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }

  if (explorer.isOpen) return <>{explorer.overlay}</>;

  const filtering = query.trim() !== "" || filterCategory !== null;

  return (
    <>
      {staleLabel && (
        <View style={styles.stale}>
          <StaleNote label={staleLabel} reason={staleReason} onRetry={reload} />
        </View>
      )}

      <View style={styles.filters}>
        {/* La ricerca lascia spazio all'import: e' qui che ci si accorge che
            manca qualcosa, e da qui deve partire il rimedio — non da tre
            schermate piu' in la', fra le automazioni. */}
        <View style={styles.searchRow}>
          <View
            style={[
              styles.searchBox,
              { backgroundColor: palette.surface, borderColor: palette.hairline },
            ]}
          >
            <Icon name="search" size={15} color={palette.ink3} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Cerca"
              placeholderTextColor={palette.ink3}
              style={[styles.searchInput, { color: palette.ink }]}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery("")} hitSlop={8}>
                <Icon name="x" size={15} color={palette.ink3} />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            onPress={onImport}
            style={[
              styles.importButton,
              { backgroundColor: palette.surface, borderColor: palette.hairline },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Importa movimenti"
          >
            <Icon name="file-up" size={15} color={palette.ink2} />
            <Text style={[styles.importText, { color: palette.ink2 }]}>Importa</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          <TouchableOpacity
            onPress={() => setFilterCategory(null)}
            style={[
              styles.chip,
              {
                backgroundColor:
                  filterCategory === null ? palette.accent : palette.surface,
                borderColor:
                  filterCategory === null ? palette.accent : palette.hairline,
              },
            ]}
          >
            <Text
              style={[
                styles.chipText,
                { color: filterCategory === null ? palette.onAccent : palette.ink2 },
              ]}
            >
              Tutte
            </Text>
          </TouchableOpacity>

          {categories.map((category) => {
            const selected = filterCategory === category.id;
            const color = categoryColor(category.color, dark);
            return (
              <TouchableOpacity
                key={category.id}
                onPress={() => setFilterCategory(selected ? null : category.id)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: selected ? tint(color, dark) : palette.surface,
                    borderColor: selected ? color : palette.hairline,
                  },
                ]}
              >
                <Icon name={category.icon} size={13} color={color} />
                <Text
                  style={[
                    styles.chipText,
                    { color: selected ? palette.ink : palette.ink2 },
                  ]}
                >
                  {category.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <SectionList
        ref={scrollRestoration.ref}
        onScroll={scrollRestoration.onScroll}
        onContentSizeChange={scrollRestoration.onContentSizeChange}
        scrollEventThrottle={scrollRestoration.scrollEventThrottle}
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHead}>
            <Text style={[styles.dayLabel, { color: palette.ink3 }]}>
              {section.title}
            </Text>
            <Text style={[styles.dayTotal, { color: palette.ink3 }]}>
              {formatAmount(section.total)}
            </Text>
          </View>
        )}
        renderItem={({ item }) => (
          <PaymentRow
            payment={item}
            category={categoryById(item.category_id)}
            onPress={() => explorer.openPayment(item)}
          />
        )}
        ListEmptyComponent={
          error ? (
            <LoadError message={error} onRetry={reload} />
          ) : (
            <Text style={[styles.empty, { color: palette.ink3 }]}>
              {filtering
                ? "Nessuna spesa corrisponde ai filtri."
                : `Nessuna spesa in ${monthName(month)}.`}
            </Text>
          )
        }
      />

      {explorer.overlay}
    </>
  );
}

/**
 * L'elenco introiti, con modifica/eliminazione al tocco sulla riga.
 *
 * L'aggiunta non vive piu' qui: e' il tasto centrale della tabbar, coerente
 * col resto dell'app — una schermata di elenco ha un solo gesto primario, e
 * qui era gia' quello che aggiungeva confusione quando conviveva con
 * l'aggiunta spese sulla stessa tabbar.
 */
function IncomeList({ month }: { month: Date }) {
  const { palette } = useTheme();
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const scrollRestoration = useScrollRestoration("movements-income");

  const [editing, setEditing] = useState<Income | null>(null);
  /** Mese a cui appartengono le righe attualmente in elenco. */
  const meseInElenco = useRef<string | null>(null);

  const load = useCallback(async () => {
    const { start, end } = monthRange(month);
    const chiave = `${month.getFullYear()}-${month.getMonth()}`;
    const { data, error: failure } = await supabase
      .from("incomes")
      .select("*")
      .gte("occurred_at", start.toISOString())
      .lt("occurred_at", end.toISOString())
      .order("occurred_at", { ascending: false });
    setError(failure?.message ?? null);

    if (!failure) {
      setIncomes((data ?? []) as Income[]);
      meseInElenco.current = chiave;
      return;
    }

    // Lettura fallita: le righe gia' in pagina si tengono **solo** se sono di
    // questo mese. Sono vecchie, non false — e "vecchie ma vere" vale finche'
    // l'etichetta del periodo non cambia, che e' la stessa regola con cui
    // `usePayments` azzera il mese precedente. Senza, passando da Agosto a
    // Settembre con la rete giu' restavano elencati stipendio e ricavi di
    // agosto sotto l'intestazione "Settembre": il totale spariva, l'avviso
    // non compariva mai (l'elenco non era vuoto, quindi `LoadError` non
    // veniva mai raggiunto) e l'unico segnale era la data dentro la riga.
    if (meseInElenco.current !== chiave) {
      setIncomes([]);
      meseInElenco.current = null;
    }
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const total = incomes.reduce((sum, i) => sum + Number(i.amount), 0);

  // Lo stato: quanto e' entrato nel mese. Su schermo largo va a sinistra, dove
  // sta l'importo grande in ogni altra schermata dell'app.
  const hero = !error ? (
    <View style={styles.incomeHero}>
      <Text style={[styles.label, { color: palette.ink3 }]}>
        Entrato nel mese
      </Text>
      <Text style={[styles.hero, { color: palette.good }]}>
        {formatAmount(total)}
      </Text>
    </View>
  ) : null;

  // La lettura: l'elenco degli introiti, a destra. Quando l'elenco c'e'
  // ancora ma l'ultima lettura e' fallita, l'avviso va **sopra** le righe
  // (`variant="inline"`): sono di questo mese e restano vere, ma dire che
  // sono aggiornate non lo sarebbe.
  const list =
    incomes.length > 0 ? (
      <View style={{ gap: space.sm }}>
        {error && <LoadError message={error} onRetry={load} variant="inline" />}
        <View
          style={[
            styles.card,
            { backgroundColor: palette.surface, borderColor: palette.hairline },
          ]}
        >
          {incomes.map((entry, index) => (
            <View key={entry.id}>
              {index > 0 && (
                <View
                  style={[styles.divider, { backgroundColor: palette.hairline }]}
                />
              )}
              <TouchableOpacity
                style={styles.entryRow}
                onPress={() => setEditing(entry)}
                accessibilityRole="button"
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.entryLabel, { color: palette.ink }]}>
                    {entry.label}
                  </Text>
                  <Text style={[styles.entryMeta, { color: palette.ink3 }]}>
                    {shortDateTime(entry.occurred_at)}
                  </Text>
                </View>
                <Text style={[styles.entryAmount, { color: palette.good }]}>
                  +{formatAmount(entry.amount)}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </View>
    ) : error ? (
      <LoadError message={error} onRetry={load} />
    ) : (
      <Text style={[styles.empty, { color: palette.ink3 }]}>
        Nessun introito in {monthName(month)}. Tocca + per aggiungere lo
        stipendio o un ricavo.
      </Text>
    );

  return (
    <>
      <ScrollView
        ref={scrollRestoration.ref}
        onScroll={scrollRestoration.onScroll}
        onContentSizeChange={scrollRestoration.onContentSizeChange}
        scrollEventThrottle={scrollRestoration.scrollEventThrottle}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Stesso taglio della meta' Uscite: stato a sinistra, lettura a
            destra. Si affianca solo quando ci sono davvero due cose da
            affiancare — con un errore o un mese vuoto la colonna sinistra
            resterebbe vuota e il messaggio finirebbe spinto di lato, mentre
            deve prendersi la pagina. Qui sinistra e destra sono gia'
            nell'ordine verticale di sempre, quindi `order` non serve: se un
            giorno una sezione cambiasse colonna, andrebbe aggiunto. */}
        {hero && incomes.length > 0 ? (
          <TwoColumns left={hero} right={list} />
        ) : (
          <>
            {hero}
            {list}
          </>
        )}
      </ScrollView>

      <EditIncomeSheet
        income={editing}
        onClose={() => setEditing(null)}
        onSaved={load}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  head: { paddingHorizontal: space.lg, paddingTop: space.lg, gap: space.sm },
  seg: { flexDirection: "row", borderRadius: radius.pill, padding: 3 },
  segItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  segText: { ...type.bodyMedium, fontSize: 13 },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.md,
    paddingVertical: 4,
  },
  month: { ...type.caption, fontWeight: "500", textTransform: "capitalize" },
  stale: { paddingHorizontal: space.lg, paddingTop: space.sm },
  filters: { paddingHorizontal: space.lg, gap: space.sm, paddingTop: space.sm, paddingBottom: space.sm },
  searchRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: radius.field,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  importButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.field,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  importText: { ...type.caption, fontWeight: "500" },
  searchInput: { flex: 1, ...type.body, padding: 0 },
  chipRow: { gap: 7, paddingRight: space.lg },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipText: { ...type.caption, fontWeight: "500" },
  list: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.xxl, gap: space.lg },
  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginTop: space.md,
    marginBottom: 4,
  },
  dayLabel: { ...type.label },
  dayTotal: { ...type.small, fontVariant: ["tabular-nums"] },
  empty: { ...type.body, textAlign: "center", marginTop: space.xxl, lineHeight: 20 },

  incomeHero: { marginBottom: space.xs },
  label: { ...type.label, marginBottom: space.sm },
  hero: { ...type.hero, fontSize: 34, fontVariant: ["tabular-nums"] },
  card: { borderRadius: radius.card, borderWidth: 1, paddingHorizontal: space.lg },
  divider: { height: 1 },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    gap: space.md,
  },
  entryLabel: { ...type.body },
  entryMeta: { ...type.small, marginTop: 2 },
  entryAmount: { ...type.amount, fontVariant: ["tabular-nums"] },
});
