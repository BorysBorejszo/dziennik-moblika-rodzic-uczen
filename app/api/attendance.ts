import { authenticatedFetch, getApiBaseUrl } from "./auth";
import { ADMIN_KEY } from "./constants";

export type AttendanceStatus = {
    id: number;
    wartosc: string;
};

export type AttendanceRecord = {
    id: number;
    data: string;
    uczen_id: number;
    status_id?: number | null;
    godzina_lekcyjna_id?: number | null;
    status?: string;
    przedmiot?: string;
    nauczyciel?: string;
};

export type AttendanceEntry = {
    id?: number;
    date: string;
    subject: string;
    status: string;
};

export type AttendanceResponse = { recent: AttendanceEntry[] };


const extractList = (json: any) => {
    if (!json) return [];
    if (Array.isArray(json)) return json;
    if (Array.isArray(json.results)) return json.results;
    if (Array.isArray(json.data)) return json.data;
    if (Array.isArray(json.items)) return json.items;
    return [];
};

const getStatusNameFromRecord = (item: any): string | null => {
    const raw =
        item?.status_nazwa ??
        item?.status_name ??
        item?.wartosc_statusu ??
        item?.status?.Wartosc ??
        item?.status?.wartosc ??
        item?.status?.name ??
        item?.status?.value;
    if (!raw) return null;
    return String(raw);
};

const getStatusIdFromRecord = (item: any): number | null => {
    const raw =
        item?.status_id ??
        item?.statusId ??
        item?.status ??
        item?.status?.id ??
        item?.status?.pk;
    const num = Number(raw);
    return Number.isNaN(num) ? null : num;
};

const getStudentIdFromRecord = (item: any): number | null => {
    const raw =
        item?.uczen_id ??
        item?.uczenId ??
        item?.uczen ??
        item?.student_id ??
        item?.studentId ??
        item?.uczen?.id ??
        item?.uczen?.pk;
    const num = Number(raw);
    return Number.isNaN(num) ? null : num;
};

const toIsoDate = (value: any) => {
    const date = new Date(value ?? "");
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString();
};

const mapStatusName = (
    statusId: number | null,
    statusLabel: string | null,
    statusesMap: Map<number, string>
) => {
    if (statusLabel && statusLabel.trim()) return statusLabel;
    if (statusId !== null && statusesMap.has(statusId)) {
        return statusesMap.get(statusId) as string;
    }
    return "Nieobecny";
};

const mapApiRecord = (item: any, statusesMap: Map<number, string>): AttendanceRecord => {
    const statusId = getStatusIdFromRecord(item);
    const statusLabel = getStatusNameFromRecord(item);
    const studentId = getStudentIdFromRecord(item) ?? -1;

    return {
        id: Number(item?.id ?? item?.pk ?? -1),
        data: toIsoDate(item?.Data ?? item?.data ?? item?.date),
        uczen_id: studentId,
        status_id: statusId,
        godzina_lekcyjna_id: Number(
            item?.godzina_lekcyjna_id ??
                item?.godzina_lekcyjna ??
                item?.lesson_hour_id ??
                item?.lesson_hour ??
                item?.godzina_lekcyjna?.id ??
                item?.godzina_lekcyjna?.pk ??
                0
        ) || null,
        status: mapStatusName(statusId, statusLabel, statusesMap),
        // We deliberately leave przedmiot undefined when the API doesn't
        // return a subject name on the record itself. The real name is
        // resolved later via the godzina_lekcyjna -> plan-wpisy -> zajecia
        // -> przedmioty chain (see resolveSubjectName below).
        przedmiot:
            item?.przedmiot ??
            item?.subject ??
            item?.nazwa_przedmiotu ??
            item?.lesson?.subject ??
            undefined,
        nauczyciel:
            item?.nauczyciel ??
            item?.teacher ??
            item?.nauczyciel_nazwa ??
            item?.lesson?.teacher ??
            undefined,
    };
};

// ---------------------------------------------------------------------------
// Subject name resolution
// ---------------------------------------------------------------------------
// /api/frekwencja/ returns only godzina_lekcyjna (a lesson-hour id) and not
// a subject name. To turn that id into a human-readable subject we walk:
//
//   godzina_lekcyjna  --(plan-wpisy)-->  zajecia  --(zajecia)-->  przedmiot
//   przedmiot         --(przedmioty)-->  nazwa
//
// Because plan-wpisy / zajecia / przedmioty change rarely we fetch each list
// once per session and cache the resulting lookup tables for a few minutes.
// ---------------------------------------------------------------------------

