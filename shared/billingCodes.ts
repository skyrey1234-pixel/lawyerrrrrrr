export const BILLING_CODE_PATTERN = /^[A-Z0-9][A-Z0-9._-]{0,39}$/;

export function normalizeBillingCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "-");
}

export function normalizeBillingCategory(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "_");
}

export function canManageBillingCodes(role: string) {
  return role === "administrator";
}

export function validateBillingCode(value: string) {
  const normalized = normalizeBillingCode(value);
  if (!BILLING_CODE_PATTERN.test(normalized)) {
    throw new Error("Billing code must be 1–40 characters using letters, numbers, periods, underscores, or hyphens");
  }
  return normalized;
}
