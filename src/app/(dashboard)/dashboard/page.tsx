import { getSession } from "@/lib/auth/guards";

export default async function DashboardPage() {
  const user = await getSession();

  return (
    <div>
      <h2 className="text-2xl font-bold">ダッシュボード</h2>
      <p className="mt-2 text-muted-foreground">
        ようこそ、{user?.displayName || user?.email} さん
      </p>
    </div>
  );
}
