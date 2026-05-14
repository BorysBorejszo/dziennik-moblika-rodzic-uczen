import { authenticatedFetch, getApiBaseUrl } from "./auth";
import { ADMIN_KEY } from "./constants";

export type Lesson = {
    id: number;
    subject: string;
    time: string;
    room: string;
    teacher: string;
    /**
     * When the lesson is being run by a substitute, this is the original
     * (regularly scheduled) teacher. The `teacher` field is then the
     * substitute. Both are populated whenever any substitution information
     * is available so the UI can render "Zastępstwo: X (zamiast Y)".
     */
    originalTeacher?: string;
    /** Substitute teacher's display name when applicable. */
    substituteTeacher?: string;
    /** Convenience flag — true iff a substitution is in effect. */
    isSubstitute?: boolean;
};

export type DaySchedule = {
    dayIndex: number; // 0=Monday, 1=Tuesday, ..., 4=Friday
    lessons: Lesson[];
};

export type ScheduleResponse = {
    schedule: DaySchedule[];
};


const extractList = (json: any): any[] => {
    if (!json) return [];
    if (Array.isArray(json)) return json;
    if (Array.isArray(json.results)) return json.results;
    if (Array.isArray(json.data)) return json.data;
    if (Array.isArray(json.items)) return json.items;
    return [];
};

const fetchJsonList = async (url: string): Promise<any[]> => {
    const res = await authenticatedFetch(url, {
        headers: { "ADMIN-KEY": ADMIN_KEY },
    });
    if (!res.ok) return [];
    const json = await res.json().catch(() => null);
    return extractList(json);
};

const resolveClassIdForStudent = async (studentId: number): Promise<number | null> => {
    const base = getApiBaseUrl();

    // Primary: detail endpoint — studentId is Uczen.id from the JWT uczen_id claim.
    // UczenSerializer: { id, user: {id, ...}, klasa: <int FK>, ... }
    try {
        const res = await authenticatedFetch(`${base}/api/uczniowie/${studentId}/`, {
            headers: { "ADMIN-KEY": ADMIN_KEY },
        });
        if (res.ok) {
            const json = await res.json().catch(() => null);
            if (json && !Array.isArray(json)) {
                const classId = Number(json.klasa ?? json.klasa_id ?? NaN);
                if (!Number.isNaN(classId)) return classId;
            }
        }
    } catch { /* fall through */ }

    // Fallback: fetch the list and find the matching student by Uczen.id or
    // nested User.id (handles the case where JWT uczen_id = User.id instead).
    try {
        const list = await fetchJsonList(`${base}/api/uczniowie/`);
        const match = list.find(
            (s: any) =>
                Number(s.id) === studentId ||
                Number(s.user?.id ?? s.user) === studentId
        );
        if (match) {
            const classId = Number(match.klasa ?? match.klasa_id ?? NaN);
            if (!Number.isNaN(classId)) return classId;
        }
    } catch { /* give up */ }

    return null;
};

const toDayIndex = (value: any): number | null => {
    const normalized = String(value ?? "").trim().toLowerCase();
    const numeric = Number(value);
    if (!Number.isNaN(numeric)) {
        if (numeric >= 1 && numeric <= 5) return numeric - 1;
        if (numeric >= 0 && numeric <= 4) return numeric;
    }
    if (normalized === "pn" || normalized.includes("ponied")) return 0;
    if (normalized === "wt" || normalized.includes("wtor")) return 1;
    if (normalized === "sr" || normalized.includes("śr") || normalized.includes("sro")) return 2;
    if (normalized === "czw" || normalized.includes("czwar")) return 3;
    if (normalized === "pt" || normalized.includes("piat") || normalized.includes("piąt")) return 4;
    return null;
};

const formatTimeRange = (from?: string, to?: string): string => {
    const left = (from ?? "").slice(0, 5);
    const right = (to ?? "").slice(0, 5);
    if (left && right) return `${left} - ${right}`;
    if (left) return left;
    if (right) return right;
    return "—";
};

const toDisplayName = (entity: any): string | null => {
    if (!entity) return null;
    const first = entity.first_name ?? entity.firstName ?? null;
    const last = entity.last_name ?? entity.lastName ?? null;
    if (first || last) return `${first ?? ""} ${last ?? ""}`.trim();
    return entity.username ?? entity.name ?? entity.nazwa ?? null;
};

