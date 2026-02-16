import { getSession } from "@/lib/auth/guards";
import { getUsers, getOrganizationsForSelect } from "@/lib/admin/actions";
import { UserTable } from "@/components/admin/user-table";
import { UserInviteDialog } from "@/components/admin/user-invite-dialog";

export default async function UsersPage() {
  const [session, usersResult, orgsResult] = await Promise.all([
    getSession(),
    getUsers(),
    getOrganizationsForSelect(),
  ]);

  const users = usersResult.success ? usersResult.data : [];
  const organizations = orgsResult.success ? orgsResult.data : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">ユーザー管理</h2>
        <UserInviteDialog organizations={organizations} />
      </div>

      <UserTable
        users={users}
        currentUserId={session!.id}
        organizations={organizations}
      />
    </div>
  );
}
