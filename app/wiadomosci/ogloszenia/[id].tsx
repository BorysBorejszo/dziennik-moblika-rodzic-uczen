import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { getAnnouncementById, Announcement } from "../../api/announcements";
import SafeView from "../../components/SafeView";
import { R, S, T, cardShadow, getEditorialPalette } from "../../theme/editorial";
import { useTheme } from "../../theme/ThemeContext";

export default function AnnouncementDetail() {
    const { id, tytul: tytulParam, autor: autorParam, data: dataParam } = useLocalSearchParams<{
        id: string;
        tytul?: string;
        autor?: string;
        data?: string;
    }>();
    const router = useRouter();
    const { theme } = useTheme();
    const palette = getEditorialPalette(theme);

    const [announcement, setAnnouncement] = React.useState<Announcement | null>(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        if (!id) return;
        void (async () => {
            setLoading(true);
            const record = await getAnnouncementById(Number(id));
            setAnnouncement(record);
            setLoading(false);
        })();
    }, [id]);

    const autorDisplay = announcement?.autor_name
        ?? (autorParam && autorParam !== "undefined" ? decodeURIComponent(autorParam) : "Dyrekcja");

    const tytulDisplay = announcement?.tytul
        ?? (tytulParam && tytulParam !== "undefined" ? decodeURIComponent(tytulParam) : "Ogłoszenie");

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        return date.toLocaleString("pl-PL", {
            day: "2-digit",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const dateDisplay = announcement?.data_publikacji
        ? formatDate(announcement.data_publikacji)
        : dataParam && dataParam !== "undefined"
            ? formatDate(decodeURIComponent(dataParam))
            : "";

    const zasiegLabel = announcement?.zasieg === "school" ? "Cała szkoła" : announcement?.zasieg === "class" ? "Klasa" : null;

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
                        onPress={() => router.replace("/(tabs)/messages")}
                        style={[styles.backBtn, { backgroundColor: palette.surfaceGlass }, cardShadow(theme)]}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="arrow-back" size={22} color={palette.primary} />
                    </TouchableOpacity>
                    <View style={styles.topBarTitle}>
                        <Text style={[T.headline, { color: palette.text }]} numberOfLines={1}>
                            Ogłoszenie
                        </Text>
                    </View>
                </View>

                {loading ? (
                    <View style={styles.loadingCenter}>
                        <ActivityIndicator size="large" color={palette.primary} />
                    </View>
                ) : (
                    <View style={styles.content}>
                        {/* Author info card */}
                        <View style={[styles.infoCard, { backgroundColor: palette.surface }, cardShadow(theme)]}>
                            <View style={[styles.avatar, { backgroundColor: palette.primaryFixed }]}>
                                <Text style={[T.headline, { color: palette.infoText, fontSize: 26, lineHeight: 30 }]}>
                                    {autorDisplay[0]?.toUpperCase() ?? "O"}
                                </Text>
                            </View>
                            <View style={styles.infoCardBody}>
                                <Text style={[T.meta, { color: palette.textSoft }]}>Autor</Text>
                                <Text style={[T.title, { color: palette.text, marginTop: 2 }]}>
                                    {autorDisplay}
                                </Text>
                                {dateDisplay ? (
                                    <Text style={[T.meta, { color: palette.textMuted, marginTop: S[1] }]}>
                                        {dateDisplay}
                                    </Text>
                                ) : null}
                                {zasiegLabel ? (
                                    <View style={[styles.zasiegBadge, { backgroundColor: palette.primaryFixed }]}>
                                        <Ionicons name="megaphone-outline" size={12} color={palette.infoText} />
                                        <Text style={[T.meta, { color: palette.infoText, marginLeft: 4, fontSize: 11 }]}>
                                            {zasiegLabel}
                                        </Text>
                                    </View>
                                ) : null}
                            </View>
                        </View>

                        {/* Title */}
                        <View style={styles.subjectSection}>
                            <Text style={[T.meta, { color: palette.textSoft }]}>Tytuł</Text>
                            <Text style={[T.headline, { color: palette.text, marginTop: S[1], fontSize: 20, lineHeight: 26 }]}>
                                {tytulDisplay}
                            </Text>
                        </View>

                        {/* Body */}
                        {announcement?.tresc ? (
                            <View style={[styles.bodyCard, { backgroundColor: palette.surfaceLow }, cardShadow(theme)]}>
                                <Text style={[T.body, { color: palette.text, lineHeight: 24 }]}>
                                    {announcement.tresc}
                                </Text>
                            </View>
                        ) : null}
                    </View>
                )}
            </ScrollView>
        </SafeView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    scrollContent: { paddingBottom: 60 },
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
    loadingCenter: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 },
    content: { paddingHorizontal: S[4], paddingTop: S[4] },
    infoCard: {
        borderRadius: 20,
        padding: 18,
        flexDirection: "row",
        alignItems: "flex-start",
        gap: S[4],
    },
    avatar: {
        width: 64,
        height: 64,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },
    infoCardBody: { flex: 1 },
    zasiegBadge: {
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: R.full,
        marginTop: S[2],
    },
    subjectSection: { marginTop: S[5] },
    bodyCard: {
        borderRadius: 20,
        padding: 18,
        marginTop: S[5],
    },
});
