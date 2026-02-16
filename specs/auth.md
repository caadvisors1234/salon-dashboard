# 認証・認可（ログイン・招待制ユーザー登録・ロールベースアクセス制御）

**ステータス**: COMPLETED
**作成日**: 2026-02-16
**要件定義書参照**: セクション 2（ユーザー・権限設計）、セクション 4.1（画面一覧）、セクション 5.1（技術スタック）

---

## 1. 概要

Supabase Authを使用した認証・認可システムを実装する。クローズドアプリ（招待制）として、管理者がユーザーを招待・登録し、3ロール（Admin/Staff/Client）に基づくアクセス制御を行う。

### スコープ

**含む:**
- ログインページ（メール + パスワード）
- パスワードリセット機能（メールリンク方式）
- 招待受諾ページ（パスワード設定）
- Auth Callbackルート（トークン交換）
- ルート保護（未認証リダイレクト + ロールベースアクセス制御）
- Server Actions（ログイン・ログアウト・パスワードリセット）
- 認証ユーティリティ（セッション取得・ロール取得・権限チェック）

**含まない:**
- ユーザー管理CRUD画面（Admin: 招待・編集・削除 → 別Spec「管理画面」で実装）
- セルフサインアップ機能（要件上、招待制のため不要）
- ソーシャルログイン / MFA

---

## 2. 認証方式

### 2.1 基本設計

| 項目 | 内容 |
|------|------|
| 認証プロバイダ | Supabase Auth（メール + パスワード） |
| セッション管理 | JWT トークン（Cookie保存、@supabase/ssr） |
| セッション更新 | Next.js Proxy（src/proxy.ts）で毎リクエスト自動リフレッシュ |
| セルフサインアップ | **無効化**（Supabaseダッシュボードで設定） |
| パスワードリセット | メールリンク方式（Supabase Auth標準） |

### 2.2 招待フロー

```
Admin（管理画面）
  ↓ supabase.auth.admin.inviteUserByEmail(email, { data: { role, org_id } })
  ↓ ※Server Action経由（service_role key使用）
招待メール送信（Supabase Auth）
  ↓
ユーザーがメールリンクをクリック
  ↓
/auth/confirm?token_hash=xxx&type=invite（Auth Callback）
  ↓ token_hash → セッション交換
/auth/set-password（パスワード設定ページ）
  ↓ supabase.auth.updateUser({ password })
/dashboard（ダッシュボードへリダイレクト）
```

**注記**: `inviteUserByEmail` は service_role キーが必要なため、Server Action / API Route でのみ実行する。招待時に `raw_user_meta_data` に `role` と `org_id` を設定し、既存の `handle_new_user` トリガーが `public.users` レコードを自動作成する。

### 2.3 ログインフロー

```
/login（ログインページ）
  ↓ supabase.auth.signInWithPassword({ email, password })
  ↓ 成功 → ロールに応じたリダイレクト
  ↓ 失敗 → エラーメッセージ表示
/dashboard（Admin/Staff）or /dashboard（Client）
```

### 2.4 パスワードリセットフロー

```
/login（「パスワードを忘れた」リンク）
  ↓
/auth/reset-password（メール入力ページ）
  ↓ supabase.auth.resetPasswordForEmail(email, { redirectTo })
  ↓
メールリンク送信（Supabase Auth）
  ↓
/auth/confirm?token_hash=xxx&type=recovery
  ↓ token_hash → セッション交換
/auth/set-password（新パスワード設定ページ）
  ↓ supabase.auth.updateUser({ password })
/dashboard（リダイレクト）
```

---

## 3. ルート保護

### 3.1 保護戦略

2層の保護を実装する:

1. **Proxy層（src/proxy.ts）**: セッション更新 + 未認証リダイレクト
2. **Layout層**: ロールベースアクセス制御

### 3.2 Proxy（ミドルウェア）のルート制御

```typescript
// 未認証 → /login にリダイレクト（以下のパス以外）
const PUBLIC_PATHS = ["/login", "/auth/confirm", "/auth/reset-password", "/auth/set-password"];

// 認証済み → /login アクセス時は /dashboard にリダイレクト
```

