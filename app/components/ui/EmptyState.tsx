import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { R, S, T, getEditorialPalette } from "../../theme/editorial";
import { useTheme } from "../../theme/ThemeContext";

type Props = {
    title?: string;
    subtitle?: string;
    icon?: keyof typeof Ionicons.glyphMap;
};

const EmptyState: React.FC<Props> = ({ title, subtitle, icon = "file-tray-outline" }) => {
    const { theme } = useTheme();
    const palette = getEditorialPalette(theme);

    return (
        <View style={[styles.wrap, { backgroundColor: palette.surfaceLow }]}>
            <View style={[styles.iconWrap, { backgroundColor: palette.surfaceMid }]}>
                <Ionicons name={icon} size={26} color={palette.textSoft} />
            </View>
            {title ? (
                <Text style={[T.bodyMedium, { color: palette.text, textAlign: "center", marginTop: S[3] }]}>
                    {title}
                </Text>
            ) : null}
            {subtitle ? (
                <Text style={[T.label, { color: palette.textMuted, textAlign: "center", marginTop: 6 }]}>
                    {subtitle}
                </Text>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    wrap: {
        borderRadius: R.lg,
        padding: S[8],
        alignItems: "center",
    },
    iconWrap: {
        width: 52,
        height: 52,
        borderRadius: R.xl,
        alignItems: "center",
        justifyContent: "center",
    },
});

export default EmptyState;
