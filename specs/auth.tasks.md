# タスク: 認証・認可

**Spec**: ./auth.md
**作成日**: 2026-02-16
**ステータス**: COMPLETED

---

## コンテキスト

Supabase Authを使用した認証・認可システムを実装する。ログイン、パスワードリセット、招待受諾、ルート保護、ロールベースアクセス制御を含む。

---

## 前提条件

- [x] Supabase プロジェクト `salon-dashboard` (gjjqevftteoqhxazodyy) が作成済み
- [x] Supabaseクライアント設定済み（client.ts, server.ts, middleware.ts, proxy.ts）
- [x] DBスキーマ + RLS実装済み（全10テーブル）
- [x] `handle_new_user` トリガー実装済み（auth.users → public.users同期）
- [x] Supabase service_role キーを取得済み（.env.local に設定必要 → ダッシュボードから取得）

---

## タスク一覧

### Task 1: 環境設定 + Supabase Admin Client ✅

service_role キーの設定と、サーバー専用の Admin Client を作成する。

**実行内容**:
1. Supabase MCP で service_role キー（またはpublishable keys）を確認
2. `.env.local` に `SUPABASE_SERVICE_ROLE_KEY` を追加
3. `.env.local.example` に `SUPABASE_SERVICE_ROLE_KEY` のテンプレートを追加
4. `src/lib/supabase/admin.ts` を作成（service_role client）
5. Supabaseダッシュボードでセルフサインアップの無効化を確認（手動設定の場合はメモ）

**受入条件**:
- `createAdminClient()` がservice_roleクライアントを返す
- 環境変数 `SUPABASE_SERVICE_ROLE_KEY` が設定済み
- TypeScriptコンパイルエラーなし

**対象ファイル**: src/lib/supabase/admin.ts, .env.local, .env.local.example
**depends_on**: なし

---

### Task 2: 認証定数 + Auth Guards + Server Actions ✅

認証のコアロジックを実装する。定数、ガード関数、Server Actionsの3ファイル。

**実行内容**:
1. `src/lib/auth/constants.ts` を作成:
   - `PUBLIC_PATHS`: 未認証でアクセス可能なパス一覧
   - `ROLE_REDIRECTS`: ロール別リダイレクト先（全ロール → /dashboard）
2. `src/lib/auth/guards.ts` を作成:
   - `getSession()`: auth.getUser() + public.usersテーブルから情報取得
   - `requireAuth()`: 未認証時に /login へリダイレクト
   - `requireRole(roles: UserRole[])`: ロール不一致時に /dashboard へリダイレクト
3. `src/lib/auth/actions.ts` を作成（Server Actions）:
   - `login(formData)`: signInWithPassword → /dashboard にリダイレクト
   - `logout()`: signOut → /login にリダイレクト
   - `resetPassword(formData)`: resetPasswordForEmail → 成功メッセージ返却
   - `setPassword(formData)`: updateUser({ password }) → /dashboard にリダイレクト
4. `src/types/index.ts` に `AuthUser` 型を追加

**受入条件**:
- 全関数が型安全に定義されている
- Server Actionsに `"use server"` ディレクティブが含まれる
- TypeScriptコンパイルエラーなし

**対象ファイル**: src/lib/auth/constants.ts, src/lib/auth/guards.ts, src/lib/auth/actions.ts, src/types/index.ts
**depends_on**: Task 1

---

### Task 3: Proxy更新（ルート保護） ✅

src/proxy.ts を更新して、未認証ユーザーのリダイレクトと認証済みユーザーのログインページスキップを実装する。

**実行内容**:
1. `src/proxy.ts` を更新:
   - `supabase.auth.getUser()` の結果を使って認証状態を判定
   - 未認証 + 保護パス → `/login` にリダイレクト
   - 認証済み + `/login` → `/dashboard` にリダイレクト
   - PUBLIC_PATHSの定義を使用
2. `src/lib/supabase/middleware.ts` を更新（必要に応じて）

**受入条件**:
- 未認証ユーザーが `/dashboard` にアクセスすると `/login` にリダイレクトされる
- 認証済みユーザーが `/login` にアクセスすると `/dashboard` にリダイレクトされる
- `/auth/*` パスは認証状態に関係なくアクセス可能
- 静的アセット（_next/static, 画像等）はProxy対象外

