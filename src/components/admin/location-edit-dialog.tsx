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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { updateLocation } from "@/lib/admin/actions";
import type { LocationRow } from "@/lib/admin/actions";
import { GbpLocationSelect } from "./gbp-location-select";

type Props = {
  location: LocationRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function LocationEditDialog({ location, open, onOpenChange }: Props) {
  const [name, setName] = useState(location.name);
  const [gbpLocationId, setGbpLocationId] = useState(
    location.gbpLocationId ?? ""
  );
  const [placeId, setPlaceId] = useState(location.placeId ?? "");
  const [isActive, setIsActive] = useState(location.isActive);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const result = await updateLocation(location.id, {
      name,
      gbpLocationId: gbpLocationId || null,
      placeId: placeId || null,
      isActive,
    });

    setLoading(false);

    if (result.success) {
      toast.success("店舗情報を更新しました");
      onOpenChange(false);
    } else {
      toast.error(result.error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>店舗を編集</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-loc-name">店舗名</Label>
            <Input
              id="edit-loc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <GbpLocationSelect
            value={gbpLocationId}
            placeIdValue={placeId}
            onChange={(locId, pId) => {
              setGbpLocationId(locId);
              setPlaceId(pId);
            }}
            idPrefix="edit-loc"
          />
          <div className="flex items-center justify-between">
            <Label htmlFor="edit-loc-active">有効</Label>
            <Switch
              id="edit-loc-active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>
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
