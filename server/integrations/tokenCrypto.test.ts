import { beforeAll, describe, expect, it } from "vitest";

describe("integration token encryption", () => {
  beforeAll(() => { process.env.JWT_SECRET ||= "test-only-integration-secret"; });

  it("round-trips tokens without storing plaintext", async () => {
    const { decryptIntegrationToken, encryptIntegrationToken } = await import("./tokenCrypto");
    const encrypted = encryptIntegrationToken("secret-access-token");
    expect(encrypted).not.toContain("secret-access-token");
    expect(decryptIntegrationToken(encrypted)).toBe("secret-access-token");
  });
});
