# Spec: GBP API連携（OAuth 2.0設定・Performance API v1・Reviews API v4.9・抽象化レイヤー）

**ステータス**: COMPLETED
**作成日**: 2026-02-16
**最終更新**: 2026-02-16
**要件定義書参照**: セクション 3.1.1, 3.2, 3.3.1, 3.4, 5.1, 8 Phase 2, 9.2

---

## 1. 目的

代理店のGoogle Business Profile（GBP）データを自動取得するためのAPI連携基盤を構築する。OAuth 2.0によるGoogle認証フローの実装、Business Profile Performance API v1による日次パフォーマンス指標・月次検索キーワードの取得、GBP API v4.9 Reviewsによる評価・レビュー数スナップショットの取得、および将来のAPI廃止に備えた抽象化レイヤーの実装を行う。

要件定義書 Phase 2「API連携 + データ収集」の中核機能であり、バッチワーカー（日次/月次）からの呼び出しとシステム設定画面からのOAuth接続UIを提供する。

---

## 2. 要件

### 機能要件

#### OAuth 2.0認証
- [ ] FR1: Admin がシステム設定画面から「Google アカウント接続」ボタンでOAuth認証フローを開始できる
- [ ] FR2: Google OAuth 2.0 認可コードフローを実装し、callback で access_token / refresh_token を取得・保存する
- [ ] FR3: refresh_token を使用して access_token を自動更新する（有効期限切れ時）
- [ ] FR4: OAuth トークンの保存テーブル（`google_oauth_tokens`）を作成する
- [ ] FR5: システム設定画面でOAuth接続状態（接続済み/未接続/トークン期限切れ）を表示する
- [ ] FR6: 再認証（トークン失効時）フローを提供する

#### GBPアカウント・ロケーション管理
- [ ] FR7: OAuth認証後、`accounts.list` API で GBP アカウント一覧を自動取得する
- [ ] FR8: 各アカウントの `locations.list` API で GBP ロケーション一覧を取得する
- [ ] FR9: 管理画面のロケーション編集で、GBPロケーションをドロップダウンから選択して `locations.gbp_location_id` にマッピングする

#### Performance API v1（日次パフォーマンス指標）
- [ ] FR10: `locations.fetchMultiDailyMetricsTimeSeries` で以下7指標を日次取得する
  - `BUSINESS_IMPRESSIONS_DESKTOP_SEARCH`
  - `BUSINESS_IMPRESSIONS_MOBILE_SEARCH`
  - `BUSINESS_IMPRESSIONS_DESKTOP_MAPS`
  - `BUSINESS_IMPRESSIONS_MOBILE_MAPS`
  - `CALL_CLICKS`
  - `BUSINESS_DIRECTION_REQUESTS`
  - `WEBSITE_CLICKS`
- [ ] FR11: 取得データを `daily_metrics` テーブルにUPSERT する
- [ ] FR12: 複数ロケーションを一括取得する（API制限に応じたバッチ分割）

#### Performance API v1（月次検索キーワード）
- [ ] FR13: `searchkeywords.impressions.monthly.list` で検索キーワードデータを取得する
- [ ] FR14: レスポンスの `insightsValue` から `value`（実数） または `threshold`（閾値）を判別して保存する
- [ ] FR15: ページネーション対応（全キーワードを取得、pageSize=100）
- [ ] FR16: 取得データを `monthly_keywords` テーブルにUPSERT する

#### GBP API v4.9 Reviews（評価・レビュー数）
- [ ] FR17: `accounts.locations.reviews.list` で `averageRating` / `totalReviewCount` を取得する
- [ ] FR18: `pageSize=1` で最小データ量の取得（評価・レビュー数のみ使用）
- [ ] FR19: 取得データを `rating_snapshots` テーブルにUPSERT する
- [ ] FR20: レビュー本文はDB保存しない（v1.0スコープ）

#### 抽象化レイヤー
- [ ] FR21: 評価・レビュー取得をインターフェースで抽象化する（`RatingProvider`）
- [ ] FR22: `GbpReviewsRatingProvider`（v4.9）をデフォルト実装とする
- [ ] FR23: 将来の `PlacesApiRatingProvider` 切替が設定変更のみで可能な構造とする
- [ ] FR24: パフォーマンス指標取得も抽象化する（`PerformanceMetricsProvider`）

