import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    FlatList,
    Modal,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import {
    calculateWeightedAverage,
    getStoredGradesPeriod,
    getUserGrades,
    setStoredGradesPeriod,
    SubjectGrades,
} from "../api/grades";
import {
    SearchField,
    SegmentedControl,
    SectionHeader,
} from "../components/editorial/MobileBlocks";
import Header from "../components/Header";
import EmptyState from "../components/ui/EmptyState";
import { SkeletonCard } from "../components/ui/SkeletonItem";
import { useUser } from "../context/UserContext";
import { R, S, T, cardShadow, getEditorialPalette } from "../theme/editorial";
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

type SubjectColorScheme = { bg: string; text: string };

function getSubjectColorScheme(subjectName: string, isDark: boolean): SubjectColorScheme {
    const name = subjectName.toLowerCase();
    const tertiary = ["matematyk", "biologi", "angielski", "plastyk", "wos", "muzyk"];
    const secondary = ["fizyk", "histori", "informatyk", "etyk", "geografi"];
    if (tertiary.some((k) => name.includes(k))) {
        return isDark
            ? { bg: "rgba(100,60,0,0.45)", text: "#ffdcbc" }
            : { bg: "#ffdcbc", text: "#2c1700" };
    }
    if (secondary.some((k) => name.includes(k))) {
        return isDark
            ? { bg: "#2d4770", text: "#d6e3ff" }
            : { bg: "#d6e3ff", text: "#001b3d" };
    }
    return isDark
        ? { bg: "rgba(0,64,161,0.35)", text: "#b2c5ff" }
        : { bg: "#dae2ff", text: "#001847" };
}

const SUBJECT_ICON_MAP: [string, keyof typeof Ionicons.glyphMap][] = [
    ["polski", "book-outline"],
    ["matematyk", "calculator-outline"],
    ["fizyk", "rocket-outline"],
    ["chemia", "flask-outline"],
    ["biologi", "leaf-outline"],
    ["histori", "time-outline"],
    ["geografi", "earth-outline"],
    ["angielski", "language-outline"],
    ["informatyk", "desktop-outline"],
    ["wf", "football-outline"],
    ["wychowanie fizyczne", "football-outline"],
    ["plastyk", "color-palette-outline"],
    ["muzyk", "musical-notes-outline"],
    ["religi", "heart-circle-outline"],
    ["etyk", "scale-outline"],
    ["wos", "hammer-outline"],
    ["podstawy", "layers-outline"],
];

