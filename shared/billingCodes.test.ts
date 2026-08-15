import { describe, expect, it } from "vitest";
import { canManageBillingCodes, normalizeBillingCategory, validateBillingCode } from "./billingCodes";

describe("firm billing codes", () => {
  it("normalizes codes and categories deterministically", () => {
    expect(validateBillingCode(" l 110 ")).toBe("L-110");
    expect(normalizeBillingCategory("Client communication")).toBe("CLIENT_COMMUNICATION");
  });

  it("rejects unsafe or overlong codes", () => {
    expect(() => validateBillingCode("bad/code")).toThrow(/letters, numbers/i);
    expect(() => validateBillingCode("X".repeat(41))).toThrow(/1–40/);
  });

  it("permits only firm administrators to manage billing codes", () => {
    expect(canManageBillingCodes("administrator")).toBe(true);
    expect(canManageBillingCodes("attorney")).toBe(false);
    expect(canManageBillingCodes("reviewer")).toBe(false);
  });
});