#### トークン失効通知
- [ ] FR25: refresh_token 失効（Google側のアクセス取り消し等）を検知する
- [ ] FR26: 失効検知時に Admin 宛てにメール通知を送信する（Supabase Auth のメール機能を利用）
- [ ] FR27: `google_oauth_tokens.is_valid` を `false` に更新し、システム設定画面で警告表示する

#### エラーハンドリング・レート制限
- [ ] FR28: APIレートリミット（300 QPM）を考慮した分散実行を実装する
- [ ] FR29: API呼び出し失敗時のリトライ（最大3回、指数バックオフ）を実装する
- [ ] FR30: 全API呼び出しの成否をログ出力する

### 非機能要件

- [ ] NFR1: OAuth refresh_token は暗号化して保存する（AES-256-GCM）
- [ ] NFR2: 100店舗規模のバッチ実行が30分以内に完了する
- [ ] NFR3: APIレートリミット内で安定動作する（300 QPM前提、余裕を持って200 QPM以下で運用）
- [ ] NFR4: トークン失効時にAdmin宛メール通知を送信する
- [ ] NFR5: 全API呼び出しを `batch_logs` に記録する

### スコープ外

- バッチワーカー（cron）の実装（別Spec `gbp-batch-worker.md` で対応）
- 日次/月次のスケジューリング制御
- 30日バックフィル（バッチワーカーSpecで対応）
- レビュー本文の保存・表示UI
- Places API (New) によるフォールバック実装（抽象化レイヤーのみ準備）
- バッチ失敗時のメール通知（トークン失効通知は本Specに含む。バッチ系通知はバッチSpec）

### 権限マトリクス

| 操作 | Admin | Staff | Client |
|------|-------|-------|--------|
| OAuth接続開始 | ✅ | ❌ | ❌ |
| OAuth接続状態確認 | ✅ | ❌ | ❌ |
| OAuth再認証 | ✅ | ❌ | ❌ |
| GBPアカウント一覧表示 | ✅ | ❌ | ❌ |
| GBPロケーションマッピング | ✅ | ❌ | ❌ |
| daily_metrics 参照 | ✅ 全件 | ✅ 担当org | ✅ 自社org |
| monthly_keywords 参照 | ✅ 全件 | ✅ 担当org | ✅ 自社org |
| rating_snapshots 参照 | ✅ 全件 | ✅ 担当org | ✅ 自社org |
| batch_logs 参照 | ✅ | ❌ | ❌ |
| API手動実行（テスト） | ✅ | ❌ | ❌ |

---

## 3. 技術設計

### 使用技術

- **OAuth**: Google OAuth 2.0 認可コードフロー（server-side）
- **API クライアント**: `googleapis` npm パッケージ（google-auth-library + REST呼び出し）
- **暗号化**: Node.js `crypto` モジュール（AES-256-GCM）
- **API Routes**: Next.js API Routes (`src/app/api/oauth/google/...`)
- **GBP ライブラリ**: `src/lib/gbp/` に配置

### 環境変数

```env
# Google OAuth 2.0
GOOGLE_CLIENT_ID=858968507634-vf4gd8tcjhm8f36a30q1rv2r2lsk3kp5.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-yjxvO2rHuqG3FKW-ArLhuJOkgBz
GOOGLE_REDIRECT_URI=http://localhost:3000/api/oauth/google/callback
GOOGLE_OAUTH_SCOPES=https://www.googleapis.com/auth/business.manage openid email

# Token Encryption
GOOGLE_TOKEN_ENCRYPTION_KEY={32バイトのランダムキー（hex）}
```

### データベース

#### 新規テーブル: `google_oauth_tokens`

| カラム | 型 | 制約 | 備考 |
|--------|-----|------|------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| user_id | UUID | NOT NULL, FK → users(id) ON DELETE CASCADE | 認証実行者（Admin） |
| google_email | TEXT | NOT NULL | Google アカウントのメールアドレス |
| access_token_encrypted | TEXT | NOT NULL | AES-256-GCM 暗号化済み |
| refresh_token_encrypted | TEXT | NOT NULL | AES-256-GCM 暗号化済み |
| token_expiry | TIMESTAMPTZ | NOT NULL | access_token の有効期限 |
| scopes | TEXT | NOT NULL | 付与されたスコープ（スペース区切り） |
| is_valid | BOOLEAN | NOT NULL, DEFAULT true | トークン有効フラグ（失効時false） |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

