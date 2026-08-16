import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { PracticeProvider } from "@shared/practiceManagement";
import { ENV } from "../_core/env";

type IntegrationState = {
  provider: PracticeProvider;
  firmId: number;
  userId: number;
  redirectUri: string;
  nonce: string;
  expiresAt: number;
};

const sign = (payload: string) => createHmac("sha256", ENV.cookieSecret).update(payload).digest("base64url");

export function createIntegrationState(input: Omit<IntegrationState, "nonce" | "expiresAt">) {
  if (!ENV.cookieSecret) throw new Error("Integration state signing is unavailable");
  const payload = Buffer.from(JSON.stringify({ ...input, nonce: randomUUID(), expiresAt: Date.now() + 10 * 60 * 1000 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyIntegrationState(value: string): IntegrationState {
  const [payload, signature] = value.split(".");
  if (!payload || !signature) throw new Error("Invalid integration state");
  const expected = Buffer.from(sign(payload));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) throw new Error("Invalid integration state signature");
  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as IntegrationState;
  if (!['clio', 'mycase'].includes(parsed.provider) || !parsed.firmId || !parsed.userId || !parsed.redirectUri || parsed.expiresAt < Date.now()) throw new Error("Expired or invalid integration state");
  return parsed;
}
