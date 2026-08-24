import * as DocumentPicker from "expo-document-picker";
import React, { useCallback, useEffect, useState } from "react";
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
import { formatAmount, formatDate, shortDateTime } from "../lib/format";
import {
  BatchSummary,
  readImportBatches,
  undoImportBatch,
} from "../lib/importBatches";
import { readImportContext } from "../lib/importContext";
import {
  CONTESTO_VUOTO,
  rivedi,
  type NuovaRegola,
  type RigaRivista,
} from "../lib/importReview";
import { salvaRegole } from "../lib/importRules";
import {
  StatementParse,
  importFloor,
  parseStatementFile,
} from "../lib/statementImport";
import { importStatementRows, type ImportableRow } from "../lib/statementWriter";
import ImportReviewScreen from "./ImportReviewScreen";
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
  // Tre stati e non un elenco solo: un elenco vuoto perche' la lettura e'
  // fallita direbbe "non hai mai importato niente" a chi ha appena importato,
  // e con esso sparirebbe l'unico modo di annullare.
  const [lotti, setLotti] = useState<BatchSummary[] | null>(null);
  const [lottiRotti, setLottiRotti] = useState(false);
  const [annullando, setAnnullando] = useState<string | null>(null);
  // La revisione: `null` finche' non si e' scelto di aprirla.
  const [revisione, setRevisione] = useState<{
    righe: RigaRivista[];
    contestoLetto: boolean;
  } | null>(null);
  const [preparando, setPreparando] = useState(false);

  const floor = importFloor();
  const rows = (parses ?? []).flatMap((p) => p.rows);
  const uscite = rows.filter((r) => r.direction === "out").length;
  const entrate = rows.length - uscite;

  const rileggiLotti = useCallback(async () => {
    const letti = await readImportBatches();
    setLottiRotti(letti === null);
    if (letti !== null) setLotti(letti);
  }, []);

  useEffect(() => {
    rileggiLotti();
  }, [rileggiLotti]);

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

  /**
   * Prepara la revisione: legge cio' che esiste gia' e annota i sospetti.
   *
   * Un contesto non letto non blocca la revisione — le difese in scrittura
   * restano tutte — ma va **dichiarato**: senza quel confronto i doppioni non
   * si sono potuti cercare, e un elenco senza segnalazioni direbbe "non ce ne
   * sono" a chi ne ha cinquanta.
   */
  async function apriRevisione() {
    if (rows.length === 0) return;
    setPreparando(true);
    try {
      const contesto = await readImportContext(rows);
      const daRivedere = (parses ?? []).flatMap((p) =>
        p.rows.map((row) => ({ row, fileName: p.fileName }))
      );
      setRevisione({
        righe: rivedi(daRivedere, contesto ?? CONTESTO_VUOTO),
        contestoLetto: contesto !== null,
      });
    } finally {
      setPreparando(false);
    }
  }

  async function importa(finali: ImportableRow[], regole: NuovaRegola[]) {
    if (finali.length === 0) return;
    setWriting({ done: 0, total: finali.length });
    try {
      const esito = await importStatementRows(
        finali,
        (parses ?? []).map((p) => p.fileName),
        (done, total) => setWriting({ done, total })
      );

      // Si parte dal totale letto e si rende conto di ogni riga: senza il
      // denominatore, "40 importate" su 300 sembra un successo.
      const righe = [
        `${rows.length} ${rows.length === 1 ? "movimento letto" : "movimenti letti"}, ${finali.length} ${finali.length === 1 ? "scelto" : "scelti"} in revisione.`,
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

      // Le regole **dopo** l'import riuscito, non prima: si ricorda cio' che
      // e' stato fatto davvero. Un import fallito che lasciasse dietro di se'
      // delle regole riscriverebbe i prossimi in base a una cosa mai avvenuta.
      const ricordate = await salvaRegole(regole);
      if (ricordate > 0) {
        righe.push(
          `${ricordate} ${ricordate === 1 ? "scelta ricordata" : "scelte ricordate"} per i prossimi import.`
        );
      } else if (regole.length > 0) {
        righe.push(
          "⚠️ Non sono riuscito a ricordare le scelte per i prossimi import: i movimenti però sono entrati."
        );
      }

      if (esito.batchId) {
        righe.push("Puoi annullarlo da «Import fatti», qui sotto.");
      }

      Alert.alert("Import completato", righe.join("\n"));
      setParses(null);
      setRevisione(null);
      await rileggiLotti();
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

  function chiediAnnulla(lotto: BatchSummary) {
    const quante = `${lotto.ancora} ${lotto.ancora === 1 ? "movimento" : "movimenti"}`;

    // Le divisioni si dichiarano **prima**, non dopo: `payment_splits`
    // cancella a cascata sulla spesa, quindi annullare l'import porta via
    // anche i debiti collegati. E' l'unico effetto che va oltre le righe
    // importate, ed e' quello che nessuno si aspetta.
    const avviso =
      lotto.divise > 0
        ? `\n\nAttenzione: ${lotto.divise} ${lotto.divise === 1 ? "di queste spese è divisa" : "di queste spese sono divise"} con qualcuno. Annullando ${lotto.divise === 1 ? "sparisce anche la sua divisione" : "spariscono anche le loro divisioni"}.`
        : "";

    Alert.alert(
      "Annullare questo import?",
      `Tolgo ${quante} di questo import, e nient'altro. Le spese che avevi già prima restano dove sono.${avviso}`,
      [
        { text: "Lascia stare", style: "cancel" },
        {
          text: "Annulla l'import",
          style: "destructive",
          onPress: () => annulla(lotto),
        },
      ]
    );
  }

  async function annulla(lotto: BatchSummary) {
    setAnnullando(lotto.id);
    try {
      const esito = await undoImportBatch(lotto.id);
      if (!esito) {
        Alert.alert(
          "Non sono riuscito ad annullare",
          "Il lotto è rimasto dov'era: non ho tolto niente a metà. Riprova fra poco."
        );
        return;
      }

      Alert.alert(
        "Import annullato",
        `Tolte ${esito.spese} ${esito.spese === 1 ? "spesa" : "spese"} e ${esito.entrate} ${esito.entrate === 1 ? "entrata" : "entrate"}.`
      );
      await rileggiLotti();
      onImported();
    } finally {
      setAnnullando(null);
    }
  }

  if (revisione) {
    return (
      <ImportReviewScreen
        righe={revisione.righe}
        contestoLetto={revisione.contestoLetto}
        scrivendo={writing}
        onBack={() => setRevisione(null)}
        onConfirm={importa}
      />
    );
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
                  {/* Il tasto non scrive piu' niente: apre la revisione. Fra
                      la lettura e la scrittura ci deve stare un momento in cui
                      si puo' correggere, ed e' li' che si conferma davvero. */}
                  <TouchableOpacity
                    style={[styles.primary, { backgroundColor: palette.accent }]}
                    onPress={apriRevisione}
                    disabled={preparando}
                  >
                    {preparando ? (
                      <View style={styles.busyRow}>
                        <ActivityIndicator color={palette.onAccent} />
                        <Text style={[styles.primaryText, { color: palette.onAccent }]}>
                          Cerco doppioni e giri interni…
                        </Text>
                      </View>
                    ) : (
                      <Text style={[styles.primaryText, { color: palette.onAccent }]}>
                        Rivedi {rows.length}{" "}
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

        {(lottiRotti || (lotti !== null && lotti.length > 0)) && (
          <View style={[styles.card, { backgroundColor: palette.surface2 }]}>
            <View style={styles.head}>
              <Icon name="rotate-ccw-clock" size={16} color={palette.ink2} />
              <Text style={[styles.cardTitle, { color: palette.ink }]}>
                Import fatti
              </Text>
            </View>

            {lottiRotti ? (
              // Non "nessun import": qui la differenza fra "non ne hai mai
              // fatti" e "non sono riuscito a leggerli" e' la differenza fra
              // una schermata vuota e un annullamento che sembra sparito.
              <View style={styles.retryRow}>
                <Text style={[styles.body, { color: palette.over }]}>
                  Non sono riuscito a leggere gli import fatti, quindi non so
                  dirti cosa c'è da annullare.
                </Text>
                <TouchableOpacity onPress={rileggiLotti}>
                  <Text style={[styles.retryText, { color: palette.accent }]}>
                    Riprova
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={[styles.body, { color: palette.ink3 }]}>
                  Annullare toglie esattamente le righe di quell'import, e
                  nient'altro.
                </Text>
                {(lotti ?? []).map((lotto) => (
                  <BatchRow
                    key={lotto.id}
                    lotto={lotto}
                    busy={annullando === lotto.id}
                    onUndo={() => chiediAnnulla(lotto)}
                  />
                ))}
              </>
            )}
          </View>
        )}

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

/**
 * Un import fatto, con il tasto per disfarlo.
 *
 * Mostra due numeri diversi apposta: quello di quando l'import e' avvenuto e
 * quello di cosa ne resta oggi. Divergono appena si cancella una spesa a
 * mano, e mostrarne uno solo renderebbe bugiarda la conferma — "tolgo 40
 * movimenti" quando ne sono rimasti 12.
 */
function BatchRow({
  lotto,
  busy,
  onUndo,
}: {
  lotto: BatchSummary;
  busy: boolean;
  onUndo: () => void;
}) {
  const { palette } = useTheme();
  const scritte = lotto.spese + lotto.entrate;

  return (
    <View style={styles.batchRow}>
      <View style={styles.batchMain}>
        <Text style={[styles.batchFiles, { color: palette.ink }]} numberOfLines={1}>
          {lotto.file_names.length > 0
            ? lotto.file_names.join(" · ")
            : "file senza nome"}
        </Text>
        <Text style={[styles.batchMeta, { color: palette.ink3 }]}>
          {shortDateTime(lotto.created_at)} · {lotto.spese}{" "}
          {lotto.spese === 1 ? "spesa" : "spese"}, {lotto.entrate}{" "}
          {lotto.entrate === 1 ? "entrata" : "entrate"}
          {lotto.gia_presenti > 0 ? ` · ${lotto.gia_presenti} già presenti` : ""}
        </Text>
        {lotto.ancora !== scritte && (
          <Text style={[styles.batchMeta, { color: palette.ink3 }]}>
            {lotto.ancora === 0
              ? "non ne resta nessuno: le hai già tolte a mano"
              : `${lotto.ancora} ancora ${lotto.ancora === 1 ? "presente" : "presenti"}`}
          </Text>
        )}
      </View>

      {busy ? (
        <ActivityIndicator color={palette.over} />
      ) : (
        <TouchableOpacity
          onPress={onUndo}
          disabled={lotto.ancora === 0}
          // Il bersaglio e' alto quanto una riga di testo piccolo: senza
          // allargarlo il tocco manca quasi sempre, e l'unica via d'uscita da
          // un import sbagliato diventa un tasto che sembra rotto. Provato nel
          // simulatore, dove due tocchi di fila non hanno aperto niente.
          hitSlop={{ top: 14, bottom: 14, left: 16, right: 16 }}
          accessibilityRole="button"
          accessibilityLabel={`Annulla l'import di ${lotto.file_names.join(", ")}`}
        >
          <Text
            style={[
              styles.batchUndo,
              { color: lotto.ancora === 0 ? palette.ink3 : palette.over },
            ]}
          >
            Annulla
          </Text>
        </TouchableOpacity>
      )}
    </View>
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
  batchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: 7,
  },
  batchMain: { flex: 1, gap: 1 },
  batchFiles: { ...type.caption, fontWeight: "500" },
  batchMeta: { ...type.small, lineHeight: 15 },
  batchUndo: { ...type.small, fontWeight: "500" },
  retryRow: { gap: space.xs },
  retryText: { ...type.small, fontWeight: "500" },
  ghost: { alignItems: "center", paddingVertical: 4 },
  ghostText: { ...type.small },
  note: { ...type.small, lineHeight: 16 },
});
