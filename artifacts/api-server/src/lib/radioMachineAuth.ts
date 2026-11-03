import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { radioMachineRateLimit } from "./rateLimit.js";

const MAX_CLOCK_SKEW_SECONDS = 5 * 60;
const usedNonces = new Map<string, number>();

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function requestBodyDigest(req: Request): string {
  return createHash("sha256").update(req.method === "GET" ? "" : canonicalJson(req.body ?? {})).digest("hex");
}

function signatureFor(req: Request, timestamp: string, nonce: string, secret: string): Buffer {
  const path = req.originalUrl.split("?")[0];
  const message = [timestamp, nonce, req.method.toUpperCase(), path, requestBodyDigest(req)].join(".");
  return createHmac("sha256", secret).update(message).digest();
}

export function requireRadioMachineAuth(req: Request, res: Response, next: NextFunction): void {
  radioMachineRateLimit(req, res, () => {
    const machineId = process.env.RADIO_MACHINE_ID;
    const secret = process.env.RADIO_MACHINE_SECRET;
    if (!machineId || !secret) {
      res.status(503).json({ message: "Radio machine authentication is not configured" });
      return;
    }

    const timestamp = req.header("x-radio-timestamp");
    const nonce = req.header("x-radio-nonce");
    const signature = req.header("x-radio-signature");
    if (!timestamp || !nonce || !signature || req.header("x-radio-machine-id") !== machineId) {
      res.status(401).json({ message: "Invalid machine authentication" });
      return;
    }

    const timestampNumber = Number(timestamp);
    if (!Number.isInteger(timestampNumber) || Math.abs(Math.floor(Date.now() / 1000) - timestampNumber) > MAX_CLOCK_SKEW_SECONDS) {
      res.status(401).json({ message: "Stale machine request" });
      return;
    }
    if (!/^[a-f0-9-]{16,128}$/i.test(nonce) || usedNonces.has(nonce)) {
      res.status(401).json({ message: "Invalid or replayed machine request" });
      return;
    }

    let provided: Buffer;
    try {
      provided = Buffer.from(signature, "hex");
    } catch {
      res.status(401).json({ message: "Invalid machine signature" });
      return;
    }
    const expected = signatureFor(req, timestamp, nonce, secret);
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      res.status(401).json({ message: "Invalid machine signature" });
      return;
    }

    usedNonces.set(nonce, Date.now() + MAX_CLOCK_SKEW_SECONDS * 1000);
    for (const [key, expiresAt] of usedNonces) {
      if (expiresAt <= Date.now()) usedNonces.delete(key);
    }
    next();
  });
}