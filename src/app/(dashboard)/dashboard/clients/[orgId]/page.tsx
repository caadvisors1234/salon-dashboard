import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/guards";
import { getLocationSummaries } from "@/lib/dashboard/queries";
import { LocationListTable } from "@/components/dashboard/location-list-table";
import { Breadcrumb } from "@/components/dashboard/breadcrumb";
import { ReportDialog } from "@/components/dashboard/report-dialog";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const user = await requireAuth();
  const { orgId } = await params;

  // Client ロールは自社のみアクセス可能
  if (user.role === "client" && user.orgId !== orgId) {
    notFound();
  }

  const { orgName, locations, targetMonth } = await getLocationSummaries(orgId);

  if (!orgName) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Breadcrumb
            items={[
              { label: "ダッシュボード", href: "/dashboard" },
              { label: orgName },
            ]}
          />
          <ReportDialog type="client" orgId={orgId} />
        </div>
        <h1 className="text-2xl font-bold">{orgName}</h1>
        <p className="text-sm text-muted-foreground">
          店舗別パフォーマンスサマリー（{locations.length}店舗）
        </p>
      </div>
      <LocationListTable locations={locations} orgId={orgId} targetMonth={targetMonth} />
    </div>
  );
}
