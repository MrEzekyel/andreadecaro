import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { AmountSlider } from "../components/AmountSlider";
import { Icon } from "../components/Icon";
import { LoadError } from "../components/LoadError";
import { StaleNote } from "../components/StaleNote";
import { SwipeBack, backHitSlop } from "../components/SwipeBack";
import { CoherenceNotice } from "../components/CoherenceNotice";
import { GoalCard } from "../components/GoalCard";
import { LimitCard } from "../components/LimitCard";
import { CategoryPicker } from "../components/CategoryPicker";
import { Sheet } from "../components/Sheet";
import { useTheme } from "../lib/ThemeContext";
import { formatAmount } from "../lib/format";
import {
  CoherenceFix,
  computeGoalRange,
  goalRangeReason,
  median,
  validateGoalInput,
} from "../lib/savings";
import { supabase } from "../lib/supabase";
import { radius, space, type } from "../lib/theme";
import { SpendingLimit } from "../lib/types";
import { useLimits } from "../lib/useLimits";

const WARN_CHOICES = [50, 60, 70, 75, 80, 90];

/** Quanti mesi chiusi guardare per proporre le entrate di riferimento. */
const MESI_PER_MEDIANA = 6;

function parseAmountInput(value: string): number | null {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** Da numero a stringa modificabile, con la virgola italiana. */
function toInput(value: number) {
  return String(value).replace(".", ",");
}

export default function LimitsScreen({ onBack }: { onBack: () => void }) {
  const { palette } = useTheme();
  const {
    statuses,
    goal,
    conflicts,
    conflictingLimitIds,
    limits,
    investmentCommitment,
    error,
    staleLabel,
    staleReason,
    reload,
  } = useLimits();

  const [editing, setEditing] = useState<SpendingLimit | null>(null);
  const [open, setOpen] = useState(false);

  // ── Obiettivo di risparmio ──────────────────────────────────────────
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalAmount, setGoalAmount] = useState("");
  const [goalIncome, setGoalIncome] = useState("");
  const [suggestedIncome, setSuggestedIncome] = useState<number | null>(null);
  const [applying, setApplying] = useState(false);

  /**
   * Le entrate da proporre: mediana dei mesi **chiusi**.
   *
   * Il mese in corso va escluso, e non e' un dettaglio: il 3 del mese vale
   * quasi sempre zero e tirerebbe giu' la mediana proprio nel momento in cui
   * l'utente sta impostando l'obiettivo, proponendogli entrate piu' basse
   * del vero e quindi un tetto di spesa piu' stretto di quello che gli
   * serve. `monthly_totals` restituisce il mese corrente per primo.
   */
  const loadSuggestion = useCallback(async () => {
    const { data, error: failure } = await supabase.rpc("monthly_totals", {
      p_months: MESI_PER_MEDIANA + 1,
    });
    // Un fallimento qui non e' bloccante: si perde il suggerimento, non la
    // possibilita' di impostare l'obiettivo scrivendo le entrate a mano.
    if (failure || !data) return;
    const closed = (data as { introiti: number }[]).slice(1);
    setSuggestedIncome(median(closed.map((row) => Number(row.introiti))));
  }, []);

  useEffect(() => {
    loadSuggestion();
  }, [loadSuggestion]);

  function openGoal() {
    setGoalAmount(goal ? toInput(Number(goal.amount)) : "");
    setGoalIncome(
      goal
        ? toInput(Number(goal.reference_income))
        : suggestedIncome
          ? toInput(Math.round(suggestedIncome * 100) / 100)
          : ""
    );
    setGoalOpen(true);
  }

  // Numeri correnti del foglio, derivati a ogni render dai due campi: servono
  // sia allo slider (che deve conoscere il proprio intervallo mentre si
  // digita) sia al bottone Salva (che deve sapere se e' il caso di provarci).
  const goalAmountValue = parseAmountInput(goalAmount);
  const goalIncomeValue = parseAmountInput(goalIncome);
  const goalRange =
    goalIncomeValue !== null
      ? computeGoalRange(goalIncomeValue, limits, investmentCommitment)
      : null;

  async function saveGoal() {
    const amount = parseAmountInput(goalAmount);
    const income = parseAmountInput(goalIncome);

    if (amount === null) {
      Alert.alert("Importo non valido", "Inserisci un obiettivo maggiore di zero.");
      return;
    }
    if (income === null) {
      Alert.alert(
        "Entrate mancanti",
        "Servono le entrate mensili di riferimento: sono loro a dire quanto puoi spendere restando dentro l'obiettivo."
      );
      return;
    }

    // Si controlla qui, prima di scrivere — non dopo, con un avviso che si
    // scopre per caso in Limiti o in Home. `validateGoalInput` e'
    // esattamente la stessa regola che `checkCoherence` userebbe per
    // segnalare il conflitto: la si blocca sul nascere invece di lasciarla
    // nascere e poi dirlo.
    const check = validateGoalInput(amount, income, limits, investmentCommitment);
    if (!check.ok) {
      Alert.alert("Obiettivo non valido", check.reason);
      return;
    }

    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user.id;
    if (!userId) {
      Alert.alert("Sessione scaduta", "Accedi di nuovo.");
      return;
    }

    // `upsert` su `user_id`: l'obiettivo e' uno solo per utente (indice unico),
    // quindi crearlo e modificarlo sono la stessa operazione e non serve
    // distinguere i due rami come per i limiti.
    const { error: failure } = await supabase
      .from("savings_goals")
      .upsert(
        {
          user_id: userId,
          amount,
          reference_income: income,
          active: true,
        },
        { onConflict: "user_id" }
      );

    if (failure) {
      Alert.alert("Errore", failure.message);
      return;
    }

    setGoalOpen(false);
    await reload();
  }

  function confirmDeleteGoal() {
    if (!goal) return;
    Alert.alert(
      "Eliminare l'obiettivo?",
      "Il semicerchio in Home tornerà a misurarsi sul limite di spesa.",
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Elimina",
          style: "destructive",
          onPress: async () => {
            const { error: failure } = await supabase
              .from("savings_goals")
              .delete()
              .eq("id", goal.id);
            if (failure) {
              Alert.alert("Errore", failure.message);
              return;
            }
            setGoalOpen(false);
            await reload();
          },
        },
      ]
    );
  }

  /**
   * Applica una correzione suggerita da `checkCoherence`.
   *
   * Scrive il numero gia' calcolato dove serve — sul limite o sull'obiettivo
   * — invece di aprire il foglio con il campo da correggere a mano: il senso
   * della sezione e' che rimettere in riga i due valori costi un tocco.
   */
  async function applyFix(fix: CoherenceFix) {
    setApplying(true);
    const failure =
      fix.target.kind === "goal"
        ? (
            await supabase
              .from("savings_goals")
              .update({ amount: fix.amount })
              .eq("id", goal?.id ?? "")
          ).error
        : (
            await supabase
              .from("spending_limits")
              .update({ amount: fix.amount })
              .eq("id", fix.target.id)
          ).error;
    setApplying(false);

    if (failure) {
      Alert.alert("Errore", failure.message);
      return;
    }
    await reload();
  }

  const [period, setPeriod] = useState<"weekly" | "monthly">("monthly");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [warnAt, setWarnAt] = useState(80);
  const [scopeAll, setScopeAll] = useState(true);

  function openCreate() {
    setEditing(null);
    setPeriod("monthly");
    setAmount("");
    setCategoryId(null);
    setScopeAll(true);
    setWarnAt(80);
    setOpen(true);
  }

  function openEdit(limit: SpendingLimit) {
    setEditing(limit);
    setPeriod(limit.period);
    setAmount(String(limit.amount).replace(".", ","));
    setCategoryId(limit.category_id);
    setScopeAll(limit.category_id === null);
    setWarnAt(limit.warn_at_percent);
    setOpen(true);
  }

  async function save() {
    const parsed = parseAmountInput(amount);
    if (parsed === null) {
      Alert.alert("Importo non valido", "Inserisci un limite maggiore di zero.");
      return;
    }

    const targetCategory = scopeAll ? null : categoryId;
    if (!scopeAll && !targetCategory) {
      Alert.alert("Categoria mancante", "Scegli la categoria da limitare.");
      return;
    }

    if (editing) {
      const { error } = await supabase
        .from("spending_limits")
        .update({
          period,
          amount: parsed,
          category_id: targetCategory,
          warn_at_percent: warnAt,
        })
        .eq("id", editing.id);
      if (error) {
        Alert.alert("Errore", describe(error));
        return;
      }
    } else {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id;
      if (!userId) {
        Alert.alert("Sessione scaduta", "Accedi di nuovo.");
        return;
      }
      const { error } = await supabase.from("spending_limits").insert({
        user_id: userId,
        period,
        amount: parsed,
        category_id: targetCategory,
        warn_at_percent: warnAt,
      });
      if (error) {
        Alert.alert("Errore", describe(error));
        return;
      }
    }

    setOpen(false);
    await reload();
  }

  function describe(error: { code?: string; message: string }) {
    return error.code === "23505"
      ? "Esiste già un limite per questo periodo e questa categoria. Modifica quello."
      : error.message;
  }

  function confirmDelete(limit: SpendingLimit) {
    Alert.alert("Eliminare il limite?", "Non riceverai più avvisi per questo.", [
      { text: "Annulla", style: "cancel" },
      {
        text: "Elimina",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase
            .from("spending_limits")
            .delete()
            .eq("id", limit.id);
          if (error) {
            Alert.alert("Errore", error.message);
            return;
          }
          await reload();
        },
      },
    ]);
  }

  return (
    <SwipeBack onBack={onBack}>
    <View style={[styles.container, { backgroundColor: palette.ground }]}>
      <View style={styles.head}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.back}
          hitSlop={backHitSlop}
        >
          <Icon name="chevron-left" size={20} color={palette.ink} />
          <Text style={[styles.title, { color: palette.ink }]}>Limiti</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={openCreate} style={styles.addBtn}>
          <Icon name="plus" size={15} color={palette.accent} />
          <Text style={[styles.addText, { color: palette.accent }]}>Nuovo</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {staleLabel && (
          <StaleNote label={staleLabel} reason={staleReason} onRetry={reload} />
        )}

        {error && <LoadError message={error} onRetry={reload} />}

        {/* La coerenza va in cima: e' l'unica cosa qui dentro che dice che
            quello che si sta guardando piu' sotto non funziona come sembra.
            In fondo alla pagina non la leggerebbe nessuno. */}
        {!error && (
          <CoherenceNotice
            items={conflicts}
            onApply={applyFix}
            busy={applying}
          />
        )}

        {!error && (
          <View style={styles.limitBlock}>
            {goal ? (
              <>
                <GoalCard
                  goal={goal}
                  onPress={openGoal}
                  warn={conflicts.some(
                    (c) => c.involvesGoal && c.severity === "conflict"
                  )}
                />
                <TouchableOpacity
                  style={styles.deleteRow}
                  onPress={confirmDeleteGoal}
                >
                  <Text style={[styles.deleteText, { color: palette.ink3 }]}>
                    Elimina
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={[styles.goalEmpty, { borderColor: palette.hairline }]}
                onPress={openGoal}
              >
                <Icon name="piggy-bank" size={16} color={palette.good} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.goalEmptyTitle, { color: palette.ink }]}>
                    Obiettivo di risparmio
                  </Text>
                  <Text style={[styles.goalEmptyBody, { color: palette.ink3 }]}>
                    Quanto vuoi mettere da parte ogni mese. Diventa un tetto di
                    spesa in Home.
                  </Text>
                </View>
                <Icon name="plus" size={15} color={palette.accent} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* "Nessun limite impostato. Creane uno" su una lettura fallita porta
            a crearne un doppione, che il vincolo unico rifiuta con un 23505. */}
        {!error && statuses.length === 0 && (
          <Text style={[styles.empty, { color: palette.ink3 }]}>
            Nessun limite impostato. Creane uno per ricevere un avviso quando ti
            avvicini alla soglia.
          </Text>
        )}

        {statuses.map((status) => (
          <View key={status.limit.id} style={styles.limitBlock}>
            <LimitCard
              status={status}
              onPress={() => openEdit(status.limit)}
              warn={conflictingLimitIds.has(status.limit.id)}
            />
            <TouchableOpacity
              style={styles.deleteRow}
              onPress={() => confirmDelete(status.limit)}
            >
              <Text style={[styles.deleteText, { color: palette.ink3 }]}>
                Elimina
              </Text>
            </TouchableOpacity>
          </View>
        ))}

        <Text style={[styles.note, { color: palette.ink3 }]}>
          La settimana comincia il lunedì. Un mese vale circa 4,35 settimane:
          è con quel numero che un limite settimanale e uno mensile vengono
          messi a confronto. Gli avvisi compaiono nella Home; le notifiche push
          arriveranno più avanti.
        </Text>
      </ScrollView>

      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title={editing ? "Modifica limite" : "Nuovo limite"}
      >
        <Text style={[styles.fieldLabel, { color: palette.ink3 }]}>Periodo</Text>
        <View style={[styles.segment, { backgroundColor: palette.surface2 }]}>
          {(["weekly", "monthly"] as const).map((option) => (
            <TouchableOpacity
              key={option}
              onPress={() => setPeriod(option)}
              style={[
                styles.segmentOption,
                period === option && { backgroundColor: palette.surface },
              ]}
            >
              <Text
                style={[
                  styles.segmentLabel,
                  { color: period === option ? palette.ink : palette.ink3 },
                ]}
              >
                {option === "weekly" ? "Settimanale" : "Mensile"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.fieldLabel, { color: palette.ink3 }]}>Importo</Text>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0,00"
          placeholderTextColor={palette.ink3}
          style={[
            styles.input,
            {
              backgroundColor: palette.surface,
              borderColor: palette.hairline,
              color: palette.ink,
            },
          ]}
        />

        <Text style={[styles.fieldLabel, { color: palette.ink3 }]}>
          Si applica a
        </Text>
        <View style={[styles.segment, { backgroundColor: palette.surface2 }]}>
          <TouchableOpacity
            onPress={() => setScopeAll(true)}
            style={[
              styles.segmentOption,
              scopeAll && { backgroundColor: palette.surface },
            ]}
          >
            <Text
              style={[
                styles.segmentLabel,
                { color: scopeAll ? palette.ink : palette.ink3 },
              ]}
            >
              Tutto
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setScopeAll(false)}
            style={[
              styles.segmentOption,
              !scopeAll && { backgroundColor: palette.surface },
            ]}
          >
            <Text
              style={[
                styles.segmentLabel,
                { color: !scopeAll ? palette.ink : palette.ink3 },
              ]}
            >
              Una categoria
            </Text>
          </TouchableOpacity>
        </View>

        {!scopeAll && (
          <CategoryPicker value={categoryId} onChange={setCategoryId} />
        )}

        <Text style={[styles.fieldLabel, { color: palette.ink3 }]}>
          Primo avviso al
        </Text>
        <View style={styles.warnRow}>
          {WARN_CHOICES.map((choice) => (
            <TouchableOpacity
              key={choice}
              onPress={() => setWarnAt(choice)}
              style={[
                styles.warnChip,
                {
                  backgroundColor:
                    warnAt === choice ? palette.accent : palette.surface,
                  borderColor:
                    warnAt === choice ? palette.accent : palette.hairline,
                },
              ]}
            >
              <Text
                style={[
                  styles.warnText,
                  { color: warnAt === choice ? palette.onAccent : palette.ink2 },
                ]}
              >
                {choice}%
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: palette.accent }]}
          onPress={save}
        >
          <Text style={[styles.buttonText, { color: palette.onAccent }]}>
            Salva
          </Text>
        </TouchableOpacity>
      </Sheet>

      <Sheet
        visible={goalOpen}
        onClose={() => setGoalOpen(false)}
        title={goal ? "Modifica obiettivo" : "Obiettivo di risparmio"}
      >
        <Text style={[styles.sheetBody, { color: palette.ink3 }]}>
          Quanto vuoi che ti resti a fine mese. Gli investimenti contano: un
          PAC da 500 € copre già metà di un obiettivo da 1.000 €.
        </Text>

        <Text style={[styles.fieldLabel, { color: palette.ink3 }]}>
          Entrate mensili previste
        </Text>
        <TextInput
          value={goalIncome}
          onChangeText={setGoalIncome}
          keyboardType="decimal-pad"
          placeholder="0,00"
          placeholderTextColor={palette.ink3}
          style={[
            styles.input,
            {
              backgroundColor: palette.surface,
              borderColor: palette.hairline,
              color: palette.ink,
            },
          ]}
        />

        {/* Il suggerimento resta tale: si propone e si lascia correggere,
            invece di leggere gli introiti del mese in corso — che il 3 del
            mese valgono zero e darebbero un tetto di spesa negativo. */}
        {suggestedIncome !== null && (
          <TouchableOpacity
            onPress={() =>
              setGoalIncome(toInput(Math.round(suggestedIncome * 100) / 100))
            }
          >
            <Text style={[styles.suggestion, { color: palette.accent }]}>
              Usa {formatAmount(suggestedIncome)} · mediana degli ultimi mesi
            </Text>
          </TouchableOpacity>
        )}

        <Text style={[styles.fieldLabel, { color: palette.ink3, marginTop: space.md }]}>
          Obiettivo al mese
        </Text>
        <TextInput
          value={goalAmount}
          onChangeText={setGoalAmount}
          keyboardType="decimal-pad"
          placeholder="0,00"
          placeholderTextColor={palette.ink3}
          style={[
            styles.input,
            {
              backgroundColor: palette.surface,
              borderColor: palette.hairline,
              color: palette.ink,
            },
          ]}
        />

        {/* Lo slider serve solo a scegliere piu' in fretta lo stesso numero:
            il campo sopra resta scrivibile a mano in ogni momento, e resta
            l'unica fonte di verita' di cosa verra' salvato — lo slider si
            limita a scriverci dentro quando trascinato. */}
        {goalRange && (
          <View style={styles.sliderWrap}>
            <AmountSlider
              value={goalAmountValue ?? goalRange.min}
              min={goalRange.min}
              max={goalRange.max}
              step={5}
              color={palette.good}
              floorLabel={investmentCommitment > 0 ? "già investito" : undefined}
              onChange={(v) => setGoalAmount(toInput(v))}
            />
          </View>
        )}

        {/* Le entrate ci sono ma nessun obiettivo e' compatibile con limiti e
            piani di accumulo attuali: si dice perche', invece di far scoprire
            il blocco solo al tocco di Salva. */}
        {goalIncomeValue !== null && !goalRange && (
          <View style={[styles.impossible, { backgroundColor: `${palette.warn}1f` }]}>
            <Icon name="triangle-alert" size={15} color={palette.warn} />
            <Text style={[styles.impossibleText, { color: palette.ink2 }]}>
              {goalRangeReason(goalIncomeValue, limits, investmentCommitment)}
            </Text>
          </View>
        )}

        <Text style={[styles.sheetFoot, { color: palette.ink3 }]}>
          Le entrate servono per tradurre l'obiettivo in quanto puoi
          spendere. Restano questo numero anche se un mese incassi di più o
          di meno: così il tetto non balla, e lo cambi tu quando cambia
          davvero.
        </Text>

        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: goalRange ? palette.accent : palette.hairline },
          ]}
          onPress={saveGoal}
          disabled={!goalRange}
        >
          <Text
            style={[
              styles.buttonText,
              { color: goalRange ? palette.onAccent : palette.ink3 },
            ]}
          >
            Salva
          </Text>
        </TouchableOpacity>
      </Sheet>
    </View>
    </SwipeBack>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.sm,
  },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 10,
    paddingRight: 18,
  },
  title: { ...type.title },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  addText: { ...type.caption, fontWeight: "500" },
  list: { padding: space.lg, gap: space.lg },
  limitBlock: { gap: 4 },
  deleteRow: { alignSelf: "flex-end", paddingVertical: 4, paddingHorizontal: 4 },
  deleteText: { ...type.small },
  goalEmpty: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: space.lg,
  },
  goalEmptyTitle: { ...type.bodyMedium, fontSize: 12.5 },
  goalEmptyBody: { ...type.small, lineHeight: 16, marginTop: 2 },
  sheetBody: { ...type.small, lineHeight: 18 },
  sheetFoot: { ...type.small, lineHeight: 16, marginTop: space.sm },
  suggestion: { ...type.small, fontWeight: "500", marginTop: 6 },
  sliderWrap: { marginTop: space.sm },
  impossible: {
    flexDirection: "row",
    gap: 8,
    borderRadius: radius.card,
    padding: space.md,
    marginTop: space.sm,
  },
  impossibleText: { ...type.small, lineHeight: 16, flex: 1 },
  empty: { ...type.body, lineHeight: 21, textAlign: "center", marginTop: space.xl },
  note: { ...type.small, lineHeight: 17 },
  fieldLabel: { ...type.caption, marginTop: space.sm },
  input: {
    borderWidth: 1,
    borderRadius: radius.field,
    paddingHorizontal: 13,
    paddingVertical: 12,
    ...type.body,
  },
  segment: { flexDirection: "row", gap: 4, borderRadius: 11, padding: 4 },
  segmentOption: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 9,
    borderRadius: 8,
  },
  segmentLabel: { ...type.small, fontWeight: "500" },
  warnRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  warnChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  warnText: { ...type.caption, fontWeight: "500" },
  button: {
    borderRadius: radius.button,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: space.md,
  },
  buttonText: { ...type.bodyMedium, fontSize: 14.5 },
});
