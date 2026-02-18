import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OAuthTokens, StoredOAuthToken } from "./types";

// ============================================
// 暗号化・復号化（AES-256-GCM）
// ============================================

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY is not set");
  }
  return Buffer.from(key, "hex");
}

export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");
  const tag = cipher.getAuthTag();

  // iv:tag:ciphertext の形式で保存
  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted}`;
}

export function decrypt(ciphertext: string): string {
  const key = getEncryptionKey();
  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted format");
  }

  const iv = Buffer.from(parts[0], "base64");
  const tag = Buffer.from(parts[1], "base64");
  const encrypted = parts[2];

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted, "base64", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// ============================================
// トークン保存・取得
// ============================================

export async function saveOAuthTokens(
  userId: string,
  tokens: OAuthTokens
): Promise<string> {
  const supabase = createAdminClient();

  const accessTokenEncrypted = encrypt(tokens.accessToken);
  const refreshTokenEncrypted = encrypt(tokens.refreshToken);

  const { data, error } = await supabase
    .from("google_oauth_tokens")
    .upsert(
      {
        singleton_key: "default",
        user_id: userId,
        google_email: tokens.googleEmail,
        access_token_encrypted: accessTokenEncrypted,
        refresh_token_encrypted: refreshTokenEncrypted,
        token_expiry: tokens.expiryDate.toISOString(),
        scopes: tokens.scopes,
        is_valid: true,
      },
      { onConflict: "singleton_key" }
    )
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to save OAuth tokens: ${error.message}`);
  }

  return data.id;
}

export async function getStoredToken(): Promise<StoredOAuthToken | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("google_oauth_tokens")
    .select("id, user_id, google_email, token_expiry, scopes, is_valid")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    userId: data.user_id,
    googleEmail: data.google_email,
    tokenExpiry: data.token_expiry,
    scopes: data.scopes,
    isValid: data.is_valid,
  };
}

export async function getDecryptedAccessToken(): Promise<string | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("google_oauth_tokens")
    .select("access_token_encrypted, is_valid")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data || !data.is_valid) {
    return null;
  }

  return decrypt(data.access_token_encrypted);
}

export async function getDecryptedRefreshToken(): Promise<string | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("google_oauth_tokens")
    .select("refresh_token_encrypted, is_valid")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data || !data.is_valid) {
    return null;
  }

  return decrypt(data.refresh_token_encrypted);
}

export async function updateAccessToken(
  tokenId: string,
  newAccessToken: string,
  newExpiry: Date
): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("google_oauth_tokens")
    .update({
      access_token_encrypted: encrypt(newAccessToken),
      token_expiry: newExpiry.toISOString(),
    })
    .eq("id", tokenId);

  if (error) {
    throw new Error(`Failed to update access token: ${error.message}`);
  }
}

export async function invalidateToken(tokenId: string): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("google_oauth_tokens")
    .update({ is_valid: false })
    .eq("id", tokenId);

  if (error) {
    throw new Error(`Failed to invalidate token: ${error.message}`);
  }
}

export async function deleteAllTokens(): Promise<void> {
  const supabase = createAdminClient();

  // gbp_accounts は CASCADE で自動削除される
  const { error } = await supabase
    .from("google_oauth_tokens")
    .delete()
    .gte("created_at", "1970-01-01T00:00:00Z");

  if (error) {
    throw new Error(`Failed to delete tokens: ${error.message}`);
  }
}

export async function isTokenExpired(): Promise<boolean> {
  const token = await getStoredToken();
  if (!token) return true;

  const expiry = new Date(token.tokenExpiry);
  // 5分の余裕を持って期限切れ判定
  return expiry.getTime() - 5 * 60 * 1000 < Date.now();
}

/**
 * 有効なアクセストークンを取得する。
 * 期限切れの場合はリフレッシュを試行し、失効時は null を返す。
 * refreshFn は oauth.ts の refreshAccessToken を受け取る（循環依存回避）。
 */
export async function getValidAccessToken(
  refreshFn: (refreshToken: string) => Promise<{ accessToken: string; expiryDate: Date }>
): Promise<string | null> {
  const storedToken = await getStoredToken();
  if (!storedToken || !storedToken.isValid) {
    return null;
  }

  const expiry = new Date(storedToken.tokenExpiry);
  const isExpired = expiry.getTime() - 5 * 60 * 1000 < Date.now();

  if (!isExpired) {
    return getDecryptedAccessToken();
  }

  // リフレッシュ
  const refreshToken = await getDecryptedRefreshToken();
  if (!refreshToken) {
    return null;
  }

  try {
    const result = await refreshFn(refreshToken);
    await updateAccessToken(storedToken.id, result.accessToken, result.expiryDate);
    return result.accessToken;
  } catch {
    // リフレッシュ失敗 → トークン失効
    await invalidateToken(storedToken.id);
    return null;
  }
}
