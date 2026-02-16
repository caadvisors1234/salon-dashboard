# Spec: 管理画面（ユーザー管理・クライアント管理）

**ステータス**: COMPLETED
**作成日**: 2026-02-16
**最終更新**: 2026-02-16
**要件定義書参照**: セクション 2.1, 4.1（画面No.6, No.7）, 5.3

---

## 1. 目的

管理者（Admin）が、ユーザーの招待・編集・削除とクライアント組織・店舗の登録・編集・削除を行うための管理画面を構築する。

要件定義書セクション4.1より:
- **画面No.6 ユーザー管理**: Adminのみ。ユーザー招待・編集・削除
- **画面No.7 クライアント管理**: Adminのみ。クライアント・店舗登録/編集

認証Spec（`specs/auth.md`）で実装済みの招待API（`/api/auth/invite`）を活用し、管理画面のCRUD UIを構築する。

---

## 2. 要件

### 機能要件

**ユーザー管理（画面No.6）**

- [ ] FR1: Adminがユーザー一覧を閲覧できる（メール、ロール、所属組織、作成日）
- [ ] FR2: Adminが新規ユーザーを招待できる（メール、ロール、所属組織の指定）
- [ ] FR3: Adminがユーザーの情報を編集できる（表示名、ロール変更、所属組織変更）
- [ ] FR4: Adminがユーザーを削除できる（確認ダイアログ付き）
- [ ] FR5: ロール変更時にStaff↔Client間の所属組織データを適切に更新する
- [ ] FR6: Staff のロール時は複数組織への割当（user_org_assignments）を管理できる

**クライアント管理（画面No.7）**

- [ ] FR7: Adminがクライアント組織一覧を閲覧できる（組織名、店舗数、作成日）
- [ ] FR8: Adminが新規クライアント組織を登録できる
- [ ] FR9: Adminがクライアント組織を編集できる（組織名）
- [ ] FR10: Adminがクライアント組織を削除できる（確認ダイアログ付き、紐づくデータの警告表示）
- [ ] FR11: Adminが組織配下の店舗一覧を閲覧できる
- [ ] FR12: Adminが新規店舗を登録できる（店舗名、GBP Location ID、Place ID）
- [ ] FR13: Adminが店舗情報を編集できる（店舗名、GBP Location ID、Place ID、有効/無効）
- [ ] FR14: Adminが店舗を削除できる（確認ダイアログ付き、紐づくデータの警告表示）

### 非機能要件

- [ ] NFR1: 管理画面へのアクセスはAdminロールのみに制限する（既存のroute保護を活用）
- [ ] NFR2: 全操作でRLSポリシーが正常に機能する
- [ ] NFR3: 初期100ユーザー・100店舗規模で快適に動作する

### スコープ外

- システム設定画面（画面No.8: API接続設定、バッチ設定 → 別Spec）
- ユーザーのセルフプロフィール編集（将来検討）
- 組織の論理削除（現時点では物理削除のみ）
- ページネーション（初期規模では不要。将来的に追加）

### 権限マトリクス

| 操作 | Admin | Staff | Client |
|------|-------|-------|--------|
| ユーザー一覧閲覧 | ✅ | ❌ | ❌ |
| ユーザー招待 | ✅ | ❌ | ❌ |
| ユーザー編集 | ✅ | ❌ | ❌ |
| ユーザー削除 | ✅ | ❌ | ❌ |
| クライアント組織一覧閲覧 | ✅ | ❌ | ❌ |
| クライアント組織作成/編集/削除 | ✅ | ❌ | ❌ |
| 店舗一覧閲覧 | ✅ | ❌ | ❌ |
| 店舗作成/編集/削除 | ✅ | ❌ | ❌ |

---

## 3. 技術設計

### ファイル構成

