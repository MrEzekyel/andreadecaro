import * as DocumentPicker from "expo-document-picker";
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
import { RecoverSheet } from "../components/RecoverSheet";
import { SwipeBack, backHitSlop } from "../components/SwipeBack";
import { formatAmount, formatDate } from "../lib/format";
import {
  StatementParse,
  importFloor,
  parseStatementFile,
} from "../lib/statementImport";
import { importStatementRows } from "../lib/statementWriter";
import { useTheme } from "../lib/ThemeContext";
import { radius, space, type } from "../lib/theme";

type Props = {
  onBack: () => void;
  /** Chiamata dopo un import riuscito: gli elenchi vanno riletti. */
  onImported: () => void;
};

/**
 * L'unico posto da cui entrano movimenti da un file.
 *
 * Prima il recupero delle spese non inviate stava fra le automazioni, dove
 * nessuno lo cercava: chi ha una spesa mancante la nota guardando l'elenco dei
 * movimenti, non aprendo le impostazioni della Shortcut. I due import vivono
 * ora nello stesso posto perche' rispondono alla stessa domanda — "manca
 * qualcosa, come lo aggiungo?" — anche se dentro sono due meccanismi diversi.
 *
 * Fra la lettura del file e la scrittura c'e' sempre un passaggio di conferma:
 * nessun import parte da solo. Cio' che si e' capito del file (quali colonne,
 * quante righe, quante scartate e perche') si mostra **prima**, non dopo, ed
 * e' l'unico modo perche' un riconoscimento sbagliato si veda finche' e'
 * ancora annullabile.
 */
