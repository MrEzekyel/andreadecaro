import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { CategoryDonut, DonutSlice } from "../components/CategoryDonut";
import { useExplorer } from "../components/Explorer";
import { Icon } from "../components/Icon";
import { LoadError } from "../components/LoadError";
import { MonthCheck } from "../components/MonthCheck";
import { StaleNote } from "../components/StaleNote";
import { LimitCard } from "../components/LimitCard";
import { MonthYearPicker } from "../components/MonthYearPicker";
import { PaymentRow } from "../components/PaymentRow";
import { RecurringSummary } from "../components/RecurringSummary";
import { SavingsSummary } from "../components/SavingsSummary";
import { TrendChart, TrendPoint } from "../components/TrendChart";
import { useChangelog } from "../lib/changelog";
import { useData } from "../lib/DataContext";
import { useNav } from "../lib/NavContext";
import { useTheme } from "../lib/ThemeContext";
import {
  formatAmount,
  monthName,
  monthTitle,
  percentChange,
  splitAmount,
} from "../lib/format";
import { categoryColor, radius, space, type } from "../lib/theme";
import { Merchant } from "../lib/types";
import { supabase } from "../lib/supabase";
import { useLimits } from "../lib/useLimits";
import {
  comparisonCutoff,
  isCurrentMonth,
  monthRange,
  usePayments,
} from "../lib/usePayments";
import { useSubscription } from "../lib/useSubscription";

/** Sotto questa soglia il trial merita un avviso, non solo la voce in Impostazioni. */
const TRIAL_WARNING_DAYS = 7;

