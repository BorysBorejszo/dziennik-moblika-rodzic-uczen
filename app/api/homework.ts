import AsyncStorage from "@react-native-async-storage/async-storage";
import { authenticatedFetch, getApiBaseUrl } from "./auth";
import { ADMIN_KEY } from "./constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HomeworkItem = {
    id: number;
    classId: number | null;
    subjectId: number | null;
    subject: string;
    teacherId: number | null;
    teacher: string | null;
    description: string;
    /** ISO date (YYYY-MM-DD) when the homework is due. */
    due: string;
    /** ISO datetime when the homework was issued. */
    issued: string;
    /** Local-only flag, derived from AsyncStorage by the consumer. */
    completed?: boolean;
};


// ---------------------------------------------------------------------------
// Network helpers
// ---------------------------------------------------------------------------

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
    } catch (error) {
        console.warn(`[homework] fetch ${path} failed:`, error);
        return [];
    }
};

const toDisplayName = (entity: any): string | null => {
    if (!entity) return null;
    const first = entity.first_name ?? entity.firstName ?? null;
    const last = entity.last_name ?? entity.lastName ?? null;
    if (first || last) return `${first ?? ""} ${last ?? ""}`.trim();
    return entity.username ?? entity.name ?? entity.nazwa ?? null;
};

// ---------------------------------------------------------------------------
// Fetch homework with resolved subject and teacher names
// ---------------------------------------------------------------------------

export const getHomeworkForClass = async (
    classId?: number | null
): Promise<HomeworkItem[]> => {
    const path =
        classId && classId > 0
            ? `/api/prace-domowe/?klasa=${classId}`
            : `/api/prace-domowe/`;

    const [rawHomework, subjects, teachers] = await Promise.all([
        fetchListAuthenticated(path),
        fetchListAuthenticated("/api/przedmioty/"),
        fetchListAuthenticated("/api/nauczyciele/"),
    ]);

    const subjectsById = new Map<number, string>();
    for (const s of subjects) {
        const id = Number(s?.id ?? s?.pk ?? NaN);
        const nazwa = s?.nazwa ?? s?.name ?? s?.nazwa_skrocona;
        if (!Number.isNaN(id) && nazwa) {
            subjectsById.set(id, String(nazwa));
        }
    }

    const teachersById = new Map<number, string>();
    for (const t of teachers) {
        const id = Number(t?.id ?? t?.pk ?? NaN);
        const name =
            toDisplayName(t?.user ?? t) ?? t?.nazwa ?? t?.name ?? null;
        if (!Number.isNaN(id) && name) {
            teachersById.set(id, String(name));
        }
    }

    return rawHomework
        .map((row: any): HomeworkItem | null => {
            const id = Number(row?.id ?? row?.pk ?? NaN);
            if (Number.isNaN(id)) return null;

            const klasaId = Number(row?.klasa ?? row?.klasa_id ?? NaN);
            const przedmiotId = Number(
                row?.przedmiot ?? row?.przedmiot_id ?? NaN
            );
            const teacherId = Number(
                row?.nauczyciel ?? row?.nauczyciel_id ?? NaN
            );

            const subject =
                subjectsById.get(przedmiotId) ??
                row?.przedmiot_nazwa ??
                row?.przedmiot?.nazwa ??
                "Przedmiot";

            const teacher =
                teachersById.get(teacherId) ??
                row?.nauczyciel_nazwa ??
                toDisplayName(row?.nauczyciel) ??
                null;

            return {
                id,
                classId: Number.isNaN(klasaId) ? null : klasaId,
                subjectId: Number.isNaN(przedmiotId) ? null : przedmiotId,
                subject: String(subject),
                teacherId: Number.isNaN(teacherId) ? null : teacherId,
                teacher: teacher ? String(teacher) : null,
                description: String(row?.opis ?? row?.description ?? ""),
                due: String(row?.termin ?? row?.due ?? ""),
                issued: String(
                    row?.data_wystawienia ?? row?.issued_at ?? row?.data ?? ""
                ),
            };
        })
        .filter((x): x is HomeworkItem => x !== null);
};

// ---------------------------------------------------------------------------
// "Done" persistence (the API doesn't track completion, so it's local-only)
// ---------------------------------------------------------------------------