- 現時点ではシステム全体で1レコード（代理店のGoogleアカウント）を想定
- 将来的に複数アカウント対応が必要な場合はこのテーブルで拡張可能

#### 新規テーブル: `gbp_accounts`

| カラム | 型 | 制約 | 備考 |
|--------|-----|------|------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| google_oauth_token_id | UUID | NOT NULL, FK → google_oauth_tokens(id) ON DELETE CASCADE | |
| gbp_account_id | TEXT | NOT NULL, UNIQUE | GBP アカウント名（`accounts/xxx`） |
| account_name | TEXT | | 表示用アカウント名 |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

#### 既存テーブル更新: `locations`

- `gbp_location_id` カラムは既存（TEXT, nullable）
- GBP API の `locations/{locationId}` の `{locationId}` 部分を格納
- `gbp_account_id` への参照は `gbp_accounts` テーブル経由で解決

### RLSポリシー

| テーブル | ポリシー | 条件 |
|---------|---------|------|
| google_oauth_tokens | SELECT | `get_user_role() = 'admin'` |
| google_oauth_tokens | INSERT/UPDATE | `get_user_role() = 'admin'` |
| google_oauth_tokens | DELETE | `get_user_role() = 'admin'` |
| gbp_accounts | SELECT | `get_user_role() = 'admin'` |
| gbp_accounts | INSERT/UPDATE/DELETE | `get_user_role() = 'admin'` |

※ バッチ処理は `service_role` で RLS バイパス

### APIエンドポイント

| メソッド | パス | 権限 | 説明 |
|---------|------|------|------|
| GET | `/api/oauth/google` | Admin | OAuth認証フロー開始（Google認可URLへリダイレクト） |
| GET | `/api/oauth/google/callback` | Admin | OAuth callback（トークン取得・保存） |
| GET | `/api/oauth/google/status` | Admin | OAuth接続状態確認 |
| POST | `/api/oauth/google/disconnect` | Admin | OAuth接続解除 |
| GET | `/api/gbp/accounts` | Admin | GBPアカウント一覧取得 |
| GET | `/api/gbp/locations` | Admin | GBPロケーション一覧取得（アカウント横断） |
| POST | `/api/gbp/test-fetch` | Admin | テスト取得（指定ロケーションの直近1日分の全指標を即時取得） |

### ファイル構成

```
src/
├── app/api/
│   ├── oauth/google/
│   │   ├── route.ts              # GET: OAuth認証開始
│   │   ├── callback/route.ts     # GET: OAuth callback
│   │   ├── status/route.ts       # GET: 接続状態
│   │   └── disconnect/route.ts   # POST: 接続解除
│   └── gbp/
│       ├── accounts/route.ts     # GET: アカウント一覧
│       ├── locations/route.ts    # GET: ロケーション一覧
│       └── test-fetch/route.ts   # POST: テスト取得
├── lib/gbp/
│   ├── oauth.ts                  # OAuth ヘルパー（URL生成、トークン交換、リフレッシュ）
│   ├── token-store.ts            # トークン保存・取得・暗号化/復号化
│   ├── client.ts                 # GBP API クライアント（認証済みHTTPクライアント）
│   ├── performance.ts            # Performance API v1 呼び出し
│   ├── reviews.ts                # Reviews API v4.9 呼び出し
│   ├── keywords.ts               # Search Keywords API 呼び出し
│   ├── types.ts                  # GBP API 関連の型定義
│   └── providers/
│       ├── rating-provider.ts    # RatingProvider インターフェース
│       ├── gbp-reviews-provider.ts  # GBP v4.9 Reviews 実装
│       └── performance-provider.ts  # PerformanceMetricsProvider
└── types/
    └── index.ts                  # 既存に GBP 関連型を追加
```

### OAuth 2.0 フロー詳細

