import { authenticatedFetch, getAccessToken, getApiBaseUrl } from "./auth";
import { ADMIN_KEY } from "./constants";

// API Types
// CRITICAL: nadawca_id and odbiorca_id are Django auth user.id, NOT uczniowie.id!
// Use findDjangoUserIdByUsername() from users.ts to get correct ID for recipient
export type MessageRecord = {
  id: number;
  nadawca_id: number; // Django auth user.id (NOT uczniowie.id!)
  nadawca_username?: string; // Added by backend for display
  odbiorca_id: number; // Django auth user.id (NOT uczniowie.id!)
  odbiorca_username?: string; // Added by backend for display
  temat: string;
  tresc: string;
  data_wyslania: string;
  przeczytana: boolean;
};

export type CreateMessagePayload = {
  nadawca_id: number; // Django auth user.id - get from JWT token (user.id)
  odbiorca_id: number; // Django auth user.id - get from findDjangoUserIdByUsername()
  temat: string;
  tresc: string;
};

export type UpdateMessagePayload = {
  przeczytana?: boolean;
};

// Display Types
export type Message = {
  id: number;
  sender: string;
  subject: string;
  preview: string;
  content: string;
  time: string;
  unread: boolean;
  avatar: string;
  sender_id?: number | null;
  recipient_id?: number | null;
  raw?: MessageRecord;
};

export type MessagesResponse = {
  messages: Message[];
};

const headers = () => ({
  "ADMIN-KEY": ADMIN_KEY,
  "Content-Type": "application/json",
});

const userNameCache = new Map<number, string>();

const extractReadableUserName = (payload: any): string | null => {
  if (!payload) return null;
  const candidate = payload.user ?? payload.uczen ?? payload.nauczyciel ?? payload.rodzic ?? payload;
  const first = candidate.first_name ?? candidate.firstName ?? null;
  const last = candidate.last_name ?? candidate.lastName ?? null;
  const username = candidate.username ?? payload.username ?? null;

  if (first || last) return `${first ?? ""} ${last ?? ""}`.trim();
  if (username) return String(username);
  return null;
};

const resolveUserDisplayName = async (djangoUserId: number): Promise<string | null> => {
  if (!djangoUserId || djangoUserId <= 0) return null;
  if (userNameCache.has(djangoUserId)) return userNameCache.get(djangoUserId) ?? null;

  const base = getApiBaseUrl().replace(/\/$/, "");
  const candidates = [
    `${base}/api/users/${djangoUserId}/`,
    `${base}/api/uczniowie/?user_id=${djangoUserId}`,
    `${base}/api/nauczyciele/?user_id=${djangoUserId}`,
    `${base}/api/rodzice/?user_id=${djangoUserId}`,
  ];

  for (const url of candidates) {
    try {
      const res = await authenticatedFetch(url, { headers: headers() as any });
      if (!res || !res.ok) continue;
      const json = await res.json().catch(() => null);
      if (!json) continue;
      const row = Array.isArray(json) ? json[0] : Array.isArray(json.results) ? json.results[0] : json;
      const label = extractReadableUserName(row);
      if (label) {
        userNameCache.set(djangoUserId, label);
        return label;
      }
    } catch {
      continue;
    }
  }

  return null;
};

