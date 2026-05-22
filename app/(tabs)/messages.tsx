import { useRouter } from "expo-router";
import * as React from "react";
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { getCurrentDjangoUserId, getDjangoIdFromToken } from "../api/auth";
import { convertToDisplayMessage, getInboxMessages, getSentMessages, Message, updateMessage } from "../api/messages";
import { findDjangoUserIdByUsername } from "../api/users";
import { Card, SearchField, SectionHeader, SegmentedControl, StatCard, PrimaryButton, EmptyPlaceholder } from "../components/editorial/MobileBlocks";
import Header from "../components/Header";
import ErrorState from "../components/ErrorState";
import { SkeletonCard } from "../components/ui/SkeletonItem";
import UserGate from "../components/UserGate";
import { useUser } from "../context/UserContext";
import { R, S, T, getEditorialPalette } from "../theme/editorial";
import { useTheme } from "../theme/ThemeContext";

export default function Messages() {
    const { user } = useUser();
    const router = useRouter();
    const { theme } = useTheme();
    const palette = getEditorialPalette(theme);
    const [search, setSearch] = React.useState("");
    const [messages, setMessages] = React.useState<Message[]>([]);
    const [tab, setTab] = React.useState<"inbox" | "sent">("inbox");
    const [readFilter, setReadFilter] = React.useState<"all" | "read" | "unread">("all");
    const [loading, setLoading] = React.useState(true);
    const [refreshing, setRefreshing] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const fetchMessages = React.useCallback(async () => {
        if (!user) return;
        setLoading(true);
        setError(null);

        try {
            let attemptsUserId = Number(user.serverId ?? user.id ?? -1);

            try {
                const tokenId = await getDjangoIdFromToken();
                if (tokenId) {
                    attemptsUserId = Number(tokenId);
                } else {
                    const resolved = await getCurrentDjangoUserId();
                    if (resolved) {
                        attemptsUserId = Number(resolved);
                    }
                }
            } catch (error) {
                console.warn("[messages] resolving Django user id failed", error);
            }

            if ((!attemptsUserId || attemptsUserId <= 0) && user.username) {
                try {
                    const mapped = await findDjangoUserIdByUsername(user.username);
                    if (mapped) attemptsUserId = Number(mapped);
                } catch (error) {
                    console.warn("[messages] username fallback failed", error);
                }
            }

            if (!attemptsUserId || attemptsUserId <= 0) {
                setMessages([]);
                return;
            }

            const items =
                tab === "inbox"
                    ? await getInboxMessages(attemptsUserId)
                    : await getSentMessages(attemptsUserId);

            const displayMessages = items.map((record) =>
                convertToDisplayMessage(record, attemptsUserId)
            );
            setMessages(displayMessages);
        } catch (error) {
            console.error("[messages] Failed to fetch messages:", error);
            setMessages([]);
            setError("Nie udało się pobrać wiadomości. Sprawdź połączenie i spróbuj ponownie.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [tab, user]);

    React.useEffect(() => {
        if (user?.username || user?.id) {
            void fetchMessages();
        }
    }, [fetchMessages, user?.id, user?.username]);

    const filteredMessages = React.useMemo(() => {
        const bySearch = messages.filter(
            (message) =>
                message.sender.toLowerCase().includes(search.toLowerCase()) ||
                message.subject.toLowerCase().includes(search.toLowerCase()) ||
                message.preview.toLowerCase().includes(search.toLowerCase())
        );

        if (tab !== "inbox") return bySearch;
        if (readFilter === "read") return bySearch.filter((message) => !message.unread);
        if (readFilter === "unread") return bySearch.filter((message) => message.unread);
        return bySearch;
    }, [messages, readFilter, search, tab]);

    const unreadCount = React.useMemo(
        () => messages.filter((message) => message.unread).length,
        [messages]
    );

    const openMessage = async (messageId: number) => {
        const message = messages.find((item) => item.id === messageId);
        if (message && message.unread && message.raw) {
            await updateMessage(messageId, { przeczytana: true });
            setMessages((prev) =>
                prev.map((item) =>
                    item.id === messageId ? { ...item, unread: false } : item
                )
            );
        }
        const senderParam = message ? encodeURIComponent(message.sender) : "";
        router.push(`/wiadomosci/${messageId}?sender=${senderParam}`);
    };

    return (
        <UserGate>
            <View style={[styles.root, { backgroundColor: palette.background }]}>
                <Header
                    title="Wiadomosci"
                    subtitle={
                        unreadCount > 0
                            ? `${unreadCount} nieprzeczytanych wiadomosci`
                            : "Skrzynka odbiorcza"
                    }
                />
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                    nestedScrollEnabled
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => {
                                setRefreshing(true);
                                void fetchMessages();
                            }}
                            tintColor={palette.primary}
                        />
                    }
                >

                    <View style={styles.body}>
                        <View style={styles.statRow}>
                            <View style={styles.statCell}>
                                <StatCard
                                    eyebrow="Nieprzeczytane"
                                    value={String(unreadCount).padStart(2, "0")}
                                    caption="Liczba wiadomosci oczekujacych na przeczytanie."
                                    icon="mail-unread-outline"
                                    tone="primary"
                                />
                            </View>
                            <View style={styles.statCell}>
                                <StatCard
                                    eyebrow={tab === "inbox" ? "Skrzynka" : "Wyslane"}
                                    value={String(filteredMessages.length).padStart(2, "0")}
                                    caption="Widok dopasowany do aktywnego filtra i wyszukiwania."
                                    icon="albums-outline"
                                    tone="neutral"
                                />
                            </View>
                        </View>

                        <View style={styles.controlRow}>
                            <SegmentedControl
                                value={tab}
                                onChange={setTab}
                                options={[
                                    { key: "inbox", label: "Odebrane", count: messages.length },
                                    { key: "sent", label: "Wyslane", count: messages.length },
                                ]}
                            />
                        </View>

                        {tab === "inbox" ? (
                            <View style={styles.controlRow}>
                                <SegmentedControl
                                    value={readFilter}
                                    onChange={setReadFilter}
                                    options={[
                                        { key: "all", label: "Wszystkie" },
                                        { key: "unread", label: "Nieodczytane" },
                                        { key: "read", label: "Odczytane" },
                                    ]}
                                />
                            </View>
                        ) : null}

                        <View style={styles.controlRow}>
                            <SearchField
                                value={search}
                                onChangeText={setSearch}
                                placeholder="Szukaj wiadomosci..."
                            />
                        </View>

                        <View style={styles.controlRow}>
                            <PrimaryButton
                                label="Nowa wiadomosc"
                                onPress={() => router.push("/wiadomosci/nowa_wiadomosc")}
                                icon="create-outline"
                                tone="primary"
                            />
                        </View>

                        <View style={styles.listSection}>
                            <SectionHeader
                                eyebrow="Skrzynka"
                                title={tab === "inbox" ? "Odebrane" : "Wyslane"}
                                meta={String(filteredMessages.length)}
                            />

                            {loading ? (
                                <View style={styles.skeletonList}>
                                    <SkeletonCard />
                                    <SkeletonCard />
                                    <SkeletonCard />
                                </View>
                            ) : error ? (
                                <ErrorState message={error} onRetry={() => void fetchMessages()} />
                            ) : filteredMessages.length === 0 ? (
                                <EmptyPlaceholder
                                    title={
                                        search
                                            ? "Brak wynikow"
                                            : tab === "inbox"
                                              ? "Brak odebranych wiadomosci"
                                              : "Brak wyslanych wiadomosci"
                                    }
                                    subtitle="Nowe rozmowy pojawia sie tutaj po synchronizacji."
                                    icon="mail-outline"
                                />
                            ) : (
                                <FlatList
                                    data={filteredMessages}
                                    keyExtractor={(item) => String(item.id)}
                                    scrollEnabled={false}
                                    ItemSeparatorComponent={() => <View style={styles.separator} />}
                                    renderItem={({ item: message }) => (
                                        <TouchableOpacity
                                            onPress={() => void openMessage(message.id)}
                                            activeOpacity={0.88}
                                            accessibilityRole="button"
                                            accessibilityLabel={`Wiadomosc od ${message.sender}: ${message.subject}`}
                                        >
                                            <Card>
                                                <View style={styles.messageCard}>
                                                    <View
                                                        style={[
                                                            styles.avatarWrap,
                                                            {
                                                                backgroundColor: message.unread
                                                                    ? palette.primaryFixed
                                                                    : palette.surfaceMid,
                                                            },
                                                        ]}
                                                    >
                                                        <Text
                                                            style={[
                                                                T.title,
                                                                {
                                                                    color: message.unread
                                                                        ? palette.infoText
                                                                        : palette.textMuted,
                                                                },
                                                            ]}
                                                        >
                                                            {message.avatar}
                                                        </Text>
                                                    </View>

                                                    <View style={styles.messageBody}>
                                                        <Text
                                                            style={[T.bodyMedium, { color: palette.text }]}
                                                            numberOfLines={1}
                                                        >
                                                            {message.sender}
                                                        </Text>
                                                        <Text
                                                            style={[T.label, { color: palette.textMuted, marginTop: 2 }]}
                                                            numberOfLines={1}
                                                        >
                                                            {message.subject}
                                                        </Text>
                                                        <Text
                                                            style={[T.label, { color: palette.textSoft, marginTop: 6 }]}
                                                            numberOfLines={2}
                                                        >
                                                            {message.preview}
                                                        </Text>
                                                    </View>

                                                    <View style={styles.messageMeta}>
                                                        <Text style={[T.meta, { color: palette.textSoft }]}>
                                                            {message.time}
                                                        </Text>
                                                        <View
                                                            style={[
                                                                styles.statusPill,
                                                                {
                                                                    backgroundColor: message.unread
                                                                        ? palette.primaryFixed
                                                                        : palette.surfaceMid,
                                                                    marginTop: S[2],
                                                                },
                                                            ]}
                                                        >
                                                            <Text
                                                                style={[
                                                                    T.meta,
                                                                    {
                                                                        color: message.unread
                                                                            ? palette.infoText
                                                                            : palette.textSoft,
                                                                    },
                                                                ]}
                                                            >
                                                                {message.unread ? "Nowa" : "Odczytana"}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                </View>
                                            </Card>
                                        </TouchableOpacity>
                                    )}
                                />
                            )}
                        </View>
                    </View>
                </ScrollView>
            </View>
        </UserGate>
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
    controlRow: {
        marginTop: S[3],
    },
    listSection: {
        marginTop: S[6],
    },
    skeletonList: {
        gap: S[3],
    },
    separator: {
        height: S[3],
    },
    messageCard: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: S[4],
        paddingVertical: S[4],
    },
    avatarWrap: {
        width: 52,
        height: 52,
        borderRadius: R.lg,
        alignItems: "center",
        justifyContent: "center",
        marginRight: S[3],
        flexShrink: 0,
    },
    messageBody: {
        flex: 1,
        paddingRight: S[3],
    },
    messageMeta: {
        alignItems: "flex-end",
    },
    statusPill: {
        borderRadius: R.full,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
});
