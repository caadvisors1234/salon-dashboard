import { describe, it, expect, vi } from "vitest";

// Supabaseモックを先に設定（encrypt/decrypt以外のDB系関数テスト時に必要）
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { encrypt, decrypt } from "./token-store";

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
