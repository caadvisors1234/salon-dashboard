// ユーザーロール
export type UserRole = "admin" | "staff" | "client";

// 認証済みユーザー情報（auth.users + public.users を統合）
export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
  orgId: string | null;
  displayName: string | null;
};

// データベース型定義（Supabase generate types で生成）
export type { Database, Tables, TablesInsert, TablesUpdate } from "./database";
