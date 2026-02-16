"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Building2, Upload, Settings, LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { logout } from "@/lib/auth/actions";
import type { AuthUser } from "@/types";

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
  /** Admin / Staff のみ表示 */
  roles?: string[];
};

const NAV_ITEMS: NavItem[] = [
  {
    label: "ダッシュボード",
    href: "/dashboard",
    icon: <LayoutDashboard className="h-4 w-4" />,
  },
  {
    label: "HPBアップロード",
    href: "/dashboard/hpb-upload",
    icon: <Upload className="h-4 w-4" />,
    roles: ["admin", "staff"],
  },
  {
    label: "ユーザー管理",
    href: "/dashboard/admin/users",
    icon: <Users className="h-4 w-4" />,
    adminOnly: true,
  },
  {
    label: "クライアント管理",
    href: "/dashboard/admin/clients",
    icon: <Building2 className="h-4 w-4" />,
    adminOnly: true,
  },
  {
    label: "システム設定",
    href: "/dashboard/admin/settings",
    icon: <Settings className="h-4 w-4" />,
    adminOnly: true,
  },
];

const ROLE_LABELS: Record<string, string> = {
  admin: "管理者",
  staff: "担当者",
  client: "クライアント",
};

export function Sidebar({ user }: { user: AuthUser }) {
  const pathname = usePathname();

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.adminOnly) return user.role === "admin";
    if (item.roles) return item.roles.includes(user.role);
    return true;
  });

  const adminItems = visibleItems.filter((item) => item.adminOnly);
  const mainItems = visibleItems.filter((item) => !item.adminOnly);

  return (
    <aside className="flex h-screen w-60 flex-col border-r bg-background">
      {/* App Title */}
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/dashboard" className="text-sm font-semibold">
          GBP Dashboard
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3">
        <div className="space-y-1">
          {mainItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              isActive={pathname === item.href}
            />
          ))}
        </div>

        {adminItems.length > 0 && (
          <>
            <Separator className="my-3" />
            <p className="mb-2 px-3 text-xs font-medium text-muted-foreground">
              管理
            </p>
            <div className="space-y-1">
              {adminItems.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  isActive={pathname.startsWith(item.href)}
                />
              ))}
            </div>
          </>
        )}
      </nav>

      {/* User Info + Logout */}
      <div className="border-t p-3">
        <div className="mb-2 px-3">
          <p className="truncate text-sm font-medium">
            {user.displayName || user.email}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {ROLE_LABELS[user.role] || user.role}
            </Badge>
          </div>
        </div>
        <form action={logout}>
          <Button variant="ghost" size="sm" className="w-full justify-start">
            <LogOut className="mr-2 h-4 w-4" />
            ログアウト
          </Button>
        </form>
      </div>
    </aside>
  );
}

function NavLink({ item, isActive }: { item: NavItem; isActive: boolean }) {
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
        isActive
          ? "bg-accent text-accent-foreground font-medium"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      }`}
    >
      {item.icon}
      {item.label}
    </Link>
  );
}
