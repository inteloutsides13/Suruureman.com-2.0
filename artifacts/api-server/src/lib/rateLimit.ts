import type { NextFunction, Request, Response } from "express";

type RateLimitOptions = {
  windowMs: number;
  max: number;
  prefix: string;
  responseBody?: Record<string, unknown>;
};

type Counter = { count: number; resetAt: number };

export function createRateLimiter({ windowMs, max, prefix, responseBody }: RateLimitOptions) {
  const counters = new Map<string, Counter>();

  return function rateLimiter(req: Request, res: Response, next: NextFunction): void {
    const now = Date.now();
    const key = `${prefix}:${req.ip ?? req.socket.remoteAddress ?? "unknown"}`;
    const current = counters.get(key);
    const counter =
      !current || current.resetAt <= now
        ? { count: 0, resetAt: now + windowMs }
        : current;

    counter.count += 1;
    counters.set(key, counter);

    if (counters.size > 10_000) {
      for (const [entryKey, entry] of counters) {
        if (entry.resetAt <= now) counters.delete(entryKey);
      }
    }

    if (counter.count > max) {
      res.setHeader("Retry-After", Math.max(1, Math.ceil((counter.resetAt - now) / 1000)));
      res.status(429).json(responseBody ?? { message: "Too many requests" });
      return;
    }

    next();
  };
}

export const adminLoginRateLimit = createRateLimiter({
  prefix: "admin-login",
  windowMs: 15 * 60 * 1000,
  max: 10,
});

export const radioAdminRateLimit = createRateLimiter({
  prefix: "radio-admin",
  windowMs: 60 * 1000,
  max: 120,
});

export const radioMachineRateLimit = createRateLimiter({
  prefix: "radio-machine",
  windowMs: 60 * 1000,
  max: 240,
});

export const contributorStatusRateLimit = createRateLimiter({
  prefix: "contributor-status",
  windowMs: 15 * 60 * 1000,
  max: 20,
});

export const irabRateLimit = createRateLimiter({
  prefix: "irab-text",
  windowMs: 15 * 60 * 1000,
  max: 5,
  responseBody: { success: false, error: "Too many requests" },
});