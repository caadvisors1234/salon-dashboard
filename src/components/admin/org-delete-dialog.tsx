"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { deleteOrganization } from "@/lib/admin/actions";

type Props = {
  orgId: string;
  orgName: string;
  locationCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function OrgDeleteDialog({
  orgId,
  orgName,
  locationCount,
  open,
  onOpenChange,
}: Props) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    const result = await deleteOrganization(orgId);
    setLoading(false);

    if (result.success) {
      toast.success("クライアントを削除しました");
      onOpenChange(false);
    } else {
      toast.error(result.error);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{orgName} を削除しますか？</AlertDialogTitle>
          <AlertDialogDescription>
            この組織に紐づく店舗（{locationCount}件）、パフォーマンスデータ、HPBデータも全て削除されます。この操作は取り消せません。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>キャンセル</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? "削除中..." : "削除"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
