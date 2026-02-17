import { describe, it, expect, vi, beforeEach } from "vitest";

// next/navigation モック（redirect がエラーをスローする挙動を再現）
const mockRedirect = vi.fn().mockImplementation((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
}));

// Supabase server client モック
const mockGetUser = vi.fn();
const mockFromSelect = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => mockGetUser() },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => mockFromSelect(),
        }),
      }),
    }),
  }),
}));

import { getSession, requireAuth, requireRole } from "./guards";

describe("getSession", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockFromSelect.mockReset();
    mockRedirect.mockClear();
  });

  it("未認証ユーザー → null", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const result = await getSession();
    expect(result).toBeNull();
  });

  it("auth.users はあるが profile なし → null", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-001", email: "test@example.com" } },
    });
    mockFromSelect.mockResolvedValue({ data: null });

    const result = await getSession();
    expect(result).toBeNull();
  });

  it("認証済み → AuthUser を返す", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-001", email: "test@example.com" } },
    });
    mockFromSelect.mockResolvedValue({
      data: { role: "admin", org_id: null, display_name: "Test Admin" },
    });

    const result = await getSession();
    expect(result).toEqual({
      id: "user-001",
      email: "test@example.com",
      role: "admin",
      orgId: null,
      displayName: "Test Admin",
    });
  });
});

describe("requireAuth", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockFromSelect.mockReset();
    mockRedirect.mockClear();
  });

  it("未認証 → /login にリダイレクト", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    await expect(requireAuth()).rejects.toThrow("REDIRECT:/login");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });

  it("認証済み → AuthUser を返す", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-001", email: "admin@example.com" } },
    });
    mockFromSelect.mockResolvedValue({
      data: { role: "admin", org_id: null, display_name: "Admin" },
    });

    const user = await requireAuth();
    expect(user.id).toBe("user-001");
    expect(user.role).toBe("admin");
  });
});

describe("requireRole", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockFromSelect.mockReset();
    mockRedirect.mockClear();
  });

  it("許可ロール一致 → AuthUser を返す", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-001", email: "admin@example.com" } },
    });
    mockFromSelect.mockResolvedValue({
      data: { role: "admin", org_id: null, display_name: "Admin" },
    });

    const user = await requireRole(["admin"]);
    expect(user.role).toBe("admin");
  });

  it("ロール不一致 → /dashboard にリダイレクト", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "staff-001", email: "staff@example.com" } },
    });
    mockFromSelect.mockResolvedValue({
      data: { role: "staff", org_id: "org-001", display_name: "Staff" },
    });

    await expect(requireRole(["admin"])).rejects.toThrow(
      "REDIRECT:/dashboard"
    );
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
  });

  it("未認証 → /login にリダイレクト", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    await expect(requireRole(["admin"])).rejects.toThrow("REDIRECT:/login");
  });

  it("複数ロール許可", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "staff-001", email: "staff@example.com" } },
    });
    mockFromSelect.mockResolvedValue({
      data: { role: "staff", org_id: "org-001", display_name: "Staff" },
    });

    const user = await requireRole(["admin", "staff"]);
    expect(user.role).toBe("staff");
  });
});
