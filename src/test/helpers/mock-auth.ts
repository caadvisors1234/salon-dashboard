import type { AuthUser, UserRole } from "@/types";

/**
 * テスト用AuthUserを生成するファクトリ
 */
export function createMockUser(
  overrides?: Partial<AuthUser>
): AuthUser {
  return {
    id: "user-001",
    email: "test@example.com",
    role: "admin" as UserRole,
    orgId: "org-001",
    displayName: "Test User",
    ...overrides,
  };
}

/** プリセットユーザー */
export const mockUsers = {
  admin: createMockUser({
    id: "admin-001",
    email: "admin@example.com",
    role: "admin",
    orgId: null,
    displayName: "Admin User",
  }),
  staff: createMockUser({
    id: "staff-001",
    email: "staff@example.com",
    role: "staff",
    orgId: "org-001",
    displayName: "Staff User",
  }),
  client: createMockUser({
    id: "client-001",
    email: "client@example.com",
    role: "client",
    orgId: "org-001",
    displayName: "Client User",
  }),
} as const;
