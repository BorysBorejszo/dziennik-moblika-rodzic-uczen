import Ionicons from "@expo/vector-icons/build/Ionicons";
import Entypo from "@expo/vector-icons/Entypo";
import { useRouter } from "expo-router";
import * as React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getEditorialPalette } from "../theme/editorial";
import { useTheme } from "../theme/ThemeContext";

// Order must match the bar layout used by app/(tabs)/_layout.tsx so the visual
// language is consistent across the tabs themselves and any standalone screen
// (e.g. /homework) that mounts this component.
type RouteKey =
    | "index"
    | "schedule"
    | "grades"
    | "attendance"
    | "messages"
    | "settings";

const ROUTES: readonly { key: RouteKey; href: string; label: string }[] = [
    { key: "index", href: "/", label: "Główna" },
    { key: "schedule", href: "/schedule", label: "Plan" },
    { key: "grades", href: "/grades", label: "Oceny" },
    { key: "attendance", href: "/attendance", label: "Frekwencja" },
    { key: "messages", href: "/messages", label: "Wiadomości" },
    { key: "settings", href: "/settings", label: "Ustawienia" },
];

type Props = {
    /**
     * Highlight a tab as active. Pass null to render with nothing focused
     * — useful for screens that aren't part of the tab set (e.g. /homework).
     */
    activeRoute?: RouteKey | null;
};

/**
 * Standalone bottom navigation bar that mirrors the visual style of the one
 * baked into app/(tabs)/_layout.tsx. Tapping a tab navigates via expo-router,
 * which the tabs layout already syncs back into its segments-driven state.
 */
export default function BottomTabBar({ activeRoute = null }: Props) {
    const { theme } = useTheme();
    const palette = getEditorialPalette(theme);
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const activePillBg = theme === "dark" ? "#1e3a8a" : palette.primary;
    const activeTint = theme === "dark" ? "#ffffff" : palette.onPrimary;
    const inactiveTint = palette.textSoft;

    return (
        <View
            style={{
                paddingBottom: insets.bottom,
                backgroundColor: palette.tabBar,
            }}
        >
            <View
                style={[
                    styles.tabBarShell,
                    { backgroundColor: palette.tabBar },
                ]}
            >
                {ROUTES.map((route) => {
                    const focused = route.key === activeRoute;
                    const iconColor = focused ? activeTint : inactiveTint;
                    const labelColor = focused ? activeTint : palette.textMuted;

                    return (
                        <TouchableOpacity
                            key={route.key}
                            onPress={() => router.push(route.href as any)}
                            style={styles.tabTouch}
                            activeOpacity={0.8}
                        >
                            <View
                                style={[
                                    styles.tabPill,
                                    focused
                                        ? { backgroundColor: activePillBg }
                                        : null,
                                ]}
                            >
                                <View style={styles.tabIconWrap}>
                                    {route.key === "index" && (
                                        <Entypo
                                            name="home"
                                            size={22}
                                            color={iconColor}
                                        />
                                    )}
                                    {route.key === "schedule" && (
                                        <Entypo
                                            name="calendar"
                                            size={22}
                                            color={iconColor}
                                        />
                                    )}
                                    {route.key === "grades" && (
                                        <Ionicons
                                            name="ribbon-outline"
                                            size={23}
                                            color={iconColor}
                                        />
                                    )}
                                    {route.key === "attendance" && (
                                        <Ionicons
                                            name="stats-chart-outline"
                                            size={23}
                                            color={iconColor}
                                        />
                                    )}
                                    {route.key === "messages" && (
                                        <Entypo
                                            name="chat"
                                            size={22}
                                            color={iconColor}
                                        />
                                    )}
                                    {route.key === "settings" && (
                                        <Entypo
                                            name="cog"
                                            size={22}
                                            color={iconColor}
                                        />
                                    )}
                                </View>
                                <Text
                                    numberOfLines={1}
                                    ellipsizeMode="tail"
                                    style={[
                                        styles.tabLabel,
                                        {
                                            color: labelColor,
                                            opacity: focused ? 1 : 0.92,
                                        },
                                    ]}
                                >
                                    {route.label}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    tabBarShell: {
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: 8,
        paddingTop: 10,
        paddingBottom: 8,
        flexDirection: "row",
        alignItems: "center",
    },
    tabTouch: {
        flex: 1,
    },
    tabPill: {
        minHeight: 56,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 6,
        paddingVertical: 6,
    },
    tabIconWrap: {
        minHeight: 24,
        justifyContent: "center",
        alignItems: "center",
    },
    tabLabel: {
        fontSize: 11,
        fontWeight: "700",
        textAlign: "center",
        marginTop: 5,
    },
});
