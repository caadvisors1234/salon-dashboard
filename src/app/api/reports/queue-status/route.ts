import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/guards";
import { pdfQueue } from "@/lib/pdf/queue";

export async function GET() {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "未認証です" }, { status: 401 });
  }

  const status = pdfQueue.getStatus();
  return NextResponse.json(status);
}
