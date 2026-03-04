import Image from "next/image";
import { Badge } from "@/components/ui/badge";

function DemoSidebar() {
  return (
    <aside className="hidden h-screen w-60 flex-col border-r bg-background md:flex">
      <div className="flex h-14 items-center gap-3 border-b px-4">
        <Image src="/logo.png" alt="Logo" width={32} height={32} className="h-8 w-8" />
        <div>
          <span className="text-sm font-semibold">GBP Dashboard</span>
          <p className="text-[10px] leading-tight text-muted-foreground">Performance Analytics</p>
        </div>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center px-4">
        <Badge variant="secondary" className="text-xs">
          デモモード
        </Badge>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          架空のサロンデータで
          <br />
          機能をお試しいただけます
        </p>
      </div>
    </aside>
  );
}

function DemoMobileHeader() {
  return (
    <header className="flex h-14 items-center gap-3 border-b bg-background px-4 md:hidden">
      <Image src="/logo.png" alt="Logo" width={28} height={28} className="h-7 w-7" />
      <span className="text-sm font-semibold">GBP Dashboard</span>
      <Badge variant="secondary" className="ml-auto text-xs">
        デモモード
      </Badge>
    </header>
  );
}

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col bg-background md:flex-row">
      <DemoSidebar />
      <DemoMobileHeader />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl p-4 md:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
