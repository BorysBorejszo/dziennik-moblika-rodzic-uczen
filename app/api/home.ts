import { authenticatedFetch, getApiBaseUrl } from "./auth";
import { ADMIN_KEY } from "./constants";
import { calculateWeightedAverage, getUserGrades, GradeItem } from "./grades";
import {
    convertToDisplayMessage,
    getInboxMessages,
    MessageRecord,
} from "./messages";
import { getUserSchedule, Lesson } from "./schedule";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type TodayLesson = {
    id: number;
    subject: string;
    time: string;
    room: string;
    /**
     * True iff the lesson is currently in progress (now is between the
     * lesson's start and end). The first item of `todayLessons` is either
     * the lesson currently in progress or — if we are in a break / before
     * the first lesson — the next lesson coming up.
     */
    inProgress: boolean;
};

export type UpdateItem = {
    id: string | number;
    type: "grade" | "message" | "announcement";
    title: string;
    desc: string;
    time: string;
};

export type HomeResponse = {
    todayLessons: TodayLesson[];
    recentUpdates: UpdateItem[];
    gradeAverage: string | null;
    unreadMessageCount: number;
};


// ---------------------------------------------------------------------------
// Plan dnia helpers
// ---------------------------------------------------------------------------

const parseTimeRange = (
    timeStr: string
): { start: number | null; end: number | null } => {
    if (!timeStr) return { start: null, end: null };
    const parts = timeStr.split(/[-–]/).map((s) => s.trim());
    const toMinutes = (chunk: string): number | null => {
        if (!chunk) return null;
        const [hh, mm] = chunk.split(":").map((x) => Number(x));
        if (Number.isNaN(hh)) return null;
        return hh * 60 + (Number.isNaN(mm) ? 0 : mm);
    };
    return {
        start: parts[0] ? toMinutes(parts[0]) : null,
        end: parts[1] ? toMinutes(parts[1]) : null,
    };
};

// schedule.ts uses Mon=0..Fri=4. JS getDay() = Sun=0..Sat=6.
const getTodayDayIndex = (now: Date): number | null => {
    const js = now.getDay();
    if (js === 0 || js === 6) return null; // weekend → no school day
    return js - 1;
};

const buildTodayLessons = (lessons: Lesson[], now: Date): TodayLesson[] => {
    if (!lessons || lessons.length === 0) return [];

    const annotated = lessons
        .map((lesson) => {
            const range = parseTimeRange(lesson.time);
            return { lesson, start: range.start, end: range.end };
        })
        .filter((entry): entry is { lesson: Lesson; start: number; end: number | null } =>
            entry.start !== null
        )
        .sort((a, b) => a.start - b.start);

    if (annotated.length === 0) return [];

    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    // 1) Is a lesson currently in progress?
    let anchorIdx = annotated.findIndex(
        (entry) =>
            entry.end !== null &&
            nowMinutes >= entry.start &&
            nowMinutes < entry.end
    );
    const anchorInProgress = anchorIdx !== -1;

    // 2) Otherwise, find the next lesson that hasn't started yet.
    if (anchorIdx === -1) {
        anchorIdx = annotated.findIndex((entry) => entry.start > nowMinutes);
    }

    // 3) After the school day → nothing to show going forward.
    if (anchorIdx === -1) return [];

    return annotated.slice(anchorIdx, anchorIdx + 3).map((entry, i) => ({
        id: entry.lesson.id,
        subject: entry.lesson.subject,
        time: entry.lesson.time,
        room: entry.lesson.room,
        inProgress: i === 0 ? anchorInProgress : false,
    }));
};

// ---------------------------------------------------------------------------
// Aktywnosc helpers
// ---------------------------------------------------------------------------

const formatRelativeTime = (iso: string, now: Date = new Date()): string => {
    if (!iso) return "";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 0) {
        // future event (announcements often live in the future)
        return date.toLocaleDateString("pl-PL", {
            day: "numeric",
            month: "short",
        });
    }
    const diffMin = Math.round(diffMs / (60 * 1000));
    if (diffMin < 1) return "Przed chwila";
    if (diffMin < 60) return `${diffMin} min temu`;
    const diffH = Math.round(diffMin / 60);
    if (diffH < 24) return `${diffH} godz. temu`;
    const diffD = Math.round(diffH / 24);
    if (diffD === 1) return "Wczoraj";
    if (diffD < 7) return `${diffD} dni temu`;
    return date.toLocaleDateString("pl-PL", {
        day: "numeric",
        month: "short",
    });
};

const extractList = (json: any): any[] => {
    if (!json) return [];
    if (Array.isArray(json)) return json;
    if (Array.isArray(json.results)) return json.results;
    if (Array.isArray(json.data)) return json.data;
    if (Array.isArray(json.items)) return json.items;
    return [];
};

type RawAnnouncement = {
    id: number;
    title: string;
    desc: string;
    timestamp: number; // ms epoch — 0 if unparseable
    iso: string;
};

