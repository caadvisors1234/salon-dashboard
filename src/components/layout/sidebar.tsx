"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Building2, Upload, Settings, LogOut, Menu } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { logout } from "@/lib/auth/actions";
import type { AuthUser } from "@/types";
import { useState } from "react";

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean;
  /** Admin / Staff のみ表示 */
  roles?: string[];
  /** パス名がアクティブかどうかを判定するカスタム関数 */
  matchPath?: (pathname: string) => boolean;
};

const NAV_ITEMS: NavItem[] = [
  {
    label: "ダッシュボード",
    href: "/dashboard",
    icon: LayoutDashboard,
    matchPath: (p) => p === "/dashboard" || p.startsWith("/dashboard/clients"),
  },
  {
    label: "HPBアップロード",
    href: "/dashboard/hpb-upload",
    icon: Upload,
    roles: ["admin", "staff"],
  },
  {
    label: "ユーザー管理",
    href: "/dashboard/admin/users",
    icon: Users,
    adminOnly: true,
  },
  {
    label: "クライアント管理",
    href: "/dashboard/admin/clients",
    icon: Building2,
    adminOnly: true,
  },
  {
    label: "システム設定",
    href: "/dashboard/admin/settings",
    icon: Settings,
    adminOnly: true,
  },
];

const ROLE_LABELS: Record<string, string> = {
  admin: "管理者",
  staff: "担当者",
  client: "クライアント",
};

function NavLink({ item, isActive, onClick }: { item: NavItem; isActive: boolean; onClick?: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-200 ${
        isActive
          ? "bg-accent font-medium text-accent-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      }`}
    >
      <div
        className={`flex h-7 w-7 items-center justify-center rounded-md ${
          isActive
            ? "bg-primary text-primary-foreground"
            : ""
        }`}
      >
        <Icon className="h-4 w-4" />
      </div>
      {item.label}
    </Link>
  );
}

function getInitials(name: string): string {
  return name
    .split(/[\s@]+/)
    .slice(0, 2)
    .map((s) => s[0] || "")
    .join("")
    .toUpperCase();
}

function UserInfo({ user }: { user: AuthUser }) {
  const displayName = user.displayName || user.email;
  return (
    <div className="border-t p-3">
      <div className="mb-2 flex items-center gap-3 px-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
          {getInitials(displayName)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {displayName}
          </p>
          <Badge variant="secondary" className="mt-0.5 text-xs">
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
  );
}

function SidebarNav({ user, onNavClick }: { user: AuthUser; onNavClick?: () => void }) {
  const pathname = usePathname();

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.adminOnly) return user.role === "admin";
    if (item.roles) return item.roles.includes(user.role);
    return true;
  });

  const adminItems = visibleItems.filter((item) => item.adminOnly);
  const mainItems = visibleItems.filter((item) => !item.adminOnly);

  return (
    <>
      <nav className="flex-1 overflow-y-auto p-3">
        <div className="space-y-1">
          {mainItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              isActive={item.matchPath ? item.matchPath(pathname) : pathname === item.href}
              onClick={onNavClick}
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
                  onClick={onNavClick}
                />
              ))}
            </div>
          </>
        )}
      </nav>
      <UserInfo user={user} />
    </>
  );
}

function LogoArea(props: React.ComponentProps<"div">) {
  return (
    <div className="flex h-14 items-center gap-3 border-b px-4" {...props}>
      <Image src="/logo.png" alt="Logo" width={32} height={32} className="h-8 w-8" />
      <div>
        <span className="text-sm font-semibold">GBP Dashboard</span>
        <p className="text-[10px] leading-tight text-muted-foreground">Performance Analytics</p>
      </div>
    </div>
  );
}

/** デスクトップ用サイドバー */
export function Sidebar({ user }: { user: AuthUser }) {
  return (
    <aside className="hidden h-screen w-60 flex-col border-r bg-background md:flex">
      <Link href="/dashboard">
        <LogoArea />
      </Link>
      <SidebarNav user={user} />
    </aside>
  );
}

/** モバイル用ヘッダー + ドロワー */
export function MobileHeader({ user }: { user: AuthUser }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="flex h-14 items-center border-b bg-background px-4 md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="sm" className="-ml-2">
            <Menu className="h-5 w-5" />
            <span className="sr-only">メニューを開く</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-60 p-0">
          <SheetHeader className="p-0">
            <SheetTitle asChild>
              <LogoArea />
            </SheetTitle>
          </SheetHeader>
          <div className="flex flex-1 flex-col">
            <SidebarNav user={user} onNavClick={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
      <Link href="/dashboard" className="ml-2 flex items-center gap-2">
        <Image src="/logo.png" alt="Logo" width={28} height={28} className="h-7 w-7" />
        <span className="text-sm font-semibold">GBP Dashboard</span>
      </Link>
    </header>
  );
}
