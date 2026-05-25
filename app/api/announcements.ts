import { authenticatedFetch, getApiBaseUrl } from "./auth";
import { ADMIN_KEY } from "./constants";

const headers = () => ({
  "ADMIN-KEY": ADMIN_KEY,
  "Content-Type": "application/json",
});

export type Announcement = {
  id: number;
  tytul: string;
  tresc: string;
  autor: number;
  autor_name: string;
  zasieg: "school" | "class";
  klasy: number[] | null;
  ankieta?: AnnouncementSurvey | null;
  data_publikacji: string;
  aktywne: boolean;
};

export type AnnouncementSurvey = {
  id: number;
  tytul: string;
  anonimowa: boolean;
  response_count: number;
  user_has_responded: boolean;
};

export type CreateAnnouncementPayload = {
  tytul: string;
  tresc: string;
  zasieg: "school" | "class";
  klasy?: number[];
  aktywne?: boolean;
  ankieta_id?: number;
  ankieta?: CreateInlineSurveyPayload;
};

export type CreateInlineSurveyPayload = {
  tytul: string;
  anonimowa?: boolean;
  anonymous_threshold?: number;
  tryb_quizowy?: boolean;
  pytania: CreateQuestionPayload[];
};

export type CreateQuestionPayload = {
  tekst: string;
  typ: "single_choice" | "multi_choice" | "open_text";
  wymagane?: boolean;
  kolejnosc?: number;
  opcje?: CreateOptionPayload[];
};

export type CreateOptionPayload = {
  tekst: string;
  kolejnosc?: number;
  poprawna?: boolean;
  punkty?: number;
  jest_pole_tekstowe?: boolean;
};

export type AnnouncementsResponse = {
  count: number;
  next: string | null;
  previous: string | null;
  results: Announcement[];
};

export const getAnnouncements = async (params?: {
  klasa?: number;
  zasieg?: "school" | "class";
}): Promise<Announcement[]> => {
  try {
    const base = getApiBaseUrl().replace(/\/$/, "");
    const query = new URLSearchParams();
    if (params?.klasa) query.set("klasa", String(params.klasa));
    if (params?.zasieg) query.set("zasieg", params.zasieg);
    const url = `${base}/api/ogloszenia/${query.toString() ? `?${query}` : ""}`;
    const res = await authenticatedFetch(url, { headers: headers() as any });
    if (!res?.ok) return [];
    const json = await res.json().catch(() => null);
    if (!json) return [];
    return Array.isArray(json) ? json : (json.results ?? []);
  } catch (e) {
    console.error("[announcements] getAnnouncements error", e);
    return [];
  }
};

export const getAnnouncementById = async (id: number): Promise<Announcement | null> => {
  try {
    const base = getApiBaseUrl().replace(/\/$/, "");
    const res = await authenticatedFetch(`${base}/api/ogloszenia/${id}/`, {
      headers: headers() as any,
    });
    if (!res?.ok) return null;
    return await res.json().catch(() => null);
  } catch (e) {
    console.error("[announcements] getAnnouncementById error", e);
    return null;
  }
};
