import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Header from "../components/Header";
import { useUser } from "../context/UserContext";
import { R, S, T, cardShadow, getEditorialPalette } from "../theme/editorial";
import { useTheme } from "../theme/ThemeContext";

type SettingsRowProps = {
    icon: keyof typeof Ionicons.glyphMap;
    iconColor: string;
    iconBg: string;
    label: string;
    description: string;
    onPress: () => void;
    labelColor?: string;
    showDivider?: boolean;
    dividerColor?: string;
};

function SettingsRow({
    icon,
    iconColor,
    iconBg,
    label,
    description,
    onPress,
    labelColor,
    showDivider,
    dividerColor,
}: SettingsRowProps) {
    const { theme } = useTheme();
    const palette = getEditorialPalette(theme);

    return (
        <>
            <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={styles.row}>
                <View style={[styles.rowIconWrap, { backgroundColor: iconBg, borderRadius: R.md }]}>
                    <Ionicons name={icon} size={20} color={iconColor} />
                </View>
                <View style={styles.rowBody}>
                    <Text style={[T.bodyMedium, { color: labelColor ?? palette.text }]}>
                        {label}
                    </Text>
                    <Text style={[T.label, styles.rowDesc, { color: palette.textSoft }]}>
                        {description}
                    </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={palette.outlineVariant} />
            </TouchableOpacity>
            {showDivider ? (
                <View style={[styles.divider, { backgroundColor: dividerColor ?? palette.outlineVariant }]} />
            ) : null}
        </>
    );
}

type SectionProps = {
    label: string;
    children: React.ReactNode;
};

function Section({ label, children }: SectionProps) {
    const { theme } = useTheme();
    const palette = getEditorialPalette(theme);
    const shadow = cardShadow(theme);

    return (
        <View style={styles.section}>
            <Text style={[T.eyebrow, styles.eyebrow, { color: palette.textSoft }]}>
                {label}
            </Text>
            <View style={[styles.card, { backgroundColor: palette.surface }, shadow]}>
                {children}
            </View>
        </View>
    );
}

export default function Settings() {
    const router = useRouter();
    const { theme } = useTheme();
    const { clearUser, user } = useUser();
    const palette = getEditorialPalette(theme);

    const rawName = user?.name?.toString() ?? "";
    const displayName = rawName.trim() || user?.username || "Uzytkownik";

    const handleLogout = () => {
        clearUser();
    };

    return (
        <View style={[styles.root, { backgroundColor: palette.background }]}>
            <Header title="Ustawienia" subtitle={displayName} />
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
            >

                <View style={styles.body}>
                    <Section label="KONTO">
                        <SettingsRow
                            icon="person-outline"
                            iconColor={palette.primary}
                            iconBg={palette.primaryFixed}
                            label="Profil"
                            description="Zaktualizuj swoje dane osobowe"
                            onPress={() => router.push("/settings/ustawienia_proflu")}
                            showDivider
                            dividerColor={palette.outlineVariant}
                        />
                        <SettingsRow
                            icon="notifications-outline"
                            iconColor={palette.warning}
                            iconBg={palette.warningBg}
                            label="Powiadomienia"
                            description="Zarzadzaj preferencjami powiadomien"
                            onPress={() => router.push("/settings/ustawienia_powiadomienia")}
                            showDivider
                            dividerColor={palette.outlineVariant}
                        />
                        <SettingsRow
                            icon="lock-closed-outline"
                            iconColor={palette.success}
                            iconBg={palette.successBg}
                            label="Prywatnosc"
                            description="Kontroluj ustawienia prywatnosci"
                            onPress={() => router.push("/settings/ustawienia_prywatnosc")}
                        />
                    </Section>

                    <Section label="PREFERENCJE">
                        <SettingsRow
                            icon="color-palette-outline"
                            iconColor={palette.info}
                            iconBg={palette.infoBg}
                            label="Wyglad"
                            description="Dostosuj motyw aplikacji"
                            onPress={() => router.push("/settings/ustawienia_wyglad")}
                            showDivider
                            dividerColor={palette.outlineVariant}
                        />
                        <SettingsRow
                            icon="language-outline"
                            iconColor={palette.primary}
                            iconBg={palette.primaryFixed}
                            label="Jezyk"
                            description="Polski (PL)"
                            onPress={() => router.push("/settings/ustawienia_jezyk")}
                        />
                    </Section>

                    <Section label="WSPARCIE">
                        <SettingsRow
                            icon="help-circle-outline"
                            iconColor={palette.textMuted}
                            iconBg={palette.surfaceMid}
                            label="Pomoc"
                            description="Skontaktuj sie z nami lub zobacz FAQ"
                            onPress={() => {}}
                        />
                    </Section>

                    <Section label="SESJA">
                        <SettingsRow
                            icon="log-out-outline"
                            iconColor={palette.danger}
                            iconBg={palette.dangerBg}
                            label="Wyloguj"
                            description="Wyloguj sie z aplikacji"
                            labelColor={palette.dangerText}
                            onPress={handleLogout}
                        />
                    </Section>
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
    section: {
        marginTop: S[6],
    },
    eyebrow: {
        marginBottom: S[2],
    },
    card: {
        borderRadius: R.lg,
        overflow: "hidden",
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: S[4],
        paddingVertical: S[4],
        gap: S[3],
    },
    rowIconWrap: {
        width: 40,
        height: 40,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },
    rowBody: {
        flex: 1,
    },
    rowDesc: {
        marginTop: 2,
    },
    divider: {
        marginLeft: 40 + S[3] + S[4],
        height: StyleSheet.hairlineWidth,
    },
});