export default function HomeScreen() {
  const { palette, dark } = useTheme();
  const { categoryById } = useData();
  const { openSettings } = useNav();

  const [month, setMonth] = useState(() => new Date());
  const [pickerOpen, setPickerOpen] = useState(false);
  const { payments, total, previousTotal, error, staleLabel, staleReason, reload } =
    usePayments(month);
  const { monthlyOverall, alerts, reload: reloadLimits } = useLimits();
  const { profile: subscriptionProfile, automationActive, trialDaysLeft } =
    useSubscription();
  const { unread: unreadNews } = useChangelog();
  const [refreshing, setRefreshing] = useState(false);
  const explorer = useExplorer(reload);

  const [recurring, setRecurring] = useState({ count: 0, monthlyTotal: 0 });

  // Le rate configurate non dipendono dal mese guardato: cambiano solo
  // quando le regole cambiano, non quando si sfoglia il calendario.
  const loadRecurring = useCallback(async () => {
    const { data, error } = await supabase
      .from("recurring_rules")
      .select("amount")
      .eq("active", true)
      .eq("frequency", "monthly");

    if (error) return;
    setRecurring({
      count: (data ?? []).length,
      monthlyTotal: (data ?? []).reduce((sum, r) => sum + Number(r.amount), 0),
    });
  }, []);

  useEffect(() => {
    loadRecurring();
  }, [loadRecurring]);

  // Serve solo a riconoscere mutuo/rate marcati come costi fissi, per dare
  // all'andamento cumulato la stessa baseline usata in Statistiche: non
  // dipende dal mese guardato, come le regole ricorrenti sopra.
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [merchantsUnknown, setMerchantsUnknown] = useState(false);

  const loadMerchants = useCallback(async () => {
    const { data, error } = await supabase.from("merchants").select("*");
    // Senza gli esercenti non si sa piu' quali spese sono costi fissi, e
    // l'andamento cumulato perderebbe la sua linea di partenza facendo saltare
    // il mutuo il giorno in cui e' registrato. Nessun numero diventa falso, ma
    // il grafico cambia forma: meglio dirlo che lasciarlo intuire.
    setMerchantsUnknown(Boolean(error));
    if (!error) setMerchants((data ?? []) as Merchant[]);
  }, []);

  useEffect(() => {
    loadMerchants();
  }, [loadMerchants]);

  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [monthlyInvested, setMonthlyInvested] = useState(0);
  // "Risparmiato" e' una sottrazione fra tre numeri: se anche uno solo non
  // arriva, il risultato e' un importo inventato. Meglio non mostrare il
  // riquadro che mostrarlo sbagliato.
  const [balanceError, setBalanceError] = useState(false);

  // A differenza delle rate ricorrenti, introiti e investimenti sono
  // legati al mese guardato: cambiano sfogliando il calendario.
  const loadBalance = useCallback(async () => {
    const { start, end } = monthRange(month);
    const [incomeResult, investResult] = await Promise.all([
      supabase
        .from("incomes")
        .select("amount")
        .gte("occurred_at", start.toISOString())
        .lt("occurred_at", end.toISOString()),
      supabase
        .from("investments")
        .select("amount")
        // "Investito questo mese" sono i soldi usciti dal conto per comprare:
        // vendite e dividendi sono denaro che rientra, e un ordine ancora da
        // eseguire non ha comprato niente.
        .eq("kind", "buy")
        .eq("status", "settled")
        .gte("occurred_at", start.toISOString())
        .lt("occurred_at", end.toISOString()),
    ]);

    const failed = Boolean(incomeResult.error || investResult.error);
    setBalanceError(failed);
    if (failed) return;

    setMonthlyIncome(
      (incomeResult.data ?? []).reduce((sum, r) => sum + Number(r.amount), 0)
    );
    setMonthlyInvested(
      (investResult.data ?? []).reduce((sum, r) => sum + Number(r.amount), 0)
    );
  }, [month]);

  useEffect(() => {
    loadBalance();
  }, [loadBalance]);

  // I limiti valgono sempre sul periodo corrente: mostrarli mentre si
  // sfoglia un mese passato darebbe un confronto senza senso.
  const viewingCurrentMonth = isCurrentMonth(month);

  const byCategory = useMemo(() => {
    const map = new Map<string | null, number>();
    for (const payment of payments) {
      const key = payment.category_id;
      map.set(key, (map.get(key) ?? 0) + Number(payment.effective_amount));
    }
    return Array.from(map.entries())
      .map(([id, amount]) => ({ id, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [payments]);

  const slices = useMemo<DonutSlice[]>(
    () =>
      byCategory.map(({ id, amount }) => {
        const category = categoryById(id);
        return {
          id,
          label: category?.name ?? "Da categorizzare",
          value: amount,
          color: category
            ? categoryColor(category.color, dark)
            : palette.uncategorized,
          icon: category?.icon ?? "circle-help",
        };
      }),
    [byCategory, categoryById, dark, palette.uncategorized]
  );

  const excludedMerchantIds = useMemo(
    () => new Set(merchants.filter((m) => m.excluded_from_stats).map((m) => m.id)),
    [merchants]
  );

  const isFixedCost = useCallback(
    (payment: (typeof payments)[number]) =>
      payment.excluded_from_stats ||
      Boolean(payment.merchant_id && excludedMerchantIds.has(payment.merchant_id)),
    [excludedMerchantIds]
  );

  // Home non ha il toggle "escludi costi fissi": mutuo e rate contano sempre
  // nel totale. Ma nel grafico non devono comparire il giorno in cui sono
  // stati registrati come se fossero una spesa qualunque — sono un impegno
  // certo fin dall'inizio del mese, non qualcosa che "arriva" quel giorno.
  const fixedCostsTotal = useMemo(() => {
    const variable = payments
      .filter((p) => !isFixedCost(p))
      .reduce((sum, p) => sum + Number(p.effective_amount), 0);
    return total - variable;
  }, [payments, isFixedCost, total]);

  /** Spesa cumulata giorno per giorno, fino a oggi se il mese e' in corso. */
  const trend = useMemo<TrendPoint[]>(() => {
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const elapsed = viewingCurrentMonth ? new Date().getDate() : days;

    const perDay = new Array(days).fill(0);
    for (const payment of payments) {
      if (isFixedCost(payment)) continue;
      const day = new Date(payment.occurred_at).getDate();
      perDay[day - 1] += Number(payment.effective_amount);
    }

    // Si emettono tutti i giorni del mese, non solo quelli passati: i giorni
    // futuri valgono `null` e danno al grafico la larghezza del mese intero,
    // cosi' la linea si ferma dov'e' oggi invece di stiracchiarsi fino al
    // bordo destro facendo sembrare finito un mese appena cominciato. La
    // linea parte gia' dal totale dei costi fissi invece che da zero.
    const points: TrendPoint[] = [];
    let running = fixedCostsTotal;
    for (let i = 0; i < days; i++) {
      if (i < elapsed) running += perDay[i];
      points.push({ label: String(i + 1), value: i < elapsed ? running : null });
    }
    return points;
  }, [payments, month, viewingCurrentMonth, isFixedCost, fixedCostsTotal]);

  const limitAmount =
    viewingCurrentMonth && monthlyOverall
      ? Number(monthlyOverall.limit.amount)
      : null;

  const delta = percentChange(total, previousTotal);
  const previousMonth = new Date(month.getFullYear(), month.getMonth() - 1, 1);
  const cutoff = comparisonCutoff(month);
  const deltaLabel = viewingCurrentMonth
    ? `su ${monthName(previousMonth)} 1–${cutoff}`
    : `su ${monthName(previousMonth)}`;

  const recent = payments.slice(0, 5);
  const amount = splitAmount(total);

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([
      reload(),
      reloadLimits(),
      loadRecurring(),
      loadBalance(),
      loadMerchants(),
    ]);
    setRefreshing(false);
  }

  if (explorer.isOpen) return <>{explorer.overlay}</>;

  return (
    <>
      <ScrollView
        style={{ backgroundColor: palette.ground }}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.head}>
          <TouchableOpacity
            style={styles.headPair}
            activeOpacity={0.6}
            onPress={() => setPickerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`${monthTitle(month)} ${month.getFullYear()}`}
            accessibilityHint="Apre il selettore di mese e anno"
          >
            <Text style={[styles.title, { color: palette.ink }]}>
              {monthTitle(month)}
            </Text>
            <Text style={[styles.year, { color: palette.ink3 }]}>
              {month.getFullYear()}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => openSettings("root")}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel={
              unreadNews ? "Impostazioni, ci sono novità" : "Impostazioni"
            }
          >
            <Icon name="sliders-horizontal" size={19} color={palette.ink3} />
            {/* Un changelog che sta solo dentro Impostazioni non lo apre
                nessuno, ed e' proprio il punto di avere aggiornamenti
                frequenti e non farlo sapere. */}
            {unreadNews && (
              <View style={[styles.newsDot, { borderColor: palette.ground, backgroundColor: palette.accent }]} />
            )}
          </TouchableOpacity>
        </View>

        {/* Due casi. Senza niente in memoria il totale direbbe "0,00 €" e
            sarebbe un'affermazione falsa: l'errore prende tutto il posto. Con
            i dati del mese ancora in memoria — `usePayments` li tiene apposta —
            nasconderli sarebbe l'errore opposto: sono vecchi, non falsi. */}
        {error && payments.length === 0 ? (
          <LoadError message={error} onRetry={onRefresh} />
        ) : (
          <>
            {error && (
              <LoadError message={error} onRetry={onRefresh} variant="inline" />
            )}

            {/* Terzo stato, fra il dato fresco e l'errore: i numeri sotto sono
                veri, solo non di adesso. */}
            {staleLabel && <StaleNote label={staleLabel} reason={staleReason} onRetry={onRefresh} />}

        <View>
          <Text style={[styles.label, { color: palette.ink3 }]}>
            {viewingCurrentMonth ? "Speso questo mese" : "Speso nel mese"}
          </Text>
          <Text style={[styles.hero, { color: palette.ink }]}>
            {amount.whole}
            <Text style={[styles.heroCents, { color: palette.ink3 }]}>
              {amount.cents}
            </Text>
          </Text>

          <View style={styles.heroFoot}>
            <Text style={[styles.heroMeta, { color: palette.ink2 }]}>
              {payments.length} {payments.length === 1 ? "spesa" : "spese"}
            </Text>

            {delta !== null && (
              <View style={styles.delta}>
                <Icon
                  name={delta >= 0 ? "trending-up" : "trending-down"}
                  size={13}
                  color={delta >= 0 ? palette.over : palette.good}
                />
                <Text
                  style={[
                    styles.deltaValue,
                    { color: delta >= 0 ? palette.over : palette.good },
                  ]}
                >
                  {delta >= 0 ? "+" : "−"}
                  {Math.abs(Math.round(delta))}%
                </Text>
                <Text style={[styles.deltaNote, { color: palette.ink3 }]}>
                  {deltaLabel}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Solo sul mese corrente: sfogliando l'archivio la domanda sul mese
            scorso sarebbe fuori posto. */}
        {viewingCurrentMonth && <MonthCheck onReview={setMonth} />}

        {/* Non legato al mese guardato: l'abbonamento e' un fatto
            dell'account, non del periodo che si sta sfogliando. Il segnale
            deve arrivare da qui, prima che dalla notifica di errore della
            Shortcut — nessuno apre le notifiche dell'automazione per capire
            perche' ha smesso di funzionare. */}
        {automationActive === false ? (
          <TouchableOpacity
            style={[styles.alert, { backgroundColor: `${palette.over}1f` }]}
            onPress={() => openSettings("subscription")}
          >
            <Icon name="triangle-alert" size={16} color={palette.over} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.alertTitle, { color: palette.ink }]}>
                Automazione ferma
              </Text>
              <Text style={[styles.alertBody, { color: palette.ink2 }]}>
                La prova gratuita è finita. Storico e statistiche restano
                come sempre — riattivala per tornare a registrare le spese
                Apple Pay da sola.
              </Text>
            </View>
          </TouchableOpacity>
        ) : (
          subscriptionProfile?.subscription_status === "trialing" &&
          trialDaysLeft !== null &&
          trialDaysLeft <= TRIAL_WARNING_DAYS && (
            <TouchableOpacity
              style={[styles.alert, { backgroundColor: `${palette.warn}1f` }]}
              onPress={() => openSettings("subscription")}
            >
              <Icon name="triangle-alert" size={16} color={palette.warn} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.alertTitle, { color: palette.ink }]}>
                  Automazione, ultimi giorni di prova
                </Text>
                <Text style={[styles.alertBody, { color: palette.ink2 }]}>
                  {trialDaysLeft <= 0
                    ? "Ultimo giorno gratis."
                    : `Ancora ${trialDaysLeft} giorn${trialDaysLeft === 1 ? "o" : "i"} gratis.`}{" "}
                  Poi 1,99 €/mese o 15 €/anno per continuare.
                </Text>
              </View>
            </TouchableOpacity>
          )
        )}

        {!balanceError && (monthlyIncome > 0 || monthlyInvested > 0) && (
          <View>
            <Text style={[styles.label, { color: palette.ink3 }]}>
              Bilancio del mese
            </Text>
            <SavingsSummary
              income={monthlyIncome}
              expenses={total}
              invested={monthlyInvested}
            />
          </View>
        )}

        {viewingCurrentMonth &&
          alerts.map((status) => {
            const category = categoryById(status.limit.category_id);
            const scope = category ? category.name : "complessivo";
            const over = status.level === "over";
            const tone = over ? palette.over : palette.warn;

            return (
              <View
                key={`alert-${status.limit.id}`}
                style={[styles.alert, { backgroundColor: `${tone}1f` }]}
              >
                <Icon name="triangle-alert" size={16} color={tone} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.alertTitle, { color: palette.ink }]}>
                    {over
                      ? `Limite ${scope} superato`
                      : `Limite ${scope} quasi raggiunto`}
                  </Text>
                  <Text style={[styles.alertBody, { color: palette.ink2 }]}>
                    {formatAmount(status.spent)} di{" "}
                    {formatAmount(Number(status.limit.amount))}
                    {over
                      ? ` — superato di ${formatAmount(-status.remaining)}.`
                      : ` — restano ${formatAmount(status.remaining)}.`}
                  </Text>
                </View>
              </View>
            );
          })}

        {viewingCurrentMonth && monthlyOverall && (
          <LimitCard
            status={monthlyOverall}
            plain
            onPress={() => openSettings("limits")}
          />
        )}

        {trend.length > 1 && (
          <View>
            <Text style={[styles.label, { color: palette.ink3 }]}>Andamento</Text>
            <TrendChart
              points={trend}
              limit={limitAmount}
              baseline={fixedCostsTotal}
              color={palette.accent}
            />
            {merchantsUnknown && (
              <Text style={[styles.chartNote, { color: palette.ink3 }]}>
                I costi fissi non sono stati riconosciuti: la linea parte da
                zero invece che dal loro totale.
              </Text>
            )}
          </View>
        )}

        {slices.length > 0 && (
          <View>
            <Text style={[styles.label, { color: palette.ink3 }]}>
              Ripartizione
            </Text>
            <CategoryDonut
              slices={slices}
              centerLabel={monthTitle(month).toLowerCase()}
              onSelect={(slice) =>
                explorer.openDetail({
                  kind: "category",
                  id: slice.id,
                  title: slice.label,
                  month,
                })
              }
            />

            <View style={{ marginTop: space.lg }}>
              <RecurringSummary
                count={recurring.count}
                monthlyTotal={recurring.monthlyTotal}
                monthTotal={total}
                onPress={() => openSettings("recurring")}
              />
            </View>
          </View>
        )}

        {recent.length > 0 && (
          <View>
            <Text style={[styles.label, { color: palette.ink3 }]}>
              Ultime spese
            </Text>
            {recent.map((payment) => (
              <PaymentRow
                key={payment.id}
                payment={payment}
                category={categoryById(payment.category_id)}
                onPress={() => explorer.openPayment(payment)}
              />
            ))}
          </View>
        )}

        {payments.length === 0 && (
          <Text style={[styles.empty, { color: palette.ink3 }]}>
            Nessuna spesa in questo mese. I pagamenti Apple Pay entrano da
            soli una volta configurata l'automazione; contanti, bonifici e
            addebiti diretti si aggiungono a mano o con Siri.
          </Text>
        )}
          </>
        )}
      </ScrollView>

      <MonthYearPicker
        visible={pickerOpen}
        value={month}
        onSelect={setMonth}
        onClose={() => setPickerOpen(false)}
      />

      {explorer.overlay}
    </>
  );
}

