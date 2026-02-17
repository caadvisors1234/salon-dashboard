import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockUsers, createMockUser } from "@/test/helpers/mock-auth";

// Supabase admin client のモック
const mockFrom = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mockFrom }),
}));

import { checkOrgAccess, checkLocationAccess } from "./access";

/** from().select().eq()... チェーンのヘルパー */
function mockChain(result: { data: unknown; error?: unknown }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = ["select", "eq", "limit"];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.single = vi.fn().mockResolvedValue(result);
  // limit() の後は then 可能（配列返却パターン）
  chain.then = vi
    .fn()
    .mockImplementation((resolve: (v: unknown) => void) => resolve(result));
  return chain;
}

describe("checkOrgAccess", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("admin は常にアクセス可能", async () => {
    const result = await checkOrgAccess(mockUsers.admin, "org-999");
    expect(result).toBe(true);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("client は自分のorgにアクセス可能", async () => {
    const result = await checkOrgAccess(mockUsers.client, "org-001");
    expect(result).toBe(true);
  });

  it("client は他のorgにアクセス不可", async () => {
    const result = await checkOrgAccess(mockUsers.client, "org-999");
    expect(result).toBe(false);
  });

  it("staff はアサイン済みorgにアクセス可能", async () => {
    const chain = mockChain({ data: [{ id: "assignment-1" }] });
    mockFrom.mockReturnValue(chain);

    const result = await checkOrgAccess(mockUsers.staff, "org-001");
    expect(result).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith("user_org_assignments");
  });

  it("staff はアサインなしorgにアクセス不可", async () => {
    const chain = mockChain({ data: [] });
    mockFrom.mockReturnValue(chain);

    const result = await checkOrgAccess(mockUsers.staff, "org-999");
    expect(result).toBe(false);
  });

  it("staff でDBがnullを返す場合はアクセス不可", async () => {
    const chain = mockChain({ data: null });
    mockFrom.mockReturnValue(chain);

    const result = await checkOrgAccess(mockUsers.staff, "org-001");
    expect(result).toBe(false);
  });

  it("未知のロールはアクセス不可", async () => {
    const unknownUser = createMockUser({ role: "unknown" as never });
    const result = await checkOrgAccess(unknownUser, "org-001");
    expect(result).toBe(false);
  });
});

describe("checkLocationAccess", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("location が見つからない場合はアクセス不可", async () => {
    const chain = mockChain({ data: null, error: { message: "not found" } });
    mockFrom.mockReturnValue(chain);

    const result = await checkLocationAccess(mockUsers.admin, "loc-999");
    expect(result).toBe(false);
  });

  it("admin は location の org に関わらずアクセス可能", async () => {
    // 1回目: locations テーブルクエリ
    const locChain = mockChain({ data: { org_id: "org-001" } });
    mockFrom.mockReturnValueOnce(locChain);

    const result = await checkLocationAccess(mockUsers.admin, "loc-001");
    expect(result).toBe(true);
  });

  it("client は自orgの location にアクセス可能", async () => {
    const locChain = mockChain({ data: { org_id: "org-001" } });
    mockFrom.mockReturnValueOnce(locChain);

    const result = await checkLocationAccess(mockUsers.client, "loc-001");
    expect(result).toBe(true);
  });

  it("client は他orgの location にアクセス不可", async () => {
    const locChain = mockChain({ data: { org_id: "org-999" } });
    mockFrom.mockReturnValueOnce(locChain);

    const result = await checkLocationAccess(mockUsers.client, "loc-001");
    expect(result).toBe(false);
  });
});