const DB: Record<number, MessagesResponse> = {
  1: {
    // Jan Kowalski - messages
    messages: [
      {
        id: 1,
        sender: "Magdalena Nowak",
        subject: "Przypomnienie o sprawdzianie",
        preview:
          "Jutro odbędzie się sprawdzian z matematyki. Proszę przygotować...",
        content:
          "Szanowni Uczniowie,\n\nJutro odbędzie się sprawdzian z matematyki obejmujący materiał z ostatnich trzech tygodni:\n- Równania kwadratowe\n- Funkcje kwadratowe\n- Nierówności kwadratowe\n\nProszę przygotować kalkulator i przybornik geometryczny.\n\nPozdrawiam,\nMagdalena Nowak",
        time: "10:30",
        unread: true,
        avatar: "M",
      },
      {
        id: 2,
        sender: "Anna Kowalska",
        subject: "Praca domowa",
        preview: "Proszę o przesłanie pracy domowej do końca tygodnia...",
        content:
          "Drodzy Uczniowie,\n\nPrzypominam o pracy domowej - esej na temat 'Romantyzm w literaturze polskiej'. Praca powinna zawierać:\n- Wstęp (charakterystyka epoki)\n- Rozwinięcie (omówienie wybranych dzieł)\n- Zakończenie (podsumowanie)\n\nMinimalna długość: 2 strony A4.\nTermin: do końca tego tygodnia.\n\nPozdrawiam serdecznie,\nAnna Kowalska",
        time: "Wczoraj",
        unread: true,
        avatar: "A",
      },
      {
        id: 3,
        sender: "Sekretariat",
        subject: "Informacja o wycieczce",
        preview: "Zapraszamy na wycieczkę do Warszawy w przyszłym miesiącu...",
        content:
          "Szanowni Państwo,\n\nInformujemy o organizowanej wycieczce do Warszawy:\n\nData: 15 grudnia 2025\nMiejsce zbiórki: Parking szkolny, godz. 7:00\nPowrót: około 18:00\nKoszt: 150 zł\n\nW programie:\n- Zamek Królewski\n- Muzeum Powstania Warszawskiego\n- Stare Miasto\n\nZapisy w sekretariacie do 30 listopada.\n\nSekretariat Szkoły",
        time: "2 dni temu",
        unread: false,
        avatar: "S",
      },
      {
        id: 4,
        sender: "Jan Wiśniewski",
        subject: "Projekt grupowy",
        preview: "Przypominam o terminie oddania projektu z fizyki...",
        content:
          "Uczniowie,\n\nPrzypominam o projekcie grupowym z fizyki na temat 'Odnawialne źródła energii'.\n\nTermin oddania: 25 listopada 2025\n\nProszę o przesłanie projektu w formie prezentacji (PowerPoint lub PDF).\n\nKażda grupa powinna przygotować:\n- Prezentację (15-20 slajdów)\n- Krótkie podsumowanie (1 strona)\n\nPozdrawiam,\nJan Wiśniewski",
        time: "3 dni temu",
        unread: false,
        avatar: "J",
      },
    ],
  },
  2: {
    // Anna Nowak - messages
    messages: [
      {
        id: 1,
        sender: "Katarzyna Jankowska",
        subject: "Gratulacje - doskonały wynik!",
        preview: "Gratulacje za znakomity wynik z ostatniego testu...",
        content:
          "Droga Anno,\n\nGratulacje za znakomity wynik z ostatniego testu z matematyki! Twoja praca i zaangażowanie przynoszą świetne rezultaty.\n\nTwój wynik to 98% - najlepszy w całej klasie!\n\nCzekam na Twoje dalsze sukcesy.\n\nPozdrawiam serdecznie,\nKatarzyna Jankowska",
        time: "9:15",
        unread: true,
        avatar: "K",
      },
      {
        id: 2,
        sender: "Michael Brown",
        subject: "English Competition",
        preview:
          "I'm pleased to inform you about the upcoming English competition...",
        content:
          "Dear Anna,\n\nI'm pleased to inform you that you've been selected to represent our school in the Regional English Competition.\n\nDetails:\nDate: December 10, 2025\nVenue: City Cultural Center\nTime: 10:00 AM\n\nPlease confirm your participation by Friday.\n\nBest regards,\nMichael Brown",
        time: "Wczoraj",
        unread: true,
        avatar: "M",
      },
      {
        id: 3,
        sender: "Renata Pawlak",
        subject: "Projekt biologiczny",
        preview: "Świetna praca nad projektem ekosystemów...",
        content:
          "Anno,\n\nChciałam pogratulować doskonałej pracy nad projektem dotyczącym ekosystemów leśnych. Twoje badania były bardzo szczegółowe i dobrze udokumentowane.\n\nOcena: 6.0\n\nMożesz być z siebie dumna!\n\nPozdrawiam,\nRenata Pawlak",
        time: "2 dni temu",
        unread: false,
        avatar: "R",
      },
      {
        id: 4,
        sender: "Sekretariat",
        subject: "Stypenium naukowe",
        preview: "Informujemy o możliwości ubiegania się o stypendium...",
        content:
          "Szanowna Anno,\n\nZ uwagi na Twoje wybitne osiągnięcia naukowe, informujemy o możliwości ubiegania się o stypendium naukowe.\n\nKryteria:\n- Średnia ocen min. 4.8\n- Osiągnięcia w olimpiadach/konkursach\n- Aktywność społeczna\n\nDokumenty należy złożyć do 5 grudnia.\n\nSekretariat Szkoły",
        time: "4 dni temu",
        unread: false,
        avatar: "S",
      },
      {
        id: 5,
        sender: "Barbara Wójcik",
        subject: "Recytacja poezji",
        preview: "Zapraszam do udziału w konkursie recytatorskim...",
        content:
          "Droga Anno,\n\nZapraszam Cię do udziału w szkolnym konkursie recytatorskim. Mając na uwadze Twoje zdolności interpretacyjne, myślę że masz duże szanse na sukces.\n\nTermin zgłoszeń: 28 listopada\nKonkurs: 5 grudnia\n\nDaj mi znać, jeśli jesteś zainteresowana.\n\nPozdrawiam,\nBarbara Wójcik",
        time: "Tydzień temu",
        unread: false,
        avatar: "B",
      },
    ],
  },
};

