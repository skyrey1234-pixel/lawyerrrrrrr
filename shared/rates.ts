export type RatePeriod = {
  effectiveFrom: Date;
  effectiveTo?: Date | null;
};

export function calculateFeeCents(durationSeconds: number, hourlyRateCents: number) {
  if (!Number.isInteger(durationSeconds) || durationSeconds <= 0) {
    throw new Error("Duration must be a positive whole number of seconds");
  }
  if (!Number.isInteger(hourlyRateCents) || hourlyRateCents < 0) {
    throw new Error("Hourly rate must be a non-negative whole number of cents");
  }
  return Math.round((durationSeconds * hourlyRateCents) / 3600);
}

export function dollarsToCents(value: string | number) {
  const normalized = typeof value === "number" ? value : Number(value.trim().replace(/[$,]/g, ""));
  if (!Number.isFinite(normalized) || normalized < 0) throw new Error("Enter a valid non-negative hourly rate");
  return Math.round(normalized * 100);
}

export function ratePeriodsOverlap(left: RatePeriod, right: RatePeriod) {
  const leftEnd = left.effectiveTo?.getTime() ?? Number.POSITIVE_INFINITY;
  const rightEnd = right.effectiveTo?.getTime() ?? Number.POSITIVE_INFINITY;
  return left.effectiveFrom.getTime() <= rightEnd && right.effectiveFrom.getTime() <= leftEnd;
}

export function formatCurrencyFromCents(cents: number | null | undefined, currency = "USD") {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}
