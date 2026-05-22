import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { authenticatedFetch, clearTokens, decodeJWT, getAccessToken, getApiBaseUrl, login, register } from '../api/auth';
import { PROFILE_ENDPOINTS } from '../api/endpointUtils';
import { calculateWeightedAverage, getUserGrades } from '../api/grades';
import { getTeacherProfile } from '../api/teacher';
import { getStudentProfile } from '../api/users';
import { useUser } from '../context/UserContext';
import { useTheme } from '../theme/ThemeContext';
import PasswordInput from './ui/PasswordInput';

const USERNAME_KEY = '@e-dziennik:username';

export default function UserGate({ children }: { children: React.ReactNode }) {
  const { user, setUser, ready, error, retryInit, clearUser } = useUser();
  const { theme } = useTheme();
  const bg = theme === "dark" ? "#000" : "#fff";
  const textClass = theme === "dark" ? "text-white" : "text-black";
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  // email used for registration only
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const MIN_PASSWORD = 6;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const validateField = (name: string, val: string): string => {
    switch (name) {
      case "username":    return !val.trim() ? "Wpisz login." : "";
      case "email":       return !val.trim() ? "Wpisz adres e-mail." : !EMAIL_RE.test(val) ? "Podaj prawidłowy adres e-mail." : "";
      case "firstName":   return !val.trim() ? "Wpisz imię." : "";
      case "lastName":    return !val.trim() ? "Wpisz nazwisko." : "";
      case "password":    return val.length < MIN_PASSWORD ? `Hasło musi mieć co najmniej ${MIN_PASSWORD} znaków.` : "";
      case "confirmPassword": return val !== password ? "Hasła nie są takie same." : "";
      default:            return "";
    }
  };

  const blurField = (name: string, val: string) => {
    const err = validateField(name, val);
    setErrors((prev) => ({ ...prev, [name]: err }));
  };

  const validateAll = (): boolean => {
    const fields: Record<string, string> = isRegistering
      ? { email, firstName, lastName, password, confirmPassword }
      : { username, password };
    const next: Record<string, string> = {};
    let valid = true;
    for (const [name, val] of Object.entries(fields)) {
      const err = validateField(name, val);
      next[name] = err;
      if (err) valid = false;
    }
    setErrors(next);
    return valid;
  };

  if (!ready) {
    return (
      <View
        style={{ flex: 1, backgroundColor: bg }}
        className="items-center justify-center px-6"
      >
        <ActivityIndicator color={theme === "dark" ? "#fff" : "#000"} />
      </View>
    );
  }
  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: bg }} className="items-center justify-center px-6">
        <Text className={`${textClass} text-lg font-bold mb-4 text-center`}>
          Nie można załadować profilu
        </Text>
        <Text className={`${theme === 'dark' ? 'text-neutral-400' : 'text-gray-600'} text-center mb-8`}>
          {error}
        </Text>
        <TouchableOpacity
          onPress={retryInit}
          accessibilityRole="button"
          className="p-4 rounded-xl bg-blue-500 w-full mb-3"
        >
          <Text className="text-white text-center font-semibold">Spróbuj ponownie</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={clearUser}
          accessibilityRole="button"
          className="p-4 rounded-xl bg-red-500 w-full"
        >
          <Text className="text-white text-center font-semibold">Zaloguj się ponownie</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (user) return <>{children}</>;

  const onLogin = async () => {
    if (!validateAll()) return;

    setLoading(true);
    try {
      let loggedUsername = username;

      if (isRegistering) {
        loggedUsername = email;
        await register(email, password, { email, first_name: firstName, last_name: lastName });
      } else {
        await login(username, password);
      }

      // Store username for later use
      await AsyncStorage.setItem(USERNAME_KEY, loggedUsername);

      // Decode JWT immediately to get role and IDs
      let jwtRole: string | undefined;
      let jwtUczenId: number | undefined;
      let jwtUczenIdRaw: number | undefined; // payload.uczen_id only — Uczen model pk for students
      let jwtUserIdRaw: number | undefined;  // payload.user_id — Django auth User pk for all roles
      let jwtClassId: number | undefined;
      let jwtNauczycielId: number | undefined;
      let jwtName: string | null = null;
      try {
        const access = await getAccessToken();
        const payload = access ? decodeJWT(access) : null;
        if (payload) {
          jwtRole = payload.role;
          jwtUczenIdRaw = payload.uczen_id as number | undefined;
          jwtUserIdRaw = payload.user_id as number | undefined;
          jwtUczenId = payload.uczen_id ?? payload.user_id ?? (payload.id as number | undefined) ?? (payload.sub as number | undefined);
          jwtClassId = payload.klasa_id as number | undefined;
          jwtNauczycielId = payload.nauczyciel_id as number | undefined;
          // infer teacher role from JWT when role field is absent but nauczyciel_id is present
          if (!jwtRole && jwtNauczycielId) jwtRole = 'nauczyciel';
          // CustomTokenObtainPairSerializer embeds first_name + last_name directly in the token
          const fn = payload.first_name as string | undefined;
          const ln = payload.last_name as string | undefined;
          if (fn || ln) jwtName = `${fn ?? ''} ${ln ?? ''}`.trim();
        }
      } catch {
        // ignore
      }

      const TEACHER_ROLE_TAGS = ['nauczyciel', 'teacher', 'admin'];
      const isTeacherRole = (r?: string) => r ? TEACHER_ROLE_TAGS.includes(r.toLowerCase()) : false;

      // Block teacher/admin accounts — this is the student/parent app.
      if (jwtRole && isTeacherRole(jwtRole)) {
        await clearTokens();
        Alert.alert(
          "Nieprawidłowa aplikacja",
          "To konto jest przypisane do roli nauczyciela.\n\nPobierz aplikację E-Dziennik Nauczyciel, aby się zalogować.",
          [{ text: "OK" }]
        );
        return;
      }

      if (__DEV__) console.log("[UserGate] Stored username:", loggedUsername);

      // after successful auth, fetch the server-side profile.
      // /api/profile/ is tried first because it has an account_type field we use for role detection.
      type ProfileJson = {
        account_type?: string;
        user?: { account_type?: string; first_name?: string; last_name?: string; [key: string]: unknown };
        uczen?: { account_type?: string; first_name?: string; last_name?: string; [key: string]: unknown };
        first_name?: string; last_name?: string; firstName?: string; lastName?: string;
        given_name?: string; family_name?: string; imie?: string; nazwisko?: string;
        name?: string; username?: string;
        [key: string]: unknown;
      } | null;
      let profileJson: ProfileJson = null;
      try {
        const base = getApiBaseUrl();
        const candidates = PROFILE_ENDPOINTS;
        try {
          profileJson = await Promise.any(
            candidates.map(async (ep) => {
              const res = await authenticatedFetch(`${base}${ep}`);
              if (!res || !res.ok) throw new Error('not ok');
              const json = await res.json().catch(() => null);
              if (!json) throw new Error('no json');
              return json;
            })
          );
        } catch {
          // all endpoints failed — profileJson stays null
        }
      } catch {
        // ignore profile fetch errors
      }

      // Detect role from account_type field returned by /api/profile/.
      // This is the primary detection method — JWT role is the fallback when profile is unavailable.
      if (profileJson && !jwtRole) {
        const accountType: string | undefined =
          profileJson.account_type ??
          profileJson.user?.account_type ??
          profileJson.uczen?.account_type;
        if (accountType) jwtRole = accountType.toLowerCase();
      }

      // Last resort: probe teacher endpoint if role is still unknown after profile + JWT.
      let cachedTeacherRecord: Awaited<ReturnType<typeof getTeacherProfile>> = null;
      if (!jwtRole) {
        try {
          cachedTeacherRecord = await getTeacherProfile(jwtNauczycielId);
          if (cachedTeacherRecord) jwtRole = 'nauczyciel';
        } catch {
          // not a teacher or endpoint unavailable
        }
      }

      const normalizeName = (p: ProfileJson) => {
        if (!p) return null;
        const candidate = p.user ?? p.uczen ?? p;
        const first =
          candidate.first_name ??
          candidate.firstName ??
          candidate.given_name ??
          candidate.imie ??
          null;
        const last =
          candidate.last_name ??
          candidate.lastName ??
          candidate.family_name ??
          candidate.nazwisko ??
          null;
        if (first || last) return `${first ?? ""} ${last ?? ""}`.trim();
        return candidate.name ?? candidate.username ?? null;
      };

      // Helper: resolve a real first/last name from /api/uczniowie/{id}/ when
      // the /me endpoints don't give us one. We also use this as a fallback
      // when /me returned a profile but it didn't include the name fields.
      const resolveNameFromUczniowie = async (
        studentId: number,
      ): Promise<string | null> => {
        try {
          const studentProfile = await getStudentProfile(studentId);
          if (!studentProfile) return null;
          const candidate =
            `${studentProfile.first_name ?? ""} ${studentProfile.last_name ?? ""}`.trim();
          return candidate || null;
        } catch {
          return null;
        }
      };

      const resolveNameFromNauczyciel = async (): Promise<string | null> => {
        // JWT name is the most reliable source — no extra API call needed
        if (jwtName) return jwtName;
        try {
          const tp = cachedTeacherRecord ?? await getTeacherProfile(jwtNauczycielId);
          if (!tp) return null;
          const candidate = `${tp.first_name ?? ''} ${tp.last_name ?? ''}`.trim();
          return candidate || tp.username || null;
        } catch {
          return null;
        }
      };

      if (profileJson) {
        const candidate = profileJson.user ?? profileJson.uczen ?? profileJson;
        const profileId =
          Number(candidate.id ?? candidate.pk ?? profileJson.id ?? null) ||
          undefined;
        // JWT uczen_id is the correct Uczen model pk for students.
        // Profile endpoints return Django auth User.id which differs from Uczen.id.
        // For teachers/parents (no uczen_id), fall back to user_id from JWT.
        const id = jwtUczenIdRaw ?? profileId ?? jwtUserIdRaw;
        let name = normalizeName(profileJson);
        const profileUsername =
          candidate.username ?? candidate.userName ?? loggedUsername;
        const attendance = profileJson.attendance ??
          profileJson.presence ?? {
            percentage: "",
            present: 0,
            late: 0,
            absent: 0,
          };
        const grades = profileJson.grades ?? { average: "", behavior: "" };

        // If /me didn't include the name fields, try role-appropriate profile endpoint.
        if (!name || name === "Użytkownik") {
          if (isTeacherRole(jwtRole)) {
            const fromNauczyciel = await resolveNameFromNauczyciel();
            if (fromNauczyciel) name = fromNauczyciel;
          } else if (id) {
            const fromUczniowie = await resolveNameFromUczniowie(id);
            if (fromUczniowie) name = fromUczniowie;
          }
        }
        // Last resort: if the user just registered, use what they typed.
        if ((!name || name === "Użytkownik") && (firstName || lastName)) {
          name = `${firstName ?? ""} ${lastName ?? ""}`.trim();
        }

        const userObj = {
          id: id ?? -1,
          serverId: id ?? undefined,
          name: name || "Użytkownik",
          username: profileUsername,
          role: jwtRole,
          classId: jwtClassId,
          attendance,
          grades,
        } as any;
        if (__DEV__) console.debug('[UserGate] setting user from server profile', userObj);
        setUser(userObj);
      } else {
        // Try role-appropriate profile endpoint as a real-name source.
        const jwtId = jwtUczenId;
        let fallbackName: string | null = null;
        if (isTeacherRole(jwtRole)) {
          fallbackName = await resolveNameFromNauczyciel();
        } else if (jwtId && jwtId > 0) {
          fallbackName = await resolveNameFromUczniowie(jwtId);
        }
        if (!fallbackName && (firstName || lastName)) {
          fallbackName = `${firstName ?? ""} ${lastName ?? ""}`.trim() || null;
        }

        const fallbackUser = {
          id: jwtId ?? -1,
          serverId: jwtId ?? undefined,
          name: fallbackName || "Użytkownik",
          username: loggedUsername,
          role: jwtRole,
          classId: jwtClassId,
          attendance: { percentage: "", present: 0, late: 0, absent: 0 },
          grades: { average: "", behavior: "" },
        } as any;
        setUser(fallbackUser);

        // If we managed to get a numeric id from JWT, try to fetch grades immediately so UI updates
        if (jwtId && typeof jwtId === "number" && jwtId > 0) {
          try {
            const gradesRes = await getUserGrades(jwtId as number);
            const all = gradesRes.subjects.flatMap((s) => s.grades);
            const avg = calculateWeightedAverage(all);
            // update the user we just set with fetched grades
            setUser({ ...fallbackUser, grades: { average: avg ?? '', behavior: gradesRes.behavior ? '' : (fallbackUser?.grades?.behavior ?? '') } });
          } catch {
            // ignore grade fetch errors
          }
        }
      }
    } catch (e: any) {
      // If backend returned 401 Unauthorized, show a clearer message
      if (e && typeof e.status === "number" && e.status === 401) {
        Alert.alert("Błąd logowania", "Login lub hasło jest nieprawidłowe");
      } else {
        Alert.alert("Błąd logowania", e?.message ?? "Nie udało się zalogować");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View
      style={{ flex: 1, backgroundColor: bg }}
      className="items-center justify-center px-6"
    >
      <Text className={`${textClass} text-2xl font-bold mb-6`}>
        Zaloguj się
      </Text>
      <View className="w-full">
        {isRegistering ? (
          <>
            <Text className={`${textClass} mb-2`}>Email</Text>
            <TextInput
              value={email}
              onChangeText={(v) => { setEmail(v); setErrors((p) => ({ ...p, email: "" })); }}
              onBlur={() => blurField("email", email)}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              className={`p-3 rounded-xl ${theme === "dark" ? "bg-neutral-900 border border-neutral-800 text-white" : "bg-white border border-gray-200 text-black"}`}
            />
            {errors.email ? <Text className="text-red-500 text-xs mt-1 mb-2">{errors.email}</Text> : <View className="mb-3" />}

            <Text className={`${textClass} mb-2`}>Imię</Text>
            <TextInput
              value={firstName}
              onChangeText={(v) => { setFirstName(v); setErrors((p) => ({ ...p, firstName: "" })); }}
              onBlur={() => blurField("firstName", firstName)}
              className={`p-3 rounded-xl ${theme === "dark" ? "bg-neutral-900 border border-neutral-800 text-white" : "bg-white border border-gray-200 text-black"}`}
            />
            {errors.firstName ? <Text className="text-red-500 text-xs mt-1 mb-2">{errors.firstName}</Text> : <View className="mb-3" />}

            <Text className={`${textClass} mb-2`}>Nazwisko</Text>
            <TextInput
              value={lastName}
              onChangeText={(v) => { setLastName(v); setErrors((p) => ({ ...p, lastName: "" })); }}
              onBlur={() => blurField("lastName", lastName)}
              className={`p-3 rounded-xl ${theme === "dark" ? "bg-neutral-900 border border-neutral-800 text-white" : "bg-white border border-gray-200 text-black"}`}
            />
            {errors.lastName ? <Text className="text-red-500 text-xs mt-1 mb-2">{errors.lastName}</Text> : <View className="mb-3" />}

            <Text className={`${textClass} mb-2`}>Hasło</Text>
            <PasswordInput
              value={password}
              onChangeText={(v) => { setPassword(v); setErrors((p) => ({ ...p, password: "", confirmPassword: "" })); }}
              onBlur={() => blurField("password", password)}
              placeholder=""
            />
            {errors.password ? <Text className="text-red-500 text-xs mt-1 mb-2">{errors.password}</Text> : <View className="mb-3" />}

            <Text className={`${textClass} mb-2`}>Powtórz hasło</Text>
            <PasswordInput
              value={confirmPassword}
              onChangeText={(v) => { setConfirmPassword(v); setErrors((p) => ({ ...p, confirmPassword: "" })); }}
              onBlur={() => blurField("confirmPassword", confirmPassword)}
              placeholder=""
            />
            {errors.confirmPassword ? <Text className="text-red-500 text-xs mt-1 mb-4">{errors.confirmPassword}</Text> : <View className="mb-4" />}
          </>
        ) : (
          <>
            <Text className={`${textClass} mb-2`}>Login</Text>
            <TextInput
              value={username}
              onChangeText={(v) => { setUsername(v); setErrors((p) => ({ ...p, username: "" })); }}
              onBlur={() => blurField("username", username)}
              autoCapitalize="none"
              autoCorrect={false}
              className={`p-3 rounded-xl ${theme === "dark" ? "bg-neutral-900 border border-neutral-800 text-white" : "bg-white border border-gray-200 text-black"}`}
            />
            {errors.username ? <Text className="text-red-500 text-xs mt-1 mb-2">{errors.username}</Text> : <View className="mb-3" />}

            <Text className={`${textClass} mb-2`}>Hasło</Text>
            <PasswordInput
              value={password}
              onChangeText={(v) => { setPassword(v); setErrors((p) => ({ ...p, password: "" })); }}
              onBlur={() => blurField("password", password)}
              placeholder=""
            />
            {errors.password ? <Text className="text-red-500 text-xs mt-1 mb-4">{errors.password}</Text> : <View className="mb-4" />}
          </>
        )}

        <TouchableOpacity
          onPress={onLogin}
          disabled={loading}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={isRegistering ? "Zarejestruj się" : "Zaloguj się"}
          accessibilityState={{ disabled: loading }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          className={`p-4 rounded-xl ${theme === "dark" ? "bg-blue-600" : "bg-blue-500"} ${loading ? "opacity-60" : ""}`}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white text-center font-semibold">
              {isRegistering ? "Zarejestruj się" : "Zaloguj"}
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => { setIsRegistering((s) => !s); setErrors({}); }}
          accessibilityRole="button"
          accessibilityLabel={isRegistering ? "Masz już konto? Zaloguj się" : "Nie masz konta? Zarejestruj się"}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          className="mt-3"
        >
          <Text
            className={`${theme === "dark" ? "text-neutral-300" : "text-gray-600"} text-center`}
          >
            {isRegistering
              ? "Masz już konto? Zaloguj się"
              : "Nie masz konta? Zarejestruj się"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
