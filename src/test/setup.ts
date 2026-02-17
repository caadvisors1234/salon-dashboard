import { beforeEach, vi } from "vitest";

// テスト用ダミー環境変数
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
process.env.REPORT_TOKEN_SECRET = "test-report-token-secret-at-least-32-chars-long";
process.env.GOOGLE_TOKEN_ENCRYPTION_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

beforeEach(() => {
  vi.restoreAllMocks();
});
