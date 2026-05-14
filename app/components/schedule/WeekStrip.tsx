import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CalendarEvent } from "../../api/calendar";
import { getDateKey } from "../../api/calendar";
import { Lesson } from "../../api/schedule";
import { EditorialPanel } from "../editorial/MobileBlocks";
import { EditorialPalette, editorialType } from "../../theme/editorial";
import { dayLabelsShort, dotColorForKind, sameDay, scheduleDayIndex } from "./scheduleHelpers";

type Props = {
    selectedDate: Date;
    weekDates: Date[];
    scheduleByDay: Lesson[][];
    eventsByDate: Map<string, CalendarEvent[]>;
    palette: EditorialPalette;
    onSelectDate: (date: Date) => void;
    onShiftWeek: (direction: -1 | 1) => void;
    onGoToToday: () => void;
};

export const WeekStrip: React.FC<Props> = ({
    selectedDate,
    weekDates,
    scheduleByDay,
    eventsByDate,
    palette,
    onSelectDate,
    onShiftWeek,
    onGoToToday,
}) => {
    const today = new Date();
    const startLabel = weekDates[0].toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
    const endLabel = weekDates[6].toLocaleDateString("pl-PL", { day: "numeric", month: "short" });

    return (
        <EditorialPanel style={{ paddingHorizontal: 14, paddingVertical: 16 }}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => onShiftWeek(-1)}
                    style={[styles.arrowBtn, { backgroundColor: palette.pageSection }]}
                    accessibilityRole="button"
                    accessibilityLabel="Poprzedni tydzień"
                >
                    <Ionicons name="chevron-back" size={18} color={palette.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={onGoToToday}
                    style={{ alignItems: "center" }}
                    accessibilityRole="button"
                    accessibilityLabel="Idź do dzisiaj"
                >
                    <Text style={[editorialType.eyebrow, { color: palette.textSoft }]}>Tydzień</Text>
                    <Text style={[editorialType.title, { color: palette.text, marginTop: 6 }]}>
                        {startLabel} – {endLabel}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => onShiftWeek(1)}
                    style={[styles.arrowBtn, { backgroundColor: palette.pageSection }]}
                    accessibilityRole="button"
                    accessibilityLabel="Następny tydzień"
                >
                    <Ionicons name="chevron-forward" size={18} color={palette.textMuted} />
                </TouchableOpacity>
            </View>

            <View style={styles.weekRow}>
                {weekDates.map((date, i) => {
                    const active = sameDay(date, selectedDate);
                    const isToday = sameDay(date, today);
                    const dayEvents = eventsByDate.get(getDateKey(date)) ?? [];
                    const idx = scheduleDayIndex(date);
                    const hasLessons = idx !== null && (scheduleByDay[idx] ?? []).length > 0;
                    const dotKinds = Array.from(new Set(dayEvents.map((e) => e.kind))).slice(0, 3);

                    return (
                        <Pressable
                            key={`week-${date.toISOString()}`}
                            onPress={() => onSelectDate(date)}
                            style={[
                                styles.weekCell,
                                { backgroundColor: active ? palette.primary : palette.pageSection },
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel={`${dayLabelsShort[i]}, ${date.getDate()}${isToday ? ", dzisiaj" : ""}${active ? ", wybrany" : ""}`}
                            accessibilityState={{ selected: active }}
                        >
                            <Text style={[editorialType.meta, { color: active ? palette.onPrimary : palette.textSoft }]}>
                                {dayLabelsShort[i]}
                            </Text>
                            <Text style={[editorialType.title, { color: active ? palette.onPrimary : palette.text, marginTop: 6 }]}>
                                {date.getDate()}
                            </Text>
                            <View style={styles.dotRow}>
                                {dotKinds.length > 0 ? (
                                    dotKinds.map((kind, k) => (
                                        <View
                                            key={`${kind}-${k}`}
                                            style={[
                                                styles.dot,
                                                { backgroundColor: active ? palette.onPrimary : dotColorForKind(kind, palette) },
                                            ]}
                                        />
                                    ))
                                ) : hasLessons ? (
                                    <View style={[styles.dot, { backgroundColor: active ? palette.onPrimary : palette.textSoft, opacity: 0.5 }]} />
                                ) : (
                                    <View style={{ height: 6, marginTop: 6 }} />
                                )}
                            </View>
                            {isToday && !active ? (
                                <View style={[styles.todayMarker, { backgroundColor: palette.primary }]} />
                            ) : null}
                        </Pressable>
                    );
                })}
            </View>
        </EditorialPanel>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    arrowBtn: {
        width: 42,
        height: 42,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
    },
    weekRow: {
        flexDirection: "row",
        gap: 6,
        marginTop: 16,
    },
    weekCell: {
        flex: 1,
        minHeight: 84,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 10,
        paddingHorizontal: 4,
    },
    dotRow: {
        flexDirection: "row",
        gap: 3,
        marginTop: 6,
        height: 6,
        alignItems: "center",
        justifyContent: "center",
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    todayMarker: {
        position: "absolute",
        bottom: 6,
        width: 18,
        height: 2,
        borderRadius: 2,
    },
});

export default function WeekStripRoute() { return null; }
