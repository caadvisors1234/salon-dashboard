// 未認証でもアクセス可能なパス
// /report はPuppeteer PDF生成用（report_token cookieで独自認証）
export const PUBLIC_PATHS = [
  "/login",
  "/auth/confirm",
  "/auth/reset-password",
  "/auth/set-password",
  "/report",
  "/demo",
];

// ログイン後のデフォルト遷移先（全ロール共通）
export const DEFAULT_LOGIN_REDIRECT = "/dashboard";

// 未認証時のリダイレクト先
export const LOGIN_PATH = "/login";
