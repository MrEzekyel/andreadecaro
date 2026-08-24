import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Icon } from "../components/Icon";
import { ImportGroupSheet, type Gruppo } from "../components/ImportGroupSheet";
import { ImportRowSheet } from "../components/ImportRowSheet";
import { SwipeBack, backHitSlop } from "../components/SwipeBack";
import { formatAmount, formatDate } from "../lib/format";
import {
  applicaDecisione,
  conteggia,
  decisioneIniziale,
  distribuzionePerMese,
  regolaDaDecisione,
  spostaMesi,
  type Decisione,
  type NuovaRegola,
  type RigaRivista,
} from "../lib/importReview";
import type { ImportableRow } from "../lib/statementWriter";
import { useTheme } from "../lib/ThemeContext";
import { radius, space, type } from "../lib/theme";

type Props = {
  righe: RigaRivista[];
  /** `false` quando il contesto non si e' letto: i doppioni non si sono potuti cercare. */
  contestoLetto: boolean;
  scrivendo: { done: number; total: number } | null;
  onBack: () => void;
  onConfirm: (righe: ImportableRow[], regole: NuovaRegola[]) => void;
};

type Voce =
  | { kind: "riga"; riga: RigaRivista }
  | { kind: "gruppo"; nome: string; righe: RigaRivista[] };

/**
 * La revisione: fra cio' che si e' letto dal file e cio' che si scrive.
 *
 * Prima qui non c'era niente. L'anteprima mostrava cinque righe e poi si
 * scriveva: fra la lettura e la scrittura non esisteva nessun momento in cui
 * si potesse correggere qualcosa, e sistemare un import andato storto voleva
 * dire interrogare il database a mano — cosa che nessun utente potra' mai
 * fare.
 *
 * Tre sezioni, in quest'ordine per un motivo:
 *
 *  1. **Da controllare** in cima, perche' sono le righe che cambiano i
 *     totali: un giro fra conti propri gonfia sia le uscite sia le entrate.
 *  2. **Per esercente** in mezzo, raggruppate: trecento righe in elenco piatto
 *     non si guardano, quaranta gruppi si'.
 *  3. **Escluse** in fondo, sempre visibili e sempre reversibili. Non
 *     spariscono mai in silenzio: una riga tolta che non si vede piu' e' una
 *     riga persa senza saperlo.
 *
 * In testa il conto che deve tornare sempre, e che si aggiorna a ogni
 * modifica: lette = quelle che entrano + escluse.
 */
