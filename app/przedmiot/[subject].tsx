import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import {
    calculateWeightedAverage,
    getStoredGradesPeriod,
    getUserGrades,
    GradeItem,
    setStoredGradesPeriod,
    SubjectGrades,
} from "../api/grades";
import { SegmentedControl, SectionHeader } from "../components/editorial/MobileBlocks";
import SafeView from "../components/SafeView";
import EmptyState from "../components/ui/EmptyState";
import { useUser } from "../context/UserContext";
import { R, S, T, cardShadow, floatingShadow, getEditorialPalette } from "../theme/editorial";
import { useTheme } from "../theme/ThemeContext";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatGradeLabel(value: number): string {
    const rounded = Math.round(value * 100) / 100;
    const intValue = Math.floor(rounded);
    const decimal = Math.round((rounded - intValue) * 100) / 100;
    if (decimal < 0.01) return String(intValue);
    if (Math.abs(decimal - 0.5) < 0.01) return `${intValue}+`;
    if (Math.abs(decimal - 0.75) < 0.01) return `${intValue + 1}-`;
    return String(value);
}

type GradeTone = { bg: string; text: string; border: string };

function getGradeTone(value: number, isDark: boolean): GradeTone {
    if (Number.isNaN(value)) {
        return isDark
            ? { bg: "#27272a", text: "#d4d4d8", border: "#52525b" }
            : { bg: "#f4f4f5", text: "#3f3f46", border: "#a1a1aa" };
    }
    if (value >= 5) {
        return isDark
            ? { bg: "rgba(6,78,59,0.25)", text: "#34d399", border: "#10b981" }
            : { bg: "#d1fae5", text: "#065f46", border: "#10b981" };
    }
    if (value >= 4) {
        return isDark
            ? { bg: "rgba(20,83,45,0.25)", text: "#4ade80", border: "#22c55e" }
            : { bg: "#dcfce7", text: "#15803d", border: "#22c55e" };
    }
    if (value >= 3) {
        return isDark
            ? { bg: "rgba(113,63,18,0.25)", text: "#facc15", border: "#eab308" }
            : { bg: "#fef9c3", text: "#a16207", border: "#eab308" };
    }
    if (value >= 2) {
        return isDark
            ? { bg: "rgba(154,52,18,0.25)", text: "#fb923c", border: "#f97316" }
            : { bg: "#ffedd5", text: "#c2410c", border: "#f97316" };
    }
    return isDark
        ? { bg: "rgba(127,29,29,0.25)", text: "#f87171", border: "#ef4444" }
        : { bg: "#fee2e2", text: "#b91c1c", border: "#ef4444" };
}

function getBehaviorTone(value: number, isDark: boolean): GradeTone {
    if (value >= 1) {
        return isDark
            ? { bg: "rgba(6,78,59,0.25)", text: "#34d399", border: "#10b981" }
            : { bg: "#d1fae5", text: "#065f46", border: "#10b981" };
    }
    return isDark
        ? { bg: "rgba(127,29,29,0.25)", text: "#f87171", border: "#ef4444" }
        : { bg: "#fee2e2", text: "#b91c1c", border: "#ef4444" };
}

// ---------------------------------------------------------------------------
// Detail row (modal)
// ---------------------------------------------------------------------------

type PaletteArg = ReturnType<typeof getEditorialPalette>;

function DetailRow({ label, value, palette }: { label: string; value: string; palette: PaletteArg }) {
    return (
        <View style={[detailRowStyles.row, { backgroundColor: palette.surfaceLow }]}>
            <Text style={[T.meta, { color: palette.textSoft }]}>{label}</Text>
            <Text style={[T.body, detailRowStyles.value, { color: palette.text }]}>{value}</Text>
        </View>
    );
}

