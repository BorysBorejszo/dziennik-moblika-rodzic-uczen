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
import ErrorState from "../components/ErrorState";
import { getHomeworkForClass, ParentHomework as HomeworkItem } from "../api/parent";
import { listSubjects } from "../api/grades";
import { useParent } from "../context/ParentContext";
import { R, S, T, cardShadow, getEditorialPalette } from "../theme/editorial";
import { useTheme } from "../theme/ThemeContext";

type FilterMode = "all" | "active" | "overdue";

export default function ParentHomework({ onBack }: { onBack?: () => void } = {}) {
  const { activeChild } = useParent();
  const { theme } = useTheme();
  const palette = getEditorialPalette(theme);
  const shadow = cardShadow(theme);

  const [homework, setHomework] = useState<HomeworkItem[]>([]);
  const [subjectMap, setSubjectMap] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const load = async () => {
    if (!activeChild?.class_id) { setLoading(false); return; }
    setFetchError(null);
    try {
      const [hw, subjects] = await Promise.all([
        getHomeworkForClass(activeChild.class_id),
        listSubjects(),
      ]);
      setHomework(hw);
      setSubjectMap(new Map(subjects.map((s) => [s.id, s.nazwa])));
    } catch (err) {
      console.error("[parent_homework] Failed to load:", err);
      setFetchError((err instanceof Error ? err.message : null) ?? 'Błąd ładowania danych');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    void load();
  }, [activeChild?.id, reloadKey]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const filtered = homework.filter((hw) => {
    if (filter === "all") return true;
    if (!hw.termin) return filter === "active";
    const d = new Date(hw.termin);
    d.setHours(0, 0, 0, 0);
    return filter === "active" ? d >= today : d < today;
  });

  const dueLabel = (termin?: string): { text: string; color: string } => {
    if (!termin) return { text: "Brak terminu", color: palette.textSoft };
    const d = new Date(termin);
    d.setHours(0, 0, 0, 0);
    const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
    if (diff < 0) return { text: `Przeterminowane (${Math.abs(diff)}d)`, color: "#dc2626" };
    if (diff === 0) return { text: "Dziś!", color: "#ea580c" };
    if (diff === 1) return { text: "Jutro", color: "#d97706" };
    if (diff <= 3) return { text: `Za ${diff} dni`, color: "#d97706" };
    return {
      text: d.toLocaleDateString("pl-PL", { day: "numeric", month: "short" }),
      color: palette.textSoft,
    };
  };

  const childName = activeChild
    ? `${activeChild.first_name} ${activeChild.last_name}`
    : "Uczeń";

  const filterLabels: { key: FilterMode; label: string }[] = [
    { key: "all", label: "Wszystkie" },
    { key: "active", label: "Aktualne" },
    { key: "overdue", label: "Po terminie" },
  ];

  if (fetchError && !loading) {
    return (
      <View style={[styles.root, { backgroundColor: palette.background }]}>
        <Header title="Prace domowe" subtitle={childName} onBack={onBack} />
        <ErrorState message={fetchError} onRetry={() => setReloadKey(k => k + 1)} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: palette.background }]}>
      <Header title="Prace domowe" subtitle={childName} onBack={onBack} />
      <View style={styles.filters}>
        {filterLabels.map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            onPress={() => setFilter(key)}
            style={[
              styles.filterChip,
              {
                backgroundColor: filter === key ? palette.primary : palette.surface,
                borderColor: filter === key ? palette.primary : palette.outline,
              },
            ]}
          >
            <Text
              style={[
                T.labelBold,
                { color: filter === key ? "#fff" : palette.textSoft },
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

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
        ) : filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="document-text-outline" size={48} color={palette.textSoft} />
            <Text style={[T.bodyMedium, { color: palette.textSoft, marginTop: S[3] }]}>
              Brak prac domowych
            </Text>
          </View>
        ) : (
          filtered.map((hw) => {
            const due = dueLabel(hw.termin);
            const subjectName = hw.przedmiot
              ? (subjectMap.get(hw.przedmiot) ?? `Przedmiot #${hw.przedmiot}`)
              : null;
            const isOverdue = hw.termin && new Date(hw.termin) < today;
            return (
              <View
                key={hw.id}
                style={[
                  styles.card,
                  {
                    backgroundColor: palette.surface,
                    borderLeftColor: isOverdue ? "#dc2626" : palette.primary,
                  },
                  shadow,
                ]}
              >
                <View style={styles.cardTop}>
                  <View style={styles.cardTitle}>
                    <Text style={[T.bodyMedium, { color: palette.text }]}>{hw.tytul}</Text>
                    {subjectName && (
                      <View style={[styles.subjectBadge, { backgroundColor: palette.primaryFixed }]}>
                        <Text style={[T.label, { color: palette.primary }]}>{subjectName}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[T.labelBold, { color: due.color }]}>{due.text}</Text>
                </View>
                {hw.opis ? (
                  <Text
                    style={[T.label, { color: palette.textSoft, marginTop: S[2] }]}
                    numberOfLines={3}
                  >
                    {hw.opis}
                  </Text>
                ) : null}
                {hw.data_wystawienia && (
                  <Text style={[T.label, { color: palette.textMuted, marginTop: S[1] }]}>
                    Wystawione:{" "}
                    {new Date(hw.data_wystawienia).toLocaleDateString("pl-PL")}
                  </Text>
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
  filters: {
    flexDirection: "row",
    paddingHorizontal: S[4],
    gap: S[2],
    marginBottom: S[2],
  },
  filterChip: {
    paddingHorizontal: S[3],
    paddingVertical: S[1] + 3,
    borderRadius: R.full,
    borderWidth: 1.5,
  },
  body: { paddingHorizontal: S[4], paddingBottom: 120 },
  emptyWrap: { alignItems: "center", marginTop: 80 },
  card: {
    borderRadius: R.lg,
    padding: S[4],
    marginBottom: S[3],
    borderLeftWidth: 4,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: S[3],
  },
  cardTitle: { flex: 1, gap: S[1] },
  subjectBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: S[2],
    paddingVertical: 2,
    borderRadius: R.sm,
  },
});
