import React, { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useData } from "../lib/DataContext";
import { formatAmount, monthShort } from "../lib/format";
import { spostaMesi, type Decisione, type MeseImport } from "../lib/importReview";
import { useTheme } from "../lib/ThemeContext";
import { radius, space, type } from "../lib/theme";
import { AddPersonSheet } from "./AddPersonSheet";
import { CategoryPicker } from "./CategoryPicker";
import { Icon } from "./Icon";
import { Sheet } from "./Sheet";

export type Gruppo = {
  nome: string;
  /** Gli indici delle righe che lo compongono. */
  indici: number[];
  totale: number;
  /** Tutte escluse? Decide se il tasto offre di togliere o di rimettere. */
  tutteEscluse: boolean;
};

type Props = {
  visible: boolean;
  gruppo: Gruppo | null;
  onClose: () => void;
  /** Applica una trasformazione a ogni decisione del gruppo. */
  onApply: (trasforma: (decisione: Decisione, indice: number) => Decisione) => void;
  /** La distribuzione per mese **di tutto l'import**, non del solo gruppo. */
  mesi: MeseImport[];
  /** Come sarebbe la distribuzione spostando questo gruppo di N mesi. */
  anteprimaSpostamento: (mesi: number) => MeseImport[];
  /**
   * La data da cui partire per lo spostamento, gia' corretta a mano se lo e'.
   *
   * Arriva da fuori perche' qui dentro le righe non si conoscono, solo le
   * decisioni. Passata come prop e non tenuta in un modulo: una variabile
   * condivisa fra istanze e' il tipo di stato che sopravvive a una ricarica e
   * poi sposta le date di un gruppo che non e' piu' quello aperto.
   */
  dataDi: (indice: number) => Date;
};

/**
 * Le azioni su un intero esercente.
 *
 * Quaranta righe di McDonald's non si correggono una per una, e chiedere di
 * farlo e' il modo piu' sicuro perche' nessuno corregga niente. Le stesse
 * cose che si fanno su una riga, fatte su tutte insieme.
 *
 * Lo spostamento delle date sta qui e non nella riga singola perche' e' il
 * caso dello **stipendio**: arriva il 27, 28 o 29 ma e' lo stipendio del mese
 * dopo, e va spostato in blocco o non serve a niente. Senza, ogni mese
 * risulta con lo stipendio sbagliato e uno finisce con due.
 */
