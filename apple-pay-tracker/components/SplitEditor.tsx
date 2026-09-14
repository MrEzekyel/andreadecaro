import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useData } from "../lib/DataContext";
import { useTheme } from "../lib/ThemeContext";
import { formatAmount } from "../lib/format";
import { radius, space, tint, type } from "../lib/theme";
import { Person } from "../lib/types";
import { Icon } from "./Icon";
import { SplitPeopleSheet } from "./SplitPeopleSheet";

export type SplitMode = "equal" | "percent" | "exact";

export type SplitState = {
  enabled: boolean;
  mode: SplitMode;
  /** id delle persone con cui e' divisa (io non sono in elenco). */
  personIds: string[];
  /** Per 'percent' la percentuale altrui, per 'exact' l'importo altrui. */
  values: Record<string, string>;
  /**
   * Persone locali segnate "gia' saldata" nel momento in cui si sceglie la
   * divisione: fa scrivere `settled_at` sulla riga `payment_splits` quando
   * quella riga **nasce**, invece di lasciarlo null come sempre.
   *
   * Ha senso solo per chi non ha un account Clinck collegato — vedi
   * `settledOnInsertIds` piu' sotto, che e' anche il posto dove il filtro si
   * riapplica in scrittura, non solo qui nell'interfaccia — e solo per una
   * quota che non esisteva gia': ri-saldare una quota gia' salvata si fa dal
   * tasto verde di conferma (`OwedScreen`, `PersonDetailScreen`, il dettaglio
   * della spesa), mai riaprendo l'editor della divisione, altrimenti
   * salvare una nota su una spesa gia' divisa potrebbe chiudere in silenzio
   * un credito che l'altra persona non ha ancora saldato davvero.
   */
  settledOnCreate: Record<string, boolean>;
};

export const emptySplit: SplitState = {
  enabled: false,
  mode: "equal",
  personIds: [],
  values: {},
  settledOnCreate: {},
};

