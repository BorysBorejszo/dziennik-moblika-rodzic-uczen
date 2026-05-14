import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CalendarEvent, CalendarEventKind } from "../../api/calendar";
import { EditorialPalette, editorialType } from "../../theme/editorial";
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
    event: CalendarEvent | null;
    palette: EditorialPalette;
    onClose: () => void;
};

export const EventDetailModal: React.FC<Props> = ({ event, palette, onClose }) => (
    <Modal visible={event !== null} transparent animationType="slide" onRequestClose={onClose}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel="Zamknij">
            <Pressable style={[styles.sheet, { backgroundColor: palette.surface }]} onPress={() => {}}>
                {event ? (() => {
                    const accent = dotColorForKind(event.kind, palette);
                    const iconBg =
                        event.kind === "test" ? palette.dangerSoft
                        : event.kind === "kartkowka" ? palette.warningSoft
                        : event.kind === "homework" ? palette.warningSoft
                        : palette.primaryFixed;
                    return (
                        <>
                            <View style={styles.handleBar} />
                            <View style={styles.headerRow}>
                                <View style={[styles.eventIcon, { backgroundColor: iconBg, width: 52, height: 52, borderRadius: 16 }]}>
                                    <Ionicons name={eventKindIcon(event.kind)} size={24} color={accent} />
                                </View>
                                <View style={{ flex: 1, marginLeft: 14 }}>
                                    <View style={[styles.kindBadge, { backgroundColor: accent + "22", alignSelf: "flex-start" }]}>
                                        <Text style={[editorialType.meta, { color: accent }]}>
                                            {eventKindLabel(event.kind)}
                                        </Text>
                                    </View>
                                    <Text style={[editorialType.headline, { color: palette.text, marginTop: 6 }]} numberOfLines={3}>
                                        {event.title}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    onPress={onClose}
                                    style={[styles.closeBtn, { backgroundColor: palette.pageSection }]}
                                    accessibilityRole="button"
                                    accessibilityLabel="Zamknij szczegóły wydarzenia"
                                >
                                    <Ionicons name="close" size={20} color={palette.textMuted} />
                                </TouchableOpacity>
                            </View>
                            {(event.description || event.time || event.subject || event.teacher) ? (
                                <View style={[styles.infoGrid, { backgroundColor: palette.pageSection }]}>
                                    {event.time ? (
                                        <View style={styles.infoRow}>
                                            <Ionicons name="time-outline" size={16} color={palette.textSoft} />
                                            <Text style={[editorialType.body, { color: palette.text, marginLeft: 10 }]}>{event.time}</Text>
                                        </View>
                                    ) : null}
                                    {event.subject ? (
                                        <View style={styles.infoRow}>
                                            <Ionicons name="book-outline" size={16} color={palette.textSoft} />
                                            <Text style={[editorialType.body, { color: palette.text, marginLeft: 10 }]}>{event.subject}</Text>
                                        </View>
                                    ) : null}
                                    {event.teacher ? (
                                        <View style={styles.infoRow}>
                                            <Ionicons name="person-outline" size={16} color={palette.textSoft} />
                                            <Text style={[editorialType.body, { color: palette.text, marginLeft: 10 }]}>{event.teacher}</Text>
                                        </View>
                                    ) : null}
                                    {event.description ? (
                                        <View style={[styles.infoRow, { alignItems: "flex-start" }]}>
                                            <Ionicons name="information-circle-outline" size={16} color={palette.textSoft} style={{ marginTop: 2 }} />
                                            <Text style={[editorialType.body, { color: palette.textMuted, marginLeft: 10, flex: 1 }]}>
                                                {event.description}
                                            </Text>
                                        </View>
                                    ) : null}
                                </View>
                            ) : null}
                        </>
                    );
                })() : null}
            </Pressable>
        </Pressable>
    </Modal>
);

const styles = StyleSheet.create({
    scrim: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.45)",
        justifyContent: "flex-end",
    },
    sheet: {
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        padding: 20,
        paddingBottom: 36,
    },
    handleBar: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: "rgba(128,128,128,0.3)",
        alignSelf: "center",
        marginBottom: 20,
    },
    headerRow: {
        flexDirection: "row",
        alignItems: "flex-start",
    },
    eventIcon: {
        alignItems: "center",
        justifyContent: "center",
    },
    kindBadge: {
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
    },
    infoGrid: {
        borderRadius: 16,
        padding: 16,
        marginTop: 16,
        gap: 12,
    },
    infoRow: {
        flexDirection: "row",
        alignItems: "center",
    },
});

export default function EventDetailModalRoute() { return null; }
