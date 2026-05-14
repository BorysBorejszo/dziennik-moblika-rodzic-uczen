import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Header from "../components/Header";
import { getParentGrades, gradeColor, gradeLabel, ParentSubjectGrades } from "../api/parent";
import { useParent } from "../context/ParentContext";
import { R, S, T, cardShadow, getEditorialPalette } from "../theme/editorial";
import { useTheme } from "../theme/ThemeContext";

export default function ParentGrades() {
  const { activeChild } = useParent();
  const { theme } = useTheme();
  const palette = getEditorialPalette(theme);
  const shadow = cardShadow(theme);

  const [subjects, setSubjects] = useState<ParentSubjectGrades[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const load = async () => {
    if (!activeChild) { setLoading(false); return; }
    try {
      const data = await getParentGrades(activeChild.id);
      setSubjects(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    void load();
  }, [activeChild?.id]);

  const toggle = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const childName = activeChild
    ? `${activeChild.first_name} ${activeChild.last_name}`
    : "Uczeń";

  return (
    <View style={[styles.root, { backgroundColor: palette.background }]}>
      <Header title="Oceny" subtitle={childName} />
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); void load(); }}
            tintColor={palette.primary}
          />
        }
      >

      <View style={styles.body}>
        {loading ? (
          <ActivityIndicator color={palette.primary} style={{ marginTop: S[8] }} />
        ) : subjects.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="ribbon-outline" size={48} color={palette.textSoft} />
            <Text style={[T.bodyMedium, { color: palette.textSoft, marginTop: S[3] }]}>
              Brak ocen
            </Text>
          </View>
        ) : (
          subjects.map((subj) => {
            const isOpen = expanded.has(subj.subject_id);
            const avg = subj.average ? parseFloat(subj.average) : null;
            return (
              <View key={subj.subject_id} style={[styles.card, { backgroundColor: palette.surface }, shadow]}>
                <TouchableOpacity
                  onPress={() => toggle(subj.subject_id)}
                  activeOpacity={0.75}
                  style={styles.cardHeader}
                >
                  <View style={styles.subjectInfo}>
                    <Text style={[T.bodyMedium, { color: palette.text }]}>{subj.subject_name}</Text>
                    {subj.final ? (
                      <Text style={[T.label, { color: palette.textSoft }]}>
                        Ocena końcowa: {gradeLabel(subj.final)}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.cardRight}>
                    {avg !== null && (
                      <Text
                        style={[
                          T.title,
                          {
                            color:
                              avg >= 4.5 ? "#16a34a"
                              : avg >= 3.5 ? "#65a30d"
                              : avg >= 2.75 ? "#d97706"
                              : "#dc2626",
                          },
                        ]}
                      >
                        {avg.toFixed(2)}
                      </Text>
                    )}
                    <Ionicons
                      name={isOpen ? "chevron-up" : "chevron-down"}
                      size={18}
                      color={palette.textSoft}
                    />
                  </View>
                </TouchableOpacity>

                {isOpen && (
                  <View style={styles.gradeDetails}>
                    {subj.period.length > 0 && (
                      <View style={styles.periodRow}>
                        {subj.period.map((p) => (
                          <View key={p.id} style={[styles.periodChip, { backgroundColor: palette.primaryFixed }]}>
                            <Text style={[T.labelBold, { color: palette.primary }]}>
                              Ocena {p.okres === 1 ? "I" : "II"}: {gradeLabel(p.wartosc)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {subj.grades.length > 0 ? (
                      <View style={styles.gradesWrap}>
                        {subj.grades.map((g) => (
                          <View key={g.id} style={styles.gradeItem}>
                            <View
                              style={[
                                styles.gradeChip,
                                { backgroundColor: gradeColor(g.wartosc) + "22" },
                              ]}
                            >
                              <Text
                                style={[T.bodyMedium, { color: gradeColor(g.wartosc), fontWeight: "700" }]}
                              >
                                {gradeLabel(g.wartosc)}
                              </Text>
                            </View>
                            <View style={styles.gradeInfo}>
                              {g.opis ? (
                                <Text style={[T.label, { color: palette.text }]}>{g.opis}</Text>
                              ) : null}
                              <Text style={[T.label, { color: palette.textSoft }]}>
                                waga {g.waga}
                                {g.data_wystawienia
                                  ? ` · ${new Date(g.data_wystawienia).toLocaleDateString("pl-PL")}`
                                  : ""}
                                {!g.czy_do_sredniej ? " · nie do śred." : ""}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={[T.label, { color: palette.textSoft, paddingVertical: S[2] }]}>
                        Brak ocen bieżących
                      </Text>
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { paddingHorizontal: S[4], paddingBottom: 120 },
  emptyWrap: { alignItems: "center", marginTop: 80 },
  card: { borderRadius: R.lg, marginBottom: S[3], overflow: "hidden" },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: S[4],
  },
  subjectInfo: { flex: 1 },
  cardRight: { flexDirection: "row", alignItems: "center", gap: S[2] },
  gradeDetails: {
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.06)",
    padding: S[4],
  },
  periodRow: { flexDirection: "row", gap: S[2], marginBottom: S[3], flexWrap: "wrap" },
  periodChip: { borderRadius: R.md, paddingHorizontal: S[3], paddingVertical: S[1] + 2 },
  gradesWrap: { gap: S[2] },
  gradeItem: { flexDirection: "row", alignItems: "flex-start", gap: S[3] },
  gradeChip: {
    width: 42,
    height: 42,
    borderRadius: R.md,
    alignItems: "center",
    justifyContent: "center",
  },
  gradeInfo: { flex: 1, paddingTop: 2 },
});
