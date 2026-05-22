import { useRouter } from "expo-router";
import * as React from "react";
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { getCurrentDjangoUserId, getDjangoIdFromToken } from "../api/auth";
import { getAllMessages, getInboxMessages, getSentMessages, MessageRecord } from "../api/messages";
import { findDjangoUserIdByUsername } from "../api/users";
import { Card, SearchField, SectionHeader, PrimaryButton, EmptyPlaceholder } from "../components/editorial/MobileBlocks";
import Header from "../components/Header";
import ErrorState from "../components/ErrorState";
import { SkeletonCard } from "../components/ui/SkeletonItem";
import UserGate from "../components/UserGate";
import { useUser } from "../context/UserContext";
import { R, S, T, getEditorialPalette } from "../theme/editorial";
import { useTheme } from "../theme/ThemeContext";

type ConversationItem = {
    partnerId: number;
    partnerName: string;
    lastMessage: MessageRecord;
    unreadCount: number;
    isLastFromMe: boolean;
};

function groupByConversation(messages: MessageRecord[], myId: number): ConversationItem[] {
    const map = new Map<number, ConversationItem>();
    for (const msg of messages) {
        const isFromMe = msg.nadawca_id === myId;
        const partnerId = isFromMe ? msg.odbiorca_id : msg.nadawca_id;
        const partnerName = isFromMe
            ? (msg.odbiorca_username ?? `Użytkownik ${partnerId}`)
            : (msg.nadawca_username ?? `Użytkownik ${partnerId}`);
        const existing = map.get(partnerId);
        const isNewer = !existing || new Date(msg.data_wyslania) > new Date(existing.lastMessage.data_wyslania);
        if (!existing) {
            map.set(partnerId, { partnerId, partnerName, lastMessage: msg, unreadCount: (!isFromMe && !msg.przeczytana) ? 1 : 0, isLastFromMe: isFromMe });
        } else {
            if (isNewer) { existing.lastMessage = msg; existing.isLastFromMe = isFromMe; }
            if (!isFromMe && !msg.przeczytana) existing.unreadCount += 1;
        }
    }
    return Array.from(map.values()).sort(
        (a, b) => new Date(b.lastMessage.data_wyslania).getTime() - new Date(a.lastMessage.data_wyslania).getTime()
    );
}

function formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) {
        return date.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
    } else if (diffDays === 1) {
        return "Wczoraj";
    } else if (diffDays < 7) {
        return `${diffDays} dni temu`;
    } else {
        return date.toLocaleDateString("pl-PL");
    }
}

