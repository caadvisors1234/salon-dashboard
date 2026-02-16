// 未認証でもアクセス可能なパス
export const PUBLIC_PATHS = [
  "/login",
  "/auth/confirm",
  "/auth/reset-password",
  "/auth/set-password",
];

// ログイン後のデフォルト遷移先（全ロール共通）
export const DEFAULT_LOGIN_REDIRECT = "/dashboard";

// 未認証時のリダイレクト先
export const LOGIN_PATH = "/login";