export const getUserMessages = async (
  userId: number,
): Promise<MessagesResponse> => {
  await new Promise((r) => setTimeout(r, 350));
  const data = DB[userId];
  if (!data) return { messages: [] };
  return { messages: [...data.messages] };
};

// Fetch messages from the remote server using authenticatedFetch.
// This function always queries the server endpoint and does NOT fall back to local mock DB.

export const fetchUserMessagesRemote = async (
  userId: number,
): Promise<MessagesResponse> => {
  const url = `${getApiBaseUrl()}/api/wiadomosci/?user_id=${encodeURIComponent(String(userId))}`;
  try {
    // Debug: check if we have an access token stored
    try {
      const access = await getAccessToken();
      console.debug(
        "[fetchUserMessagesRemote] access token present=",
        !!access,
      );
    } catch {
      // ignore
    }
    const hdrs = new Headers(headers());
    if (ADMIN_KEY) hdrs.set("ADMIN-KEY", ADMIN_KEY);
    const res = await authenticatedFetch(url, { headers: hdrs });
    if (!res || !res.ok) {
      // Log response status for debugging
      console.warn(
        `[fetchUserMessagesRemote] authenticatedFetch returned status=${res ? res.status : "no-response"}`,
      );
      // Try a plain unauthenticated fetch to see what the server responds without Authorization
      try {
        const bare = await fetch(url, { headers: headers() });
        const text = await bare.text().catch(() => "");
        console.warn(
          `[fetchUserMessagesRemote] unauthenticated fetch status=${bare.status} body=${text?.slice(0, 1000)}`,
        );
      } catch (e) {
        console.warn(
          "[fetchUserMessagesRemote] unauthenticated fetch failed",
          e,
        );
      }
      // Return empty result on non-OK responses to avoid exposing local mock data
      return { messages: [] };
    }

    const json = await res.json().catch(() => null);
    if (!json) {
      console.debug(
        "[fetchUserMessagesRemote] response JSON empty or not parseable",
      );
      return { messages: [] };
    }

    // Some APIs return an array, others return an object with `results` or `messages`.
    const items: any[] = Array.isArray(json)
      ? json
      : Array.isArray(json.results)
        ? json.results
        : Array.isArray(json.messages)
          ? json.messages
          : [];

    // Debug: log a sample of the raw items to help diagnose empty lists
    console.debug(
      "[fetchUserMessagesRemote] items.length=",
      items.length,
      "sample=",
      items[0] ? JSON.stringify(items[0]).slice(0, 1000) : null,
    );

    const normalized = items.map((m: any, idx: number) => {
      const id = Number(m.id ?? m.pk ?? idx + 1);
      const subject = m.temat ?? m.subject ?? m.title ?? "";
      const content = m.tresc ?? m.content ?? m.body ?? "";
      const senderName =
        m.nadawca_name ??
        m.sender_name ??
        m.sender ??
        m.from ??
        (m.nadawca?.first_name
          ? `${m.nadawca.first_name} ${m.nadawca.last_name ?? ""}`.trim()
          : "");
      const avatar =
        senderName && senderName[0] ? senderName[0].toUpperCase() : "U";
      const preview = content ? String(content).slice(0, 120) : "";
      const time = m.created_at ?? m.time ?? m.czas ?? m.data ?? "";
      const unread =
        typeof m.przeczytana === "boolean"
          ? !m.przeczytana
          : typeof m.unread === "boolean"
            ? !!m.unread
            : false;

      return {
        id,
        sender: senderName || (m.nadawca?.username ?? m.sender ?? "Nieznany"),
        subject,
        preview,
        content,
        time,
        unread,
        avatar,
        sender_id:
          m.nadawca_id ?? m.sender_id ?? m.from_id ?? m.nadawca?.id ?? null,
        recipient_id:
          m.odbiorca_id ?? m.recipient_id ?? m.to_id ?? m.odbiorca?.id ?? null,
        raw: m,
      } as any;
    });

    return { messages: normalized } as any;
  } catch (e) {
    console.error("[fetchUserMessagesRemote] unexpected error", e);
    return { messages: [] };
  }
};

