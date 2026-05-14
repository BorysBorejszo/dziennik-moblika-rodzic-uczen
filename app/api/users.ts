// User API functions

import { authenticatedFetch, getApiBaseUrl } from './auth';
import { getAllMessages } from './messages';
import { ADMIN_KEY } from './constants';

export type UserRecord = {
  id: number; // ID from uczniowie table - NOT the same as Django user.id!
  username: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  telefon?: string;
  data_urodzenia?: string;
};

export type DjangoUserMapping = {
  username: string;
  django_user_id: number;
  uczniowie_id?: number;
};


const headers = () => ({
  'ADMIN-KEY': ADMIN_KEY,
  'Content-Type': 'application/json',
});

// Cache for username -> Django user.id mapping
let userMappingCache: Map<string, number> | null = null;

// Build mapping from messages in database
export const buildUserMapping = async (): Promise<Map<string, number>> => {
  if (__DEV__) console.log('[users] Building username -> Django user.id mapping from messages...');
  
  try {
    const allMessages = await getAllMessages();
    const mapping = new Map<string, number>();
    
    allMessages.forEach((msg: any) => {
      // Add sender mapping
      if (msg.nadawca_username && msg.nadawca_id) {
        mapping.set(String(msg.nadawca_username).toLowerCase(), msg.nadawca_id);
      }
      // Add recipient mapping
      if (msg.odbiorca_username && msg.odbiorca_id) {
        mapping.set(String(msg.odbiorca_username).toLowerCase(), msg.odbiorca_id);
      }
    });
    
    if (__DEV__) console.log('[users] Built mapping for', mapping.size, 'users');
    if (__DEV__) console.log('[users] Sample mappings:', Array.from(mapping.entries()).slice(0, 5));
    
    userMappingCache = mapping;
    return mapping;
  } catch (error) {
    console.error('[users] buildUserMapping error:', error);
    return new Map();
  }
};

// Find Django user.id by username
export const findDjangoUserIdByUsername = async (username: string): Promise<number | null> => {
  // Build cache if not exists
  if (!userMappingCache) {
    await buildUserMapping();
  }
  
  const userId = userMappingCache?.get(username.toLowerCase()) || null;
  
  if (userId) {
    if (__DEV__) console.log('[users] ✅ Found Django user.id for', username, ':', userId);
  } else {
    if (__DEV__) console.log('[users] ❌ No Django user.id found for', username);
    if (__DEV__) console.log('[users] Available usernames:', Array.from(userMappingCache?.keys() || []).slice(0, 10));
  }
  
  return userId;
};

// Find username by Django user.id (reverse lookup)
export const findUsernameByDjangoUserId = async (userId: number): Promise<string | null> => {
  // Build cache if not exists
  if (!userMappingCache) {
    await buildUserMapping();
  }
  
  // Reverse search through the map
  for (const [username, id] of userMappingCache?.entries() || []) {
    if (id === userId) {
      if (__DEV__) console.log('[users] ✅ Found username for Django user.id', userId, ':', username);
      return username;
    }
  }
  
  if (__DEV__) console.log('[users] ❌ No username found for Django user.id', userId);
  return null;
};

// GET all users from uczniowie table
export const getAllUsers = async (): Promise<UserRecord[]> => {
  try {
    const response = await authenticatedFetch(`${getApiBaseUrl()}/api/uczniowie/`, { headers: headers() });
    if (!response.ok) {
      console.error('[users] Failed to fetch users:', response.status);
      return [];
    }
    const data = await response.json();
    if (__DEV__) console.log('[users] Fetched users:', data.length);
    return data;
  } catch (error) {
    console.error('[users] getAllUsers error:', error);
    return [];
  }
};

// Fetch a single student record from the uczniowie table by id and normalize
// name fields. The /api/auth/me/ etc. endpoints don't always exist on this
// backend, but /api/uczniowie/{id}/ does, so this is the reliable way to
// resolve the logged-in user's first/last name from their uczen_id.
export const getStudentProfile = async (
  studentId: number
): Promise<UserRecord | null> => {
  if (!studentId || studentId <= 0) return null;
  try {
    const res = await authenticatedFetch(
      `${getApiBaseUrl()}/api/uczniowie/${studentId}/`,
      { headers: headers() }
    );
    if (!res.ok) return null;
    const json = await res.json().catch(() => null);
    if (!json) return null;
    const candidate = json.user ?? json.uczen ?? json;
    const first =
      candidate.first_name ??
      candidate.firstName ??
      candidate.given_name ??
      candidate.imie ??
      json.imie ??
      json.first_name ??
      undefined;
    const last =
      candidate.last_name ??
      candidate.lastName ??
      candidate.family_name ??
      candidate.nazwisko ??
      json.nazwisko ??
      json.last_name ??
      undefined;
    return {
      id: Number(json.id ?? json.pk ?? candidate.id ?? candidate.pk ?? studentId),
      username: candidate.username ?? json.username ?? '',
      email: candidate.email ?? json.email,
      first_name: first ? String(first) : undefined,
      last_name: last ? String(last) : undefined,
      telefon: candidate.telefon ?? json.telefon,
      data_urodzenia: candidate.data_urodzenia ?? json.data_urodzenia,
    };
  } catch (error) {
    console.warn('[users] getStudentProfile failed:', error);
    return null;
  }
};

// Find user by username - RETURNS uczniowie.id for messages!
export const findUserByUsername = async (username: string): Promise<UserRecord | null> => {
  try {
    const users = await getAllUsers();
    if (__DEV__) console.log('[users] 🔍 Searching for username:', username);
    if (__DEV__) console.log('[users] Total users to search:', users.length);
    
    const found = users.find(u => {
      const matches = u.username.toLowerCase() === username.toLowerCase();
      if (matches) {
        if (__DEV__) console.log('[users] ✅ MATCH! Full user record:', JSON.stringify(u, null, 2));
        if (__DEV__) console.log('[users] USE THIS ID FOR MESSAGES:', u.id);
      }
      return matches;
    });
    
    if (found) {
      if (__DEV__) console.log('[users] Found user:', { 
        username, 
        uczniowie_id: found.id,
        USE_FOR_MESSAGES: found.id
      });
    } else {
      if (__DEV__) console.log('[users] ❌ User NOT found:', username);
      if (__DEV__) console.log('[users] Available usernames (first 10):', users.slice(0, 10).map(u => u.username));
    }
    return found || null;
  } catch (error) {
    console.error('[users] findUserByUsername error:', error);
    return null;
  }
};

export default function UsersApiRoute() {
  return null;
}
