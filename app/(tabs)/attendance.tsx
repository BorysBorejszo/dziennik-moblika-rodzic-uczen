import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Modal,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import {
    AttendanceEntry,
    AttendanceRecord,
    getAttendanceById,
    getUserAttendance,
} from "../api/attendance";
import { EditorialPanel, SectionHeader } from "../components/editorial/MobileBlocks";
import Header from "../components/Header";
import ErrorState from "../components/ErrorState";
import Card from "../components/ui/Card";
import EmptyState from "../components/ui/EmptyState";
import { useUser } from "../context/UserContext";
import {
    EditorialPalette,
    R,
    S,
    T,
    cardShadow,
    floatingShadow,
    getEditorialPalette,
} from "../theme/editorial";
import { useTheme } from "../theme/ThemeContext";

type StatusTone = {
    soft: string;
    text: string;
};

type AttendanceStats = {
    present: number;
    late: number;
    absent: number;
    excused: number;
    total: number;
    percentage: string;
};

type AttendanceCounters = Omit<AttendanceStats, "percentage">;

type SubjectSummary = AttendanceCounters & {
    subject: string;
    percentage: number;
    status: "critical" | "warning" | "safe";
};

const SCROLL_THRESHOLD = 80;

function getStatusTone(status: string, palette: EditorialPalette): StatusTone {
    if (status === "Obecny") {
        return { soft: palette.successBg, text: palette.successText };
    }
    if (status === "Spóźniony") {
        return { soft: palette.warningBg, text: palette.warningText };
    }
    if (status === "Usprawiedliwiony" || status === "Zwolnienie") {
        return { soft: palette.infoBg, text: palette.infoText };
    }
    return { soft: palette.dangerBg, text: palette.dangerText };
}

function getStatusInitial(status: string) {
    if (status === "Obecny") return "O";
    if (status === "Spóźniony") return "S";
    if (status === "Usprawiedliwiony") return "U";
    if (status === "Zwolnienie") return "Z";
    return "N";
}

function formatAttendanceDate(value?: string) {
    if (!value) return "Brak daty";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Brak daty";
    return parsed.toLocaleDateString("pl-PL", {
        day: "2-digit",
        month: "long",
        year: "numeric",
    });
}

function getAttendanceNarrative(percentage: string, total: number, absent: number) {
    if (total === 0) {
        return "Dane frekwencji pojawia sie tutaj, gdy system doda pierwsze wpisy.";
    }
    if (absent === 0) {
        return `Bardzo dobry rytm obecnosci. Wszystkie ${total} wpisy wspieraja stabilna frekwencje.`;
    }
    return `Aktualny wynik to ${percentage}. Nieobecnosci wymagajace uwagi: ${absent}.`;
}

function applyAttendanceStatusCounters(
    counters: Omit<AttendanceCounters, "total">,
    status: string
) {
    if (status === "Obecny") counters.present += 1;
    else if (status === "Spóźniony") counters.late += 1;
    else if (status === "Zwolnienie") {
        counters.present += 1;
        counters.excused += 1;
    } else if (status === "Usprawiedliwiony") {
        counters.excused += 1;
        counters.absent += 1;
    } else if (status === "Nieobecny") counters.absent += 1;
}

function computeAttendanceStats(records: AttendanceEntry[]): AttendanceStats {
    const counters: AttendanceCounters = {
        present: 0,
        late: 0,
        absent: 0,
        excused: 0,
        total: records.length,
    };
    records.forEach((entry) => {
        applyAttendanceStatusCounters(counters, entry.status);
    });
    const attendedCount = counters.present + counters.late;
    const percentage =
        counters.total > 0
            ? `${((attendedCount / counters.total) * 100).toFixed(1)}%`
            : "—";
    return { ...counters, percentage };
}

function getSortTimestamp(value: string): number {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
}

type DetailRowProps = {
    label: string;
    value: string;
    palette: EditorialPalette;
};

const DetailRow = memo(function DetailRow({ label, value, palette }: DetailRowProps) {
    return (
        <View style={[styles.detailRow, { backgroundColor: palette.surfaceLow }]}>
            <Text style={[T.meta, { color: palette.textSoft }]}>{label}</Text>
            <Text style={[T.body, styles.detailValue, { color: palette.text }]}>{value}</Text>
        </View>
    );
});

