"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { updateUser } from "@/lib/admin/actions";
import { useOrgSelection } from "@/hooks/use-org-selection";
import { OrgSelector } from "@/components/admin/org-selector";
import type { UserWithOrgs } from "@/lib/admin/actions";
import type { UserRole } from "@/types";

type Org = { id: string; name: string };

type Props = {
  user: UserWithOrgs;
  organizations: Org[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function UserEditDialog({
  user,
  organizations,
  open,
  onOpenChange,
}: Props) {
  const [displayName, setDisplayName] = useState(user.displayName ?? "");
  const [role, setRole] = useState<UserRole>(user.role as UserRole);
  const [orgId, setOrgId] = useState(user.orgId ?? "");
  const { selectedOrgIds, toggleOrg } = useOrgSelection(
    user.assignedOrgs.map((o) => o.id)
  );
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const result = await updateUser(user.id, {
      displayName: displayName || undefined,
      role,
      orgId: role === "client" ? orgId || null : null,
      orgIds: role === "staff" ? selectedOrgIds : undefined,
    });

    setLoading(false);

    if (result.success) {
      toast.success("ユーザー情報を更新しました");
      onOpenChange(false);
    } else {
      toast.error(result.error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ユーザーを編集</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>メールアドレス</Label>
            <Input value={user.email} disabled />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-display-name">表示名</Label>
            <Input
              id="edit-display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="表示名を入力"
            />
          </div>

          <div className="space-y-2">
            <Label>ロール</Label>
            <Select
              value={role}
              onValueChange={(v) => setRole(v as UserRole)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">管理者</SelectItem>
                <SelectItem value="staff">担当者</SelectItem>
                <SelectItem value="client">クライアント</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {role === "client" && (
            <div className="space-y-2">
              <Label>所属組織</Label>
              <Select value={orgId} onValueChange={setOrgId}>
                <SelectTrigger>
                  <SelectValue placeholder="組織を選択" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {role === "staff" && organizations.length > 0 && (
            <OrgSelector
              organizations={organizations}
              selectedOrgIds={selectedOrgIds}
              onToggle={toggleOrg}
            />
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              キャンセル
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "保存中..." : "保存"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
