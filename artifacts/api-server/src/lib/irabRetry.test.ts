import assert from "node:assert/strict";
import test from "node:test";
import {
  IRAB_MAX_ATTEMPTS,
  IrabRetryTimeoutError,
  isTransientGeminiError,
  runWithIrabRetry,
} from "./irabRetry.js";

const error = (status: number) => Object.assign(new Error(`Gemini ${status}`), { status });

test("does not retry a successful first attempt", async () => {
  let attempts = 0;
  const result = await runWithIrabRetry(
    async () => {
      attempts += 1;
      return "ok";
    },
    { signal: new AbortController().signal, deadlineAt: Infinity },
  );

  assert.equal(result, "ok");
  assert.equal(attempts, 1);
});

test("retries transient failures with 1, 3, and 5 second delays", async () => {
  let attempts = 0;
  const delays: number[] = [];
  const result = await runWithIrabRetry(
    async () => {
      attempts += 1;
      if (attempts < 4) throw error(503);
      return "ok";
    },
    {
      signal: new AbortController().signal,
      deadlineAt: Infinity,
      sleep: async (delayMs) => {
        delays.push(delayMs);
      },
    },
  );

  assert.equal(result, "ok");
  assert.equal(attempts, 4);
  assert.deepEqual(delays, [1_000, 3_000, 5_000]);
});

test("returns the final provider failure after four total attempts", async () => {
  let attempts = 0;
  await assert.rejects(
    runWithIrabRetry(
      async () => {
        attempts += 1;
        throw error(503);
      },
      {
        signal: new AbortController().signal,
        deadlineAt: Infinity,
        sleep: async () => {},
      },
    ),
    (caught) => (caught as Error & { status?: number }).status === 503,
  );
  assert.equal(attempts, IRAB_MAX_ATTEMPTS);
});

test("retries 408, 429, and transient 5xx but not permanent errors", () => {
  for (const status of [408, 429, 500, 502, 503, 599]) {
    assert.equal(isTransientGeminiError(error(status)), true, `${status} should retry`);
  }
  for (const status of [400, 401, 403, 404]) {
    assert.equal(isTransientGeminiError(error(status)), false, `${status} should not retry`);
  }
  assert.equal(isTransientGeminiError(new Error("missing configuration")), false);
});

test("permanent 400/401/403 errors stop after one attempt without sleeping", async () => {
  for (const status of [400, 401, 403]) {
    let attempts = 0;
    await assert.rejects(runWithIrabRetry(async () => {
      attempts++;
      throw error(status);
    }, { signal: new AbortController().signal, deadlineAt: Infinity,
      sleep: async () => { throw new Error("permanent errors must never retry"); },
    }), (caught) => (caught as { status?: number }).status === status);
    assert.equal(attempts, 1);
  }
});

test("stops before waiting when the shared deadline cannot fit the next delay", async () => {
  let attempts = 0;
  await assert.rejects(
    runWithIrabRetry(
      async () => {
        attempts += 1;
        throw error(503);
      },
      {
        signal: new AbortController().signal,
        deadlineAt: 999,
        now: () => 0,
        sleep: async () => {
          throw new Error("sleep should not be called");
        },
      },
    ),
    IrabRetryTimeoutError,
  );
  assert.equal(attempts, 1);
});