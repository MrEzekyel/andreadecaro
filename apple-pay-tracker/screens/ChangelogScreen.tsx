import React, { useEffect } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Icon } from "../components/Icon";
import { SwipeBack, backHitSlop } from "../components/SwipeBack";
import { useTheme } from "../lib/ThemeContext";
import { CHANGELOG, useChangelog } from "../lib/changelog";
import { space, type } from "../lib/theme";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function ChangelogScreen({ onBack }: { onBack: () => void }) {
  const { palette } = useTheme();
  const { markRead } = useChangelog();

  // Aprire la schermata *e'* averle lette: chiedere anche un tocco su
  // "segna come letto" sarebbe un lavoro in piu' per spegnere un pallino.
  useEffect(() => {
    markRead();
  }, [markRead]);

  return (
    <SwipeBack onBack={onBack}>
      <View style={[styles.container, { backgroundColor: palette.ground }]}>
        <View style={styles.head}>
          <TouchableOpacity onPress={onBack} style={styles.back} hitSlop={backHitSlop}>
            <Icon name="chevron-left" size={20} color={palette.ink} />
            <Text style={[styles.title, { color: palette.ink }]}>Novità</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {CHANGELOG.map((entry) => (
            <View key={entry.id} style={styles.entry}>
              <Text style={[styles.date, { color: palette.ink3 }]}>
                {formatDate(entry.date)}
              </Text>
              <Text style={[styles.entryTitle, { color: palette.ink }]}>
                {entry.title}
              </Text>

              {entry.items.map((item, index) => (
                <View key={index} style={styles.item}>
                  <View style={[styles.bullet, { backgroundColor: palette.ink3 }]} />
                  <Text style={[styles.itemText, { color: palette.ink2 }]}>
                    {item}
                  </Text>
                </View>
              ))}
            </View>
          ))}
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
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.xl },
  entry: { gap: 5 },
  date: { ...type.small },
  entryTitle: { ...type.bodyMedium, fontSize: 15.5, marginBottom: 4 },
  item: { flexDirection: "row", gap: 9, paddingVertical: 4 },
  bullet: { width: 4, height: 4, borderRadius: 2, marginTop: 7 },
  itemText: { ...type.caption, flex: 1, lineHeight: 19 },
});
