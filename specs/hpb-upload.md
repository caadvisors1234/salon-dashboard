# Spec: HPBデータアップロード（CSV手動アップロード・バリデーション・パース・格納）

**ステータス**: COMPLETED
**作成日**: 2026-02-16
**最終更新**: 2026-02-16
**要件定義書参照**: セクション 3.1.2, 3.3.2, 4.1(No.9), 5.1, 5.3.2, 7

---

## 1. 目的

Admin / Staff が HPB（Hot Pepper Beauty）のサロンボードからエクスポートした「レポート - 基本情報」CSVをダッシュボードからアップロードし、サーバー側でShift_JISデコード・バリデーション・パースを行い、`hpb_monthly_metrics` テーブルへ格納する。CSV原本は Supabase Storage に保管し、取込結果を `hpb_upload_logs` に記録する。

---

## 2. 要件

### 機能要件

- [ ] FR1: Admin / Staff が対象店舗を選択してCSVをアップロードできる
- [ ] FR2: Shift_JIS エンコーディングのCSVを正しくデコードできる
- [ ] FR3: 要件定義書のバリデーションルール8項目を全て実装する
- [ ] FR4: 全21カラムをパースし `hpb_monthly_metrics` にUPSERTする
- [ ] FR5: 重複カラム名（`サロン情報PV数`）の検知と先頭列採用を実装する
- [ ] FR6: CSV原本を Supabase Storage に保管する（保持365日）
- [ ] FR7: 取込結果を `hpb_upload_logs` に記録する
- [ ] FR8: 取り込み件数 / エラー / ワーニングをUI上に表示する
- [ ] FR9: 同一店舗・同一年月の既存レコードがある場合、上書き確認後にUPSERTする

### 非機能要件

- [ ] NFR1: CSVファイル上限 5MB
- [ ] NFR2: Client ロールからのアクセスを拒否する
- [ ] NFR3: RLSポリシーにより Staff は担当org配下の店舗のみ操作可能

### スコープ

- 「HPBデータアップロード」画面（要件定義書 No.9）の実装
- CSVパース処理（`src/lib/hpb/`）
- API Route（`src/app/api/hpb/upload/`）
- Supabase Storage バケット設定（`hpb-csv`）

### スコープ外

- HPB KPIカード / 推移グラフ表示（Phase 3: ダッシュボードUI で実装）
- データ鮮度表示（店舗詳細ダッシュボード内）
- CSV自動取得（手動アップロードのみ）
- 複数ファイル同時アップロード（1ファイルずつ）

---

## 3. 権限マトリクス

| 操作 | Admin | Staff | Client |
|------|-------|-------|--------|
| アップロード画面へのアクセス | ✅ | ✅ | ❌ |
| 店舗選択（セレクトボックス） | 全店舗 | 担当org配下の店舗のみ | - |
| CSVアップロード実行 | ✅ | ✅（担当org配下） | ❌ |
| アップロードログ閲覧 | ✅（全件） | ✅（担当org配下） | ❌ |

---

## 4. 技術設計

### 4.1 全体フロー

```
[ブラウザ]                    [API Route]                     [Supabase]
   |                              |                              |
   |-- 店舗選択 + CSV選択 ------->|                              |
   |                              |-- 1. ファイルサイズ検証        |
   |                              |-- 2. Shift_JIS → UTF-8 変換   |
   |                              |-- 3. CSVヘッダー検証           |
   |                              |-- 4. 重複カラム検知            |
   |                              |-- 5. 行ごとバリデーション       |
   |                              |-- 6. 既存レコード重複チェック -->| SELECT
   |                              |<--                            |
   |<-- 重複レコード情報返却 ------|                              |
   |                              |                              |
   |-- 上書き確認（重複あり時）--->|                              |
   |                              |-- 7. Storage保存 ------------>| Storage PUT
   |                              |-- 8. UPSERT ----------------->| hpb_monthly_metrics
   |                              |-- 9. ログ記録 --------------->| hpb_upload_logs
   |<-- 結果表示（件数/警告）------|                              |
```

### 4.2 ファイル配置

