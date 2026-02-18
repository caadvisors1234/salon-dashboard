"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/guards";
import type { UserRole } from "@/types";
import { createLogger } from "@/lib/logger";

const log = createLogger("AdminActions");

// --- 共通型 ---

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export type UserWithOrgs = {
  id: string;
  email: string;
  role: string;
  displayName: string | null;
  orgId: string | null;
  orgName: string | null;
  assignedOrgs: { id: string; name: string }[];
  createdAt: string;
};

export type OrganizationWithCount = {
  id: string;
  name: string;
  locationCount: number;
  createdAt: string;
};

export type LocationRow = {
  id: string;
  name: string;
  gbpLocationId: string | null;
  placeId: string | null;
  isActive: boolean;
  createdAt: string;
};

// --- ユーザー管理 ---

export async function getUsers(): Promise<ActionResult<UserWithOrgs[]>> {
  await requireRole(["admin"]);
  const supabase = await createClient();

  const { data: users, error } = await supabase
    .from("users")
    .select("id, email, role, display_name, org_id, created_at")
    .order("created_at", { ascending: false });

  if (error) return { success: false, error: error.message };

  // 全組織を取得（org名解決用）
  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name");
  const orgMap = new Map((orgs ?? []).map((o) => [o.id, o.name]));

  // 全user_org_assignmentsを取得
  const { data: assignments } = await supabase
    .from("user_org_assignments")
    .select("user_id, org_id");

  const assignmentMap = new Map<string, string[]>();
  for (const a of assignments ?? []) {
    const list = assignmentMap.get(a.user_id) ?? [];
    list.push(a.org_id);
    assignmentMap.set(a.user_id, list);
  }

  const result: UserWithOrgs[] = (users ?? []).map((u) => {
    const assignedOrgIds = assignmentMap.get(u.id) ?? [];
    return {
      id: u.id,
      email: u.email,
      role: u.role,
      displayName: u.display_name,
      orgId: u.org_id,
      orgName: u.org_id ? orgMap.get(u.org_id) ?? null : null,
      assignedOrgs: assignedOrgIds.map((oid) => ({
        id: oid,
        name: orgMap.get(oid) ?? "",
      })),
      createdAt: u.created_at,
    };
  });

  return { success: true, data: result };
}

