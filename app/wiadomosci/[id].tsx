import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import {
    deleteMessage,
    getMessageById,
    MessageRecord,
    updateMessage,
} from "../api/messages";
import SafeView from "../components/SafeView";
import { R, S, T, cardShadow, getEditorialPalette } from "../theme/editorial";
import { useTheme } from "../theme/ThemeContext";

export default function MessageDetail() {
    const { id, sender: senderParam } = useLocalSearchParams<{
        id: string;
        sender?: string;
    }>();
    const router = useRouter();
    const { theme } = useTheme();
    const palette = getEditorialPalette(theme);

    const [message, setMessage] = React.useState<MessageRecord | null>(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        if (!id) return;
        void (async () => {
            setLoading(true);
            const record = await getMessageById(Number(id));
            if (record) {
                if (!record.przeczytana) {
                    await updateMessage(Number(id), { przeczytana: true });
                    record.przeczytana = true;
                }
                setMessage(record);
            }
            setLoading(false);
        })();
    }, [id]);

    const handleDelete = () => {
        if (!message) return;
        Alert.alert(
            "Usuń wiadomość",
            "Czy na pewno chcesz usunąć tę wiadomość?",
            [
                { text: "Anuluj", style: "cancel" },
                {
                    text: "Usuń",
                    style: "destructive",
                    onPress: async () => {
                        const success = await deleteMessage(message.id);
                        if (success) {
                            router.back();
                        } else {
                            Alert.alert("Błąd", "Nie udało się usunąć wiadomości.");
                        }
                    },
                },
            ]
        );
    };

    const handleReply = () => {
        if (!message) return;
        const senderUsername = message.nadawca_username ?? "";
        const reSubject = `Re: ${message.temat}`;
        router.push(
            `/wiadomosci/nowa_wiadomosc?recipient=${encodeURIComponent(senderUsername)}&subject=${encodeURIComponent(reSubject)}`
        );
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleString("pl-PL", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const senderDisplay =
        senderParam && senderParam !== "undefined"
            ? decodeURIComponent(senderParam)
            : message
              ? message.nadawca_username || `Użytkownik ${message.nadawca_id}`
              : "";

    return (
        <SafeView edges={["top"]} style={[styles.root, { backgroundColor: palette.background }]}>
            <ScrollView
                stickyHeaderIndices={[0]}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Sticky top bar */}
                <View style={[styles.topBar, { backgroundColor: palette.background }]}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={[
                            styles.backBtn,
                            { backgroundColor: palette.surfaceGlass },
                            cardShadow(theme),
                        ]}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="arrow-back" size={22} color={palette.primary} />
                    </TouchableOpacity>

                    <View style={styles.topBarTitle}>
                        <Text
                            style={[T.headline, { color: palette.text }]}
                            numberOfLines={1}
                        >
                            Wiadomosc
                        </Text>
                        {!loading && senderDisplay ? (
                            <Text
                                style={[
                                    T.body,
                                    { color: palette.textMuted, marginTop: 2 },
                                ]}
                                numberOfLines={1}
                            >
                                {senderDisplay}
                            </Text>
                        ) : null}
                    </View>
                </View>

                {/* Message content */}
                {!loading && message ? (
                    <View style={styles.content}>
                        {/* Sender info card */}
                        <View
                            style={[
                                styles.infoCard,
                                { backgroundColor: palette.surface },
                                cardShadow(theme),
                            ]}
                        >
                            <View
                                style={[
                                    styles.avatar,
                                    { backgroundColor: palette.primaryFixed },
                                ]}
                            >
                                <Text
                                    style={[
                                        T.headline,
                                        {
                                            color: palette.infoText,
                                            fontSize: 26,
                                            lineHeight: 30,
                                        },
                                    ]}
                                >
                                    {senderDisplay[0]?.toUpperCase() ?? "?"}
                                </Text>
                            </View>

                            <View style={styles.infoCardBody}>
                                <Text style={[T.meta, { color: palette.textSoft }]}>Od</Text>
                                <Text
                                    style={[T.title, { color: palette.text, marginTop: 2 }]}
                                >
                                    {senderDisplay}
                                </Text>
                                <Text
                                    style={[
                                        T.meta,
                                        { color: palette.textMuted, marginTop: S[1] },
                                    ]}
                                >
                                    {formatDate(message.data_wyslania)}
                                </Text>
                            </View>
                        </View>

                        {/* Subject */}
                        <View style={styles.subjectSection}>
                            <Text style={[T.meta, { color: palette.textSoft }]}>Temat</Text>
                            <Text
                                style={[
                                    T.headline,
                                    {
                                        color: palette.text,
                                        marginTop: S[1],
                                        fontSize: 20,
                                        lineHeight: 26,
                                    },
                                ]}
                            >
                                {message.temat}
                            </Text>
                        </View>

                        {/* Body */}
                        <View
                            style={[
                                styles.bodyCard,
                                { backgroundColor: palette.surfaceLow },
                                cardShadow(theme),
                            ]}
                        >
                            <Text
                                style={[T.body, { color: palette.text, lineHeight: 24 }]}
                            >
                                {message.tresc}
                            </Text>
                        </View>
                    </View>
                ) : null}
            </ScrollView>

            {/* Bottom action bar */}
            {!loading && message ? (
                <View
                    style={[
                        styles.actions,
                        { backgroundColor: palette.background },
                        cardShadow(theme),
                    ]}
                >
                    <TouchableOpacity
                        onPress={handleDelete}
                        style={[styles.btn, { backgroundColor: palette.dangerBg }]}
                    >
                        <Ionicons
                            name="trash-outline"
                            size={18}
                            color={palette.dangerText}
                        />
                        <Text
                            style={[
                                T.meta,
                                { color: palette.dangerText, marginLeft: S[2] },
                            ]}
                        >
                            Usun
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={handleReply}
                        style={[styles.btn, styles.btnPrimary, { backgroundColor: palette.primary }]}
                    >
                        <Ionicons
                            name="arrow-undo-outline"
                            size={18}
                            color={palette.onPrimary}
                        />
                        <Text
                            style={[
                                T.meta,
                                { color: palette.onPrimary, marginLeft: S[2] },
                            ]}
                        >
                            Odpowiedz
                        </Text>
                    </TouchableOpacity>
                </View>
            ) : null}
        </SafeView>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 140,
    },

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
    topBarTitle: {
        flex: 1,
        marginLeft: S[3],
    },

    // Content
    content: {
        paddingHorizontal: S[4],
        paddingTop: S[4],
    },
    infoCard: {
        borderRadius: 20,
        padding: 18,
        flexDirection: "row",
        alignItems: "center",
        gap: S[4],
    },
    avatar: {
        width: 64,
        height: 64,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
    },
    infoCardBody: {
        flex: 1,
    },
    subjectSection: {
        marginTop: S[5],
    },
    bodyCard: {
        borderRadius: 20,
        padding: 18,
        marginTop: S[5],
    },

    // Actions
    actions: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        padding: S[4],
        flexDirection: "row",
        gap: S[3],
    },
    btn: {
        flex: 1,
        height: 54,
        borderRadius: R.full,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
    },
    btnPrimary: {
        flex: 2,
    },
});
