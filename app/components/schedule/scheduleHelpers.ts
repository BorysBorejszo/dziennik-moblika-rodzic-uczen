import { CalendarEventKind } from "../../api/calendar";
import { Lesson } from "../../api/schedule";
import { EditorialPalette } from "../../theme/editorial";

export const dayLabelsShort = ["Pn", "Wt", "Sr", "Czw", "Pt", "Sb", "Nd"];

export const startOfWeekMon = (date: Date): Date => {
    const normalized = new Date(date);
    const day = normalized.getDay();
    const diff = (day + 6) % 7;
    normalized.setDate(normalized.getDate() - diff);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
};

export const scheduleDayIndex = (date: Date): number | null => {
    const js = date.getDay();
    if (js === 0 || js === 6) return null;
    return js - 1;
};

export const sameDay = (a: Date, b: Date): boolean =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

export const monthLabel = (date: Date): string =>
    date.toLocaleDateString("pl-PL", { month: "long", year: "numeric" });

export const buildMonthGrid = (monthAnchor: Date): Date[] => {
    const firstOfMonth = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1);
    const gridStart = startOfWeekMon(firstOfMonth);
    return Array.from({ length: 42 }).map((_, i) => {
        const d = new Date(gridStart);
        d.setDate(gridStart.getDate() + i);
        return d;
    });
};

export const buildWeek = (anchor: Date): Date[] => {
    const start = startOfWeekMon(anchor);
    return Array.from({ length: 7 }).map((_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        return d;
    });
};

export const lessonStartHour = (timeStr: string): string | null => {
    if (!timeStr) return null;
    const match = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (!match) return null;
    return `${match[1].padStart(2, "0")}:${match[2]}`;
};

export const parseTimeRangeMinutes = (
    timeStr: string
): { start: number | null; end: number | null } => {
    if (!timeStr) return { start: null, end: null };
    const parts = timeStr.split(/[-–]/).map((s) => s.trim());
    const toMin = (chunk: string): number | null => {
        if (!chunk) return null;
        const m = chunk.match(/(\d{1,2}):(\d{2})/);
        if (!m) return null;
        return Number(m[1]) * 60 + Number(m[2]);
    };
    return { start: parts[0] ? toMin(parts[0]) : null, end: parts[1] ? toMin(parts[1]) : null };
};

export const nowInMinutes = (now: Date = new Date()): number =>
    now.getHours() * 60 + now.getMinutes();

const SUBJECT_AVATAR_COLORS = [
    "#2563eb", "#0ea5e9", "#10b981", "#84cc16", "#f59e0b",
    "#f97316", "#ef4444", "#ec4899", "#a855f7", "#6366f1",
    "#06b6d4", "#0d9488",
];

export const subjectColor = (subject: string): string => {
    if (!subject) return SUBJECT_AVATAR_COLORS[0];
    let hash = 0;
    for (let i = 0; i < subject.length; i++) {
        hash = ((hash << 5) - hash + subject.charCodeAt(i)) >>> 0;
    }
    return SUBJECT_AVATAR_COLORS[hash % SUBJECT_AVATAR_COLORS.length];
};

export const subjectInitial = (subject: string): string => {
    const trimmed = (subject ?? "").trim();
    if (!trimmed) return "?";
    const stripped = trimmed.replace(/^(Język|Jezyk)\s+/i, "");
    return (stripped || trimmed).charAt(0).toUpperCase();
};

export const dotColorForKind = (kind: CalendarEventKind, palette: EditorialPalette): string => {
    switch (kind) {
        case "homework": return palette.warning;
        case "test": return palette.danger;
        case "kartkowka": return palette.warning;
        case "substitution": return palette.info;
        default: return palette.primary;
    }
};

export const eventKindLabel = (kind: CalendarEventKind): string => {
    switch (kind) {
        case "homework": return "Praca domowa";
        case "test": return "Sprawdzian";
        case "kartkowka": return "Kartkówka";
        case "substitution": return "Zastępstwo";
        default: return "Wydarzenie";
    }
};

export const eventOverlapsLesson = (event: { time?: string }, lesson: Lesson): boolean => {
    if (!event.time) return false;
    const lessonRange = parseTimeRangeMinutes(lesson.time);
    if (lessonRange.start === null || lessonRange.end === null) return false;
    const parts = event.time.split(/[-–]/).map((s) => s.trim());
    const toMin = (s: string): number | null => {
        const m = s.match(/(\d{1,2}):(\d{2})/);
        if (!m) return null;
        return Number(m[1]) * 60 + Number(m[2]);
    };
    const evStart = toMin(parts[0]);
    if (evStart === null) return false;
    const evEnd = parts[1] ? (toMin(parts[1]) ?? evStart) : evStart;
    return evStart <= lessonRange.end && evEnd >= lessonRange.start;
};

export default function ScheduleHelpersRoute() { return null; }