// GET all messages
export const getAllMessages = async (): Promise<MessageRecord[]> => {
  try {
    const response = await authenticatedFetch(
      `${getApiBaseUrl()}/api/wiadomosci/`,
      { headers: headers() },
    );
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("[messages] getAllMessages error:", error);
    return [];
  }
};

// GET messages for user (as sender or recipient)
// Try multiple endpoints/parameters to find the correct one
export const getMessagesForUser = async (
  userId: number,
  username?: string,
): Promise<MessageRecord[]> => {
  try {
    // Prefer explicit sender/recipient filtering supported by server API.
    // The docs show: /api/wiadomosci/?odbiorca=<id> and /api/wiadomosci/?nadawca=<id>
    // We'll try both (recipient and sender) and return combined unique records.
    const results: MessageRecord[] = [];

    const tryFetch = async (paramName: "odbiorca" | "nadawca", id: number) => {
      // Some deployments expose the endpoint as /api/wiadomosci/, others as /wiadomosci/.
      // Try both variants so we match the working site's behavior.
      const base = getApiBaseUrl().replace(/\/$/, "");
      const candidates = [
        `${base}/api/wiadomosci/?${paramName}=${encodeURIComponent(String(id))}`,
        `${base}/wiadomosci/?${paramName}=${encodeURIComponent(String(id))}`,
      ];

      for (const url of candidates) {
        try {
          console.debug("[messages] trying fetch", url);
          const res = await authenticatedFetch(url, {
            headers: headers() as any,
          });
          if (!res) {
            console.warn("[messages] no response for", url);
            continue;
          }

          // Log status and a small body sample for debugging
          const status = res.status;
          let text = "";
          try {
            text = await res.clone().text();
          } catch {
            // ignore
          }
          console.debug(
            "[messages] fetch",
            url,
            "status=",
            status,
            "body(sample)=",
            String(text).slice(0, 2000),
          );

          if (!res.ok) {
            console.warn("[messages] fetch failed for", url, "status=", status);
            continue;
          }

          const json = await res.json().catch(() => null);
          if (!json) return [] as MessageRecord[];
          // API likely returns array of objects
          return Array.isArray(json)
            ? (json as MessageRecord[])
            : Array.isArray(json.results)
              ? (json.results as MessageRecord[])
              : Array.isArray(json.messages)
                ? (json.messages as MessageRecord[])
                : [];
        } catch (e) {
          console.warn("[messages] fetch error for", url, e);
          continue;
        }
      }

      return [] as MessageRecord[];
    };

    // use provided userId if valid
    const idToUse = Number(userId) || 0;
    if (idToUse > 0) {
      const recs1 = await tryFetch("odbiorca", idToUse);
      const recs2 = await tryFetch("nadawca", idToUse);
      const combined = [...recs1, ...recs2];
      // dedupe by id
      const seen = new Set<number>();
      for (const r of combined) {
        if (!r || typeof r.id === "undefined") continue;
        const rid = Number(r.id);
        if (seen.has(rid)) continue;
        seen.add(rid);
        results.push(r);
      }
    }

    return results;
  } catch (error) {
    console.error("[messages] getMessagesForUser error:", error);
    return [];
  }
};

