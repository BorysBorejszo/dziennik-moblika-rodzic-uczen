import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useEffect, useState } from "react";
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

const statusColor = (status: string | null): string => {
  if (!status) return "#6b7280";
  const s = status.toLowerCase();
  if (s.includes("obecn")) return "#16a34a";
  if (s.includes("uspraw")) return "#2563eb";
  if (s.includes("spóźn") || s.includes("spozn")) return "#d97706";
  return "#dc2626";
};

const statusBg = (status: string | null): string => statusColor(status) + "20";

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

  const load = async () => {
    if (!activeChild) { setLoading(false); return; }
    setFetchError(null);
    try {
      const data = await getParentAttendance(activeChild.id);
      setRecords(data.sort((a, b) => b.data.localeCompare(a.data)));
    } catch (err) {
      console.error("[parent_attendance] Failed to load:", err);
      setFetchError((err instanceof Error ? err.message : null) ?? 'Błąd ładowania danych');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    setSelected(new Set());
    setSelectMode(false);
    void load();
  }, [activeChild?.id, reloadKey]);

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

  const absents = records.filter((r) => {
    const s = (r.status ?? "").toLowerCase();
    return s.includes("nieobecn") || s === "n";
  });

  const childName = activeChild
    ? `${activeChild.first_name} ${activeChild.last_name}`
    : "Uczeń";

  if (fetchError && !loading) {
    return (
      <View style={[styles.root, { backgroundColor: palette.background }]}>
        <Header title="Frekwencja" subtitle={childName} />
        <ErrorState message={fetchError} onRetry={() => setReloadKey(k => k + 1)} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: palette.background }]}>
      <Header title="Frekwencja" subtitle={childName} />

      {selectMode && (
        <View style={[styles.selectBar, { backgroundColor: palette.surface, borderBottomColor: palette.outline }]}>
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
            <Text style={[T.labelBold, { color: selected.size > 0 ? "#fff" : palette.textSoft }]}>
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
        {!selectMode && absents.length > 0 && (
          <TouchableOpacity
            onPress={() => setSelectMode(true)}
            style={[styles.excuseHint, { backgroundColor: palette.primaryFixed }]}
          >
            <Ionicons name="checkmark-circle-outline" size={18} color={palette.primary} />
            <Text style={[T.label, { color: palette.primary }]}>
              Dotknij, aby wybrać nieobecności do usprawiedliwienia
            </Text>
          </TouchableOpacity>
        )}

        {loading ? (
          <ActivityIndicator color={palette.primary} style={{ marginTop: S[8] }} />
        ) : absents.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="stats-chart-outline" size={48} color={palette.textSoft} />
            <Text style={[T.bodyMedium, { color: palette.textSoft, marginTop: S[3] }]}>
              Brak nieobecności
            </Text>
          </View>
        ) : (
          absents.map((r) => {
            const isSelected = selected.has(r.id);
            const date = new Date(r.data);
            const dateStr = isNaN(date.getTime())
              ? r.data
              : date.toLocaleDateString("pl-PL", { weekday: "short", day: "numeric", month: "short" });
            return (
              <TouchableOpacity
                key={r.id}
                onPress={() => selectMode && toggleSelect(r.id)}
                onLongPress={() => { setSelectMode(true); toggleSelect(r.id); }}
                activeOpacity={0.75}
                style={[
                  styles.record,
                  { backgroundColor: palette.surface, borderColor: isSelected ? palette.primary : "transparent" },
                  shadow,
                ]}
              >
                {selectMode && (
                  <View
                    style={[
                      styles.checkbox,
                      {
                        backgroundColor: isSelected ? palette.primary : "transparent",
                        borderColor: isSelected ? palette.primary : palette.textSoft,
                      },
                    ]}
                  >
                    {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                )}
                <View style={styles.recordLeft}>
                  <Text style={[T.bodyMedium, { color: palette.text }]}>{dateStr}</Text>
                  {r.godzina_lekcyjna !== null && (
                    <Text style={[T.label, { color: palette.textSoft }]}>
                      Lekcja {r.godzina_lekcyjna}
                    </Text>
                  )}
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusBg(r.status) }]}>
                  <Text style={[T.labelBold, { color: statusColor(r.status) }]}>
                    {r.status ?? "—"}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

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
                { color: palette.text, borderColor: palette.outline, backgroundColor: palette.background },
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
                  <Text style={[T.labelBold, { color: reason.trim() ? "#fff" : palette.textSoft }]}>
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
    marginHorizontal: S[4],
    marginBottom: S[3],
    padding: S[3],
    borderRadius: R.md,
  },
  listContent: { paddingHorizontal: S[4], paddingTop: S[4], paddingBottom: 120 },
  emptyWrap: { alignItems: "center", marginTop: 80 },
  record: {
    flexDirection: "row",
    alignItems: "center",
    padding: S[4],
    borderRadius: R.lg,
    marginBottom: S[3],
    borderWidth: 2,
    gap: S[3],
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: R.sm,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  recordLeft: { flex: 1 },
  statusBadge: {
    paddingHorizontal: S[3],
    paddingVertical: S[1] + 2,
    borderRadius: R.full,
  },
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
