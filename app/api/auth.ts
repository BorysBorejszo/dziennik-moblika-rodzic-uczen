/**
 * Small authentication helper for the mock/local API.
 *
 * Usage:
 * import { login, setApiBaseUrl } from '../api/auth';
 * await setApiBaseUrl('http://127.0.0.1');
 * const tokens = await login('user', 'pass');
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

export type LoginResponse = {
  access: string;
  refresh: string;
};

export class ApiError extends Error {
  status?: number;
  details?: string;
  constructor(message: string, status?: number, details?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

// Simple JWT decode helper
export const decodeJWT = (token: string): any => {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    // Fallback if atob is not available or fails
    console.warn("JWT decode failed", e);
    return null;
  }
};

// Polyfill atob if needed (for React Native environment)
if (typeof global.atob === "undefined") {
  global.atob = (input: string) => {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    let str = input.replace(/=+$/, "");
    let output = "";
    if (str.length % 4 === 1) {
      throw new Error(
        "'atob' failed: The string to be decoded is not correctly encoded.",
      );
    }
    for (
      let bc = 0, bs = 0, buffer, i = 0;
      (buffer = str.charAt(i++));
      ~buffer && ((bs = bc % 4 ? bs * 64 + buffer : buffer), bc++ % 4)
        ? (output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6))))
        : 0
    ) {
      buffer = chars.indexOf(buffer);
    }
    return output;
  };
}

// default to the remote dziennik server
// default to the remote dziennik server (prefer HTTPS)
let BASE_URL = 'https://modea.polandcentral.cloudapp.azure.com';
const ACCESS_KEY = '@e-dziennik:access';
const REFRESH_KEY = '@e-dziennik:refresh';

export const setApiBaseUrl = (url: string) => {
  // Remove trailing slash for consistency
  BASE_URL = url.replace(/\/$/, "");
};

export const getApiBaseUrl = () => BASE_URL;

/**
 * Send credentials to the server and return access/refresh tokens.
 * Also persists tokens to AsyncStorage.
 */
export const login = async (
  username: string,
  password: string,
): Promise<LoginResponse> => {
  const url = `${BASE_URL}/api/auth/login/`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    let text = await res.text();
    try {
      const json = JSON.parse(text);
      if (json.detail) text = json.detail;
      else text = JSON.stringify(json);
    } catch {
      // keep raw text
    }
    throw new ApiError(
      `Login failed (${res.status}): ${text}`,
      res.status,
      text,
    );
  }

  const data = await res.json();
  if (
    !data ||
    typeof data.access !== "string" ||
    typeof data.refresh !== "string"
  ) {
    throw new Error("Login response has unexpected shape");
  }

  await storeTokens(data.access, data.refresh);
  return { access: data.access, refresh: data.refresh };
};

/**
 * Register a new account. Expects the backend to return the same { access, refresh } shape.
 * If registration succeeds tokens are persisted the same as login.
 */
export const register = async (
  username: string,
  password: string,
  extra: Record<string, any> = {},
): Promise<LoginResponse> => {
  const url = `${BASE_URL}/api/auth/register/`;

  const body = JSON.stringify({ username, password, ...extra });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  if (!res.ok) {
    let text = await res.text();
    try {
      const json = JSON.parse(text);
      if (json.detail) text = json.detail;
      else text = JSON.stringify(json);
    } catch {
      // keep raw
    }
    throw new ApiError(
      `Registration failed (${res.status}): ${text}`,
      res.status,
      text,
    );
  }

  const data = await res.json();
  if (
    !data ||
    typeof data.access !== "string" ||
    typeof data.refresh !== "string"
  ) {
    throw new Error("Registration response has unexpected shape");
  }

  await storeTokens(data.access, data.refresh);
  return { access: data.access, refresh: data.refresh };
};

export const storeTokens = async (access: string, refresh: string) => {
  try {
    await AsyncStorage.multiSet([
      [ACCESS_KEY, access],
      [REFRESH_KEY, refresh],
    ]);
  } catch (e) {
    // non-fatal; tokens remain in memory only
    console.warn("Failed to persist tokens", e);
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(ACCESS_KEY);
  } catch {
    return null;
  }
};

