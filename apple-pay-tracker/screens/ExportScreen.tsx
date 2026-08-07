import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Icon } from "../components/Icon";
import { SwipeBack, backHitSlop } from "../components/SwipeBack";
import { useTheme } from "../lib/ThemeContext";
import { exportToCsv, ExportKind } from "../lib/exportData";
import { formatAmount } from "../lib/format";
import { radius, space, type } from "../lib/theme";

const EXPORTS: {
  kind: ExportKind;
  icon: string;
  label: string;
  description: string;
  /** Come leggere il totale che compare a export fatto. */
  totalLabel: string;
}[] = [
  {
    kind: "payments",
    icon: "receipt",
    label: "Spese",
    description:
      "Data, esercente, categoria, metodo di pagamento, importo pagato e quota tua.",
    totalLabel: "totale speso",
  },
  {
    kind: "incomes",
    icon: "wallet",
    label: "Introiti",
    description: "Stipendio e ricavi, con data e descrizione.",
    totalLabel: "totale incassato",
  },
  {
    kind: "investments",
    icon: "trending-up",
    label: "Investimenti",
    description:
      "Ogni operazione: acquisti, vendite e dividendi, con quote, prezzo e commissioni.",
    totalLabel: "totale investito",
  },
  {
    kind: "splits",
    icon: "users",
    label: "Divisioni",
    description: "Le quote delle spese divise, con chi deve cosa e cosa è saldato.",
    totalLabel: "ancora da ricevere",
  },
];

/**
 * Un file per entita', non un unico export.
 *
 * Un CSV con dentro spese, introiti e investimenti uno sotto l'altro avrebbe
 * colonne diverse per ogni sezione e non si aprirebbe pulito in nessun foglio
 * di calcolo: si guadagna un tocco e si perde il file.
 */
export default function ExportScreen({ onBack }: { onBack: () => void }) {
  const { palette } = useTheme();
  const [running, setRunning] = useState<ExportKind | null>(null);

  async function run(kind: ExportKind) {
    const entry = EXPORTS.find((e) => e.kind === kind);
    setRunning(kind);
    try {
      const { rows, total } = await exportToCsv(kind);
      Alert.alert(
        "Esportato",
        `${rows} ${rows === 1 ? "riga" : "righe"} · ${entry?.totalLabel} ${formatAmount(total)}.\n\nControlla che il totale corrisponda a quello che vedi nell'app.`
      );
    } catch (error) {
      Alert.alert(
        "Export non riuscito",
        error instanceof Error ? error.message : "Riprova fra poco."
      );
    } finally {
      setRunning(null);
    }
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
            <Text style={[styles.title, { color: palette.ink }]}>
              Esporta i dati
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.intro, { color: palette.ink2 }]}>
            I tuoi dati escono in CSV, un file per tipo. Si aprono in Numeri,
            Excel e Fogli Google senza conversioni.
          </Text>

          <View
            style={[
              styles.card,
              { backgroundColor: palette.surface, borderColor: palette.hairline },
            ]}
          >
            {EXPORTS.map((entry, index) => (
              <React.Fragment key={entry.kind}>
                {index > 0 && (
                  <View
                    style={[styles.divider, { backgroundColor: palette.hairline }]}
                  />
                )}
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => run(entry.kind)}
                  disabled={running !== null}
                  accessibilityRole="button"
                  accessibilityLabel={`Esporta ${entry.label}`}
                >
                  <Icon name={entry.icon} size={17} color={palette.ink2} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowLabel, { color: palette.ink }]}>
                      {entry.label}
                    </Text>
                    <Text style={[styles.rowHint, { color: palette.ink3 }]}>
                      {entry.description}
                    </Text>
                  </View>
                  {running === entry.kind ? (
                    <ActivityIndicator color={palette.accent} />
                  ) : (
                    <Icon
                      name="share"
                      size={15}
                      color={running ? palette.hairline : palette.ink3}
                    />
                  )}
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </View>

          <Text style={[styles.note, { color: palette.ink3 }]}>
            Sulle spese trovi due colonne di importo: quanto è uscito dal conto
            e quanto compete a te. È la seconda a fare i totali dell'app, e su
            una spesa divisa le due differiscono.
          </Text>

          <Text style={[styles.note, { color: palette.ink3 }]}>
            I tuoi dati restano esportabili in qualsiasi momento, anche senza
            abbonamento.
          </Text>
        </ScrollView>
      </View>
    </SwipeBack>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  head: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.sm,
  },
  back: { flexDirection: "row", alignItems: "center", gap: 4 },
  title: { ...type.title },
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.lg },
  intro: { ...type.body, lineHeight: 21 },
  card: { borderWidth: 1, borderRadius: radius.card, overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: space.md,
    paddingVertical: 13,
  },
  rowLabel: { ...type.body },
  rowHint: { ...type.small, marginTop: 2, lineHeight: 15 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: space.md },
  note: { ...type.small, lineHeight: 16 },
});
