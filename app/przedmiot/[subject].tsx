import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
    calculateWeightedAverage,
    getStoredGradesPeriod,
    getUserGrades,
    GradeItem,
    setStoredGradesPeriod,
    SubjectGrades,
} from "../api/grades";
import { useUser } from "../context/UserContext";
import { R, S, T, cardShadow, floatingShadow, getEditorialPalette } from "../theme/editorial";
import { useTheme } from "../theme/ThemeContext";

function gradeColor(v: number): string {
    if (v >= 5.75) return "#16A34A";
    if (v >= 4.75) return "#10B981";
    if (v >= 3.75) return "#3B82F6";
    if (v >= 2.75) return "#F59E0B";
    if (v >= 1.75) return "#F97316";
    return "#EF4444";
}

function behaviorColor(v: number): string {
    return v >= 1 ? "#16A34A" : "#EF4444";
}

function formatGradeLabel(value: number): string {
    const rounded = Math.round(value * 100) / 100;
    const intValue = Math.floor(rounded);
    const decimal = Math.round((rounded - intValue) * 100) / 100;
    if (decimal < 0.01) return String(intValue);
    if (Math.abs(decimal - 0.5) < 0.01) return `${intValue}+`;
    if (Math.abs(decimal - 0.75) < 0.01) return `${intValue + 1}-`;
    return String(value);
}

