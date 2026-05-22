import { useCallback, useEffect, useState } from "react";
import { CalendarEvent, getCalendarData } from "../api/calendar";
import { getUserSchedule, Lesson } from "../api/schedule";
import { UserData } from "../context/UserContext";

export type ScheduleData = {
    scheduleByDay: Lesson[][];
    eventsByDate: Map<string, CalendarEvent[]>;
    loading: boolean;
    refreshing: boolean;
    error: string | null;
    load: () => Promise<void>;
    setRefreshing: (v: boolean) => void;
};

export function useScheduleData(user: UserData | null): ScheduleData {
    const [scheduleByDay, setScheduleByDay] = useState<Lesson[][]>([[], [], [], [], []]);
    const [eventsByDate, setEventsByDate] = useState<Map<string, CalendarEvent[]>>(new Map());
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!user) return;
        const studentId = (user.serverId ?? user.id) as number | undefined;
        if (!studentId) return;
        setLoading(true);
        setError(null);
        try {
            const [scheduleResult, calendarResult] = await Promise.all([
                getUserSchedule(studentId, user.classId ?? undefined),
                getCalendarData(user.classId ?? null),
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
            console.error("[schedule] Failed to fetch schedule:", err);
            setScheduleByDay([[], [], [], [], []]);
            setEventsByDate(new Map());
            setError((err instanceof Error ? err.message : null) ?? 'Błąd ładowania planu lekcji');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user]);

    useEffect(() => {
        void load();
    }, [load]);

    return { scheduleByDay, eventsByDate, loading, refreshing, error, load, setRefreshing };
}

export default function UseScheduleDataRoute() { return null; }
