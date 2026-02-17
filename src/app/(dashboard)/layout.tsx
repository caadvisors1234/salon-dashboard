import { requireAuth } from "@/lib/auth/guards";
import { Sidebar, MobileHeader } from "@/components/layout/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();

  return (
    <div className="flex h-screen flex-col bg-background md:flex-row">
      {/* デスクトップサイドバー */}
      <Sidebar user={user} />

      {/* モバイルヘッダー + ドロワー */}
      <MobileHeader user={user} />

      {/* メインコンテンツ */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl p-4 md:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
