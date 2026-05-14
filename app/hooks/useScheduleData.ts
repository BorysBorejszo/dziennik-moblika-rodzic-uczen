import { useCallback, useEffect, useState } from "react";
import { CalendarEvent, getCalendarData } from "../api/calendar";
import { getUserSchedule, Lesson } from "../api/schedule";
import { UserData } from "../context/UserContext";

export type ScheduleData = {
    scheduleByDay: Lesson[][];
    eventsByDate: Map<string, CalendarEvent[]>;
    loading: boolean;
    refreshing: boolean;
    load: () => Promise<void>;
    setRefreshing: (v: boolean) => void;
};

export function useScheduleData(user: UserData | null): ScheduleData {
    const [scheduleByDay, setScheduleByDay] = useState<Lesson[][]>([[], [], [], [], []]);
    const [eventsByDate, setEventsByDate] = useState<Map<string, CalendarEvent[]>>(new Map());
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        if (!user) return;
        const studentId = (user.serverId ?? user.id) as number | undefined;
        if (!studentId) return;
        setLoading(true);
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
        } catch (error) {
            console.error("[schedule] Failed to fetch schedule:", error);
            setScheduleByDay([[], [], [], [], []]);
            setEventsByDate(new Map());
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user]);

    useEffect(() => {
        void load();
    }, [load]);

    return { scheduleByDay, eventsByDate, loading, refreshing, load, setRefreshing };
}

export default function UseScheduleDataRoute() { return null; }
