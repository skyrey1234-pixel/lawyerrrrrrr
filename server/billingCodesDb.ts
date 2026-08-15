import { and, asc, eq } from "drizzle-orm";
import { firmBillingCodes } from "../drizzle/schema";
import { canManageBillingCodes, normalizeBillingCategory, validateBillingCode } from "@shared/billingCodes";
import { appendAudit, getMembership } from "./counselscribeDb";
import { getDb } from "./db";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db;
}

async function requireMembership(userId: number) {
  const membership = await getMembership(userId);
  if (!membership) throw new Error("Firm membership is required");
  return membership;
}

async function requireAdministrator(userId: number) {
  const membership = await requireMembership(userId);
  if (!canManageBillingCodes(membership.membership.role)) throw new Error("Firm administrator access is required");
  return membership;
}

export async function listFirmBillingCodes(userId: number, includeInactive = false) {
  const membership = await requireMembership(userId);
  const db = await requireDb();
  const conditions = [eq(firmBillingCodes.firmId, membership.firm.id)];
  if (!includeInactive) conditions.push(eq(firmBillingCodes.active, true));
  return db
    .select()
    .from(firmBillingCodes)
    .where(and(...conditions))
    .orderBy(asc(firmBillingCodes.displayOrder), asc(firmBillingCodes.code));
}

export async function createFirmBillingCode(userId: number, input: {
  code: string;
  label: string;
  category: string;
  description?: string;
  defaultNarrative?: string;
  displayOrder?: number;
}) {
  const membership = await requireAdministrator(userId);
  const db = await requireDb();
  const code = validateBillingCode(input.code);
  const category = normalizeBillingCategory(input.category);
  const existing = await db.select({ id: firmBillingCodes.id }).from(firmBillingCodes).where(and(eq(firmBillingCodes.firmId, membership.firm.id), eq(firmBillingCodes.code, code))).limit(1);
  if (existing[0]) throw new Error(`Billing code ${code} already exists for this firm`);
  const [{ id }] = await db.insert(firmBillingCodes).values({
    firmId: membership.firm.id,
    code,
    label: input.label.trim(),
    category,
    description: input.description?.trim() || null,
    defaultNarrative: input.defaultNarrative?.trim() || null,
    displayOrder: input.displayOrder ?? 0,
    active: true,
    createdByUserId: userId,
    updatedByUserId: userId,
  }).$returningId();
  await appendAudit({ firmId: membership.firm.id, actorUserId: userId, eventType: "billing.code_created", resourceType: "firm_billing_code", resourceId: String(id), metadata: { code, category } });
  return id;
}

export async function updateFirmBillingCode(userId: number, input: {
  id: number;
  code: string;
  label: string;
  category: string;
  description?: string;
  defaultNarrative?: string;
  displayOrder: number;
  active: boolean;
}) {
  const membership = await requireAdministrator(userId);
  const db = await requireDb();
  const current = await db.select().from(firmBillingCodes).where(and(eq(firmBillingCodes.id, input.id), eq(firmBillingCodes.firmId, membership.firm.id))).limit(1);
  if (!current[0]) throw new Error("Billing code not found or access denied");
  const code = validateBillingCode(input.code);
  const duplicate = await db.select({ id: firmBillingCodes.id }).from(firmBillingCodes).where(and(eq(firmBillingCodes.firmId, membership.firm.id), eq(firmBillingCodes.code, code))).limit(1);
  if (duplicate[0] && duplicate[0].id !== input.id) throw new Error(`Billing code ${code} already exists for this firm`);
  await db.update(firmBillingCodes).set({
    code,
    label: input.label.trim(),
    category: normalizeBillingCategory(input.category),
    description: input.description?.trim() || null,
    defaultNarrative: input.defaultNarrative?.trim() || null,
    displayOrder: input.displayOrder,
    active: input.active,
    updatedByUserId: userId,
  }).where(eq(firmBillingCodes.id, input.id));
  await appendAudit({ firmId: membership.firm.id, actorUserId: userId, eventType: "billing.code_updated", resourceType: "firm_billing_code", resourceId: String(input.id), metadata: { code, active: input.active, displayOrder: input.displayOrder } });
}

export async function resolveBillingCode(userId: number, input: { billingCodeId?: number; category?: string }) {
  const membership = await requireMembership(userId);
  const db = await requireDb();
  if (input.billingCodeId) {
    const rows = await db.select().from(firmBillingCodes).where(and(eq(firmBillingCodes.id, input.billingCodeId), eq(firmBillingCodes.firmId, membership.firm.id), eq(firmBillingCodes.active, true))).limit(1);
    if (!rows[0]) throw new Error("Select an active billing code for this firm");
    return rows[0];
  }
  if (!input.category) return null;
  const category = normalizeBillingCategory(input.category);
  const rows = await db.select().from(firmBillingCodes).where(and(eq(firmBillingCodes.firmId, membership.firm.id), eq(firmBillingCodes.category, category), eq(firmBillingCodes.active, true))).orderBy(asc(firmBillingCodes.displayOrder), asc(firmBillingCodes.id)).limit(1);
  return rows[0] ?? null;
}