const detailRowStyles = StyleSheet.create({
    row: { borderRadius: 18, paddingHorizontal: S[4], paddingVertical: 14 },
    value: { marginTop: S[1] + 2 },
});

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function SubjectDetails() {
    const { subject } = useLocalSearchParams<{ subject: string }>();
    const { theme } = useTheme();
    const { user } = useUser();
    const router = useRouter();
    const palette = getEditorialPalette(theme);
    const isDark = theme === "dark";
    const shadow = cardShadow(theme);
    const modalShadow = floatingShadow(theme);

    const [subjectData, setSubjectData] = useState<SubjectGrades | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedGrade, setSelectedGrade] = useState<GradeItem | null>(null);
    const [semesterFilter, setSemesterFilterState] = useState<"semester1" | "semester2">("semester1");

    useEffect(() => {
        let cancelled = false;
        void getStoredGradesPeriod().then((stored) => {
            if (!cancelled) setSemesterFilterState(stored === 2 ? "semester2" : "semester1");
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
        void load();
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
                return semesterFilter === "semester1" ? semester === 1 : semester === 2;
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [semesterFilter, subjectData]);

    const summaryValue = useMemo(() => {
        if (!subjectData) return null;
        if (isBehaviorSubject) {
            return visibleGrades.reduce((acc, g) => acc + (Number(g.value) || 0), 0);
        }
        return calculateWeightedAverage(visibleGrades);
    }, [subjectData, visibleGrades, isBehaviorSubject]);

    const summaryDisplay =
        summaryValue === null ? "—"
        : isBehaviorSubject ? String(summaryValue)
        : summaryValue.toFixed(2);

    const summaryTone: GradeTone = isBehaviorSubject
        ? getBehaviorTone(summaryValue ?? 0, isDark)
        : getGradeTone(summaryValue ?? 0, isDark);

    const progressWidth = isBehaviorSubject
        ? 0
        : summaryValue !== null
            ? Math.min(100, (summaryValue / 6) * 100)
            : 0;

    const displayValue = (g: GradeItem): string => {
        if (isBehaviorSubject) return String(Math.round(Number(g.value) || 0));
        const num = Number(g.value);
        if (!isNaN(num)) return formatGradeLabel(num);
        return g.label ?? String(g.value);
    };

    const chipTone = (g: GradeItem): GradeTone => {
        const v = Number(g.value);
        return isBehaviorSubject ? getBehaviorTone(v, isDark) : getGradeTone(v, isDark);
    };

    return (
        <SafeView edges={["top"]} style={[styles.root, { backgroundColor: palette.background }]}>
            <ScrollView
                stickyHeaderIndices={[0]}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* ── Sticky top bar ── */}
                <View style={[styles.topBar, { backgroundColor: palette.background }]}>
                    <TouchableOpacity
                        onPress={() => router.push("/(tabs)/grades")}
                        style={[styles.backBtn, { backgroundColor: palette.surfaceGlass }, shadow]}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="arrow-back" size={22} color={palette.primary} />
                    </TouchableOpacity>
                    <View style={styles.topBarTitle}>
                        <Text style={[T.headline, { color: palette.text }]} numberOfLines={1}>
                            {subject ?? "Przedmiot"}
                        </Text>
                    </View>
                </View>

                {/* ── Page content ── */}
                <View style={styles.content}>
                    {/* Summary hero card */}
                    <View style={[styles.summaryCard, { backgroundColor: palette.surface }, shadow]}>
                        <Text style={[T.eyebrow, { color: palette.textSoft, marginBottom: S[1] }]}>
                            {semesterFilter === "semester1" ? "1 SEMESTR" : "2 SEMESTR"}
                        </Text>
                        <Text style={[styles.summaryValue, { color: summaryTone.text }]}>
                            {summaryDisplay}
                        </Text>
                        {!isBehaviorSubject && (
                            <>
                                <Text style={[T.label, { color: palette.textMuted, marginTop: S[1] }]}>
                                    Średnia ważona
                                </Text>
                                <View style={[styles.progressTrack, { backgroundColor: palette.primaryFixed }]}>
                                    <View
                                        style={[
                                            styles.progressFill,
                                            { backgroundColor: summaryTone.border, width: `${progressWidth}%` },
                                        ]}
                                    />
                                </View>
                            </>
                        )}
                        {isBehaviorSubject && (
                            <Text style={[T.label, { color: palette.textMuted, marginTop: S[1] }]}>
                                Suma punktów zachowania
                            </Text>
                        )}
                    </View>

                    {/* Semester segmented control */}
                    <View style={styles.segControl}>
                        <SegmentedControl
                            value={semesterFilter}
                            onChange={setSemesterFilter}
                            options={[
                                { key: "semester1", label: "1 semestr" },
                                { key: "semester2", label: "2 semestr" },
                            ]}
                        />
                    </View>

                    {/* Section header */}
                    <View style={styles.sectionHeaderWrap}>
                        <SectionHeader
                            eyebrow={isBehaviorSubject ? "Punkty" : "Przegląd"}
                            title={isBehaviorSubject ? "Wpisy zachowania" : "Oceny"}
                            meta={loading ? "..." : String(visibleGrades.length)}
                        />
                    </View>

                    {/* Loading */}
                    {loading && (
                        <View style={styles.loadingCenter}>
                            <ActivityIndicator size="large" color={palette.primary} />
                        </View>
                    )}

                    {/* Empty: subject not found */}
                    {!loading && !subjectData && (
                        <EmptyState
                            icon="file-tray-outline"
                            title="Nie znaleziono przedmiotu"
                            subtitle="Sprawdź czy jesteś zalogowany i odśwież dane."
                        />
                    )}

                    {/* Empty: no grades in this semester */}
                    {!loading && subjectData && visibleGrades.length === 0 && (
                        <EmptyState
                            icon="ribbon-outline"
                            title="Brak ocen"
                            subtitle="Brak wpisów w wybranym semestrze."
                        />
                    )}

                    {/* Grade rows */}
                    {!loading && visibleGrades.map((grade, idx) => {
                        const tone = chipTone(grade);
                        const dateStr = new Date(grade.date).toLocaleDateString("pl-PL", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                        });
                        return (
                            <TouchableOpacity
                                key={idx}
                                activeOpacity={0.85}
                                onPress={() => setSelectedGrade(grade)}
                                style={[
                                    styles.gradeRow,
                                    {
                                        backgroundColor: idx % 2 === 0 ? palette.surface : palette.surfaceLow,
                                    },
                                    shadow,
                                ]}
                                accessibilityRole="button"
                                accessibilityLabel={`${grade.category ?? "Ocena"}, ${displayValue(grade)}, ${dateStr}`}
                            >
                                {/* Grade chip */}
                                <View style={[styles.gradeChip, { backgroundColor: tone.bg, borderBottomColor: tone.border }]}>
                                    <Text style={[styles.gradeChipText, { color: tone.text }]}>
                                        {displayValue(grade)}
                                    </Text>
                                </View>

                                {/* Meta */}
                                <View style={styles.gradeMeta}>
                                    <Text style={[T.bodyMedium, { color: palette.text }]} numberOfLines={1}>
                                        {grade.category || (isBehaviorSubject ? "Wpis zachowania" : "Ocena")}
                                    </Text>
                                    {!isBehaviorSubject && grade.weight != null && grade.weight > 1 && (
                                        <Text style={[T.meta, { color: palette.textSoft, marginTop: 2 }]}>
                                            Waga: {grade.weight}
                                        </Text>
                                    )}
                                    {isBehaviorSubject && grade.label && grade.label !== grade.category && (
                                        <Text style={[T.meta, { color: palette.textSoft, marginTop: 2 }]} numberOfLines={1}>
                                            {grade.label}
                                        </Text>
                                    )}
                                </View>

                                {/* Trailing */}
                                <View style={styles.gradeTrailing}>
                                    <Text style={[T.meta, { color: palette.textSoft }]}>{dateStr}</Text>
                                    <Ionicons
                                        name="chevron-forward"
                                        size={14}
                                        color={palette.textSoft}
                                        style={{ marginTop: 4 }}
                                    />
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </ScrollView>

            {/* ── Grade detail modal ── */}
            <Modal
                visible={!!selectedGrade}
                transparent
                animationType="fade"
                onRequestClose={() => setSelectedGrade(null)}
            >
                <View style={[styles.modalScrim, { backgroundColor: palette.scrim }]}>
                    <View style={[styles.modalCard, { backgroundColor: palette.surface }, modalShadow]}>
                        {selectedGrade ? (
                            <>
                                {/* Header */}
                                <View style={styles.modalHeader}>
                                    <View
                                        style={[
                                            styles.modalBadge,
                                            {
                                                backgroundColor: chipTone(selectedGrade).bg,
                                                borderBottomColor: chipTone(selectedGrade).border,
                                            },
                                        ]}
                                    >
                                        <Text style={[styles.modalBadgeText, { color: chipTone(selectedGrade).text }]}>
                                            {displayValue(selectedGrade)}
                                        </Text>
                                    </View>
                                    <View style={styles.modalTitleBlock}>
                                        <Text style={[T.eyebrow, { color: palette.textSoft, marginBottom: S[1] }]}>
                                            {isBehaviorSubject ? "WPIS ZACHOWANIA" : "SZCZEGÓŁY OCENY"}
                                        </Text>
                                        <Text style={[T.headline, { color: palette.text, fontSize: 22, lineHeight: 26 }]}>
                                            {selectedGrade.category || (isBehaviorSubject ? "Wpis" : "Ocena")}
                                        </Text>
                                        <Text style={[T.meta, { color: palette.textMuted, marginTop: S[1] }]}>
                                            {new Date(selectedGrade.date).toLocaleDateString("pl-PL", {
                                                day: "2-digit",
                                                month: "long",
                                                year: "numeric",
                                            })}
                                        </Text>
                                    </View>
                                </View>

                                {/* Detail rows */}
                                <View style={styles.detailStack}>
                                    <DetailRow
                                        label="Ocena"
                                        value={displayValue(selectedGrade)}
                                        palette={palette}
                                    />
                                    {isBehaviorSubject ? (
                                        <DetailRow
                                            label="Komentarz"
                                            value={selectedGrade.label ?? selectedGrade.category ?? "—"}
                                            palette={palette}
                                        />
                                    ) : (
                                        <>
                                            <DetailRow
                                                label="Waga"
                                                value={String(selectedGrade.weight ?? 1)}
                                                palette={palette}
                                            />
                                            <DetailRow
                                                label="Kategoria"
                                                value={selectedGrade.category ?? "—"}
                                                palette={palette}
                                            />
                                        </>
                                    )}
                                    <DetailRow
                                        label="Data"
                                        value={new Date(selectedGrade.date).toLocaleString("pl-PL", {
                                            day: "2-digit",
                                            month: "2-digit",
                                            year: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                        palette={palette}
                                    />
                                </View>

                                {/* Close button */}
                                <TouchableOpacity
                                    onPress={() => setSelectedGrade(null)}
                                    style={[styles.closeBtn, { backgroundColor: palette.primary }]}
                                    activeOpacity={0.85}
                                    accessibilityRole="button"
                                >
                                    <Text style={[T.labelBold, { color: palette.onPrimary }]}>Zamknij</Text>
                                </TouchableOpacity>
                            </>
                        ) : null}
                    </View>
                </View>
            </Modal>
        </SafeView>
    );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
    root: { flex: 1 },
    scrollContent: { paddingBottom: 120 },

    // Top bar
    topBar: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: S[4],
        paddingTop: S[2] + 2,
        paddingBottom: 18,
        zIndex: 20,
    },
    backBtn: {
        width: 48,
        height: 48,
        borderRadius: R.full,
        alignItems: "center",
        justifyContent: "center",
    },
    topBarTitle: { flex: 1, marginLeft: S[3] },

    // Content
    content: { paddingHorizontal: S[4] },

    // Summary hero card
    summaryCard: {
        borderRadius: R.lg,
        paddingHorizontal: S[5],
        paddingTop: S[5],
        paddingBottom: S[4],
        alignItems: "center",
        marginBottom: S[4],
    },
    summaryValue: {
        fontSize: 52,
        fontWeight: "900",
        lineHeight: 58,
        letterSpacing: -1.5,
        textAlign: "center",
        marginTop: S[1],
    },
    progressTrack: {
        width: "100%",
        height: 4,
        borderRadius: R.full,
        marginTop: S[4],
        overflow: "hidden",
    },
    progressFill: {
        height: "100%",
        borderRadius: R.full,
    },

    // Segmented control + section header
    segControl: { marginBottom: S[4] },
    sectionHeaderWrap: { marginBottom: S[2] },
    loadingCenter: { paddingVertical: S[8], alignItems: "center" },

    // Grade row
    gradeRow: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: R.lg,
        paddingHorizontal: S[4],
        paddingVertical: S[4],
        marginBottom: S[2],
        gap: S[3],
    },
    gradeChip: {
        width: 52,
        height: 52,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        borderBottomWidth: 2,
        flexShrink: 0,
    },
    gradeChipText: {
        fontSize: 16,
        fontWeight: "800",
        lineHeight: 20,
    },
    gradeMeta: { flex: 1 },
    gradeTrailing: { alignItems: "flex-end", flexShrink: 0 },

    // Modal
    modalScrim: {
        flex: 1,
        justifyContent: "center",
        paddingHorizontal: S[5],
    },
    modalCard: {
        borderRadius: 28,
        padding: 22,
    },
    modalHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: S[5],
        gap: S[4],
    },
    modalBadge: {
        width: 72,
        height: 72,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
        borderBottomWidth: 3,
        flexShrink: 0,
    },
    modalBadgeText: {
        fontSize: 24,
        fontWeight: "900",
        lineHeight: 28,
    },
    modalTitleBlock: { flex: 1 },
    detailStack: { gap: 10, marginBottom: S[5] },
    closeBtn: {
        borderRadius: R.full,
        minHeight: 52,
        alignItems: "center",
        justifyContent: "center",
    },
});
