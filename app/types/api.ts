// Server-side profile shape returned by /api/profile/, /api/auth/user/, etc.
export interface UserProfile {
  id?: number;
  user_id?: number;
  pk?: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  role?: string;
  account_type?: string;
  uczen_id?: number;
  nauczyciel_id?: number;
  klasa_id?: number;
  user?: {
    id?: number;
    username?: string;
    first_name?: string;
    last_name?: string;
    account_type?: string;
    [key: string]: unknown;
  };
  uczen?: {
    id?: number;
    username?: string;
    first_name?: string;
    last_name?: string;
    account_type?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface Grade {
  id: number;
  value: number | string;
  label?: string;
  subject?: string;
  date?: string;
  semester?: 1 | 2;
  waga?: number;
  czy_do_sredniej?: boolean;
}

export interface Message {
  id: number;
  sender: string;
  subject: string;
  preview: string;
  time: string;
  unread: boolean;
  avatar?: string;
  raw?: unknown;
}

// Generic paginated DRF response
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// Raw unknown-but-structured API JSON
export type RawApiRecord = Record<string, unknown>;
