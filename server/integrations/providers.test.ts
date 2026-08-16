import { describe, expect, it } from "vitest";
import { buildProviderAuthorizationUrl, providerReadiness } from "./providers";

describe("practice-management credential readiness", () => {
  it("keeps direct connections disabled when OAuth credentials were not supplied", () => {
    const readiness = providerReadiness();
    if (!process.env.CLIO_CLIENT_ID || !process.env.CLIO_CLIENT_SECRET) {
      expect(readiness.clio).toBe(false);
      expect(() => buildProviderAuthorizationUrl("clio", "https://example.test/callback", "signed-state")).toThrow(/credentials/i);
    }
    if (!process.env.MYCASE_CLIENT_ID || !process.env.MYCASE_CLIENT_SECRET) {
      expect(readiness.mycase).toBe(false);
      expect(() => buildProviderAuthorizationUrl("mycase", "https://example.test/callback", "signed-state")).toThrow(/credentials/i);
    }
  });
});
