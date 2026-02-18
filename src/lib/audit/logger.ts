import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

interface AuditLogEntry {
  userId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, Json | undefined>;
  ipAddress?: string;
}

/**
 * 監査ログを記録する（fire-and-forget）。
 * 失敗しても呼び出し元の処理をブロックしない。
 */
export function logAudit(entry: AuditLogEntry): void {
  try {
    const supabase = createAdminClient();

    supabase
      .from("audit_logs")
      .insert({
        user_id: entry.userId,
        action: entry.action,
        resource_type: entry.resourceType,
        resource_id: entry.resourceId ?? null,
        metadata: entry.metadata ?? {},
        ip_address: entry.ipAddress ?? null,
      })
      .then(({ error }) => {
        if (error) {
          console.error("[AuditLog] Failed to insert:", error.message);
        }
      });
  } catch (err) {
    console.error("[AuditLog] Error:", err);
  }
}
