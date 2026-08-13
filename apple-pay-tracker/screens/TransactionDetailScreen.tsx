import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { EditPaymentSheet } from "../components/EditPaymentSheet";
import { Icon } from "../components/Icon";
import { LoadError } from "../components/LoadError";
import { SwipeBack, backHitSlop } from "../components/SwipeBack";
import { useData } from "../lib/DataContext";
import { useTheme } from "../lib/ThemeContext";
import { formatForeign, formatAmount, shortDateTime, splitAmount } from "../lib/format";
import { supabase } from "../lib/supabase";
import { categoryColor, radius, space, tint, type } from "../lib/theme";
import { Payment, PaymentSplit } from "../lib/types";

type Props = {
  payment: Payment;
  onBack: () => void;
  onChanged: () => void;
  onOpenMerchant: (merchantId: string, title: string) => void;
};

type Row = {
  label: string;
  value: string;
  /** Icona a sinistra del valore, per la riga della categoria. */
  icon?: string;
  iconColor?: string;
};

const SOURCE_LABEL: Record<string, string> = {
  shortcut: "Apple Pay",
  shortcut_manual: "Apple Pay, a mano",
  siri: "Dettata a Siri",
  manual: "Inserita a mano",
  recurring: "Ricorrente",
  shared: "Divisa con te",
};

