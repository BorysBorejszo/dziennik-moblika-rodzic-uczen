import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CalendarEvent, CalendarEventKind } from "../../api/calendar";
import { EditorialPalette, editorialType, getEditorialShadow, ThemeMode } from "../../theme/editorial";
import { dotColorForKind, eventKindLabel } from "./scheduleHelpers";

const eventKindIcon = (
    kind: CalendarEventKind
): React.ComponentProps<typeof Ionicons>["name"] => {
    switch (kind) {
        case "homework": return "book-outline";
        case "test": return "alert-circle-outline";
        case "kartkowka": return "pencil-outline";
        case "substitution": return "swap-horizontal-outline";
        default: return "megaphone-outline";
    }
};

type Props = {
    event: CalendarEvent;
    index: number;
    palette: EditorialPalette;
    theme: ThemeMode;
    onPress: () => void;
};

export const EventCard: React.FC<Props> = ({ event, index, palette, theme, onPress }) => {
    const accent = dotColorForKind(event.kind, palette);
    const iconBg =
        event.kind === "homework" ? palette.warningSoft
        : event.kind === "test" ? palette.dangerSoft
        : event.kind === "kartkowka" ? palette.warningSoft
        : event.kind === "substitution" ? palette.infoSoft
        : palette.primaryFixed;

    return (
        <TouchableOpacity
            activeOpacity={0.75}
            onPress={onPress}
            style={[
                styles.card,
                { backgroundColor: palette.surface, marginTop: index === 0 ? 0 : 12 },
                getEditorialShadow(theme),
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${eventKindLabel(event.kind)}: ${event.title}${event.time ? `, ${event.time}` : ""}`}
        >
            <View style={styles.row}>
                <View style={[styles.icon, { backgroundColor: iconBg }]}>
                    <Ionicons name={eventKindIcon(event.kind)} size={18} color={accent} />
                </View>
                <View style={{ flex: 1, paddingRight: 12 }}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <View style={[styles.kindBadge, { backgroundColor: accent + "22" }]}>
                            <Text style={[editorialType.meta, { color: accent }]}>
                                {eventKindLabel(event.kind)}
                            </Text>
                        </View>
                    </View>
                    <Text style={[editorialType.title, { color: palette.text, marginTop: 8 }]} numberOfLines={2}>
                        {event.title}
                    </Text>
                    {event.description ? (
                        <Text style={[editorialType.body, { color: palette.textMuted, marginTop: 4 }]} numberOfLines={3}>
                            {event.description}
                        </Text>
                    ) : null}
                </View>
                <Text style={[editorialType.meta, { color: palette.textSoft }]}>
                    {event.time ?? "Cały dzień"}
                </Text>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: 22,
    },
    row: {
        flexDirection: "row",
        alignItems: "flex-start",
        paddingHorizontal: 16,
        paddingVertical: 16,
    },
    icon: {
        width: 42,
        height: 42,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 14,
    },
    kindBadge: {
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
        alignSelf: "flex-start",
    },
});

export default function EventCardRoute() { return null; }