```
1. Admin → GET /api/oauth/google
   → state パラメータ生成（CSRF対策）
   → Google 認可 URL にリダイレクト

2. Google → GET /api/oauth/google/callback?code=xxx&state=yyy
   → state 検証
   → 認可コード → トークン交換（POST https://oauth2.googleapis.com/token）
   → access_token, refresh_token, expiry 取得
   → トークン暗号化 → google_oauth_tokens に保存
   → GBP accounts.list 呼び出し → gbp_accounts に保存
   → システム設定画面にリダイレクト（成功メッセージ付き）

3. バッチ処理（service_role）
   → google_oauth_tokens から refresh_token 取得・復号
   → access_token 期限切れチェック → 必要ならリフレッシュ
   → 更新後の access_token で API 呼び出し
```

### API呼び出し詳細

#### Performance API v1: fetchMultiDailyMetricsTimeSeries

```
POST https://businessprofileperformance.googleapis.com/v1/{location}:fetchMultiDailyMetricsTimeSeries

location: locations/{locationId}

リクエスト:
{
  "dailyMetrics": [
    "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
    "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
    "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
    "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
    "CALL_CLICKS",
    "BUSINESS_DIRECTION_REQUESTS",
    "WEBSITE_CLICKS"
  ],
  "dailyRange": {
    "startDate": { "year": 2026, "month": 2, "day": 15 },
    "endDate": { "year": 2026, "month": 2, "day": 15 }
  }
}

レスポンス:
{
  "multiDailyMetricTimeSeries": [
    {
      "dailyMetricTimeSeries": {
        "dailyMetric": "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
        "timeSeries": {
          "datedValues": [
            { "date": { "year": 2026, "month": 2, "day": 15 }, "value": "42" }
          ]
        }
      }
    },
    ...
  ]
}
```

#### Search Keywords: searchkeywords.impressions.monthly.list

```
GET https://businessprofileperformance.googleapis.com/v1/{parent}/searchkeywords/impressions/monthly
  ?monthlyRange.startMonth.year=2026&monthlyRange.startMonth.month=1
  &monthlyRange.endMonth.year=2026&monthlyRange.endMonth.month=1
  &pageSize=100

parent: locations/{locationId}

レスポンス:
{
  "searchKeywordsCounts": [
    {
      "searchKeyword": "美容室 渋谷",
      "insightsValue": {
        "value": "85"          // 実数の場合
      }
    },
    {
      "searchKeyword": "ヘアサロン 渋谷",
      "insightsValue": {
        "threshold": "15"     // 低ボリュームの場合
      }
    }
  ],
  "nextPageToken": "..."
}
```

#### Reviews API v4.9: accounts.locations.reviews.list

```
GET https://mybusiness.googleapis.com/v4/{parent}/reviews?pageSize=1

parent: accounts/{accountId}/locations/{locationId}

レスポンス:
{
  "reviews": [...],
  "averageRating": 4.3,
  "totalReviewCount": 156,
  "nextPageToken": "..."
}
```

### 抽象化レイヤー設計

```typescript
// RatingProvider インターフェース
interface RatingProvider {
  getRating(locationId: string, accountId?: string): Promise<RatingData>;
}

interface RatingData {
  averageRating: number | null;
  totalReviewCount: number | null;
  fetchedAt: Date;
}

// PerformanceMetricsProvider インターフェース
interface PerformanceMetricsProvider {
  getDailyMetrics(
    locationId: string,
    startDate: DateRange,
    endDate: DateRange,
    metrics: DailyMetricType[]
  ): Promise<DailyMetricResult[]>;

  getMonthlyKeywords(
    locationId: string,
    yearMonth: string,
    pageSize?: number
  ): Promise<KeywordResult[]>;
}

// DailyMetricType enum
type DailyMetricType =
  | 'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH'
  | 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH'
  | 'BUSINESS_IMPRESSIONS_DESKTOP_MAPS'
  | 'BUSINESS_IMPRESSIONS_MOBILE_MAPS'
  | 'CALL_CLICKS'
  | 'BUSINESS_DIRECTION_REQUESTS'
  | 'WEBSITE_CLICKS';
```

### レート制限対策

