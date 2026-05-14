import React, { useMemo, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { CalendarEvent, getDateKey } from "../api/calendar";
import { Lesson } from "../api/schedule";
import { DayLessons } from "../components/schedule/DayLessons";
import { EventCard } from "../components/schedule/EventCard";
import { EventDetailModal } from "../components/schedule/EventDetailModal";
import { LessonDetailModal } from "../components/schedule/LessonDetailModal";
import { MonthGrid } from "../components/schedule/MonthGrid";
import {
    buildMonthGrid,
    buildWeek,
    eventOverlapsLesson,
    scheduleDayIndex,
} from "../components/schedule/scheduleHelpers";
import { WeekGrid } from "../components/schedule/WeekGrid";
import { WeekStrip } from "../components/schedule/WeekStrip";
import {
    EditorialSectionHeader,
    EditorialSegmentedControl,
} from "../components/editorial/MobileBlocks";
import Header from "../components/Header";
import EmptyState from "../components/ui/EmptyState";
import { useUser } from "../context/UserContext";
import { useScheduleData } from "../hooks/useScheduleData";
import { getEditorialPalette } from "../theme/editorial";
import { useTheme } from "../theme/ThemeContext";

const Schedule: React.FC = () => {
    const { user } = useUser();
    const { theme } = useTheme();
    const palette = getEditorialPalette(theme);

    const [viewMode, setViewMode] = useState<"day" | "week" | "month">("day");
    const [selectedDate, setSelectedDate] = useState<Date>(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    });
    const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
        const d = new Date();
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        return d;
    });

    const [detailLesson, setDetailLesson] = useState<Lesson | null>(null);
    const [detailEvent, setDetailEvent] = useState<CalendarEvent | null>(null);

    const { scheduleByDay, eventsByDate, loading, refreshing, load, setRefreshing } =
        useScheduleData(user);

    const dateLabel = useMemo(
        () =>
            new Date().toLocaleDateString("pl-PL", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
            }),
        []
    );

    const selectedKey = getDateKey(selectedDate);
    const selectedLessons = useMemo(() => {
        const idx = scheduleDayIndex(selectedDate);
        if (idx === null) return [];
        return scheduleByDay[idx] ?? [];
    }, [scheduleByDay, selectedDate]);

    const selectedEvents = useMemo(
        () => eventsByDate.get(selectedKey) ?? [],
        [eventsByDate, selectedKey]
    );

    const standaloneEvents = useMemo(() => {
        const matchedIds = new Set<string>();
        for (const lesson of selectedLessons) {
            for (const event of selectedEvents) {
                if (eventOverlapsLesson(event, lesson)) matchedIds.add(event.id);
            }
        }
        return selectedEvents.filter((e) => !matchedIds.has(e.id));
    }, [selectedLessons, selectedEvents]);

    const weekDates = useMemo(() => buildWeek(selectedDate), [selectedDate]);
    const monthGrid = useMemo(() => buildMonthGrid(calendarMonth), [calendarMonth]);

    const goToToday = () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        setSelectedDate(today);
        setCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    };

    const shiftWeek = (direction: -1 | 1) => {
        const next = new Date(selectedDate);
        next.setDate(next.getDate() + 7 * direction);
        setSelectedDate(next);
    };

    const shiftMonth = (direction: -1 | 1) => {
        setCalendarMonth(
            new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + direction, 1)
        );
    };

    const selectedDayLabel = selectedDate.toLocaleDateString("pl-PL", {
        weekday: "long",
        day: "numeric",
        month: "long",
    });

    return (
        <View style={{ flex: 1, backgroundColor: palette.background }}>
            <Header title="Plan lekcji" subtitle={dateLabel} />
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 120 }}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => { setRefreshing(true); void load(); }}
                        tintColor={palette.primary}
                    />
                }
            >

                <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
                    <EditorialSegmentedControl
                        value={viewMode}
                        onChange={(next) => setViewMode(next)}
                        options={[
                            { key: "day", label: "Dzień" },
                            { key: "week", label: "Tydzień" },
                            { key: "month", label: "Miesiąc" },
                        ]}
                    />

                    <View style={{ marginTop: 18 }}>
                        {viewMode === "day" ? (
                            <WeekStrip
                                selectedDate={selectedDate}
                                weekDates={weekDates}
                                scheduleByDay={scheduleByDay}
                                eventsByDate={eventsByDate}
                                palette={palette}
                                onSelectDate={setSelectedDate}
                                onShiftWeek={shiftWeek}
                                onGoToToday={goToToday}
                            />
                        ) : viewMode === "week" ? (
                            <WeekGrid
                                selectedDate={selectedDate}
                                scheduleByDay={scheduleByDay}
                                eventsByDate={eventsByDate}
                                palette={palette}
                                theme={theme}
                                onSelectDate={setSelectedDate}
                                onSetViewMode={setViewMode}
                                onShiftWeek={shiftWeek}
                                onGoToToday={goToToday}
                            />
                        ) : (
                            <MonthGrid
                                selectedDate={selectedDate}
                                calendarMonth={calendarMonth}
                                monthGrid={monthGrid}
                                eventsByDate={eventsByDate}
                                palette={palette}
                                onSelectDate={setSelectedDate}
                                onShiftMonth={shiftMonth}
                                onGoToToday={goToToday}
                            />
                        )}
                    </View>

                    {viewMode !== "week" ? (
                        <View style={{ marginTop: 28 }}>
                            <EditorialSectionHeader eyebrow={selectedDayLabel} title="Lekcje" />

                            {loading && selectedLessons.length === 0 ? (
                                <EmptyState
                                    title="Ładowanie planu"
                                    subtitle="Odczytuje lekcje dla wybranego dnia."
                                />
                            ) : selectedLessons.length === 0 ? (
                                <EmptyState
                                    title="Brak lekcji w tym dniu"
                                    subtitle="Wybierz inny dzień z kalendarza."
                                />
                            ) : (
                                <DayLessons
                                    selectedDate={selectedDate}
                                    selectedLessons={selectedLessons}
                                    selectedEvents={selectedEvents}
                                    palette={palette}
                                    theme={theme}
                                    onLessonPress={setDetailLesson}
                                    onEventPress={setDetailEvent}
                                />
                            )}
                        </View>
                    ) : null}

                    {viewMode === "day" ? (
                        <View style={{ marginTop: 28 }}>
                            <EditorialSectionHeader eyebrow="Tego dnia" title="Wydarzenia" />

                            {standaloneEvents.length === 0 ? (
                                <EmptyState
                                    title="Brak wydarzeń"
                                    subtitle="Prace domowe, kartkówki, sprawdziany i ogłoszenia pojawią się tutaj."
                                />
                            ) : (
                                standaloneEvents.map((event, index) => (
                                    <EventCard
                                        key={`event-${event.id}`}
                                        event={event}
                                        index={index}
                                        palette={palette}
                                        theme={theme}
                                        onPress={() => setDetailEvent(event)}
                                    />
                                ))
                            )}
                        </View>
                    ) : null}
                </View>
            </ScrollView>

            <LessonDetailModal
                lesson={detailLesson}
                palette={palette}
                onClose={() => setDetailLesson(null)}
            />

            <EventDetailModal
                event={detailEvent}
                palette={palette}
                onClose={() => setDetailEvent(null)}
            />
        </View>
    );
};

export default Schedule;