function getSubjectIcon(subjectName: string): keyof typeof Ionicons.glyphMap {
    const name = subjectName.toLowerCase();
    for (const [key, icon] of SUBJECT_ICON_MAP) {
        if (name.includes(key)) return icon;
    }
    return "school-outline";
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function Grades() {
    const { theme } = useTheme();
    const { user } = useUser();
    const router = useRouter();
    const palette = getEditorialPalette(theme);
    const isDark = theme === "dark";
    const shadow = cardShadow(theme);

    const [subjects, setSubjects] = useState<SubjectGrades[] | null>(null);
    const [behaviorGrades, setBehaviorGrades] = useState<SubjectGrades | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [mode, setMode] = useState<"subjects" | "behavior">("subjects");
    const [expandedStat, setExpandedStat] = useState<"average" | "behavior" | null>(null);
    const [periodFilter, setPeriodFilterState] = useState<1 | 2>(1);

    useEffect(() => {
        let cancelled = false;
        void getStoredGradesPeriod().then((stored) => {
            if (!cancelled) setPeriodFilterState(stored);
        });
        return () => { cancelled = true; };
    }, []);

    const setPeriodFilter = (next: 1 | 2) => {
        setPeriodFilterState(next);
        void setStoredGradesPeriod(next);
    };

    const load = async () => {
        if (!user) return;
        setLoading(true);
        setError(null);
        try {
            const serverId = user.serverId ?? user.id;
            const gradesResult = await getUserGrades(serverId);
            setSubjects(gradesResult.subjects);
            setBehaviorGrades(gradesResult.behavior ?? null);
        } catch (err) {
            console.error("[grades] Unexpected load error", err);
            setError("Nie udało się pobrać danych.");
            setSubjects([]);
            setBehaviorGrades(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.serverId, user?.id]);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300);
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [search]);

    const getGradeSemester = (grade: { semester?: 1 | 2; date?: string }): 1 | 2 | null => {
        if (grade.semester === 1 || grade.semester === 2) return grade.semester;
        const parsedDate = new Date(grade.date ?? "");
        if (Number.isNaN(parsedDate.getTime())) return null;
        const month = parsedDate.getMonth();
        return month === 0 || month >= 8 ? 1 : 2;
    };

    const overallAverage = useMemo(() => {
        if (!subjects) return null;
        const all = subjects
            .flatMap((s) => s.grades)
            .filter((g) => getGradeSemester(g) === periodFilter);
        return calculateWeightedAverage(all);
    }, [periodFilter, subjects]);

    const { behaviorPointsTotal, behaviorGradeLabel } = useMemo(() => {
        const baseline = 150;
        if (!behaviorGrades || behaviorGrades.grades.length === 0) {
            return { behaviorPointsTotal: baseline, behaviorGradeLabel: "db", behaviorPointsDelta: 0 };
        }
        const sum = behaviorGrades.grades
            .filter((g) => getGradeSemester(g) === periodFilter)
            .reduce((acc, g) => acc + (Number(g.value) || 0), 0);
        const total = baseline + sum;
        const label =
            total >= 351 ? "cel"
            : total >= 251 ? "bdb"
            : total >= 150 ? "db"
            : total >= 75 ? "pop"
            : total >= 26 ? "ndp"
            : "nag";
        return { behaviorPointsTotal: total, behaviorGradeLabel: label, behaviorPointsDelta: sum };
    }, [behaviorGrades, periodFilter]);

    const filteredSubjects = useMemo(() => {
        if (!subjects) return [];
        return subjects
            .filter((s) => s.subject.toLowerCase().includes(debouncedSearch.toLowerCase()))
            .map((s) => ({
                ...s,
                grades: s.grades.filter((g) => getGradeSemester(g) === periodFilter),
            }))
            .filter((s) => s.grades.length > 0)
            .sort((a, b) => {
                const avgA = calculateWeightedAverage(a.grades) ?? 0;
                const avgB = calculateWeightedAverage(b.grades) ?? 0;
                return avgB - avgA;
            });
    }, [periodFilter, debouncedSearch, subjects]);

    // ---------------------------------------------------------------------------
    // Sub-renders
    // ---------------------------------------------------------------------------

    const renderStatCards = () => {
        return (
            <>
                <View style={styles.statsRow}>
                    {/* Average stat */}
                    <TouchableOpacity
                        activeOpacity={0.88}
                        style={styles.statCardTouchable}
                        onPress={() => setExpandedStat((cur) => (cur === "average" ? null : "average"))}
                        accessibilityRole="button"
                        accessibilityLabel={`Srednia: ${overallAverage ? overallAverage.toFixed(2) : "brak"}`}
                    >
                        <View style={[styles.statCard, { backgroundColor: palette.surface }, shadow]}>
                            <Text style={[T.eyebrow, styles.statEyebrow, { color: palette.textSoft }]}>
                                SREDNIA
                            </Text>
                            <Text style={[styles.statValue, { color: palette.primary, fontStyle: "italic" }]}>
                                {overallAverage ? overallAverage.toFixed(2) : "—"}
                            </Text>
                            <View style={[styles.statIndicatorBar, { backgroundColor: palette.primaryFixed }]}>
                                <View style={[styles.statIndicatorFill, { backgroundColor: palette.primary, width: overallAverage ? `${Math.min(100, (overallAverage / 6) * 100)}%` : "0%" }]} />
                            </View>
                        </View>
                    </TouchableOpacity>

                    {/* Behavior stat */}
                    <TouchableOpacity
                        activeOpacity={0.88}
                        style={styles.statCardTouchable}
                        onPress={() => setExpandedStat((cur) => (cur === "behavior" ? null : "behavior"))}
                        accessibilityRole="button"
                        accessibilityLabel={`Zachowanie: ${behaviorGradeLabel}`}
                    >
                        <View style={[styles.statCard, { backgroundColor: palette.surface }, shadow]}>
                            <Text style={[T.eyebrow, styles.statEyebrow, { color: palette.textSoft }]}>
                                ZACHOWANIE
                            </Text>
                            <Text style={[styles.statValue, { color: isDark ? "#ffdcbc" : "#895200" }]}>
                                {behaviorGradeLabel}
                            </Text>
                            <View style={[styles.statIndicatorBar, { backgroundColor: isDark ? "rgba(100,60,0,0.25)" : "#ffdcbc" }]}>
                                <View style={[styles.statIndicatorFill, { backgroundColor: isDark ? "#ffdcbc" : "#895200", width: `${Math.min(100, (behaviorPointsTotal / 400) * 100)}%` }]} />
                            </View>
                        </View>
                    </TouchableOpacity>
                </View>

            </>
        );
    };

    const renderPeriodFilter = () => (
        <View style={styles.periodRow}>
            {([{ key: 1 as const, label: "Okres 1" }, { key: 2 as const, label: "Okres 2" }]).map((opt) => {
                const active = periodFilter === opt.key;
                return (
                    <TouchableOpacity
                        key={opt.key}
                        activeOpacity={0.85}
                        onPress={() => setPeriodFilter(opt.key)}
                        style={[
                            styles.periodPill,
                            {
                                backgroundColor: active ? palette.primary : palette.surfaceMid,
                            },
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                    >
                        <Text
                            style={[
                                T.labelBold,
                                { color: active ? "#ffffff" : palette.textMuted },
                            ]}
                        >
                            {opt.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );

    const renderSubjectCard = (subject: SubjectGrades, index: number) => {
        const average = calculateWeightedAverage(subject.grades);
        const visibleGrades = subject.grades.slice(0, 8);
        const overflow = subject.grades.length - 8;
        const subjectColor = getSubjectColorScheme(subject.subject, isDark);
        const subjectIcon = getSubjectIcon(subject.subject);

        return (
            <TouchableOpacity
                activeOpacity={0.88}
                onPress={() =>
                    router.push(`/przedmiot/${encodeURIComponent(subject.subject)}`)
                }
                style={{ marginTop: index === 0 ? 0 : S[3] }}
                accessibilityRole="button"
                accessibilityLabel={`${subject.subject}, srednia ${average ? average.toFixed(2) : "brak"}, ${subject.grades.length} ocen`}
            >
                <View style={[styles.subjectCard, { backgroundColor: palette.surface }, shadow]}>
                    {/* Header row */}
                    <View style={styles.subjectHeader}>
                        {/* Icon + name */}
                        <View style={styles.subjectLeft}>
                            <View
                                style={[
                                    styles.subjectIconBadge,
                                    { backgroundColor: subjectColor.bg },
                                ]}
                            >
                                <Ionicons name={subjectIcon} size={22} color={subjectColor.text} />
                            </View>
                            <Text
                                style={[styles.subjectName, { color: palette.text }]}
                                numberOfLines={2}
                            >
                                {subject.subject}
                            </Text>
                        </View>

                        {/* Average */}
                        <View style={styles.subjectRight}>
                            <Text style={[styles.subjectAvg, { color: subjectColor.text }]}>
                                {average ? average.toFixed(2) : "—"}
                            </Text>
                            <Text style={[T.eyebrow, { color: palette.textSoft }]}>
                                SREDNIA
                            </Text>
                        </View>
                    </View>

                    {/* Grade chips */}
                    {visibleGrades.length > 0 && (
                        <View style={styles.gradeGrid}>
                            {visibleGrades.map((grade, gi) => {
                                const num = Number(grade.value) || 0;
                                const tone = getGradeTone(num, isDark);
                                return (
                                    <View
                                        key={`${subject.subject}-${gi}`}
                                        style={[
                                            styles.gradeChip,
                                            {
                                                backgroundColor: tone.bg,
                                                borderBottomColor: tone.border,
                                            },
                                        ]}
                                    >
                                        <Text style={[styles.gradeChipText, { color: tone.text }]}>
                                            {formatGradeLabel(num)}
                                        </Text>
                                    </View>
                                );
                            })}
                            {overflow > 0 && (
                                <View
                                    style={[
                                        styles.gradeChip,
                                        {
                                            backgroundColor: palette.surfaceMid,
                                            borderBottomColor: palette.textSoft,
                                        },
                                    ]}
                                >
                                    <Text
                                        style={[styles.gradeChipText, { color: palette.textMuted }]}
                                    >
                                        +{overflow}
                                    </Text>
                                </View>
                            )}
                        </View>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    const renderBehaviorEntry = (grade: SubjectGrades["grades"][number], index: number) => {
        const points = Number(grade.value) || 0;
        const positive = points >= 0;
        const tone = getGradeTone(positive ? 5 : 1, isDark);
        const subject = behaviorGrades?.subject ?? "";

        return (
            <TouchableOpacity
                activeOpacity={0.88}
                onPress={() => router.push(`/przedmiot/${encodeURIComponent(subject)}`)}
                style={{ marginTop: index === 0 ? 0 : S[3] }}
                accessibilityRole="button"
                accessibilityLabel={`${grade.label ?? "Wpis zachowania"}, ${points >= 0 ? "+" : ""}${points} punktow`}
            >
                <View style={[styles.behaviorCard, { backgroundColor: palette.surface }, shadow]}>
                    {/* Points badge */}
                    <View
                        style={[
                            styles.behaviorBadge,
                            {
                                backgroundColor: tone.bg,
                                borderBottomColor: tone.border,
                            },
                        ]}
                    >
                        <Text style={[styles.behaviorPoints, { color: tone.text }]}>
                            {points >= 0 ? `+${points}` : `${points}`}
                        </Text>
                    </View>

                    {/* Label + date */}
                    <View style={{ flex: 1 }}>
                        <Text
                            style={[T.bodyMedium, { color: palette.text }]}
                            numberOfLines={2}
                        >
                            {grade.label ?? "Wpis zachowania"}
                        </Text>
                        <Text
                            style={[
                                T.meta,
                                styles.behaviorDate,
                                { color: palette.textSoft },
                            ]}
                        >
                            {grade.date
                                ? new Date(grade.date).toLocaleDateString("pl-PL")
                                : "Brak daty"}
                        </Text>
                    </View>

                    <Ionicons
                        name="chevron-forward"
                        size={16}
                        color={palette.textSoft}
                        style={{ flexShrink: 0 }}
                    />
                </View>
            </TouchableOpacity>
        );
    };

    const renderModal = () => (
        <Modal
            visible={expandedStat !== null}
            transparent
            animationType="fade"
            onRequestClose={() => setExpandedStat(null)}
        >
            <TouchableOpacity
                activeOpacity={1}
                style={[styles.modalBackdrop, { backgroundColor: palette.scrim }]}
                onPress={() => setExpandedStat(null)}
                accessibilityRole="button"
                accessibilityLabel="Zamknij"
            >
                <View style={styles.modalContent}>
                    {/* Inner card — non-dismissible tap area */}
                    <TouchableOpacity activeOpacity={1}>
                        <View
                            style={[
                                styles.modalCard,
                                { backgroundColor: palette.surface },
                                shadow,
                            ]}
                        >
                            {/* Eyebrow */}
                            <Text
                                style={[
                                    T.eyebrow,
                                    { color: palette.textSoft, marginBottom: S[2] },
                                ]}
                            >
                                {expandedStat === "average" ? "SREDNIA WAZZONA" : "OCENA ZACHOWANIA"}
                            </Text>

                            {/* Big value */}
                            <Text
                                style={[
                                    styles.modalValue,
                                    {
                                        color:
                                            expandedStat === "average"
                                                ? palette.primary
                                                : isDark
                                                ? "#ffdcbc"
                                                : "#895200",
                                        fontStyle:
                                            expandedStat === "average" ? "italic" : "normal",
                                    },
                                ]}
                            >
                                {expandedStat === "average"
                                    ? overallAverage
                                        ? overallAverage.toFixed(2)
                                        : "—"
                                    : behaviorGradeLabel}
                            </Text>

                            {/* Divider */}
                            <View
                                style={[
                                    styles.modalDivider,
                                    { backgroundColor: palette.outlineVariant },
                                ]}
                            />

                            {/* Description */}
                            <Text style={[T.body, { color: palette.textMuted }]}>
                                {expandedStat === "average"
                                    ? "Biezaca srednia wazona ze wszystkich aktywnych ocen w wybranym okresie."
                                    : `Aktualna ocena zachowania obliczona na podstawie punktow. Suma punktow: ${behaviorPointsTotal}.`}
                            </Text>

                            {/* Close button */}
                            <TouchableOpacity
                                activeOpacity={0.85}
                                onPress={() => setExpandedStat(null)}
                                style={[
                                    styles.modalCloseBtn,
                                    { backgroundColor: palette.surfaceMid },
                                ]}
                                accessibilityRole="button"
                            >
                                <Text style={[T.labelBold, { color: palette.textMuted }]}>
                                    Zamknij
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </Modal>
    );

    // ---------------------------------------------------------------------------
    // FlatList header components (memoised for stable references)
    // ---------------------------------------------------------------------------

    const subjectsListHeader = useMemo(() => (
        <View style={styles.pageContent}>
            {renderStatCards()}
            {renderPeriodFilter()}
            <View style={{ marginTop: S[4] }}>
                <SegmentedControl
                    value={mode}
                    onChange={setMode}
                    options={[
                        { key: "subjects", label: "Przedmioty", count: subjects?.length ?? 0 },
                        { key: "behavior", label: "Zachowanie", count: behaviorGrades?.grades.length ?? 0 },
                    ]}
                />
            </View>
            <View style={{ marginTop: S[4] }}>
                <SearchField
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Filtruj przedmiot..."
                />
            </View>
            <View style={{ marginTop: S[6] }}>
                <SectionHeader
                    eyebrow="Przegląd"
                    title="Przedmioty"
                    meta={String(filteredSubjects.length)}
                />
            </View>
        </View>
    // eslint-disable-next-line react-hooks/exhaustive-deps
    ), [mode, subjects, behaviorGrades, search, filteredSubjects.length, palette, isDark, periodFilter, overallAverage, behaviorGradeLabel, behaviorPointsTotal]);

    const behaviorListHeader = useMemo(() => (
        <View style={styles.pageContent}>
            {renderStatCards()}
            {renderPeriodFilter()}
            <View style={{ marginTop: S[4] }}>
                <SegmentedControl
                    value={mode}
                    onChange={setMode}
                    options={[
                        { key: "subjects", label: "Przedmioty", count: subjects?.length ?? 0 },
                        { key: "behavior", label: "Zachowanie", count: behaviorGrades?.grades.length ?? 0 },
                    ]}
                />
            </View>
            <View style={{ marginTop: S[6] }}>
                <SectionHeader
                    eyebrow="Punkty"
                    title="Zachowanie"
                    meta={String(behaviorGrades?.grades.length ?? 0)}
                />
            </View>
        </View>
    // eslint-disable-next-line react-hooks/exhaustive-deps
    ), [mode, subjects, behaviorGrades, palette, isDark, periodFilter, overallAverage, behaviorGradeLabel, behaviorPointsTotal]);

    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------

    return (
        <>
            <View style={{ flex: 1, backgroundColor: palette.background }}>
                <Header title="Oceny" subtitle="Podsumowanie ocen z biezacego okresu" />

                {mode === "subjects" ? (
                    <FlatList
                        data={filteredSubjects}
                        keyExtractor={(item) => item.subject}
                        renderItem={({ item, index }) => (
                            <View style={styles.listItemPadding}>
                                {renderSubjectCard(item, index)}
                            </View>
                        )}
                        ListHeaderComponent={subjectsListHeader}
                        ListEmptyComponent={
                            loading ? (
                                <View style={styles.pageContent}>
                                    <SkeletonCard />
                                    <SkeletonCard />
                                    <SkeletonCard />
                                    <SkeletonCard />
                                </View>
                            ) : error ? (
                                <View style={styles.pageContent}>
                                    <EmptyState
                                        title="Blad pobierania ocen"
                                        subtitle={error}
                                        icon="cloud-offline-outline"
                                    />
                                </View>
                            ) : (
                                <View style={styles.pageContent}>
                                    <EmptyState
                                        title={search ? "Brak dopasowanych przedmiotow" : "Brak ocen"}
                                        subtitle="Gdy pojawia sie pierwsze wpisy, zobaczysz je tutaj."
                                    />
                                </View>
                            )
                        }
                        refreshControl={
                            <RefreshControl
                                refreshing={loading}
                                onRefresh={load}
                                tintColor={palette.primary}
                            />
                        }
                        contentContainerStyle={{ paddingBottom: 120 }}
                        showsVerticalScrollIndicator={false}
                        initialNumToRender={10}
                        maxToRenderPerBatch={5}
                    />
                ) : (
                    <FlatList
                        data={behaviorGrades?.grades ?? []}
                        keyExtractor={(_, index) => `behavior-${index}`}
                        renderItem={({ item, index }) => (
                            <View style={styles.listItemPadding}>
                                {renderBehaviorEntry(item, index)}
                            </View>
                        )}
                        ListHeaderComponent={behaviorListHeader}
                        ListEmptyComponent={
                            <View style={styles.pageContent}>
                                <EmptyState
                                    title="Brak wpisow zachowania"
                                    subtitle="Gdy pojawia sie punkty dodatnie lub ujemne, zobaczysz je tutaj."
                                    icon="happy-outline"
                                />
                            </View>
                        }
                        refreshControl={
                            <RefreshControl
                                refreshing={loading}
                                onRefresh={load}
                                tintColor={palette.primary}
                            />
                        }
                        contentContainerStyle={{ paddingBottom: 120 }}
                        showsVerticalScrollIndicator={false}
                        initialNumToRender={10}
                        maxToRenderPerBatch={5}
                    />
                )}
            </View>

            {renderModal()}
        </>
    );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
    pageContent: {
        paddingHorizontal: S[4],
        paddingTop: S[2],
    },
    listItemPadding: {
        paddingHorizontal: S[4],
    },

    // ── Stat cards ────────────────────────────────────────────────────────────
    statsRow: {
        flexDirection: "row",
        gap: S[3],
        marginBottom: S[3],
    },
    statCardTouchable: {
        flex: 1,
    },
    statCard: {
        borderRadius: R.lg,
        paddingHorizontal: S[4],
        paddingTop: S[4],
        paddingBottom: S[3],
        minHeight: 108,
    },
    statEyebrow: {
        marginBottom: S[1],
    },
    statValue: {
        fontSize: 34,
        lineHeight: 40,
        fontWeight: "900",
        letterSpacing: -1,
    },
    statIndicatorBar: {
        height: 3,
        borderRadius: R.full,
        marginTop: S[3],
        overflow: "hidden",
    },
    statIndicatorFill: {
        height: "100%",
        borderRadius: R.full,
    },

    // ── Period filter ─────────────────────────────────────────────────────────
    periodRow: {
        flexDirection: "row",
        gap: S[2],
        marginTop: S[1],
    },
    periodPill: {
        flex: 1,
        height: 44,
        borderRadius: R.full,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: S[3],
    },

    // ── Subject card ──────────────────────────────────────────────────────────
    subjectCard: {
        borderRadius: R.lg,
        overflow: "hidden",
    },
    subjectHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: S[4] + 2,
        paddingTop: S[4] + 2,
        paddingBottom: S[3] + 2,
    },
    subjectLeft: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
        gap: S[3] + 2,
        paddingRight: S[3],
    },
    subjectIconBadge: {
        width: 48,
        height: 48,
        borderRadius: R.md,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },
    subjectName: {
        fontSize: 16,
        fontWeight: "700",
        lineHeight: 22,
        letterSpacing: -0.1,
        flex: 1,
    },
    subjectRight: {
        alignItems: "flex-end",
        flexShrink: 0,
    },
    subjectAvg: {
        fontSize: 26,
        fontWeight: "800",
        lineHeight: 30,
        letterSpacing: -0.5,
    },

    // ── Grade chips ───────────────────────────────────────────────────────────
    gradeGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: S[2],
        paddingHorizontal: S[4] + 2,
        paddingBottom: S[4] + 2,
    },
    gradeChip: {
        width: 40,
        height: 40,
        borderRadius: R.sm,
        alignItems: "center",
        justifyContent: "center",
        borderBottomWidth: 2,
    },
    gradeChipText: {
        fontSize: 13,
        fontWeight: "700",
        lineHeight: 16,
    },

    // ── Behavior card ─────────────────────────────────────────────────────────
    behaviorCard: {
        borderRadius: R.lg,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: S[4],
        paddingVertical: S[4],
        gap: S[3],
    },
    behaviorBadge: {
        width: 56,
        height: 48,
        borderRadius: R.md,
        alignItems: "center",
        justifyContent: "center",
        borderBottomWidth: 2,
        flexShrink: 0,
    },
    behaviorPoints: {
        fontSize: 16,
        fontWeight: "800",
        letterSpacing: -0.3,
    },
    behaviorDate: {
        marginTop: 3,
        textTransform: "uppercase",
    },

    // ── Attendance stat card ──────────────────────────────────────────────────
    attendanceStatCard: {
        borderRadius: R.lg,
        paddingHorizontal: S[4],
        paddingTop: S[4],
        paddingBottom: S[3],
        marginTop: S[3],
    },
    attendanceStatInner: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    attendanceStatValue: {
        fontSize: 34,
        lineHeight: 40,
        fontWeight: "900",
        letterSpacing: -1,
    },
    attendanceBreakdownRow: {
        flexDirection: "row",
        gap: S[4],
    },
    attendanceBreakdownItem: {
        alignItems: "center",
    },

    // ── Attendance entry row ──────────────────────────────────────────────────
    attendanceEntry: {
        borderRadius: R.lg,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: S[4],
        paddingVertical: S[3] + 2,
        gap: S[3],
    },
    attendanceStatusBadge: {
        width: 40,
        height: 40,
        borderRadius: R.md,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },
    attendanceStatusPill: {
        paddingHorizontal: S[2] + 2,
        paddingVertical: 4,
        borderRadius: R.full,
        flexShrink: 0,
        maxWidth: 90,
        alignItems: "center",
    },

    // ── Modal ─────────────────────────────────────────────────────────────────
    modalBackdrop: {
        flex: 1,
        justifyContent: "flex-start",
    },
    modalContent: {
        marginTop: 100,
        paddingHorizontal: S[4],
    },
    modalCard: {
        borderRadius: R.xl,
        paddingHorizontal: S[6],
        paddingVertical: S[6],
    },
    modalValue: {
        fontSize: 52,
        fontWeight: "900",
        lineHeight: 58,
        letterSpacing: -1.5,
        marginBottom: S[4],
    },
    modalDivider: {
        height: 1,
        marginBottom: S[4],
        borderRadius: R.full,
    },
    modalCloseBtn: {
        marginTop: S[5],
        height: 48,
        borderRadius: R.full,
        alignItems: "center",
        justifyContent: "center",
    },
});