type AttendanceEntryRowProps = {
    entry: AttendanceEntry;
    index: number;
    palette: EditorialPalette;
    onPress: (entry: AttendanceEntry) => void;
};

const AttendanceEntryRow = memo(function AttendanceEntryRow({
    entry,
    index,
    palette,
    onPress,
}: AttendanceEntryRowProps) {
    const tone = getStatusTone(entry.status, palette);

    return (
        <TouchableOpacity
            onPress={() => onPress(entry)}
            activeOpacity={0.88}
            style={{ marginTop: index === 0 ? 0 : S[3] }}
            accessibilityRole="button"
            accessibilityLabel={`${entry.subject}, ${entry.status}, ${formatAttendanceDate(entry.date)}`}
            accessibilityHint="Dotknij dwukrotnie aby zobaczyć szczegóły"
        >
            <Card
                style={{
                    backgroundColor: index % 2 === 0 ? palette.surface : palette.surfaceLow,
                }}
            >
                <View style={styles.entryCardInner}>
                    <View style={[styles.entryInitial, { backgroundColor: tone.soft }]}>
                        <Text style={[T.title, { color: tone.text }]}>
                            {getStatusInitial(entry.status)}
                        </Text>
                    </View>

                    <View style={styles.entryMeta}>
                        <Text style={[T.title, { color: palette.text, marginBottom: S[1] + 2 }]}>
                            {entry.subject}
                        </Text>
                        <Text style={[T.body, { color: palette.textMuted }]}>
                            {formatAttendanceDate(entry.date)}
                        </Text>
                    </View>

                    <View style={styles.entryTrailing}>
                        <View style={[styles.statusChip, { backgroundColor: tone.soft }]}>
                            <Text style={[T.meta, { color: tone.text }]}>{entry.status}</Text>
                        </View>
                        <Text style={[T.meta, { color: palette.textSoft, marginTop: S[2] + 2 }]}>
                            Szczegoly
                        </Text>
                    </View>
                </View>
            </Card>
        </TouchableOpacity>
    );
});

