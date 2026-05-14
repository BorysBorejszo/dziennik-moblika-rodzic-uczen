import Entypo from "@expo/vector-icons/Entypo";
import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { R, S, T, getEditorialPalette } from "../theme/editorial";
import { useTheme } from "../theme/ThemeContext";
import { SidebarTrigger } from "./ui/sidebar";

type Props = {
    title: string;
    subtitle?: string;
    children?: React.ReactNode;
    onBack?: () => void;
};

export default function Header({ title, subtitle, children, onBack }: Props) {
    const { theme } = useTheme();
    const palette = getEditorialPalette(theme);

    return (
        <View style={[styles.root, { backgroundColor: palette.background }]}>
            {onBack ? (
                <TouchableOpacity
                    onPress={onBack}
                    style={[styles.menuBtn, { backgroundColor: palette.surfaceMid }]}
                >
                    <Ionicons name="arrow-back" size={22} color={palette.primary} />
                </TouchableOpacity>
            ) : (
                <SidebarTrigger style={[styles.menuBtn, { backgroundColor: palette.surfaceMid }]}>
                    <Entypo name="menu" size={22} color={palette.primary} />
                </SidebarTrigger>
            )}

            <View style={styles.titleBlock}>
                <Text style={[T.headline, { color: palette.text }]} numberOfLines={1}>
                    {title}
                </Text>
                {subtitle ? (
                    <Text style={[T.label, { color: palette.textMuted, marginTop: 2 }]} numberOfLines={1}>
                        {subtitle}
                    </Text>
                ) : null}
            </View>

            {children ? (
                <View style={[styles.actions, { backgroundColor: palette.surfaceMid }]}>
                    {children}
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: S[4],
        paddingTop: S[3],
        paddingBottom: S[4],
        gap: S[3],
        zIndex: 20,
    },
    menuBtn: {
        width: 44,
        height: 44,
        borderRadius: R.full,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },
    titleBlock: {
        flex: 1,
    },
    actions: {
        minHeight: 44,
        paddingHorizontal: S[3],
        paddingVertical: S[2],
        borderRadius: R.full,
        justifyContent: "center",
    },
});
