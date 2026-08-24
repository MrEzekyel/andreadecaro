import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { BalanceChart, BalancePoint } from "../components/BalanceChart";
import { CategoryDonut, DonutSlice } from "../components/CategoryDonut";
import { CategoryLimitRow } from "../components/CategoryLimitRow";
import { useExplorer } from "../components/Explorer";
import { FlowCompare } from "../components/FlowCompare";
import { Icon } from "../components/Icon";
import { LoadError } from "../components/LoadError";
import {
  MonthBar,
  MonthBars,
  MonthBarsFooter,
  monthBarsAverage,
} from "../components/MonthBars";
import { MonthCheck } from "../components/MonthCheck";
import { StaleNote } from "../components/StaleNote";
import { MonthYearPicker } from "../components/MonthYearPicker";
import { PaymentRow } from "../components/PaymentRow";
import { RecurringSummary, UpcomingRule } from "../components/RecurringSummary";
import { SemiGauge } from "../components/SemiGauge";
import { TrendChart, TrendPoint } from "../components/TrendChart";
import { useChangelog } from "../lib/changelog";
import { useData } from "../lib/DataContext";
import { MoneyMode } from "../lib/moneyMode";
import { useNav } from "../lib/NavContext";
import { useTheme } from "../lib/ThemeContext";
import {
  compactAmount,
  dayLabel,
  formatAmount,
  monthAbbr,
  monthName,
  monthTitle,
  percentChange,
  splitAmount,
} from "../lib/format";
import { categoryColor, radius, space, type } from "../lib/theme";
import { Merchant, RecurringRule } from "../lib/types";
import { supabase } from "../lib/supabase";
import { useLimits } from "../lib/useLimits";
import { goalVerdict, resolveCeilings } from "../lib/savings";
import {
  comparisonCutoff,
  isCurrentMonth,
  monthRange,
  usePayments,
} from "../lib/usePayments";
import { useSubscription } from "../lib/useSubscription";

/** Sotto questa soglia il trial merita un avviso, non solo la voce in Impostazioni. */
const TRIAL_WARNING_DAYS = 7;

/** Quanti mesi indietro leggere per i due grafici a barre. */
const MESI_STORICI = 12;

/** Una riga di `monthly_totals`, l'RPC che aggrega i mesi lato database. */
type MonthTotal = {
  month: string;
  spese: number;
  introiti: number;
  investito: number;
};

/** Introito del mese, con la data che serve al saldo giorno per giorno. */
type IncomeRow = { amount: number; label: string; occurred_at: string };

/** Acquisto eseguito nel mese: anche qui la data serve al saldo. */
type InvestmentRow = { amount: number; occurred_at: string };

/**
 * Gradazioni di verde per le fonti di introito.
 *
 * Non i colori delle categorie di spesa: le fonti devono restare leggibili
 * come "entrata" a colpo d'occhio, e un rosa o un blu accanto al verde
 * romperebbe quella lettura prima ancora di dire quale fonte e'.
 */
const INCOME_SHADES = ["#16a34a", "#22c55e", "#4ade80", "#86efac", "#bbf7d0"];

type Props = {
  /** Uscite/Entrate: controllato dall'alto e non locale, perche' il tasto
   *  centrale della tabbar deve sapere quale delle due sta guardando la
   *  Home per decidere se aggiunge una spesa o un introito — la stessa
   *  ragione per cui la scheda Movimenti lo riceve come prop. */
  mode: MoneyMode;
  onModeChange: (mode: MoneyMode) => void;
};