function toNumber(value: string) {
  const parsed = Number(value.replace(",", ".").trim());
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

/**
 * Calcola quanto deve ogni persona e quanto resta a me.
 *
 * In modalita' equa il totale si divide fra me e le altre persone, quindi il
 * divisore e' `persone + 1`: dimenticare quel +1 e' l'errore classico che fa
 * sparire la propria quota.
 */
export function computeSplit(total: number, split: SplitState) {
  const owed: Record<string, number> = {};

  if (!split.enabled || split.personIds.length === 0) {
    return { owed, myShare: total, assigned: 0, valid: true };
  }

  if (split.mode === "equal") {
    const perHead = total / (split.personIds.length + 1);
    for (const id of split.personIds) owed[id] = round(perHead);
  } else if (split.mode === "percent") {
    for (const id of split.personIds) {
      owed[id] = round((total * toNumber(split.values[id] ?? "")) / 100);
    }
  } else {
    for (const id of split.personIds) {
      owed[id] = round(toNumber(split.values[id] ?? ""));
    }
  }

  const assigned = Object.values(owed).reduce((sum, v) => sum + v, 0);
  return {
    owed,
    myShare: round(total - assigned),
    assigned: round(assigned),
    // La somma delle quote altrui non puo' superare il totale pagato.
    valid: assigned <= total + 0.001,
  };
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

/**
 * Chi, fra le persone scelte, deve nascere gia' segnata come saldata.
 *
 * Il filtro su `linked_user_id` sta anche qui e non solo nell'interfaccia
 * (che gia' non mostra l'interruttore a una persona collegata): la quota di
 * chi ha Clinck deve prima essere vista e accettata dall'altra parte, quindi
 * non esiste ancora niente da dichiarare saldato — se lo stato arrivasse
 * incoerente, la scrittura non deve fidarsi di quello che ha disegnato lo
 * schermo.
 */
export function settledOnInsertIds(split: SplitState, people: Person[]): Set<string> {
  const linked = new Set(people.filter((p) => p.linked_user_id).map((p) => p.id));
  const ids = new Set<string>();
  for (const id of split.personIds) {
    if (split.settledOnCreate[id] && !linked.has(id)) ids.add(id);
  }
  return ids;
}

type Props = {
  total: number;
  split: SplitState;
  onChange: (next: SplitState) => void;
  /**
   * Person id gia' salvati per questa spesa quando il foglio si e' aperto:
   * solo chi non c'e' qui dentro e' una quota davvero nuova, l'unico caso in
   * cui "gia' saldato" ha senso offrire. Vuoto per una spesa che non esiste
   * ancora (`AddPaymentSheet`): li' ogni persona scelta e' per forza nuova.
   */
  existingPersonIds?: string[];
  /** Passato a `SplitPeopleSheet`: vedi lì per il motivo. */
  splitUnknown?: boolean;
  /**
   * Apre subito il foglio di scelta persone. Chi arriva dal tasto "Dividi
   * con altri" nel dettaglio di una spesa vuole scegliere subito con chi,
   * non vedere un riassunto vuoto con un altro tasto da toccare prima.
   */
  focusPicker?: boolean;
};

/**
 * La divisione, riassunta in poche righe dentro il foglio di aggiunta o
 * modifica spesa: l'elenco di chi c'e' dentro, quanto resta a te, e un tasto
 * che apre `SplitPeopleSheet` — il foglio dedicato a scegliere le persone e
 * gli importi. Prima l'intero elenco della rubrica (checkbox una per una)
 * viveva qui: con venti contatti diventava piu' lungo di tutto il resto del
 * foglio "Nuova spesa" messo insieme.
 */
export function SplitEditor({
  total,
  split,
  onChange,
  existingPersonIds = [],
  splitUnknown,
  focusPicker,
}: Props) {
  const { palette, dark } = useTheme();
  const { people } = useData();
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (focusPicker) setPickerOpen(true);
  }, [focusPicker]);

  const result = computeSplit(total, split);
  const selected = split.personIds
    .map((id) => people.find((p) => p.id === id))
    .filter((p): p is Person => !!p);

  function toggleEnabled() {
    const next = !split.enabled;
    onChange({ ...split, enabled: next });
    // Attivare la divisione vuole dire subito scegliere con chi: mostrare un
    // riassunto vuoto con un altro tasto da toccare sarebbe un passo in piu'
    // senza motivo.
    if (next) setPickerOpen(true);
  }

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={styles.toggle}
        onPress={toggleEnabled}
        accessibilityRole="switch"
        accessibilityState={{ checked: split.enabled }}
      >
        <View
          style={[
            styles.box,
            {
              borderColor: split.enabled ? palette.accent : palette.ink3,
              backgroundColor: split.enabled ? palette.accent : "transparent",
            },
          ]}
        >
          {split.enabled && (
            <Icon name="check" size={11} color={palette.onAccent} strokeWidth={3} />
          )}
        </View>
        <Text style={[styles.toggleLabel, { color: palette.ink }]}>
          Spesa divisa con altri
        </Text>
      </TouchableOpacity>

      {split.enabled && (
        <TouchableOpacity
          style={[styles.summary, { backgroundColor: palette.surface2 }]}
          onPress={() => setPickerOpen(true)}
          accessibilityRole="button"
        >
          {selected.length > 0 && (
            <View style={styles.avatarRow}>
              {selected.slice(0, 4).map((person, index) => (
                <View
                  key={person.id}
                  style={[
                    styles.avatar,
                    {
                      backgroundColor: tint(palette.accent, dark),
                      borderColor: palette.surface2,
                      marginLeft: index === 0 ? 0 : -11,
                    },
                  ]}
                >
                  <Text style={[styles.avatarText, { color: palette.accent }]}>
                    {person.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.summaryText}>
            <Text style={[styles.summaryTitle, { color: palette.ink }]} numberOfLines={1}>
              {selected.length === 0
                ? "Scegli con chi dividerla"
                : selected.length === 1
                  ? selected[0].name
                  : `${selected[0].name} e altri ${selected.length - 1}`}
            </Text>
            <Text
              style={[
                styles.summaryHint,
                { color: result.valid ? palette.ink3 : palette.over },
              ]}
            >
              {selected.length === 0
                ? "Tocca per cercare in rubrica"
                : result.valid
                  ? `Resta a te ${formatAmount(result.myShare)}`
                  : "Le quote superano il totale pagato"}
            </Text>
          </View>

          <Icon name="chevron-right" size={17} color={palette.ink3} />
        </TouchableOpacity>
      )}

      <SplitPeopleSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        total={total}
        split={split}
        onChange={onChange}
        existingPersonIds={existingPersonIds}
        splitUnknown={splitUnknown}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  toggle: { flexDirection: "row", alignItems: "center", gap: 9 },
  toggleLabel: { ...type.body },
  box: {
    width: 17,
    height: 17,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    borderRadius: radius.card,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  avatarRow: { flexDirection: "row" },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { ...type.caption, fontWeight: "600" },
  summaryText: { flex: 1, gap: 2 },
  summaryTitle: { ...type.bodyMedium },
  summaryHint: { ...type.small },
});
