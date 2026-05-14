import { authenticatedFetch, getApiBaseUrl } from "./auth";
import { getHomeworkForClass, HomeworkItem } from "./homework";
import { ADMIN_KEY } from "./constants";

// ---------------------------------------------------------------------------
// Calendar / events data layer
// ---------------------------------------------------------------------------
// The schedule view needs to know, for each calendar day, whether there are
// any non-recurring items attached to it (homework due, school events,
// substitutions). This module fetches everything in parallel and returns a
// per-day Map keyed by ISO date ("YYYY-MM-DD").
// ---------------------------------------------------------------------------


export type CalendarEventKind =
    | "homework"
    | "event"
    | "test"
    | "kartkowka"
    | "substitution";

export type CalendarEvent = {
    id: string;
    kind: CalendarEventKind;
    title: string;
    description?: string;
    /** "HH:MM" or "HH:MM-HH:MM" or undefined for all-day items. */
    time?: string;
    subject?: string;
    teacher?: string;
};

const extractList = (json: any): any[] => {
    if (!json) return [];
    if (Array.isArray(json)) return json;
    if (Array.isArray(json.results)) return json.results;
    if (Array.isArray(json.data)) return json.data;
    if (Array.isArray(json.items)) return json.items;
    return [];
};

const fetchListAuthenticated = async (path: string): Promise<any[]> => {
    try {
        const res = await authenticatedFetch(`${getApiBaseUrl()}${path}`, {
            headers: { "ADMIN-KEY": ADMIN_KEY },
        });
        if (!res.ok) return [];
        const json = await res.json().catch(() => null);
        return extractList(json);
    } catch {
        return [];
    }
};

const dateKey = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
};

const isoToDateKey = (iso: string | undefined): string | null => {
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
        // Maybe a "YYYY-MM-DD" without time — accept verbatim.
        if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
        return null;
    }
    return dateKey(date);
};

// Heuristic: classify a wydarzenie by its title/description so the UI can
// show it as a test or kartkówka rather than a generic event when applicable.
const classifyEventKind = (title: string, desc: string): CalendarEventKind => {
    const blob = `${title} ${desc}`.toLowerCase();
    if (/(kartk[oó]wk|quiz|spr\b)/.test(blob)) return "kartkowka";
    if (/(sprawdzian|test|egzamin|klas[oó]wka)/.test(blob)) return "test";
    return "event";
};

const formatHour = (raw: any): string | undefined => {
    if (!raw) return undefined;
    const s = String(raw);
    const match = s.match(/^(\d{2}):(\d{2})/);
    if (!match) return undefined;
    return `${match[1]}:${match[2]}`;
};

// ---------------------------------------------------------------------------
// Substitutions — best effort
// ---------------------------------------------------------------------------
// The API docs don't mention a substitutions endpoint. We probe a couple of
// likely paths; any that respond 200 are merged into the per-date map. If
// none exist (the most common case here), substitution data still flows in
// via plan-wpisy entries handled in schedule.ts (Lesson.substituteTeacher).

const SUBSTITUTION_CANDIDATES = [
    "/api/zastepstwa/",
    "/api/zastapstwa/",
    "/api/zmiany-planu/",
    "/api/plan-zastepstw/",
    "/api/substitutions/",
];

const fetchSubstitutions = async (
    classId?: number | null
): Promise<any[]> => {
    for (const path of SUBSTITUTION_CANDIDATES) {
        const withFilter =
            classId && classId > 0 ? `${path}?klasa=${classId}` : path;
        try {
            const res = await authenticatedFetch(
                `${getApiBaseUrl()}${withFilter}`,
                { headers: { "ADMIN-KEY": ADMIN_KEY } }
            );
            if (!res.ok) continue;
            const json = await res.json().catch(() => null);
            const list = extractList(json);
            if (list.length > 0) return list;
        } catch {
            continue;
        }
    }
    return [];
};

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type CalendarData = {
    /** Per-day events keyed by "YYYY-MM-DD". */
    eventsByDate: Map<string, CalendarEvent[]>;
    /** Raw homework items for use in other sections of the page. */
    homework: HomeworkItem[];
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const getCalendarData = async (
    classId?: number | null
): Promise<CalendarData> => {
    const [homeworkList, eventsRaw, substitutionsRaw] = await Promise.all([
        getHomeworkForClass(classId).catch(() => [] as HomeworkItem[]),
        fetchListAuthenticated(
            classId && classId > 0
                ? `/api/wydarzenia/?klasa=${classId}`
                : "/api/wydarzenia/"
        ),
        fetchSubstitutions(classId),
    ]);

    const eventsByDate = new Map<string, CalendarEvent[]>();
    const push = (key: string, event: CalendarEvent) => {
        const list = eventsByDate.get(key);
        if (list) list.push(event);
        else eventsByDate.set(key, [event]);
    };

    // Homework — use `due` (termin) as the calendar date.
    homeworkList.forEach((hw) => {
        const key = isoToDateKey(hw.due);
        if (!key) return;
        push(key, {
            id: `hw-${hw.id}`,
            kind: "homework",
            title: hw.subject ? `Praca domowa: ${hw.subject}` : "Praca domowa",
            description: hw.description,
            subject: hw.subject,
            teacher: hw.teacher ?? undefined,
        });
    });

    // Events / wydarzenia — use `data`.
    eventsRaw.forEach((row: any) => {
        const id = Number(row?.id ?? row?.pk ?? NaN);
        if (Number.isNaN(id)) return;
        const dateStr = row?.data ?? row?.date ?? null;
        const key = isoToDateKey(dateStr);
        if (!key) return;
        const allDay = row?.calodobowe !== false;
        const fromHour = formatHour(row?.godzina_od ?? row?.start_time);
        const toHour = formatHour(row?.godzina_do ?? row?.end_time);
        const time = allDay
            ? undefined
            : fromHour && toHour
                ? `${fromHour} - ${toHour}`
                : fromHour;
        const title = String(row?.tytul ?? row?.title ?? "Wydarzenie");
        const description = String(row?.opis ?? row?.description ?? "");
        push(key, {
            id: `ev-${id}`,
            kind: classifyEventKind(title, description),
            title,
            description,
            time,
        });
    });

    // Substitutions returned by an explicit endpoint (when one exists).
    substitutionsRaw.forEach((row: any) => {
        const id = Number(row?.id ?? row?.pk ?? NaN);
        if (Number.isNaN(id)) return;
        const dateStr = row?.data ?? row?.date ?? row?.dzien ?? null;
        const key = isoToDateKey(dateStr);
        if (!key) return;
        const subject =
            row?.przedmiot_nazwa ??
            row?.przedmiot?.nazwa ??
            row?.subject ??
            "Lekcja";
        const substitute =
            row?.zastepca_nazwa ??
            row?.nauczyciel_zastepujacy_nazwa ??
            row?.zastepca?.nazwa ??
            row?.substitute ??
            null;
        const fromHour = formatHour(row?.godzina_od ?? row?.start_time);
        const toHour = formatHour(row?.godzina_do ?? row?.end_time);
        const time =
            fromHour && toHour
                ? `${fromHour} - ${toHour}`
                : fromHour;
        push(key, {
            id: `sub-${id}`,
            kind: "substitution",
            title: `Zastępstwo: ${subject}`,
            description: substitute ? `Prowadzi ${substitute}` : undefined,
            time,
            subject: String(subject),
            teacher: substitute ? String(substitute) : undefined,
        });
    });

    return { eventsByDate, homework: homeworkList };
};

export const getDateKey = dateKey;

export default function CalendarApiRoute() {
    return null;
}
