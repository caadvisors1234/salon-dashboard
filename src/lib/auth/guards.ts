import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AuthUser, UserRole } from "@/types";
import { DEFAULT_LOGIN_REDIRECT, LOGIN_PATH } from "./constants";

/**
 * 現在のセッションからユーザー情報を取得する。
 * auth.users + public.users を統合して AuthUser を返す。
 * 未認証の場合は null を返す。
 */
export async function getSession(): Promise<AuthUser | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("role, org_id, display_name")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return {
    id: user.id,
    email: user.email!,
    role: profile.role as UserRole,
    orgId: profile.org_id,
    displayName: profile.display_name,
  };
}

/**
 * 認証を要求する。未認証の場合は /login にリダイレクト。
 * 認証済みの場合は AuthUser を返す。
 */
export async function requireAuth(): Promise<AuthUser> {
  const session = await getSession();
  if (!session) {
    redirect(LOGIN_PATH);
  }
  return session;
}

/**
 * 特定ロールを要求する。ロール不一致の場合は /dashboard にリダイレクト。
 */
export async function requireRole(
  allowedRoles: UserRole[]
): Promise<AuthUser> {
  const session = await requireAuth();
  if (!allowedRoles.includes(session.role)) {
    redirect(DEFAULT_LOGIN_REDIRECT);
  }
  return session;
}