export default function ImportReviewScreen({
  righe,
  contestoLetto,
  scrivendo,
  onBack,
  onConfirm,
}: Props) {
  const { palette } = useTheme();

  const [decisioni, setDecisioni] = useState<Decisione[]>(() =>
    righe.map(decisioneIniziale)
  );
  const [aperto, setAperto] = useState<Set<string>>(new Set());
  const [inModifica, setInModifica] = useState<number | null>(null);
  const [gruppoAperto, setGruppoAperto] = useState<Gruppo | null>(null);

  const conti = useMemo(() => conteggia(righe, decisioni), [righe, decisioni]);
  const mesi = useMemo(
    () => distribuzionePerMese(righe, decisioni),
    [righe, decisioni]
  );

  /** La data di una riga, gia' corretta a mano se lo e'. */
  const dataDi = (i: number) => decisioni[i]?.data ?? righe[i].row.date;

  /** Il nome che una riga porta adesso, correzioni comprese. */
  const nomeDi = (i: number) =>
    decisioni[i]?.descrizione ?? righe[i].row.description;

  function cambia(indice: number, decisione: Decisione) {
    setDecisioni((precedenti) =>
      precedenti.map((d, i) => (i === indice ? decisione : d))
    );
  }

  /**
   * Applica la stessa trasformazione a tutte le righe di un gruppo.
   *
   * Passa anche l'indice perche' certe azioni non sono uguali per tutte: lo
   * spostamento delle date parte dalla data di *quella* riga, non da una sola
   * per tutto il gruppo.
   */
  function applicaAlGruppo(
    indici: number[],
    trasforma: (decisione: Decisione, indice: number) => Decisione
  ) {
    const insieme = new Set(indici);
    setDecisioni((precedenti) =>
      precedenti.map((d, i) => (insieme.has(i) ? trasforma(d, i) : d))
    );
  }

  function rinominaTutte(daNome: string, aNome: string) {
    setDecisioni((precedenti) =>
      precedenti.map((d, i) =>
        (d.descrizione ?? righe[i].row.description) === daNome
          ? { ...d, descrizione: aNome }
          : d
      )
    );
  }

  const sezioni = useMemo(() => {
    const daControllare: Voce[] = [];
    const escluse: Voce[] = [];
    const perNome = new Map<string, RigaRivista[]>();

    righe.forEach((riga, i) => {
      const decisione = decisioni[i] ?? decisioneIniziale(riga);
      if (decisione.esclusa) {
        escluse.push({ kind: "riga", riga });
        return;
      }
      if (riga.sospetti.length > 0) {
        daControllare.push({ kind: "riga", riga });
        return;
      }
      const nome = nomeDi(i);
      const elenco = perNome.get(nome);
      if (elenco) elenco.push(riga);
      else perNome.set(nome, [riga]);
    });

    const gruppi: Voce[] = [...perNome.entries()]
      .map(([nome, elenco]) => ({ kind: "gruppo" as const, nome, righe: elenco }))
      // Il gruppo piu' pesante per primo: e' quello su cui vale la pena
      // guardare, non quello che capita per primo in ordine alfabetico.
      .sort(
        (a, b) =>
          b.righe.reduce((s, r) => s + r.row.amount, 0) -
          a.righe.reduce((s, r) => s + r.row.amount, 0)
      );

    return [
      { title: "Da controllare", data: daControllare, vuoto: "niente da controllare" },
      { title: "Per esercente", data: gruppi, vuoto: "nessuna riga" },
      { title: "Escluse", data: escluse, vuoto: "nessuna esclusa" },
    ].filter((s) => s.data.length > 0);
  }, [righe, decisioni]);

  function conferma() {
    const finali: ImportableRow[] = [];
    const regole: NuovaRegola[] = [];

    righe.forEach((riga, i) => {
      const decisione = decisioni[i] ?? decisioneIniziale(riga);

      // Le regole si raccolgono anche dalle righe escluse: "questo escludilo
      // sempre" e' proprio la regola che serve di piu', ed e' su una riga che
      // non entrera'.
      if (decisione.ricorda) {
        const regola = regolaDaDecisione(riga, decisione);
        if (regola) regole.push(regola);
      }

      if (decisione.esclusa) return;
      finali.push(applicaDecisione(riga, decisione));
    });

    onConfirm(finali, regole);
  }

  const rigaInModifica = inModifica === null ? null : righe[inModifica];

  return (
    <SwipeBack onBack={onBack}>
      <View style={{ flex: 1, backgroundColor: palette.ground }}>
        <SectionList
          sections={sezioni}
          keyExtractor={(voce, i) =>
            voce.kind === "riga" ? `r${voce.riga.indice}` : `g${voce.nome}-${i}`
          }
          contentContainerStyle={styles.content}
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={
            <View style={styles.testata}>
              <TouchableOpacity
                onPress={onBack}
                hitSlop={backHitSlop}
                style={styles.back}
              >
                <Icon name="chevron-left" size={18} color={palette.ink2} />
                <Text style={[styles.backText, { color: palette.ink2 }]}>
                  Importa
                </Text>
              </TouchableOpacity>

              <Text style={[styles.title, { color: palette.ink }]}>Revisione</Text>

              {/* Il conto in testa, non in fondo: e' il numero che decide se
                  premere il tasto, e deve essere l'ultima cosa letta prima. */}
              <Text style={[styles.somma, { color: palette.ink2 }]}>
                Entrano{" "}
                <Text style={{ color: palette.ink, fontWeight: "600" }}>
                  {conti.uscite + conti.entrate}
                </Text>{" "}
                {conti.uscite + conti.entrate === 1 ? "movimento" : "movimenti"} su{" "}
                {righe.length}
              </Text>
              <Text style={[styles.dettaglio, { color: palette.ink3 }]}>
                {conti.uscite} in uscita per {formatAmount(conti.totaleUscite)} ·{" "}
                {conti.entrate} in entrata per {formatAmount(conti.totaleEntrate)}
              </Text>
              <Text style={[styles.dettaglio, { color: palette.ink3 }]}>
                {conti.escluse} escluse
                {conti.giaPresenti > 0
                  ? ` (${conti.giaPresenti} già registrate)`
                  : ""}
              </Text>

              {!contestoLetto && (
                // Un elenco senza doppioni segnalati direbbe "non ce ne sono"
                // a chi ne ha cinquanta: la differenza fra "non ce n'erano" e
                // "non ho potuto guardare" va detta, non lasciata intendere.
                <View style={[styles.avviso, { borderColor: palette.over }]}>
                  <Icon name="circle-alert" size={14} color={palette.over} />
                  <Text style={[styles.avvisoText, { color: palette.ink2 }]}>
                    Non sono riuscito a leggere i movimenti già registrati: qui
                    sotto non trovi segnalati i doppioni. Le difese in scrittura
                    restano attive, ma controlla tu.
                  </Text>
                </View>
              )}
            </View>
          }
          renderSectionHeader={({ section }) => (
            <Text style={[styles.sezione, { color: palette.ink3 }]}>
              {section.title}
              <Text style={{ color: palette.ink3 }}>
                {"  "}
                {section.data.length}
              </Text>
            </Text>
          )}
          renderItem={({ item }) =>
            item.kind === "riga" ? (
              <RigaRow
                riga={item.riga}
                decisione={decisioni[item.riga.indice]}
                nome={nomeDi(item.riga.indice)}
                onPress={() => setInModifica(item.riga.indice)}
                onToggle={() =>
                  cambia(item.riga.indice, {
                    ...decisioni[item.riga.indice],
                    esclusa: !decisioni[item.riga.indice].esclusa,
                  })
                }
              />
            ) : (
              <GruppoRow
                nome={item.nome}
                righe={item.righe}
                aperto={aperto.has(item.nome)}
                onToggle={() =>
                  setAperto((precedente) => {
                    const nuovo = new Set(precedente);
                    if (nuovo.has(item.nome)) nuovo.delete(item.nome);
                    else nuovo.add(item.nome);
                    return nuovo;
                  })
                }
                onAzioni={() =>
                  setGruppoAperto({
                    nome: item.nome,
                    indici: item.righe.map((r) => r.indice),
                    totale: item.righe.reduce((s, r) => s + r.row.amount, 0),
                    tutteEscluse: item.righe.every(
                      (r) => decisioni[r.indice]?.esclusa
                    ),
                  })
                }
                decisioni={decisioni}
                nomeDi={nomeDi}
                onApriRiga={setInModifica}
                onEscludiRiga={(indice) =>
                  cambia(indice, { ...decisioni[indice], esclusa: true })
                }
              />
            )
          }
        />

        <View style={[styles.barra, { backgroundColor: palette.ground, borderColor: palette.hairline }]}>
          <TouchableOpacity
            style={[styles.primary, { backgroundColor: palette.accent }]}
            onPress={conferma}
            disabled={scrivendo !== null || conti.uscite + conti.entrate === 0}
          >
            {scrivendo ? (
              <View style={styles.busyRow}>
                <ActivityIndicator color={palette.onAccent} />
                <Text style={[styles.primaryText, { color: palette.onAccent }]}>
                  {scrivendo.done} di {scrivendo.total}
                </Text>
              </View>
            ) : (
              <Text style={[styles.primaryText, { color: palette.onAccent }]}>
                {conti.uscite + conti.entrate === 0
                  ? "Non resta niente da importare"
                  : `Importa ${conti.uscite + conti.entrate} ${conti.uscite + conti.entrate === 1 ? "movimento" : "movimenti"}`}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <ImportGroupSheet
          visible={gruppoAperto !== null}
          gruppo={gruppoAperto}
          onClose={() => setGruppoAperto(null)}
          onApply={(trasforma) => {
            if (gruppoAperto) applicaAlGruppo(gruppoAperto.indici, trasforma);
          }}
          mesi={mesi}
          anteprimaSpostamento={(quanti) => {
            if (!gruppoAperto) return mesi;
            const insieme = new Set(gruppoAperto.indici);
            return distribuzionePerMese(
              righe,
              decisioni.map((d, i) =>
                insieme.has(i) ? { ...d, data: spostaMesi(dataDi(i), quanti) } : d
              )
            );
          }}
          dataDi={dataDi}
        />

        <ImportRowSheet
          visible={inModifica !== null}
          riga={rigaInModifica}
          decisione={
            inModifica === null
              ? { esclusa: false }
              : decisioni[inModifica]
          }
          onClose={() => setInModifica(null)}
          onSave={(decisione) => {
            if (inModifica !== null) cambia(inModifica, decisione);
          }}
          onRenameAll={rinominaTutte}
          quanteConQuestoNome={
            inModifica === null
              ? 0
              : righe.filter((_, i) => nomeDi(i) === nomeDi(inModifica)).length
          }
        />
      </View>
    </SwipeBack>
  );
}

/** Una riga, con il motivo del sospetto sotto al nome. */
function RigaRow({
  riga,
  decisione,
  nome,
  onPress,
  onToggle,
}: {
  riga: RigaRivista;
  decisione: Decisione;
  nome: string;
  onPress: () => void;
  onToggle: () => void;
}) {
  const { palette } = useTheme();
  const finale = applicaDecisione(riga, decisione);
  const entrata = finale.direction === "in";

  return (
    <TouchableOpacity style={styles.riga} onPress={onPress}>
      <View style={styles.rigaMain}>
        <Text
          style={[
            styles.rigaNome,
            { color: decisione.esclusa ? palette.ink3 : palette.ink },
          ]}
          numberOfLines={1}
        >
          {nome}
        </Text>
        <Text style={[styles.rigaMeta, { color: palette.ink3 }]} numberOfLines={2}>
          {formatDate(finale.date.toISOString())}
          {riga.sospetti.length > 0 ? ` · ${riga.sospetti[0].motivo}` : ""}
        </Text>
      </View>

      <View style={styles.rigaNumeri}>
        <Text
          style={[
            styles.rigaImporto,
            {
              color: decisione.esclusa
                ? palette.ink3
                : entrata
                  ? palette.good
                  : palette.ink,
              textDecorationLine: decisione.esclusa ? "line-through" : "none",
            },
          ]}
        >
          {entrata ? "+" : "−"}
          {formatAmount(finale.amount)}
        </Text>
      </View>

      <TouchableOpacity
        onPress={onToggle}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel={decisione.esclusa ? "Rimetti dentro" : "Escludi"}
      >
        <Icon
          name={decisione.esclusa ? "rotate-ccw" : "circle-minus"}
          size={17}
          color={decisione.esclusa ? palette.good : palette.ink3}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

/** Un esercente con tutte le sue righe, richiuso finche' non serve. */
function GruppoRow({
  nome,
  righe,
  aperto,
  onToggle,
  onAzioni,
  decisioni,
  nomeDi,
  onApriRiga,
  onEscludiRiga,
}: {
  nome: string;
  righe: RigaRivista[];
  aperto: boolean;
  onToggle: () => void;
  onAzioni: () => void;
  decisioni: Decisione[];
  nomeDi: (i: number) => string;
  onApriRiga: (indice: number) => void;
  onEscludiRiga: (indice: number) => void;
}) {
  const { palette } = useTheme();
  const totale = righe.reduce((s, r) => s + r.row.amount, 0);

  return (
    <View>
      <TouchableOpacity
        style={styles.gruppo}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: aperto }}
      >
        <Icon
          name={aperto ? "chevron-down" : "chevron-right"}
          size={15}
          color={palette.ink3}
        />
        <View style={styles.rigaMain}>
          <Text style={[styles.rigaNome, { color: palette.ink }]} numberOfLines={1}>
            {nome}
          </Text>
          <Text style={[styles.rigaMeta, { color: palette.ink3 }]}>
            {righe.length} {righe.length === 1 ? "movimento" : "movimenti"}
          </Text>
        </View>
        <Text style={[styles.rigaImporto, { color: palette.ink }]}>
          {formatAmount(totale)}
        </Text>

        {/* Bersaglio separato da quello che apre il gruppo: con un tocco solo
            che fa due cose diverse a seconda di dove cade, l'una si scopre
            per sbaglio mentre si cercava l'altra. */}
        <TouchableOpacity
          onPress={onAzioni}
          hitSlop={{ top: 14, bottom: 14, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel={`Azioni su tutte le righe di ${nome}`}
        >
          <Icon name="sliders-horizontal" size={16} color={palette.ink3} />
        </TouchableOpacity>
      </TouchableOpacity>

      {aperto &&
        righe.map((riga) => (
          <View key={riga.indice} style={styles.dentro}>
            <RigaRow
              riga={riga}
              decisione={decisioni[riga.indice]}
              nome={nomeDi(riga.indice)}
              onPress={() => onApriRiga(riga.indice)}
              onToggle={() => onEscludiRiga(riga.indice)}
            />
          </View>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: 96 },
  testata: { gap: 2, marginBottom: space.md },
  back: { flexDirection: "row", alignItems: "center", gap: 2, marginLeft: -6 },
  backText: { ...type.body },
  title: { ...type.title, marginTop: 4 },
  somma: { ...type.body, marginTop: 6 },
  dettaglio: { ...type.small, lineHeight: 17 },
  avviso: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderWidth: 1,
    borderRadius: radius.field,
    padding: 11,
    marginTop: space.sm,
  },
  avvisoText: { ...type.small, lineHeight: 16, flex: 1 },
  sezione: { ...type.label, marginTop: space.lg, marginBottom: 4 },
  riga: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: 9,
  },
  rigaMain: { flex: 1, gap: 1 },
  rigaNome: { ...type.caption, fontWeight: "500" },
  rigaMeta: { ...type.small, lineHeight: 15 },
  rigaNumeri: { alignItems: "flex-end" },
  rigaImporto: { ...type.small, fontWeight: "500", fontVariant: ["tabular-nums"] },
  gruppo: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: 10,
  },
  dentro: { paddingLeft: space.lg },
  barra: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.xl,
  },
  primary: {
    borderRadius: radius.button,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryText: { ...type.caption, fontWeight: "500" },
  busyRow: { flexDirection: "row", alignItems: "center", gap: 8 },
});