export default function Messages() {
    const { user } = useUser();
    const router = useRouter();
    const { theme } = useTheme();
    const palette = getEditorialPalette(theme);
    const [search, setSearch] = React.useState("");
    const [showAll, setShowAll] = React.useState(false);
    const [conversations, setConversations] = React.useState<ConversationItem[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [refreshing, setRefreshing] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [myId, setMyId] = React.useState<number>(0);

    const fetchConversations = React.useCallback(async () => {
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
            } catch (err) {
                console.warn("[messages] resolving Django user id failed", err);
            }

            if ((!attemptsUserId || attemptsUserId <= 0) && user.username) {
                try {
                    const mapped = await findDjangoUserIdByUsername(user.username);
                    if (mapped) attemptsUserId = Number(mapped);
                } catch (err) {
                    console.warn("[messages] username fallback failed", err);
                }
            }

            if (!attemptsUserId || attemptsUserId <= 0) {
                setConversations([]);
                return;
            }

            setMyId(attemptsUserId);

            let allMessages: MessageRecord[] = [];
            try {
                allMessages = await getAllMessages();
                // If getAllMessages returns empty, fall back to inbox+sent
                if (!allMessages || allMessages.length === 0) {
                    const [inbox, sent] = await Promise.all([
                        getInboxMessages(attemptsUserId),
                        getSentMessages(attemptsUserId),
                    ]);
                    const seen = new Set<number>();
                    for (const m of [...inbox, ...sent]) {
                        if (!seen.has(m.id)) { seen.add(m.id); allMessages.push(m); }
                    }
                }
            } catch {
                const [inbox, sent] = await Promise.all([
                    getInboxMessages(attemptsUserId),
                    getSentMessages(attemptsUserId),
                ]);
                const seen = new Set<number>();
                for (const m of [...inbox, ...sent]) {
                    if (!seen.has(m.id)) { seen.add(m.id); allMessages.push(m); }
                }
            }

            const grouped = groupByConversation(allMessages, attemptsUserId);
            setConversations(grouped);
        } catch (err) {
            console.error("[messages] Failed to fetch conversations:", err);
            setConversations([]);
            setError("Nie udało się pobrać wiadomości. Sprawdź połączenie i spróbuj ponownie.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user]);

    React.useEffect(() => {
        if (user?.username || user?.id) {
            void fetchConversations();
        }
    }, [fetchConversations, user?.id, user?.username]);

    const filteredConversations = React.useMemo(() => {
        const base = showAll ? conversations : conversations.filter((c) => c.unreadCount > 0);
        if (!search) return base;
        const q = search.toLowerCase();
        return base.filter(
            (c) =>
                c.partnerName.toLowerCase().includes(q) ||
                c.lastMessage.tresc.toLowerCase().includes(q) ||
                c.lastMessage.temat.toLowerCase().includes(q)
        );
    }, [conversations, search, showAll]);

    const totalUnread = React.useMemo(
        () => conversations.reduce((sum, c) => sum + c.unreadCount, 0),
        [conversations]
    );

    return (
        <UserGate>
            <View style={[styles.root, { backgroundColor: palette.background }]}>
                <Header
                    title="Wiadomosci"
                    subtitle={
                        totalUnread > 0
                            ? `${totalUnread} nieprzeczytanych wiadomosci`
                            : "Rozmowy"
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
                                void fetchConversations();
                            }}
                            tintColor={palette.primary}
                        />
                    }
                >
                    <View style={styles.body}>
                        <View style={styles.controlRow}>
                            <SearchField
                                value={search}
                                onChangeText={setSearch}
                                placeholder="Szukaj rozmow..."
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
                                title="Rozmowy"
                                meta={String(filteredConversations.length)}
                            />

                            <TouchableOpacity
                                onPress={() => setShowAll((v) => !v)}
                                style={[styles.toggleBtn, { backgroundColor: showAll ? palette.surfaceMid : palette.primaryFixed }]}
                            >
                                <Text style={[T.label, { color: showAll ? palette.textSoft : palette.primary, fontWeight: "600" }]}>
                                    {showAll ? "Tylko nieprzeczytane" : "Pokaż wszystkie"}
                                </Text>
                            </TouchableOpacity>

                            {loading ? (
                                <View style={styles.skeletonList}>
                                    <SkeletonCard />
                                    <SkeletonCard />
                                    <SkeletonCard />
                                </View>
                            ) : error ? (
                                <ErrorState message={error} onRetry={() => void fetchConversations()} />
                            ) : filteredConversations.length === 0 ? (
                                <EmptyPlaceholder
                                    title={search ? "Brak wynikow" : showAll ? "Brak rozmow" : "Brak nowych wiadomosci"}
                                    subtitle={showAll || search ? "Nowe rozmowy pojawia sie tutaj po synchronizacji." : "Wszystkie wiadomosci zostaly przeczytane."}
                                    icon="chatbubbles-outline"
                                />
                            ) : (
                                <FlatList
                                    data={filteredConversations}
                                    keyExtractor={(item) => String(item.partnerId)}
                                    scrollEnabled={false}
                                    ItemSeparatorComponent={() => <View style={styles.separator} />}
                                    renderItem={({ item }) => {
                                        const avatarLetter = item.partnerName[0]?.toUpperCase() ?? "?";
                                        const hasUnread = item.unreadCount > 0;
                                        return (
                                            <TouchableOpacity
                                                onPress={() =>
                                                    router.push(
                                                        `/wiadomosci/chat/${item.partnerId}?name=${encodeURIComponent(item.partnerName)}`
                                                    )
                                                }
                                                activeOpacity={0.88}
                                                accessibilityRole="button"
                                                accessibilityLabel={`Rozmowa z ${item.partnerName}`}
                                            >
                                                <Card>
                                                    <View style={styles.messageCard}>
                                                        <View
                                                            style={[
                                                                styles.avatarWrap,
                                                                {
                                                                    backgroundColor: hasUnread
                                                                        ? palette.primaryFixed
                                                                        : palette.surfaceMid,
                                                                },
                                                            ]}
                                                        >
                                                            <Text
                                                                style={[
                                                                    T.title,
                                                                    {
                                                                        color: hasUnread
                                                                            ? palette.infoText
                                                                            : palette.textMuted,
                                                                    },
                                                                ]}
                                                            >
                                                                {avatarLetter}
                                                            </Text>
                                                        </View>

                                                        <View style={styles.messageBody}>
                                                            <Text
                                                                style={[T.bodyMedium, { color: palette.text }]}
                                                                numberOfLines={1}
                                                            >
                                                                {item.partnerName}
                                                            </Text>
                                                            <Text
                                                                style={[
                                                                    T.label,
                                                                    {
                                                                        color: hasUnread ? palette.text : palette.textSoft,
                                                                        marginTop: 4,
                                                                        fontWeight: hasUnread ? "600" : "400",
                                                                    },
                                                                ]}
                                                                numberOfLines={2}
                                                            >
                                                                {item.isLastFromMe ? "Ty: " : ""}
                                                                {item.lastMessage.tresc.slice(0, 80)}
                                                            </Text>
                                                        </View>

                                                        <View style={styles.messageMeta}>
                                                            <Text style={[T.meta, { color: palette.textSoft }]}>
                                                                {formatTime(item.lastMessage.data_wyslania)}
                                                            </Text>
                                                            {hasUnread ? (
                                                                <View
                                                                    style={[
                                                                        styles.unreadBadge,
                                                                        { backgroundColor: palette.primary, marginTop: S[2] },
                                                                    ]}
                                                                >
                                                                    <Text style={[T.meta, { color: palette.onPrimary }]}>
                                                                        {item.unreadCount}
                                                                    </Text>
                                                                </View>
                                                            ) : null}
                                                        </View>
                                                    </View>
                                                </Card>
                                            </TouchableOpacity>
                                        );
                                    }}
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
    unreadBadge: {
        borderRadius: R.full,
        minWidth: 22,
        height: 22,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 6,
    },
    toggleBtn: {
        alignSelf: "flex-end",
        borderRadius: R.full,
        paddingHorizontal: S[4],
        paddingVertical: S[2],
        marginBottom: S[3],
    },
});
