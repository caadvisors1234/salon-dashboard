import { redirect, notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/guards";
import { getClientSummaries } from "@/lib/dashboard/queries";
import { ClientListTable } from "@/components/dashboard/client-list-table";

export default async function DashboardPage() {
  const user = await requireAuth();

  // Client ロールは自社クライアント詳細に直接リダイレクト
  if (user.role === "client") {
    if (!user.orgId) {
      notFound();
    }
    redirect(`/dashboard/clients/${user.orgId}`);
  }

  const { clients, targetMonth } = await getClientSummaries();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ダッシュボード</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          クライアント別パフォーマンスサマリー
        </p>
      </div>
      <ClientListTable clients={clients} targetMonth={targetMonth} />
    </div>
  );
}
