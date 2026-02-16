# タスク: DBスキーマ作成とRLSポリシー実装

**Spec**: ./db-schema-rls.md
**作成日**: 2026-02-16
**ステータス**: COMPLETED

---

## コンテキスト

要件定義書セクション5.3の全10テーブルをSupabaseに作成し、セクション2.1の3ロール（Admin/Staff/Client）に基づくRLSポリシーを実装する。Supabase MCP `apply_migration` で適用する。

---

## 前提条件

- [x] Supabase プロジェクト `salon-dashboard` (gjjqevftteoqhxazodyy) が作成済み
- [x] 初期セットアップSpec完了（Supabaseクライアント設定済み）
- [x] Supabase プロジェクトにテーブル・マイグレーションがないこと（確認済み）

---

## タスク一覧

### Task 1: コアテーブル作成（organizations, locations, users, user_org_assignments） ✅

ユーザー管理・組織管理の基盤となる4テーブルを作成する。

**実行内容**:
1. `organizations` テーブル作成
2. `locations` テーブル作成（FK → organizations）
3. `users` テーブル作成（FK → auth.users, FK → organizations）
4. `user_org_assignments` テーブル作成（FK → users, FK → organizations）
5. UNIQUE制約の設定（user_org_assignments: user_id + org_id）
6. 全テーブルでRLSを有効化

**受入条件**:
- 4テーブルがSupabaseに存在する
- 外部キー制約が正しく設定されている
- RLSが全テーブルで有効化されている

**対象**: Supabase MCP apply_migration
**depends_on**: なし

---

### Task 2: GBPデータテーブル作成（daily_metrics, monthly_keywords, rating_snapshots, batch_logs） ✅

GBP API から取得するデータを格納する4テーブルを作成する。

**実行内容**:
1. `daily_metrics` テーブル作成（FK → locations、UNIQUE制約）
2. `monthly_keywords` テーブル作成（FK → locations、UNIQUE制約、year_month CHECK制約）
3. `rating_snapshots` テーブル作成（FK → locations、UNIQUE制約）
4. `batch_logs` テーブル作成（INDEX on executed_at + status）
5. 全テーブルでRLSを有効化

**受入条件**:
- 4テーブルがSupabaseに存在する
- UNIQUE制約が正しく設定されている（daily_metrics, monthly_keywords, rating_snapshots）
- batch_logsにINDEXが作成されている
- year_month のCHECK制約が機能する

**対象**: Supabase MCP apply_migration
**depends_on**: Task 1

---

### Task 3: HPBテーブル作成（hpb_monthly_metrics, hpb_upload_logs） ✅

HPB CSV アップロードデータを格納する2テーブルを作成する。

**実行内容**:
1. `hpb_monthly_metrics` テーブル作成（FK → locations、UNIQUE制約、要件定義書5.3.2の型定義に準拠）
2. `hpb_upload_logs` テーブル作成（FK → locations, FK → users）
3. 全テーブルでRLSを有効化

**受入条件**:
- 2テーブルがSupabaseに存在する
- hpb_monthly_metricsのUNIQUE制約（location_id + year_month）が機能する
- 数値型が要件定義書通り（INTEGER, NUMERIC(6,3), NUMERIC(10,1)）

**対象**: Supabase MCP apply_migration
**depends_on**: Task 1

---

### Task 4: ヘルパー関数・トリガー作成 ✅

RLSポリシーで使用するヘルパー関数と、auth連携・updated_at自動更新のトリガーを作成する。

**実行内容**:
1. `get_user_role()` 関数作成（SECURITY DEFINER, STABLE）
2. `get_accessible_org_ids()` 関数作成（SECURITY DEFINER, STABLE）
3. `handle_new_user()` トリガー関数作成（auth.users → public.users 同期）
4. `on_auth_user_created` トリガー作成
5. `update_updated_at()` トリガー関数作成
6. organizations, locations, users, hpb_monthly_metrics に updated_at トリガー適用

**受入条件**:
- `get_user_role()` がユーザーロールを正しく返す
- `get_accessible_org_ids()` がロールに応じたorg_idリストを返す
- auth.usersにユーザー作成時にpublic.usersにレコードが自動挿入される
- updated_at がレコード更新時に自動で現在時刻に更新される

**対象**: Supabase MCP apply_migration
**depends_on**: Task 1, Task 2, Task 3

---

### Task 5: RLSポリシー実装 ✅

全10テーブルに3ロール対応のRLSポリシーを設定する。

**実行内容**:
1. **organizations** RLS:
   - SELECT: `org_id IN get_accessible_org_ids()` (id = org_id)
   - INSERT/UPDATE/DELETE: admin only
2. **locations** RLS:
   - SELECT: `org_id IN get_accessible_org_ids()`
   - INSERT/UPDATE/DELETE: admin only
3. **users** RLS:
   - SELECT: admin=全件, staff=担当org配下, client=自分のみ
   - INSERT/UPDATE/DELETE: admin only
4. **user_org_assignments** RLS:
   - SELECT: admin=全件, staff=自分の分
   - INSERT/UPDATE/DELETE: admin only