// Try to extract a Django user id from the stored access token payload.
export const getDjangoIdFromToken = async (): Promise<number | null> => {
  try {
    const token = await getAccessToken();
    if (!token) return null;
    const payload = decodeJWT(token);
    if (!payload || typeof payload !== "object") return null;

    // Candidate keys that might hold Django user id in different deployments
    const candidates = [
      "user_id",
      "id",
      "uczen_id",
      "django_user_id",
      "auth_user_id",
      "sub",
      "pk",
      "user",
    ];
    for (const key of candidates) {
      if (key in payload) {
        const val = payload[key];
        const num = Number(val);
        if (!Number.isNaN(num) && num > 0) return num;
        // payload.user may be an object
        if (key === "user" && typeof val === "object" && val !== null) {
          const inner = Number(val.id ?? val.user_id ?? val.pk ?? null);
          if (!Number.isNaN(inner) && inner > 0) return inner;
        }
      }
    }
    return null;
  } catch (e) {
    console.debug('[auth] getDjangoIdFromToken failed', e);
    return null;
  }
};

export const getRefreshToken = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
};

export const clearTokens = async () => {
  try {
    await AsyncStorage.multiRemove([ACCESS_KEY, REFRESH_KEY]);
  } catch (e) {
    console.warn("Failed to clear tokens", e);
  }
};

let refreshPromise: Promise<LoginResponse | null> | null = null;

/**
 * Call the refresh endpoint and persist new tokens.
 * Ensures only one refresh runs at a time.
 */
export const refreshAuth = async (): Promise<LoginResponse | null> => {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refresh = await getRefreshToken();
    if (!refresh) {
      refreshPromise = null;
      return null;
    }

    const url = `${BASE_URL}/api/auth/refresh/`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });

      if (!res.ok) {
        // refresh failed -> clear stored tokens
        await clearTokens();
        refreshPromise = null;
        return null;
      }

      const data = await res.json();
      // Some backends return { access } only; others may return both
      if (!data || typeof data.access !== "string") {
        await clearTokens();
        refreshPromise = null;
        return null;
      }

      const newAccess = data.access;
      const newRefresh =
        typeof data.refresh === "string" ? data.refresh : refresh;
      await storeTokens(newAccess, newRefresh);
      refreshPromise = null;
      return { access: newAccess, refresh: newRefresh };
    } catch {
      await clearTokens();
      refreshPromise = null;
      return null;
    }
  })();

  return refreshPromise;
};

/**
 * Wrapper around fetch which attaches Authorization header (Bearer access).
 * On 401 it will attempt to refresh tokens once and retry the request.
 */
export const authenticatedFetch = async (
  input: RequestInfo,
  init: RequestInit = {},
) => {
  const tryFetch = async (access?: string) => {
    const headers = new Headers(init.headers || {});
    if (!(init.body instanceof FormData)) {
      headers.set("Content-Type", headers.get("Content-Type") ?? "application/json");
    }
    if (access) headers.set("Authorization", `Bearer ${access}`);

    return fetch(input, { ...init, headers });
  };

  const access = await getAccessToken();
  let res = await tryFetch(access ?? undefined);

  if (res.status !== 401) return res;

  // Try to refresh
  const refreshed = await refreshAuth();
  if (!refreshed) {
    // no refresh possible
    return res;
  }

  // retry with new access token
  res = await tryFetch(refreshed.access);
  return res;
};

export default {
  login,
  setApiBaseUrl,
  getApiBaseUrl,
  storeTokens,
  getAccessToken,
  getRefreshToken,
  clearTokens,
  refreshAuth,
  authenticatedFetch,
  register,
};

// Attempt to resolve the current user's Django user.id by querying common profile endpoints.
// Returns numeric id when found or null.
export const getCurrentDjangoUserId = async (): Promise<number | null> => {
  const endpoints = [
    "/api/auth/user/",
    "/api/auth/me/",
    "/api/users/me/",
    "/api/user/",
    "/api/profile/",
    "/api/uzytkownicy/me/",
    "/api/uczniowie/me/",
  ];

  for (const ep of endpoints) {
    try {
      const url = ep.startsWith("http")
        ? ep
        : `${getApiBaseUrl().replace(/\/$/, "")}${ep}`;
      const res = await authenticatedFetch(url);
      if (!res || !res.ok) continue;
      const json = await res.json().catch(() => null);
      if (!json) continue;

      // candidate shapes
      const candidate = json.user ?? json.uczen ?? json;
      const id = Number(
        candidate.user_id ??
          candidate.id ??
          candidate.pk ??
          candidate.uczen_id ??
          candidate.django_user_id ??
          null,
      );
      if (id && !Number.isNaN(id)) return id;
    } catch (e) {
      // ignore and try next
      console.debug('[auth] getCurrentDjangoUserId try failed for', ep, e);
      continue;
    }
  }

  return null;
};