### 3.3 ロールベースアクセス制御（画面単位）

| パス | Admin | Staff | Client | 未認証 |
|------|-------|-------|--------|--------|
| `/login` | → /dashboard | → /dashboard | → /dashboard | OK |
| `/auth/*` | OK | OK | OK | OK |
| `/dashboard` | OK | OK | OK | → /login |
| `/dashboard/clients/[orgId]` | OK | 担当orgのみ | 自org のみ | → /login |
| `/dashboard/clients/[orgId]/locations/[locId]` | OK | 担当orgのみ | 自orgのみ | → /login |
| `/dashboard/admin/*` | OK | → /dashboard | → /dashboard | → /login |
| `/dashboard/hpb-upload` | OK | OK | → /dashboard | → /login |

**注記**: 画面レベルのアクセス制御はLayout/Pageで実装。データレベルの制御はRLS（既に実装済み）が担保する。

---

## 4. ファイル構成

```
src/
├── proxy.ts                              # 更新: ルート保護ロジック追加
├── app/
│   ├── (auth)/
│   │   ├── layout.tsx                    # 認証ページ用レイアウト（センタリング）
│   │   ├── login/
│   │   │   └── page.tsx                  # ログインページ
│   │   └── auth/
│   │       ├── confirm/
│   │       │   └── route.ts             # Auth Callback（token_hash → session）
│   │       ├── reset-password/
│   │       │   └── page.tsx             # パスワードリセット要求ページ
│   │       └── set-password/
│   │           └── page.tsx             # パスワード設定ページ（招待/リセット共用）
│   ├── (dashboard)/
│   │   └── layout.tsx                    # 更新: 認証チェック + ロール取得
│   └── api/
│       └── auth/
│           └── invite/
│               └── route.ts             # 招待API（Admin専用、service_role使用）
├── lib/
│   ├── supabase/
│   │   ├── admin.ts                     # 新規: service_role client（サーバー専用）
│   │   ├── client.ts                    # 既存
│   │   ├── server.ts                    # 既存
│   │   └── middleware.ts                # 既存
│   └── auth/
│       ├── actions.ts                   # Server Actions（login, logout, resetPassword, setPassword）
│       ├── guards.ts                    # 認証ガード（requireAuth, requireRole, getSession）
│       └── constants.ts                 # 定数（PUBLIC_PATHS, ROLE_REDIRECTS）
├── components/
│   └── auth/
│       ├── login-form.tsx               # ログインフォーム（Client Component）
│       ├── reset-password-form.tsx       # パスワードリセットフォーム
│       └── set-password-form.tsx         # パスワード設定フォーム
└── types/
    └── index.ts                          # 更新: AuthUser型追加
```

---

## 5. Technical Strategy

### 5.1 Supabase Admin Client（service_role）

招待APIで使用する service_role クライアントを新規作成する。

```typescript
// src/lib/supabase/admin.ts
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!  // サーバー専用、NEXT_PUBLIC不可
  );
}
```

**環境変数追加**:
- `SUPABASE_SERVICE_ROLE_KEY` を `.env.local` に追加（`NEXT_PUBLIC_` プレフィックスなし）

### 5.2 Server Actions

```typescript
// src/lib/auth/actions.ts
"use server";

// login: signInWithPassword → redirect
// logout: signOut → redirect to /login
// resetPassword: resetPasswordForEmail → success message
// setPassword: updateUser({ password }) → redirect to /dashboard
```

### 5.3 Auth Guards（サーバーサイド）

```typescript
// src/lib/auth/guards.ts

// getSession(): 現在のユーザー + public.users情報を取得
// requireAuth(): 未認証なら /login にリダイレクト
// requireRole(roles: UserRole[]): ロール不一致なら /dashboard にリダイレクト
```

### 5.4 Auth Confirm Route（トークン交換）

```typescript
// src/app/(auth)/auth/confirm/route.ts
// GET handler:
//   1. URLから token_hash, type を取得
//   2. supabase.auth.verifyOtp({ token_hash, type })
//   3. type === 'invite' || type === 'recovery' → /auth/set-password にリダイレクト
//   4. それ以外 → /dashboard にリダイレクト
//   5. エラー → /login?error=xxx にリダイレクト
```

