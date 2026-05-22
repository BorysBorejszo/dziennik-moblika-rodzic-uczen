import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import ErrorState from "../components/ErrorState";
import { getCurrentDjangoUserId, getDjangoIdFromToken } from "../api/auth";
import { getUserHomeData, TodayLesson, UpdateItem } from "../api/home";
import {
    EmptyPlaceholder,
    RowCard,
    SectionHeader,
    StatCard,
} from "../components/editorial/MobileBlocks";
import Header from "../components/Header";
import { useUser } from "../context/UserContext";
import { S, T, getEditorialPalette } from "../theme/editorial";
import { useTheme } from "../theme/ThemeContext";

function getUpdateTone(type: UpdateItem["type"]) {
    if (type === "grade") return { icon: "school-outline" as const, tone: "success" as const, badge: "Ocena" };
    if (type === "message") return { icon: "mail-outline" as const, tone: "primary" as const, badge: "Wiadomosc" };
    return { icon: "megaphone-outline" as const, tone: "warning" as const, badge: "Ogloszenie" };
}

export default function Home() {
    const { user } = useUser();
    const { theme } = useTheme();
    const router = useRouter();
    const palette = getEditorialPalette(theme);
    const rawName = user?.name?.toString() ?? "";
    const firstToken = rawName.split(/[_\s]+/)[0] ?? "";
    const firstName = firstToken
        ? firstToken.charAt(0).toUpperCase() + firstToken.slice(1).toLowerCase()
        : "Uzytkownik";
    const [todayLessons, setTodayLessons] = useState<TodayLesson[]>([]);
    const [recentUpdates, setRecentUpdates] = useState<UpdateItem[]>([]);
    const [gradeAverage, setGradeAverage] = useState<string>("—");
    const [unreadCount, setUnreadCount] = useState(0);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

    const formattedDate = useMemo(
        () =>
            new Date().toLocaleDateString("pl-PL", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
            }),
        []
    );

    useEffect(() => {
        void loadDashboard();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, user?.serverId, reloadKey]);

    async function resolveMessageUserId() {
        let attemptsUserId = Number(user?.serverId ?? user?.id ?? -1);
        try {
            const tokenId = await getDjangoIdFromToken();
            if (tokenId) {
                attemptsUserId = Number(tokenId);
            } else {
                const resolved = await getCurrentDjangoUserId();
                if (resolved) attemptsUserId = Number(resolved);
            }
        } catch (error) {
            console.warn("[home] resolving message user id failed", error);
        }
        return attemptsUserId > 0 ? attemptsUserId : null;
    }

    async function loadDashboard() {
        const idToUse = user?.serverId ?? user?.id;
        if (!user || typeof idToUse !== "number" || idToUse <= 0) {
            setTodayLessons([]);
            setRecentUpdates([]);
            setGradeAverage("—");
            setUnreadCount(0);
            setLoading(false);
            setRefreshing(false);
            return;
        }
        setLoading(true);
        setFetchError(null);
        try {
            const messageUserId = await resolveMessageUserId();
            const homeData = await getUserHomeData({
                studentId: idToUse,
                messageUserId,
                classId: user.classId ?? null,
            });
            setTodayLessons(homeData.todayLessons);
            setRecentUpdates(homeData.recentUpdates);
            setGradeAverage(homeData.gradeAverage ?? "—");
            setUnreadCount(homeData.unreadMessageCount);
        } catch (error) {
            console.error("[home] Failed to load dashboard", error);
            setTodayLessons([]);
            setRecentUpdates([]);
            setGradeAverage("—");
            setUnreadCount(0);
            setFetchError((error instanceof Error ? error.message : null) ?? 'Błąd ładowania danych');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }

    const nextLesson = todayLessons[0] ?? null;

    if (fetchError && !loading) {
        return (
            <View style={[styles.root, { backgroundColor: palette.background }]}>
                <Header title={`Dzien dobry, ${firstName}`} subtitle={formattedDate} />
                <ErrorState message={fetchError} onRetry={() => setReloadKey(k => k + 1)} />
            </View>
        );
    }

    return (
        <View style={[styles.root, { backgroundColor: palette.background }]}>
            <Header
                title={`Dzien dobry, ${firstName}`}
                subtitle={formattedDate}
            />
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => {
                            setRefreshing(true);
                            void loadDashboard();
                        }}
                        tintColor={palette.primary}
                    />
                }
            >

            <View style={styles.body}>
                <View style={styles.statRow}>
                    <View style={styles.statCell}>
                        <StatCard
                            eyebrow="Srednia ocen"
                            value={gradeAverage}
                            caption="Biezacy podglad ocen z aktywnych przedmiotow."
                            icon="trending-up-outline"
                            tone="primary"
                            onPress={() => router.push("/grades")}
                        />
                    </View>
                    <View style={styles.statCell}>
                        <StatCard
                            eyebrow="Wiadomosci"
                            value={String(unreadCount).padStart(2, "0")}
                            caption={
                                unreadCount > 0
                                    ? `${unreadCount} nieprzeczytanych w skrzynce.`
                                    : "Skrzynka odbiorcza jest na czysto."
                            }
                            icon="mail-unread-outline"
                            tone="warning"
                            onPress={() => router.push("/messages")}
                        />
                    </View>
                </View>

                <View style={styles.section}>
                    <SectionHeader
                        eyebrow="Na dzis"
                        title="Plan dnia"
                        onPress={() => router.push("/schedule")}
                    />
                    {nextLesson ? (
                        <View style={styles.cardList}>
                            <RowCard
                                title={nextLesson.subject}
                                subtitle={`Sala ${nextLesson.room}`}
                                meta={nextLesson.time}
                                badge={nextLesson.inProgress ? "Trwa teraz" : "Nastepna lekcja"}
                                icon="time-outline"
                                tone="primary"
                                onPress={() => router.push("/schedule")}
                            />
                            {todayLessons.slice(1).map((lesson) => (
                                <RowCard
                                    key={lesson.id}
                                    title={lesson.subject}
                                    subtitle={`Sala ${lesson.room}`}
                                    meta={lesson.time}
                                    icon="calendar-outline"
                                    tone="neutral"
                                    onPress={() => router.push("/schedule")}
                                />
                            ))}
                        </View>
                    ) : (
                        <EmptyPlaceholder
                            title="Brak lekcji na dzis"
                            subtitle="Gdy plan dnia bedzie dostepny, zobaczysz go tutaj."
                            icon="calendar-outline"
                        />
                    )}
                </View>

                <View style={styles.section}>
                    <SectionHeader
                        eyebrow="Na zywo"
                        title="Aktywnosc"
                        onPress={() => router.push("/messages")}
                    />
                    {recentUpdates.length > 0 ? (
                        <View style={styles.cardList}>
                            {recentUpdates.map((update) => {
                                const tone = getUpdateTone(update.type);
                                return (
                                    <RowCard
                                        key={update.id}
                                        title={update.title}
                                        subtitle={update.desc}
                                        meta={update.time}
                                        badge={tone.badge}
                                        icon={tone.icon}
                                        tone={tone.tone}
                                        onPress={() => {
                                            if (update.type === "message") {
                                                router.push("/messages");
                                            } else if (update.type === "grade") {
                                                router.push("/grades");
                                            } else {
                                                router.push("/attendance");
                                            }
                                        }}
                                    />
                                );
                            })}
                        </View>
                    ) : (
                        <EmptyPlaceholder
                            title="Brak nowych aktualizacji"
                            subtitle="Nowe wpisy z ocen, wiadomosci i ogloszen pojawia sie tutaj."
                            icon="notifications-outline"
                        />
                    )}
                </View>

                {loading ? (
                    <View style={styles.loadingRow}>
                        <Text style={[T.label, { color: palette.textSoft, textAlign: "center" }]}>
                            Odswiezam pulpit...
                        </Text>
                    </View>
                ) : null}
            </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    content: {
        paddingBottom: 120,
    },
    body: {
        paddingHorizontal: S[4],
        paddingTop: S[2],
    },
    statRow: {
        flexDirection: "row",
        gap: S[3],
    },
    statCell: {
        flex: 1,
    },
    section: {
        marginTop: 30,
    },
    cardList: {
        gap: S[3],
    },
    loadingRow: {
        marginTop: 28,
    },
});
