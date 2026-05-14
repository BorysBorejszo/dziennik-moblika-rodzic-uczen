import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { CalendarEvent } from "../../api/calendar";
import { Lesson } from "../../api/schedule";
import { EditorialPalette, ThemeMode } from "../../theme/editorial";
import { eventOverlapsLesson, nowInMinutes, parseTimeRangeMinutes, sameDay } from "./scheduleHelpers";
import { LessonCard } from "./LessonCard";

type Props = {
    selectedDate: Date;
    selectedLessons: Lesson[];
    selectedEvents: CalendarEvent[];
    palette: EditorialPalette;
    theme: ThemeMode;
    onLessonPress: (lesson: Lesson) => void;
    onEventPress: (event: CalendarEvent) => void;
};

const NowLine: React.FC<{ label?: string; palette: EditorialPalette }> = ({ label, palette }) => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    return (
        <View style={styles.nowLineRow}>
            <View style={[styles.nowLineBar, { backgroundColor: palette.danger }]} />
            <View style={[styles.nowLineDot, { backgroundColor: palette.danger }]} />
            <View style={[styles.nowLineLabelWrap, { backgroundColor: palette.danger }]}>
                <Text style={[styles.nowLineLabel, { color: palette.onPrimary }]}>
                    {label ?? `${hh}:${mm}`}
                </Text>
            </View>
        </View>
    );
};

export const DayLessons: React.FC<Props> = ({
    selectedDate,
    selectedLessons,
    selectedEvents,
    palette,
    theme,
    onLessonPress,
    onEventPress,
}) => {
    const today = new Date();
    const isToday = sameDay(selectedDate, today);

    const sorted = [...selectedLessons].sort((a, b) => {
        const sa = parseTimeRangeMinutes(a.time).start ?? 0;
        const sb = parseTimeRangeMinutes(b.time).start ?? 0;
        return sa - sb;
    });

    const PX_PER_MIN_DAY = 1.6;
    const NOW_LINE_FOOTPRINT = 34;

    const gapBefore = (i: number, lineEatsSpace: boolean): number => {
        if (i === 0) return 0;
        const prevEnd = parseTimeRangeMinutes(sorted[i - 1].time).end;
        const currStart = parseTimeRangeMinutes(sorted[i].time).start;
        if (prevEnd === null || currStart === null || currStart <= prevEnd) return 10;
        const breakMin = currStart - prevEnd;
        const proportional = breakMin * PX_PER_MIN_DAY;
        const adjusted = lineEatsSpace ? proportional - NOW_LINE_FOOTPRINT : proportional;
        return Math.max(8, adjusted);
    };

    let currentIdx = -1;
    let nextIdx = -1;
    if (isToday) {
        const now = nowInMinutes(today);
        currentIdx = sorted.findIndex((l) => {
            const r = parseTimeRangeMinutes(l.time);
            return r.start !== null && r.end !== null && now >= r.start && now <= r.end;
        });
        if (currentIdx === -1) {
            nextIdx = sorted.findIndex((l) => {
                const r = parseTimeRangeMinutes(l.time);
                return r.start !== null && now < r.start;
            });
        }
    }

    const nowStatus = (i: number): "now" | "next" | null =>
        i === currentIdx ? "now" : i === nextIdx ? "next" : null;

    const eventsForLesson = (lesson: Lesson): CalendarEvent[] =>
        selectedEvents.filter((e) => eventOverlapsLesson(e, lesson));

    const card = (lesson: Lesson, i: number, marginOverride: number, lineEatsSpace = false) => (
        <LessonCard
            key={`lesson-${lesson.id}`}
            lesson={lesson}
            index={i}
            nowStatus={nowStatus(i)}
            marginTopOverride={gapBefore(i, lineEatsSpace || marginOverride > 0 ? lineEatsSpace : false)}
            matchedEvents={eventsForLesson(lesson)}
            palette={palette}
            theme={theme}
            onPress={() => onLessonPress(lesson)}
            onEventPress={onEventPress}
        />
    );

    if (!isToday) {
        return (
            <>
                {sorted.map((lesson, i) => card(lesson, i, 0))}
            </>
        );
    }

    const nowMin = nowInMinutes(today);
    const firstStart = parseTimeRangeMinutes(sorted[0]?.time ?? "").start;
    const lastEnd = parseTimeRangeMinutes(sorted[sorted.length - 1]?.time ?? "").end;

    if (firstStart !== null && nowMin < firstStart) {
        return (
            <>
                <NowLine palette={palette} />
                {sorted.map((lesson, i) => card(lesson, i, 0))}
            </>
        );
    }

    if (lastEnd !== null && nowMin > lastEnd) {
        return (
            <>
                {sorted.map((lesson, i) => card(lesson, i, 0))}
                <NowLine palette={palette} />
            </>
        );
    }

    const out: React.ReactNode[] = [];
    let inserted = false;
    let lineJustInserted = false;
    for (let i = 0; i < sorted.length; i++) {
        const range = parseTimeRangeMinutes(sorted[i].time);
        const next = sorted[i + 1] ? parseTimeRangeMinutes(sorted[i + 1].time) : null;

        const lineGoesBefore =
            !inserted &&
            range.start !== null &&
            range.end !== null &&
            nowMin >= range.start &&
            nowMin <= range.end;

        if (lineGoesBefore) {
            out.push(<NowLine key={`now-during-${i}`} palette={palette} />);
            inserted = true;
            lineJustInserted = true;
        }

        out.push(
            <LessonCard
                key={`lesson-${sorted[i].id}`}
                lesson={sorted[i]}
                index={i}
                nowStatus={nowStatus(i)}
                marginTopOverride={gapBefore(i, lineJustInserted)}
                matchedEvents={eventsForLesson(sorted[i])}
                palette={palette}
                theme={theme}
                onPress={() => onLessonPress(sorted[i])}
                onEventPress={onEventPress}
            />
        );
        lineJustInserted = false;

        if (
            !inserted &&
            range.end !== null &&
            next?.start !== null &&
            next?.start !== undefined &&
            nowMin > range.end &&
            nowMin < next.start
        ) {
            out.push(<NowLine key={`now-break-${i}`} palette={palette} />);
            inserted = true;
            lineJustInserted = true;
        }
    }

    if (!inserted) {
        out.push(<NowLine key="now-fallback" palette={palette} />);
    }

    return <>{out}</>;
};

const styles = StyleSheet.create({
    nowLineRow: {
        position: "relative",
        height: 22,
        marginVertical: 6,
    },
    nowLineBar: {
        position: "absolute",
        left: 0,
        right: 0,
        top: 10,
        height: 2,
    },
    nowLineDot: {
        position: "absolute",
        left: 0,
        top: 6,
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    nowLineLabelWrap: {
        position: "absolute",
        right: 0,
        top: 0,
        height: 22,
        borderRadius: 6,
        paddingHorizontal: 6,
        justifyContent: "center",
    },
    nowLineLabel: {
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 0.2,
    },
});

export default function DayLessonsRoute() { return null; }
