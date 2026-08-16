import type { PracticeProvider } from "@shared/practiceManagement";
import { ENV } from "../_core/env";

type TokenResponse = { access_token: string; refresh_token?: string; expires_in?: number; scope?: string; firm_uuid?: string };

export class ProviderRequestError extends Error {
  constructor(message: string, public status?: number, public code?: string) { super(message); }
}

function credentials(provider: PracticeProvider) {
  const clientId = provider === "clio" ? ENV.clioClientId : ENV.mycaseClientId;
  const clientSecret = provider === "clio" ? ENV.clioClientSecret : ENV.mycaseClientSecret;
  if (!clientId || !clientSecret) throw new Error(`${provider === "clio" ? "Clio" : "MyCase"} OAuth credentials are not configured`);
  return { clientId, clientSecret };
}

export function providerReadiness() {
  return {
    clio: Boolean(ENV.clioClientId && ENV.clioClientSecret),
    mycase: Boolean(ENV.mycaseClientId && ENV.mycaseClientSecret),
  };
}

export function buildProviderAuthorizationUrl(provider: PracticeProvider, redirectUri: string, state: string) {
  const { clientId } = credentials(provider);
  const url = new URL(provider === "clio" ? "https://app.clio.com/oauth/authorize" : "https://auth.mycase.com/login_sessions/new");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeAuthorizationCode(provider: PracticeProvider, code: string, redirectUri: string) {
  const { clientId, clientSecret } = credentials(provider);
  const tokenUrl = provider === "clio" ? "https://app.clio.com/oauth/token" : "https://auth.mycase.com/tokens";
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": provider === "clio" ? "application/x-www-form-urlencoded" : "application/json", Accept: "application/json" },
    body: provider === "clio"
      ? new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, grant_type: "authorization_code", redirect_uri: redirectUri })
      : JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, grant_type: "authorization_code", redirect_uri: redirectUri }),
  });
  const payload = await response.json().catch(() => ({})) as Partial<TokenResponse> & { error?: string; error_description?: string };
  if (!response.ok || !payload.access_token) throw new ProviderRequestError(`Authorization failed: ${payload.error_description || payload.error || response.statusText}`, response.status, payload.error);
  return payload as TokenResponse;
}

export async function createProviderTimeEntry(provider: PracticeProvider, accessToken: string, body: unknown) {
  const endpoint = provider === "clio" ? "https://app.clio.com/api/v4/activities.json" : "https://external-integrations.mycase.com/v1/time_entries";
  const response = await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const payload = await response.json().catch(() => ({})) as { id?: string | number; data?: { id?: string | number }; error?: string; message?: string };
  if (!response.ok) throw new ProviderRequestError(payload.message || payload.error || `${provider === "clio" ? "Clio" : "MyCase"} rejected the time entry`, response.status, payload.error);
  const id = payload.data?.id ?? payload.id;
  if (id == null) throw new ProviderRequestError("The provider accepted the request but did not return a time-entry ID", response.status);
  return { id: String(id), status: response.status };
}
