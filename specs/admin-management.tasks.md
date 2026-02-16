# タスク: 管理画面（ユーザー管理・クライアント管理）

**Spec**: ./admin-management.md
**作成日**: 2026-02-16
**ステータス**: COMPLETED

---

## コンテキスト

Admin向け管理画面（ユーザー管理・クライアント管理）を構築する。サイドバーナビゲーションの導入、shadcn/uiコンポーネントの追加、Server Actionsによるデータ操作、CRUD UIの実装を行う。

---

## 前提条件

- [x] DBスキーマ・RLSポリシー実装済み（specs/db-schema-rls.md COMPLETED）
- [x] 認証・認可実装済み（specs/auth.md COMPLETED）
- [x] 招待API実装済み（src/app/api/auth/invite/route.ts）
- [x] 認証ガード実装済み（src/lib/auth/guards.ts - requireAuth, requireRole）
- [x] Supabase Admin Client実装済み（src/lib/supabase/admin.ts）

---

## タスク一覧

### ~~Task 1: shadcn/ui コンポーネントの追加インストール~~ ✅

管理画面で使用するshadcn/uiコンポーネントをプロジェクトに追加する。

- 対象コンポーネント: `dialog`, `table`, `select`, `badge`, `alert-dialog`, `separator`, `sonner`, `switch`, `checkbox`, `breadcrumb`, `dropdown-menu`, `sheet`
- `sonner` の `<Toaster />` をルートレイアウト（`src/app/layout.tsx`）に追加
- 受入条件: 全コンポーネントが `src/components/ui/` に追加され、importエラーなし
- depends_on: なし

---

### ~~Task 2: サイドバーナビゲーションの実装とダッシュボードレイアウト改修~~ ✅

`(dashboard)/layout.tsx` を改修し、左側固定サイドバーを導入する。

- `src/components/layout/sidebar.tsx` を新規作成
  - アプリタイトル（上部）
  - メニュー項目: ダッシュボード（全ロール）、ユーザー管理（Admin）、クライアント管理（Admin）
  - lucide-react アイコン付き（LayoutDashboard, Users, Building2）
  - 現在パスに応じたアクティブ状態（`usePathname()`）
  - サイドバー下部: ユーザー情報（メール、ロールバッジ）+ ログアウトボタン
- `(dashboard)/layout.tsx` を改修
  - ヘッダーのみの現行構造 → サイドバー + コンテンツエリアの2カラム構造に変更
  - サイドバーにユーザー情報を渡す
- 受入条件: サイドバーが表示され、メニュー遷移が動作する。Admin以外には管理メニューが非表示
- depends_on: Task 1

---

### ~~Task 3: Admin管理画面のServer Actionsを実装~~ ✅

`src/lib/admin/actions.ts` に全管理操作のServer Actionsを実装する。

**ユーザー管理Actions:**
- `getUsers()`: 全ユーザー一覧を取得（users + organizations LEFT JOIN + user_org_assignments）
  - 返却: ユーザー情報 + 所属org名（Client）/ 担当org一覧（Staff）
- `updateUser(userId, data)`: ユーザー情報更新
  - display_name, role の更新
  - ロール変更時: org_id 更新（Client化）/ user_org_assignments 更新（Staff化）/ 両方クリア（Admin化）
  - service_role client を使用（auth.users の metadata 更新が必要な場合）
- `deleteUser(userId)`: ユーザー物理削除
  - 自分自身の削除を拒否
  - `supabase.auth.admin.deleteUser()` で auth.users を削除（CASCADE で public.users も削除）
- `inviteUser(email, role, orgId?, orgIds?)`: ユーザー招待
  - 既存の `/api/auth/invite` ロジックを Server Action に移行（または内部で呼び出し）
  - Staff の場合: 招待後に user_org_assignments への追加
- `getOrganizationsForSelect()`: 組織選択用の簡易リスト取得

**クライアント管理Actions:**
- `getOrganizations()`: 全組織一覧を取得（organizations + locations COUNT）
- `createOrganization(name)`: 組織作成
- `updateOrganization(orgId, name)`: 組織名更新
- `deleteOrganization(orgId)`: 組織削除（CASCADE）
  - 削除前に紐づくlocations数を確認して返却

**店舗管理Actions:**
- `getLocations(orgId)`: 特定org配下の店舗一覧
- `getOrganizationDetail(orgId)`: 組織詳細（名前含む）
- `createLocation(orgId, data)`: 店舗作成（name, gbp_location_id?, place_id?）
- `updateLocation(locationId, data)`: 店舗更新（name, gbp_location_id, place_id, is_active）
- `deleteLocation(locationId)`: 店舗削除（CASCADE）

**共通:**
- 全Actionで `requireRole(['admin'])` による権限チェック
- エラーハンドリング: `{ success: boolean; error?: string; data?: T }` 形式の返却
- `revalidatePath` による画面更新

- 受入条件: 全Actionが正しく動作し、権限チェックが機能する
- depends_on: Task 1

---

### ~~Task 4: Admin専用レイアウトの作成~~ ✅

`src/app/(dashboard)/dashboard/admin/layout.tsx` を作成。