export const getUserSchedule = async (userId: number, knownClassId?: number): Promise<ScheduleResponse> => {
    const base = getApiBaseUrl();
    let classId: number | null = knownClassId ?? null;
    if (!classId) classId = await resolveClassIdForStudent(userId);
    if (!classId) return { schedule: [] };

    // 1) Find schedule plans for this class only
    const plans = await fetchJsonList(`${base}/api/plany-zajec/?klasa_id=${classId}`);
    if (plans.length === 0) return { schedule: [] };

    // 2) Resolve dictionary endpoints for readable schedule entries
    const [
        weekDays,
        lessonHours,
        lessonsDictionary,
        teachersDictionary,
        subjectsDictionary,
        scheduleEntries,
    ] =
        await Promise.all([
        fetchJsonList(`${base}/api/dni-tygodnia/`),
        fetchJsonList(`${base}/api/godziny-lekcyjne/`),
        fetchJsonList(`${base}/api/zajecia/`),
        fetchJsonList(`${base}/api/nauczyciele/`),
        fetchJsonList(`${base}/api/przedmioty/`),
        Promise.all(
            plans.map((plan) =>
                fetchJsonList(
                    `${base}/api/plan-wpisy/?plan_id=${encodeURIComponent(
                        String(plan?.id ?? plan?.pk ?? "")
                    )}`
                )
            )
        ).then((chunks) => chunks.flat()),
    ]);

    const weekDayMap = new Map<number, number>();
    weekDays.forEach((d: any) => {
        const id = Number(d?.id ?? d?.pk ?? NaN);
        const idx = toDayIndex(d?.Numer ?? d?.numer ?? d?.name ?? d?.nazwa ?? d?.value);
        if (!Number.isNaN(id) && idx !== null) weekDayMap.set(id, idx);
    });

    const hourMap = new Map<number, { from?: string; to?: string; label?: string }>();
    lessonHours.forEach((h: any) => {
        const id = Number(h?.id ?? h?.pk ?? NaN);
        if (Number.isNaN(id)) return;
        hourMap.set(id, {
            from:
                h?.CzasOd ??
                h?.czas_od ??
                h?.godzina_od ??
                h?.od ??
                h?.start ??
                h?.start_time,
            to:
                h?.CzasDo ??
                h?.czas_do ??
                h?.godzina_do ??
                h?.do ??
                h?.end ??
                h?.end_time,
            label: h?.nazwa ?? h?.label,
        });
    });

    const subjectMap = new Map<number, string>();
    const teacherMap = new Map<number, string>();
    const lessonTeacherMap = new Map<number, string>();

    subjectsDictionary.forEach((subject: any) => {
        const id = Number(subject?.id ?? subject?.pk ?? NaN);
        if (Number.isNaN(id)) return;
        const name = subject?.nazwa ?? subject?.name ?? subject?.title;
        if (name) subjectMap.set(id, String(name));
    });

    // Build teacherMap (id -> display name) FIRST, so the lessonsDictionary
    // pass below can resolve names by id. Doing it the other way around
    // (the previous order) left lessonTeacherMap empty for almost every
    // lesson, which is exactly what surfaced as "Brak nauczyciela" on the UI.
    teachersDictionary.forEach((teacher: any) => {
        const id = Number(teacher?.id ?? teacher?.pk ?? NaN);
        if (Number.isNaN(id)) return;
        const name =
            toDisplayName(teacher?.user ?? teacher) ??
            teacher?.nazwa ??
            teacher?.name ??
            null;
        if (name) teacherMap.set(id, String(name));
    });

    // Helper that pulls a teacher id out of a record regardless of whether
    // the API exposes it as a flat *_id field or as a nested object.
    const extractTeacherId = (item: any): number | null => {
        const candidates = [
            item?.nauczyciel_id,
            item?.teacher_id,
            item?.prowadzacy_id,
            // these may be ids OR nested objects:
            typeof item?.nauczyciel === "object" ? item?.nauczyciel?.id : item?.nauczyciel,
            typeof item?.teacher === "object" ? item?.teacher?.id : item?.teacher,
            typeof item?.prowadzacy === "object" ? item?.prowadzacy?.id : item?.prowadzacy,
        ];
        for (const candidate of candidates) {
            const n = Number(candidate);
            if (!Number.isNaN(n) && n > 0) return n;
        }
        return null;
    };

    lessonsDictionary.forEach((item: any) => {
        const id = Number(item?.id ?? item?.pk ?? NaN);
        if (Number.isNaN(id)) return;
        const subjectId = Number(item?.przedmiot ?? item?.przedmiot_id ?? NaN);
        const subjectName =
            subjectMap.get(subjectId) ??
            item?.nazwa ??
            item?.name ??
            item?.przedmiot_nazwa ??
            item?.przedmiot?.nazwa ??
            item?.przedmiot?.name;
        if (subjectName) subjectMap.set(id, String(subjectName));

        const teacherId = extractTeacherId(item);
        if (teacherId !== null) {
            // If the zajecia row already nests a full teacher object, fold
            // it back into teacherMap so future lookups work too.
            const inlineName =
                toDisplayName(item?.nauczyciel?.user ?? item?.nauczyciel) ??
                toDisplayName(item?.teacher?.user ?? item?.teacher) ??
                toDisplayName(item?.prowadzacy?.user ?? item?.prowadzacy) ??
                null;
            if (inlineName && !teacherMap.has(teacherId)) {
                teacherMap.set(teacherId, String(inlineName));
            }
            const resolvedName = teacherMap.get(teacherId);
            if (resolvedName) lessonTeacherMap.set(id, resolvedName);
        }
    });

    const grouped: Record<number, Lesson[]> = { 0: [], 1: [], 2: [], 3: [], 4: [] };
    const seenEntryIds = new Set<number>();

    scheduleEntries.forEach((entry: any) => {
        // Deduplicate — multiple plans for the same class may share wpisy.
        const entryId = Number(entry?.id ?? entry?.pk ?? NaN);
        if (!Number.isNaN(entryId)) {
            if (seenEntryIds.has(entryId)) return;
            seenEntryIds.add(entryId);
        }

        // klasa_id is a SerializerMethodField on PlanWpisSerializer derived from
        // the entry's parent plan — use it as a secondary class guard.
        const rowClassId = Number(entry?.klasa_id ?? entry?.klasa ?? NaN);
        if (!Number.isNaN(rowClassId) && rowClassId !== classId) return;

        const dayRef = Number(entry?.dzien_tygodnia ?? entry?.dzien ?? NaN);
        const explicitDay = toDayIndex(entry?.dzien_numer ?? entry?.day ?? entry?.day_index);
        const dayIndex = explicitDay ?? weekDayMap.get(dayRef) ?? null;
        if (dayIndex === null || dayIndex < 0 || dayIndex > 4) return;

        const hourRef = Number(entry?.godzina_lekcyjna ?? entry?.godzina_lekcyjna_id ?? NaN);
        const hourInfo = hourMap.get(hourRef);
        const zajeciaRef = Number(entry?.zajecia ?? entry?.zajecia_id ?? NaN);
        const teacherRef = Number(
            entry?.nauczyciel_id ?? entry?.nauczyciel ?? entry?.teacher_id ?? entry?.teacher ?? NaN
        );

        const subject =
            subjectMap.get(zajeciaRef) ??
            entry?.zajecia_nazwa ??
            entry?.przedmiot_nazwa ??
            entry?.zajecia?.nazwa ??
            entry?.zajecia?.name ??
            entry?.subject ??
            "Brak nazwy przedmiotu";
        const room = entry?.sala ?? entry?.room ?? "Sala";
        const originalTeacher =
            lessonTeacherMap.get(zajeciaRef) ??
            teacherMap.get(teacherRef) ??
            entry?.nauczyciel_nazwa ??
            toDisplayName(entry?.nauczyciel) ??
            entry?.nauczyciel ??
            entry?.teacher ??
            entry?.prowadzacy ??
            "Brak nauczyciela";

        // Substitution: backend may carry the substitute teacher under any
        // of these field names. We look both for an id (resolved through
        // teacherMap) and for an inline name string.
        const substituteCandidates: any[] = [
            entry?.zastepstwo,
            entry?.zastapstwo,
            entry?.nauczyciel_zastepujacy,
            entry?.nauczyciel_zastepca,
            entry?.zastepca,
            entry?.zastepca_id,
            entry?.substitute_teacher,
            entry?.substitute_teacher_id,
        ];
        let substituteName: string | undefined;
        for (const candidate of substituteCandidates) {
            if (candidate == null || candidate === "") continue;
            if (typeof candidate === "object") {
                const fromObj =
                    toDisplayName(candidate?.user ?? candidate) ??
                    candidate?.nazwa ??
                    null;
                if (candidate?.id != null) {
                    substituteName =
                        teacherMap.get(Number(candidate.id)) ??
                        fromObj ??
                        undefined;
                } else if (fromObj) {
                    substituteName = fromObj;
                }
            } else if (typeof candidate === "number") {
                substituteName = teacherMap.get(candidate) ?? substituteName;
            } else if (typeof candidate === "string") {
                const asNum = Number(candidate);
                if (!Number.isNaN(asNum) && asNum > 0) {
                    substituteName = teacherMap.get(asNum) ?? substituteName;
                } else {
                    substituteName = candidate;
                }
            }
            if (substituteName) break;
        }

        const isSubstitute = Boolean(substituteName);
        const teacher = isSubstitute
            ? String(substituteName)
            : String(originalTeacher);

        grouped[dayIndex].push({
            id: Number.isNaN(entryId) ? Math.floor(Math.random() * 1_000_000_000) : entryId,
            subject: String(subject),
            time: formatTimeRange(hourInfo?.from, hourInfo?.to) || hourInfo?.label || "—",
            room: String(room),
            teacher,
            originalTeacher: isSubstitute ? String(originalTeacher) : undefined,
            substituteTeacher: isSubstitute ? String(substituteName) : undefined,
            isSubstitute: isSubstitute || undefined,
        });
    });

    const schedule: DaySchedule[] = [0, 1, 2, 3, 4].map((dayIndex) => ({
        dayIndex,
        lessons: grouped[dayIndex] ?? [],
    }));

    return { schedule };
};

export default function ScheduleApiRoute() {
    return null;
}