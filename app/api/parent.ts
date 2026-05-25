import { authenticatedFetch, decodeJWT, getAccessToken, getApiBaseUrl } from "./auth";
import { ADMIN_KEY } from "./constants";

export type ParentChild = {
  id: number;
  first_name: string;
  last_name: string;
  class_name: string | null;
  class_id: number | null;
};

export type ParentGrade = {
  id: number;
  wartosc: string;
  waga: number;
  opis?: string;
  data_wystawienia?: string;
  czy_do_sredniej: boolean;
};

export type ParentPeriodGrade = {
  id: number;
  wartosc: string;
  okres: 1 | 2;
};

export type ParentSubjectGrades = {
  subject_id: number;
  subject_name: string;
  average: string | null;
  predicted: string | null;
  final: string | null;
  period: ParentPeriodGrade[];
  grades: ParentGrade[];
};

export type ParentAttendanceEntry = {
  id: number;
  data: string;
  status: string | null;
  godzina_lekcyjna: number | null;
};

export type ParentBehaviorPoint = {
  id: number;
  punkty: number;
  opis?: string;
  data_wpisu: string;
  teacher_name: string | null;
};

export type ParentExcuse = {
  id: number;
  student_id: number;
  student_name: string;
  status: string;
  powod: string;
  komentarz_rozpatrujacego?: string;
  rozpatrzone_at?: string;
  utworzone_at: string;
  items: Array<{ data: string; godzina_lekcyjna?: number | null; frekwencja?: number | null }>;
};

export type ParentHomework = {
  id: number;
  tytul: string;
  opis?: string;
  termin?: string;
  data_wystawienia?: string;
  klasa?: number;
  przedmiot?: number;
  nauczyciel?: number;
};

const jsonList = async (res: Response): Promise<any[]> => {
  if (!res.ok) return [];
  const d = await res.json().catch(() => []);
  return Array.isArray(d) ? d : (d.results ?? []);
};

export const getParentChildren = async (): Promise<ParentChild[]> => {
  try {
    const res = await authenticatedFetch(`${getApiBaseUrl()}/api/parent/students/`);
    const list = (await jsonList(res)) as ParentChild[];
    if (list.length > 0) return list;

    // Fallback: use dzieci_ids embedded in JWT + fetch each student individually.
    // Handles cases where the Rodzic model/endpoint is missing but children IDs are known.
    const access = await getAccessToken();
    if (!access) return [];
    const payload = decodeJWT(access);
    const dzieciIds: number[] = Array.isArray(payload?.dzieci_ids) ? payload.dzieci_ids : [];
    if (!dzieciIds.length) return [];

    const children = await Promise.all(
      dzieciIds.map(async (id: number) => {
        try {
          const r = await authenticatedFetch(`${getApiBaseUrl()}/api/uczniowie/${id}/`);
          if (!r.ok) return null;
          const u = await r.json().catch(() => null);
          if (!u) return null;
          return {
            id: u.id as number,
            first_name: (u.user?.first_name ?? "") as string,
            last_name: (u.user?.last_name ?? "") as string,
            class_name: null,
            class_id: (u.klasa ?? null) as number | null,
          } as ParentChild;
        } catch {
          return null;
        }
      })
    );
    return children.filter((c): c is ParentChild => c !== null);
  } catch {
    return [];
  }
};

const adminH = () => ({ "ADMIN-KEY": ADMIN_KEY });