- `requireRole(['admin'])` でAdmin以外をリダイレクト
- レイアウト内容: 単純に children を返す（サイドバーは親layoutで処理済み）
- 受入条件: Admin以外が /dashboard/admin/* にアクセスすると /dashboard にリダイレクトされる
- depends_on: Task 2

---

### ~~Task 5: ユーザー管理画面の実装~~ ✅

ユーザーの一覧表示・招待・編集・削除のCRUD UIを構築する。

**ページ:** `src/app/(dashboard)/dashboard/admin/users/page.tsx`
- Server Component: `getUsers()` でデータ取得 → Client Component に渡す

**コンポーネント:**

`src/components/admin/user-table.tsx`（Client Component）
- shadcn/ui Table でユーザー一覧表示
- カラム: メール、表示名、ロール（Badge）、所属組織、作成日、操作ボタン
- 操作ボタン: 編集（Pencil）/ 削除（Trash2）アイコン
- 自分自身の行は削除ボタン無効化

`src/components/admin/user-invite-dialog.tsx`（Client Component）
- Dialog + フォーム
- メール入力、ロール Select（admin/staff/client）
- Client選択時: 組織 Select（必須）
- Staff選択時: 組織チェックボックスリスト（任意）
- Admin選択時: 組織入力なし
- 送信時: `inviteUser()` Action呼び出し → toast通知

`src/components/admin/user-edit-dialog.tsx`（Client Component）
- Dialog + フォーム
- 表示名 Input、ロール Select
- ロール変更に応じた動的フォーム（Client: 組織Select / Staff: 組織チェックボックス / Admin: なし）
- 保存時: `updateUser()` Action呼び出し → toast通知

`src/components/admin/user-delete-dialog.tsx`（Client Component）
- AlertDialog
- 「{ユーザー名}を削除しますか？」+ 警告メッセージ
- 削除時: `deleteUser()` Action呼び出し → toast通知

- 受入条件: AC3〜AC7, AC16, AC17
- depends_on: Task 3, Task 4

---

### ~~Task 6: クライアント管理画面の実装~~ ✅

クライアント組織の一覧表示・作成・編集・削除のCRUD UIを構築する。

**ページ:** `src/app/(dashboard)/dashboard/admin/clients/page.tsx`
- Server Component: `getOrganizations()` でデータ取得

**コンポーネント:**

`src/components/admin/org-table.tsx`（Client Component）
- shadcn/ui Table で組織一覧表示
- カラム: 組織名、店舗数、作成日、操作ボタン
- 操作ボタン: 詳細（Eye）/ 編集（Pencil）/ 削除（Trash2）
- 詳細ボタン → `/dashboard/admin/clients/[orgId]` へ遷移

`src/components/admin/org-create-dialog.tsx`（Client Component）
- Dialog + 組織名 Input
- 作成時: `createOrganization()` Action呼び出し → toast通知

`src/components/admin/org-edit-dialog.tsx`（Client Component）
- Dialog + 組織名 Input（現在値プリセット）
- 保存時: `updateOrganization()` Action呼び出し → toast通知

`src/components/admin/org-delete-dialog.tsx`（Client Component）
- AlertDialog + 紐づくデータ件数表示
- 削除時: `deleteOrganization()` Action呼び出し → toast通知

- 受入条件: AC8〜AC11, AC16, AC17
- depends_on: Task 3, Task 4

---

### ~~Task 7: クライアント詳細（店舗管理）画面の実装~~ ✅

組織配下の店舗一覧表示・作成・編集・削除のCRUD UIを構築する。

**ページ:** `src/app/(dashboard)/dashboard/admin/clients/[orgId]/page.tsx`
- Server Component: `getOrganizationDetail(orgId)` + `getLocations(orgId)` でデータ取得
- パンくずリスト: クライアント管理 > {組織名}

**コンポーネント:**

`src/components/admin/location-table.tsx`（Client Component）
- shadcn/ui Table で店舗一覧表示
- カラム: 店舗名、GBP Location ID、Place ID、ステータス（Badge: 有効/無効）、作成日、操作ボタン

`src/components/admin/location-create-dialog.tsx`（Client Component）
- Dialog + フォーム（店舗名[必須]、GBP Location ID[任意]、Place ID[任意]）
- 作成時: `createLocation()` Action呼び出し → toast通知

`src/components/admin/location-edit-dialog.tsx`（Client Component）
- Dialog + フォーム（店舗名、GBP Location ID、Place ID、有効/無効 Switch）
- 保存時: `updateLocation()` Action呼び出し → toast通知

`src/components/admin/location-delete-dialog.tsx`（Client Component）
- AlertDialog + 警告メッセージ
- 削除時: `deleteLocation()` Action呼び出し → toast通知

- 受入条件: AC12〜AC15, AC16, AC17
- depends_on: Task 3, Task 4

---

## 完了チェックリスト

- [ ] 全タスクが完了マーク済み
- [ ] TypeScript型エラーなし（`npx tsc --noEmit`）
- [ ] Specの受入条件 AC1〜AC17 を全て満たす
- [ ] 要件定義書の仕様と一致
- [ ] サイドバーナビゲーションが正常に動作する
- [ ] Admin以外がAdmin画面にアクセスできない
- [ ] toast通知が全操作で表示される

---

## メモ

- 既存の招待API（`/api/auth/invite/route.ts`）は org_id を staff にも必須としている。Spec の決定（Staff は任意）に合わせて、招待ロジックを Server Action に移行する際にバリデーションを調整する必要がある。
- `revalidatePath` の呼び出しにより、Server Action 完了後に一覧画面が自動更新される。
- lucide-react は既にpackage.jsonに含まれている（依存パッケージインストール不要）。
