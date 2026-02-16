import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrganizationDetail, getLocations } from "@/lib/admin/actions";
import { LocationTable } from "@/components/admin/location-table";
import { LocationCreateDialog } from "@/components/admin/location-create-dialog";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export default async function OrgDetailPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;

  const [orgResult, locationsResult] = await Promise.all([
    getOrganizationDetail(orgId),
    getLocations(orgId),
  ]);

  if (!orgResult.success) {
    notFound();
  }

  const org = orgResult.data;
  const locations = locationsResult.success ? locationsResult.data : [];

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/dashboard/admin/clients">クライアント管理</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{org.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{org.name}</h2>
        <LocationCreateDialog orgId={orgId} />
      </div>

      <LocationTable locations={locations} />
    </div>
  );
}