// Build ParentSubjectGrades from raw student grade endpoints (fallback when parent endpoint fails).
const buildGradesFromRaw = async (studentId: number): Promise<ParentSubjectGrades[]> => {
  const base = getApiBaseUrl();
  const [gradesRes, periodRes, finalRes, subjRes] = await Promise.all([
    authenticatedFetch(`${base}/api/oceny/?uczen=${studentId}`, { headers: adminH() }),
    authenticatedFetch(`${base}/api/oceny-okresowe/?uczen=${studentId}`, { headers: adminH() }),
    authenticatedFetch(`${base}/api/oceny-koncowe/?uczen=${studentId}`, { headers: adminH() }),
    authenticatedFetch(`${base}/api/przedmioty/`, { headers: adminH() }),
  ]);
  const toList = async (r: Response) => {
    if (!r.ok) return [];
    const d = await r.json().catch(() => []);
    return Array.isArray(d) ? d : (d.results ?? []);
  };
  const [grades, period, finals, subjects] = await Promise.all([toList(gradesRes), toList(periodRes), toList(finalRes), toList(subjRes)]);
  const subjMap = new Map<number, string>(subjects.map((s: any) => [Number(s.id), s.nazwa ?? s.name ?? `#${s.id}`]));
  const bySubj = new Map<number, ParentSubjectGrades>();
  const ensureSubj = (subjId: number) => {
    if (!bySubj.has(subjId)) bySubj.set(subjId, { subject_id: subjId, subject_name: subjMap.get(subjId) ?? `Przedmiot #${subjId}`, average: null, predicted: null, final: null, period: [], grades: [] });
    return bySubj.get(subjId)!;
  };
  for (const g of grades) {
    ensureSubj(Number(g.przedmiot)).grades.push({ id: g.id, wartosc: String(g.wartosc ?? ""), waga: Number(g.waga ?? 1), opis: g.opis ?? undefined, data_wystawienia: g.data_wystawienia ?? undefined, czy_do_sredniej: g.czy_do_sredniej !== false });
  }
  for (const p of period) {
    ensureSubj(Number(p.przedmiot)).period.push({ id: p.id, wartosc: String(p.wartosc ?? ""), okres: Number(p.okres) === 2 ? 2 : 1 });
  }
  for (const f of finals) {
    ensureSubj(Number(f.przedmiot)).final = String(f.wartosc ?? "");
  }
  for (const subj of bySubj.values()) {
    const countable = subj.grades.filter((g) => g.czy_do_sredniej);
    if (countable.length) {
      let tot = 0, w = 0;
      for (const g of countable) { const v = parseFloat(g.wartosc); if (!isNaN(v)) { tot += v * g.waga; w += g.waga; } }
      if (w) subj.average = (tot / w).toFixed(2);
    }
  }
  return Array.from(bySubj.values()).sort((a, b) => a.subject_name.localeCompare(b.subject_name));
};

export const getParentGrades = async (studentId: number): Promise<ParentSubjectGrades[]> => {
  try {
    const res = await authenticatedFetch(`${getApiBaseUrl()}/api/parent/grades/?student_id=${studentId}`);
    const list = (await jsonList(res)) as ParentSubjectGrades[];
    if (list.length > 0) return list;
    return await buildGradesFromRaw(studentId);
  } catch {
    return [];
  }
};

const buildAttendanceFromRaw = async (studentId: number): Promise<ParentAttendanceEntry[]> => {
  const base = getApiBaseUrl();
  // Try both param names — some backends use "uczen", others "uczen_id"
  const [attendRes, attendRes2, statusRes] = await Promise.all([
    authenticatedFetch(`${base}/api/frekwencja/?uczen=${studentId}`, { headers: adminH() }),
    authenticatedFetch(`${base}/api/frekwencja/?uczen_id=${studentId}`, { headers: adminH() }),
    authenticatedFetch(`${base}/api/statusy/`, { headers: adminH() }),
  ]);
  const toList = async (r: Response) => {
    if (!r.ok) return [];
    const d = await r.json().catch(() => []);
    return Array.isArray(d) ? d : (d.results ?? []);
  };
  const [list1, list2, statuses] = await Promise.all([toList(attendRes), toList(attendRes2), toList(statusRes)]);
  const entries = list1.length > 0 ? list1 : list2;
  const statusMap = new Map<number, string>(statuses.map((s: any) => [Number(s.id), String(s.Wartosc ?? s.wartosc ?? s.name ?? s.nazwa ?? s.id)]));
  return entries
    .filter((e: any) => {
      const uczenRaw = e?.uczen_id ?? e?.uczen?.id ?? e?.uczen?.pk ?? (typeof e?.uczen === "number" ? e?.uczen : null);
      if (uczenRaw == null) return true;
      return Number(uczenRaw) === studentId;
    })
    .map((e: any) => ({
      id: e.id as number,
      data: (e.Data ?? e.data ?? "") as string,
      status: statusMap.get(Number(e.status)) ?? null,
      godzina_lekcyjna: (e.godzina_lekcyjna ?? null) as number | null,
    }));
};