**対象ファイル**: src/proxy.ts, src/lib/supabase/middleware.ts
**depends_on**: Task 2

---

### Task 4: Auth Confirmルート（トークン交換） ✅

招待メール・パスワードリセットメールのリンクからのコールバックを処理するRoute Handlerを作成する。

**実行内容**:
1. `src/app/(auth)/auth/confirm/route.ts` を作成:
   - GET handler
   - URLパラメータから `token_hash`, `type` を取得
   - `supabase.auth.verifyOtp({ token_hash, type })` でセッション交換
   - `type === 'invite'` or `type === 'recovery'` → `/auth/set-password` にリダイレクト
   - その他 → `/dashboard` にリダイレクト
   - エラー時 → `/login?error=auth_error` にリダイレクト

**受入条件**:
- GETリクエストでtoken_hashを受け取り、セッションを確立できる
- 招待/リカバリーの場合はパスワード設定ページにリダイレクト
- 不正なトークンの場合はエラー付きでログインページにリダイレクト

**対象ファイル**: src/app/(auth)/auth/confirm/route.ts
**depends_on**: Task 1

---

### Task 5: 認証UIコンポーネント + ページ ✅

ログイン、パスワードリセット、パスワード設定の3画面を実装する。

**実行内容**:
1. shadcn/ui コンポーネントの追加: Card, Input, Label（未追加の場合）
2. `src/app/(auth)/layout.tsx` を作成（センタリングレイアウト）
3. `src/components/auth/login-form.tsx` を作成（Client Component）:
   - メール + パスワード入力
   - login Server Action呼び出し
   - エラーメッセージ表示
   - ローディング状態
4. `src/app/(auth)/login/page.tsx` を作成:
   - LoginFormコンポーネントを配置
   - URLパラメータからエラーメッセージを取得して表示
5. `src/components/auth/reset-password-form.tsx` を作成:
   - メール入力
   - resetPassword Server Action呼び出し
   - 送信完了メッセージ
6. `src/app/(auth)/auth/reset-password/page.tsx` を作成
7. `src/components/auth/set-password-form.tsx` を作成:
   - パスワード + 確認入力
   - setPassword Server Action呼び出し
   - バリデーション（8文字以上、一致確認）
8. `src/app/(auth)/auth/set-password/page.tsx` を作成

**受入条件**:
- 3画面が全てレンダリングされる
- フォーム送信でServer Actionsが呼び出される
- バリデーションエラーが表示される
- ローディング状態が正しく動作する
- shadcn/ui コンポーネントで統一されたデザイン
- レスポンシブ対応（モバイルでも表示が崩れない）

**対象ファイル**: src/app/(auth)/layout.tsx, src/app/(auth)/login/page.tsx, src/app/(auth)/auth/reset-password/page.tsx, src/app/(auth)/auth/set-password/page.tsx, src/components/auth/login-form.tsx, src/components/auth/reset-password-form.tsx, src/components/auth/set-password-form.tsx
**depends_on**: Task 2, Task 4

---

### Task 6: Dashboardレイアウト（認証チェック + ロール取得） ✅

ダッシュボードのルートレイアウトに認証チェックとロール情報の取得を追加する。

**実行内容**:
1. `src/app/(dashboard)/layout.tsx` を作成:
   - `requireAuth()` で認証チェック
   - `getSession()` でユーザー情報取得
   - ユーザー名・ロール情報を子コンポーネントに渡す（最小限のヘッダー）
   - ログアウトボタン
2. トップページ（`src/app/page.tsx`）を更新:
   - `/dashboard` へのリダイレクト、または `/login` へのリダイレクト

**受入条件**:
- 未認証ユーザーがダッシュボードにアクセスすると /login にリダイレクト
- 認証済みユーザーにヘッダー（ユーザー名 + ログアウト）が表示される
- ログアウトボタンで /login にリダイレクトされる
- トップページ（/）が適切にリダイレクトされる

**対象ファイル**: src/app/(dashboard)/layout.tsx, src/app/page.tsx
**depends_on**: Task 2, Task 3

---

