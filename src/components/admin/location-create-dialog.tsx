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
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createLocation } from "@/lib/admin/actions";
import { GbpLocationSelect } from "./gbp-location-select";

export function LocationCreateDialog({ orgId }: { orgId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [gbpLocationId, setGbpLocationId] = useState("");
  const [placeId, setPlaceId] = useState("");
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setName("");
    setGbpLocationId("");
    setPlaceId("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const result = await createLocation(orgId, {
      name,
      gbpLocationId: gbpLocationId || undefined,
      placeId: placeId || undefined,
    });

    setLoading(false);

    if (result.success) {
      toast.success("店舗を追加しました");
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
          店舗を追加
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>店舗を追加</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="loc-name">店舗名</Label>
            <Input
              id="loc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 渋谷店"
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
            idPrefix="loc"
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              キャンセル
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "作成中..." : "作成"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
