import auth, { getApiBaseUrl } from './auth';
import { ADMIN_KEY } from './constants';


const adminHeaders = () => ({
  'ADMIN-KEY': ADMIN_KEY,
  'Content-Type': 'application/json',
});

export type SchoolClass = {
  id: number;
  nazwa: string;
};

export type Student = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  klasa?: number;
  klasa_nazwa?: string;
};

export type Subject = {
  id: number;
  nazwa: string;
};

export type TeacherRecord = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  nauczyciel_id?: number;
};

export type GradeEntry = {
  id?: number;
  wartosc: number;
  waga: number;
  opis?: string;
  uczen: number;
  nauczyciel?: number;
  przedmiot: number;
  czy_do_sredniej?: boolean;
  data_wystawienia?: string;
};

export type BehaviorEntry = {
  id?: number;
  uczen: number;
  punkty: number;
  opis?: string;
  nauczyciel_wpisujacy?: number;
  data?: string;
};

export type BehaviorGrade = {
  id?: number;
  uczen: number;
  ocena: number; // 1–6
  okres: 1 | 2;
  proponowana?: boolean;
};

export type AttendanceStatus = {
  id: number;
  nazwa: string;
  skrot?: string;
};

export type AttendanceEntry = {
  id?: number;
  uczen: number;
  data: string;
  godzina_lekcyjna?: number;
  status?: number;
};

export type LessonHour = {
  id: number;
  numer: number;
  godzina_od: string;
  godzina_do: string;
};

export const getClasses = async (): Promise<SchoolClass[]> => {
  try {
    const res = await auth.authenticatedFetch(`${getApiBaseUrl()}/api/klasy/`, {
      headers: adminHeaders(),
    });
    if (!res.ok) return [];
    const data = await res.json().catch(() => []);
    const list: any[] = Array.isArray(data) ? data : (data.results ?? []);
    // KlasaSerializer: { id, numer (int), nazwa (letter), wychowawca }
    // Full class name = numer + nazwa, e.g. numer=3, nazwa="a" → "3a"
    return list.map((item: any): SchoolClass => ({
      id: item.id,
      nazwa: item.numer != null ? `${item.numer}${item.nazwa ?? ''}` : (item.nazwa ?? String(item.id)),
    }));
  } catch {
    return [];
  }
};

export const getStudents = async (): Promise<Student[]> => {
  try {
    const res = await auth.authenticatedFetch(`${getApiBaseUrl()}/api/uczniowie/`, {
      headers: adminHeaders(),
    });
    if (!res.ok) return [];
    const data = await res.json().catch(() => []);
    const list: any[] = Array.isArray(data) ? data : (data.results ?? []);
    // UczenSerializer nests user info: { id, user: { id, username, first_name, last_name }, klasa, ... }
    return list.map((item: any): Student => ({
      id: item.id,
      klasa: typeof item.klasa === 'number' ? item.klasa : undefined,
      first_name: item.user?.first_name ?? item.first_name,
      last_name: item.user?.last_name ?? item.last_name,
      username: item.user?.username ?? item.username,
    }));
  } catch {
    return [];
  }
};

export const getStudentsByClass = async (classId: number): Promise<Student[]> => {
  const all = await getStudents();
  return all.filter((s) => s.klasa === classId);
};

export const getSubjects = async (): Promise<Subject[]> => {
  try {
    const res = await auth.authenticatedFetch(`${getApiBaseUrl()}/api/przedmioty/`, {
      headers: adminHeaders(),
    });
    if (!res.ok) return [];
    const data = await res.json().catch(() => []);
    return Array.isArray(data) ? data : (data.results ?? []);
  } catch {
    return [];
  }
};

export const getTeacherProfile = async (nauczycielId?: number): Promise<TeacherRecord | null> => {
  try {
    // If we have a specific teacher ID, fetch it directly to avoid returning a random first record.
    const url = nauczycielId
      ? `${getApiBaseUrl()}/api/nauczyciele/${nauczycielId}/`
      : `${getApiBaseUrl()}/api/nauczyciele/`;
    const res = await auth.authenticatedFetch(url, { headers: adminHeaders() });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    // Single-record response when ID is provided, list otherwise.
    const item = nauczycielId ? data : (Array.isArray(data) ? data[0] : (data?.results?.[0] ?? null));
    if (!item) return null;
    // NauczycielSerializer nests user info under item.user (same as UczenSerializer)
    return {
      id: item.id,
      first_name: item.user?.first_name ?? item.first_name,
      last_name: item.user?.last_name ?? item.last_name,
      username: item.user?.username ?? item.username,
      nauczyciel_id: item.nauczyciel_id,
    };
  } catch {
    return null;
  }
};