export default function Attendance() {
    const { theme } = useTheme();
    const { user } = useUser();
    const palette = getEditorialPalette(theme);
    const heroBg = theme === "dark" ? "#1e3a8a" : palette.primary;
    const heroFg = theme === "dark" ? "#ffffff" : palette.onPrimary;

    const [showCompact, setShowCompact] = useState(false);
    const [entries, setEntries] = useState<AttendanceEntry[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);
    const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
    const [selectedEntry, setSelectedEntry] = useState<AttendanceEntry | null>(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showExcuseModal, setShowExcuseModal] = useState(false);
    const latestDetailsRequestIdRef = useRef<number | null>(null);
    const lastCompactRef = useRef(false);

    const studentId = user ? (user.serverId ?? user.id) : undefined;
    const stats = useMemo(() => computeAttendanceStats(entries ?? []), [entries]);
    const recentEntries = useMemo(() => (entries ?? []).slice(0, 10), [entries]);

    const fetchData = useCallback(async () => {
        if (!studentId) { setLoading(false); return; }
        setFetchError(null);
        try {
            const res = await getUserAttendance(studentId);
            const sorted = res.recent
                .map((entry) => ({ entry, timestamp: getSortTimestamp(entry.date) }))
                .sort((l, r) => r.timestamp - l.timestamp)
                .map(({ entry }) => entry);
            setEntries(sorted);
        } catch (error) {
            console.error("[attendance] Failed to fetch attendance:", error);
            setEntries([]);
            setFetchError((error instanceof Error ? error.message : null) ?? 'Błąd ładowania danych');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [studentId, reloadKey]);

    const closeDetailsModal = useCallback(() => {
        latestDetailsRequestIdRef.current = null;
        setShowDetailsModal(false);
        setSelectedEntry(null);
        setSelectedRecord(null);
    }, []);

    const closeExcuseModal = useCallback(() => {
        setShowExcuseModal(false);
    }, []);

    const handleRecordClick = useCallback(async (entry: AttendanceEntry) => {
        setSelectedEntry(entry);
        setSelectedRecord(null);
        setShowDetailsModal(true);
        if (!entry.id) return;
        latestDetailsRequestIdRef.current = entry.id;
        try {
            const fullRecord = await getAttendanceById(entry.id);
            if (latestDetailsRequestIdRef.current !== entry.id) return;
            setSelectedRecord(fullRecord);
        } catch (error) {
            console.error("[attendance] Error fetching record details:", error);
        }
    }, []);

    const handleScroll = useCallback(
        (event: NativeSyntheticEvent<NativeScrollEvent>) => {
            const compact = event.nativeEvent.contentOffset.y > SCROLL_THRESHOLD;
            if (lastCompactRef.current === compact) return;
            lastCompactRef.current = compact;
            setShowCompact(compact);
        },
        []
    );

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        void fetchData();
    }, [fetchData]);

    useEffect(() => {
        setLoading(true);
        void fetchData();
    }, [fetchData]);

    const statItems = useMemo(
        () => [
            {
                label: "Obecnosci",
                value: stats.present,
                tone: { backgroundColor: "rgba(255,255,255,0.16)", color: "#f4fff7" },
            },
            {
                label: "Spoznienia",
                value: stats.late,
                tone: { backgroundColor: "rgba(255,255,255,0.12)", color: "#fff2d7" },
            },
            {
                label: "Nieobecnosci",
                value: stats.absent,
                tone: { backgroundColor: "rgba(255,255,255,0.12)", color: "#ffe3dc" },
            },
            {
                label: "Uspraw.",
                value: stats.excused,
                tone: { backgroundColor: "rgba(255,255,255,0.14)", color: "#e8f1ff" },
            },
        ],
        [stats.absent, stats.excused, stats.late, stats.present]
    );

    const modalTone = getStatusTone(selectedEntry?.status ?? "", palette);

    const subjectSummaries = useMemo<SubjectSummary[]>(() => {
        const groups = new Map<string, AttendanceCounters>();
        (entries ?? []).forEach((entry) => {
            const current = groups.get(entry.subject) ?? {
                present: 0,
                late: 0,
                absent: 0,
                excused: 0,
                total: 0,
            };
            current.total += 1;
            applyAttendanceStatusCounters(current, entry.status);
            groups.set(entry.subject, current);
        });
        return Array.from(groups.entries())
            .map(([subject, values]) => {
                const percentage =
                    values.total > 0
                        ? ((values.present + values.late) / values.total) * 100
                        : 0;
                return {
                    subject,
                    ...values,
                    percentage,
                    status: (
                        percentage < 75 || values.absent >= 2
                            ? "critical"
                            : percentage < 90
                              ? "warning"
                              : "safe"
                    ) as SubjectSummary["status"],
                };
            })
            .sort((l, r) => l.percentage - r.percentage);
    }, [entries]);

    const criticalSubjects = useMemo(
        () => subjectSummaries.filter((s) => s.status === "critical"),
        [subjectSummaries]
    );

    if (loading) {
        return (
            <View style={[styles.root, { backgroundColor: palette.background }]}>
                <Header title="Frekwencja" subtitle="Podglad obecnosci i nieobecnosci" />
                <View style={styles.loadingCenter}>
                    <ActivityIndicator size="large" color={palette.primary} />
                </View>
            </View>
        );
    }

    if (fetchError && !refreshing) {
        return (
            <View style={[styles.root, { backgroundColor: palette.background }]}>
                <Header title="Frekwencja" subtitle="Podglad obecnosci i nieobecnosci" />
                <ErrorState message={fetchError} onRetry={() => { setLoading(true); setReloadKey(k => k + 1); }} />
            </View>
        );
    }

    return (
        <>
            <View style={[styles.root, { backgroundColor: palette.background }]}>
                <Header title="Frekwencja" subtitle="Podglad obecnosci i nieobecnosci">
                    {showCompact ? (
                        <View style={styles.compactStats}>
                            <Text style={[T.title, { color: palette.text, textAlign: "center" }]}>
                                {stats.percentage}
                            </Text>
                            <Text
                                style={[
                                    T.meta,
                                    { color: palette.textSoft, marginTop: 2, textAlign: "center" },
                                ]}
                            >
                                {stats.total} wpisow
                            </Text>
                        </View>
                    ) : null}
                </Header>
            <ScrollView
                style={{ flex: 1 }}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={palette.primary}
                    />
                }
                onScroll={handleScroll}
                scrollEventThrottle={16}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
            >

                {/* Page body */}
                <View style={styles.page}>

                    {/* ── Hero card ── */}
                    <View style={styles.heroSection}>
                        <Card style={[styles.heroCard, { backgroundColor: heroBg }]}>
                            {/* Top badges row */}
                            <View style={styles.heroTopRow}>
                                <View style={[styles.heroBadge, styles.heroBadgeLeft]}>
                                    <Text style={[T.meta, { color: "rgba(255,255,255,0.84)" }]}>
                                        Attendance Mode
                                    </Text>
                                </View>
                                <View style={styles.heroBadge}>
                                    <Text style={[T.meta, { color: "rgba(255,255,255,0.84)" }]}>
                                        {stats.total} wpisow
                                    </Text>
                                </View>
                            </View>

                            {/* Eyebrow */}
                            <Text
                                style={[
                                    T.eyebrow,
                                    { color: "rgba(255,255,255,0.74)", marginBottom: S[2] },
                                ]}
                            >
                                Frekwencja ogolna
                            </Text>

                            {/* Big percentage */}
                            <Text style={[T.display, { color: heroFg }]}>
                                {stats.percentage}
                            </Text>

                            {/* Narrative */}
                            <Text
                                style={[
                                    T.body,
                                    {
                                        color: "rgba(255,255,255,0.76)",
                                        marginTop: S[3] + 2,
                                        maxWidth: "86%",
                                    },
                                ]}
                            >
                                {getAttendanceNarrative(stats.percentage, stats.total, stats.absent)}
                            </Text>

                            {/* Excuse action button */}
                            <TouchableOpacity
                                onPress={() => setShowExcuseModal(true)}
                                activeOpacity={0.9}
                                style={[
                                    styles.heroActionButton,
                                    { backgroundColor: "rgba(255,255,255,0.14)" },
                                ]}
                                accessibilityRole="button"
                                accessibilityLabel="Usprawiedliw nieobecność"
                            >
                                <Text style={[T.meta, { color: heroFg }]}>
                                    Usprawiedliw nieobecnosc
                                </Text>
                            </TouchableOpacity>

                            {/* Mini stat tiles */}
                            <View style={styles.heroStatsGrid}>
                                {statItems.map((item) => (
                                    <View
                                        key={item.label}
                                        style={[
                                            styles.heroStatCard,
                                            { backgroundColor: item.tone.backgroundColor },
                                        ]}
                                    >
                                        <Text style={[T.title, { color: item.tone.color }]}>
                                            {item.value}
                                        </Text>
                                        <Text
                                            style={[
                                                T.meta,
                                                { color: "rgba(255,255,255,0.72)", marginTop: S[1] },
                                            ]}
                                        >
                                            {item.label}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        </Card>
                    </View>

                    {/* ── All entries ── */}
                    <View style={styles.section}>
                        <SectionHeader
                            eyebrow="Dziennik obecnosci"
                            title="Ostatnie wpisy"
                            meta={recentEntries.length.toString().padStart(2, "0")}
                        />

                        {!entries || entries.length === 0 ? (
                            <View style={styles.emptyWrap}>
                                <EmptyState
                                    title="Brak wpisow frekwencji"
                                    subtitle="Nowe obecnosci i nieobecnosci pojawia sie tutaj po synchronizacji."
                                />
                            </View>
                        ) : (
                            <View style={styles.listWrap}>
                                <FlatList
                                    data={recentEntries}
                                    keyExtractor={(item, idx) => `${item.id ?? "att"}-${idx}`}
                                    renderItem={({ item, index }) => (
                                        <AttendanceEntryRow
                                            entry={item}
                                            index={index}
                                            palette={palette}
                                            onPress={handleRecordClick}
                                        />
                                    )}
                                    scrollEnabled={false}
                                    initialNumToRender={20}
                                    maxToRenderPerBatch={15}
                                    windowSize={5}
                                    removeClippedSubviews
                                />
                            </View>
                        )}
                    </View>

                    {/* ── Critical subjects ── */}
                    <View style={styles.section}>
                        <SectionHeader
                            eyebrow="Ryzyko"
                            title="Frekwencja krytyczna"
                            meta={String(criticalSubjects.length)}
                        />

                        {criticalSubjects.length > 0 ? (
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.criticalScroll}
                            >
                                {criticalSubjects.map((subject, index) => (
                                    <View
                                        key={subject.subject}
                                        style={{
                                            marginRight:
                                                index === criticalSubjects.length - 1 ? 0 : S[3],
                                        }}
                                    >
                                        <EditorialPanel
                                            style={[
                                                styles.criticalCard,
                                                { backgroundColor: palette.surface },
                                            ]}
                                        >
                                            <Text style={[T.meta, { color: palette.textSoft }]}>
                                                {subject.subject}
                                            </Text>
                                            <Text
                                                style={[
                                                    T.headline,
                                                    {
                                                        color: palette.dangerText,
                                                        fontSize: 24,
                                                        lineHeight: 28,
                                                        marginTop: S[2],
                                                    },
                                                ]}
                                            >
                                                {subject.percentage.toFixed(0)}%
                                            </Text>
                                            <Text
                                                style={[
                                                    T.body,
                                                    { color: palette.textMuted, marginTop: S[2] },
                                                ]}
                                            >
                                                {subject.absent} nieobecnosci, {subject.late} spoznien
                                            </Text>
                                        </EditorialPanel>
                                    </View>
                                ))}
                            </ScrollView>
                        ) : (
                            <EmptyState
                                title="Brak zagrozen"
                                subtitle="Na ten moment zaden przedmiot nie zbliza sie do krytycznej frekwencji."
                            />
                        )}
                    </View>

                    {/* ── By subject ── */}
                    <View style={styles.section}>
                        <SectionHeader
                            eyebrow="Wedlug przedmiotow"
                            title="Frekwencja wedlug przedmiotow"
                            meta={String(subjectSummaries.length)}
                        />

                        {subjectSummaries.length > 0 ? (
                            <FlatList
                                data={subjectSummaries}
                                keyExtractor={(item) => item.subject}
                                renderItem={({ item: subject, index }) => {
                                    const progressColor =
                                        subject.status === "critical"
                                            ? palette.danger
                                            : subject.status === "warning"
                                              ? palette.warning
                                              : palette.success;
                                    return (
                                        <View style={{ marginTop: index === 0 ? 0 : S[3] }}>
                                            <EditorialPanel>
                                                <View style={styles.subjectRow}>
                                                    <View style={styles.subjectLeft}>
                                                        <Text
                                                            style={[
                                                                T.title,
                                                                { color: palette.text },
                                                            ]}
                                                        >
                                                            {subject.subject}
                                                        </Text>
                                                        <Text
                                                            style={[
                                                                T.body,
                                                                {
                                                                    color: palette.textMuted,
                                                                    marginTop: S[1] + 2,
                                                                },
                                                            ]}
                                                        >
                                                            {subject.present} obecnosci,{" "}
                                                            {subject.absent} nieobecnosci,{" "}
                                                            {subject.late} spoznien
                                                        </Text>
                                                        <View
                                                            style={[
                                                                styles.progressTrack,
                                                                { backgroundColor: palette.surfaceLow },
                                                            ]}
                                                        >
                                                            <View
                                                                style={[
                                                                    styles.progressFill,
                                                                    {
                                                                        width: `${Math.max(8, subject.percentage)}%`,
                                                                        backgroundColor: progressColor,
                                                                    },
                                                                ]}
                                                            />
                                                        </View>
                                                    </View>
                                                    <View style={styles.subjectRight}>
                                                        <Text
                                                            style={[
                                                                T.headline,
                                                                {
                                                                    color: progressColor,
                                                                    fontSize: 24,
                                                                    lineHeight: 28,
                                                                },
                                                            ]}
                                                        >
                                                            {subject.percentage.toFixed(0)}%
                                                        </Text>
                                                        <Text
                                                            style={[
                                                                T.meta,
                                                                { color: palette.textSoft, marginTop: S[1] },
                                                            ]}
                                                        >
                                                            Caly rok
                                                        </Text>
                                                    </View>
                                                </View>
                                            </EditorialPanel>
                                        </View>
                                    );
                                }}
                                scrollEnabled={false}
                                initialNumToRender={10}
                                maxToRenderPerBatch={10}
                                windowSize={3}
                                removeClippedSubviews
                            />
                        ) : (
                            <EmptyState
                                title="Brak danych przedmiotowych"
                                subtitle="Sekcja pojawi sie, gdy system zbierze wpisy dla konkretnych zajec."
                            />
                        )}
                    </View>
                </View>
            </ScrollView>
            </View>

            {/* ── Excuse modal ── */}
            <Modal
                visible={showExcuseModal}
                transparent
                animationType="fade"
                onRequestClose={closeExcuseModal}
            >
                <View style={[styles.modalScrim, { backgroundColor: palette.scrim }]}>
                    <View
                        style={[
                            styles.modalCard,
                            { backgroundColor: palette.surface },
                            floatingShadow(theme),
                        ]}
                    >
                        <Text
                            style={[
                                T.headline,
                                { color: palette.text, fontSize: 24, lineHeight: 28 },
                            ]}
                        >
                            Usprawiedliwienie
                        </Text>
                        <Text
                            style={[T.body, { color: palette.textMuted, marginTop: S[3] }]}
                        >
                            Usprawiedliwienia skladane sa przez rodzica lub wychowawce.
                        </Text>
                        <TouchableOpacity
                            onPress={closeExcuseModal}
                            style={[styles.closeButton, { backgroundColor: palette.primary }]}
                            accessibilityRole="button"
                            accessibilityLabel="Rozumiem, zamknij"
                        >
                            <Text style={[T.meta, { color: palette.onPrimary }]}>
                                Rozumiem
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ── Details modal ── */}
            <Modal
                visible={showDetailsModal}
                transparent
                animationType="fade"
                onRequestClose={closeDetailsModal}
            >
                <View style={[styles.modalScrim, { backgroundColor: palette.scrim }]}>
                    <View
                        style={[
                            styles.modalCard,
                            { backgroundColor: palette.surface },
                            floatingShadow(theme),
                        ]}
                    >
                        {selectedEntry ? (
                            <>
                                <View style={styles.modalHeader}>
                                    <View
                                        style={[
                                            styles.modalIcon,
                                            { backgroundColor: modalTone.soft },
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                T.headline,
                                                {
                                                    color: modalTone.text,
                                                    fontSize: 24,
                                                    lineHeight: 28,
                                                },
                                            ]}
                                        >
                                            {getStatusInitial(selectedEntry.status)}
                                        </Text>
                                    </View>

                                    <View style={styles.modalTitleBlock}>
                                        <Text
                                            style={[
                                                T.eyebrow,
                                                { color: palette.textSoft, marginBottom: S[1] },
                                            ]}
                                        >
                                            Attendance Detail
                                        </Text>
                                        <Text
                                            style={[
                                                T.headline,
                                                { color: palette.text, fontSize: 26, lineHeight: 30 },
                                            ]}
                                        >
                                            {selectedEntry.status}
                                        </Text>
                                        <Text
                                            style={[
                                                T.body,
                                                { color: palette.textMuted, marginTop: S[1] + 2 },
                                            ]}
                                        >
                                            {formatAttendanceDate(
                                                selectedRecord?.data ?? selectedEntry.date
                                            )}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.detailStack}>
                                    <DetailRow
                                        label="Przedmiot"
                                        value={
                                            selectedRecord?.przedmiot ??
                                            selectedEntry.subject ??
                                            "Brak danych"
                                        }
                                        palette={palette}
                                    />
                                    <DetailRow
                                        label="Status"
                                        value={selectedEntry.status}
                                        palette={palette}
                                    />
                                    <DetailRow
                                        label="Nauczyciel"
                                        value={selectedRecord?.nauczyciel ?? "Brak danych"}
                                        palette={palette}
                                    />
                                    <DetailRow
                                        label="Godzina lekcyjna"
                                        value={
                                            selectedRecord?.godzina_lekcyjna_id
                                                ? `Lekcja #${selectedRecord.godzina_lekcyjna_id}`
                                                : "Brak danych"
                                        }
                                        palette={palette}
                                    />
                                </View>

                                <TouchableOpacity
                                    onPress={closeDetailsModal}
                                    style={[styles.closeButton, { backgroundColor: palette.primary }]}
                                    activeOpacity={0.9}
                                    accessibilityRole="button"
                                    accessibilityLabel="Zamknij szczegóły"
                                >
                                    <Text style={[T.meta, { color: palette.onPrimary }]}>
                                        Zamknij
                                    </Text>
                                </TouchableOpacity>
                            </>
                        ) : null}
                    </View>
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    loadingCenter: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    scrollContent: {
        paddingBottom: 144,
    },
    compactStats: {
        alignItems: "center",
    },
    page: {
        paddingHorizontal: S[4],
        paddingTop: S[1] + 2,
    },
    section: {
        marginTop: 30,
    },
    emptyWrap: {
        marginTop: S[4],
    },
    listWrap: {
        paddingBottom: S[2],
    },

    // Hero card
    heroSection: {
        marginTop: S[2],
    },
    heroCard: {
        overflow: "hidden",
        padding: 22,
        minHeight: 336,
    },
    heroTopRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: S[6],
    },
    heroBadge: {
        paddingHorizontal: S[3],
        paddingVertical: S[2],
        borderRadius: R.full,
        backgroundColor: "rgba(255,255,255,0.12)",
    },
    heroBadgeLeft: {
        alignSelf: "flex-start",
    },
    heroActionButton: {
        alignSelf: "flex-start",
        minHeight: 44,
        borderRadius: R.full,
        justifyContent: "center",
        paddingHorizontal: S[4],
        marginTop: S[4],
    },
    heroStatsGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        marginTop: 22,
        rowGap: 10,
    },
    heroStatCard: {
        width: "48.4%",
        borderRadius: 18,
        paddingHorizontal: 14,
        paddingVertical: 14,
    },

    // Entry row
    entryCardInner: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 18,
        paddingVertical: 18,
    },
    entryInitial: {
        width: 52,
        height: 52,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 14,
    },
    entryMeta: {
        flex: 1,
        paddingRight: S[3],
    },
    entryTrailing: {
        alignItems: "flex-end",
    },
    statusChip: {
        paddingHorizontal: S[3],
        paddingVertical: S[2],
        borderRadius: R.full,
    },

    // Critical horizontal card
    criticalScroll: {
        paddingRight: S[2],
    },
    criticalCard: {
        width: 188,
        paddingHorizontal: S[4],
        paddingVertical: S[4],
    },

    // Subject summary row
    subjectRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 18,
        paddingVertical: 18,
    },
    subjectLeft: {
        flex: 1,
        paddingRight: S[3],
    },
    subjectRight: {
        alignItems: "flex-end",
    },
    progressTrack: {
        height: 8,
        borderRadius: R.full,
        overflow: "hidden",
        marginTop: S[3],
    },
    progressFill: {
        height: 8,
        borderRadius: R.full,
    },

    // Modals
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
    },
    modalIcon: {
        width: 72,
        height: 72,
        borderRadius: 24,
        alignItems: "center",
        justifyContent: "center",
        marginRight: S[4],
    },
    modalTitleBlock: {
        flex: 1,
    },
    detailStack: {
        marginTop: 22,
        gap: 10,
    },
    detailRow: {
        borderRadius: 18,
        paddingHorizontal: S[4],
        paddingVertical: 14,
    },
    detailValue: {
        marginTop: S[1] + 2,
    },
    closeButton: {
        marginTop: S[6],
        borderRadius: R.full,
        minHeight: 52,
        alignItems: "center",
        justifyContent: "center",
    },
});