| ファイル | 役割 |
|---------|------|
| `src/app/(dashboard)/dashboard/hpb-upload/page.tsx` | アップロード画面（Server Component） |
| `src/components/hpb/upload-form.tsx` | アップロードフォーム（Client Component） |
| `src/components/hpb/upload-result.tsx` | 結果表示コンポーネント |
| `src/app/api/hpb/upload/route.ts` | CSVアップロード API Route |
| `src/lib/hpb/csv-parser.ts` | CSVパース・バリデーション処理 |
| `src/lib/hpb/constants.ts` | HPBカラム定義・マッピング定数 |

### 4.3 CSVパース処理設計（`src/lib/hpb/csv-parser.ts`）

#### エンコーディング変換

```
iconv-lite で Shift_JIS → UTF-8 変換
```

- バイト列を `iconv-lite` の `decode(buffer, 'Shift_JIS')` で変換
- UTF-8のBOMがある場合は除去

#### ヘッダー検証

必須カラム（カラム名ベースのマッチング）:

```typescript
const REQUIRED_COLUMNS = [
  '対象年月',
  'サロン情報PV数(自店)',
  'サロン情報PV数(同P同A平均)',
  'CVR(自店)',
  'CVR(同P同A平均)',
  'ACR(自店)',
  'ACR(同P同A平均)',
  '予約数(自店)',
  '予約数(同P同A平均)',
  '予約売上高(自店)',
  '予約売上高(同P同A平均)',
  '総PV数(自店)',
  '総PV数(同P同A平均)',
  'ブログPV数(自店)',
  'ブログPV数(同P同A平均)',
  'クーポンメニューPV数(自店)',
  'クーポンメニューPV数(同P同A平均)',
  'スタイルPV数(自店)',
  'スタイルPV数(同P同A平均)',
];
```

#### 重複カラム処理

- パース時にカラム名の出現回数をカウント
- `サロン情報PV数(自店)` / `サロン情報PV数(同P同A平均)` が2回出現 → ワーニング
- 先頭出現（列インデックスが小さい方）を採用
- `csv-parse` は `columns: true` で使えないため、`columns: false` で行配列として取得し、ヘッダー行を自前でマッピング

#### カラム名 → DBカラム マッピング

| CSVカラム名 | DBカラム | データ型 | バリデーション |
|------------|---------|---------|--------------|
| `対象年月` | `year_month` | TEXT | YYYYMM 6桁数値 |
| `サロン情報PV数(自店)` | `salon_pv` | INTEGER | 整数 |
| `サロン情報PV数(同P同A平均)` | `salon_pv_area_avg` | INTEGER | 整数 |
| `CVR(自店)` | `cvr` | NUMERIC(6,3) | 小数、0〜100 |
| `CVR(同P同A平均)` | `cvr_area_avg` | NUMERIC(6,3) | 小数、0〜100 |
| `ACR(自店)` | `acr` | NUMERIC(6,3) | 小数、0〜100 |
| `ACR(同P同A平均)` | `acr_area_avg` | NUMERIC(6,3) | 小数、0〜100 |
| `予約数(自店)` | `booking_count` | NUMERIC(10,1) | 小数 |
| `予約数(同P同A平均)` | `booking_count_area_avg` | NUMERIC(10,1) | 小数 |
| `予約売上高(自店)` | `booking_revenue` | INTEGER | 整数 |
| `予約売上高(同P同A平均)` | `booking_revenue_area_avg` | INTEGER | 整数 |
| `総PV数(自店)` | `total_pv` | INTEGER | 整数 |
| `総PV数(同P同A平均)` | `total_pv_area_avg` | INTEGER | 整数 |
| `ブログPV数(自店)` | `blog_pv` | INTEGER | 整数 |
| `ブログPV数(同P同A平均)` | `blog_pv_area_avg` | INTEGER | 整数 |
| `クーポンメニューPV数(自店)` | `coupon_menu_pv` | INTEGER | 整数 |
| `クーポンメニューPV数(同P同A平均)` | `coupon_menu_pv_area_avg` | INTEGER | 整数 |
| `スタイルPV数(自店)` | `style_pv` | INTEGER | 整数 |
| `スタイルPV数(同P同A平均)` | `style_pv_area_avg` | INTEGER | 整数 |

#### バリデーション処理

