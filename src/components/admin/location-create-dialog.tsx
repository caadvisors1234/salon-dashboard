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

      // GBP Location ID が設定されている場合、バックグラウンドでデータ取得開始
      if (gbpLocationId) {
        fetch("/api/batch/trigger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobType: "initial-backfill",
            locationId: result.data.id,
          }),
        })
          .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
          })
          .then((data) => {
            if (data.success) {
              toast.info("過去データの取得を開始しました（完了まで数分かかります）");
            } else {
              toast.error(`データ取得の開始に失敗しました: ${data.error}`);
            }
          })
          .catch(() => {
            toast.error("データ取得リクエストに失敗しました");
          });
      }

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
