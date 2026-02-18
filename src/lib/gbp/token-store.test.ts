import { describe, it, expect, vi, beforeEach } from "vitest";

// Supabaseモックを先に設定（encrypt/decrypt以外のDB系関数テスト時に必要）
const mockUpsert = vi.fn();
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

const mockSupabase = {
  from: vi.fn(() => ({
    upsert: mockUpsert,
    select: mockSelect,
    update: mockUpdate,
    delete: mockDelete,
  })),
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => mockSupabase),
}));

import {
  encrypt,
  decrypt,
  saveOAuthTokens,
  getStoredToken,
  getValidAccessToken,
  invalidateToken,
  deleteAllTokens,
} from "./token-store";

describe("encrypt / decrypt (AES-256-GCM)", () => {
  it("暗号化→復号化のラウンドトリップ", () => {
    const plaintext = "test-access-token-12345";
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("暗号文は iv:tag:ciphertext 形式", () => {
    const encrypted = encrypt("hello");
    const parts = encrypted.split(":");
    expect(parts).toHaveLength(3);
  });

  it("同じ平文でも異なる暗号文を生成（IVランダム性）", () => {
    const plaintext = "same-value";
    const enc1 = encrypt(plaintext);
    const enc2 = encrypt(plaintext);
    expect(enc1).not.toBe(enc2);
  });

  it("空文字列のラウンドトリップ", () => {
    const encrypted = encrypt("");
    expect(decrypt(encrypted)).toBe("");
  });

  it("長い文字列のラウンドトリップ", () => {
    const longText = "A".repeat(10000);
    const encrypted = encrypt(longText);
    expect(decrypt(encrypted)).toBe(longText);
  });

  it("日本語テキストのラウンドトリップ", () => {
    const text = "テスト用のトークン🔑";
    const encrypted = encrypt(text);
    expect(decrypt(encrypted)).toBe(text);
  });

  it("改ざん検知 — tagを変更すると復号失敗", () => {
    const encrypted = encrypt("secret");
    const parts = encrypted.split(":");
    // tagのバイトを変更（Base64デコード→反転→再エンコード）
    const tagBuf = Buffer.from(parts[1], "base64");
    tagBuf[0] = tagBuf[0] ^ 0xff;
    const tampered = `${parts[0]}:${tagBuf.toString("base64")}:${parts[2]}`;
    expect(() => decrypt(tampered)).toThrow();
  });

  it("改ざん検知 — ciphertextを変更すると復号失敗", () => {
    const encrypted = encrypt("secret");
    const parts = encrypted.split(":");
    const tamperedCipher = parts[2].slice(0, -1) + (parts[2].endsWith("A") ? "B" : "A");
    const tampered = `${parts[0]}:${parts[1]}:${tamperedCipher}`;
    expect(() => decrypt(tampered)).toThrow();
  });

  it("不正なフォーマットでエラー", () => {
    expect(() => decrypt("invalid-format")).toThrow("Invalid encrypted format");
  });
});

describe("saveOAuthTokens (upsert with singleton_key)", () => {
  beforeEach(() => {
    mockSupabase.from.mockClear();
    mockUpsert.mockReset();
  });

  it("singleton_key='default' で upsert する", async () => {
    mockUpsert.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: "token-001" },
          error: null,
        }),
      }),
    });

    const result = await saveOAuthTokens("user-001", {
      accessToken: "access-123",
      refreshToken: "refresh-456",
      expiryDate: new Date("2025-12-31T00:00:00Z"),
      scopes: "openid email",
      googleEmail: "test@example.com",
    });

    expect(result).toBe("token-001");
    expect(mockSupabase.from).toHaveBeenCalledWith("google_oauth_tokens");
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        singleton_key: "default",
        user_id: "user-001",
        google_email: "test@example.com",
        is_valid: true,
      }),
      { onConflict: "singleton_key" }
    );
  });

  it("DB エラー時に例外をスロー", async () => {
    mockUpsert.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "unique constraint violated" },
        }),
      }),
    });

    await expect(
      saveOAuthTokens("user-001", {
        accessToken: "a",
        refreshToken: "r",
        expiryDate: new Date(),
        scopes: "",
        googleEmail: "test@example.com",
      })
    ).rejects.toThrow("Failed to save OAuth tokens");
  });
});

