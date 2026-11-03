import { GoogleGenAI } from "@google/genai";
import { logger } from "./logger.js";
import { IRAB_SYSTEM_INSTRUCTION } from "./irabInstructions.js";
import { validateIrabOutput } from "./irabOutputGuard.js";
import {
  getGeminiErrorStatus,
  IrabRetryTimeoutError,
  runWithIrabRetry,
} from "./irabRetry.js";

export const IRAB_MODEL = "gemini-3.8-flash";
export const IRAB_TIMEOUT_MS = 30_000;

export type IrabServiceErrorKind =
  | "configuration"
  | "timeout"
  | "provider-auth"
  | "provider-unavailable"
  | "provider"
  | "invalid-output"
  | "unexpected";

export class IrabServiceError extends Error {
  constructor(
    public readonly kind: IrabServiceErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "IrabServiceError";
  }
}

function providerErrorKind(error: unknown): "provider-auth" | "provider-unavailable" | "provider" {
  const status =
    typeof error === "object" && error !== null && "status" in error && typeof error.status === "number"
      ? error.status
      : undefined;

  if (status === 401 || status === 403) return "provider-auth";
  if (status === 408 || status === 429 || (status !== undefined && status >= 500 && status <= 599)) {
    return "provider-unavailable";
  }
  return "provider";
}

export async function generateIrab(text: string): Promise<string> {
  const startedAt = Date.now();
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    logger.warn({ model: IRAB_MODEL, outcome: "configuration" }, "I‘rab provider is not configured");
    throw new IrabServiceError("configuration", "I‘rab service is not configured");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IRAB_TIMEOUT_MS);

  try {
    const ai = new GoogleGenAI({ apiKey });
    const deadlineAt = startedAt + IRAB_TIMEOUT_MS;
    let successfulAttempt = 1;
    const response = await runWithIrabRetry(
      (attempt) =>
        (async () => {
          successfulAttempt = attempt;
          return ai.models.generateContent({
            model: IRAB_MODEL,
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: [
                      "BEGIN_UNTRUSTED_USER_TEXT",
                      text,
                      "END_UNTRUSTED_USER_TEXT",
                      "Return only the diacritized text between the delimiters.",
                    ].join("\n"),
                  },
                ],
              },
            ],
            config: {
              abortSignal: controller.signal,
              systemInstruction: IRAB_SYSTEM_INSTRUCTION,
              temperature: 0.15,
              candidateCount: 1,
              maxOutputTokens: 12_000,
              responseMimeType: "text/plain",
            },
          });
        })(),
      {
        signal: controller.signal,
        deadlineAt,
        onRetry: ({ attempt, nextAttempt, status, delayMs }) => {
          logger.warn(
            { model: IRAB_MODEL, outcome: "retry", attempt, nextAttempt, status, delayMs },
            "Retrying transient I‘rab provider failure",
          );
        },
      },
    );

    const output = response.text ?? "";
    const guarded = validateIrabOutput(text, output);
    if (!guarded.ok) {
      logger.warn(
        {
          model: IRAB_MODEL,
          outcome: "invalid-output",
          outputReason: guarded.reason,
          durationMs: Date.now() - startedAt,
        },
        "I‘rab provider returned invalid output",
      );
      throw new IrabServiceError("invalid-output", "I‘rab provider returned invalid output");
    }

    logger.info(
      {
        model: IRAB_MODEL,
        outcome: "success",
          attempt: successfulAttempt,
        inputLength: text.length,
        durationMs: Date.now() - startedAt,
      },
      "I‘rab request completed",
    );
    return guarded.text;
  } catch (error) {
    if (error instanceof IrabServiceError) throw error;

    if (controller.signal.aborted || error instanceof IrabRetryTimeoutError) {
      logger.warn(
        { model: IRAB_MODEL, outcome: "timeout", durationMs: Date.now() - startedAt },
        "I‘rab provider request timed out",
      );
      throw new IrabServiceError("timeout", "I‘rab provider request timed out");
    }

    const category = providerErrorKind(error);
    logger.warn(
      {
        model: IRAB_MODEL,
        outcome: category,
        status: getGeminiErrorStatus(error),
        durationMs: Date.now() - startedAt,
      },
      "I‘rab provider request failed",
    );
    throw new IrabServiceError(category, "I‘rab provider request failed");
  } finally {
    clearTimeout(timeout);
  }
}