export const addGrade = async (entry: GradeEntry): Promise<boolean> => {
  try {
    const res = await auth.authenticatedFetch(`${getApiBaseUrl()}/api/oceny/`, {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify(entry),
    });
    return res.ok || res.status === 201;
  } catch {
    return false;
  }
};

export const getGradesForStudent = async (studentId: number): Promise<GradeEntry[]> => {
  try {
    const res = await auth.authenticatedFetch(
      `${getApiBaseUrl()}/api/oceny/?uczen=${studentId}`,
      { headers: adminHeaders() }
    );
    if (!res.ok) return [];
    const data = await res.json().catch(() => []);
    return Array.isArray(data) ? data : (data.results ?? []);
  } catch {
    return [];
  }
};

export const updateGrade = async (id: number, entry: Partial<GradeEntry>): Promise<boolean> => {
  try {
    const res = await auth.authenticatedFetch(`${getApiBaseUrl()}/api/oceny/${id}/`, {
      method: 'PATCH',
      headers: adminHeaders(),
      body: JSON.stringify(entry),
    });
    return res.ok;
  } catch {
    return false;
  }
};

export const deleteGrade = async (id: number): Promise<boolean> => {
  try {
    const res = await auth.authenticatedFetch(`${getApiBaseUrl()}/api/oceny/${id}/`, {
      method: 'DELETE',
      headers: adminHeaders(),
    });
    return res.ok || res.status === 204;
  } catch {
    return false;
  }
};

export const getGradesForStudentAndSubject = async (
  studentId: number,
  subjectId: number
): Promise<GradeEntry[]> => {
  try {
    const res = await auth.authenticatedFetch(
      `${getApiBaseUrl()}/api/oceny/?uczen=${studentId}`,
      { headers: adminHeaders() }
    );
    if (!res.ok) return [];
    const data = await res.json().catch(() => []);
    const list: any[] = Array.isArray(data) ? data : (data.results ?? []);
    return list.filter((g: any) => Number(g.przedmiot) === subjectId);
  } catch {
    return [];
  }
};

export const addBehaviorPoints = async (entry: BehaviorEntry): Promise<boolean> => {
  try {
    const res = await auth.authenticatedFetch(`${getApiBaseUrl()}/api/zachowanie-punkty/`, {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify(entry),
    });
    return res.ok || res.status === 201;
  } catch {
    return false;
  }
};

export const addBehaviorGrade = async (entry: BehaviorGrade): Promise<boolean> => {
  try {
    const res = await auth.authenticatedFetch(`${getApiBaseUrl()}/api/zachowanie-oceny/`, {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify(entry),
    });
    return res.ok || res.status === 201;
  } catch {
    return false;
  }
};

export const getBehaviorForStudent = async (studentId: number): Promise<BehaviorEntry[]> => {
  try {
    const res = await auth.authenticatedFetch(
      `${getApiBaseUrl()}/api/zachowanie-punkty/?uczen=${studentId}`,
      { headers: adminHeaders() }
    );
    if (!res.ok) return [];
    const data = await res.json().catch(() => []);
    return Array.isArray(data) ? data : (data.results ?? []);
  } catch {
    return [];
  }
};

export const getAttendanceStatuses = async (): Promise<AttendanceStatus[]> => {
  try {
    const res = await auth.authenticatedFetch(`${getApiBaseUrl()}/api/statusy/`, {
      headers: adminHeaders(),
    });
    if (!res.ok) return [];
    const data = await res.json().catch(() => []);
    return Array.isArray(data) ? data : (data.results ?? []);
  } catch {
    return [];
  }
};

export const getAttendanceForStudent = async (studentId: number): Promise<AttendanceEntry[]> => {
  try {
    const res = await auth.authenticatedFetch(
      `${getApiBaseUrl()}/api/frekwencja/?uczen=${studentId}`,
      { headers: adminHeaders() }
    );
    if (!res.ok) return [];
    const data = await res.json().catch(() => []);
    return Array.isArray(data) ? data : (data.results ?? []);
  } catch {
    return [];
  }
};

export const markAttendance = async (entry: AttendanceEntry): Promise<boolean> => {
  try {
    const res = await auth.authenticatedFetch(`${getApiBaseUrl()}/api/frekwencja/`, {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify(entry),
    });
    return res.ok || res.status === 201;
  } catch {
    return false;
  }
};

export const getLessonHours = async (): Promise<LessonHour[]> => {
  try {
    const res = await auth.authenticatedFetch(`${getApiBaseUrl()}/api/godziny-lekcyjne/`, {
      headers: adminHeaders(),
    });
    if (!res.ok) return [];
    const data = await res.json().catch(() => []);
    return Array.isArray(data) ? data : (data.results ?? []);
  } catch {
    return [];
  }
};

export default function TeacherApiRoute() {
  return null;
}
