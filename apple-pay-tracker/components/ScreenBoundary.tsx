import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Icon } from "./Icon";
import { useTheme } from "../lib/ThemeContext";
import { radius, space, type } from "../lib/theme";

type Props = {
  children: React.ReactNode;
  /** Nome leggibile della schermata, per sapere subito quale è caduta. */
  name: string;
  onBack?: () => void;
};

type State = { error: Error | null };

/**
 * Trasforma il crash di una schermata in un messaggio invece che in una
 * pagina bianca.
 *
 * In sviluppo un errore di render apre la schermata rossa con lo stack; nel
 * bundle di produzione — quello che gira su Expo Go dopo `eas update` — non
 * c'è nessun LogBox, e l'albero che va in errore viene semplicemente smontato:
 * resta il fondo vuoto, senza un motivo, senza una via d'uscita.
 *
 * Deve restare un **class component**: `componentDidCatch` non ha equivalente
 * fra gli hook.
 */
export class ScreenBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Finisce nei log di Metro e in quelli di Expo Go: se qualcuno segnala il
    // problema, lo stack è già stato scritto da qualche parte.
    console.error(`[${this.props.name}]`, error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <CrashNotice
        name={this.props.name}
        error={this.state.error}
        onBack={this.props.onBack}
        onRetry={() => this.setState({ error: null })}
      />
    );
  }
}

function CrashNotice({
  name,
  error,
  onBack,
  onRetry,
}: {
  name: string;
  error: Error;
  onBack?: () => void;
  onRetry: () => void;
}) {
  const { palette } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: palette.ground }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Icon name="circle-alert" size={26} color={palette.ink3} />

        <Text style={[styles.title, { color: palette.ink }]}>
          Questa schermata non si è aperta
        </Text>

        <Text style={[styles.body, { color: palette.ink2 }]}>
          Il resto dell'app funziona: puoi tornare indietro e continuare. Se
          continua a succedere, il dettaglio qui sotto dice cosa è andato
          storto.
        </Text>

        {/* Il messaggio tecnico si può selezionare e copiare apposta: è
            l'unica cosa che rende segnalabile un problema che capita solo
            sul telefono di chi lo vede. */}
        <View
          style={[
            styles.detail,
            { backgroundColor: palette.surface, borderColor: palette.hairline },
          ]}
        >
          <Text style={[styles.detailLabel, { color: palette.ink3 }]}>
            {name}
          </Text>
          <Text style={[styles.detailText, { color: palette.ink2 }]} selectable>
            {error.message || String(error)}
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: palette.accent }]}
            onPress={onRetry}
          >
            <Text style={[styles.buttonText, { color: palette.onAccent }]}>
              Riprova
            </Text>
          </TouchableOpacity>

          {onBack && (
            <TouchableOpacity
              style={[styles.button, { borderColor: palette.hairline, borderWidth: 1 }]}
              onPress={onBack}
            >
              <Text style={[styles.buttonText, { color: palette.ink2 }]}>
                Indietro
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: space.xxl,
    gap: space.sm,
  },
  title: { ...type.title, textAlign: "center", marginTop: space.xs },
  body: { ...type.body, textAlign: "center", lineHeight: 21 },
  detail: {
    alignSelf: "stretch",
    borderRadius: radius.field,
    borderWidth: 1,
    padding: 12,
    gap: 4,
    marginTop: space.sm,
  },
  detailLabel: { ...type.small, fontWeight: "500" },
  detailText: { ...type.caption, lineHeight: 18 },
  actions: { flexDirection: "row", gap: space.sm, marginTop: space.md },
  button: {
    borderRadius: radius.button,
    paddingVertical: 12,
    paddingHorizontal: 26,
    alignItems: "center",
  },
  buttonText: { ...type.bodyMedium, fontSize: 14.5 },
});
