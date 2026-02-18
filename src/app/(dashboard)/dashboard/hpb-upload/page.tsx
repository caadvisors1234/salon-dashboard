import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { UploadForm } from "@/components/hpb/upload-form";
import { DeleteForm } from "@/components/hpb/delete-form";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function HpbUploadPage() {
  await requireRole(["admin", "staff"]);
  const supabase = await createClient();

  // アクセス可能な店舗リスト取得（組織名付き）
  const { data: locations } = await supabase
    .from("locations")
    .select("id, name, org_id, organizations(name)")
    .eq("is_active", true)
    .order("name");

  const locationOptions = (locations ?? []).map((loc) => ({
    id: loc.id,
    name: loc.name,
    orgId: loc.org_id,
    orgName:
      (loc.organizations as unknown as { name: string })?.name ?? "不明",
  }));

  // アップロード履歴取得（最新10件）
  const { data: logs } = await supabase
    .from("hpb_upload_logs")
    .select("id, uploaded_at, file_name, record_count, status, location_id, locations(name)")
    .order("uploaded_at", { ascending: false })
    .limit(10);

  const uploadLogs = (logs ?? []).map((log) => ({
    id: log.id,
    uploadedAt: log.uploaded_at,
    fileName: log.file_name,
    recordCount: log.record_count,
    status: log.status,
    locationName:
      (log.locations as unknown as { name: string })?.name ?? "不明",
  }));

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold">HPBデータアップロード</h2>

      <UploadForm locations={locationOptions} />

      {/* HPBデータ削除 */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">HPBデータ削除</h3>
        <p className="text-sm text-muted-foreground">
          誤ってアップロードしたデータを月単位で削除できます。削除後に正しい店舗へ再アップロードしてください。
        </p>
        <DeleteForm locations={locationOptions} />
      </div>

      {/* アップロード履歴 */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">最近のアップロード履歴</h3>
        {uploadLogs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            アップロード履歴はありません
          </p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>日時</TableHead>
                  <TableHead>店舗名</TableHead>
                  <TableHead>件数</TableHead>
                  <TableHead>状態</TableHead>
                  <TableHead>ファイル名</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uploadLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">
                      {formatDate(log.uploadedAt)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.locationName}
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.recordCount ?? "-"}件
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={log.status} />
                    </TableCell>
                    <TableCell className="max-w-48 truncate text-sm text-muted-foreground">
                      {log.fileName}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "success":
      return (
        <Badge variant="default" className="bg-green-600">
          成功
        </Badge>
      );
    case "partial":
      return <Badge variant="secondary">一部</Badge>;
    case "failure":
      return <Badge variant="destructive">失敗</Badge>;
    case "deleted":
      return <Badge variant="outline" className="border-destructive text-destructive">削除済</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${month}/${day} ${hours}:${minutes}`;
}
