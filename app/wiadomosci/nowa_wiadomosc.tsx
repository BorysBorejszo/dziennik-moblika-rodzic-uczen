import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import * as React from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import SafeView from "../components/SafeView";
import { createMessage } from "../api/messages";
import { findDjangoUserIdByUsername } from "../api/users";
import { useUser } from "../context/UserContext";
import { R, S, T, cardShadow, getEditorialPalette } from "../theme/editorial";
import { useTheme } from "../theme/ThemeContext";

export default function NowaWiadomosc() {
    const { user } = useUser();
    const { recipient, subject: subjectParam } = useLocalSearchParams<{
        recipient?: string;
        subject?: string;
    }>();
    const [recipientUsername, setRecipientUsername] = React.useState(recipient ?? "");
    const [subject, setSubject] = React.useState(subjectParam ?? "");
    const [body, setBody] = React.useState("");
    const [sending, setSending] = React.useState(false);
    const { theme } = useTheme();
    const palette = getEditorialPalette(theme);

    async function onSend() {
        if (!recipientUsername.trim()) {
            Alert.alert("Brak odbiorcy", "Proszę podać nazwę użytkownika odbiorcy.");
            return;
        }

        if (!subject.trim()) {
            Alert.alert("Brak tematu", "Proszę podać temat wiadomości.");
            return;
        }

        if (!body.trim()) {
            Alert.alert("Brak treści", "Proszę wpisać treść wiadomości.");
            return;
        }

        if (!user) {
            Alert.alert("Błąd", "Nie jesteś zalogowany.");
            return;
        }

        setSending(true);
        try {
            const senderUsername = user.username;

            if (!senderUsername) {
                Alert.alert(
                    "Błąd",
                    "Nie można wysłać wiadomości - brak danych użytkownika. Spróbuj wylogować się i zalogować ponownie."
                );
                setSending(false);
                return;
            }

            if (__DEV__) console.log("[NowaWiadomosc] Current sender username:", senderUsername);

            const senderDjangoId = await findDjangoUserIdByUsername(senderUsername);

            if (!senderDjangoId) {
                Alert.alert(
                    "Błąd",
                    `Nie można wysłać wiadomości - nie znaleziono Twojego konta (${senderUsername}) w systemie wiadomości.\n\nWyślij lub odbierz przynajmniej jedną wiadomość przez panel administratora aby aktywować konto.`
                );
                setSending(false);
                return;
            }

            if (__DEV__) console.log("[NowaWiadomosc] Sender Django user.id:", senderDjangoId);
            if (__DEV__) console.log("[NowaWiadomosc] Looking for recipient username:", recipientUsername);

            const recipientDjangoId = await findDjangoUserIdByUsername(recipientUsername);

            if (!recipientDjangoId) {
                Alert.alert(
                    "Błąd",
                    `Nie znaleziono użytkownika o nazwie "${recipientUsername}".\n\nUwaga: Możesz wysyłać wiadomości tylko do użytkowników, którzy mają już historię wiadomości w systemie.`
                );
                setSending(false);
                return;
            }

            if (__DEV__) console.log("[NowaWiadomosc] Found recipient Django user.id:", recipientDjangoId);

            const result = await createMessage({
                nadawca_id: senderDjangoId,
                odbiorca_id: recipientDjangoId,
                temat: subject,
                tresc: body,
            });

            if (result) {
                Alert.alert("Wysłano", "Wiadomość została wysłana.");
                router.replace('/(tabs)/messages');
            } else {
                Alert.alert("Błąd", "Nie udało się wysłać wiadomości.");
            }
        } catch (error) {
            console.error("Send message error:", error);
            Alert.alert("Błąd", "Wystąpił błąd podczas wysyłania wiadomości.");
        } finally {
            setSending(false);
        }
    }

    return (
        <SafeView
            edges={["top", "bottom"]}
            style={[styles.root, { backgroundColor: palette.background }]}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.keyboardAvoid}
            >
                <ScrollView
                    stickyHeaderIndices={[0]}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Sticky top bar */}
                    <View style={[styles.topBar, { backgroundColor: palette.background }]}>
                        <TouchableOpacity
                            onPress={() => router.replace('/(tabs)/messages')}
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
                            <Text style={[T.headline, { color: palette.text }]} numberOfLines={1}>
                                Nowa wiadomosc
                            </Text>
                        </View>
                    </View>

                    {/* Form cards */}
                    <View style={styles.form}>
                        {/* Recipient */}
                        <View
                            style={[
                                styles.fieldCard,
                                { backgroundColor: palette.surface },
                                cardShadow(theme),
                            ]}
                        >
                            <Text style={[T.eyebrow, styles.fieldLabel, { color: palette.textSoft }]}>
                                Do:
                            </Text>
                            <TextInput
                                style={[T.body, styles.fieldInput, { color: palette.text }]}
                                placeholder="np. jan.kowalski"
                                placeholderTextColor={palette.textSoft}
                                value={recipientUsername}
                                onChangeText={setRecipientUsername}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                        </View>

                        {/* Subject */}
                        <View
                            style={[
                                styles.fieldCard,
                                { backgroundColor: palette.surface },
                                cardShadow(theme),
                            ]}
                        >
                            <Text style={[T.eyebrow, styles.fieldLabel, { color: palette.textSoft }]}>
                                Temat:
                            </Text>
                            <TextInput
                                style={[T.body, styles.fieldInput, { color: palette.text }]}
                                placeholder="Temat wiadomości"
                                placeholderTextColor={palette.textSoft}
                                value={subject}
                                onChangeText={setSubject}
                            />
                        </View>

                        {/* Body */}
                        <View
                            style={[
                                styles.fieldCard,
                                styles.fieldCardMultiline,
                                { backgroundColor: palette.surface },
                                cardShadow(theme),
                            ]}
                        >
                            <Text style={[T.eyebrow, styles.fieldLabel, { color: palette.textSoft }]}>
                                Tresc:
                            </Text>
                            <TextInput
                                style={[
                                    T.body,
                                    styles.fieldInput,
                                    styles.bodyInput,
                                    { color: palette.text },
                                ]}
                                placeholder="Napisz wiadomość..."
                                placeholderTextColor={palette.textSoft}
                                value={body}
                                onChangeText={setBody}
                                multiline
                                numberOfLines={6}
                                textAlignVertical="top"
                            />
                        </View>
                    </View>
                </ScrollView>

                {/* Send button */}
                <View style={[styles.sendBar, { backgroundColor: palette.background }]}>
                    <TouchableOpacity
                        onPress={onSend}
                        disabled={sending}
                        activeOpacity={0.85}
                        style={[
                            styles.sendBtn,
                            { backgroundColor: palette.primary, opacity: sending ? 0.6 : 1 },
                        ]}
                    >
                        {sending ? (
                            <ActivityIndicator color={palette.onPrimary} />
                        ) : (
                            <>
                                <Ionicons
                                    name="send-outline"
                                    size={18}
                                    color={palette.onPrimary}
                                    style={{ marginRight: S[2] }}
                                />
                                <Text style={[T.labelBold, { color: palette.onPrimary }]}>
                                    Wyslij
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeView>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    keyboardAvoid: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 100,
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

    // Form
    form: {
        paddingHorizontal: S[4],
        gap: S[3],
    },
    fieldCard: {
        borderRadius: 20,
        paddingHorizontal: S[4],
        paddingVertical: S[3],
    },
    fieldCardMultiline: {
        paddingBottom: S[4],
    },
    fieldLabel: {
        marginBottom: S[2],
    },
    fieldInput: {
        padding: 0,
        margin: 0,
    },
    bodyInput: {
        minHeight: 120,
    },

    // Send bar
    sendBar: {
        paddingHorizontal: S[4],
        paddingBottom: S[4],
        paddingTop: S[2],
    },
    sendBtn: {
        height: 56,
        borderRadius: R.full,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
    },
});