export default function TransactionDetailScreen({
  payment: initial,
  onBack,
  onChanged,
  onOpenMerchant,
}: Props) {
  const { palette, dark } = useTheme();
  const { categoryById, personById, brandLabel, merchants, merchantById } = useData();

  /** L'insegna della spesa aperta, se il punto vendita ne ha una. */
  const brand = useMemo(() => {
    const merchant = initial.merchant_id ? merchantById(initial.merchant_id) : undefined;
    return merchant?.parent_id ? merchantById(merchant.parent_id) : undefined;
  }, [initial.merchant_id, merchantById]);

  const merchantFamily = useMemo(() => {
    if (!initial.merchant_id) return [];
    const brandId = merchantById(initial.merchant_id)?.parent_id ?? initial.merchant_id;
    return [brandId, ...merchants.filter((m) => m.parent_id === brandId).map((m) => m.id)];
  }, [initial.merchant_id, merchants, merchantById]);

  const [payment, setPayment] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [splitIntent, setSplitIntent] = useState(false);
  const [splits, setSplits] = useState<PaymentSplit[]>([]);
  const [splitsError, setSplitsError] = useState<string | null>(null);
  const [merchantTotal, setMerchantTotal] = useState<{
    count: number;
    total: number;
  } | null>(null);

  const load = useCallback(async () => {
    const [fresh, splitRows] = await Promise.all([
      supabase.from("payments").select("*").eq("id", initial.id).maybeSingle(),
      supabase.from("payment_splits").select("*").eq("payment_id", initial.id),
    ]);

    if (fresh.data) setPayment(fresh.data as Payment);

    // La spesa resta quella su cui l'utente ha toccato, quindi un errore qui
    // non falsifica l'importo. Le quote si': senza, la schermata direbbe
    // "non divisa" su una spesa divisa, e l'intero importo sembrerebbe tuo.
    setSplitsError(splitRows.error?.message ?? null);
    if (!splitRows.error) setSplits((splitRows.data ?? []) as PaymentSplit[]);

    if (initial.merchant_id) {
      // Tutta l'insegna, non il solo punto vendita: "presso McDonald's" deve
      // contare anche gli altri McDonald's, altrimenti il numero e' sempre
      // piu' basso del vero senza che niente lo dica.
      const { data } = await supabase
        .from("payments")
        .select("effective_amount")
        .in("merchant_id", merchantFamily);

      if (data) {
        setMerchantTotal({
          count: data.length,
          total: data.reduce((sum, r) => sum + Number(r.effective_amount), 0),
        });
      }
    }
  }, [initial.id, initial.merchant_id, merchantFamily]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleExcluded(value: boolean) {
    // Ottimistico: il tocco su uno switch deve rispondere subito, e in caso
    // di errore lo si riporta indietro.
    setPayment((p) => ({ ...p, excluded_from_stats: value }));

    const { error } = await supabase
      .from("payments")
      .update({ excluded_from_stats: value })
      .eq("id", payment.id);

    if (error) {
      setPayment((p) => ({ ...p, excluded_from_stats: !value }));
      Alert.alert("Errore", error.message);
      return;
    }
    onChanged();
  }

  const category = categoryById(payment.category_id);
  const color = category
    ? categoryColor(category.color, dark)
    : palette.uncategorized;

  const amount = splitAmount(Number(payment.effective_amount));
  const isSplit = payment.my_share !== null;

  const rows: Row[] = [
    {
      label: "Categoria",
      value: category?.name ?? "Da categorizzare",
      icon: category?.icon ?? "circle-help",
      iconColor: color,
    },
    // Il metodo compare sempre, anche vuoto: sapere che il dato non e'
    // arrivato e' un'informazione, cercarlo invano no. Le spese importate
    // dagli estratti conto non lo portano con se'.
    { label: "Metodo di pagamento", value: payment.card_name ?? "—" },
    { label: "Origine", value: SOURCE_LABEL[payment.source] ?? payment.source },
  ];
  if (payment.city) rows.push({ label: "Città", value: payment.city });
  if (payment.transaction_name && payment.transaction_name !== payment.merchant_name) {
    rows.push({ label: "Nome", value: payment.transaction_name });
  }
  if (payment.note) rows.push({ label: "Nota", value: payment.note });

  return (
    <>
      <SwipeBack onBack={onBack}>
      <View style={[styles.container, { backgroundColor: palette.ground }]}>
        <View style={styles.head}>
          <TouchableOpacity
            onPress={onBack}
            style={styles.back}
            hitSlop={backHitSlop}
            accessibilityLabel="Indietro"
          >
            <Icon name="chevron-left" size={20} color={palette.ink} />
          </TouchableOpacity>
          <Text style={[styles.headTitle, { color: palette.ink }]}>Spesa</Text>
          <TouchableOpacity onPress={() => setEditing(true)}>
            <Text style={[styles.edit, { color: palette.accent }]}>Modifica</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.hero}>
            <View style={[styles.icon, { backgroundColor: tint(color, dark) }]}>
              <Icon
                name={category?.icon ?? "circle-help"}
                size={22}
                color={color}
              />
            </View>

            <Text style={[styles.merchant, { color: palette.ink }]}>
              {payment.merchant_name}
            </Text>

            {/* L'insegna sotto il punto vendita: qui si guarda **questa**
                spesa, quindi il nome grande resta quello del posto dove si e'
                pagato davvero. L'insegna serve solo a spiegare sotto quale
                nome la spesa comparira' negli elenchi. */}
            {brand && (
              <Text style={[styles.brand, { color: palette.ink3 }]}>
                {brand.display_name}
              </Text>
            )}

            <Text style={[styles.amount, { color: palette.ink }]}>
              {amount.whole}
              <Text style={[styles.cents, { color: palette.ink3 }]}>
                {amount.cents}
              </Text>
            </Text>

            <Text style={[styles.when, { color: palette.ink3 }]}>
              {shortDateTime(payment.occurred_at)}
            </Text>

            {/* L'originale accanto al controvalore, con il cambio: senza, un
                importo convertito sembra sbagliato a chi si ricorda lo
                scontrino. Il cambio e' quello del giorno della spesa, salvato
                una volta per sempre — al cambio di oggi il totale di un mese
                chiuso si muoverebbe a ogni apertura. */}
            {payment.original_currency && payment.original_amount !== null && (
              <Text style={[styles.foreign, { color: palette.ink3 }]}>
                {formatForeign(
                  Number(payment.original_amount),
                  payment.original_currency
                )}
                {payment.fx_rate !== null
                  ? ` · cambio ${Number(payment.fx_rate).toFixed(4).replace(".", ",")}`
                  : " · cambio non ancora disponibile"}
              </Text>
            )}

            {payment.original_currency && payment.fx_rate === null && (
              <Text style={[styles.foreignWarn, { color: palette.over }]}>
                Questo importo è in {payment.original_currency} e non è ancora
                stato convertito: nei totali entra così com'è. Si sistema da
                solo entro stanotte.
              </Text>
            )}

            {isSplit && (
              <Text style={[styles.splitNote, { color: palette.ink2 }]}>
                quota tua su {formatAmount(Number(payment.amount))} pagati
              </Text>
            )}

            <TouchableOpacity
              style={[styles.splitBtn, { borderColor: palette.hairline }]}
              onPress={() => {
                setSplitIntent(true);
                setEditing(true);
              }}
            >
              <Icon name="split" size={14} color={palette.accent} />
              <Text style={[styles.splitBtnText, { color: palette.accent }]}>
                {isSplit || splits.length > 0 ? "Modifica divisione" : "Dividi con altri"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.rows}>
            {rows.map((row, index) => (
              <View key={row.label}>
                {index > 0 && (
                  <View
                    style={[styles.divider, { backgroundColor: palette.hairline }]}
                  />
                )}
                <View style={styles.row}>
                  <Text style={[styles.rowLabel, { color: palette.ink3 }]}>
                    {row.label}
                  </Text>
                  <View style={styles.rowValueWrap}>
                    {row.icon && (
                      <Icon
                        name={row.icon}
                        size={14}
                        color={row.iconColor ?? palette.ink2}
                      />
                    )}
                    <Text
                      style={[styles.rowValue, { color: palette.ink }]}
                      numberOfLines={2}
                    >
                      {row.value}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

          {splitsError && (
            <LoadError message={splitsError} onRetry={load} variant="inline" />
          )}

          {splits.length > 0 && (
            <View>
              <Text style={[styles.label, { color: palette.ink3 }]}>
                Divisa con
              </Text>
              <View style={styles.rows}>
                {splits.map((split, index) => (
                  <View key={split.id}>
                    {index > 0 && (
                      <View
                        style={[
                          styles.divider,
                          { backgroundColor: palette.hairline },
                        ]}
                      />
                    )}
                    <View style={styles.row}>
                      <Text style={[styles.rowLabel, { color: palette.ink2 }]}>
                        {personById(split.person_id)?.name ?? "—"}
                      </Text>
                      <Text
                        style={[
                          styles.rowValue,
                          {
                            color: split.settled_at ? palette.good : palette.ink,
                          },
                        ]}
                      >
                        {formatAmount(Number(split.amount_owed))}
                        {split.settled_at ? " · saldato" : ""}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {payment.merchant_id && merchantTotal && (
            <View>
              <Text style={[styles.label, { color: palette.ink3 }]}>
                {brand ? `Presso ${brand.display_name}` : "Presso questo esercente"}
              </Text>

              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color }]}>
                    {merchantTotal.count}
                  </Text>
                  <Text style={[styles.statLabel, { color: palette.ink3 }]}>
                    {merchantTotal.count === 1 ? "transazione" : "transazioni"}
                  </Text>
                </View>

                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color }]}>
                    {formatAmount(merchantTotal.total)}
                  </Text>
                  <Text style={[styles.statLabel, { color: palette.ink3 }]}>
                    totale speso
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.link}
                onPress={() =>
                  onOpenMerchant(payment.merchant_id!, brandLabel(payment))
                }
              >
                <Text style={[styles.linkText, { color: palette.accent }]}>
                  Vedi tutte le transazioni
                </Text>
                <Icon name="chevron-right" size={15} color={palette.accent} />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.row}>
            <View style={{ flex: 1, paddingRight: space.md }}>
              <Text style={[styles.rowLabel, { color: palette.ink }]}>
                Escludi dalle classifiche
              </Text>
              <Text style={[styles.rowHint, { color: palette.ink3 }]}>
                Resta nel totale speso, ma non compare in "dove spendo di più".
              </Text>
            </View>
            <Switch
              value={payment.excluded_from_stats}
              onValueChange={toggleExcluded}
              trackColor={{ true: palette.accent, false: palette.hairline }}
            />
          </View>
        </ScrollView>
      </View>
      </SwipeBack>

      <EditPaymentSheet
        payment={editing ? payment : null}
        visible={editing}
        focusSplit={splitIntent}
        onClose={() => {
          setEditing(false);
          setSplitIntent(false);
        }}
        onSaved={() => {
          load();
          onChanged();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.sm,
  },
  back: { padding: 12, marginLeft: -8 },
  headTitle: { ...type.bodyMedium, flex: 1 },
  edit: { ...type.body },
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.xl },
  hero: { alignItems: "center", gap: space.sm },
  icon: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  merchant: { ...type.title, textAlign: "center" },
  brand: { ...type.small, textAlign: "center", marginTop: 2 },
  amount: { ...type.hero, fontVariant: ["tabular-nums"] },
  foreign: { ...type.small, marginTop: 4 },
  foreignWarn: { ...type.small, marginTop: 6, lineHeight: 15 },
  cents: { ...type.heroCents },
  when: { ...type.caption, marginTop: -2 },
  splitNote: { ...type.small },
  splitBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 7,
    paddingHorizontal: 14,
    marginTop: 4,
  },
  splitBtnText: { ...type.caption, fontWeight: "500" },
  rows: {},
  divider: { height: StyleSheet.hairlineWidth },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
    paddingVertical: 13,
  },
  rowLabel: { ...type.caption },
  rowHint: { ...type.small, fontSize: 10.5, lineHeight: 15, marginTop: 3 },
  rowValueWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    flexShrink: 1,
  },
  rowValue: {
    ...type.caption,
    fontWeight: "500",
    flexShrink: 1,
    textAlign: "right",
  },
  label: { ...type.label, marginBottom: space.sm },
  statsRow: { flexDirection: "row", gap: space.xxl },
  stat: { gap: 3 },
  statValue: { ...type.bodyMedium, fontSize: 17, fontVariant: ["tabular-nums"] },
  statLabel: { ...type.small, fontSize: 10.5 },
  link: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 13,
    marginTop: space.sm,
  },
  linkText: { ...type.body },
});
