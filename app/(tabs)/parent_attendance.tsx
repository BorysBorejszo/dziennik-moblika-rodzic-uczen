import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Header from "../components/Header";
import ErrorState from "../components/ErrorState";
import {
  createParentExcuse,
  getParentAttendance,
  ParentAttendanceEntry,
} from "../api/parent";
import { useParent } from "../context/ParentContext";
import { R, S, T, cardShadow, getEditorialPalette } from "../theme/editorial";
import { useTheme } from "../theme/ThemeContext";

type DayGroup = {
  dateKey: string;
  dateLabel: string;
  entries: ParentAttendanceEntry[];
  absentCount: number;
};

const isAbsent = (r: ParentAttendanceEntry): boolean => {
  if (!r.status) return true;
  const s = r.status.toLowerCase();
  return s.includes("nieobecn") || s === "n" || s === "nb";
};

const statusColor = (status: string | null): string => {
  if (!status) return "#6b7280";
  const s = status.toLowerCase();
  if (s.includes("obecn") && !s.includes("nie")) return "#16a34a";
  if (s.includes("uspraw")) return "#2563eb";
  if (s.includes("spóźn") || s.includes("spozn")) return "#d97706";
  return "#dc2626";
};

const statusBg = (status: string | null): string => statusColor(status) + "20";

const toDateKey = (raw: string | undefined): string => {
  if (!raw) return "";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw.slice(0, 10);
  return d.toISOString().slice(0, 10);
};

