"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { OrgEditDialog } from "./org-edit-dialog";
import { OrgDeleteDialog } from "./org-delete-dialog";
import type { OrganizationWithCount } from "@/lib/admin/actions";

type Props = {
  organizations: OrganizationWithCount[];
};

export function OrgTable({ organizations }: Props) {
  const router = useRouter();
  const [editTarget, setEditTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
    locationCount: number;
  } | null>(null);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ja-JP");
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>組織名</TableHead>
            <TableHead>店舗数</TableHead>
            <TableHead>作成日</TableHead>
            <TableHead className="w-32">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {organizations.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={4}
                className="text-center text-muted-foreground"
              >
                クライアントがいません
              </TableCell>
            </TableRow>
          ) : (
            organizations.map((org) => (
              <TableRow key={org.id}>
                <TableCell className="font-medium">{org.name}</TableCell>
                <TableCell>{org.locationCount}件</TableCell>
                <TableCell>{formatDate(org.createdAt)}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        router.push(`/dashboard/admin/clients/${org.id}`)
                      }
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setEditTarget({ id: org.id, name: org.name })
                      }
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setDeleteTarget({
                          id: org.id,
                          name: org.name,
                          locationCount: org.locationCount,
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

      {editTarget && (
        <OrgEditDialog
          orgId={editTarget.id}
          currentName={editTarget.name}
          open={!!editTarget}
          onOpenChange={(open) => {
            if (!open) setEditTarget(null);
          }}
        />
      )}

      {deleteTarget && (
        <OrgDeleteDialog
          orgId={deleteTarget.id}
          orgName={deleteTarget.name}
          locationCount={deleteTarget.locationCount}
          open={!!deleteTarget}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
        />
      )}
    </>
  );
}
