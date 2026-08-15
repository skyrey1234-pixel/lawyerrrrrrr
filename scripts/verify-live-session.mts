import { readFile } from "node:fs/promises";
import path from "node:path";
import { users } from "../drizzle/schema";
import { getDb } from "../server/db";
import type { TrpcContext } from "../server/_core/context";
import { appRouter } from "../server/routers";

const audioPath = process.env.COUNSELSCRIBE_LIVE_FIXTURE
  ?? "/home/ubuntu/legal_dictation_meeting/test-fixtures/synthetic_legal_test.wav";

const db = await getDb();
if (!db) throw new Error("Database connection is unavailable");
const [user] = await db.select().from(users).limit(1);
if (!user) throw new Error("No authenticated pilot user is available for the live-session fixture");

const ctx = {
  user,
  req: { protocol: "https", headers: {} },
  res: {},
} as TrpcContext;
const caller = appRouter.createCaller(ctx);
const [matter] = await caller.matters.list();
if (!matter) throw new Error("No matter is available for the live-session fixture");

const bytes = await readFile(audioPath);
const result = await caller.sessions.uploadAudio({
  matterId: matter.id,
  title: "Verified live microphone persistence fixture",
  fileName: path.basename(audioPath).replace("synthetic_legal_test", "live-microphone-fixture"),
  mimeType: "audio/wav",
  base64Data: bytes.toString("base64"),
  durationMs: 14_000,
  processingMode: "hosted",
  sourceType: "live",
});

const bundle = await caller.sessions.get({ sessionId: result.sessionId });
if (bundle.session.sourceType !== "live") throw new Error(`Expected live source, received ${bundle.session.sourceType}`);
if (bundle.session.processingMode !== "hosted") throw new Error(`Expected hosted mode, received ${bundle.session.processingMode}`);
if (!bundle.audio?.storageKey || !bundle.audio.storageUrl) throw new Error("Expected a stored audio object reference");

console.log(JSON.stringify({
  verified: true,
  sessionId: bundle.session.id,
  sourceType: bundle.session.sourceType,
  processingMode: bundle.session.processingMode,
  status: bundle.session.status,
  durationMs: bundle.session.durationMs,
  audio: {
    fileName: bundle.audio.fileName,
    mimeType: bundle.audio.mimeType,
    sizeBytes: bundle.audio.sizeBytes,
    hasStorageKey: Boolean(bundle.audio.storageKey),
    hasStorageUrl: Boolean(bundle.audio.storageUrl),
  },
}, null, 2));