export function ImportGroupSheet({
  visible,
  gruppo,
  onClose,
  onApply,
  mesi,
  anteprimaSpostamento,
  dataDi,
}: Props) {
  const { palette } = useTheme();
  const { people, reload } = useData();

  const [nome, setNome] = useState("");
  const [aggiungoPersona, setAggiungoPersona] = useState(false);
  /** Lo spostamento scelto ma non ancora applicato: prima si guarda. */
  const [spostamento, setSpostamento] = useState(0);
  const [ricorda, setRicorda] = useState(false);

  useEffect(() => {
    if (!visible || !gruppo) return;
    setNome(gruppo.nome);
    setSpostamento(0);
    setRicorda(false);
  }, [visible, gruppo]);

  if (!gruppo) return null;

  const quante = gruppo.indici.length;
  const tutte = `tutte e ${quante}`;
  const anteprima = spostamento === 0 ? mesi : anteprimaSpostamento(spostamento);

  function applica(
    trasforma: (decisione: Decisione, indice: number) => Decisione
  ) {
    // La spunta "ricorda" viaggia insieme all'azione: cosi' vale per
    // qualunque delle azioni qui sotto si scelga, senza doverla ripetere
    // accanto a ognuna.
    onApply((d, i) => ({ ...trasforma(d, i), ricorda: ricorda || d.ricorda }));
    onClose();
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={gruppo.nome} dim>
      <Text style={[styles.sommario, { color: palette.ink3 }]}>
        {quante} {quante === 1 ? "movimento" : "movimenti"} ·{" "}
        {formatAmount(gruppo.totale)}
      </Text>

      <View>
        <Text style={[styles.fieldLabel, { color: palette.ink3 }]}>
          Rinomina {tutte}
        </Text>
        <View style={styles.riga}>
          <TextInput
            value={nome}
            onChangeText={setNome}
            placeholder="Nome"
            placeholderTextColor={palette.ink3}
            style={[
              styles.input,
              {
                flex: 1,
                backgroundColor: palette.surface,
                borderColor: palette.hairline,
                color: palette.ink,
              },
            ]}
          />
          <TouchableOpacity
            style={[
              styles.applica,
              {
                borderColor:
                  nome.trim() && nome.trim() !== gruppo.nome
                    ? palette.accent
                    : palette.hairline,
              },
            ]}
            disabled={!nome.trim() || nome.trim() === gruppo.nome}
            onPress={() =>
              applica((d) => ({ ...d, descrizione: nome.trim() }))
            }
          >
            <Text
              style={[
                styles.applicaText,
                {
                  color:
                    nome.trim() && nome.trim() !== gruppo.nome
                      ? palette.accent
                      : palette.ink3,
                },
              ]}
            >
              Applica
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View>
        <Text style={[styles.fieldLabel, { color: palette.ink3 }]}>
          Categoria a {tutte}
        </Text>
        {/* Sceglierla la applica subito: un secondo tasto "conferma" per una
            categoria gia' scelta e' un passaggio che non decide niente. */}
        <CategoryPicker
          value={null}
          onChange={(id) => applica((d) => ({ ...d, categoriaId: id }))}
        />
      </View>

      <View>
        <Text style={[styles.fieldLabel, { color: palette.ink3 }]}>
          Collega {tutte} a un contatto
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.strip}
        >
          {people.map((persona) => (
            <TouchableOpacity
              key={persona.id}
              onPress={() => applica((d) => ({ ...d, personaId: persona.id }))}
              style={[styles.chip, { borderColor: palette.hairline }]}
            >
              <Text style={[styles.chipText, { color: palette.ink2 }]}>
                {persona.name}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            onPress={() => setAggiungoPersona(true)}
            style={[styles.chip, { borderColor: palette.hairline }]}
            accessibilityLabel="Nuovo contatto"
          >
            <Icon name="plus" size={14} color={palette.ink3} />
          </TouchableOpacity>
        </ScrollView>
      </View>

      <View>
        <Text style={[styles.fieldLabel, { color: palette.ink3 }]}>
          Sposta le date di {tutte}
        </Text>
        <View style={styles.riga}>
          {[-1, 1].map((mesiDaSpostare) => {
            const scelto = spostamento === mesiDaSpostare;
            return (
              <TouchableOpacity
                key={mesiDaSpostare}
                onPress={() =>
                  setSpostamento(scelto ? 0 : mesiDaSpostare)
                }
                style={[
                  styles.sposta,
                  {
                    borderColor: scelto ? palette.accent : palette.hairline,
                    backgroundColor: scelto ? palette.surface : "transparent",
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: scelto }}
              >
                <Text
                  style={[
                    styles.spostaText,
                    { color: scelto ? palette.accent : palette.ink2 },
                  ]}
                >
                  {mesiDaSpostare === -1 ? "− 1 mese" : "+ 1 mese"}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* L'anteprima **prima** di confermare: lo stipendio arriva il 27 ma
            e' quello del mese dopo, e spostarlo alla cieca lascia un mese con
            due stipendi e un altro con nessuno. Qui si vede prima. */}
        <Text style={[styles.anteprimaLabel, { color: palette.ink3 }]}>
          {spostamento === 0
            ? "Come sono distribuiti adesso"
            : "Come sarebbero dopo lo spostamento"}
        </Text>
        <View style={styles.mesi}>
          {anteprima.map((mese) => {
            const cambiato =
              spostamento !== 0 &&
              mese.righe !== (mesi.find((m) => m.chiave === mese.chiave)?.righe ?? 0);
            return (
              <View key={mese.chiave} style={styles.mese}>
                <Text
                  style={[
                    styles.meseNome,
                    { color: cambiato ? palette.accent : palette.ink2 },
                  ]}
                >
                  {monthShort(mese.inizio)}
                </Text>
                <Text
                  style={[
                    styles.meseRighe,
                    { color: cambiato ? palette.accent : palette.ink3 },
                  ]}
                >
                  {mese.righe}
                </Text>
              </View>
            );
          })}
        </View>

        {spostamento !== 0 && (
          <TouchableOpacity
            style={[styles.button, { backgroundColor: palette.accent }]}
            onPress={() =>
              applica((d, indice) => ({
                ...d,
                data: spostaMesi(dataDi(indice), spostamento),
              }))
            }
          >
            <Text style={[styles.buttonText, { color: palette.onAccent }]}>
              Sposta {tutte} di {spostamento === -1 ? "un mese indietro" : "un mese avanti"}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        style={styles.checkRow}
        onPress={() => setRicorda((v) => !v)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: ricorda }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Icon
          name={ricorda ? "square-check" : "square"}
          size={17}
          color={ricorda ? palette.accent : palette.ink3}
        />
        <Text style={[styles.checkText, { color: palette.ink2 }]}>
          Ricorda quello che scelgo qui per i prossimi import.
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.ghost}
        onPress={() =>
          applica((d) => ({ ...d, esclusa: !gruppo.tutteEscluse }))
        }
      >
        <Text
          style={[
            styles.ghostText,
            { color: gruppo.tutteEscluse ? palette.good : palette.over },
          ]}
        >
          {gruppo.tutteEscluse
            ? `Rimetti dentro ${tutte}`
            : `Escludi ${tutte} dall'import`}
        </Text>
      </TouchableOpacity>

      <AddPersonSheet
        visible={aggiungoPersona}
        onClose={() => setAggiungoPersona(false)}
        onCreated={async (persona) => {
          setAggiungoPersona(false);
          await reload();
          applica((d) => ({ ...d, personaId: persona.id }));
        }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  sommario: { ...type.small, marginTop: -4 },
  fieldLabel: { ...type.caption, marginBottom: 5 },
  riga: { flexDirection: "row", gap: 9 },
  input: {
    borderWidth: 1,
    borderRadius: radius.field,
    paddingHorizontal: 13,
    paddingVertical: 12,
    ...type.body,
  },
  applica: {
    borderWidth: 1,
    borderRadius: radius.field,
    paddingHorizontal: 15,
    justifyContent: "center",
  },
  applicaText: { ...type.caption, fontWeight: "500" },
  strip: { gap: 8, paddingVertical: 2, paddingRight: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  chipText: { ...type.caption, fontWeight: "500" },
  sposta: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.field,
    paddingVertical: 11,
    alignItems: "center",
  },
  spostaText: { ...type.caption, fontWeight: "500" },
  anteprimaLabel: { ...type.small, marginTop: space.sm },
  mesi: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 6 },
  mese: { alignItems: "center", minWidth: 42 },
  meseNome: { ...type.small },
  meseRighe: { ...type.caption, fontWeight: "600", fontVariant: ["tabular-nums"] },
  button: {
    borderRadius: radius.button,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: space.sm,
  },
  buttonText: { ...type.caption, fontWeight: "500" },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  checkText: { ...type.small, flex: 1, lineHeight: 16 },
  ghost: { alignItems: "center", paddingVertical: 6 },
  ghostText: { ...type.caption, fontWeight: "500" },
});
