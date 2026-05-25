export const isAbortError = (err: unknown): boolean =>
  err instanceof Error && (err.name === 'AbortError' || err.message.includes('aborted'));

export function fetchWithTimeout(
  url: RequestInfo,
  options: RequestInit = {},
  ms = 30_000,
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(id));
}

const RETRYABLE_STATUSES = new Set([502, 503, 504, 429]);

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = 3,
  baseDelay = 500,
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchWithTimeout(url, options);
      if (!res.ok && attempt < retries && RETRYABLE_STATUSES.has(res.status)) {
        const delay = baseDelay * 2 ** attempt;
        if (__DEV__) console.log(`[fetchWithRetry] status=${res.status}, retry ${attempt + 1}/${retries} in ${delay}ms`);
        await sleep(delay);
        continue;
      }
      return res;
    } catch (err) {
      if (isAbortError(err)) throw err;
      if (attempt === retries) throw err;
      const delay = baseDelay * 2 ** attempt;
      if (__DEV__) console.log(`[fetchWithRetry] network error, retry ${attempt + 1}/${retries} in ${delay}ms`, err);
      await sleep(delay);
    }
  }
  throw new Error('fetchWithRetry: wszystkie próby wyczerpane');
}