// Fetch messages where the given user is the recipient (odbiorca)
export const fetchMessagesByRecipient = async (
  recipientId: number,
): Promise<MessageRecord[]> => {
  try {
    const url = `${getApiBaseUrl()}/api/wiadomosci/?odbiorca=${encodeURIComponent(String(recipientId))}`;
    const res = await authenticatedFetch(url, {
      headers: headers() as any,
    });
    if (!res) {
      console.warn("[messages] fetchMessagesByRecipient no response for", url);
      return [];
    }
    // debug log body sample
    try {
      const txt = await res.clone().text();
      console.debug(
        "[messages] fetchMessagesByRecipient",
        url,
        "status=",
        res.status,
        "body(sample)=",
        String(txt).slice(0, 2000),
      );
    } catch {
      // ignore
    }
    if (!res.ok) return [];
    const json = await res.json().catch(() => null);
    if (!json) return [];
    const items: any[] = Array.isArray(json)
      ? json
      : Array.isArray(json.results)
        ? json.results
        : Array.isArray(json.messages)
          ? json.messages
          : [];
    // If server returned no filtered items, try fetching all messages and filter locally
    if (!items || items.length === 0) {
      console.debug(
        "[messages] server returned 0 for filtered recipient, falling back to local filter via getAllMessages",
      );
      const all = await getAllMessages();
      // Filter by multiple possible field names that server might use
      const filtered = all.filter((m: any) => {
        const candidateIds = [
          m.odbiorca,
          m.odbiorca_id,
          m.recipient_id,
          m.to_id,
          m.odbiorcaId,
        ];
        return candidateIds.some(
          (id) =>
            typeof id !== "undefined" && Number(id) === Number(recipientId),
        );
      });
      // Normalize and return
      return filtered.map(
        (m: any) =>
          ({
            id: Number(m.id ?? m.pk ?? 0),
            nadawca_id: Number(
              m.nadawca ?? m.nadawca_id ?? m.sender_id ?? null,
            ),
            nadawca_username:
              m.nadawca_username ??
              m.nadawca_name ??
              m.sender_name ??
              undefined,
            odbiorca_id: Number(
              m.odbiorca ?? m.odbiorca_id ?? m.recipient_id ?? null,
            ),
            odbiorca_username:
              m.odbiorca_username ?? m.recipient_name ?? undefined,
            temat: m.temat ?? m.subject ?? m.title ?? "",
            tresc: m.tresc ?? m.content ?? m.body ?? "",
            data_wyslania:
              m.data_wyslania ?? m.created_at ?? m.time ?? m.data ?? "",
            przeczytana:
              typeof m.przeczytana === "boolean"
                ? m.przeczytana
                : !!m.przeczytana,
          }) as MessageRecord,
      );
    }

    // Normalize API fields to MessageRecord shape
    const normalized = items.map(
      (m: any) =>
        ({
          id: Number(m.id ?? m.pk ?? 0),
          nadawca_id: Number(m.nadawca ?? m.nadawca_id ?? m.sender_id ?? null),
          nadawca_username:
            m.nadawca_username ?? m.nadawca_name ?? m.sender_name ?? undefined,
          odbiorca_id: Number(
            m.odbiorca ?? m.odbiorca_id ?? m.recipient_id ?? null,
          ),
          odbiorca_username:
            m.odbiorca_username ?? m.recipient_name ?? undefined,
          temat: m.temat ?? m.subject ?? m.title ?? "",
          tresc: m.tresc ?? m.content ?? m.body ?? "",
          data_wyslania:
            m.data_wyslania ?? m.created_at ?? m.time ?? m.data ?? "",
          przeczytana:
            typeof m.przeczytana === "boolean"
              ? m.przeczytana
              : !!m.przeczytana,
        }) as MessageRecord,
    );

    const senderIds = Array.from(
      new Set(
        normalized
          .map((item) => Number(item.nadawca_id))
          .filter((id) => Number.isFinite(id) && id > 0),
      ),
    );
    await Promise.all(
      senderIds.map(async (senderId) => {
        const name = await resolveUserDisplayName(senderId);
        if (name) userNameCache.set(senderId, name);
      }),
    );

    return normalized.map((item) => ({
      ...item,
      nadawca_username:
        item.nadawca_username ??
        userNameCache.get(Number(item.nadawca_id)) ??
        item.nadawca_username,
    }));
  } catch (e) {
    console.error("[messages] fetchMessagesByRecipient error", e);
    return [];
  }
};

