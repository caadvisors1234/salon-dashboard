import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_LOGIN_REDIRECT, LOGIN_PATH } from "@/lib/auth/constants";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as
    | "invite"
    | "recovery"
    | "signup"
    | "email"
    | null;

  const redirectUrl = request.nextUrl.clone();

  if (!token_hash || !type) {
    redirectUrl.pathname = LOGIN_PATH;
    redirectUrl.searchParams.set("error", "invalid_link");
    return NextResponse.redirect(redirectUrl);
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.verifyOtp({
    token_hash,
    type,
  });

  if (error) {
    redirectUrl.pathname = LOGIN_PATH;
    redirectUrl.searchParams.set("error", "auth_error");
    return NextResponse.redirect(redirectUrl);
  }

  // 招待 or パスワードリカバリー → パスワード設定ページへ
  if (type === "invite" || type === "recovery") {
    redirectUrl.pathname = "/auth/set-password";
    redirectUrl.searchParams.delete("token_hash");
    redirectUrl.searchParams.delete("type");
    return NextResponse.redirect(redirectUrl);
  }

  // その他 → ダッシュボードへ
  redirectUrl.pathname = DEFAULT_LOGIN_REDIRECT;
  redirectUrl.searchParams.delete("token_hash");
  redirectUrl.searchParams.delete("type");
  return NextResponse.redirect(redirectUrl);
}
