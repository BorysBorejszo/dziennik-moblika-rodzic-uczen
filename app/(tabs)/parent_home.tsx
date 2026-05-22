import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Header from "../components/Header";
import ErrorState from "../components/ErrorState";
import { getParentGrades, ParentSubjectGrades } from "../api/parent";
import { useParent } from "../context/ParentContext";
import { useUser } from "../context/UserContext";
import { R, S, T, cardShadow, getEditorialPalette } from "../theme/editorial";
import { useTheme } from "../theme/ThemeContext";

type Props = { onNavigate?: (tabIndex: number) => void };

export default function ParentHome({ onNavigate }: Props) {
  const { user } = useUser();
  const { studentList, activeChild, setActiveChild, loading: childLoading } = useParent();
  const { theme } = useTheme();
  const palette = getEditorialPalette(theme);
  const shadow = cardShadow(theme);

  const [grades, setGrades] = useState<ParentSubjectGrades[]>([]);
  const [gradesLoading, setGradesLoading] = useState(false);
  const [gradesError, setGradesError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const rawName = user?.name ?? "";
  const firstName = rawName.split(/[_\s]+/)[0] ?? "Rodzicu";
  const displayName = firstName
    ? firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()
    : "Rodzicu";

  const today = new Date().toLocaleDateString("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  useEffect(() => {
    if (!activeChild) return;
    setGradesLoading(true);
    setGradesError(null);
    getParentGrades(activeChild.id)
      .then(setGrades)
      .catch((err: unknown) => {
        console.error("[parent_home] Failed to load grades:", err);
        setGradesError((err instanceof Error ? err.message : null) ?? 'Błąd ładowania ocen');
      })
      .finally(() => setGradesLoading(false));
  }, [activeChild?.id, reloadKey]);

  const overallAvg = (() => {
    const avgs = grades
      .map((s) => parseFloat(s.average ?? ""))
      .filter((v) => !isNaN(v));
    if (!avgs.length) return null;
    return (avgs.reduce((a, b) => a + b, 0) / avgs.length).toFixed(2);
  })();

  const tiles = [
    { label: "Plan lekcji", icon: "calendar-outline" as const, color: palette.primary, tab: 1 },
    { label: "Oceny", icon: "ribbon-outline" as const, color: palette.success, tab: 2 },
    { label: "Frekwencja", icon: "stats-chart-outline" as const, color: palette.info, tab: 3 },
    { label: "Prace domowe", icon: "document-text-outline" as const, color: palette.warning, tab: 4 },
  ];

  return (
    <View style={[styles.root, { backgroundColor: palette.background }]}>
      <Header title={`Witaj, ${displayName}`} subtitle={today} />
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >

      <View style={styles.body}>
        {childLoading ? (
          <ActivityIndicator color={palette.primary} style={{ marginBottom: S[4] }} />
        ) : studentList.length > 1 ? (
          <View style={styles.childSwitcher}>
            <Text style={[T.labelBold, { color: palette.textMuted, marginBottom: S[2] }]}>
              Wybierz ucznia:
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {studentList.map((child) => {
                const active = child.id === activeChild?.id;
                return (
                  <TouchableOpacity
                    key={child.id}
                    onPress={() => setActiveChild(child)}
                    style={[
                      styles.childChip,
                      {
                        backgroundColor: active ? palette.primary : palette.surface,
                        borderColor: active ? palette.primary : palette.outline,
                      },
                      shadow,
                    ]}
                  >
                    <Text
                      style={[
                        T.labelBold,
                        { color: active ? "#fff" : palette.text },
                      ]}
                    >
                      {child.first_name} {child.last_name}
                    </Text>
                    {child.class_name ? (
                      <Text
                        style={[
                          T.label,
                          { color: active ? "rgba(255,255,255,0.75)" : palette.textSoft },
                        ]}
                      >
                        klasa {child.class_name}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : activeChild ? (
          <View style={[styles.singleChild, { backgroundColor: palette.surface }, shadow]}>
            <Ionicons name="person-circle-outline" size={32} color={palette.primary} />
            <View>
              <Text style={[T.bodyMedium, { color: palette.text }]}>
                {activeChild.first_name} {activeChild.last_name}
              </Text>
              {activeChild.class_name ? (
                <Text style={[T.label, { color: palette.textSoft }]}>
                  Klasa {activeChild.class_name}
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}

        {activeChild && (
          gradesError ? (
            <ErrorState message={gradesError} onRetry={() => setReloadKey(k => k + 1)} />
          ) : (
            <View style={[styles.statsRow]}>
              <View style={[styles.statCard, { backgroundColor: palette.surface }, shadow]}>
                <Ionicons name="ribbon-outline" size={20} color={palette.success} />
                <Text style={[T.title, { color: palette.text }]}>
                  {gradesLoading ? "—" : overallAvg ?? "—"}
                </Text>
                <Text style={[T.label, { color: palette.textSoft }]}>Śr. ocen</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: palette.surface }, shadow]}>
                <Ionicons name="school-outline" size={20} color={palette.primary} />
                <Text style={[T.title, { color: palette.text }]}>
                  {grades.length}
                </Text>
                <Text style={[T.label, { color: palette.textSoft }]}>Przedmioty</Text>
              </View>
            </View>
          )
        )}

        <Text style={[T.title, styles.sectionTitle, { color: palette.text }]}>
          Szybki dostęp
        </Text>

        <View style={styles.tilesGrid}>
          {tiles.map((tile) => (
            <TouchableOpacity
              key={tile.tab}
              activeOpacity={0.78}
              onPress={() => onNavigate?.(tile.tab)}
              style={[styles.tile, { backgroundColor: palette.surface }, shadow]}
            >
              <View
                style={[styles.tileIcon, { backgroundColor: tile.color + "1e", borderRadius: R.md }]}
              >
                <Ionicons name={tile.icon} size={22} color={tile.color} />
              </View>
              <Text style={[T.bodyMedium, styles.tileLabel, { color: palette.text }]}>
                {tile.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingBottom: 120 },
  body: { paddingHorizontal: S[4], paddingTop: S[2] },
  childSwitcher: { marginBottom: S[4] },
  childChip: {
    marginRight: S[3],
    paddingHorizontal: S[4],
    paddingVertical: S[3],
    borderRadius: R.lg,
    borderWidth: 1.5,
    alignItems: "center",
    minWidth: 110,
  },
  singleChild: {
    flexDirection: "row",
    alignItems: "center",
    gap: S[3],
    padding: S[4],
    borderRadius: R.lg,
    marginBottom: S[4],
  },
  statsRow: {
    flexDirection: "row",
    gap: S[3],
    marginBottom: S[5],
  },
  statCard: {
    flex: 1,
    borderRadius: R.lg,
    padding: S[4],
    alignItems: "center",
    gap: S[1],
  },
  sectionTitle: { marginBottom: S[3] },
  tilesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: S[3],
    marginBottom: S[6],
  },
  tile: {
    width: "47%",
    borderRadius: R.lg,
    padding: S[4],
    alignItems: "flex-start",
  },
  tileIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: S[3],
  },
  tileLabel: { lineHeight: 20 },
});