// Aliases matching the snippet you provided (fetchWithAuth wrappers)
export const getInboxMessages = (userId: number) =>
  fetchMessagesByRecipient(userId);
export const getSentMessages = (userId: number) =>
  fetchMessagesBySender(userId);

// Fetch messages where the given user is the sender (nadawca)
export const fetchMessagesBySender = async (
  senderId: number,
): Promise<MessageRecord[]> => {
  try {
    const url = `${getApiBaseUrl()}/api/wiadomosci/?nadawca=${encodeURIComponent(String(senderId))}`;
    const res = await authenticatedFetch(url, {
      headers: headers() as any,
    });
    if (!res) {
      console.warn("[messages] fetchMessagesBySender no response for", url);
      return [];
    }
    try {
      const txt = await res.clone().text();
      console.debug(
        "[messages] fetchMessagesBySender",
        url,
        "status=",
        res.status,
        "body(sample)=",
        String(txt).slice(0, 2000),
      );
    } catch {
      // ignore
    }
    if (!res.ok) return [];
    const json = await res.json().catch(() => null);
    if (!json) return [];
    const items: any[] = Array.isArray(json)
      ? json
      : Array.isArray(json.results)
        ? json.results
        : Array.isArray(json.messages)
          ? json.messages
          : [];
    // If server returned no filtered items, try fetching all messages and filter locally
    if (!items || items.length === 0) {
      console.debug(
        "[messages] server returned 0 for filtered sender, falling back to local filter via getAllMessages",
      );
      const all = await getAllMessages();
      const filtered = all.filter((m: any) => {
        const candidateIds = [
          m.nadawca,
          m.nadawca_id,
          m.sender_id,
          m.from_id,
          m.nadawcaId,
        ];
        return candidateIds.some(
          (id) => typeof id !== "undefined" && Number(id) === Number(senderId),
        );
      });
      return filtered.map(
        (m: any) =>
          ({
            id: Number(m.id ?? m.pk ?? 0),
            nadawca_id: Number(
              m.nadawca ?? m.nadawca_id ?? m.sender_id ?? null,
            ),
            nadawca_username:
              m.nadawca_username ??
              m.nadawca_name ??
              m.sender_name ??
              undefined,
            odbiorca_id: Number(
              m.odbiorca ?? m.odbiorca_id ?? m.recipient_id ?? null,
            ),
            odbiorca_username:
              m.odbiorca_username ?? m.recipient_name ?? undefined,
            temat: m.temat ?? m.subject ?? m.title ?? "",
            tresc: m.tresc ?? m.content ?? m.body ?? "",
            data_wyslania:
              m.data_wyslania ?? m.created_at ?? m.time ?? m.data ?? "",
            przeczytana:
              typeof m.przeczytana === "boolean"
                ? m.przeczytana
                : !!m.przeczytana,
          }) as MessageRecord,
      );
    }

    // Normalize API fields to MessageRecord shape
    const normalized = items.map(
      (m: any) =>
        ({
          id: Number(m.id ?? m.pk ?? 0),
          nadawca_id: Number(m.nadawca ?? m.nadawca_id ?? m.sender_id ?? null),
          nadawca_username:
            m.nadawca_username ?? m.nadawca_name ?? m.sender_name ?? undefined,
          odbiorca_id: Number(
            m.odbiorca ?? m.odbiorca_id ?? m.recipient_id ?? null,
          ),
          odbiorca_username:
            m.odbiorca_username ?? m.recipient_name ?? undefined,
          temat: m.temat ?? m.subject ?? m.title ?? "",
          tresc: m.tresc ?? m.content ?? m.body ?? "",
          data_wyslania:
            m.data_wyslania ?? m.created_at ?? m.time ?? m.data ?? "",
          przeczytana:
            typeof m.przeczytana === "boolean"
              ? m.przeczytana
              : !!m.przeczytana,
        }) as MessageRecord,
    );

    const recipientIds = Array.from(
      new Set(
        normalized
          .map((item) => Number(item.odbiorca_id))
          .filter((id) => Number.isFinite(id) && id > 0),
      ),
    );
    await Promise.all(
      recipientIds.map(async (recipient) => {
        const name = await resolveUserDisplayName(recipient);
        if (name) userNameCache.set(recipient, name);
      }),
    );

    return normalized.map((item) => ({
      ...item,
      odbiorca_username:
        item.odbiorca_username ??
        userNameCache.get(Number(item.odbiorca_id)) ??
        item.odbiorca_username,
    }));
  } catch (e) {
    console.error("[messages] fetchMessagesBySender error", e);
    return [];
  }
};

