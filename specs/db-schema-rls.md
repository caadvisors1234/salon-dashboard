# Spec: DBスキーマ作成とRLSポリシー実装

**ステータス**: COMPLETED
**作成日**: 2026-02-16
**最終更新**: 2026-02-16
**要件定義書参照**: セクション 2.1, 2.2, 5.3

---

## 1. 目的

要件定義書セクション5.3で定義された全テーブル（GBP関連 + HPB関連）をSupabaseに作成し、セクション2.1のロール定義に基づくRow Level Security（RLS）ポリシーを実装する。3ロール（Admin / Staff / Client）のデータアクセス制御をDB層で強制する。

---

## 2. 要件

### 機能要件

- [ ] FR1: GBP関連テーブル8つを作成する（organizations, locations, users, user_org_assignments, daily_metrics, monthly_keywords, rating_snapshots, batch_logs）
- [ ] FR2: HPB関連テーブル2つを作成する（hpb_monthly_metrics, hpb_upload_logs）
- [ ] FR3: 要件定義書に定義されたUNIQUE制約・INDEXを全て設定する
- [ ] FR4: 全テーブルにRLSを有効化する
- [ ] FR5: 3ロール（Admin / Staff / Client）に応じたRLSポリシーを実装する
- [ ] FR6: ロール判定用のヘルパー関数を作成する
- [ ] FR7: Supabase Auth `auth.users` と `public.users` の連携トリガーを作成する

### 非機能要件

- [ ] NFR1: RLSポリシーのクエリが100店舗規模で実用的なパフォーマンスを維持する
- [ ] NFR2: マイグレーションはSupabase MCP `apply_migration` で適用する
- [ ] NFR3: 型定義を `supabase generate types` で生成可能な構造にする

### スコープ外

- データの初期投入（シードデータ）
- Storage バケット設定（HPB CSV原本保管）
- バッチ処理用のservice_role設定

### 権限マトリクス

| 操作 | Admin | Staff | Client |
|------|-------|-------|--------|
| organizations SELECT | ✅ 全件 | ✅ 担当のみ | ✅ 自社のみ |
| organizations INSERT/UPDATE/DELETE | ✅ | ❌ | ❌ |
| locations SELECT | ✅ 全件 | ✅ 担当org配下 | ✅ 自社org配下 |
| locations INSERT/UPDATE/DELETE | ✅ | ❌ | ❌ |
| users SELECT | ✅ 全件 | ✅ 担当org配下 | ✅ 自分のみ |
| users INSERT/UPDATE/DELETE | ✅ | ❌ | ❌（自分のプロフィール更新は将来検討） |
| user_org_assignments SELECT | ✅ | ✅ 自分の分 | ❌ |
| user_org_assignments INSERT/UPDATE/DELETE | ✅ | ❌ | ❌ |
| daily_metrics SELECT | ✅ 全件 | ✅ 担当org配下 | ✅ 自社org配下 |
| daily_metrics INSERT/UPDATE/DELETE | ✅（バッチ用） | ❌ | ❌ |
| monthly_keywords SELECT | ✅ 全件 | ✅ 担当org配下 | ✅ 自社org配下 |
| monthly_keywords INSERT/UPDATE/DELETE | ✅（バッチ用） | ❌ | ❌ |
| rating_snapshots SELECT | ✅ 全件 | ✅ 担当org配下 | ✅ 自社org配下 |
| rating_snapshots INSERT/UPDATE/DELETE | ✅（バッチ用） | ❌ | ❌ |
| batch_logs SELECT | ✅ | ❌ | ❌ |
| batch_logs INSERT/UPDATE | ✅（バッチ用） | ❌ | ❌ |
| hpb_monthly_metrics SELECT | ✅ 全件 | ✅ 担当org配下 | ✅ 自社org配下 |
| hpb_monthly_metrics INSERT/UPDATE | ✅ | ✅ 担当org配下 | ❌ |
| hpb_upload_logs SELECT | ✅ 全件 | ✅ 担当org配下 | ❌ |
| hpb_upload_logs INSERT | ✅ | ✅ 担当org配下 | ❌ |

---

## 3. 技術設計

### テーブル定義

#### organizations（クライアント組織）

| カラム | 型 | 制約 | 備考 |
|--------|-----|------|------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| name | TEXT | NOT NULL | 組織名 |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

#### locations（店舗）

| カラム | 型 | 制約 | 備考 |
|--------|-----|------|------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| org_id | UUID | NOT NULL, FK → organizations(id) ON DELETE CASCADE | |
| gbp_location_id | TEXT | | GBP API用ロケーションID |
| place_id | TEXT | | Google Place ID |
| name | TEXT | NOT NULL | 店舗名 |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | 有効フラグ |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

#### users（ユーザー）

