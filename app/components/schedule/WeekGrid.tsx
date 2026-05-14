import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CalendarEvent } from "../../api/calendar";
import { getDateKey } from "../../api/calendar";
import { Lesson } from "../../api/schedule";
import { EditorialPanel } from "../editorial/MobileBlocks";
import { EditorialPalette, editorialType, ThemeMode } from "../../theme/editorial";
import {
    buildWeek,
    dayLabelsShort,
    dotColorForKind,
    lessonStartHour,
    nowInMinutes,
    parseTimeRangeMinutes,
    sameDay,
} from "./scheduleHelpers";

type Props = {
    selectedDate: Date;
    scheduleByDay: Lesson[][];
    eventsByDate: Map<string, CalendarEvent[]>;
    palette: EditorialPalette;
    theme: ThemeMode;
    onSelectDate: (date: Date) => void;
    onSetViewMode: (mode: "day") => void;
    onShiftWeek: (direction: -1 | 1) => void;
    onGoToToday: () => void;
};

const PX_PER_MIN = 1.3;

type TimedLesson = { lesson: Lesson; startMin: number; endMin: number };

export const WeekGrid: React.FC<Props> = ({
    selectedDate,
    scheduleByDay,
    eventsByDate,
    palette,
    onSelectDate,
    onSetViewMode,
    onShiftWeek,
    onGoToToday,
}) => {
    const today = new Date();
    const weekDates = buildWeek(selectedDate).slice(0, 5);
    const weekStartLabel = weekDates[0].toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
    const weekEndLabel = weekDates[4].toLocaleDateString("pl-PL", { day: "numeric", month: "short" });

    const parseRange = (timeStr: string) => {
        const parts = timeStr.split(/[-–]/).map((s) => s.trim());
        const toMin = (chunk: string): number | null => {
            if (!chunk) return null;
            const m = chunk.match(/(\d{1,2}):(\d{2})/);
            if (!m) return null;
            return Number(m[1]) * 60 + Number(m[2]);
        };
        return { start: parts[0] ? toMin(parts[0]) : null, end: parts[1] ? toMin(parts[1]) : null };
    };

    const timedByDay: Record<number, TimedLesson[]> = { 0: [], 1: [], 2: [], 3: [], 4: [] };
    let earliestStart = Number.POSITIVE_INFINITY;
    let latestEnd = Number.NEGATIVE_INFINITY;

    for (let d = 0; d < 5; d++) {
        for (const lesson of scheduleByDay[d] ?? []) {
            const range = parseRange(lesson.time);
            if (range.start === null || range.end === null || range.end <= range.start) continue;
            timedByDay[d].push({ lesson, startMin: range.start, endMin: range.end });
            if (range.start < earliestStart) earliestStart = range.start;
            if (range.end > latestEnd) latestEnd = range.end;
        }
        timedByDay[d].sort((a, b) => a.startMin - b.startMin);
    }

    const hasLessons = Number.isFinite(earliestStart);
    const totalMinutes = hasLessons ? latestEnd - earliestStart : 0;
    const timelineHeight = Math.max(120, totalMinutes * PX_PER_MIN);

    const hourMarks: number[] = [];
    if (hasLessons) {
        const firstHour = Math.ceil(earliestStart / 60) * 60;
        for (let m = firstHour; m <= latestEnd; m += 60) hourMarks.push(m);
    }

    return (
        <EditorialPanel style={{ paddingHorizontal: 12, paddingVertical: 14 }}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => onShiftWeek(-1)}
                    style={[styles.arrowBtn, { backgroundColor: palette.pageSection }]}
                >
                    <Ionicons name="chevron-back" size={18} color={palette.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity onPress={onGoToToday} style={{ alignItems: "center" }}>
                    <Text style={[editorialType.eyebrow, { color: palette.textSoft }]}>Tydzień</Text>
                    <Text style={[editorialType.title, { color: palette.text, marginTop: 6 }]}>
                        {weekStartLabel} – {weekEndLabel}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => onShiftWeek(1)}
                    style={[styles.arrowBtn, { backgroundColor: palette.pageSection }]}
                >
                    <Ionicons name="chevron-forward" size={18} color={palette.textMuted} />
                </TouchableOpacity>
            </View>

            <View style={styles.gridHeaderRow}>
                {weekDates.map((date, i) => {
                    const isToday = sameDay(date, today);
                    const dayEvents = eventsByDate.get(getDateKey(date)) ?? [];
                    const dotKinds = Array.from(new Set(dayEvents.map((e) => e.kind))).slice(0, 3);
                    return (
                        <Pressable
                            key={`hdr-${i}`}
                            onPress={() => { onSelectDate(date); onSetViewMode("day"); }}
                            style={[
                                styles.gridHeaderCell,
                                { backgroundColor: isToday ? palette.primaryFixed : "transparent" },
                            ]}
                        >
                            <Text style={[editorialType.meta, { color: isToday ? palette.infoText : palette.textSoft }]}>
                                {dayLabelsShort[i]}
                            </Text>
                            <Text style={[editorialType.title, { color: isToday ? palette.infoText : palette.text, fontSize: 16, marginTop: 2 }]}>
                                {date.getDate()}
                            </Text>
                            <View style={styles.dotRow}>
                                {dotKinds.map((kind, k) => (
                                    <View
                                        key={`hdr-dot-${i}-${k}`}
                                        style={[styles.dotSmall, { backgroundColor: dotColorForKind(kind, palette) }]}
                                    />
                                ))}
                            </View>
                        </Pressable>
                    );
                })}
            </View>

            {!hasLessons ? (
                <View style={{ paddingVertical: 22, alignItems: "center" }}>
                    <Text style={[editorialType.body, { color: palette.textSoft }]}>
                        Brak lekcji w tym tygodniu.
                    </Text>
                </View>
            ) : (
                <View style={{ flexDirection: "row", marginTop: 6, height: timelineHeight }}>
                    <View style={styles.timeAxis}>
                        {hourMarks.map((min) => {
                            const top = (min - earliestStart) * PX_PER_MIN;
                            const hh = String(Math.floor(min / 60)).padStart(2, "0");
                            return (
                                <React.Fragment key={`mark-${min}`}>
                                    <Text style={[styles.timeAxisLabel, { color: palette.textSoft, top: top - 7 }]}>
                                        {hh}:00
                                    </Text>
                                    <View style={[styles.timeAxisLine, { backgroundColor: palette.outline, top }]} />
                                </React.Fragment>
                            );
                        })}
                    </View>

                    {[0, 1, 2, 3, 4].map((d) => (
                        <View
                            key={`col-${d}`}
                            style={[styles.timelineColumn, { backgroundColor: palette.pageSection }]}
                        >
                            {timedByDay[d].map(({ lesson, startMin, endMin }) => {
                                const top = (startMin - earliestStart) * PX_PER_MIN;
                                const height = Math.max(28, (endMin - startMin) * PX_PER_MIN);
                                const isSub = Boolean(lesson.isSubstitute);
                                return (
                                    <Pressable
                                        key={`cell-${d}-${lesson.id}-${startMin}`}
                                        onPress={() => { onSelectDate(weekDates[d]); onSetViewMode("day"); }}
                                        style={[
                                            styles.timelineCell,
                                            {
                                                top,
                                                height,
                                                backgroundColor: isSub ? palette.warningSoft : palette.primaryFixed,
                                                borderColor: isSub ? palette.warning : "transparent",
                                            },
                                        ]}
                                    >
                                        <Text style={[styles.gridTime, { color: isSub ? palette.warningText : palette.infoText }]}>
                                            {lessonStartHour(lesson.time) ?? ""}
                                        </Text>
                                        <Text numberOfLines={2} ellipsizeMode="tail" style={[styles.gridSubject, { color: palette.text }]}>
                                            {lesson.subject}
                                        </Text>
                                        {lesson.room && height >= 50 ? (
                                            <Text numberOfLines={1} style={[styles.gridRoom, { color: palette.textSoft }]}>
                                                {lesson.room}
                                            </Text>
                                        ) : null}
                                        {isSub ? (
                                            <View style={[styles.gridSubBadge, { backgroundColor: palette.warning }]} />
                                        ) : null}
                                    </Pressable>
                                );
                            })}
                        </View>
                    ))}

                    {(() => {
                        const todayInWeek = weekDates.some((d) => sameDay(d, today));
                        if (!todayInWeek || !hasLessons) return null;
                        const nowMin = nowInMinutes(today);
                        if (nowMin < earliestStart || nowMin > latestEnd) return null;
                        const lineY = (nowMin - earliestStart) * PX_PER_MIN;
                        const hh = String(today.getHours()).padStart(2, "0");
                        const mm = String(today.getMinutes()).padStart(2, "0");
                        return (
                            <View pointerEvents="none" style={[styles.weekNowLine, { top: lineY - 11 }]}>
                                <View style={[styles.weekNowBar, { backgroundColor: palette.danger }]} />
                                <View style={[styles.weekNowDot, { backgroundColor: palette.danger }]} />
                                <View style={[styles.weekNowLabel, { backgroundColor: palette.danger }]}>
                                    <Text style={[styles.nowLabelText, { color: palette.onPrimary }]}>
                                        {hh}:{mm}
                                    </Text>
                                </View>
                            </View>
                        );
                    })()}
                </View>
            )}
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
    gridHeaderRow: {
        flexDirection: "row",
        marginTop: 14,
        marginBottom: 6,
    },
    gridHeaderCell: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 6,
        marginHorizontal: 2,
        borderRadius: 12,
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
    timeAxis: {
        width: 36,
        position: "relative",
    },
    timeAxisLabel: {
        position: "absolute",
        right: 4,
        fontSize: 9,
        fontWeight: "600",
    },
    timeAxisLine: {
        position: "absolute",
        left: 32,
        right: -4,
        height: StyleSheet.hairlineWidth,
        opacity: 0.6,
    },
    timelineColumn: {
        flex: 1,
        marginHorizontal: 2,
        borderRadius: 12,
        position: "relative",
        overflow: "hidden",
    },
    timelineCell: {
        position: "absolute",
        left: 2,
        right: 2,
        borderRadius: 8,
        borderWidth: 1.5,
        paddingHorizontal: 4,
        paddingVertical: 4,
        overflow: "hidden",
    },
    gridTime: {
        fontSize: 9,
        fontWeight: "700",
        letterSpacing: 0.2,
    },
    gridSubject: {
        fontSize: 11,
        fontWeight: "700",
        marginTop: 2,
        lineHeight: 13,
    },
    gridRoom: {
        fontSize: 9,
        marginTop: 2,
    },
    gridSubBadge: {
        position: "absolute",
        top: 4,
        right: 4,
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    weekNowLine: {
        position: "absolute",
        left: 36,
        right: 0,
        height: 22,
        zIndex: 10,
    },
    weekNowBar: {
        position: "absolute",
        left: 0,
        right: 0,
        top: 10,
        height: 2,
    },
    weekNowDot: {
        position: "absolute",
        left: -2,
        top: 6,
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    weekNowLabel: {
        position: "absolute",
        right: 0,
        top: 0,
        height: 22,
        borderRadius: 6,
        paddingHorizontal: 6,
        justifyContent: "center",
    },
    nowLabelText: {
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 0.2,
    },
});

export default function WeekGridRoute() { return null; }