// GET single message
export const getMessageById = async (
  id: number,
): Promise<MessageRecord | null> => {
  try {
    const response = await authenticatedFetch(
      `${getApiBaseUrl()}/api/wiadomosci/${id}/`,
      { headers: headers() },
    );
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("[messages] getMessageById error:", error);
    return null;
  }
};

// POST create message
// IMPORTANT: nadawca_id and odbiorca_id should be Django user_id, NOT uczen_id
export const createMessage = async (
  payload: CreateMessagePayload,
): Promise<MessageRecord | null> => {
  try {
    if (__DEV__) console.log("[messages] Creating message with payload (user_id values):", {
      nadawca_id: payload.nadawca_id,
      odbiorca_id: payload.odbiorca_id,
      temat: payload.temat,
    });
    const response = await authenticatedFetch(
      `${getApiBaseUrl()}/api/wiadomosci/`,
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(payload),
      },
    );
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[messages] Create failed:", response.status, errorText);
      throw new Error(`HTTP ${response.status}`);
    }
    const result = await response.json();
    if (__DEV__) console.log("[messages] Message created successfully:", result.id);
    return result;
  } catch (error) {
    console.error("[messages] createMessage error:", error);
    return null;
  }
};

// PUT update message (mark as read)
export const updateMessage = async (
  id: number,
  payload: UpdateMessagePayload,
): Promise<MessageRecord | null> => {
  try {
    const response = await authenticatedFetch(
      `${getApiBaseUrl()}/api/wiadomosci/${id}/`,
      {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify(payload),
      },
    );
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("[messages] updateMessage error:", error);
    return null;
  }
};

export default function MessagesApiRoute() {
  return null;
}

// DELETE message
export const deleteMessage = async (id: number): Promise<boolean> => {
  try {
    const response = await authenticatedFetch(
      `${getApiBaseUrl()}/api/wiadomosci/${id}/`,
      {
        method: "DELETE",
        headers: headers(),
      },
    );
    return response.ok;
  } catch (error) {
    console.error("[messages] deleteMessage error:", error);
    return false;
  }
};

// Helper: Convert MessageRecord to Message for display
export const convertToDisplayMessage = (
  record: MessageRecord,
  currentUserId?: number,
): Message => {
  const isSender = record.nadawca_id === currentUserId;
  // For sent messages display recipient name, for inbox display sender name.
  const counterpartyName = isSender
    ? record.odbiorca_username || `Użytkownik ${record.odbiorca_id}`
    : record.nadawca_username || `Użytkownik ${record.nadawca_id}`;
  const senderName = counterpartyName;
  const avatar = senderName ? senderName[0].toUpperCase() : "?";
  const preview = record.tresc.slice(0, 120);

  if (__DEV__) console.log("[convertToDisplayMessage] Processing:", {
    id: record.id,
    nadawca_id: record.nadawca_id,
    odbiorca_id: record.odbiorca_id,
    currentUserId,
    nadawca_username: record.nadawca_username,
    odbiorca_username: record.odbiorca_username,
    temat: record.temat,
  });

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffDays === 0) {
      return date.toLocaleTimeString("pl-PL", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (diffDays === 1) {
      return "Wczoraj";
    } else if (diffDays < 7) {
      return `${diffDays} dni temu`;
    } else {
      return date.toLocaleDateString("pl-PL");
    }
  };

  return {
    id: record.id,
    sender: senderName,
    subject: record.temat,
    preview,
    content: record.tresc,
    time: formatTime(record.data_wyslania),
    unread: !record.przeczytana,
    avatar,
    sender_id: record.nadawca_id,
    recipient_id: record.odbiorca_id,
    raw: record,
  };
};