describe("getStoredToken", () => {
  beforeEach(() => {
    mockSupabase.from.mockClear();
    mockSelect.mockReset();
  });

  it("トークンが存在する場合、StoredOAuthToken を返す", async () => {
    mockSelect.mockReturnValue({
      order: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: "token-001",
              user_id: "user-001",
              google_email: "test@example.com",
              token_expiry: "2025-12-31T00:00:00Z",
              scopes: "openid",
              is_valid: true,
            },
            error: null,
          }),
        }),
      }),
    });

    const token = await getStoredToken();
    expect(token).toEqual({
      id: "token-001",
      userId: "user-001",
      googleEmail: "test@example.com",
      tokenExpiry: "2025-12-31T00:00:00Z",
      scopes: "openid",
      isValid: true,
    });
  });

  it("トークンが存在しない場合は null を返す", async () => {
    mockSelect.mockReturnValue({
      order: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "not found" },
          }),
        }),
      }),
    });

    const token = await getStoredToken();
    expect(token).toBeNull();
  });
});

describe("getValidAccessToken", () => {
  beforeEach(() => {
    mockSupabase.from.mockClear();
    mockSelect.mockReset();
    mockUpdate.mockReset();
  });

  it("トークンが未期限切れの場合、復号化したアクセストークンを返す", async () => {
    const futureExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const encryptedAccessToken = encrypt("valid-access-token");

    // getStoredToken chain
    mockSelect
      .mockReturnValueOnce({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: "token-001",
                user_id: "user-001",
                google_email: "test@example.com",
                token_expiry: futureExpiry,
                scopes: "openid",
                is_valid: true,
              },
              error: null,
            }),
          }),
        }),
      })
      // getDecryptedAccessToken chain
      .mockReturnValueOnce({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                access_token_encrypted: encryptedAccessToken,
                is_valid: true,
              },
              error: null,
            }),
          }),
        }),
      });

    const mockRefresh = vi.fn();
    const result = await getValidAccessToken(mockRefresh);
    expect(result).toBe("valid-access-token");
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("トークンが無効の場合は null を返す", async () => {
    mockSelect.mockReturnValueOnce({
      order: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: "token-001",
              user_id: "user-001",
              google_email: "test@example.com",
              token_expiry: "2025-12-31T00:00:00Z",
              scopes: "openid",
              is_valid: false,
            },
            error: null,
          }),
        }),
      }),
    });

    const result = await getValidAccessToken(vi.fn());
    expect(result).toBeNull();
  });
});

describe("invalidateToken", () => {
  beforeEach(() => {
    mockSupabase.from.mockClear();
    mockUpdate.mockReset();
  });

  it("トークンの is_valid を false に更新する", async () => {
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    await invalidateToken("token-001");
    expect(mockSupabase.from).toHaveBeenCalledWith("google_oauth_tokens");
    expect(mockUpdate).toHaveBeenCalledWith({ is_valid: false });
  });

  it("DB エラー時に例外をスロー", async () => {
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        error: { message: "update failed" },
      }),
    });

    await expect(invalidateToken("token-001")).rejects.toThrow(
      "Failed to invalidate token"
    );
  });
});

describe("deleteAllTokens", () => {
  beforeEach(() => {
    mockSupabase.from.mockClear();
    mockDelete.mockReset();
  });

  it("全トークンを削除する", async () => {
    mockDelete.mockReturnValue({
      gte: vi.fn().mockResolvedValue({ error: null }),
    });

    await deleteAllTokens();
    expect(mockSupabase.from).toHaveBeenCalledWith("google_oauth_tokens");
  });

  it("DB エラー時に例外をスロー", async () => {
    mockDelete.mockReturnValue({
      gte: vi.fn().mockResolvedValue({
        error: { message: "delete failed" },
      }),
    });

    await expect(deleteAllTokens()).rejects.toThrow("Failed to delete tokens");
  });
});