export default function SubjectDetails() {
    const { subject } = useLocalSearchParams<{ subject: string }>();
    const { theme } = useTheme();
    const { user } = useUser();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const palette = getEditorialPalette(theme);
    const shadow = cardShadow(theme);
    const modalShadow = floatingShadow(theme);

    const [subjectData, setSubjectData] = useState<SubjectGrades | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedGrade, setSelectedGrade] = useState<GradeItem | null>(null);
    const [semesterFilter, setSemesterFilterState] = useState<"semester1" | "semester2">("semester1");

    // Hydrate the semester selection from the same AsyncStorage key the
    // grades tab uses (1 / 2), so the picked period is preserved when the
    // user drills into a subject from that tab.
    useEffect(() => {
        let cancelled = false;
        void getStoredGradesPeriod().then((stored) => {
            if (!cancelled) {
                setSemesterFilterState(stored === 2 ? "semester2" : "semester1");
            }
        });
        return () => { cancelled = true; };
    }, []);

    const setSemesterFilter = (next: "semester1" | "semester2") => {
        setSemesterFilterState(next);
        void setStoredGradesPeriod(next === "semester2" ? 2 : 1);
    };

    useEffect(() => {
        const load = async () => {
            if (!user || !subject) return;
            setLoading(true);
            try {
                const serverId = user.serverId ?? user.id;
                const res = await getUserGrades(serverId);
                const found = res.subjects.find((s) => s.subject === subject);
                if (found) {
                    setSubjectData(found);
                } else if (res.behavior && res.behavior.subject === subject) {
                    setSubjectData(res.behavior);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [user, subject]);

    const isBehaviorSubject = !!subjectData && /zachow/i.test(subjectData.subject);

    const getGradeSemester = (grade: GradeItem): 1 | 2 | null => {
        if (grade.semester === 1 || grade.semester === 2) return grade.semester;
        const parsedDate = new Date(grade.date);
        if (Number.isNaN(parsedDate.getTime())) return null;
        const month = parsedDate.getMonth();
        return month === 0 || month >= 8 ? 1 : 2;
    };

    const visibleGrades = useMemo(() => {
        if (!subjectData) return [];
        return [...subjectData.grades]
            .filter((grade) => {
                const semester = getGradeSemester(grade);
                if (semesterFilter === "semester1") return semester === 1;
                return semester === 2;
            })
            .sort((left, right) => {
                const leftTime = new Date(left.date).getTime();
                const rightTime = new Date(right.date).getTime();
                return rightTime - leftTime;
            });
    }, [semesterFilter, subjectData]);

    const summaryValue = useMemo(() => {
        if (!subjectData) return null;
        if (isBehaviorSubject) {
            return visibleGrades.reduce(
                (accumulator, grade) => accumulator + (Number(grade.value) || 0),
                0
            );
        }
        return calculateWeightedAverage(visibleGrades);
    }, [subjectData, visibleGrades, isBehaviorSubject]);

    const summaryLabel = semesterFilter === "semester1" ? "1 semestr" : "2 semestr";
    const summaryDisplay =
        summaryValue === null
            ? "—"
            : isBehaviorSubject
              ? String(summaryValue)
              : summaryValue.toFixed(2);

    const displayValue = (g?: GradeItem | null): string => {
        if (!g) return '';
        if (isBehaviorSubject) return String(Math.round(Number(g.value) || 0));
        const numericValue = Number(g.value);
        if (!isNaN(numericValue)) return formatGradeLabel(numericValue);
        return g.label ?? String(g.value);
    };

    const chipColor = (grade: GradeItem) => {
        const v = Number(grade.value);
        return isBehaviorSubject ? behaviorColor(v) : gradeColor(v);
    };

    const averageColor = summaryValue !== null
        ? (isBehaviorSubject ? (summaryValue >= 0 ? palette.success : palette.danger) : gradeColor(summaryValue))
        : palette.textSoft;

    return (
        <View style={[styles.root, { backgroundColor: palette.background }]}>
            {/* Back header */}
            <View
                style={[
                    styles.backHeader,
                    {
                        backgroundColor: palette.background,
                        paddingTop: insets.top + S[3],
                    },
                ]}
            >
                <TouchableOpacity
                    onPress={() => router.push('/(tabs)/grades')}
                    style={[styles.backBtn, { backgroundColor: palette.surfaceMid }]}
                    activeOpacity={0.75}
                >
                    <Ionicons name="chevron-back" size={20} color={palette.primary} />
                </TouchableOpacity>
                <Text style={[T.title, styles.backTitle, { color: palette.text }]} numberOfLines={1}>
                    {subject ?? "Przedmiot"}
                </Text>
            </View>

            <ScrollView
                contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 64 }]}
                showsVerticalScrollIndicator={false}
            >
                {/* Average card */}
                <View style={[styles.averageCard, { backgroundColor: palette.surface }, shadow]}>
                    <Text style={[T.eyebrow, { color: palette.textSoft, textAlign: "center" }]}>
                        {summaryLabel}
                    </Text>
                    <Text style={[T.display, styles.averageValue, { color: averageColor }]}>
                        {summaryDisplay}
                    </Text>
                    {!isBehaviorSubject && summaryValue !== null && (
                        <Text style={[T.label, { color: palette.textMuted, textAlign: "center", marginTop: S[1] }]}>
                            Średnia ważona
                        </Text>
                    )}
                </View>

                {/* Semester segmented control */}
                <View style={[styles.segShell, { backgroundColor: palette.surfaceMid }]}>
                    {([
                        { key: "semester1" as const, label: "1 semestr" },
                        { key: "semester2" as const, label: "2 semestr" },
                    ]).map((opt) => {
                        const active = semesterFilter === opt.key;
                        return (
                            <TouchableOpacity
                                key={opt.key}
                                activeOpacity={0.85}
                                onPress={() => setSemesterFilter(opt.key)}
                                style={[
                                    styles.segPill,
                                    active && [styles.segPillActive, { backgroundColor: palette.surface }, shadow],
                                ]}
                            >
                                <Text style={[T.labelBold, { color: active ? palette.primary : palette.textMuted }]}>
                                    {opt.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Section header */}
                <View style={styles.gradesSectionHeader}>
                    <Text style={[T.eyebrow, { color: palette.textSoft }]}>OCENY</Text>
                    {visibleGrades.length > 0 && (
                        <View style={[styles.countBadge, { backgroundColor: palette.surfaceMid }]}>
                            <Text style={[T.meta, { color: palette.textMuted }]}>{visibleGrades.length}</Text>
                        </View>
                    )}
                </View>

                {/* Loading / empty states */}
                {loading && (
                    <View style={[styles.emptyWrap, { backgroundColor: palette.surfaceLow }]}>
                        <Text style={[T.body, { color: palette.textMuted, textAlign: "center" }]}>
                            Ładowanie...
                        </Text>
                    </View>
                )}

                {!loading && !subjectData && (
                    <View style={[styles.emptyWrap, { backgroundColor: palette.surfaceLow }]}>
                        <Ionicons name="file-tray-outline" size={28} color={palette.textSoft} />
                        <Text style={[T.title, { color: palette.text, textAlign: "center", marginTop: S[3] }]}>
                            Nie znaleziono przedmiotu
                        </Text>
                    </View>
                )}

                {!loading && subjectData && visibleGrades.length === 0 && (
                    <View style={[styles.emptyWrap, { backgroundColor: palette.surfaceLow }]}>
                        <Ionicons name="ribbon-outline" size={28} color={palette.textSoft} />
                        <Text style={[T.title, { color: palette.text, textAlign: "center", marginTop: S[3] }]}>
                            Brak ocen
                        </Text>
                        <Text style={[T.label, { color: palette.textMuted, textAlign: "center", marginTop: 6 }]}>
                            Brak ocen w wybranym semestrze
                        </Text>
                    </View>
                )}

                {/* Grade list */}
                {!loading && subjectData && visibleGrades.map((grade, idx) => {
                    const color = chipColor(grade);
                    return (
                        <TouchableOpacity
                            key={idx}
                            activeOpacity={0.8}
                            onPress={() => setSelectedGrade(grade)}
                            style={[styles.gradeRow, { backgroundColor: palette.surface }, shadow]}
                        >
                            <View style={[styles.gradeChip, { backgroundColor: color }]}>
                                <Text style={[T.title, { color: "#fff" }]}>
                                    {displayValue(grade)}
                                </Text>
                            </View>
                            <View style={styles.gradeInfo}>
                                <Text style={[T.bodyMedium, { color: palette.text }]} numberOfLines={1}>
                                    {grade.category || "Ocena"}
                                </Text>
                                {!isBehaviorSubject && grade.weight && grade.weight > 1 && (
                                    <Text style={[T.label, { color: palette.textMuted, marginTop: 2 }]}>
                                        Waga: {grade.weight}
                                    </Text>
                                )}
                            </View>
                            <Text style={[T.meta, { color: palette.textSoft }]}>
                                {new Date(grade.date).toLocaleDateString("pl-PL", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric",
                                })}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {/* Grade detail modal */}
            <Modal
                visible={!!selectedGrade}
                transparent
                animationType="fade"
                onRequestClose={() => setSelectedGrade(null)}
            >
                <View style={[styles.modalOverlay, { backgroundColor: palette.scrim }]}>
                    <View style={[styles.modalSheet, { backgroundColor: palette.surface }, modalShadow]}>
                        {/* Modal header */}
                        <View style={styles.modalHeader}>
                            <View
                                style={[
                                    styles.modalBadge,
                                    { backgroundColor: selectedGrade ? chipColor(selectedGrade) : palette.textSoft },
                                ]}
                            >
                                <Text style={[T.headline, { color: "#fff" }]}>
                                    {selectedGrade ? displayValue(selectedGrade) : ''}
                                </Text>
                            </View>
                            <View style={styles.modalHeaderText}>
                                <Text style={[T.title, { color: palette.text }]}>Szczegóły oceny</Text>
                                {selectedGrade && (
                                    <Text style={[T.label, { color: palette.textMuted, marginTop: 2 }]}>
                                        {new Date(selectedGrade.date).toLocaleString("pl-PL", {
                                            day: "2-digit",
                                            month: "2-digit",
                                            year: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                    </Text>
                                )}
                            </View>
                        </View>

                        <View style={[styles.modalDivider, { backgroundColor: palette.outlineVariant }]} />

                        {/* Detail rows */}
                        {selectedGrade && (
                            <View style={styles.modalBody}>
                                {isBehaviorSubject ? (
                                    <>
                                        <ModalRow
                                            label="Ocena"
                                            value={displayValue(selectedGrade)}
                                            palette={palette}
                                        />
                                        <ModalRow
                                            label="Komentarz"
                                            value={selectedGrade.label ?? selectedGrade.category ?? "—"}
                                            palette={palette}
                                        />
                                        <ModalRow
                                            label="Data wpisu"
                                            value={new Date(selectedGrade.date).toLocaleString("pl-PL", {
                                                day: "2-digit",
                                                month: "2-digit",
                                                year: "numeric",
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                            palette={palette}
                                            last
                                        />
                                    </>
                                ) : (
                                    <>
                                        <ModalRow
                                            label="Ocena"
                                            value={displayValue(selectedGrade)}
                                            palette={palette}
                                            valueBold
                                        />
                                        <ModalRow
                                            label="Waga"
                                            value={String(selectedGrade.weight ?? 1)}
                                            palette={palette}
                                        />
                                        <ModalRow
                                            label="Kategoria"
                                            value={selectedGrade.category ?? "—"}
                                            palette={palette}
                                        />
                                        <ModalRow
                                            label="Data"
                                            value={new Date(selectedGrade.date).toLocaleString("pl-PL", {
                                                day: "2-digit",
                                                month: "2-digit",
                                                year: "numeric",
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                            palette={palette}
                                            last
                                        />
                                    </>
                                )}
                            </View>
                        )}

                        {/* Close button */}
                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                onPress={() => setSelectedGrade(null)}
                                style={[styles.closeBtn, { backgroundColor: palette.surfaceMid }]}
                                activeOpacity={0.75}
                            >
                                <Text style={[T.labelBold, { color: palette.text }]}>Zamknij</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

type PaletteArg = ReturnType<typeof getEditorialPalette>;

type ModalRowProps = {
    label: string;
    value: string;
    palette: PaletteArg;
    valueBold?: boolean;
    last?: boolean;
};

function ModalRow({ label, value, palette, valueBold, last }: ModalRowProps) {
    return (
        <View style={[modalRowStyles.row, !last && { marginBottom: S[3] }]}>
            <Text style={[T.label, { color: palette.textSoft, flex: 1 }]}>{label}</Text>
            <Text style={[T.label, { color: palette.text, fontWeight: valueBold ? "700" : "500" }]}>
                {value}
            </Text>
        </View>
    );
}

const modalRowStyles = StyleSheet.create({
    row: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
});

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    backHeader: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 20,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: S[4],
        paddingBottom: S[3],
        gap: S[3],
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: R.full,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },
    backTitle: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: S[4],
        paddingBottom: 120,
    },
    averageCard: {
        borderRadius: R.lg,
        padding: S[6],
        marginBottom: S[4],
        alignItems: "center",
    },
    averageValue: {
        textAlign: "center",
        marginTop: S[2],
    },
    segShell: {
        borderRadius: R.md,
        flexDirection: "row",
        padding: 4,
        gap: 4,
        marginBottom: S[4],
    },
    segPill: {
        flex: 1,
        borderRadius: R.sm,
        paddingVertical: S[2] + 2,
        paddingHorizontal: S[2],
        alignItems: "center",
    },
    segPillActive: {
        borderRadius: R.sm,
    },
    gradesSectionHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: S[2],
        paddingVertical: S[3],
    },
    countBadge: {
        borderRadius: R.full,
        paddingHorizontal: S[2] + 2,
        paddingVertical: 2,
    },
    emptyWrap: {
        borderRadius: R.lg,
        padding: S[8],
        alignItems: "center",
        marginBottom: S[3],
    },
    gradeRow: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: R.lg,
        padding: S[3],
        marginBottom: S[2],
        gap: S[3],
    },
    gradeChip: {
        width: 48,
        height: 48,
        borderRadius: R.md,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },
    gradeInfo: {
        flex: 1,
    },
    // Modal
    modalOverlay: {
        flex: 1,
        justifyContent: "center",
        padding: S[5],
    },
    modalSheet: {
        borderRadius: R.xl,
        padding: S[4],
    },
    modalHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: S[3],
        marginBottom: S[3],
    },
    modalBadge: {
        width: 64,
        height: 64,
        borderRadius: R.full,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },
    modalHeaderText: {
        flex: 1,
    },
    modalDivider: {
        height: StyleSheet.hairlineWidth,
        marginBottom: S[3],
    },
    modalBody: {
        marginBottom: S[3],
    },
    modalFooter: {
        alignItems: "flex-end",
    },
    closeBtn: {
        paddingHorizontal: S[4],
        paddingVertical: S[2] + 2,
        borderRadius: R.md,
    },
});
