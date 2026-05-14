import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CalendarEvent } from "../../api/calendar";
import { getDateKey } from "../../api/calendar";
import { EditorialPanel } from "../editorial/MobileBlocks";
import { EditorialPalette, editorialType } from "../../theme/editorial";
import { dayLabelsShort, dotColorForKind, monthLabel, sameDay } from "./scheduleHelpers";

type Props = {
    selectedDate: Date;
    calendarMonth: Date;
    monthGrid: Date[];
    eventsByDate: Map<string, CalendarEvent[]>;
    palette: EditorialPalette;
    onSelectDate: (date: Date) => void;
    onShiftMonth: (direction: -1 | 1) => void;
    onGoToToday: () => void;
};

export const MonthGrid: React.FC<Props> = ({
    selectedDate,
    calendarMonth,
    monthGrid,
    eventsByDate,
    palette,
    onSelectDate,
    onShiftMonth,
    onGoToToday,
}) => {
    const today = new Date();

    return (
        <EditorialPanel style={{ paddingHorizontal: 18, paddingVertical: 18 }}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => onShiftMonth(-1)}
                    style={[styles.arrowBtn, { backgroundColor: palette.pageSection }]}
                    accessibilityRole="button"
                    accessibilityLabel="Poprzedni miesiąc"
                >
                    <Ionicons name="chevron-back" size={18} color={palette.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={onGoToToday}
                    style={{ alignItems: "center" }}
                    accessibilityRole="button"
                    accessibilityLabel="Idź do dzisiaj"
                >
                    <Text style={[editorialType.eyebrow, { color: palette.textSoft }]}>Miesiąc</Text>
                    <Text style={[editorialType.title, { color: palette.text, marginTop: 6 }]}>
                        {monthLabel(calendarMonth)}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => onShiftMonth(1)}
                    style={[styles.arrowBtn, { backgroundColor: palette.pageSection }]}
                    accessibilityRole="button"
                    accessibilityLabel="Następny miesiąc"
                >
                    <Ionicons name="chevron-forward" size={18} color={palette.textMuted} />
                </TouchableOpacity>
            </View>

            <View style={styles.weekdayHeader}>
                {dayLabelsShort.map((lbl) => (
                    <View key={`hdr-${lbl}`} style={styles.weekdayHeaderCell}>
                        <Text style={[editorialType.meta, { color: palette.textSoft }]}>{lbl}</Text>
                    </View>
                ))}
            </View>

            <View style={styles.grid}>
                {monthGrid.map((date, idx) => {
                    const inMonth = date.getMonth() === calendarMonth.getMonth();
                    const active = sameDay(date, selectedDate);
                    const isToday = sameDay(date, today);
                    const dayEvents = eventsByDate.get(getDateKey(date)) ?? [];
                    const dotKinds = Array.from(new Set(dayEvents.map((e) => e.kind))).slice(0, 3);

                    return (
                        <Pressable
                            key={`m-${idx}`}
                            onPress={() => onSelectDate(date)}
                            style={[
                                styles.cell,
                                {
                                    backgroundColor: active
                                        ? palette.primary
                                        : isToday
                                            ? palette.primaryFixed
                                            : "transparent",
                                    opacity: inMonth ? 1 : 0.32,
                                },
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel={`${date.toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" })}${isToday ? ", dzisiaj" : ""}${active ? ", wybrany" : ""}`}
                            accessibilityState={{ selected: active }}
                        >
                            <Text
                                style={[
                                    editorialType.meta,
                                    {
                                        color: active
                                            ? palette.onPrimary
                                            : isToday
                                                ? palette.infoText
                                                : palette.text,
                                    },
                                ]}
                            >
                                {date.getDate()}
                            </Text>
                            <View style={styles.dotRow}>
                                {dotKinds.map((kind, k) => (
                                    <View
                                        key={`${kind}-${k}`}
                                        style={[
                                            styles.dotSmall,
                                            { backgroundColor: active ? palette.onPrimary : dotColorForKind(kind, palette) },
                                        ]}
                                    />
                                ))}
                            </View>
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
    weekdayHeader: {
        flexDirection: "row",
        marginTop: 18,
    },
    weekdayHeaderCell: {
        width: `${100 / 7}%`,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 6,
    },
    grid: {
        flexDirection: "row",
        flexWrap: "wrap",
        marginTop: 4,
    },
    cell: {
        width: `${100 / 7}%`,
        aspectRatio: 1,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 14,
        marginBottom: 4,
    },
    dotRow: {
        flexDirection: "row",
        gap: 3,
        marginTop: 4,
        height: 4,
        alignItems: "center",
        justifyContent: "center",
    },
    dotSmall: {
        width: 4,
        height: 4,
        borderRadius: 2,
    },
});

export default function MonthGridRoute() { return null; }