export async function inviteUser(
  email: string,
  role: UserRole,
  orgId?: string,
  orgIds?: string[]
): Promise<ActionResult<{ userId: string }>> {
  await requireRole(["admin"]);
  const adminClient = createAdminClient();

  // バリデーション
  if (!email || !email.includes("@")) {
    return { success: false, error: "有効なメールアドレスを入力してください" };
  }

  if (role === "client" && !orgId) {
    return { success: false, error: "クライアントには所属組織を指定してください" };
  }

  // 招待実行
  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(
    email,
    {
      data: {
        role,
        org_id: role === "client" ? orgId : null,
      },
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirm`,
    }
  );

  if (error) return { success: false, error: error.message };

  // Staffの場合: org割当を追加
  if (role === "staff" && orgIds && orgIds.length > 0) {
    const supabase = await createClient();
    const inserts = orgIds.map((oid) => ({
      user_id: data.user.id,
      org_id: oid,
    }));
    const { error: assignError } = await supabase
      .from("user_org_assignments")
      .insert(inserts);
    if (assignError) {
      log.error({ err: assignError }, "Org assignment error");
    }
  }

  revalidatePath("/dashboard/admin/users");
  return { success: true, data: { userId: data.user.id } };
}

export async function updateUser(
  userId: string,
  data: {
    displayName?: string;
    role?: UserRole;
    orgId?: string | null;
    orgIds?: string[];
  }
): Promise<ActionResult> {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const adminClient = createAdminClient();

  // public.users の更新
  const updateData: Record<string, unknown> = {};
  if (data.displayName !== undefined) updateData.display_name = data.displayName;
  if (data.role !== undefined) updateData.role = data.role;

  // ロール変更に伴うorg_id更新
  if (data.role === "client") {
    updateData.org_id = data.orgId ?? null;
  } else if (data.role === "admin" || data.role === "staff") {
    updateData.org_id = null;
  }

  if (Object.keys(updateData).length > 0) {
    const { error } = await supabase
      .from("users")
      .update(updateData)
      .eq("id", userId);
    if (error) return { success: false, error: error.message };
  }

  // auth.users の metadata も更新
  if (data.role !== undefined) {
    const { error: authError } = await adminClient.auth.admin.updateUserById(
      userId,
      { user_metadata: { role: data.role } }
    );
    if (authError) {
      log.error({ err: authError }, "Auth metadata update error");
    }
  }

  // Staff のorg割当更新
  if (data.role === "staff" && data.orgIds !== undefined) {
    // 既存の割当を全削除
    await supabase
      .from("user_org_assignments")
      .delete()
      .eq("user_id", userId);

    // 新しい割当を追加
    if (data.orgIds.length > 0) {
      const inserts = data.orgIds.map((oid) => ({
        user_id: userId,
        org_id: oid,
      }));
      await supabase.from("user_org_assignments").insert(inserts);
    }
  } else if (data.role && data.role !== "staff") {
    // Staff以外に変更された場合、既存のorg割当を削除
    await supabase
      .from("user_org_assignments")
      .delete()
      .eq("user_id", userId);
  }

  revalidatePath("/dashboard/admin/users");
  return { success: true, data: undefined };
}

export async function deleteUser(userId: string): Promise<ActionResult> {
  const session = await requireRole(["admin"]);

  // 自分自身の削除を拒否
  if (session.id === userId) {
    return { success: false, error: "自分自身を削除することはできません" };
  }

  const adminClient = createAdminClient();

  // auth.users を削除（CASCADE で public.users も削除される）
  const { error } = await adminClient.auth.admin.deleteUser(userId);
  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/admin/users");
  return { success: true, data: undefined };
}

// --- 組織管理 ---

export async function getOrganizationsForSelect(): Promise<
  ActionResult<{ id: string; name: string }[]>
> {
  await requireRole(["admin"]);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("organizations")
    .select("id, name")
    .order("name");

  if (error) return { success: false, error: error.message };
  return { success: true, data: data ?? [] };
}

export async function getOrganizations(): Promise<
  ActionResult<OrganizationWithCount[]>
> {
  await requireRole(["admin"]);
  const supabase = await createClient();

  const { data: orgs, error } = await supabase
    .from("organizations")
    .select("id, name, created_at")
    .order("created_at", { ascending: false });

  if (error) return { success: false, error: error.message };

  // 各組織の店舗数を取得
  const { data: locations } = await supabase
    .from("locations")
    .select("org_id");

  const countMap = new Map<string, number>();
  for (const loc of locations ?? []) {
    countMap.set(loc.org_id, (countMap.get(loc.org_id) ?? 0) + 1);
  }

  const result: OrganizationWithCount[] = (orgs ?? []).map((org) => ({
    id: org.id,
    name: org.name,
    locationCount: countMap.get(org.id) ?? 0,
    createdAt: org.created_at,
  }));

  return { success: true, data: result };
}

export async function createOrganization(
  name: string
): Promise<ActionResult<{ id: string }>> {
  await requireRole(["admin"]);

  if (!name.trim()) {
    return { success: false, error: "組織名を入力してください" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .insert({ name: name.trim() })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/admin/clients");
  return { success: true, data: { id: data.id } };
}

export async function updateOrganization(
  orgId: string,
  name: string
): Promise<ActionResult> {
  await requireRole(["admin"]);

  if (!name.trim()) {
    return { success: false, error: "組織名を入力してください" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ name: name.trim() })
    .eq("id", orgId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/admin/clients");
  return { success: true, data: undefined };
}

export async function deleteOrganization(orgId: string): Promise<ActionResult> {
  await requireRole(["admin"]);
  const supabase = await createClient();

  const { error } = await supabase
    .from("organizations")
    .delete()
    .eq("id", orgId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/admin/clients");
  return { success: true, data: undefined };
}

// --- 店舗管理 ---

export async function getOrganizationDetail(
  orgId: string
): Promise<ActionResult<{ id: string; name: string }>> {
  await requireRole(["admin"]);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("id", orgId)
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function getLocations(
  orgId: string
): Promise<ActionResult<LocationRow[]>> {
  await requireRole(["admin"]);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("locations")
    .select("id, name, gbp_location_id, place_id, is_active, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) return { success: false, error: error.message };

  const result: LocationRow[] = (data ?? []).map((loc) => ({
    id: loc.id,
    name: loc.name,
    gbpLocationId: loc.gbp_location_id,
    placeId: loc.place_id,
    isActive: loc.is_active,
    createdAt: loc.created_at,
  }));

  return { success: true, data: result };
}

export async function createLocation(
  orgId: string,
  data: {
    name: string;
    gbpLocationId?: string;
    placeId?: string;
  }
): Promise<ActionResult<{ id: string }>> {
  await requireRole(["admin"]);

  if (!data.name.trim()) {
    return { success: false, error: "店舗名を入力してください" };
  }

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("locations")
    .insert({
      org_id: orgId,
      name: data.name.trim(),
      gbp_location_id: data.gbpLocationId?.trim() || null,
      place_id: data.placeId?.trim() || null,
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath(`/dashboard/admin/clients/${orgId}`);
  return { success: true, data: { id: created.id } };
}

export async function updateLocation(
  locationId: string,
  data: {
    name?: string;
    gbpLocationId?: string | null;
    placeId?: string | null;
    isActive?: boolean;
  }
): Promise<ActionResult> {
  await requireRole(["admin"]);

  if (data.name !== undefined && !data.name.trim()) {
    return { success: false, error: "店舗名を入力してください" };
  }

  const supabase = await createClient();

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.gbpLocationId !== undefined)
    updateData.gbp_location_id = data.gbpLocationId?.trim() || null;
  if (data.placeId !== undefined)
    updateData.place_id = data.placeId?.trim() || null;
  if (data.isActive !== undefined) updateData.is_active = data.isActive;

  const { error } = await supabase
    .from("locations")
    .update(updateData)
    .eq("id", locationId);

  if (error) return { success: false, error: error.message };

  // org_idを取得してrevalidate
  const { data: loc } = await supabase
    .from("locations")
    .select("org_id")
    .eq("id", locationId)
    .single();

  if (loc) {
    revalidatePath(`/dashboard/admin/clients/${loc.org_id}`);
  }

  return { success: true, data: undefined };
}

export async function deleteLocation(locationId: string): Promise<ActionResult> {
  await requireRole(["admin"]);
  const supabase = await createClient();

  // org_idを先に取得（revalidate用）
  const { data: loc } = await supabase
    .from("locations")
    .select("org_id")
    .eq("id", locationId)
    .single();

  const { error } = await supabase
    .from("locations")
    .delete()
    .eq("id", locationId);

  if (error) return { success: false, error: error.message };

  if (loc) {
    revalidatePath(`/dashboard/admin/clients/${loc.org_id}`);
  }

  return { success: true, data: undefined };
}