| カラム | 型 | 制約 | 備考 |
|--------|-----|------|------|
| id | UUID | PK, FK → auth.users(id) ON DELETE CASCADE | Supabase Auth連携 |
| email | TEXT | NOT NULL | auth.usersから同期 |
| role | TEXT | NOT NULL, CHECK (role IN ('admin', 'staff', 'client')) | |
| org_id | UUID | FK → organizations(id) ON DELETE SET NULL | Client用。Admin/StaffはNULL |
| display_name | TEXT | | 表示名 |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

> **設計判断**: `email` は `auth.users` にも存在するが、RLSポリシーやアプリ内クエリの簡便さのため `public.users` にも保持する。`auth.users` 作成時にトリガーで同期する。

> **設計判断**: `org_id` は Client ユーザー専用。Staff は `user_org_assignments` で複数組織に紐付く。Admin は全組織アクセスのため不要。

#### user_org_assignments（担当者-組織紐付）

| カラム | 型 | 制約 | 備考 |
|--------|-----|------|------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| user_id | UUID | NOT NULL, FK → users(id) ON DELETE CASCADE | |
| org_id | UUID | NOT NULL, FK → organizations(id) ON DELETE CASCADE | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

- UNIQUE (user_id, org_id)

#### daily_metrics（日次パフォーマンス）

| カラム | 型 | 制約 | 備考 |
|--------|-----|------|------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| location_id | UUID | NOT NULL, FK → locations(id) ON DELETE CASCADE | |
| date | DATE | NOT NULL | |
| metric_type | TEXT | NOT NULL | DailyMetric enum値 |
| value | INTEGER | NOT NULL | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

- UNIQUE (location_id, date, metric_type)

#### monthly_keywords（月次検索キーワード）

| カラム | 型 | 制約 | 備考 |
|--------|-----|------|------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| location_id | UUID | NOT NULL, FK → locations(id) ON DELETE CASCADE | |
| year_month | TEXT | NOT NULL, CHECK (year_month ~ '^\d{6}$') | YYYYMM形式 |
| keyword | TEXT | NOT NULL | |
| insights_value | INTEGER | | 実数値（threshold時はNULL） |
| insights_threshold | INTEGER | | 閾値（value時はNULL） |
| insights_value_type | TEXT | NOT NULL, CHECK (insights_value_type IN ('VALUE', 'THRESHOLD')) | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

- UNIQUE (location_id, year_month, keyword)

> **設計判断**: `insights_value` と `insights_threshold` を分離カラムにし、`insights_value_type` で判別する。要件定義書の「`value` が返る場合は実数、`threshold` が返る場合は `<threshold` で表示」に対応。

#### rating_snapshots（評価・レビュー数日次スナップショット）

| カラム | 型 | 制約 | 備考 |
|--------|-----|------|------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| location_id | UUID | NOT NULL, FK → locations(id) ON DELETE CASCADE | |
| date | DATE | NOT NULL | |
| rating | NUMERIC(2,1) | | 5段階平均評価（例: 4.3） |
| review_count | INTEGER | | レビュー総件数 |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

- UNIQUE (location_id, date)

#### batch_logs（バッチ実行ログ）

| カラム | 型 | 制約 | 備考 |
|--------|-----|------|------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| job_type | TEXT | NOT NULL | 'daily_metrics', 'monthly_keywords', 'rating_snapshots' |
| status | TEXT | NOT NULL, CHECK (status IN ('running', 'success', 'failure')) | |
| executed_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| completed_at | TIMESTAMPTZ | | |
| error_message | TEXT | | |
| metadata | JSONB | | 対象店舗数等の補足情報 |

- INDEX (executed_at, status)

#### hpb_monthly_metrics（HPB月次指標）

| カラム | 型 | 制約 | 備考 |
|--------|-----|------|------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| location_id | UUID | NOT NULL, FK → locations(id) ON DELETE CASCADE | |
| year_month | TEXT | NOT NULL, CHECK (year_month ~ '^\d{6}$') | YYYYMM形式 |
| salon_pv | INTEGER | | |
| salon_pv_area_avg | INTEGER | | |
| cvr | NUMERIC(6,3) | | 百分率 |
| cvr_area_avg | NUMERIC(6,3) | | |
| acr | NUMERIC(6,3) | | 百分率 |
| acr_area_avg | NUMERIC(6,3) | | |
| total_pv | INTEGER | | |
| total_pv_area_avg | INTEGER | | |
| blog_pv | INTEGER | | |
| blog_pv_area_avg | INTEGER | | |
| coupon_menu_pv | INTEGER | | |
| coupon_menu_pv_area_avg | INTEGER | | |
| style_pv | INTEGER | | |
| style_pv_area_avg | INTEGER | | |
| booking_count | NUMERIC(10,1) | | 小数を許容 |
| booking_count_area_avg | NUMERIC(10,1) | | |
| booking_revenue | INTEGER | | |
| booking_revenue_area_avg | INTEGER | | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

- UNIQUE (location_id, year_month)

#### hpb_upload_logs（HPB CSV取込ログ）

