export const IRAB_RETRY_DELAYS_MS = [1_000, 3_000, 5_000] as const;
export const IRAB_MAX_ATTEMPTS = IRAB_RETRY_DELAYS_MS.length + 1;

export class IrabRetryTimeoutError extends Error {
  constructor() {
    super("I‘rab retry deadline reached");
    this.name = "IrabRetryTimeoutError";
  }
}

export function getGeminiErrorStatus(error: unknown): number | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
  ) {
    return error.status;
  }
  return undefined;
}

export function isTransientGeminiError(error: unknown): boolean {
  const status = getGeminiErrorStatus(error);
  return status === 408 || status === 429 || (status !== undefined && status >= 500 && status <= 599);
}

type RetryOptions = {
  signal: AbortSignal;
  deadlineAt: number;
  now?: () => number;
  sleep?: (delayMs: number, signal: AbortSignal) => Promise<void>;
  onRetry?: (details: {
    attempt: number;
    nextAttempt: number;
    status?: number;
    delayMs: number;
  }) => void;
};

function sleepWithAbort(delayMs: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new IrabRetryTimeoutError());
      return;
    }

    const timeout = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);
    const onAbort = () => {
      clearTimeout(timeout);
      reject(new IrabRetryTimeoutError());
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export async function runWithIrabRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? sleepWithAbort;

  for (let attempt = 1; attempt <= IRAB_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      const delayMs = IRAB_RETRY_DELAYS_MS[attempt - 1];
      if (!isTransientGeminiError(error) || delayMs === undefined) {
        throw error;
      }

      const remainingMs = options.deadlineAt - now();
      if (remainingMs <= delayMs) {
        throw new IrabRetryTimeoutError();
      }

      options.onRetry?.({
        attempt,
        nextAttempt: attempt + 1,
        status: getGeminiErrorStatus(error),
        delayMs,
      });
      await sleep(delayMs, options.signal);
    }
  }

  throw new Error("I‘rab retry loop exhausted");
}