5. **daily_metrics / monthly_keywords / rating_snapshots** RLS:
   - SELECT: location経由でorg_idアクセス制御
   - INSERT/UPDATE/DELETE: admin only（バッチはservice_role）
6. **batch_logs** RLS:
   - SELECT: admin only
   - INSERT/UPDATE: なし（service_role）
7. **hpb_monthly_metrics** RLS:
   - SELECT: location経由でorg_idアクセス制御
   - INSERT/UPDATE: admin + staff（担当org配下）
8. **hpb_upload_logs** RLS:
   - SELECT: admin + staff（担当org配下）
   - INSERT: admin + staff（担当org配下）

**受入条件**:
- 権限マトリクス（Spec セクション2）の全パターンが正しく動作する
- service_roleでのRLSバイパスが動作する

**対象**: Supabase MCP apply_migration
**depends_on**: Task 4

---

### Task 6: 検証（SQLクエリでRLS動作確認） ✅

テストデータを投入し、各ロールでのアクセス制御を検証する。

**実行内容**:
1. テスト用組織・店舗・ユーザーを作成:
   - 組織A, 組織B
   - 各組織に店舗1つ
   - Admin ユーザー1名
   - Staff ユーザー1名（組織Aのみ担当）
   - Client ユーザー1名（組織A所属）
2. 各テーブルにサンプルデータを投入
3. 各ロールでSELECTクエリを実行し、期待通りのフィルタリングを確認
4. Client / Staff での禁止操作（INSERT/UPDATE/DELETE）がエラーになることを確認
5. テストデータをクリーンアップ

**検証結果**:
| テーブル | Admin | Staff | Client | 結果 |
|---------|-------|-------|--------|------|
| organizations | 2 (A,B) | 1 (A) | 1 (A) | ✅ |
| locations | 2 | 1 | 1 | ✅ |
| users | 3 (全員) | 2 (自分+orgA配下) | 1 (自分のみ) | ✅ |
| user_org_assignments | 1 | 1 (自分) | 0 | ✅ |
| daily_metrics | 2 | 1 | 1 | ✅ |
| rating_snapshots | 2 | 1 | 1 | ✅ |
| batch_logs | 1 | 0 | 0 | ✅ |
| hpb_monthly_metrics | 2 | 1 | 1 | ✅ |
| hpb_upload_logs | 1 | 1 | 0 | ✅ |

- Client INSERT/UPDATE/DELETE → 全てRLSでブロック ✅
- Staff INSERT on hpb_monthly_metrics（担当org配下）→ 成功 ✅
- Staff INSERT on hpb_monthly_metrics（担当外org）→ ブロック ✅

**受入条件**:
- Admin: 組織A, B両方のデータが見える
- Staff: 組織Aのデータのみ見える
- Client: 組織Aのデータのみ見える（usersは自分のみ）
- 不正操作がRLSエラーとなる

**対象**: Supabase MCP execute_sql
**depends_on**: Task 5

---

### Task 7: TypeScript型定義の生成 ✅

Supabase CLI で型定義を生成し、プロジェクトに配置する。

**実行内容**:
1. Supabase MCP `generate_typescript_types` で型を生成
2. `src/types/database.ts` に配置
3. TypeScriptコンパイルが通ることを確認

**受入条件**:
- `src/types/database.ts` にテーブル定義の型が存在する
- `npx tsc --noEmit` でエラーなし

**対象ファイル**: src/types/database.ts
**depends_on**: Task 5

---

## 完了チェックリスト

- [x] 全タスクが完了マーク済み
- [x] 全10テーブルがSupabaseに存在
- [x] 全テーブルでRLSが有効
- [x] 権限マトリクスの全パターンが検証済み
- [x] TypeScript型定義が生成済み
- [x] Specの受入条件を全て満たす
- [x] セキュリティアドバイザー警告なし（search_path修正済み）

---

## マイグレーション一覧

| バージョン | 名前 | 内容 |
|-----------|------|------|
| 20260216105611 | 001_core_tables | organizations, locations, users, user_org_assignments |
| 20260216105627 | 002_gbp_tables | daily_metrics, monthly_keywords, rating_snapshots, batch_logs |
| 20260216105633 | 003_hpb_tables | hpb_monthly_metrics, hpb_upload_logs |
| 20260216105650 | 004_functions_triggers | ヘルパー関数・トリガー |
| 20260216105719 | 005_rls_policies | 全10テーブルのRLSポリシー |
| (latest) | 006_fix_function_search_path | 全関数のsearch_path固定（セキュリティ修正） |

---

## メモ

- マイグレーション名は `001_core_tables`, `002_gbp_tables`, `003_hpb_tables`, `004_functions_triggers`, `005_rls_policies` の命名規則で適用
- service_roleでの操作（バッチ処理）はRLSをバイパスするため、RLSポリシーにはバッチ用のINSERT/UPDATEポリシーを定義しない
- Task 6 の検証はSupabase MCP execute_sql で実施（auth.usersへのINSERTはSupabase Auth APIを使用）
- 006_fix_function_search_path: Supabaseセキュリティアドバイザーの指摘に基づき、全SECURITY DEFINER関数にSET search_path = ''を追加
