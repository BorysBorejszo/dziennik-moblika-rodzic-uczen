import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { getAccessToken, authenticatedFetch, clearTokens, decodeJWT } from '../api/auth';
import { PROFILE_ENDPOINTS } from '../api/endpointUtils';
import { UserProfile } from '../types/api';
import { getTeacherProfile } from '../api/teacher';
import { getStudentProfile } from '../api/users';

export interface UserData {
  id: number;
  // server-side student id (when different from local/mock id). Use this for API calls.
  serverId?: number;
  name: string;
  username?: string; // Django username for messages
  role?: string;
  classId?: number;
  attendance: {
    percentage: string;
    present: number;
    late: number;
    absent: number;
  };
  grades: {
    average: string;
    behavior: string;
  };
}

// Removed local MOCK_USERS — application will use server-side profile when authenticated.

interface UserContextType {
  user: UserData | null;
  users: UserData[];
  setUser: (user: UserData) => void;
  switchUser: (userId: number) => void;
  clearUser: () => void;
  ready: boolean;
  error: string | null;
  retryInit: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUserState] = useState<UserData | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initKey, setInitKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    setError(null);

    const timeoutId = setTimeout(() => {
      if (mounted) {
        setError('Nie można załadować profilu. Sprawdź połączenie z internetem.');
        if (mounted) setReady(true);
      }
    }, 15_000);

    (async () => {
      try {
        const access = await getAccessToken();
        if (!mounted) return;
        if (!access) {
          if (mounted) setReady(true);
          return;
        }

        // Try to load stored username from AsyncStorage
        let storedUsername: string | null = null;
        try {
          storedUsername = await AsyncStorage.getItem('@e-dziennik:username');
          if (__DEV__) console.log('[UserContext] Loaded stored username:', storedUsername);
        } catch {
          // ignore — stored username unavailable
        }

        // Decode JWT to get user info immediately
        const payload = decodeJWT(access);
        let jwtUserId: number | undefined;
        let jwtRole: string | undefined;
        let jwtClassId: number | undefined;

        let jwtFirstName: string | undefined;
        let jwtLastName: string | undefined;
        let jwtUsernameFromToken: string | undefined;

        if (payload) {
            // uczen_id is the Uczen model pk for students; user_id is the Django auth User pk for all users.
            // Use uczen_id first (students), fall back to user_id (teachers, parents).
            jwtUserId = payload.uczen_id ?? (payload.user_id as number | undefined);
            jwtRole = payload.role;
            jwtClassId = payload.klasa_id;
            // infer teacher role from nauczyciel_id when role field is absent
            if (!jwtRole && payload.nauczyciel_id) jwtRole = 'nauczyciel';
            // CustomTokenObtainPairSerializer embeds first_name, last_name, username in the token
            jwtFirstName = payload.first_name as string | undefined;
            jwtLastName = payload.last_name as string | undefined;
            jwtUsernameFromToken = payload.username as string | undefined;
            if (__DEV__) console.log('[UserContext] JWT payload:', payload);
            if (__DEV__) console.log('[UserContext] JWT uczen_id:', jwtUserId);
            if (__DEV__) console.log('[UserContext] JWT full payload keys:', Object.keys(payload));
            if (__DEV__) console.log('[UserContext] ⚠️ IMPORTANT: uczen_id from JWT may NOT be Django user.id!');
        }

        // try to fetch profile from common endpoints.
        // /api/profile/ is first because it has account_type for role detection.
        const candidates = PROFILE_ENDPOINTS;
        type ProfileShape = UserProfile & { attendance?: UserData['attendance']; grades?: UserData['grades'] };
        let profile: ProfileShape | null = null;
        for (const ep of candidates) {
          try {
            const res = await authenticatedFetch(ep);
            if (!res || !res.ok) continue;
            const json = await res.json().catch(() => null);
            if (!json) continue;
            profile = json;
            break;
          } catch {
            continue;
          }
        }
        if (!mounted) return;

        // Build the user object from whatever sources we have. The
        // /api/auth/me-style endpoints don't always exist on this backend,
        // so we fall back to /api/uczniowie/{id}/ (via getStudentProfile)
        // any time we end up without a real first/last name.
        let resolvedId: number | undefined = jwtUserId;
        let resolvedUsername: string | undefined = storedUsername ?? jwtUsernameFromToken ?? undefined;
        // Prefer name embedded in the JWT (CustomTokenObtainPairSerializer includes first_name/last_name)
        let resolvedName = (jwtFirstName || jwtLastName)
            ? `${jwtFirstName ?? ''} ${jwtLastName ?? ''}`.trim()
            : '';
        let resolvedAttendance: UserData['attendance'] = {
          percentage: '',
          present: 0,
          late: 0,
          absent: 0,
        };
        let resolvedGrades: UserData['grades'] = { average: '', behavior: '' };

        // Detect role from account_type in /api/profile/ response (primary method).
        if (profile && !jwtRole) {
          const accountType =
            (profile.account_type as string | undefined) ??
            (profile.user?.['account_type'] as string | undefined) ??
            (profile.uczen?.['account_type'] as string | undefined);
          if (accountType) jwtRole = accountType.toLowerCase();
        }

        if (profile) {
          const candidate = profile.user ?? profile.uczen ?? profile;
          resolvedId =
            jwtUserId ??
            (Number(
              candidate.user_id ??
                candidate.id ??
                candidate.pk ??
                profile.id ??
                null
            ) || undefined);
          const first =
            candidate.first_name ??
            candidate.firstName ??
            candidate.given_name ??
            candidate.imie;
          const last =
            candidate.last_name ??
            candidate.lastName ??
            candidate.family_name ??
            candidate.nazwisko;
          if (first || last) {
            resolvedName = `${first ?? ''} ${last ?? ''}`.trim();
          } else if (candidate.name) {
            resolvedName = String(candidate.name);
          }
          resolvedUsername =
            (candidate.username as string | undefined) ?? (profile.username as string | undefined) ?? resolvedUsername;
          resolvedAttendance = profile.attendance ?? resolvedAttendance;
          resolvedGrades = profile.grades ?? resolvedGrades;
        }

        // If we still don't have a real name, use role-appropriate profile endpoint.
        const TEACHER_TAGS = ['nauczyciel', 'teacher', 'admin'];
        const isTeacherCtx = (r?: string) => r ? TEACHER_TAGS.includes(r.toLowerCase()) : false;

        if (!resolvedName || resolvedName === 'Użytkownik') {
          if (isTeacherCtx(jwtRole)) {
            try {
              // Use nauczyciel_id from JWT for a direct fetch instead of returning a random list[0]
              const nauczycielId = payload?.nauczyciel_id as number | undefined;
              const teacherProfile = await getTeacherProfile(nauczycielId);
              if (teacherProfile) {
                if (!jwtRole) jwtRole = 'nauczyciel';
                const fromNauczyciel = `${teacherProfile.first_name ?? ''} ${teacherProfile.last_name ?? ''}`.trim();
                if (fromNauczyciel) resolvedName = fromNauczyciel;
                if (!resolvedUsername && teacherProfile.username) resolvedUsername = teacherProfile.username;
              }
            } catch {
              // ignore
            }
          } else if (resolvedId) {
            try {
              const studentProfile = await getStudentProfile(resolvedId);
              if (studentProfile) {
                const fromUczniowie = `${studentProfile.first_name ?? ''} ${
                  studentProfile.last_name ?? ''
                }`.trim();
                if (fromUczniowie) resolvedName = fromUczniowie;
                if (!resolvedUsername && studentProfile.username) {
                  resolvedUsername = studentProfile.username;
                }
              }
            } catch {
              // ignore — we'll just fall through to the placeholder
            }
          }
        }

        const finalName = resolvedName || 'Użytkownik';

        if (resolvedId) {
          if (__DEV__) console.log('[UserContext] Resolved name:', finalName);
          if (__DEV__) console.log('[UserContext] Resolved username:', resolvedUsername);
          if (__DEV__) console.log('[UserContext] Resolved ID:', resolvedId);
          const u: UserData = {
            id: resolvedId,
            serverId: resolvedId,
            name: finalName,
            username: resolvedUsername,
            role: jwtRole,
            classId: jwtClassId,
            attendance: resolvedAttendance,
            grades: resolvedGrades,
          };
          if (mounted) setUserState(u);
        }
      } catch {
        // ignore
      }
      if (mounted) {
        clearTimeout(timeoutId);
        setReady(true);
      }
    })();
    return () => { mounted = false; clearTimeout(timeoutId); };
  }, [initKey]);

  const setUser = (u: UserData) => {
    setUserState(u);
  };

  const clearUser = () => {
    setUserState(null);
    setError(null);
    AsyncStorage.removeItem('selectedUserId').catch(() => {});
    AsyncStorage.removeItem('@e-dziennik:username').catch(() => {}); // Clear stored username
    // also clear tokens in case of logout
    clearTokens().catch(() => {});
  };

  const retryInit = () => {
    setError(null);
    setReady(false);
    setUserState(null);
    setInitKey(k => k + 1);
  };

  const switchUser = (_userId: number) => {
    // switching mock users removed
    return;
  };

  return (
    <UserContext.Provider value={{ user, users: [], setUser, switchUser, clearUser, ready, error, retryInit }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};

export default function UserContextRoute() {
  return null;
}