const styles = StyleSheet.create({
  chartNote: { ...type.small, fontSize: 10.5, lineHeight: 15, marginTop: space.sm },
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.xl },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: space.sm,
  },
  headPair: { flexDirection: "row", alignItems: "baseline", gap: space.sm },
  title: { ...type.title, fontSize: 27, letterSpacing: -0.3 },
  year: { ...type.body, fontWeight: "500" },
  label: { ...type.label, marginBottom: space.sm },
  hero: { ...type.hero, fontVariant: ["tabular-nums"] },
  heroCents: { ...type.heroCents },
  heroFoot: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: space.sm,
    marginTop: space.sm,
  },
  heroMeta: { ...type.caption },
  delta: { flexDirection: "row", alignItems: "center", gap: 4 },
  deltaValue: {
    ...type.caption,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  deltaNote: { ...type.small, fontSize: 10.5 },
  empty: { ...type.body, textAlign: "center", marginTop: space.xl, lineHeight: 21 },
  alert: {
    flexDirection: "row",
    gap: 11,
    alignItems: "flex-start",
    borderRadius: radius.card,
    padding: space.lg,
  },
  newsDot: {
    position: "absolute",
    top: -2,
    right: -3,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    borderWidth: 1.5,
  },
  alertTitle: { ...type.bodyMedium, fontSize: 12.5, marginBottom: 3 },
  alertBody: { ...type.small, lineHeight: 17 },
});