type SubjectResolutionMaps = {
    przedmiotyById: Map<number, string>;
    zajeciaById: Map<number, number>;
    planByLessonHourDay: Map<string, number>;
    planByLessonHour: Map<number, number>;
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

const SUBJECT_MAPS_TTL_MS = 5 * 60 * 1000;
let cachedSubjectMaps: {
    maps: SubjectResolutionMaps;
    expires: number;
} | null = null;

const buildSubjectResolutionMaps = async (): Promise<SubjectResolutionMaps> => {
    const [przedmiotyList, zajeciaList, planList] = await Promise.all([
        fetchListAuthenticated("/api/przedmioty/"),
        fetchListAuthenticated("/api/zajecia/"),
        fetchListAuthenticated("/api/plan-wpisy/"),
    ]);

    const przedmiotyById = new Map<number, string>();
    for (const item of przedmiotyList) {
        const id = Number(item?.id ?? item?.pk ?? NaN);
        const name =
            item?.nazwa ??
            item?.name ??
            item?.nazwa_skrocona ??
            null;
        if (!Number.isNaN(id) && name) {
            przedmiotyById.set(id, String(name));
        }
    }

    const zajeciaById = new Map<number, number>();
    for (const item of zajeciaList) {
        const id = Number(item?.id ?? item?.pk ?? NaN);
        const przedmiotId = Number(
            item?.przedmiot ??
                item?.przedmiot_id ??
                item?.subject ??
                item?.subject_id ??
                item?.przedmiot?.id ??
                NaN
        );
        if (!Number.isNaN(id) && !Number.isNaN(przedmiotId)) {
            zajeciaById.set(id, przedmiotId);
        }
    }

    const planByLessonHourDay = new Map<string, number>();
    const planByLessonHour = new Map<number, number>();
    for (const item of planList) {
        const ghId = Number(
            item?.godzina_lekcyjna ??
                item?.godzina_lekcyjna_id ??
                item?.lesson_hour ??
                item?.godzina_lekcyjna?.id ??
                NaN
        );
        const day = Number(
            item?.dzien_tygodnia ?? item?.dzien ?? item?.day_of_week ?? NaN
        );
        const zajeciaId = Number(
            item?.zajecia ??
                item?.zajecia_id ??
                item?.lesson ??
                item?.zajecia?.id ??
                NaN
        );
        if (Number.isNaN(ghId) || Number.isNaN(zajeciaId)) continue;
        if (!Number.isNaN(day)) {
            planByLessonHourDay.set(`${ghId}|${day}`, zajeciaId);
        }
        if (!planByLessonHour.has(ghId)) {
            planByLessonHour.set(ghId, zajeciaId);
        }
    }

    return {
        przedmiotyById,
        zajeciaById,
        planByLessonHourDay,
        planByLessonHour,
    };
};

const getSubjectResolutionMaps = async (): Promise<SubjectResolutionMaps> => {
    const now = Date.now();
    if (cachedSubjectMaps && cachedSubjectMaps.expires > now) {
        return cachedSubjectMaps.maps;
    }
    const maps = await buildSubjectResolutionMaps();
    cachedSubjectMaps = { maps, expires: now + SUBJECT_MAPS_TTL_MS };
    return maps;
};

const resolveSubjectName = (
    record: AttendanceRecord,
    maps: SubjectResolutionMaps
): string | null => {
    const ghId = record.godzina_lekcyjna_id;
    if (!ghId) return null;

    // Try several day-of-week conventions because different backends use
    // different formats (ISO Mon=1, JS Sun=0, or Mon=0).
    const dayCandidates: number[] = [];
    if (record.data) {
        const d = new Date(record.data);
        if (!Number.isNaN(d.getTime())) {
            const js = d.getDay(); // Sun=0..Sat=6
            const isoMon1 = js === 0 ? 7 : js; // Mon=1..Sun=7
            const isoMon0 = isoMon1 - 1; // Mon=0..Sun=6
            dayCandidates.push(isoMon1, js, isoMon0);
        }
    }

    let zajeciaId: number | undefined;
    for (const day of dayCandidates) {
        const found = maps.planByLessonHourDay.get(`${ghId}|${day}`);
        if (found != null) {
            zajeciaId = found;
            break;
        }
    }
    if (zajeciaId == null) {
        // Fallback: any zajecia that uses this lesson hour. Less precise but
        // still better than returning the literal "Lekcja".
        zajeciaId = maps.planByLessonHour.get(ghId);
    }
    if (zajeciaId == null) return null;

    const przedmiotId = maps.zajeciaById.get(zajeciaId);
    if (przedmiotId == null) return null;

    return maps.przedmiotyById.get(przedmiotId) ?? null;
};

const loadStatusesMap = async (): Promise<Map<number, string>> => {
    const map = new Map<number, string>();
    const url = `${getApiBaseUrl()}/api/statusy/`;
    try {
        const res = await authenticatedFetch(url, {
            headers: { "ADMIN-KEY": ADMIN_KEY },
        });
        if (!res.ok) return map;
        const json = await res.json().catch(() => null);
        const list = extractList(json);
        list.forEach((row: any) => {
            const id = Number(row?.id ?? row?.pk ?? NaN);
            const name = row?.Wartosc ?? row?.wartosc ?? row?.name ?? row?.value;
            if (!Number.isNaN(id) && name) map.set(id, String(name));
        });
    } catch {
        // optional dictionary endpoint - keep empty map on failures
    }
    return map;
};

export const getAllAttendance = async (): Promise<AttendanceRecord[]> => {
    const url = `${getApiBaseUrl()}/api/frekwencja/`;
    const statusesMap = await loadStatusesMap();
    const res = await authenticatedFetch(url, {
        headers: { "ADMIN-KEY": ADMIN_KEY },
    });
    if (!res.ok) throw new Error(`Attendance fetch failed: ${res.status}`);
    const json = await res.json().catch(() => null);
    return extractList(json).map((item: any) => mapApiRecord(item, statusesMap));
};

export const getAttendanceByStudent = async (
    uczenId: number
): Promise<AttendanceRecord[]> => {
    return getAttendance(uczenId);
};

export const getAttendanceByDate = async (
    date: string,
    uczenID: number
): Promise<AttendanceRecord[]> => {
    return getAttendance(uczenID, date, date);
};

export const getAttendanceById = async (
    id: number
): Promise<AttendanceRecord | null> => {
    const statusesMap = await loadStatusesMap();
    const url = `${getApiBaseUrl()}/api/frekwencja/${id}/`;
    try {
        const res = await authenticatedFetch(url, {
            headers: { "ADMIN-KEY": ADMIN_KEY },
        });
        if (!res.ok) return null;
        const json = await res.json().catch(() => null);
        if (!json) return null;
        const record = mapApiRecord(json, statusesMap);
        // Same subject-name resolution as getUserAttendance so the details
        // modal also shows a real subject instead of "Lekcja".
        if (!record.przedmiot) {
            try {
                const maps = await getSubjectResolutionMaps();
                const resolved = resolveSubjectName(record, maps);
                if (resolved) record.przedmiot = resolved;
            } catch {
                // ignore — fall back to undefined / consumer default
            }
        }
        return record;
    } catch {
        return null;
    }
};

export const createAttendance = async (
    payload: Record<string, any>
): Promise<AttendanceRecord | null> => {
    const statusesMap = await loadStatusesMap();
    const url = `${getApiBaseUrl()}/api/frekwencja/`;
    const res = await authenticatedFetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "ADMIN-KEY": ADMIN_KEY,
        },
        body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    const json = await res.json().catch(() => null);
    if (!json) return null;
    return mapApiRecord(json, statusesMap);
};

