import { and, asc, desc, eq, gte, isNull, lte, or } from "drizzle-orm";
import { billingEntries, firmMemberships, lawyerRateCards, users } from "../drizzle/schema";
import { calculateFeeCents, ratePeriodsOverlap } from "@shared/rates";
import { appendAudit, getMembership } from "./counselscribeDb";
import { getDb } from "./db";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db;
}

async function requireAdministrator(userId: number) {
  const membership = await getMembership(userId);
  if (!membership || membership.membership.role !== "administrator") {
    throw new Error("Firm administrator access is required");
  }
  return membership;
}

export async function listLawyerRates(userId: number, includeInactive = true) {
  const membership = await getMembership(userId);
  if (!membership) return { members: [], rates: [] };
  const db = await requireDb();
  const members = await db
    .select({ membership: firmMemberships, user: users })
    .from(firmMemberships)
    .innerJoin(users, eq(firmMemberships.userId, users.id))
    .where(eq(firmMemberships.firmId, membership.firm.id))
    .orderBy(asc(users.name));
  const conditions = [eq(lawyerRateCards.firmId, membership.firm.id)];
  if (!includeInactive) conditions.push(eq(lawyerRateCards.active, true));
  const rates = await db
    .select({ rate: lawyerRateCards, membership: firmMemberships, user: users })
    .from(lawyerRateCards)
    .innerJoin(firmMemberships, eq(lawyerRateCards.membershipId, firmMemberships.id))
    .innerJoin(users, eq(firmMemberships.userId, users.id))
    .where(and(...conditions))
    .orderBy(asc(users.name), desc(lawyerRateCards.effectiveFrom));
  return { members, rates };
}

export async function createLawyerRate(userId: number, input: {
  membershipId: number;
  hourlyRateCents: number;
  currency?: string;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  notes?: string;
}) {
  const administrator = await requireAdministrator(userId);
  if (!Number.isInteger(input.hourlyRateCents) || input.hourlyRateCents < 0 || input.hourlyRateCents > 10_000_000) {
    throw new Error("Hourly rate must be between $0 and $100,000");
  }
  if (input.effectiveTo && input.effectiveTo < input.effectiveFrom) {
    throw new Error("Effective end must be after effective start");
  }
  const db = await requireDb();
  const target = await db.select().from(firmMemberships).where(and(
    eq(firmMemberships.id, input.membershipId),
    eq(firmMemberships.firmId, administrator.firm.id),
    eq(firmMemberships.status, "active"),
  )).limit(1);
  if (!target[0]) throw new Error("Active firm member not found");
  const existing = await db.select().from(lawyerRateCards).where(and(
    eq(lawyerRateCards.membershipId, input.membershipId),
    eq(lawyerRateCards.active, true),
  ));
  const nextPeriod = { effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo };
  if (existing.some(rate => ratePeriodsOverlap(nextPeriod, { effectiveFrom: rate.effectiveFrom, effectiveTo: rate.effectiveTo }))) {
    throw new Error("This lawyer already has an active rate covering part of that period");
  }
  const [{ id }] = await db.insert(lawyerRateCards).values({
    firmId: administrator.firm.id,
    membershipId: input.membershipId,
    currency: input.currency ?? "USD",
    hourlyRateCents: input.hourlyRateCents,
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo,
    notes: input.notes,
    active: true,
    createdByUserId: userId,
    updatedByUserId: userId,
  }).$returningId();
  await appendAudit({ firmId: administrator.firm.id, actorUserId: userId, eventType: "billing.rate_created", resourceType: "lawyer_rate_card", resourceId: String(id), metadata: { membershipId: input.membershipId, hourlyRateCents: input.hourlyRateCents, currency: input.currency ?? "USD", effectiveFrom: input.effectiveFrom.toISOString(), effectiveTo: input.effectiveTo?.toISOString() ?? null } });
  return id;
}

export async function updateLawyerRate(userId: number, input: {
  id: number;
  effectiveTo?: Date | null;
  notes?: string;
  active: boolean;
}) {
  const administrator = await requireAdministrator(userId);
  const db = await requireDb();
  const rate = await db.select().from(lawyerRateCards).where(and(eq(lawyerRateCards.id, input.id), eq(lawyerRateCards.firmId, administrator.firm.id))).limit(1);
  if (!rate[0]) throw new Error("Lawyer rate not found");
  if (input.effectiveTo && input.effectiveTo < rate[0].effectiveFrom) throw new Error("Effective end must be after effective start");
  await db.update(lawyerRateCards).set({ effectiveTo: input.effectiveTo, notes: input.notes, active: input.active, updatedByUserId: userId }).where(eq(lawyerRateCards.id, input.id));
  await appendAudit({ firmId: administrator.firm.id, actorUserId: userId, eventType: "billing.rate_updated", resourceType: "lawyer_rate_card", resourceId: String(input.id), metadata: { effectiveTo: input.effectiveTo?.toISOString() ?? null, active: input.active } });
}

export async function resolveRateSnapshot(firmId: number, billingUserId: number, workDate: Date) {
  const db = await requireDb();
  const member = await db.select().from(firmMemberships).where(and(
    eq(firmMemberships.firmId, firmId),
    eq(firmMemberships.userId, billingUserId),
    eq(firmMemberships.status, "active"),
  )).limit(1);
  if (!member[0]) return null;
  const rows = await db.select().from(lawyerRateCards).where(and(
    eq(lawyerRateCards.firmId, firmId),
    eq(lawyerRateCards.membershipId, member[0].id),
    eq(lawyerRateCards.active, true),
    lte(lawyerRateCards.effectiveFrom, workDate),
    or(isNull(lawyerRateCards.effectiveTo), gte(lawyerRateCards.effectiveTo, workDate)),
  )).orderBy(desc(lawyerRateCards.effectiveFrom)).limit(1);
  return rows[0] ?? null;
}

export function feeSnapshot(durationSeconds: number | null | undefined, hourlyRateCents: number | null | undefined, billable = true) {
  if (!billable) return { rateStatus: "not_applicable" as const, feeCents: 0 };
  if (hourlyRateCents == null) return { rateStatus: "missing" as const, feeCents: null };
  if (!durationSeconds || durationSeconds <= 0) return { rateStatus: "applied" as const, feeCents: null };
  return { rateStatus: "applied" as const, feeCents: calculateFeeCents(durationSeconds, hourlyRateCents) };
}

export async function countRateUsage(rateCardId: number) {
  const db = await requireDb();
  const rows = await db.select({ id: billingEntries.id }).from(billingEntries).where(eq(billingEntries.rateCardId, rateCardId));
  return rows.length;
}
