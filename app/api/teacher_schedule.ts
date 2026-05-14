import { authenticatedFetch, getApiBaseUrl } from "./auth";
import { ADMIN_KEY } from "./constants";
import { getClasses, getSubjects, getTeacherProfile } from "./teacher";

export type TeacherLesson = {
    id: number;
    dayIndex: number; // 0=Mon … 4=Fri
    lessonNumber: number;
    timeFrom: string; // "HH:MM"
    timeTo: string;
    subject: string;
    room: string;
    classes: string[];
};

export type EventKind = "sprawdzian" | "kartkowka" | "praca_domowa" | "wydarzenie";

export type CreateEventPayload = {
    tytul: string;
    opis: string;
    data: string; // "YYYY-MM-DD"
    calodobowe: boolean;
    godzina_od?: string;
    godzina_do?: string;
    klasa?: number;
    przedmiot?: number;
};

export type WydarzenieEntry = {
    id: number;
    tytul: string;
    opis: string;
    data: string;
    calodobowe: boolean;
    godzina_od?: string | null;
    godzina_do?: string | null;
    klasa?: number | null;
    przedmiot?: number | null;
};

const hdrs = () => ({
    "ADMIN-KEY": ADMIN_KEY,
    "Content-Type": "application/json",
});

const jsonList = async (res: Response): Promise<any[]> => {
    if (!res.ok) return [];
    const d = await res.json().catch(() => []);
    return Array.isArray(d) ? d : (d.results ?? []);
};

export const getTeacherSchedule = async (): Promise<TeacherLesson[]> => {
    try {
        const profile = await getTeacherProfile();
        if (!profile) return [];

        // Fetch all needed data in parallel.
        // PlanWpisSerializer (fields="__all__") returns FK fields as plain integer IDs,
        // so we resolve day/hour/subject/class from separate lookup endpoints.
        const [planRes, dniRes, godzinyRes, zajeciaRes, subjects, classes] = await Promise.all([
            authenticatedFetch(
                `${getApiBaseUrl()}/api/plan-wpisy/?nauczyciel_id=${profile.id}`,
                { headers: hdrs() }
            ),
            authenticatedFetch(`${getApiBaseUrl()}/api/dni-tygodnia/`, { headers: hdrs() }),
            authenticatedFetch(`${getApiBaseUrl()}/api/godziny-lekcyjne/`, { headers: hdrs() }),
            authenticatedFetch(`${getApiBaseUrl()}/api/zajecia/`, { headers: hdrs() }),
            getSubjects(),
            getClasses(),
        ]);

        if (!planRes.ok) return [];

        const [planList, dniList, godzinyList, zajeciaList] = await Promise.all([
            jsonList(planRes),
            jsonList(dniRes),
            jsonList(godzinyRes),
            jsonList(zajeciaRes),
        ]);

        // DniTygodnia: id → Numer (1=Mon … 5=Fri)
        const dniMap = new Map<number, number>();
        for (const d of dniList) {
            dniMap.set(Number(d.id), Number(d.Numer ?? d.numer ?? d.id));
        }

        // GodzinyLekcyjne: id → { lessonNumber, timeFrom, timeTo }
        const godzMap = new Map<number, { numer: number; from: string; to: string }>();
        for (const g of godzinyList) {
            godzMap.set(Number(g.id), {
                numer: Number(g.Numer ?? g.numer ?? 0),
                from: String(g.CzasOd ?? g.czas_od ?? "").slice(0, 5),
                to: String(g.CzasDo ?? g.czas_do ?? "").slice(0, 5),
            });
        }

        // Zajecia: id → przedmiot FK id (for subject name lookup)
        const zajeciaMap = new Map<number, number>();
        for (const z of zajeciaList) {
            const pid = Number(z.przedmiot ?? 0);
            if (pid) zajeciaMap.set(Number(z.id), pid);
        }

        const subjectMap = new Map(subjects.map((s) => [s.id, s.nazwa]));
        const classMap = new Map(classes.map((c) => [c.id, c.nazwa]));

        return planList
            .map((item: any): TeacherLesson => {
                const dzienId = Number(item.dzien_tygodnia);
                const godzId = Number(item.godzina_lekcyjna);
                const zajecId = Number(item.zajecia);
                // klasa_id is a SerializerMethodField on PlanWpisSerializer
                const klasaId = item.klasa_id != null ? Number(item.klasa_id) : null;

                const numer = dniMap.get(dzienId) ?? dzienId;
                const dayIndex = numer >= 1 && numer <= 5 ? numer - 1 : 0;

                const godz = godzMap.get(godzId) ?? { numer: 0, from: "", to: "" };

                const przedmiotId = zajeciaMap.get(zajecId);
                const subjectName = przedmiotId
                    ? (subjectMap.get(przedmiotId) ?? "Lekcja")
                    : "Lekcja";

                const lessonClasses: string[] = [];
                if (klasaId != null) {
                    const klass = classMap.get(klasaId);
                    if (klass) lessonClasses.push(klass);
                }

                return {
                    id: Number(item.id ?? NaN),
                    dayIndex,
                    lessonNumber: godz.numer,
                    timeFrom: godz.from,
                    timeTo: godz.to,
                    subject: subjectName,
                    room: String(item.sala ?? "—"),
                    classes: lessonClasses,
                };
            })
            .sort((a, b) => a.lessonNumber - b.lessonNumber);
    } catch {
        return [];
    }
};

export const getEvents = async (): Promise<WydarzenieEntry[]> => {
    try {
        const res = await authenticatedFetch(`${getApiBaseUrl()}/api/wydarzenia/`, { headers: hdrs() });
        if (!res.ok) return [];
        const d = await res.json().catch(() => []);
        return Array.isArray(d) ? d : (d.results ?? []);
    } catch {
        return [];
    }
};

export const createEvent = async (payload: CreateEventPayload): Promise<boolean> => {
    try {
        const res = await authenticatedFetch(`${getApiBaseUrl()}/api/wydarzenia/`, {
            method: "POST",
            headers: hdrs(),
            body: JSON.stringify(payload),
        });
        return res.ok || res.status === 201;
    } catch {
        return false;
    }
};

export const updateEvent = async (id: number, payload: CreateEventPayload): Promise<boolean> => {
    try {
        const res = await authenticatedFetch(`${getApiBaseUrl()}/api/wydarzenia/${id}/`, {
            method: "PATCH",
            headers: hdrs(),
            body: JSON.stringify(payload),
        });
        return res.ok;
    } catch {
        return false;
    }
};

export const deleteEvent = async (id: number): Promise<boolean> => {
    try {
        const res = await authenticatedFetch(`${getApiBaseUrl()}/api/wydarzenia/${id}/`, {
            method: "DELETE",
            headers: hdrs(),
        });
        return res.ok || res.status === 204;
    } catch {
        return false;
    }
};

export default function TeacherScheduleApiRoute() {
    return null;
}