```
src/app/(dashboard)/dashboard/admin/
├── layout.tsx                          # Admin専用レイアウト（requireRole(['admin'])）
├── users/
│   └── page.tsx                        # ユーザー管理ページ
└── clients/
    ├── page.tsx                        # クライアント管理ページ
    └── [orgId]/
        └── page.tsx                    # クライアント詳細（店舗管理）ページ

src/components/admin/
├── user-table.tsx                      # ユーザー一覧テーブル
├── user-invite-dialog.tsx              # ユーザー招待ダイアログ
├── user-edit-dialog.tsx                # ユーザー編集ダイアログ
├── user-delete-dialog.tsx              # ユーザー削除確認ダイアログ
├── org-table.tsx                       # 組織一覧テーブル
├── org-create-dialog.tsx               # 組織作成ダイアログ
├── org-edit-dialog.tsx                 # 組織編集ダイアログ
├── org-delete-dialog.tsx               # 組織削除確認ダイアログ
├── location-table.tsx                  # 店舗一覧テーブル
├── location-create-dialog.tsx          # 店舗作成ダイアログ
├── location-edit-dialog.tsx            # 店舗編集ダイアログ
└── location-delete-dialog.tsx          # 店舗削除確認ダイアログ

src/components/layout/
├── sidebar.tsx                         # サイドバーナビゲーション
└── sidebar-nav-item.tsx                # ナビゲーション項目

src/lib/admin/
└── actions.ts                          # Server Actions（全管理操作）
```

### データベース

既存テーブルを使用（新規テーブル作成なし）:

| テーブル | 用途 | 備考 |
|---------|------|------|
| organizations | クライアント組織CRUD | 既存 |
| locations | 店舗CRUD | 既存 |
| users | ユーザー一覧/編集 | 既存 |
| user_org_assignments | Staff-組織紐付 | 既存 |

### RLSポリシー

既存のRLSポリシーで対応可能:
- organizations: Admin は全件SELECT/INSERT/UPDATE/DELETE可
- locations: Admin は全件SELECT/INSERT/UPDATE/DELETE可
- users: Admin は全件SELECT/INSERT/UPDATE/DELETE可
- user_org_assignments: Admin は全件SELECT/INSERT/UPDATE/DELETE可

### APIエンドポイント

**Server Actions方式を採用（API Routeではなく）**

| Action | 入力 | 処理 | 備考 |
|--------|------|------|------|
| `getUsers` | なし | users + organizations JOIN | 一覧取得 |
| `updateUser` | userId, data | users UPDATE + org_assignments更新 | ロール変更時にorg_assignments連動 |
| `deleteUser` | userId | auth.admin.deleteUser + users削除 | auth.usersも削除が必要 |
| `getOrganizations` | なし | organizations + locations COUNT | 一覧取得（店舗数付き） |
| `createOrganization` | name | organizations INSERT | |
| `updateOrganization` | orgId, data | organizations UPDATE | |
| `deleteOrganization` | orgId | organizations DELETE | CASCADE で関連データも削除 |
| `getLocations` | orgId | locations WHERE org_id | 特定org配下の店舗一覧 |
| `createLocation` | orgId, data | locations INSERT | |
| `updateLocation` | locationId, data | locations UPDATE | |
| `deleteLocation` | locationId | locations DELETE | CASCADE で関連データも削除 |

### 主要コンポーネント

**追加が必要な shadcn/ui コンポーネント:**
- `dialog` - モーダルダイアログ（作成/編集/削除確認用）
- `table` - データテーブル
- `select` - ロール選択、組織選択ドロップダウン
- `badge` - ロール表示バッジ
- `alert-dialog` - 削除確認ダイアログ
- `tabs` - 管理画面のナビゲーション（ユーザー/クライアント切替）
- `separator` - セクション区切り
- `sonner` - 操作結果のtoast通知
- `switch` - 店舗の有効/無効切替
- `checkbox` - Staff組織割当のチェックボックス
- `breadcrumb` - クライアント詳細画面のパンくずリスト

### サイドバーナビゲーション

既存の `(dashboard)/layout.tsx` を改修し、**左側固定サイドバー**を導入する。

**サイドバー構成:**

