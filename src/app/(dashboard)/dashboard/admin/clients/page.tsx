import { getOrganizations } from "@/lib/admin/actions";
import { OrgTable } from "@/components/admin/org-table";
import { OrgCreateDialog } from "@/components/admin/org-create-dialog";

export default async function ClientsPage() {
  const result = await getOrganizations();
  const organizations = result.success ? result.data : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">クライアント管理</h2>
        <OrgCreateDialog />
      </div>

      <OrgTable organizations={organizations} />
    </div>
  );
}
