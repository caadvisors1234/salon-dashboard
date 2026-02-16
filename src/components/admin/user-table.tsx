"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { UserEditDialog } from "./user-edit-dialog";
import { UserDeleteDialog } from "./user-delete-dialog";
import type { UserWithOrgs } from "@/lib/admin/actions";

const ROLE_LABELS: Record<string, string> = {
  admin: "管理者",
  staff: "担当者",
  client: "クライアント",
};

const ROLE_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  admin: "default",
  staff: "secondary",
  client: "outline",
};

type Org = { id: string; name: string };

type Props = {
  users: UserWithOrgs[];
  currentUserId: string;
  organizations: Org[];
};

export function UserTable({ users, currentUserId, organizations }: Props) {
  const [editUser, setEditUser] = useState<UserWithOrgs | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const getOrgDisplay = (user: UserWithOrgs) => {
    if (user.role === "admin") return "-";
    if (user.role === "client") return user.orgName ?? "未設定";
    if (user.role === "staff") {
      if (user.assignedOrgs.length === 0) return "未割当";
      return `${user.assignedOrgs.length}件`;
    }
    return "-";
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ja-JP");
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>メールアドレス</TableHead>
            <TableHead>表示名</TableHead>
            <TableHead>ロール</TableHead>
            <TableHead>所属組織</TableHead>
            <TableHead>作成日</TableHead>
            <TableHead className="w-24">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                ユーザーがいません
              </TableCell>
            </TableRow>
          ) : (
            users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.email}</TableCell>
                <TableCell>{user.displayName ?? "-"}</TableCell>
                <TableCell>
                  <Badge variant={ROLE_VARIANTS[user.role] ?? "outline"}>
                    {ROLE_LABELS[user.role] ?? user.role}
                  </Badge>
                </TableCell>
                <TableCell>{getOrgDisplay(user)}</TableCell>
                <TableCell>{formatDate(user.createdAt)}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditUser(user)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={user.id === currentUserId}
                      onClick={() =>
                        setDeleteTarget({
                          id: user.id,
                          name: user.displayName || user.email,
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {editUser && (
        <UserEditDialog
          user={editUser}
          organizations={organizations}
          open={!!editUser}
          onOpenChange={(open) => {
            if (!open) setEditUser(null);
          }}
        />
      )}

      {deleteTarget && (
        <UserDeleteDialog
          userId={deleteTarget.id}
          userName={deleteTarget.name}
          open={!!deleteTarget}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
        />
      )}
    </>
  );
}
