import type { Express, Request } from "express";
import { exchangeAuthorizationCode } from "./providers";
import { storeOAuthConnection } from "./practiceManagementDb";
import { verifyIntegrationState } from "./oauthState";

export function registerPracticeManagementRoutes(app: Express) {
  app.get("/api/integrations/:provider/callback", async (req, res) => {
    const provider = req.params.provider;
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const stateValue = typeof req.query.state === "string" ? req.query.state : "";
    try {
      if (provider !== "clio" && provider !== "mycase") throw new Error("Unknown practice-management provider");
      if (!code || !stateValue) throw new Error(typeof req.query.error === "string" ? req.query.error : "Authorization was not completed");
      const state = verifyIntegrationState(stateValue);
      if (state.provider !== provider) throw new Error("Integration state provider mismatch");
      const token = await exchangeAuthorizationCode(provider, code, state.redirectUri);
      await storeOAuthConnection(state.userId, { firmId: state.firmId, provider, accessToken: token.access_token, refreshToken: token.refresh_token, expiresIn: token.expires_in, scopes: token.scope, externalFirmId: token.firm_uuid });
      res.redirect(`/admin?integration=${provider}&status=connected`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Connection failed";
      res.redirect(`/admin?integration=${encodeURIComponent(provider)}&status=error&message=${encodeURIComponent(message.slice(0, 180))}`);
    }
  });
}

export function requestOrigin(req: Request) {
  const protocol = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0] || req.protocol;
  const host = (req.headers["x-forwarded-host"] as string | undefined)?.split(",")[0] || req.get("host");
  if (!host) throw new Error("Application host is unavailable");
  return `${protocol}://${host}`;
}