| セクション | メニュー項目 | パス | 表示条件 |
|-----------|-------------|------|---------|
| メイン | ダッシュボード | /dashboard | 全ロール |
| 管理 | ユーザー管理 | /dashboard/admin/users | Admin のみ |
| 管理 | クライアント管理 | /dashboard/admin/clients | Admin のみ |

- アイコン付きメニュー項目（lucide-react）
- 現在のパスに応じたアクティブ状態表示
- モバイル時はハンバーガーメニューで開閉（将来対応。初期は非表示でOK）
- サイドバー下部にユーザー情報（メール、ロールバッジ）とログアウトボタン

### 設計判断

| 判断事項 | 選択 | 理由 |
|---------|------|------|
| API Route vs Server Actions | Server Actions主体 | フォーム操作が中心。リアルタイム更新不要 |
| ユーザー削除方式 | 物理削除（auth.users + public.users） | 初期規模では論理削除の複雑さ不要。CASCADE で連鎖削除 |
| 組織・店舗削除方式 | 物理削除（CASCADE） | DB設計でON DELETE CASCADE設定済み |
| ダイアログ vs ページ遷移 | ダイアログ方式 | 操作の文脈を維持。一覧画面から離れない |
| ページネーション | 初期は不要 | 100件規模なら全件取得で十分 |
| Staff org割当UI | チェックボックスリスト | 複数組織を直感的に選択可能 |
| Staff招待時の組織割当 | 任意 | 招待時は未割当でも可。編集画面で後から追加 |
| ナビゲーション | サイドバー（左側固定） | 管理メニューの追加に対応。将来のメニュー拡張にも対応しやすい |
| 通知方式 | toast（Sonner） | shadcn/ui推奨。操作フィードバックに適切 |

---

## 4. 画面設計

### 4.1 Admin レイアウト（/dashboard/admin/）

- 左サイドバーまたはタブでサブメニュー切替
  - 「ユーザー管理」→ /dashboard/admin/users
  - 「クライアント管理」→ /dashboard/admin/clients
- Adminロール以外は /dashboard にリダイレクト

### 4.2 ユーザー管理画面（/dashboard/admin/users）

**一覧表示:**

| カラム | 内容 |
|--------|------|
| メールアドレス | users.email |
| 表示名 | users.display_name |
| ロール | Admin / Staff / Client（バッジ表示） |
| 所属組織 | Client: org名 / Staff: 担当org数 / Admin: "-" |
| 作成日 | users.created_at |
| 操作 | 編集 / 削除ボタン |

**ヘッダーエリア:**
- 画面タイトル「ユーザー管理」
- 「ユーザーを招待」ボタン（右上）

**招待ダイアログ:**
- メールアドレス入力
- ロール選択（admin / staff / client）
- Client選択時: 所属組織選択（必須）
- Staff選択時: 担当組織選択（チェックボックス、任意）
- 「招待を送信」ボタン
- 成功/エラーメッセージ表示

**編集ダイアログ:**
- 表示名の編集
- ロール変更（admin / staff / client）
- ロール変更時: 組織割当の更新UI表示
  - Client → 所属組織選択
  - Staff → 担当組織チェックボックス
  - Admin → 組織割当不要（表示しない）
- 「保存」ボタン

**削除確認ダイアログ:**
- 「{ユーザー名}を削除しますか？」
- 「この操作は取り消せません。ユーザーはログインできなくなります。」
- 自分自身は削除不可（ボタン無効化）
- 「削除」「キャンセル」ボタン

### 4.3 クライアント管理画面（/dashboard/admin/clients）

**一覧表示:**

| カラム | 内容 |
|--------|------|
| 組織名 | organizations.name |
| 店舗数 | locations COUNT |
| 作成日 | organizations.created_at |
| 操作 | 詳細 / 編集 / 削除ボタン |

**ヘッダーエリア:**
- 画面タイトル「クライアント管理」
- 「クライアントを追加」ボタン（右上）

**作成ダイアログ:**
- 組織名入力
- 「作成」ボタン

**編集ダイアログ:**
- 組織名の編集
- 「保存」ボタン