| 対策 | 実装方法 |
|------|---------|
| QPM制御 | API呼び出し間に最低300ms間隔（200 QPM以下） |
| バッチ分割 | 100店舗を10店舗ずつ分割して逐次処理 |
| 指数バックオフ | 429/5xx エラー時: 1s → 2s → 4s で最大3回リトライ |
| エラー分離 | 1店舗の失敗が他店舗に影響しない設計 |

### 設計判断

| 判断事項 | 選択 | 理由 |
|---------|------|------|
| OAuth トークン数 | システム全体で1トークン（代理店アカウント） | 代理店がクライアントのGBP管理権限を受け取る運用モデル |
| トークン暗号化方式 | AES-256-GCM（環境変数の鍵） | Supabase Vault は有料プランのみ。環境変数ベースがシンプル |
| API クライアント | `google-auth-library` + fetch | googleapis フルパッケージは重すぎる。軽量な認証ライブラリ + REST直接呼び出し |
| GBP Account ID 管理 | 専用テーブル `gbp_accounts` | Reviews API が `accounts/{id}/locations/{id}` 形式を要求するため |
| Location マッピング | `locations.gbp_location_id` を使用 | 既存カラムを活用。管理画面で手動設定済み |
| 抽象化レイヤーの範囲 | Rating 取得のみインターフェース化 | 要件定義書9.2の「v4.9廃止時のPlaces API切替」に対応 |
| Performance API 呼び出し | ロケーションごとに個別呼び出し | fetchMultiDailyMetricsTimeSeries は1ロケーションずつ呼び出す仕様 |

---

## 4. 受入条件

- [ ] AC1: Admin がシステム設定画面から Google アカウントの OAuth 認証を完了できる
- [ ] AC2: OAuth callback で access_token / refresh_token が暗号化されて DB に保存される
- [ ] AC3: 接続状態（接続済み/未接続）がシステム設定画面に表示される
- [ ] AC4: GBP アカウント一覧が自動取得され `gbp_accounts` テーブルに保存される
- [ ] AC5: `fetchMultiDailyMetricsTimeSeries` で7つの日次指標が取得でき、`daily_metrics` にUPSERTされる
- [ ] AC6: `searchkeywords.impressions.monthly.list` で月次キーワードが取得でき、value/threshold が正しく判別・保存される
- [ ] AC7: `accounts.locations.reviews.list` で `averageRating` / `totalReviewCount` が取得でき、`rating_snapshots` にUPSERTされる
- [ ] AC8: access_token 期限切れ時に refresh_token で自動更新される
- [ ] AC9: API 呼び出し失敗時に指数バックオフで最大3回リトライされる
- [ ] AC10: `RatingProvider` インターフェースが定義され、`GbpReviewsRatingProvider` がデフォルト実装として動作する
- [ ] AC11: TypeScript の型安全性が保たれ、`tsc --noEmit` がエラーなし
- [ ] AC12: `/api/gbp/test-fetch` でAdmin が任意のロケーションの直近1日分の全指標（パフォーマンス + レビュー + キーワード）を即時取得できる
- [ ] AC13: refresh_token 失効時に `is_valid` が `false` に更新され、Admin にメール通知が送信される

---

## 5. 未解決の質問

（全て解決済み）

- Q1: `openid email` スコープはGoogleアカウントのメール表示用 → **確定**
- Q2: GBPロケーションマッピングは管理画面でドロップダウンから手動選択（案A） → **確定**
- Q3: テスト取得は直近1日分の全指標を一括取得（案A） → **確定**
- Q4: トークン失効時のメール通知は本Specに含める → **確定**（FR25-FR27, AC13 に反映済み）

---

## 6. 参照

- 要件定義書: `docs/GBP_Dashboard_Requirements_v1_7.md` セクション 3.1.1, 3.2, 3.3.1, 3.4, 9.2
- DBスキーマSpec: `specs/db-schema-rls.md` (COMPLETED)
- 管理画面Spec: `specs/admin-management.md` (COMPLETED)
- Business Profile Performance API: `https://developers.google.com/my-business/reference/performance`
- GBP API v4.9 Reviews: `https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews`
- Google OAuth 2.0: `https://developers.google.com/identity/protocols/oauth2`