const COMPLETED_STORAGE_KEY = "@e-dziennik:homework-done";

export const getCompletedHomeworkIds = async (): Promise<Set<number>> => {
    try {
        const raw = await AsyncStorage.getItem(COMPLETED_STORAGE_KEY);
        if (!raw) return new Set();
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return new Set();
        return new Set(
            parsed.filter((x: unknown) => typeof x === "number") as number[]
        );
    } catch {
        return new Set();
    }
};

export const setHomeworkCompleted = async (
    id: number,
    done: boolean
): Promise<Set<number>> => {
    const current = await getCompletedHomeworkIds();
    if (done) current.add(id);
    else current.delete(id);
    try {
        await AsyncStorage.setItem(
            COMPLETED_STORAGE_KEY,
            JSON.stringify(Array.from(current))
        );
    } catch {
        // best effort — swallow
    }
    return current;
};

// ---------------------------------------------------------------------------
// Submissions (Zgłoszenia)
// ---------------------------------------------------------------------------

export type Submission = {
    id: number;
    homework: number;
    uczen: number;
    tresc: string;
    zalacznik?: number | null;
    data_oddania: string;
    status: "oddane" | "sprawdzone" | "odrzucone";
    ocena?: string | null;
    komentarz?: string | null;
};

export const getMySubmissions = async (): Promise<Submission[]> => {
    try {
        const res = await authenticatedFetch(
            `${getApiBaseUrl()}/api/zgloszenia/`,
            { headers: { "ADMIN-KEY": ADMIN_KEY } }
        );
        if (!res.ok) return [];
        const json = await res.json().catch(() => null);
        const list = Array.isArray(json) ? json
            : Array.isArray(json?.results) ? json.results
            : [];
        return list.map((r: any): Submission => ({
            id: Number(r.id),
            homework: Number(r.homework),
            uczen: Number(r.uczen),
            tresc: String(r.tresc ?? ""),
            zalacznik: r.zalacznik ?? null,
            data_oddania: String(r.data_oddania ?? ""),
            status: r.status ?? "oddane",
            ocena: r.ocena ?? null,
            komentarz: r.komentarz ?? null,
        }));
    } catch {
        return [];
    }
};

export const uploadAttachment = async (file: {
    uri: string;
    name: string;
    mimeType?: string;
}): Promise<number | null> => {
    try {
        const form = new FormData();
        form.append("plik", {
            uri: file.uri,
            name: file.name,
            type: file.mimeType ?? "application/octet-stream",
        } as any);
        const res = await authenticatedFetch(`${getApiBaseUrl()}/api/upload/`, {
            method: "POST",
            headers: { "ADMIN-KEY": ADMIN_KEY },
            body: form,
        });
        if (!res.ok) return null;
        const json = await res.json().catch(() => null);
        return json?.id ? Number(json.id) : null;
    } catch {
        return null;
    }
};

export const submitHomework = async (payload: {
    homework: number;
    tresc: string;
    komentarz?: string;
    file?: { uri: string; name: string; mimeType?: string } | null;
}): Promise<Submission | null> => {
    try {
        const form = new FormData();
        form.append("homework", String(payload.homework));
        form.append("tresc", payload.tresc);
        if (payload.komentarz?.trim()) form.append("komentarz", payload.komentarz.trim());
        if (payload.file) {
            form.append("zalacznik", {
                uri: payload.file.uri,
                name: payload.file.name,
                type: payload.file.mimeType ?? "application/octet-stream",
            } as any);
        }

        const res = await authenticatedFetch(`${getApiBaseUrl()}/api/zgloszenia/`, {
            method: "POST",
            headers: { "ADMIN-KEY": ADMIN_KEY },
            body: form,
        });
        if (!res.ok) return null;
        const json = await res.json().catch(() => null);
        if (!json?.id) return null;
        return {
            id: Number(json.id),
            homework: Number(json.homework),
            uczen: Number(json.uczen),
            tresc: String(json.tresc ?? ""),
            zalacznik: json.zalacznik ?? null,
            data_oddania: String(json.data_oddania ?? ""),
            status: json.status ?? "oddane",
            ocena: json.ocena ?? null,
            komentarz: json.komentarz ?? null,
        };
    } catch {
        return null;
    }
};

export default function HomeworkApiRoute() {
    return null;
}