**削除確認ダイアログ:**
- 「{組織名}を削除しますか？」
- 「この組織に紐づく店舗（X件）、パフォーマンスデータ、HPBデータも全て削除されます。」
- 紐づくデータ件数を表示
- 「削除」「キャンセル」ボタン

### 4.4 クライアント詳細画面（/dashboard/admin/clients/[orgId]）

**ヘッダー:**
- パンくずリスト: クライアント管理 > {組織名}
- 組織名表示
- 「店舗を追加」ボタン

**店舗一覧テーブル:**

| カラム | 内容 |
|--------|------|
| 店舗名 | locations.name |
| GBP Location ID | locations.gbp_location_id |
| Place ID | locations.place_id |
| ステータス | 有効 / 無効（locations.is_active） |
| 作成日 | locations.created_at |
| 操作 | 編集 / 削除ボタン |

**店舗作成ダイアログ:**
- 店舗名入力（必須）
- GBP Location ID入力（任意 - API連携時に設定）
- Place ID入力（任意 - 将来用）
- 「作成」ボタン

**店舗編集ダイアログ:**
- 店舗名の編集
- GBP Location ID の編集
- Place ID の編集
- 有効/無効の切替（Switch）
- 「保存」ボタン

**店舗削除確認ダイアログ:**
- 「{店舗名}を削除しますか？」
- 「この店舗のパフォーマンスデータ、HPBデータも全て削除されます。」
- 「削除」「キャンセル」ボタン

---

## 5. 受入条件

- [ ] AC1: Adminロールのみが /dashboard/admin/* にアクセスできる
- [ ] AC2: Staff/Clientロールが /dashboard/admin/* にアクセスすると /dashboard にリダイレクトされる
- [ ] AC3: ユーザー一覧に全ユーザーが表示される（メール、ロール、所属組織、作成日）
- [ ] AC4: 新規ユーザーを招待でき、招待メールが送信される
- [ ] AC5: ユーザーの表示名・ロール・組織割当を編集できる
- [ ] AC6: ユーザーを削除でき、auth.usersからも削除される
- [ ] AC7: 自分自身を削除しようとすると阻止される
- [ ] AC8: クライアント組織一覧に全組織が店舗数付きで表示される
- [ ] AC9: 新規クライアント組織を作成できる
- [ ] AC10: クライアント組織名を編集できる
- [ ] AC11: クライアント組織を削除でき、関連データがCASCADE削除される
- [ ] AC12: 組織配下の店舗一覧が表示される
- [ ] AC13: 新規店舗を作成できる（店舗名、GBP Location ID、Place ID）
- [ ] AC14: 店舗情報を編集できる（有効/無効の切替を含む）
- [ ] AC15: 店舗を削除でき、関連データがCASCADE削除される
- [ ] AC16: 全操作で成功/エラーのフィードバックが表示される
- [ ] AC17: 削除操作で確認ダイアログが表示される

---

## 6. 解決済みの質問

1. **Q1: ナビゲーション構造** → **サイドバー（左側固定）を導入**。ダッシュボード全体にサイドバーナビゲーションを追加し、Admin向けメニュー（ユーザー管理、クライアント管理）を配置する。
2. **Q2: ユーザー削除方式** → **物理削除**。auth.users + public.users を完全削除。初期規模ではシンプルさを優先。CASCADE により関連データも削除される。
3. **Q3: Staff招待時の組織割当** → **任意**。招待時は組織割当なしでも可。後から編集画面で追加できる。
4. **Q4: 操作結果の通知** → **toast通知（Sonner）**。shadcn/ui推奨のSonnerを採用。操作成功/エラーをtoastで表示。

---

## 7. 参照

- 要件定義書: `docs/GBP_Dashboard_Requirements_v1_7.md` セクション 2.1, 4.1, 5.3
- 認証Spec: `specs/auth.md` (COMPLETED) - 招待API実装済み
- DBスキーマSpec: `specs/db-schema-rls.md` (COMPLETED) - テーブル・RLS実装済み
- 既存招待API: `src/app/api/auth/invite/route.ts`
- 既存認証ガード: `src/lib/auth/guards.ts`
