import { createAdminClient } from "@/lib/supabase/admin";
import type { AuthUser } from "@/types";

/**
 * 指定orgIdへのアクセス権限をチェックする。
 */
export async function checkOrgAccess(
  user: AuthUser,
  targetOrgId: string
): Promise<boolean> {
  if (user.role === "admin") return true;
  if (user.role === "client") return user.orgId === targetOrgId;

  if (user.role === "staff") {
    // staff: user_org_assignments 経由で確認
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("user_org_assignments")
      .select("id")
      .eq("user_id", user.id)
      .eq("org_id", targetOrgId)
      .limit(1);

    return (data?.length ?? 0) > 0;
  }

  // 未知のロールはデフォルト拒否
  return false;
}

/**
 * 指定locationIdへのアクセス権限をチェックする。
 * locationの所属orgに対するアクセス権限を確認。
 */
export async function checkLocationAccess(
  user: AuthUser,
  locationId: string
): Promise<boolean> {
  const supabase = createAdminClient();
  const { data: location } = await supabase
    .from("locations")
    .select("org_id")
    .eq("id", locationId)
    .single();

  if (!location) return false;

  return checkOrgAccess(user, location.org_id);
}