| カラム | 型 | 制約 | 備考 |
|--------|-----|------|------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| location_id | UUID | NOT NULL, FK → locations(id) ON DELETE CASCADE | |
| uploaded_by | UUID | NOT NULL, FK → users(id) | アップロード実行者 |
| uploaded_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| file_name | TEXT | NOT NULL | 元ファイル名 |
| file_path | TEXT | | Storage内パス |
| record_count | INTEGER | | 取り込み件数 |
| status | TEXT | NOT NULL, CHECK (status IN ('success', 'partial', 'failure')) | |
| error_message | TEXT | | |

### RLSポリシー設計

#### ヘルパー関数

```sql
-- ユーザーのロールを取得
CREATE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ユーザーがアクセス可能なorg_idリストを取得
CREATE FUNCTION public.get_accessible_org_ids()
RETURNS SETOF UUID AS $$
  SELECT CASE
    WHEN (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
    THEN (SELECT id FROM public.organizations)
    WHEN (SELECT role FROM public.users WHERE id = auth.uid()) = 'staff'
    THEN (SELECT org_id FROM public.user_org_assignments WHERE user_id = auth.uid())
    WHEN (SELECT role FROM public.users WHERE id = auth.uid()) = 'client'
    THEN (SELECT org_id FROM public.users WHERE id = auth.uid())
  END
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

#### ポリシー概要

**パターンA: org_idベースのアクセス制御**（organizations, locations, metrics系）

```
SELECT: org_id IN (SELECT get_accessible_org_ids())
INSERT/UPDATE/DELETE: get_user_role() = 'admin'
```

**パターンB: location_id経由のアクセス制御**（daily_metrics, monthly_keywords, rating_snapshots, hpb_monthly_metrics）

```
SELECT: location_id IN (SELECT id FROM locations WHERE org_id IN (SELECT get_accessible_org_ids()))
INSERT/UPDATE/DELETE: get_user_role() = 'admin'（バッチはservice_roleでRLSバイパス）
```

**パターンC: Admin専用**（batch_logs）

```
SELECT: get_user_role() = 'admin'
INSERT/UPDATE: service_roleのみ（RLSバイパス）
```

**パターンD: HPBアップロード系**（hpb_upload_logs）

```
SELECT: get_user_role() IN ('admin', 'staff') AND location関連org_idがアクセス可能
INSERT: get_user_role() IN ('admin', 'staff') AND location関連org_idがアクセス可能
```

### auth.users 連携トリガー

```sql
-- auth.usersにユーザーが作成されたらpublic.usersにも作成
CREATE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'client')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### updated_at 自動更新トリガー

`organizations`, `locations`, `users`, `hpb_monthly_metrics` に適用。

```sql
CREATE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 設計判断

| 判断事項 | 選択 | 理由 |
|---------|------|------|
| ロール格納場所 | public.users.role | JWTカスタムクレームよりシンプル。RLSではヘルパー関数経由で参照 |
| org_id on users | Client専用（Admin/StaffはNULL） | Staff は user_org_assignments で複数org対応。Adminは全件アクセス |
| email の重複保持 | public.users にも保持 | RLSポリシーやJOINクエリの簡便さのため |
| metrics系の書き込み | service_role（RLSバイパス） | バッチ処理はサーバー側でservice_roleを使用 |
| ヘルパー関数 | SECURITY DEFINER + STABLE | RLS内で安全かつ効率的に呼び出すため |
| year_month 型 | TEXT（YYYYMM） | 要件定義書の仕様に準拠。チェック制約で形式担保 |

---

## 4. 受入条件

- [ ] AC1: 全10テーブルがSupabaseに作成されている
- [ ] AC2: 全テーブルでRLSが有効化されている
- [ ] AC3: Admin ロールのユーザーが全テーブルの全データを参照できる
- [ ] AC4: Staff ロールのユーザーが担当org配下のデータのみ参照できる
- [ ] AC5: Client ロールのユーザーが自社org配下のデータのみ参照できる
- [ ] AC6: Client ユーザーがデータ変更操作（INSERT/UPDATE/DELETE）を実行できない
- [ ] AC7: UNIQUE制約・INDEXが要件定義書通りに設定されている
- [ ] AC8: auth.usersへのユーザー作成時にpublic.usersにレコードが自動作成される
- [ ] AC9: TypeScript型定義が `supabase generate types` で生成できる

---

## 5. 未解決の質問

（全て解決済み）

- Q1: サブクエリ方式で進める（初期100店舗規模では問題なし） → 確定
- Q2: Staff の HPB INSERT/UPDATE は担当org配下のみ → 確定
- Q3: batch_logs は Admin 専用 → 確定

---

## 6. 参照

- 要件定義書: `docs/GBP_Dashboard_Requirements_v1_7.md` セクション 2.1, 2.2, 5.3
- Supabase RLS ドキュメント
- 前提Spec: `specs/initial-setup.md` (COMPLETED)