const formatDayLabel = (dateKey: string): string => {
  const d = new Date(dateKey + "T00:00:00");
  if (isNaN(d.getTime())) return dateKey;
  const weekday = d.toLocaleDateString("pl-PL", { weekday: "long" });
  const date = d.toLocaleDateString("pl-PL", { day: "numeric", month: "long" });
  return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${date}`;
};

const lessonCountLabel = (n: number): string => {
  if (n === 1) return "1 lekcja";
  if (n < 5) return `${n} lekcje`;
  return `${n} lekcji`;
};

export default function ParentAttendance() {
  const { activeChild } = useParent();
  const { theme } = useTheme();
  const palette = getEditorialPalette(theme);
  const shadow = cardShadow(theme);

  const [records, setRecords] = useState<ParentAttendanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [excuseModal, setExcuseModal] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  const load = async () => {
    if (!activeChild) { setLoading(false); return; }
    setFetchError(null);
    try {
      const data = await getParentAttendance(activeChild.id);
      setRecords(data.sort((a, b) => (b.data ?? "").localeCompare(a.data ?? "")));
    } catch (err) {
      console.error("[parent_attendance] Failed to load:", err);
      setFetchError((err instanceof Error ? err.message : null) ?? "Błąd ładowania danych");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    setSelected(new Set());
    setSelectMode(false);
    setExpandedDays(new Set());
    void load();
  }, [activeChild?.id, reloadKey]);

  const toggleDay = useCallback((dateKey: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      next.has(dateKey) ? next.delete(dateKey) : next.add(dateKey);
      return next;
    });
  }, []);

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const cancelSelect = () => {
    setSelected(new Set());
    setSelectMode(false);
  };

  const submitExcuse = async () => {
    if (!activeChild || !reason.trim()) return;
    setSubmitting(true);
    const items = records
      .filter((r) => selected.has(r.id))
      .map((r) => ({ data: r.data, frekwencja: r.id }));
    const ok = await createParentExcuse(activeChild.id, reason.trim(), items);
    setSubmitting(false);
    if (ok) {
      setExcuseModal(false);
      setReason("");
      cancelSelect();
      setRefreshing(true);
      void load();
    } else {
      Alert.alert("Błąd", "Nie udało się wysłać usprawiedliwienia.");
    }
  };

  const dayGroups = useMemo<DayGroup[]>(() => {
    const map = new Map<string, ParentAttendanceEntry[]>();
    for (const r of records) {
      const key = toDateKey(r.data);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries())
      .map(([dateKey, entries]) => ({
        dateKey,
        dateLabel: formatDayLabel(dateKey),
        entries: [...entries].sort(
          (a, b) => (a.godzina_lekcyjna ?? 0) - (b.godzina_lekcyjna ?? 0)
        ),
        absentCount: entries.filter(isAbsent).length,
      }))
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [records]);

  const totalAbsents = useMemo(() => records.filter(isAbsent).length, [records]);

  const childName = activeChild
    ? `${activeChild.first_name} ${activeChild.last_name}`
    : "Uczeń";

  if (fetchError && !loading) {
    return (
      <View style={[styles.root, { backgroundColor: palette.background }]}>
        <Header title="Frekwencja" subtitle={childName} />
        <ErrorState message={fetchError} onRetry={() => setReloadKey((k) => k + 1)} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: palette.background }]}>
      <Header title="Frekwencja" subtitle={childName} />

      {selectMode && (
        <View
          style={[
            styles.selectBar,
            { backgroundColor: palette.surface, borderBottomColor: palette.outline },
          ]}
        >
          <TouchableOpacity onPress={cancelSelect} style={styles.cancelBtn}>
            <Ionicons name="close" size={20} color={palette.textSoft} />
          </TouchableOpacity>
          <Text style={[T.bodyMedium, { color: palette.text }]}>
            Zaznaczono: {selected.size}
          </Text>
          <TouchableOpacity
            onPress={() => selected.size > 0 && setExcuseModal(true)}
            style={[
              styles.excuseBtn,
              { backgroundColor: selected.size > 0 ? palette.primary : palette.outline },
            ]}
          >
            <Text
              style={[
                T.labelBold,
                { color: selected.size > 0 ? "#fff" : palette.textSoft },
              ]}
            >
              Usprawiedliw
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); void load(); }}
            tintColor={palette.primary}
          />
        }
        contentContainerStyle={styles.listContent}
      >
        {!selectMode && totalAbsents > 0 && !loading && (
          <TouchableOpacity
            onPress={() => setSelectMode(true)}
            style={[styles.excuseHint, { backgroundColor: palette.primaryFixed }]}
          >
            <Ionicons name="checkmark-circle-outline" size={18} color={palette.primary} />
            <Text style={[T.label, { color: palette.primary, flex: 1 }]}>
              Dotknij, aby wybrać nieobecności do usprawiedliwienia
            </Text>
          </TouchableOpacity>
        )}

        {loading ? (
          <ActivityIndicator color={palette.primary} style={{ marginTop: S[8] }} />
        ) : dayGroups.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="stats-chart-outline" size={48} color={palette.textSoft} />
            <Text style={[T.bodyMedium, { color: palette.textSoft, marginTop: S[3] }]}>
              Brak wpisów frekwencji
            </Text>
          </View>
        ) : (
          dayGroups.map((day) => {
            const expanded = expandedDays.has(day.dateKey);
            return (
              <View
                key={day.dateKey}
                style={[
                  styles.dayCard,
                  { backgroundColor: palette.surface, borderColor: palette.outline },
                  shadow,
                ]}
              >
                {/* ── Day header ── */}
                <TouchableOpacity
                  onPress={() => toggleDay(day.dateKey)}
                  activeOpacity={0.72}
                  style={styles.dayHeader}
                >
                  <View style={styles.dayHeaderLeft}>
                    <Text
                      style={[T.bodyMedium, { color: palette.text }]}
                      numberOfLines={1}
                    >
                      {day.dateLabel}
                    </Text>
                    <Text style={[T.label, { color: palette.textSoft, marginTop: 2 }]}>
                      {lessonCountLabel(day.entries.length)}
                    </Text>
                  </View>
                  <View style={styles.dayHeaderRight}>
                    {day.absentCount > 0 && (
                      <View style={styles.absentBadge}>
                        <Text style={styles.absentBadgeText}>
                          {day.absentCount} N
                        </Text>
                      </View>
                    )}
                    <Ionicons
                      name={expanded ? "chevron-up" : "chevron-down"}
                      size={18}
                      color={palette.textSoft}
                    />
                  </View>
                </TouchableOpacity>

                {/* ── Expanded lesson rows ── */}
                {expanded && (
                  <View style={[styles.entriesList, { borderTopColor: palette.outline }]}>
                    {day.entries.map((r, idx) => {
                      const absent = isAbsent(r);
                      const isSelected = selected.has(r.id);
                      return (
                        <TouchableOpacity
                          key={r.id}
                          onPress={() => {
                            if (selectMode && absent) toggleSelect(r.id);
                          }}
                          onLongPress={() => {
                            if (absent) {
                              setSelectMode(true);
                              toggleSelect(r.id);
                            }
                          }}
                          activeOpacity={selectMode && absent ? 0.65 : 1}
                          style={[
                            styles.entryRow,
                            idx > 0 && {
                              borderTopWidth: StyleSheet.hairlineWidth,
                              borderTopColor: palette.outline,
                            },
                            isSelected && { backgroundColor: palette.primaryFixed },
                          ]}
                        >
                          {selectMode && absent ? (
                            <View
                              style={[
                                styles.checkbox,
                                {
                                  backgroundColor: isSelected ? palette.primary : "transparent",
                                  borderColor: isSelected ? palette.primary : palette.textSoft,
                                },
                              ]}
                            >
                              {isSelected && (
                                <Ionicons name="checkmark" size={12} color="#fff" />
                              )}
                            </View>
                          ) : (
                            <View style={styles.checkboxPlaceholder} />
                          )}

                          <View style={{ flex: 1 }}>
                            <Text style={[T.label, { color: palette.textSoft }]}>
                              {r.godzina_lekcyjna != null
                                ? `Lekcja ${r.godzina_lekcyjna}`
                                : "—"}
                            </Text>
                            {r.subject_name ? (
                              <Text
                                style={[T.label, { color: palette.text, marginTop: 1 }]}
                                numberOfLines={1}
                              >
                                {r.subject_name}
                              </Text>
                            ) : null}
                          </View>

                          <View
                            style={[
                              styles.statusBadge,
                              { backgroundColor: statusBg(r.status) },
                            ]}
                          >
                            <Text
                              style={[
                                T.labelBold,
                                { color: statusColor(r.status), fontSize: 12 },
                              ]}
                            >
                              {r.status ?? "—"}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ── Excuse modal ── */}
      <Modal
        visible={excuseModal}
        transparent
        animationType="fade"
        onRequestClose={() => setExcuseModal(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setExcuseModal(false)}>
          <Pressable
            style={[styles.modal, { backgroundColor: palette.surface }]}
            onStartShouldSetResponder={() => true}
          >
            <Text style={[T.title, { color: palette.text, marginBottom: S[4] }]}>
              Usprawiedliwienie
            </Text>
            <Text style={[T.label, { color: palette.textSoft, marginBottom: S[2] }]}>
              Zaznaczono {selected.size} wpis(ów).
            </Text>
            <Text style={[T.label, { color: palette.textMuted, marginBottom: S[2] }]}>
              Powód:
            </Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="np. Choroba, wizyta lekarska..."
              placeholderTextColor={palette.textSoft}
              style={[
                styles.input,
                {
                  color: palette.text,
                  borderColor: palette.outline,
                  backgroundColor: palette.background,
                },
              ]}
              multiline
              numberOfLines={3}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setExcuseModal(false)}
                style={[styles.modalBtn, { backgroundColor: palette.outline }]}
              >
                <Text style={[T.labelBold, { color: palette.text }]}>Anuluj</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={submitExcuse}
                disabled={!reason.trim() || submitting}
                style={[
                  styles.modalBtn,
                  { backgroundColor: reason.trim() ? palette.primary : palette.outline },
                ]}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text
                    style={[
                      T.labelBold,
                      { color: reason.trim() ? "#fff" : palette.textSoft },
                    ]}
                  >
                    Wyślij
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  selectBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: S[4],
    paddingVertical: S[3],
    borderBottomWidth: 1,
    gap: S[3],
  },
  cancelBtn: { padding: S[1] },
  excuseBtn: {
    marginLeft: "auto",
    paddingHorizontal: S[4],
    paddingVertical: S[2],
    borderRadius: R.full,
  },

  excuseHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: S[2],
    marginBottom: S[3],
    padding: S[3],
    borderRadius: R.md,
  },

  listContent: {
    paddingHorizontal: S[4],
    paddingTop: S[4],
    paddingBottom: 120,
  },
  emptyWrap: { alignItems: "center", marginTop: 80 },

  // Day card
  dayCard: {
    borderRadius: R.lg,
    marginBottom: S[3],
    borderWidth: 1,
    overflow: "hidden",
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: S[4],
    paddingVertical: S[4],
    gap: S[3],
  },
  dayHeaderLeft: { flex: 1 },
  dayHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: S[2],
  },
  absentBadge: {
    paddingHorizontal: S[2] + 2,
    paddingVertical: 3,
    borderRadius: R.full,
    backgroundColor: "#dc262620",
  },
  absentBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#dc2626",
  },

  // Lesson entry rows
  entriesList: {
    borderTopWidth: 1,
  },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: S[4],
    paddingVertical: S[3],
    gap: S[3],
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: R.sm,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxPlaceholder: {
    width: 20,
    height: 20,
  },
  statusBadge: {
    paddingHorizontal: S[3],
    paddingVertical: S[1] + 2,
    borderRadius: R.full,
  },

  // Excuse modal
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: S[5],
  },
  modal: {
    width: "100%",
    borderRadius: R.xl,
    padding: S[5],
    maxWidth: 420,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: R.md,
    padding: S[3],
    fontSize: 15,
    marginBottom: S[4],
    minHeight: 80,
    textAlignVertical: "top",
  },
  modalActions: { flexDirection: "row", gap: S[3] },
  modalBtn: {
    flex: 1,
    paddingVertical: S[3],
    borderRadius: R.md,
    alignItems: "center",
  },
});