export default function ImportScreen({ onBack, onImported }: Props) {
  const { palette } = useTheme();

  const [reading, setReading] = useState(false);
  const [parses, setParses] = useState<StatementParse[] | null>(null);
  const [writing, setWriting] = useState<{ done: number; total: number } | null>(
    null
  );

  const floor = importFloor();
  const rows = (parses ?? []).flatMap((p) => p.rows);
  const uscite = rows.filter((r) => r.direction === "out").length;
  const entrate = rows.length - uscite;

  async function scegli() {
    const scelta = await DocumentPicker.getDocumentAsync({
      // `*/*` incluso di proposito: iOS assegna spesso ai CSV esportati dalle
      // banche un tipo generico, e senza questo non comparirebbero nemmeno
      // nel selettore.
      type: ["text/csv", "text/comma-separated-values", "public.comma-separated-values-text", "text/plain", "*/*"],
      multiple: true,
      copyToCacheDirectory: true,
    });

    const files = scelta.assets ?? [];
    if (scelta.canceled || files.length === 0) return;

    setReading(true);
    try {
      const letti: StatementParse[] = [];
      for (const file of files) {
        try {
          letti.push(await parseStatementFile(file.uri, file.name, floor));
        } catch (error) {
          letti.push({
            fileName: file.name,
            mapping: null,
            problem:
              error instanceof Error ? error.message : "Non sono riuscito ad aprirlo.",
            rows: [],
            unreadable: 0,
            outOfRange: 0,
            ignored: 0,
          });
        }
      }
      setParses(letti);
    } finally {
      setReading(false);
    }
  }

  async function importa() {
    if (rows.length === 0) return;
    setWriting({ done: 0, total: rows.length });
    try {
      const esito = await importStatementRows(rows, (done, total) =>
        setWriting({ done, total })
      );

      // Si parte dal totale letto e si rende conto di ogni riga: senza il
      // denominatore, "40 importate" su 300 sembra un successo.
      const righe = [
        `${rows.length} ${rows.length === 1 ? "movimento letto" : "movimenti letti"}.`,
        `${esito.spese} ${esito.spese === 1 ? "spesa" : "spese"} e ${esito.entrate} ${esito.entrate === 1 ? "entrata" : "entrate"} aggiunte.`,
      ];
      if (esito.giaPresenti > 0) {
        righe.push(
          `${esito.giaPresenti} ${esito.giaPresenti === 1 ? "era già registrata" : "erano già registrate"} e ${esito.giaPresenti === 1 ? "è stata saltata" : "sono state saltate"}.`
        );
      }
      if (esito.fallite > 0) {
        righe.push(
          `⚠️ ${esito.fallite} ${esito.fallite === 1 ? "non è stata salvata" : "non sono state salvate"} dal database. Riprova: i doppioni vengono riconosciuti.`
        );
      }

      Alert.alert("Import completato", righe.join("\n"));
      setParses(null);
      onImported();
    } catch (error) {
      Alert.alert(
        "Import non riuscito",
        error instanceof Error ? error.message : "Riprova fra poco."
      );
    } finally {
      setWriting(null);
    }
  }

  return (
    <SwipeBack onBack={onBack}>
      <ScrollView
        style={{ backgroundColor: palette.ground }}
        contentContainerStyle={styles.content}
      >
        <TouchableOpacity onPress={onBack} hitSlop={backHitSlop} style={styles.back}>
          <Icon name="chevron-left" size={18} color={palette.ink2} />
          <Text style={[styles.backText, { color: palette.ink2 }]}>Movimenti</Text>
        </TouchableOpacity>

        <View>
          <Text style={[styles.title, { color: palette.ink }]}>Importa</Text>
          <Text style={[styles.subtitle, { color: palette.ink3 }]}>
            da un estratto conto, o dalle spese rimaste indietro
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: palette.surface2 }]}>
          <View style={styles.head}>
            <Icon name="landmark" size={16} color={palette.ink2} />
            <Text style={[styles.cardTitle, { color: palette.ink }]}>
              Estratto conto
            </Text>
          </View>

          <Text style={[styles.body, { color: palette.ink3 }]}>
            Scarica il CSV dalla tua banca e scegli il file: le colonne le
            riconosco da solo, non c'è niente da impostare. Puoi selezionare più
            file insieme, anche di banche diverse. Entro l'import restano i
            movimenti da gennaio {floor.getFullYear()} in poi, e quelli già
            registrati vengono riconosciuti e saltati.
          </Text>

          {parses === null ? (
            <TouchableOpacity
              style={[styles.button, { borderColor: palette.hairline }]}
              onPress={scegli}
              disabled={reading}
            >
              {reading ? (
                <ActivityIndicator color={palette.accent} />
              ) : (
                <Text style={[styles.buttonText, { color: palette.accent }]}>
                  Scegli i file
                </Text>
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.results}>
              {parses.map((parse, index) => (
                <FileSummary key={`${parse.fileName}-${index}`} parse={parse} />
              ))}

              {rows.length > 0 && (
                <>
                  <Preview parse={parses} />
                  <TouchableOpacity
                    style={[styles.primary, { backgroundColor: palette.accent }]}
                    onPress={importa}
                    disabled={writing !== null}
                  >
                    {writing ? (
                      <View style={styles.busyRow}>
                        <ActivityIndicator color={palette.onAccent} />
                        <Text style={[styles.primaryText, { color: palette.onAccent }]}>
                          {writing.done} di {writing.total}
                        </Text>
                      </View>
                    ) : (
                      <Text style={[styles.primaryText, { color: palette.onAccent }]}>
                        Importa {rows.length}{" "}
                        {rows.length === 1 ? "movimento" : "movimenti"}
                        {entrate > 0 && uscite > 0
                          ? ` (${uscite} in uscita, ${entrate} in entrata)`
                          : ""}
                      </Text>
                    )}
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity
                style={styles.ghost}
                onPress={() => setParses(null)}
                disabled={writing !== null}
              >
                <Text style={[styles.ghostText, { color: palette.ink3 }]}>
                  Scegli altri file
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <RecoverSheet onDone={onImported} />

        <Text style={[styles.note, { color: palette.ink3 }]}>
          Le spese importate arrivano senza categoria se l'esercente è nuovo, e
          già categorizzate se lo conosci già: sono le stesse regole di quelle
          che entrano da sole.
        </Text>
      </ScrollView>
    </SwipeBack>
  );
}

/** Cosa ho capito di questo file, prima di scrivere niente. */
function FileSummary({ parse }: { parse: StatementParse }) {
  const { palette } = useTheme();

  if (parse.problem || !parse.mapping) {
    return (
      <View style={styles.fileBlock}>
        <Text style={[styles.fileName, { color: palette.ink }]} numberOfLines={1}>
          {parse.fileName}
        </Text>
        <Text style={[styles.problem, { color: palette.over }]}>{parse.problem}</Text>
      </View>
    );
  }

  const { mapping } = parse;
  const importo =
    mapping.amount.kind === "signed"
      ? mapping.amount.header
      : `${mapping.amount.debitHeader} / ${mapping.amount.creditHeader}`;

  const scarti: string[] = [];
  if (parse.outOfRange > 0) {
    scarti.push(
      `${parse.outOfRange} più ${parse.outOfRange === 1 ? "vecchio" : "vecchi"} del limite`
    );
  }
  if (parse.unreadable > 0) scarti.push(`${parse.unreadable} illeggibili`);
  if (parse.ignored > 0) scarti.push(`${parse.ignored} senza importo`);

  return (
    <View style={styles.fileBlock}>
      <Text style={[styles.fileName, { color: palette.ink }]} numberOfLines={1}>
        {parse.fileName}
      </Text>
      <Text style={[styles.fileMeta, { color: palette.ink2 }]}>
        {parse.rows.length}{" "}
        {parse.rows.length === 1 ? "movimento riconosciuto" : "movimenti riconosciuti"}
        {scarti.length > 0 ? ` · ${scarti.join(", ")}` : ""}
      </Text>
      <Text style={[styles.mapping, { color: palette.ink3 }]}>
        data «{mapping.date}» · importo «{importo}»
        {mapping.description ? ` · descrizione «${mapping.description}»` : ""}
      </Text>
      {!mapping.description && (
        <Text style={[styles.problem, { color: palette.warn }]}>
          Nessuna colonna con la descrizione: le spese entrano senza il nome del
          negozio.
        </Text>
      )}
    </View>
  );
}

/** Le prime righe cosi' come verranno salvate. */
function Preview({ parse }: { parse: StatementParse[] }) {
  const { palette } = useTheme();
  const rows = parse.flatMap((p) => p.rows).slice(0, 5);

  return (
    <View style={styles.preview}>
      <Text style={[styles.label, { color: palette.ink3 }]}>Anteprima</Text>
      {rows.map((row, index) => (
        <View key={index} style={styles.previewRow}>
          <View style={styles.previewMain}>
            <Text style={[styles.previewName, { color: palette.ink }]} numberOfLines={1}>
              {row.description}
            </Text>
            <Text style={[styles.previewDate, { color: palette.ink3 }]}>
              {formatDate(row.date.toISOString())}
            </Text>
          </View>
          <Text
            style={[
              styles.previewAmount,
              { color: row.direction === "in" ? palette.good : palette.ink },
            ]}
          >
            {row.direction === "in" ? "+" : "−"}
            {formatAmount(row.amount)}
            {row.currency ? ` ${row.currency}` : ""}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: space.lg,
    paddingBottom: space.xxl,
    gap: space.lg,
  },
  back: { flexDirection: "row", alignItems: "center", gap: 2, marginLeft: -6 },
  backText: { ...type.body },
  title: { ...type.title },
  subtitle: { ...type.caption, marginTop: 2 },
  card: { borderRadius: radius.card, padding: space.lg, gap: space.sm },
  head: { flexDirection: "row", alignItems: "center", gap: 7 },
  cardTitle: { ...type.bodyMedium },
  body: { ...type.small, lineHeight: 16 },
  button: {
    borderWidth: 1,
    borderRadius: radius.button,
    paddingVertical: 11,
    alignItems: "center",
    marginTop: space.xs,
  },
  buttonText: { ...type.caption, fontWeight: "500" },
  results: { gap: space.md, marginTop: space.xs },
  fileBlock: { gap: 2 },
  fileName: { ...type.body, fontWeight: "500" },
  fileMeta: { ...type.small, lineHeight: 15 },
  mapping: { ...type.small, lineHeight: 15 },
  problem: { ...type.small, lineHeight: 15 },
  preview: { gap: space.xs },
  label: { ...type.label },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: 5,
  },
  previewMain: { flex: 1 },
  previewName: { ...type.caption },
  previewDate: { ...type.small, marginTop: 1 },
  previewAmount: { ...type.small, fontWeight: "500", fontVariant: ["tabular-nums"] },
  primary: {
    borderRadius: radius.button,
    paddingVertical: 13,
    alignItems: "center",
  },
  primaryText: { ...type.caption, fontWeight: "500" },
  busyRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  ghost: { alignItems: "center", paddingVertical: 4 },
  ghostText: { ...type.small },
  note: { ...type.small, lineHeight: 16 },
});
