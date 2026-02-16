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
import { LocationEditDialog } from "./location-edit-dialog";
import { LocationDeleteDialog } from "./location-delete-dialog";
import type { LocationRow } from "@/lib/admin/actions";

type Props = {
  locations: LocationRow[];
};

export function LocationTable({ locations }: Props) {
  const [editTarget, setEditTarget] = useState<LocationRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ja-JP");
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>店舗名</TableHead>
            <TableHead>GBP Location ID</TableHead>
            <TableHead>Place ID</TableHead>
            <TableHead>ステータス</TableHead>
            <TableHead>作成日</TableHead>
            <TableHead className="w-24">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {locations.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="text-center text-muted-foreground"
              >
                店舗がありません
              </TableCell>
            </TableRow>
          ) : (
            locations.map((loc) => (
              <TableRow key={loc.id}>
                <TableCell className="font-medium">{loc.name}</TableCell>
                <TableCell className="font-mono text-xs">
                  {loc.gbpLocationId ?? "-"}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {loc.placeId ?? "-"}
                </TableCell>
                <TableCell>
                  <Badge variant={loc.isActive ? "default" : "secondary"}>
                    {loc.isActive ? "有効" : "無効"}
                  </Badge>
                </TableCell>
                <TableCell>{formatDate(loc.createdAt)}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditTarget(loc)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setDeleteTarget({ id: loc.id, name: loc.name })
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
        <LocationEditDialog
          location={editTarget}
          open={!!editTarget}
          onOpenChange={(open) => {
            if (!open) setEditTarget(null);
          }}
        />
      )}

      {deleteTarget && (
        <LocationDeleteDialog
          locationId={deleteTarget.id}
          locationName={deleteTarget.name}
          open={!!deleteTarget}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
        />
      )}
    </>
  );
}
