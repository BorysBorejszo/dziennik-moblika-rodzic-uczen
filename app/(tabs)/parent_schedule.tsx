import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { getCalendarData, getDateKey } from "../api/calendar";
import { getUserSchedule, Lesson } from "../api/schedule";
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
import ErrorState from "../components/ErrorState";
import EmptyState from "../components/ui/EmptyState";
import { CalendarEvent } from "../api/calendar";
import { useParent } from "../context/ParentContext";
import { getEditorialPalette } from "../theme/editorial";
import { useTheme } from "../theme/ThemeContext";

type ViewMode = "day" | "week" | "month";

export default function ParentSchedule() {
  const { activeChild } = useParent();
  const { theme } = useTheme();
  const palette = getEditorialPalette(theme);

  const [scheduleByDay, setScheduleByDay] = useState<Lesson[][]>([[], [], [], [], []]);
  const [eventsByDate, setEventsByDate] = useState<Map<string, CalendarEvent[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [viewMode, setViewMode] = useState<ViewMode>("day");
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

  const load = useCallback(async () => {
    if (!activeChild) { setLoading(false); return; }
    setFetchError(null);
    try {
      const classId = activeChild.class_id ?? undefined;
      const [scheduleResult, calendarResult] = await Promise.all([
        getUserSchedule(activeChild.id, classId),
        getCalendarData(classId ?? null),
      ]);
      const grouped: Lesson[][] = [[], [], [], [], []];
      scheduleResult.schedule.forEach((day) => {
        if (day.dayIndex >= 0 && day.dayIndex <= 4) {
          grouped[day.dayIndex] = day.lessons;
        }
      });
      setScheduleByDay(grouped);
      setEventsByDate(calendarResult.eventsByDate);
    } catch (err) {
      console.error("[parent_schedule] Failed to load:", err);
      setFetchError((err instanceof Error ? err.message : null) ?? 'Błąd ładowania planu lekcji');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeChild?.id, activeChild?.class_id, reloadKey]);

  useEffect(() => { setLoading(true); void load(); }, [load]);

  const selectedKey = getDateKey(selectedDate);
  const selectedDayIdx = scheduleDayIndex(selectedDate);
  const selectedLessons = selectedDayIdx !== null ? (scheduleByDay[selectedDayIdx] ?? []) : [];
  const selectedEvents = eventsByDate.get(selectedKey) ?? [];

  const standaloneEvents = useMemo(() => {
    const matched = new Set<string>();
    selectedLessons.forEach((lesson) =>
      selectedEvents.forEach((ev) => { if (eventOverlapsLesson(ev, lesson)) matched.add(ev.id); })
    );
    return selectedEvents.filter((ev) => !matched.has(ev.id));
  }, [selectedLessons, selectedEvents]);

  const weekDates = useMemo(() => buildWeek(selectedDate), [selectedDate]);
  const monthGrid = useMemo(() => buildMonthGrid(calendarMonth), [calendarMonth]);

  const shiftWeek = useCallback((dir: 1 | -1) => {
    setSelectedDate((d) => {
      const next = new Date(d);
      next.setDate(next.getDate() + dir * 7);
      return next;
    });
  }, []);

  const shiftMonth = useCallback((dir: 1 | -1) => {
    setCalendarMonth((m) => new Date(m.getFullYear(), m.getMonth() + dir, 1));
  }, []);

  const goToToday = useCallback(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setSelectedDate(d);
    setCalendarMonth(new Date(d.getFullYear(), d.getMonth(), 1));
  }, []);

  const selectedDayLabel = selectedDate.toLocaleDateString("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const childName = activeChild
    ? `${activeChild.first_name} ${activeChild.last_name}`
    : "Uczeń";

  if (fetchError && !loading && !refreshing) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.background }}>
        <Header title="Plan lekcji" subtitle={childName} />
        <ErrorState message={fetchError} onRetry={() => setReloadKey(k => k + 1)} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <Header title="Plan lekcji" subtitle={childName} />

      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <EditorialSegmentedControl
          value={viewMode}
          onChange={(next) => setViewMode(next)}
          options={[
            { key: "day" as const, label: "Dzień" },
            { key: "week" as const, label: "Tydzień" },
            { key: "month" as const, label: "Miesiąc" },
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
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); void load(); }}
            tintColor={palette.primary}
          />
        }
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, marginTop: 16 }}
      >
        {viewMode !== "week" && (
          <View style={{ marginTop: 12 }}>
            <EditorialSectionHeader eyebrow={selectedDayLabel} title="Lekcje" />
            {loading && selectedLessons.length === 0 ? (
              <EmptyState title="Ładowanie planu" subtitle="Odczytuje lekcje dla wybranego dnia." />
            ) : selectedLessons.length === 0 ? (
              <EmptyState title="Brak lekcji w tym dniu" subtitle="Wybierz inny dzień z kalendarza." />
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
        )}

        {viewMode === "day" && (
          <View style={{ marginTop: 28 }}>
            <EditorialSectionHeader eyebrow="Tego dnia" title="Wydarzenia" />
            {standaloneEvents.length === 0 ? (
              <EmptyState title="Brak wydarzeń" subtitle="Prace domowe i sprawdziany pojawią się tutaj." />
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
        )}
      </ScrollView>

      <LessonDetailModal lesson={detailLesson} onClose={() => setDetailLesson(null)} palette={palette} />
      <EventDetailModal event={detailEvent} onClose={() => setDetailEvent(null)} palette={palette} />
    </View>
  );
}