// /api/wydarzenia/ (events / announcements) — optionally filtered by class.
const fetchAnnouncements = async (
    classId?: number | null
): Promise<RawAnnouncement[]> => {
    try {
        const base = getApiBaseUrl();
        const url =
            classId && classId > 0
                ? `${base}/api/wydarzenia/?klasa=${classId}`
                : `${base}/api/wydarzenia/`;
        const res = await authenticatedFetch(url, {
            headers: { "ADMIN-KEY": ADMIN_KEY },
        });
        if (!res.ok) return [];
        const json = await res.json().catch(() => null);
        const list = extractList(json);
        return list
            .map((item: any): RawAnnouncement | null => {
                const id = Number(item?.id ?? item?.pk ?? NaN);
                if (Number.isNaN(id)) return null;
                const title = String(
                    item?.tytul ?? item?.title ?? item?.nazwa ?? "Ogloszenie"
                );
                const desc = String(item?.opis ?? item?.description ?? "");
                const dateStr =
                    item?.data ??
                    item?.date ??
                    item?.created_at ??
                    item?.timestamp ??
                    null;
                const timeStr = item?.godzina_od ?? item?.start_time ?? null;
                const combined = dateStr
                    ? timeStr
                        ? `${dateStr}T${timeStr}`
                        : `${dateStr}`
                    : null;
                const ts = combined ? new Date(combined).getTime() : NaN;
                return {
                    id,
                    title,
                    desc,
                    timestamp: Number.isNaN(ts) ? 0 : ts,
                    iso: combined ?? "",
                };
            })
            .filter((x): x is RawAnnouncement => x !== null);
    } catch (error) {
        console.warn("[home] fetchAnnouncements failed:", error);
        return [];
    }
};

const buildRecentUpdates = ({
    grades,
    messages,
    announcements,
    now,
}: {
    grades: { subject: string; grade: GradeItem }[];
    messages: MessageRecord[];
    announcements: RawAnnouncement[];
    now: Date;
}): UpdateItem[] => {
    type Combined = UpdateItem & { ts: number };
    const items: Combined[] = [];

    grades.forEach(({ subject, grade }, idx) => {
        if (!grade.date) return;
        const ts = new Date(grade.date).getTime();
        if (Number.isNaN(ts)) return;
        const valueLabel = grade.label ?? String(grade.value);
        const category = grade.category ? ` - ${grade.category}` : "";
        items.push({
            id: `grade-${subject}-${ts}-${idx}`,
            type: "grade",
            title: subject ? `Nowa ocena z ${subject}` : "Nowa ocena",
            desc: `${valueLabel}${category}`,
            time: formatRelativeTime(grade.date, now),
            ts,
        });
    });

    messages.forEach((m) => {
        const ts = new Date(m.data_wyslania).getTime();
        if (Number.isNaN(ts)) return;
        const sender =
            m.nadawca_username ??
            (m.nadawca_id ? `Uzytkownik ${m.nadawca_id}` : "Nieznany");
        items.push({
            id: m.id,
            type: "message",
            title: `Wiadomosc od ${sender}`,
            desc:
                m.temat ||
                (m.tresc
                    ? m.tresc.length > 80
                        ? `${m.tresc.slice(0, 80)}…`
                        : m.tresc
                    : ""),
            time: formatRelativeTime(m.data_wyslania, now),
            ts,
        });
    });

    announcements.forEach((a) => {
        if (!a.timestamp) return;
        items.push({
            id: a.id,
            type: "announcement",
            title: a.title,
            desc: a.desc,
            time: formatRelativeTime(a.iso, now),
            ts: a.timestamp,
        });
    });

    return items
        .sort((a, b) => b.ts - a.ts)
        .slice(0, 5)
        .map(({ ts: _ts, ...rest }) => rest);
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type HomeRequest = {
    studentId: number;
    /** Django user id used for messages (often differs from uczen_id). */
    messageUserId?: number | null;
    /** Class id used to filter announcements (/api/wydarzenia/). */
    classId?: number | null;
};

export const getUserHomeData = async (
    request: HomeRequest
): Promise<HomeResponse> => {
    const { studentId, messageUserId = null, classId = null } = request;

    if (!studentId || studentId <= 0) {
        return {
            todayLessons: [],
            recentUpdates: [],
            gradeAverage: null,
            unreadMessageCount: 0,
        };
    }

    const now = new Date();

    const [scheduleResult, gradesResult, messagesResult, announcementsResult] =
        await Promise.all([
            getUserSchedule(studentId).catch(() => ({ schedule: [] })),
            getUserGrades(studentId).catch(() => null),
            messageUserId
                ? getInboxMessages(messageUserId).catch(
                      () => [] as MessageRecord[]
                  )
                : Promise.resolve<MessageRecord[]>([]),
            fetchAnnouncements(classId),
        ]);

    // ---- Plan dnia ----
    const dayIndex = getTodayDayIndex(now);
    const lessonsToday =
        dayIndex !== null
            ? scheduleResult.schedule.find((d) => d.dayIndex === dayIndex)
                  ?.lessons ?? []
            : [];
    const todayLessons = buildTodayLessons(lessonsToday, now);

    // ---- Aktywnosc ----
    const flatGrades = (gradesResult?.subjects ?? []).flatMap((s) =>
        s.grades.map((g) => ({ subject: s.subject, grade: g }))
    );
    const recentUpdates = buildRecentUpdates({
        grades: flatGrades,
        messages: messagesResult,
        announcements: announcementsResult,
        now,
    });

    // ---- Side numbers ----
    const allGrades = (gradesResult?.subjects ?? []).flatMap((s) => s.grades);
    const avg = calculateWeightedAverage(allGrades);
    const gradeAverage = typeof avg === "number" ? avg.toFixed(2) : null;

    let unreadMessageCount = 0;
    if (messageUserId) {
        unreadMessageCount = messagesResult
            .map((r) => convertToDisplayMessage(r, messageUserId))
            .filter((m) => m.unread).length;
    }

    return {
        todayLessons,
        recentUpdates,
        gradeAverage,
        unreadMessageCount,
    };
};

export default function HomeApiRoute() {
    return null;
}
