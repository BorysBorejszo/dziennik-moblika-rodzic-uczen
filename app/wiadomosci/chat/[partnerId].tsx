import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { createMessage, getInboxMessages, getSentMessages, MessageRecord } from "../../api/messages";
import { useUser } from "../../context/UserContext";
import { R, S, T, cardShadow, getEditorialPalette } from "../../theme/editorial";
import { useTheme } from "../../theme/ThemeContext";
import { useConversationSocket } from "../../hooks/useConversationSocket";

function formatBubbleTime(dateStr: string): string {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
}

export default function ChatScreen() {
    const { partnerId, name } = useLocalSearchParams<{ partnerId: string; name?: string }>();
    const { user } = useUser();
    const router = useRouter();
    const { theme } = useTheme();
    const palette = getEditorialPalette(theme);

    const myId = user ? Number((user as any).serverId ?? user.id) : 0;
    const partnerIdNum = Number(partnerId);
    const partnerName = name ?? "Rozmowa";

    const [messages, setMessages] = React.useState<MessageRecord[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [text, setText] = React.useState("");
    const [sending, setSending] = React.useState(false);
    const flatListRef = React.useRef<FlatList<MessageRecord>>(null);

    const { lastMessage, sendMessage, connected } = useConversationSocket(
        myId > 0 ? myId : null,
        partnerIdNum > 0 ? partnerIdNum : null
    );

    // Load initial messages
    React.useEffect(() => {
        if (!myId || !partnerIdNum) return;
        setLoading(true);
        Promise.all([getInboxMessages(myId), getSentMessages(myId)])
            .then(([inbox, sent]) => {
                const seen = new Set<number>();
                const combined: MessageRecord[] = [];
                for (const m of [...inbox, ...sent]) {
                    if (seen.has(m.id)) continue;
                    seen.add(m.id);
                    if (m.nadawca_id === partnerIdNum || m.odbiorca_id === partnerIdNum) {
                        combined.push(m);
                    }
                }
                combined.sort(
                    (a, b) =>
                        new Date(a.data_wyslania).getTime() - new Date(b.data_wyslania).getTime()
                );
                setMessages(combined);
            })
            .catch((err) => {
                console.error("[chat] Failed to load messages", err);
            })
            .finally(() => setLoading(false));
    }, [myId, partnerIdNum]);

    // Append incoming WS messages
    React.useEffect(() => {
        if (!lastMessage) return;
        const wsMsg: MessageRecord = {
            id: Date.now(),
            nadawca_id: lastMessage.sender_id,
            odbiorca_id: myId,
            temat: "Chat",
            tresc: lastMessage.message,
            data_wyslania: lastMessage.timestamp ?? new Date().toISOString(),
            przeczytana: false,
        };
        setMessages((prev) => {
            // Avoid duplicate if WS echoes back own message
            if (wsMsg.nadawca_id === myId) return prev;
            return [...prev, wsMsg];
        });
    }, [lastMessage, myId]);

    const handleSend = async () => {
        const trimmed = text.trim();
        if (!trimmed || !myId || !partnerIdNum) return;
        setSending(true);
        setText("");
        const optimistic: MessageRecord = {
            id: Date.now(),
            nadawca_id: myId,
            odbiorca_id: partnerIdNum,
            temat: "Chat",
            tresc: trimmed,
            data_wyslania: new Date().toISOString(),
            przeczytana: false,
        };
        setMessages((prev) => [...prev, optimistic]);
        try {
            const created = await createMessage({
                nadawca_id: myId,
                odbiorca_id: partnerIdNum,
                temat: "Chat",
                tresc: trimmed,
            });
            if (created) {
                // Replace optimistic entry with server record
                setMessages((prev) =>
                    prev.map((m) => (m.id === optimistic.id ? created : m))
                );
            }
            sendMessage(trimmed);
        } catch (err) {
            console.error("[chat] Send failed", err);
        } finally {
            setSending(false);
        }
    };

    return (
        <View style={[styles.root, { backgroundColor: palette.background }]}>
            {/* Top bar */}
            <View style={[styles.topBar, { backgroundColor: palette.surface, ...cardShadow(theme) }]}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={[styles.backBtn, { backgroundColor: palette.surfaceMid }]}
                    accessibilityLabel="Wróć"
                >
                    <Ionicons name="arrow-back" size={22} color={palette.primary} />
                </TouchableOpacity>
                <View style={styles.topBarTitle}>
                    <Text style={[T.bodyMedium, { color: palette.text }]} numberOfLines={1}>
                        {partnerName}
                    </Text>
                    <View style={styles.wsIndicatorRow}>
                        <View
                            style={[
                                styles.wsDot,
                                { backgroundColor: connected ? palette.success : palette.textSoft },
                            ]}
                        />
                        <Text style={[T.meta, { color: palette.textSoft, marginLeft: 4 }]}>
                            {connected ? "Połączono" : "Offline"}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Messages */}
            {loading ? (
                <View style={styles.loadingWrap}>
                    <ActivityIndicator size="large" color={palette.primary} />
                </View>
            ) : (
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    keyExtractor={(item, idx) => `${item.id}-${idx}`}
                    inverted
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={styles.listContent}
                    renderItem={({ item }) => {
                        const isOwn = item.nadawca_id === myId;
                        return (
                            <View
                                style={[
                                    styles.bubbleRow,
                                    isOwn ? styles.bubbleRowOwn : styles.bubbleRowPartner,
                                ]}
                            >
                                <View
                                    style={[
                                        styles.bubble,
                                        {
                                            backgroundColor: isOwn
                                                ? palette.primary
                                                : palette.surface,
                                            borderRadius: R.lg,
                                        },
                                        !isOwn && (cardShadow(theme) as object),
                                    ]}
                                >
                                    <Text
                                        style={[
                                            T.body,
                                            { color: isOwn ? palette.onPrimary : palette.text },
                                        ]}
                                    >
                                        {item.tresc}
                                    </Text>
                                    <Text
                                        style={[
                                            T.meta,
                                            {
                                                color: isOwn
                                                    ? "rgba(255,255,255,0.6)"
                                                    : palette.textSoft,
                                                marginTop: 4,
                                                alignSelf: "flex-end",
                                            },
                                        ]}
                                    >
                                        {formatBubbleTime(item.data_wyslania)}
                                    </Text>
                                </View>
                            </View>
                        );
                    }}
                />
            )}

            {/* Input bar */}
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={0}
            >
                <View
                    style={[
                        styles.inputBar,
                        {
                            backgroundColor: palette.surface,
                            borderTopColor: palette.outlineVariant,
                        },
                    ]}
                >
                    <TextInput
                        style={[
                            styles.textInput,
                            {
                                backgroundColor: palette.surfaceLow,
                                color: palette.text,
                                borderColor: palette.outlineVariant,
                                borderRadius: R.lg,
                            },
                        ]}
                        value={text}
                        onChangeText={setText}
                        placeholder="Napisz wiadomość..."
                        placeholderTextColor={palette.textSoft}
                        multiline
                        maxLength={2000}
                        returnKeyType="default"
                    />
                    <TouchableOpacity
                        onPress={() => void handleSend()}
                        disabled={!text.trim() || sending}
                        style={[
                            styles.sendBtn,
                            {
                                backgroundColor:
                                    text.trim() && !sending ? palette.primary : palette.surfaceMid,
                            },
                        ]}
                        accessibilityLabel="Wyślij"
                    >
                        {sending ? (
                            <ActivityIndicator size="small" color={palette.onPrimary} />
                        ) : (
                            <Ionicons
                                name="send"
                                size={20}
                                color={text.trim() ? palette.onPrimary : palette.textMuted}
                            />
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    topBar: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: S[4],
        paddingTop: S[3],
        paddingBottom: S[3],
        gap: S[3],
        zIndex: 10,
    },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: R.full,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },
    topBarTitle: {
        flex: 1,
    },
    wsIndicatorRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 2,
    },
    wsDot: {
        width: 8,
        height: 8,
        borderRadius: R.full,
    },
    loadingWrap: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    listContent: {
        paddingHorizontal: S[4],
        paddingVertical: S[3],
    },
    bubbleRow: {
        marginVertical: S[1],
        flexDirection: "row",
    },
    bubbleRowOwn: {
        justifyContent: "flex-end",
    },
    bubbleRowPartner: {
        justifyContent: "flex-start",
    },
    bubble: {
        maxWidth: "75%",
        padding: S[3],
    },
    inputBar: {
        flexDirection: "row",
        alignItems: "flex-end",
        paddingHorizontal: S[4],
        paddingVertical: S[3],
        borderTopWidth: 1,
        gap: S[2],
    },
    textInput: {
        flex: 1,
        minHeight: 44,
        maxHeight: 120,
        paddingHorizontal: S[3],
        paddingVertical: S[2],
        borderWidth: 1,
        fontSize: 15,
        lineHeight: 22,
    },
    sendBtn: {
        width: 44,
        height: 44,
        borderRadius: R.full,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },
});