export default function HomeScreen({ mode, onModeChange }: Props) {
  const { palette, dark } = useTheme();
  const { categoryById } = useData();
  const { openSettings, openAddIncome } = useNav();
  const { width: windowWidth } = useWindowDimensions();
  // Il semicerchio riempie la larghezza disponibile del contenuto invece di
  // una misura fissa: su schermi piccoli non deve traboccare, su schermi
  // grandi non deve restare piccolo in mezzo a spazio vuoto.
  const gaugeWidth = Math.min(windowWidth - space.lg * 2, 340);

  const [month, setMonth] = useState(() => new Date());
  const [pickerOpen, setPickerOpen] = useState(false);
  const { payments, total, previousTotal, error, staleLabel, staleReason, reload } =
    usePayments(month);
  const {
    monthlyOverall,
    weeklyOverall,
    categoryLimits,
    alerts,
    goal,
    conflicts,
    reload: reloadLimits,
  } = useLimits();
  const { profile: subscriptionProfile, automationActive, trialDaysLeft } =
    useSubscription();
  const { unread: unreadNews } = useChangelog();
  const [refreshing, setRefreshing] = useState(false);
  const explorer = useExplorer(reload);

  const [recurring, setRecurring] = useState<{
    count: number;
    monthlyTotal: number;
    upcoming: UpcomingRule[];
  }>({ count: 0, monthlyTotal: 0, upcoming: [] });

  // Le rate configurate non dipendono dal mese guardato: cambiano solo
  // quando le regole cambiano, non quando si sfoglia il calendario.
  // Si leggono tutte le regole attive (non solo le mensili) perche' i
  // prossimi addebiti includono anche rate settimanali e annuali; il
  // totale "al mese" resta calcolato sulle sole mensili, per non
  // spacciare una rata annuale come un impegno di ogni mese.
  const loadRecurring = useCallback(async () => {
    const { data, error } = await supabase
      .from("recurring_rules")
      .select("id,label,amount,frequency,next_run_on")
      .eq("active", true)
      .order("next_run_on", { ascending: true });

    if (error) return;
    const rules = (data ?? []) as Pick<
      RecurringRule,
      "id" | "label" | "amount" | "frequency" | "next_run_on"
    >[];
    setRecurring({
      count: rules.length,
      monthlyTotal: rules
        .filter((r) => r.frequency === "monthly")
        .reduce((sum, r) => sum + Number(r.amount), 0),
      upcoming: rules.slice(0, 3),
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

  const [incomes, setIncomes] = useState<IncomeRow[]>([]);
  const [investments, setInvestments] = useState<InvestmentRow[]>([]);
  // "Bilancio" e' una sottrazione fra tre numeri: se anche uno solo non
  // arriva, il risultato e' un importo inventato. Meglio non mostrare il
  // riquadro che mostrarlo sbagliato.
  const [balanceError, setBalanceError] = useState(false);

  // A differenza delle rate ricorrenti, introiti e investimenti sono
  // legati al mese guardato: cambiano sfogliando il calendario. Degli
  // introiti serve anche `label` e `occurred_at`: il primo divide l'anello
  // per fonte, il secondo disegna i gradini del saldo giorno per giorno.
  const loadBalance = useCallback(async () => {
    const { start, end } = monthRange(month);
    const [incomeResult, investResult] = await Promise.all([
      supabase
        .from("incomes")
        .select("amount,label,occurred_at")
        // I rimborsi restano in elenco ma **non** contano come introito: sono
        // denaro tornato indietro, non guadagnato. Contarli qui gonfia gli
        // introiti del mese e con loro l'avanzo, ed e' esattamente il numero
        // su cui si decide quanto si puo' spendere.
        .eq("is_reimbursement", false)
        .gte("occurred_at", start.toISOString())
        .lt("occurred_at", end.toISOString()),
      supabase
        .from("investments")
        .select("amount,occurred_at")
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

    setIncomes((incomeResult.data ?? []) as IncomeRow[]);
    setInvestments((investResult.data ?? []) as InvestmentRow[]);
  }, [month]);

  const monthlyInvested = useMemo(
    () => investments.reduce((sum, row) => sum + Number(row.amount), 0),
    [investments]
  );

  useEffect(() => {
    loadBalance();
  }, [loadBalance]);

  // I totali per mese arrivano gia' aggregati dal database: sommarli qui
  // vorrebbe dire scaricare un anno di pagamenti a ogni apertura della Home.
  const [history, setHistory] = useState<MonthTotal[]>([]);
  // Senza questo, un fallimento di rete su `monthly_totals` faceva sparire
  // "Sui mesi" ed "Entrate mese per mese" senza dire perche' — la stessa
  // classe di difetto gia' chiusa per Flusso (vedi `balanceError`), rimasta
  // aperta qui perche' i due grafici leggono la stessa `history` ma nessuno
  // dei due controllava se la lettura fosse davvero andata a buon fine.
  const [historyError, setHistoryError] = useState(false);

  const loadHistory = useCallback(async () => {
    const { data, error } = await supabase.rpc("monthly_totals", {
      p_months: MESI_STORICI,
    });
    setHistoryError(Boolean(error));
    if (error) return;
    setHistory(
      ((data ?? []) as MonthTotal[]).map((row) => ({
        month: row.month,
        spese: Number(row.spese),
        introiti: Number(row.introiti),
        investito: Number(row.investito),
      }))
    );
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const monthlyIncome = useMemo(
    () => incomes.reduce((sum, row) => sum + Number(row.amount), 0),
    [incomes]
  );

  // I limiti valgono sempre sul periodo corrente: mostrarli mentre si
  // sfoglia un mese passato darebbe un confronto senza senso.
  const viewingCurrentMonth = isCurrentMonth(month);

  const daysInMonth = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0
  ).getDate();
  const elapsedDays = viewingCurrentMonth
    ? Math.min(new Date().getDate(), daysInMonth)
    : daysInMonth;

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

  /** Introiti raggruppati per fonte, per dividere l'anello esterno. */
  const incomeSources = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of incomes) {
      const key = row.label?.trim() || "Altro";
      map.set(key, (map.get(key) ?? 0) + Number(row.amount));
    }
    return Array.from(map.entries())
      .map(([label, amount]) => ({ label, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [incomes]);

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
    const perDay = new Array(daysInMonth).fill(0);
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
    for (let i = 0; i < daysInMonth; i++) {
      if (i < elapsedDays) running += perDay[i];
      points.push({
        label: String(i + 1),
        value: i < elapsedDays ? running : null,
      });
    }
    return points;
  }, [payments, daysInMonth, elapsedDays, isFixedCost, fixedCostsTotal]);

  /** Indici (0-based) dei lunedi' del mese mostrato, escluso il primo giorno
   *  del grafico stesso: sono dove il limite settimanale sul totale si
   *  rinnova, quindi dove "Andamento" disegna la sua linea verticale. */
  const weekBoundaries = useMemo(() => {
    const indexes: number[] = [];
    for (let day = 2; day <= daysInMonth; day++) {
      const weekday = new Date(month.getFullYear(), month.getMonth(), day).getDay();
      if (weekday === 1) indexes.push(day - 1);
    }
    return indexes;
  }, [month, daysInMonth]);

  /**
   * Saldo del mese: sale a ogni introito, scende a ogni spesa e a ogni
   * investimento.
   *
   * Gli investimenti vanno sottratti come le spese: sono soldi che dal conto
   * sono usciti davvero, e lasciarli fuori faceva dire alla linea che restava
   * piu' denaro di quanto ce ne fosse — l'unico verso in cui sbagliare qui e'
   * pericoloso, perche' e' il numero con cui si decide se ci si puo'
   * permettere qualcosa.
   */
  const balanceSeries = useMemo<BalancePoint[]>(() => {
    const inPerDay = new Array(daysInMonth).fill(0);
    const outPerDay = new Array(daysInMonth).fill(0);
    const investPerDay = new Array(daysInMonth).fill(0);

    for (const row of incomes) {
      const day = new Date(row.occurred_at).getDate();
      if (day >= 1 && day <= daysInMonth) inPerDay[day - 1] += Number(row.amount);
    }
    for (const payment of payments) {
      const day = new Date(payment.occurred_at).getDate();
      if (day >= 1 && day <= daysInMonth) {
        outPerDay[day - 1] += Number(payment.effective_amount);
      }
    }
    for (const row of investments) {
      const day = new Date(row.occurred_at).getDate();
      if (day >= 1 && day <= daysInMonth) {
        investPerDay[day - 1] += Number(row.amount);
      }
    }

    const points: BalancePoint[] = [];
    let running = 0;
    for (let i = 0; i < elapsedDays; i++) {
      running += inPerDay[i] - outPerDay[i] - investPerDay[i];
      points.push({
        day: i + 1,
        value: running,
        income: inPerDay[i] > 0 ? inPerDay[i] : undefined,
        invested: investPerDay[i] > 0 ? investPerDay[i] : undefined,
      });
    }
    return points;
  }, [incomes, payments, investments, daysInMonth, elapsedDays]);

  /** Ultimi sei mesi di spesa, per la carta di confronto. */
  const spesaBars = useMemo<MonthBar[]>(
    () =>
      history.slice(-6).map((row) => ({
        label: monthAbbr(new Date(`${row.month}T00:00:00`)),
        value: row.spese,
      })),
    [history]
  );

  /** Introiti dei mesi dell'anno in corso, per la scheda Entrate. */
  const introitiBars = useMemo<MonthBar[]>(() => {
    const year = new Date().getFullYear();
    return history
      .filter((row) => new Date(`${row.month}T00:00:00`).getFullYear() === year)
      .map((row) => ({
        label: monthAbbr(new Date(`${row.month}T00:00:00`)),
        value: row.introiti,
      }));
  }, [history]);

  const limitAmount =
    viewingCurrentMonth && monthlyOverall
      ? Number(monthlyOverall.limit.amount)
      : null;

  /**
   * Le due soglie di spesa del mese in corso, risolte in scala + vincolo.
   *
   * L'obiettivo di risparmio non e' un secondo tipo di grafico: risparmiare
   * 1.000 su 2.000 di entrate *e'* un tetto di spesa da 1.000, quindi vive
   * sullo stesso arco del limite. Quando ci sono entrambi la scala prende il
   * piu' largo (cosi' l'arco non nasce gia' pieno e la tacca ha dove stare) e
   * "restano" segue il piu' stretto — vedi `resolveCeilings`.
   *
   * Solo sul mese in corso: su un mese chiuso un tetto non ha piu' senso, li'
   * si mostra il verdetto (obiettivo centrato o mancato di quanto).
   */
  const ceilings = useMemo(
    () => resolveCeilings(limitAmount, viewingCurrentMonth ? goal : null),
    [limitAmount, viewingCurrentMonth, goal]
  );

  // Senza un limite mensile configurato il semicerchio spariva del tutto:
  // "niente da mostrare" invece di "nessun budget impostato, ma ecco come
  // stai andando rispetto a quanto guadagni". Il guadagnato del mese prende
  // il posto del limite come scala — non è un budget, ma è comunque il
  // riferimento più onesto disponibile quando non ce n'è uno vero.
  const fallbackLimitAmount =
    viewingCurrentMonth && !ceilings && monthlyIncome > 0 ? monthlyIncome : null;

  /**
   * Com'e' finito un mese gia' chiuso rispetto all'obiettivo.
   *
   * `balanceError` e' la condizione che conta: se introiti e investimenti non
   * si sono caricati, `monthlyIncome` vale 0 e il verdetto direbbe "obiettivo
   * mancato di tutto" per una lettura fallita, non per come e' andato il
   * mese. E' la stessa regola per cui `MonthCheck` non compare quando il
   * totale non e' stato letto. Senza introiti registrati non c'e' nessun
   * risparmio da calcolare, quindi niente verdetto invece di uno inventato.
   */
  const verdict = useMemo(() => {
    if (viewingCurrentMonth || !goal || balanceError) return null;
    if (monthlyIncome <= 0) return null;
    return goalVerdict(goal, monthlyIncome, total);
  }, [viewingCurrentMonth, goal, balanceError, monthlyIncome, total]);

  // A questo ritmo, dove si finisce a fine mese. I costi fissi sono gia'
  // interi dentro `fixedCostsTotal` e non vanno proiettati: solo la parte
  // variabile continua a crescere giorno per giorno. Proiettare anche loro
  // moltiplicherebbe il mutuo per trenta.
  const projection = useMemo(() => {
    if (!viewingCurrentMonth || elapsedDays === 0) return null;
    const variable = total - fixedCostsTotal;
    return fixedCostsTotal + (variable / elapsedDays) * daysInMonth;
  }, [viewingCurrentMonth, elapsedDays, total, fixedCostsTotal, daysInMonth]);

  const delta = percentChange(total, previousTotal);
  const previousMonth = new Date(month.getFullYear(), month.getMonth() - 1, 1);
  const cutoff = comparisonCutoff(month);
  const deltaLabel = viewingCurrentMonth
    ? `su ${monthName(previousMonth)} 1–${cutoff}`
    : `su ${monthName(previousMonth)}`;

  const recent = payments.slice(0, 5);

  /**
   * Gli introiti del mese, uno per uno, come le ultime spese nelle Uscite.
   * Il totale e le fonti dicono quanto e da dove, non *quando*: uno stipendio
   * arrivato il 27 e uno arrivato il 3 fanno lo stesso anello e due mesi
   * molto diversi da vivere.
   */
  const recentIncomes = useMemo(
    () =>
      [...incomes]
        .sort(
          (a, b) =>
            new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
        )
        .slice(0, 6),
    [incomes]
  );

  const amount = splitAmount(total);

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([
      reload(),
      reloadLimits(),
      loadRecurring(),
      loadBalance(),
      loadMerchants(),
      loadHistory(),
    ]);
    setRefreshing(false);
  }

  if (explorer.isOpen) return <>{explorer.overlay}</>;

  // Un oggetto e non un booleano: cosi' TypeScript sa che dentro il ramo
  // `gauge !== null` l'importo esiste davvero. `remaining` si ricalcola qui
  // invece di portarsi dietro l'intero `LimitStatus`, perche' con il
  // riferimento sintetico (guadagnato del mese) non c'e' nessuna riga
  // `spending_limits` a cui agganciarsi — solo un numero e quanto ne resta.
  //
  // `limit` e' il fondo scala dell'arco, `binding` il vincolo su cui si conta
  // quanto resta: coincidono sempre tranne quando limite di spesa e obiettivo
  // di risparmio convivono e non dicono la stessa cosa.
  const gauge = ceilings
    ? {
        limit: ceilings.scale,
        binding: ceilings.binding,
        remaining: ceilings.binding - total,
        synthetic: false,
      }
    : fallbackLimitAmount
      ? {
          limit: fallbackLimitAmount,
          binding: fallbackLimitAmount,
          remaining: fallbackLimitAmount - total,
          synthetic: true,
        }
      : null;

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
            <Icon name="settings" size={20} color={palette.ink3} />
            {/* Un changelog che sta solo dentro Impostazioni non lo apre
                nessuno, ed e' proprio il punto di avere aggiornamenti
                frequenti e non farlo sapere. */}
            {unreadNews && (
              <View style={[styles.newsDot, { borderColor: palette.ground, backgroundColor: palette.accent }]} />
            )}
          </TouchableOpacity>
        </View>

        {/* Due letture dello stesso mese, non due schermate diverse: quanto
            e' uscito e quanto e' entrato rispondono a domande opposte, e
            tenerle in colonna una dopo l'altra faceva scorrere mezza Home
            per arrivare alla seconda. */}
        <View style={[styles.seg, { backgroundColor: palette.surface2 }]}>
          {(["uscite", "entrate"] as MoneyMode[]).map((value) => {
            const on = mode === value;
            return (
              <TouchableOpacity
                key={value}
                style={[styles.segItem, on && { backgroundColor: palette.ground }]}
                onPress={() => onModeChange(value)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text
                  style={[
                    styles.segText,
                    { color: on ? palette.ink : palette.ink2 },
                  ]}
                >
                  {value === "uscite" ? "Uscite" : "Entrate"}
                </Text>
              </TouchableOpacity>
            );
          })}
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

            {mode === "uscite" ? (
              <>
                {gauge !== null ? (
                  // Il semicerchio riempie la larghezza del contenuto invece
                  // di stare stretto in una riga: dice le stesse tre cose di
                  // prima ma occupa lo spazio che merita, e le statistiche
                  // secondarie stanno sotto invece che di lato.
                  <View style={styles.gaugeBlock}>
                    <View style={styles.gaugeCenter}>
                      <SemiGauge
                        width={gaugeWidth}
                        stroke={16}
                        outer={{
                          segments: [{ value: total, color: palette.accent }],
                          max: gauge.limit,
                        }}
                        // L'investito sulla stessa scala del limite: sono
                        // entrambi denaro uscito dal conto questo mese, e
                        // affiancarli sullo stesso fondo scala e' l'unico modo
                        // di confrontarli senza calcoli.
                        inner={
                          monthlyInvested > 0
                            ? {
                                segments: [
                                  { value: monthlyInvested, color: palette.invest },
                                ],
                                max: gauge.limit,
                              }
                            : undefined
                        }
                        // Due tacche possibili: dove arrivano i costi fissi, e
                        // dove finisce il vincolo piu' stretto quando limite e
                        // obiettivo non coincidono. Entrambe sono nominate
                        // nella legenda qui sotto — una tacca senza nome qui
                        // e' gia' stata scambiata per un'altra cosa.
                        marks={[
                          ...(fixedCostsTotal > 0
                            ? [
                                {
                                  ratio: fixedCostsTotal / gauge.limit,
                                  color: palette.ink,
                                },
                              ]
                            : []),
                          ...(ceilings?.markRatio != null
                            ? [
                                {
                                  ratio: ceilings.markRatio,
                                  color: palette.warn,
                                },
                              ]
                            : []),
                        ]}
                        endLabel={
                          gauge.synthetic
                            ? `${formatAmount(gauge.limit)} guadagnati`
                            : formatAmount(gauge.limit)
                        }
                      >
                        {/* Senza limite configurato, il numero sotto e' il
                            guadagnato del mese, non un budget: va detto,
                            altrimenti sembra un impegno che nessuno ha preso. */}
                        {gauge.synthetic && (
                          <Text style={[styles.label, { color: palette.ink3, marginBottom: 0 }]}>
                            nessun limite · su quanto guadagnato
                          </Text>
                        )}
                        <Text style={[styles.gaugeValue, { color: palette.ink }]}>
                          {amount.whole}
                          <Text style={[styles.gaugeCents, { color: palette.ink3 }]}>
                            {amount.cents}
                          </Text>
                        </Text>
                        <Text
                          style={[
                            styles.gaugeNote,
                            {
                              color: gauge.remaining >= 0 ? palette.good : palette.over,
                            },
                          ]}
                        >
                          {gauge.remaining >= 0
                            ? `restano ${formatAmount(gauge.remaining)}`
                            : `oltre di ${formatAmount(-gauge.remaining)}`}
                          {/* Con due soglie il numero da solo non basta:
                              "restano 320 €" contro il limite e contro
                              l'obiettivo sono due cifre diverse, e senza dire
                              quale si sta guardando la piu' larga sembrerebbe
                              un permesso a spendere che l'altra nega. */}
                          {ceilings?.markRatio != null && (
                            <Text style={{ color: palette.ink3 }}>
                              {ceilings.bindingSource === "goal"
                                ? " · obiettivo"
                                : " · limite"}
                            </Text>
                          )}
                        </Text>
                      </SemiGauge>
                    </View>

                    {/* Una tacca senza nome viene letta a caso — questa era
                        gia' stata scambiata per i costi fissi mentre segnava
                        il ritmo. Ora segna davvero i costi fissi, e lo dice. */}
                    <View style={styles.gaugeKey}>
                      {fixedCostsTotal > 0 && (
                        <View style={styles.gaugeKeyItem}>
                          <View
                            style={[styles.keyTick, { backgroundColor: palette.ink }]}
                          />
                          <Text style={[styles.keyText, { color: palette.ink3 }]}>
                            costi fissi {formatAmount(fixedCostsTotal)}
                          </Text>
                        </View>
                      )}
                      {ceilings?.markLabel && (
                        <View style={styles.gaugeKeyItem}>
                          <View
                            style={[styles.keyTick, { backgroundColor: palette.warn }]}
                          />
                          <Text style={[styles.keyText, { color: palette.ink3 }]}>
                            {ceilings.markLabel}
                          </Text>
                        </View>
                      )}
                      {monthlyInvested > 0 && (
                        <View style={styles.gaugeKeyItem}>
                          <View
                            style={[styles.keyDot, { backgroundColor: palette.invest }]}
                          />
                          <Text style={[styles.keyText, { color: palette.ink3 }]}>
                            investito {formatAmount(monthlyInvested)}
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.statsRow}>
                      {/* Due numeri e non uno: la media che include mutuo e
                          rate dice quanto e' pesato il mese, quella senza dice
                          quanto stai spendendo *tu* giorno per giorno — ed e'
                          la seconda quella su cui si puo' agire. */}
                      <Stat
                        k="Al giorno"
                        v={`${compactAmount(total / Math.max(elapsedDays, 1))} €`}
                        sub={`${compactAmount(
                          Math.max(total - fixedCostsTotal, 0) /
                            Math.max(elapsedDays, 1)
                        )} € senza fissi`}
                      />
                      {projection !== null && (
                        <Stat
                          k="Fine mese"
                          v={`≈ ${compactAmount(projection)} €`}
                          // Contro il vincolo che stringe, non contro il fondo
                          // scala: con un obiettivo piu' severo del limite,
                          // confrontare col secondo lascerebbe "Fine mese"
                          // nero mentre la proiezione ha gia' mangiato il
                          // risparmio del mese.
                          tone={
                            projection > gauge.binding ? palette.warn : undefined
                          }
                        />
                      )}
                      <Stat
                        k="Restano"
                        v={`${daysInMonth - elapsedDays} giorni`}
                      />
                    </View>

                    {/* I limiti di categoria non avevano nessun posto in Home
                        dove si vedessero finche' non venivano sforati — solo
                        allora comparivano fra gli avvisi qui sotto. Queste
                        righe li mostrano sempre, non solo quando va male. Al
                        massimo tre: la categoria piu' vicina al proprio
                        limite prima, altrimenti non ci starebbero. */}
                    {viewingCurrentMonth && categoryLimits.length > 0 && (
                      <View style={styles.categoryLimits}>
                        {categoryLimits.slice(0, 3).map((status) => {
                          const category = categoryById(status.limit.category_id);
                          if (!category) return null;
                          return (
                            <CategoryLimitRow
                              key={status.limit.id}
                              status={status}
                              category={category}
                            />
                          );
                        })}
                      </View>
                    )}
                  </View>
                ) : (
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
                  </View>
                )}

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

                {/* Solo sul mese corrente: sfogliando l'archivio la domanda sul
                    mese scorso sarebbe fuori posto. */}
                {viewingCurrentMonth && <MonthCheck onReview={setMonth} />}

                {/* Il verdetto su un mese chiuso: li' entrate e spese sono
                    definitive, quindi "risparmiato" e' un fatto e non una
                    proiezione. E' anche l'unica cosa che dice se l'obiettivo
                    serve a qualcosa — un tetto rispettato tutti i mesi ma mai
                    verificato a consuntivo resta una buona intenzione. */}
                {verdict !== null && goal !== null && (
                  <View
                    style={[
                      styles.alert,
                      {
                        backgroundColor: verdict.met
                          ? `${palette.good}1f`
                          : `${palette.warn}1f`,
                      },
                    ]}
                  >
                    <Icon
                      name={verdict.met ? "piggy-bank" : "triangle-alert"}
                      size={16}
                      color={verdict.met ? palette.good : palette.warn}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.alertTitle, { color: palette.ink }]}>
                        {verdict.met
                          ? "Obiettivo centrato"
                          : "Obiettivo mancato"}
                      </Text>
                      <Text style={[styles.alertBody, { color: palette.ink2 }]}>
                        Risparmiati {formatAmount(verdict.saved)} su un
                        obiettivo di {formatAmount(Number(goal.amount))}
                        {verdict.met
                          ? `, ${formatAmount(-verdict.missing)} in più.`
                          : `: mancavano ${formatAmount(verdict.missing)}.`}{" "}
                        Entrate {formatAmount(monthlyIncome)} meno spese{" "}
                        {formatAmount(total)}.
                      </Text>
                    </View>
                  </View>
                )}

                {/* Un conflitto fra limite e obiettivo va detto dove si guarda
                    il semicerchio, non solo in Impostazioni: e' li' che il
                    numero al centro sta rispondendo a una sola delle due
                    soglie, e chi legge deve sapere che l'altra non e'
                    rispettabile insieme a questa. */}
                {viewingCurrentMonth &&
                  conflicts.some((c) => c.severity === "conflict") && (
                    <TouchableOpacity
                      style={[styles.alert, { backgroundColor: `${palette.warn}1f` }]}
                      onPress={() => openSettings("limits")}
                    >
                      <Icon name="triangle-alert" size={16} color={palette.warn} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.alertTitle, { color: palette.ink }]}>
                          {conflicts.find((c) => c.severity === "conflict")?.title}
                        </Text>
                        <Text style={[styles.alertBody, { color: palette.ink2 }]}>
                          {conflicts.find((c) => c.severity === "conflict")?.body}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}

                {/* Non legato al mese guardato: l'abbonamento e' un fatto
                    dell'account, non del periodo che si sta sfogliando. */}
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

                {/* Senza questo avviso, un fallimento di rete su incomes o
                    investments faceva sparire la scheda Flusso senza dire
                    perche': sembrava un bug del grafico invece che una
                    lettura fallita, e "tira giu' per aggiornare" non e' un
                    gesto che viene in mente da soli davanti a uno spazio
                    vuoto. */}
                {balanceError && (
                  <View style={[styles.alert, { backgroundColor: `${palette.warn}1f` }]}>
                    <Icon name="triangle-alert" size={16} color={palette.warn} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.alertTitle, { color: palette.ink }]}>
                        Flusso non disponibile
                      </Text>
                      <Text style={[styles.alertBody, { color: palette.ink2 }]}>
                        Introiti e investimenti non si sono caricati. Tira giù
                        per aggiornare.
                      </Text>
                    </View>
                  </View>
                )}

                {/* Due domande diverse affiancate: dove sono finiti i soldi di
                    questo mese, e se questo mese e' pesante rispetto agli
                    altri. Nessuna delle due merita mezza schermata da sola. */}
                <View style={styles.halfRow}>
                  {!balanceError && (monthlyIncome > 0 || monthlyInvested > 0) && (
                    <View style={[styles.card, { backgroundColor: palette.surface }]}>
                      <Text style={[styles.cardLabel, { color: palette.ink3 }]}>
                        Flusso
                      </Text>
                      <FlowCompare
                        income={monthlyIncome}
                        spent={total}
                        invested={monthlyInvested}
                      />
                    </View>
                  )}

                  {historyError ? (
                    <View style={[styles.card, { backgroundColor: palette.surface }]}>
                      <Text style={[styles.cardLabel, { color: palette.ink3 }]}>
                        Sui mesi
                      </Text>
                      <Text style={[styles.cardFoot, { color: palette.warn }]}>
                        Non disponibile. Tira giù per aggiornare.
                      </Text>
                    </View>
                  ) : (
                    spesaBars.length > 1 && (
                      <View style={[styles.card, { backgroundColor: palette.surface }]}>
                        <Text style={[styles.cardLabel, { color: palette.ink3 }]}>
                          Sui mesi
                        </Text>
                        <MonthBars bars={spesaBars} color={palette.accent} />
                        <Text style={[styles.cardFoot, { color: palette.ink3 }]}>
                          media {formatAmount(monthBarsAverage(spesaBars))}
                        </Text>
                      </View>
                    )
                  )}
                </View>

                {/* Sezione propria, non annidata dentro Ripartizione: le date
                    delle prossime rate esistono anche in un mese senza spese
                    categorizzate, e solo sul mese corrente — "fra 3 giorni"
                    non vuol dire niente sfogliando marzo. */}
                {viewingCurrentMonth && recurring.upcoming.length > 0 && (
                  <View>
                    <Text style={[styles.label, { color: palette.ink3 }]}>
                      Prossimi addebiti
                    </Text>
                    <RecurringSummary
                      upcoming={recurring.upcoming}
                      count={recurring.count}
                      monthlyTotal={recurring.monthlyTotal}
                      onPress={() => openSettings("recurring")}
                    />
                  </View>
                )}

                {trend.length > 1 && (
                  <View>
                    <Text style={[styles.label, { color: palette.ink3 }]}>
                      Andamento
                    </Text>
                    <TrendChart
                      points={trend}
                      // Il vincolo che stringe, non il fondo scala: e' quello
                      // che la retta di ritmo deve puntare, altrimenti il
                      // ritmo direbbe "sei in linea" mentre porta dritto a
                      // mancare l'obiettivo.
                      limit={ceilings?.binding ?? null}
                      limitLabel={
                        ceilings?.bindingSource === "goal" ? "OBIETTIVO" : "LIMITE"
                      }
                      baseline={fixedCostsTotal}
                      color={palette.accent}
                      weekBoundaries={
                        viewingCurrentMonth && weeklyOverall ? weekBoundaries : []
                      }
                      weeklyLimit={
                        weeklyOverall ? Number(weeklyOverall.limit.amount) : null
                      }
                    />
                    {merchantsUnknown && (
                      <Text style={[styles.chartNote, { color: palette.ink3 }]}>
                        I costi fissi non sono stati riconosciuti: la linea parte
                        da zero invece che dal loro totale.
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
                  <View style={styles.emptyBlock}>
                    <Text style={[styles.empty, { color: palette.ink3 }]}>
                      Nessuna spesa in questo mese. I pagamenti Apple Pay entrano
                      da soli una volta configurata l'automazione; contanti,
                      bonifici e addebiti diretti si aggiungono a mano o con Siri.
                    </Text>

                    {/* Il posto giusto per la guida e' questo: chi legge questa
                        frase e' esattamente chi non ha ancora configurato
                        niente. */}
                    <TouchableOpacity
                      style={[styles.emptyAction, { borderColor: palette.hairline }]}
                      onPress={() => openSettings("guide")}
                    >
                      <Icon name="book-open" size={14} color={palette.accent} />
                      <Text style={[styles.emptyActionText, { color: palette.accent }]}>
                        Come si configura
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            ) : (
              /* ---------------------------- ENTRATE ---------------------- */
              <>
                {monthlyIncome > 0 ? (
                  <>
                    {/* Stesso semicerchio delle uscite, ma doppio: fuori quanto
                        e' entrato diviso per fonte, dentro il morso che le
                        spese gli hanno gia' dato. */}
                    <View style={{ alignItems: "center" }}>
                      <SemiGauge
                        width={gaugeWidth}
                        stroke={16}
                        outer={{
                          segments: incomeSources.map((source, index) => ({
                            value: source.amount,
                            color: INCOME_SHADES[index % INCOME_SHADES.length],
                          })),
                          max: monthlyIncome,
                        }}
                        // L'investito segue lo speso sullo stesso anello: sono
                        // due morsi diversi allo stesso importo entrato, e
                        // messi in fila la loro somma e' quanto e' gia'
                        // uscito. Un terzo cerchio direbbe la stessa cosa
                        // costringendo a confrontare due raggi.
                        inner={{
                          segments: [
                            { value: total, color: palette.accent },
                            ...(monthlyInvested > 0
                              ? [{ value: monthlyInvested, color: palette.invest }]
                              : []),
                          ],
                          max: monthlyIncome,
                        }}
                      >
                        <Text style={[styles.label, { color: palette.ink3 }]}>
                          Entrate
                        </Text>
                        <Text style={[styles.gaugeValue, { color: palette.ink }]}>
                          {splitAmount(monthlyIncome).whole}
                          <Text style={[styles.gaugeCents, { color: palette.ink3 }]}>
                            {splitAmount(monthlyIncome).cents}
                          </Text>
                        </Text>
                        <Text style={[styles.gaugeNote, { color: palette.accent }]}>
                          −{formatAmount(total)} speso ·{" "}
                          {Math.round((total / monthlyIncome) * 100)}%
                        </Text>
                      </SemiGauge>
                    </View>

                    <View style={styles.legend}>
                      {incomeSources.map((source, index) => (
                        <View key={source.label} style={styles.legendRow}>
                          <View
                            style={[
                              styles.legendDot,
                              {
                                backgroundColor:
                                  INCOME_SHADES[index % INCOME_SHADES.length],
                              },
                            ]}
                          />
                          <Text
                            style={[styles.legendName, { color: palette.ink }]}
                            numberOfLines={1}
                          >
                            {source.label}
                          </Text>
                          <Text style={[styles.legendVal, { color: palette.ink2 }]}>
                            {formatAmount(source.amount)}
                          </Text>
                        </View>
                      ))}

                      {/* L'anello interno aveva due colori senza nome: la
                          legenda elencava solo le fonti di introito, cioe'
                          l'anello esterno, e chi guardava doveva indovinare
                          cos'era il morso dentro. */}
                      <View style={styles.legendRow}>
                        <View
                          style={[styles.legendDot, { backgroundColor: palette.accent }]}
                        />
                        <Text
                          style={[styles.legendName, { color: palette.ink }]}
                          numberOfLines={1}
                        >
                          Spese
                        </Text>
                        <Text style={[styles.legendVal, { color: palette.ink2 }]}>
                          −{formatAmount(total)}
                        </Text>
                      </View>

                      {monthlyInvested > 0 && (
                        <View style={styles.legendRow}>
                          <View
                            style={[
                              styles.legendDot,
                              { backgroundColor: palette.invest },
                            ]}
                          />
                          <Text
                            style={[styles.legendName, { color: palette.ink }]}
                            numberOfLines={1}
                          >
                            Investimenti
                          </Text>
                          <Text style={[styles.legendVal, { color: palette.ink2 }]}>
                            −{formatAmount(monthlyInvested)}
                          </Text>
                        </View>
                      )}
                    </View>

                    <View>
                      <Text style={[styles.label, { color: palette.ink3 }]}>
                        Quello che ti resta, giorno per giorno
                      </Text>
                      <BalanceChart points={balanceSeries} days={daysInMonth} />
                    </View>
                  </>
                ) : (
                  <View style={styles.emptyBlock}>
                    <Text style={[styles.empty, { color: palette.ink3 }]}>
                      Nessun introito in questo mese. Aggiungi stipendio, rimborsi
                      o entrate occasionali per vedere quanto di quello che entra
                      resta davvero.
                    </Text>
                    <TouchableOpacity
                      style={[styles.emptyAction, { borderColor: palette.hairline }]}
                      onPress={openAddIncome}
                    >
                      <Icon name="plus" size={14} color={palette.accent} />
                      <Text style={[styles.emptyActionText, { color: palette.accent }]}>
                        Aggiungi un introito
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {historyError && (
                  <View style={[styles.alert, { backgroundColor: `${palette.warn}1f` }]}>
                    <Icon name="triangle-alert" size={16} color={palette.warn} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.alertTitle, { color: palette.ink }]}>
                        Entrate mese per mese non disponibili
                      </Text>
                      <Text style={[styles.alertBody, { color: palette.ink2 }]}>
                        Tira giù per aggiornare.
                      </Text>
                    </View>
                  </View>
                )}

                {!historyError && introitiBars.length > 1 && (
                  <View>
                    {/* La media sta qui e non piu' come riga sul grafico: era
                        un riferimento che nessun mese toccava, e occupava lo
                        spazio dei valori veri sulle barre. */}
                    <View style={styles.sectionHead}>
                      <Text style={[styles.label, { color: palette.ink3 }]}>
                        Entrate mese per mese · {new Date().getFullYear()}
                      </Text>
                      <Text style={[styles.sectionMeta, { color: palette.ink3 }]}>
                        media {formatAmount(monthBarsAverage(introitiBars))}
                      </Text>
                    </View>
                    <MonthBars
                      bars={introitiBars}
                      color={palette.good}
                      width={320}
                      height={104}
                    />
                    <MonthBarsFooter
                      bars={introitiBars}
                      suffix={String(new Date().getFullYear())}
                    />
                  </View>
                )}

                {recentIncomes.length > 0 && (
                  <View>
                    <Text style={[styles.label, { color: palette.ink3 }]}>
                      Ultimi introiti
                    </Text>
                    {recentIncomes.map((income, index) => (
                      <View
                        key={`${income.occurred_at}-${income.label}-${index}`}
                        style={[styles.incomeRow, { borderBottomColor: palette.hairline }]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[styles.incomeName, { color: palette.ink }]}
                            numberOfLines={1}
                          >
                            {income.label?.trim() || "Altro"}
                          </Text>
                          <Text style={[styles.incomeDate, { color: palette.ink3 }]}>
                            {dayLabel(income.occurred_at)}
                          </Text>
                        </View>
                        <Text style={[styles.incomeAmount, { color: palette.good }]}>
                          +{formatAmount(Number(income.amount))}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
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

/** Numero secondario accanto al semicerchio: etichetta piccola, valore sopra. */
function Stat({
  k,
  v,
  tone,
  sub,
}: {
  k: string;
  v: string;
  tone?: string;
  sub?: string;
}) {
  const { palette } = useTheme();
  return (
    <View>
      <Text style={[styles.statKey, { color: palette.ink3 }]}>{k}</Text>
      <Text style={[styles.statValue, { color: tone ?? palette.ink }]}>{v}</Text>
      {sub && (
        <Text style={[styles.statSub, { color: palette.ink3 }]}>{sub}</Text>
      )}
    </View>
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

  seg: {
    flexDirection: "row",
    borderRadius: radius.pill,
    padding: 3,
    marginTop: -space.sm,
  },
  segItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  segText: { ...type.bodyMedium, fontSize: 13 },

  gaugeBlock: { gap: space.xl },
  gaugeCenter: { alignItems: "center" },
  gaugeValue: {
    ...type.title,
    fontSize: 38,
    fontWeight: "500",
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
  },
  gaugeCents: { fontSize: 22, fontWeight: "400" },
  gaugeNote: {
    ...type.body,
    fontWeight: "500",
    marginTop: 4,
    fontVariant: ["tabular-nums"],
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: space.sm,
  },
  categoryLimits: { gap: space.xs },
  gaugeKey: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: space.lg,
    marginTop: -space.md,
  },
  gaugeKeyItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  keyTick: { width: 2.5, height: 11, borderRadius: 2 },
  keyDot: { width: 7, height: 7, borderRadius: 4 },
  keyText: { ...type.small, fontSize: 10.5, fontVariant: ["tabular-nums"] },
  statKey: {
    fontSize: 9.5,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  statValue: {
    ...type.bodyMedium,
    fontSize: 15,
    marginTop: 1,
    fontVariant: ["tabular-nums"],
  },
  statSub: { fontSize: 10, marginTop: 1, fontVariant: ["tabular-nums"] },

  sectionHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  sectionMeta: { ...type.small, fontVariant: ["tabular-nums"] },

  incomeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  incomeName: { ...type.bodyMedium },
  incomeDate: { ...type.small, marginTop: 2 },
  incomeAmount: { ...type.amount, fontVariant: ["tabular-nums"] },

  halfRow: { flexDirection: "row", gap: space.md },
  card: {
    flex: 1,
    minWidth: 0,
    borderRadius: radius.card,
    padding: 12,
  },
  cardLabel: { ...type.label, fontSize: 9.5, marginBottom: 9 },
  cardFoot: { fontSize: 9.5, marginTop: 6, fontVariant: ["tabular-nums"] },

  legend: { gap: 9, marginTop: -space.sm },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  legendDot: { width: 9, height: 9, borderRadius: 3 },
  legendName: { ...type.body, flex: 1 },
  legendVal: { ...type.body, fontVariant: ["tabular-nums"] },

  hero: { ...type.hero, fontVariant: ["tabular-nums"] },
  heroCents: { ...type.heroCents },
  heroFoot: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: space.sm,
    marginTop: -space.md,
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
  emptyBlock: { alignItems: "center" },
  emptyAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 9,
    marginTop: space.md,
  },
  emptyActionText: { ...type.caption, fontWeight: "500" },
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