### 5.5 Proxy更新（ルート保護）

```typescript
// src/proxy.ts 更新:
// 1. supabase.auth.getUser() でセッション確認
// 2. 未認証 + 保護パス → /login にリダイレクト
// 3. 認証済み + /login → /dashboard にリダイレクト
// 4. それ以外 → 通過
```

---

## 6. UI設計

### 6.1 ログインページ（/login）

- センタリングレイアウト
- アプリロゴ / タイトル
- メールアドレス入力（Input）
- パスワード入力（Input type=password）
- 「ログイン」ボタン（Button）
- 「パスワードを忘れた方」リンク → /auth/reset-password
- エラーメッセージ表示エリア
- ローディング状態（ボタン disabled + spinner）

### 6.2 パスワードリセット要求ページ（/auth/reset-password）

- メールアドレス入力
- 「リセットリンクを送信」ボタン
- 送信完了メッセージ
- 「ログインに戻る」リンク

### 6.3 パスワード設定ページ（/auth/set-password）

- 招待受諾 / パスワードリセット共用
- 新パスワード入力
- パスワード確認入力
- 「パスワードを設定」ボタン
- バリデーション: 最低8文字

### 6.4 共通デザイン

- shadcn/ui の Card, Input, Button, Label を使用
- ダーク/ライトモード対応（CSS変数による自動切替）
- レスポンシブ（モバイル対応）

---

## 7. エラーハンドリング

| シナリオ | 処理 |
|---------|------|
| メール/パスワード不一致 | 「メールアドレスまたはパスワードが正しくありません」 |
| アカウント無効 | 「アカウントが無効です。管理者にお問い合わせください」 |
| 招待トークン無効/期限切れ | 「招待リンクが無効または期限切れです」→ /login にリダイレクト |
| リセットトークン無効/期限切れ | 「リセットリンクが無効または期限切れです」→ /login にリダイレクト |
| パスワード要件不足 | 「パスワードは8文字以上で設定してください」 |
| ネットワークエラー | 「通信エラーが発生しました。再度お試しください」 |

---

## 8. Supabase設定（ダッシュボード）

以下の設定をSupabaseダッシュボードで行う:

1. **セルフサインアップの無効化**: Authentication > Settings > Enable email signup → OFF
2. **メールテンプレート**: デフォルトテンプレートを使用（初期段階）
3. **Redirect URL**: `http://localhost:3000/auth/confirm` を許可リストに追加
4. **JWT有効期限**: デフォルト（3600秒 = 1時間）を維持

---

## 9. 依存関係

### 前提（実装済み）
- [x] Supabaseクライアント設定（client.ts, server.ts, middleware.ts, proxy.ts）
- [x] DBスキーマ（usersテーブル、user_org_assignmentsテーブル）
- [x] RLSポリシー（全10テーブル）
- [x] `handle_new_user` トリガー（auth.users → public.users同期）
- [x] `get_user_role()` / `get_accessible_org_ids()` ヘルパー関数

### 新規追加パッケージ
- なし（既存の @supabase/supabase-js, @supabase/ssr で対応可能）

### 環境変数追加
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service_role キー（サーバー専用）

---

## 10. 解決済みの質問

1. **Q1: ユーザー管理画面のスコープ** → 招待APIはこのSpec、CRUD画面は別Spec「管理画面」に分離。**→ OK**
2. **Q2: ログイン後のデフォルト遷移先** → 全ロール共通で `/dashboard` に遷移。**→ OK**
3. **Q3: 招待メールテンプレート** → 初期段階はSupabaseデフォルト（英語）を使用。**→ OK**

---

## 参照

- 要件定義書: `docs/GBP_Dashboard_Requirements_v1_7.md` セクション 2, 4.1, 5.1
- DBスキーマSpec: `specs/db-schema-rls.md`
- Supabase Auth Docs: https://supabase.com/docs/guides/auth
- Supabase SSR (Next.js): https://supabase.com/docs/guides/auth/server-side/nextjs