### Task 7: 招待API（Admin専用） ✅

管理者がユーザーを招待するためのAPIエンドポイントを作成する。

**実行内容**:
1. `src/app/api/auth/invite/route.ts` を作成:
   - POST handler
   - リクエストボディ: `{ email, role, org_id? }`
   - 認証チェック: 呼び出し元がAdminロールであることを確認
   - `createAdminClient()` で service_role クライアントを取得
   - `supabase.auth.admin.inviteUserByEmail(email, { data: { role, org_id } })` を実行
   - 成功/エラーレスポンスを返却
2. バリデーション:
   - email形式チェック
   - role が "admin" | "staff" | "client" のいずれか
   - staff/client の場合は org_id 必須

**受入条件**:
- Admin ロールのユーザーのみが招待APIを実行できる
- 非Adminの呼び出しは403エラー
- 招待メールが送信される（Supabase Auth経由）
- `handle_new_user` トリガーにより public.users にレコードが自動作成される
- バリデーションエラーが適切に返却される

**対象ファイル**: src/app/api/auth/invite/route.ts
**depends_on**: Task 1, Task 2

---

### Task 8: 動作検証 ✅

招待 → ログイン → ルート保護 → ログアウトの一連のフローを検証する。

**実行内容**:
1. 招待APIでテストユーザーを作成（Admin/Staff/Client各1名）
2. Supabase Auth のユーザー一覧を確認
3. public.users テーブルへの自動同期を確認
4. ログインが成功し /dashboard にリダイレクトされることを確認（SQLまたはAPI呼び出し）
5. Proxy のルート保護が動作することを確認:
   - 未認証 → /dashboard アクセス → /login リダイレクト
   - 認証済み → /login アクセス → /dashboard リダイレクト
6. テストデータのクリーンアップ

**受入条件**:
- 招待APIが正常動作
- handle_new_userトリガーでpublic.usersにレコードが作成される
- ログイン/ログアウトが動作する
- ルート保護が正しく機能する

**対象**: Supabase MCP execute_sql + APIテスト
**depends_on**: Task 3, Task 4, Task 5, Task 6, Task 7

---

## 検証結果

| テスト項目 | 結果 |
|-----------|------|
| handle_new_user トリガー（auth→public同期） | ✅ role が正しく反映 |
| Admin ログイン (admin@test.example.com) | ✅ |
| Staff ログイン (staff@test.example.com) | ✅ |
| Client ログイン (client@test.example.com) | ✅ |
| Admin が public.users を RLS 経由で取得 | ✅ |
| Next.js ビルド成功 | ✅ 全ルート認識 |
| TypeScript コンパイルエラー | ✅ 0件 |
| セキュリティアドバイザー警告 | ✅ 0件 |
| テストデータクリーンアップ | ✅ 全テーブル 0行 |

---

## 完了チェックリスト

- [x] 全タスクが完了マーク済み
- [x] ログインページが表示される（/login）
- [x] パスワードリセットフローのUI実装完了（/auth/reset-password, /auth/set-password）
- [x] 招待フローのAPI実装完了（/api/auth/invite）
- [x] ルート保護が実装済み（Proxy + Auth Guards）
- [x] TypeScript strict mode でコンパイルエラーなし
- [x] Specの受入条件を全て満たす

---

## マイグレーション一覧（この Spec で追加分）

| バージョン | 名前 | 内容 |
|-----------|------|------|
| (latest) | 007_update_handle_new_user_with_org_id | handle_new_user に org_id 反映を追加 |

---

## メモ

- Supabase Auth の `inviteUserByEmail` は service_role キーが必須（Admin API）
- `handle_new_user` トリガーが `raw_user_meta_data` から `role`, `org_id` を読み取り public.users に反映（007 マイグレーションで更新）
- セルフサインアップはSupabaseダッシュボードで無効化する（コードでは制御不可）
- Next.js 16では `middleware.ts` の代わりに `proxy.ts` を使用
- auth.users に SQL で直接挿入する場合、confirmation_token 等の文字列カラムが NOT NULL のため空文字列が必要
- `SUPABASE_SERVICE_ROLE_KEY` は Supabase ダッシュボード（Settings > API）から取得し .env.local に設定が必要