| チェック | 条件 | レベル | 挙動 |
|---------|------|-------|------|
| ファイルサイズ | > 5MB | ERROR | アップロード拒否 |
| エンコーディング | Shift_JIS判定 | ERROR | 全体エラー |
| ヘッダー必須カラム | いずれか不足 | ERROR | 不足カラム名を明示して全体エラー |
| 重複カラム名 | 同名カラムが複数 | WARNING | 先頭採用でパース継続 |
| 対象年月 | YYYYMM 6桁数値でない | WARNING | 該当行スキップ |
| 整数型カラム | 整数でない値 | WARNING | 該当行スキップ |
| 小数型カラム | 数値でない値 | WARNING | 該当行スキップ |
| CVR/ACR範囲 | 0〜100 外 | WARNING | 取り込み継続（ワーニング表示） |
| 重複レコード | 同一location_id + year_month | INFO | 上書き確認後UPSERT |

**行スキップ判定**: 対象年月が不正、または数値型バリデーションに失敗した場合、その行全体をスキップする。CVR/ACR範囲外はワーニングのみで取り込む。

#### パース結果型

```typescript
type ParseResult = {
  rows: HpbMetricRow[];         // パース成功行
  errors: ParseMessage[];       // ERRORレベル（全体停止）
  warnings: ParseMessage[];     // WARNINGレベル（取り込み継続）
  skippedRows: number;          // スキップ行数
  duplicateColumns: string[];   // 重複カラム名リスト
};

type ParseMessage = {
  row?: number;                 // 行番号（全体エラーの場合はundefined）
  column?: string;              // カラム名
  message: string;              // メッセージ
};

type HpbMetricRow = {
  year_month: string;
  salon_pv: number | null;
  salon_pv_area_avg: number | null;
  // ... 全カラム
};
```

### 4.4 API Route 設計（`src/app/api/hpb/upload/route.ts`）

**POST `/api/hpb/upload`**

**リクエスト**: `multipart/form-data`
- `file`: CSVファイル（必須）
- `locationId`: 店舗UUID（必須）
- `overwrite`: `"true"` | `"false"`（重複時の上書き確認フラグ）

**レスポンス**: `application/json`

```typescript
// 成功
{
  success: true,
  data: {
    recordCount: number;        // 取り込み件数
    skippedRows: number;        // スキップ行数
    warnings: ParseMessage[];   // ワーニング一覧
    duplicateMonths: string[];  // 上書きされた年月リスト
  }
}

// 重複確認必要
{
  success: false,
  needsConfirmation: true,
  duplicateMonths: string[];    // 既存レコードのある年月リスト
}

// エラー
{
  success: false,
  error: string;
  details?: ParseMessage[];
}
```

**処理フロー**:

1. 認証・権限チェック（Admin / Staff のみ）
2. locationId の存在確認 + アクセス権チェック（RLS経由）
3. ファイルサイズチェック（5MB）
4. CSVパース（Shift_JIS変換 → ヘッダー検証 → 行バリデーション）
5. エラーがあれば返却
6. 重複チェック: `hpb_monthly_metrics` に同一 location_id + year_month が存在するか
7. 重複ありかつ `overwrite !== "true"` → 重複確認レスポンスを返却
8. Supabase Storage にCSV原本をアップロード
   - パス: `hpb-csv/{org_id}/{location_id}/{timestamp}_{original_filename}`
9. `hpb_monthly_metrics` へ UPSERT（`ON CONFLICT (location_id, year_month) DO UPDATE`）
10. `hpb_upload_logs` にログ記録
11. 結果レスポンスを返却

### 4.5 Supabase Storage バケット設計

| 項目 | 値 |
|------|-----|
| バケット名 | `hpb-csv` |
| 公開/非公開 | Private |
| ファイルサイズ上限 | 5MB |
| 許可MIMEタイプ | `text/csv`, `application/octet-stream` |
| パス構造 | `{org_id}/{location_id}/{timestamp}_{filename}` |
| 保持期間 | 365日（手動管理 or 将来のcronで削除） |

**Storage RLS**: Admin / Staff が担当org配下のファイルのみアクセス可能。

### 4.6 UI設計（画面 No.9: HPBデータアップロード）

**レイアウト**:

```
┌─────────────────────────────────────────┐
│ HPBデータアップロード                      │
├─────────────────────────────────────────┤
│                                         │
│ 対象店舗: [▼ 店舗を選択 ]               │
│                                         │
│ ┌─────────────────────────────────┐    │
│ │  CSVファイルをドラッグ&ドロップ    │    │
│ │  またはクリックして選択           │    │
│ │  (Shift_JIS CSV, 最大 5MB)      │    │
│ └─────────────────────────────────┘    │
│                                         │
│ [アップロード]                           │
│                                         │
│ ── 結果表示エリア ──                     │
│ ✅ 取り込み完了: 12件                    │
│ ⚠ ワーニング:                           │
│   - 行3: CVR(自店) の値が範囲外 (105.2) │
│   - 重複カラム「サロン情報PV数」を検知    │
│ ── 上書き年月: 202601, 202602 ──        │
│                                         │
├─────────────────────────────────────────┤
│ 最近のアップロード履歴                    │
│ ┌──────┬──────┬─────┬──────┬──────┐    │
│ │日時   │店舗名 │件数  │状態   │ファイル│   │
│ ├──────┼──────┼─────┼──────┼──────┤    │
│ │02/16 │渋谷店 │12件  │成功   │HPB...│   │
│ │02/15 │新宿店 │6件   │一部   │HPB...│   │
│ └──────┴──────┴─────┴──────┴──────┘    │
└─────────────────────────────────────────┘
```

**コンポーネント構成**:

- **店舗セレクト**: Admin=全店舗、Staff=担当org配下。組織名 > 店舗名 の階層表示
- **ファイルドロップゾーン**: ドラッグ&ドロップ + クリック選択対応
- **アップロードボタン**: 店舗未選択 or ファイル未選択時は disabled
- **結果表示**: 成功件数・スキップ行数・ワーニング一覧
- **重複確認ダイアログ**: 既存レコードがある場合、上書き対象年月を表示して確認
- **アップロード履歴テーブル**: 直近のアップロードログを表示（最新10件）

### 4.7 依存パッケージ

| パッケージ | 用途 | インストール要否 |
|-----------|------|----------------|
| `iconv-lite` | Shift_JIS → UTF-8 変換 | **要インストール** |
| `csv-parse` | CSVパース | **要インストール** |

---

## 5. 受入条件

- [ ] AC1: Admin が全店舗を選択してCSVアップロードできる
- [ ] AC2: Staff が担当org配下の店舗のみ選択・アップロードできる
- [ ] AC3: Client がアップロード画面にアクセスできない
- [ ] AC4: Shift_JIS CSVが正しくデコード・パースされる
- [ ] AC5: 不正なエンコーディングのファイルがエラーになる
- [ ] AC6: 必須カラム不足時にエラーが返る（不足カラム名を明示）
- [ ] AC7: 重複カラム名を検知してワーニング表示、先頭列を採用
- [ ] AC8: 対象年月が不正な行がスキップされる
- [ ] AC9: 数値型バリデーション失敗行がスキップされる
- [ ] AC10: CVR/ACR範囲外はワーニング表示で取り込み継続
- [ ] AC11: 既存レコードがある場合、上書き確認ダイアログが表示される
- [ ] AC12: UPSERT（上書き）が正しく動作する
- [ ] AC13: CSV原本が Supabase Storage に保存される
- [ ] AC14: `hpb_upload_logs` にログが記録される
- [ ] AC15: 5MB超のファイルが拒否される
- [ ] AC16: 取り込み結果（件数/スキップ/ワーニング）がUIに表示される

---

## 6. 未解決の質問

（全て解決済み）

- Q1: Supabase Storage バケットはマイグレーションSQLで作成する → **確定**
- Q2: 重複レコードは一括上書き（CSVに含まれる全行を対象にUPSERT） → **確定**
- Q3: パスは `/dashboard/hpb-upload`、サイドバーに Admin / Staff 両方で表示 → **確定**
- Q4: Shift_JIS判定は `iconv-lite` 変換後のヘッダー行マッチングで判定、追加ライブラリ不要 → **確定**

---

## 7. 参照

- 要件定義書: `docs/GBP_Dashboard_Requirements_v1_7.md` セクション 3.1.2, 3.3.2, 4.1(No.9), 5.1, 5.3.2, 7
- DB Spec: `specs/db-schema-rls.md` (COMPLETED) — `hpb_monthly_metrics`, `hpb_upload_logs` テーブル定義
- 技術スタック: `iconv-lite` + `csv-parse`（要件定義書 セクション 5.1）
- 既存パターン: `src/lib/admin/actions.ts` のActionResult型, `src/lib/auth/guards.ts` のrequireRole