export const updateAttendance = async (
    id: number,
    payload: Record<string, any>
): Promise<AttendanceRecord | null> => {
    const statusesMap = await loadStatusesMap();
    const url = `${getApiBaseUrl()}/api/frekwencja/${id}/`;
    const res = await authenticatedFetch(url, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            "ADMIN-KEY": ADMIN_KEY,
        },
        body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    const json = await res.json().catch(() => null);
    if (!json) return null;
    return mapApiRecord(json, statusesMap);
};

export const deleteAttendance = async (id: number): Promise<boolean> => {
    const url = `${getApiBaseUrl()}/api/frekwencja/${id}/`;
    const res = await authenticatedFetch(url, {
        method: "DELETE",
        headers: { "ADMIN-KEY": ADMIN_KEY },
    });
    return res.ok;
};

export const getAttendance = async (
    studentId: number,
    dateFrom?: string,
    dateTo?: string
): Promise<AttendanceRecord[]> => {
    const statusesMap = await loadStatusesMap();
    const params = new URLSearchParams();
    params.set("uczen", String(studentId));
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);

    const candidateUrls = [
        `${getApiBaseUrl()}/api/frekwencja/?${params.toString()}`,
        `${getApiBaseUrl()}/api/frekwencja/?uczen=${studentId}${
            dateFrom ? `&date_from=${encodeURIComponent(dateFrom)}` : ""
        }${dateTo ? `&date_to=${encodeURIComponent(dateTo)}` : ""}`,
    ];

    let list: any[] = [];
    for (const url of candidateUrls) {
        try {
            const res = await authenticatedFetch(url, {
                headers: { "ADMIN-KEY": ADMIN_KEY },
            });
            if (!res.ok) continue;
            const json = await res.json().catch(() => null);
            list = extractList(json);
            if (list.length > 0) break;
        } catch {
            continue;
        }
    }

    // Hard filter to the current user only; protects against backends that
    // ignore query params and return global attendance lists.
    return list
        .map((item) => mapApiRecord(item, statusesMap))
        .filter((record) => Number(record.uczen_id) === Number(studentId));
};

export const getUserAttendance = async (
    userId: number
): Promise<AttendanceResponse> => {
    const records = await getAttendance(userId);

    // Resolve subject names for any record whose API payload didn't include
    // one. Maps are cached so this is one batch of fetches per session.
    let subjectMaps: SubjectResolutionMaps | null = null;
    if (records.some((record) => !record.przedmiot)) {
        try {
            subjectMaps = await getSubjectResolutionMaps();
        } catch {
            subjectMaps = null;
        }
    }

    const recent = records.map((record) => {
        const fromRecord = record.przedmiot && record.przedmiot.trim();
        const fromChain =
            !fromRecord && subjectMaps
                ? resolveSubjectName(record, subjectMaps)
                : null;
        const subject = fromRecord || fromChain || "Lekcja";

        return {
            id: record.id,
            date: record.data,
            subject,
            status: record.status || "Nieobecny",
        };
    });
    return { recent };
};

export default function AttendanceApiRoute() {
    return null;
}

