import { USAGE_QUOTA_FETCH_TIMEOUT_MS } from "./config";

export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = USAGE_QUOTA_FETCH_TIMEOUT_MS,
  signal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const abort = (): void => controller.abort(signal?.reason);

  if (signal?.aborted) {
    abort();
  } else {
    signal?.addEventListener("abort", abort, { once: true });
  }

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    signal?.removeEventListener("abort", abort);
    clearTimeout(timeout);
  }
}
