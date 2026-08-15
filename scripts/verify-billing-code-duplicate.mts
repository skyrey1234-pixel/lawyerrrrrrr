import { users } from "../drizzle/schema";
import type { TrpcContext } from "../server/_core/context";
import { getDb } from "../server/db";
import { appRouter } from "../server/routers";

const db = await getDb();
if (!db) throw new Error("Database connection is unavailable");
const [user] = await db.select().from(users).limit(1);
if (!user) throw new Error("No authenticated pilot user is available");

const caller = appRouter.createCaller({
  user,
  req: { protocol: "https", headers: {} },
  res: {},
} as TrpcContext);

const before = await caller.billing.codes.list({ includeInactive: true });
const existing = before.find(item => item.code === "CS-REV");
if (!existing) throw new Error("Expected the validated CS-REV billing code");

let duplicateRejected = false;
let duplicateMessage = "";
try {
  await caller.billing.codes.create({
    code: "cs-rev",
    label: "Duplicate review code",
    category: "REVIEW",
    description: "Must not be created",
    defaultNarrative: "Review matter materials",
    displayOrder: 99,
  });
} catch (error) {
  duplicateRejected = true;
  duplicateMessage = error instanceof Error ? error.message : String(error);
}

if (!duplicateRejected) throw new Error("Duplicate firm billing code was unexpectedly created");
const after = await caller.billing.codes.list({ includeInactive: true });
const matchingCodes = after.filter(item => item.code === "CS-REV");
if (matchingCodes.length !== 1) throw new Error(`Expected one CS-REV code, found ${matchingCodes.length}`);

console.log(JSON.stringify({
  verified: true,
  duplicateRejected,
  duplicateMessage,
  preservedCode: {
    id: matchingCodes[0].id,
    code: matchingCodes[0].code,
    label: matchingCodes[0].label,
    active: matchingCodes[0].active,
  },
}, null, 2));
