"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { inviteUser } from "@/lib/admin/actions";
import { useOrgSelection } from "@/hooks/use-org-selection";
import { OrgSelector } from "@/components/admin/org-selector";
import type { UserRole } from "@/types";

type Org = { id: string; name: string };

export function UserInviteDialog({ organizations }: { organizations: Org[] }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("staff");
  const [orgId, setOrgId] = useState("");
  const [loading, setLoading] = useState(false);
  const { selectedOrgIds, toggleOrg, resetSelection } = useOrgSelection();

  const resetForm = () => {
    setEmail("");
    setRole("staff");
    setOrgId("");
    resetSelection();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const result = await inviteUser(
      email,
      role,
      role === "client" ? orgId : undefined,
      role === "staff" ? selectedOrgIds : undefined
    );

    setLoading(false);

    if (result.success) {
      toast.success("招待メールを送信しました");
      resetForm();
      setOpen(false);
    } else {
      toast.error(result.error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          ユーザーを招待
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ユーザーを招待</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">メールアドレス</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              required
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
              <Select value={orgId} onValueChange={setOrgId} required>
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
              label="担当組織（任意）"
            />
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              キャンセル
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "送信中..." : "招待を送信"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
