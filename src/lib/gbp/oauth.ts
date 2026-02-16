import crypto from "crypto";
import { GBP_API } from "./types";

// ============================================
// OAuth 2.0 ヘルパー
// ============================================

function getOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  const scopes = process.env.GOOGLE_OAUTH_SCOPES;

  if (!clientId || !clientSecret || !redirectUri || !scopes) {
    throw new Error("Google OAuth environment variables are not configured");
  }

  return { clientId, clientSecret, redirectUri, scopes };
}

/**
 * CSRF 対策用の state パラメータを生成する
 */
export function generateState(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Google OAuth 認可 URL を構築する
 */
export function getAuthorizationUrl(state: string): string {
  const { clientId, redirectUri, scopes } = getOAuthConfig();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes,
    state,
    access_type: "offline",
    prompt: "consent",
  });

  return `${GBP_API.OAUTH_AUTH_URL}?${params.toString()}`;
}

/**
 * 認可コードをトークンに交換する
 */
export async function exchangeCodeForTokens(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiryDate: Date;
  scopes: string;
}> {
  const { clientId, clientSecret, redirectUri } = getOAuthConfig();

  const response = await fetch(GBP_API.OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const data = await response.json();

  if (!data.refresh_token) {
    throw new Error("No refresh_token received. Ensure prompt=consent and access_type=offline are set.");
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiryDate: new Date(Date.now() + data.expires_in * 1000),
    scopes: data.scope || "",
  };
}

/**
 * refresh_token を使用して access_token をリフレッシュする
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; expiryDate: Date }> {
  const { clientId, clientSecret } = getOAuthConfig();

  const response = await fetch(GBP_API.OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    expiryDate: new Date(Date.now() + data.expires_in * 1000),
  };
}

/**
 * Google アカウントのユーザー情報（メールアドレス）を取得する
 */
export async function getUserInfo(accessToken: string): Promise<{
  email: string;
  name?: string;
}> {
  const response = await fetch(GBP_API.USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch user info");
  }

  const data = await response.json();
  return {
    email: data.email,
    name: data.name,
  };
}