const normalizeAttendanceEntries = async (
  list: any[],
  base: string
): Promise<ParentAttendanceEntry[]> => {
  const statusRes = await authenticatedFetch(`${base}/api/statusy/`, { headers: adminH() });
  const statusRaw = statusRes.ok ? await statusRes.json().catch(() => []) : [];
  const statusList = Array.isArray(statusRaw) ? statusRaw : (statusRaw.results ?? []);
  const statusMap = new Map<number, string>(
    statusList.map((s: any) => [Number(s.id), String(s.Wartosc ?? s.wartosc ?? s.name ?? s.id)])
  );
  return list.map((e: any) => ({
    id: Number(e.id),
    // backend returns "Data" (capital D) for the date field
    data: String(e.Data ?? e.data ?? ""),
    status: typeof e.status === "string"
      ? e.status
      : (statusMap.get(Number(e.status)) ?? null),
    godzina_lekcyjna: (e.godzina_lekcyjna ?? null) as number | null,
  }));
};

export const getParentAttendance = async (studentId: number): Promise<ParentAttendanceEntry[]> => {
  try {
    const base = getApiBaseUrl();
    const res = await authenticatedFetch(
      `${base}/api/parent/attendance/?student_id=${studentId}`
    );
    const list = await jsonList(res);
    if (list.length > 0) return await normalizeAttendanceEntries(list, base);
    return await buildAttendanceFromRaw(studentId);
  } catch {
    return [];
  }
};

export const getParentBehavior = async (studentId: number): Promise<ParentBehaviorPoint[]> => {
  try {
    const res = await authenticatedFetch(
      `${getApiBaseUrl()}/api/parent/behavior/?student_id=${studentId}`
    );
    return (await jsonList(res)) as ParentBehaviorPoint[];
  } catch {
    return [];
  }
};

export const getParentExcuses = async (): Promise<ParentExcuse[]> => {
  try {
    const res = await authenticatedFetch(`${getApiBaseUrl()}/api/parent/excuses/`);
    return (await jsonList(res)) as ParentExcuse[];
  } catch {
    return [];
  }
};

export const createParentExcuse = async (
  studentId: number,
  reason: string,
  items: Array<{ data: string; frekwencja?: number }>
): Promise<boolean> => {
  try {
    const res = await authenticatedFetch(`${getApiBaseUrl()}/api/parent/excuses/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: studentId, reason, items }),
    });
    return res.ok || res.status === 201;
  } catch {
    return false;
  }
};

export const getHomeworkForClass = async (classId: number): Promise<ParentHomework[]> => {
  try {
    const res = await authenticatedFetch(
      `${getApiBaseUrl()}/api/prace-domowe/?klasa=${classId}`,
      { headers: { "ADMIN-KEY": ADMIN_KEY } }
    );
    return (await jsonList(res)) as ParentHomework[];
  } catch {
    return [];
  }
};

export function gradeLabel(wartosc: string): string {
  const val = parseFloat(wartosc);
  if (isNaN(val)) return wartosc;
  const frac = val % 1;
  if (Math.abs(frac - 0.5) < 0.01) return `${Math.floor(val)}+`;
  if (Math.abs(frac - 0.75) < 0.01) return `${Math.ceil(val)}-`;
  return String(Math.round(val));
}

export function gradeColor(wartosc: string): string {
  const val = parseFloat(wartosc);
  if (isNaN(val)) return "#6b7280";
  if (val >= 4.5) return "#16a34a";
  if (val >= 3.5) return "#65a30d";
  if (val >= 2.75) return "#d97706";
  if (val >= 1.75) return "#ea580c";
  return "#dc2626";
}

export default function ParentApiRoute() {
  return null;
}
