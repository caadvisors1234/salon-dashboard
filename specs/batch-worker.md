# Spec: バッチワーカー（日次/月次cron・リトライ・30日バックフィル・メール通知）

**ステータス**: COMPLETED
**作成日**: 2026-02-16
**最終更新**: 2026-02-16
**要件定義書参照**: セクション 3.3.1, 5.1, 5.2, 7, 8 Phase 2, 9.2

---

## 1. 目的

GBPデータを自動的に収集するバッチワーカーを構築する。日次バッチ（パフォーマンス指標 + 評価スナップショット）と月次バッチ（検索キーワード）をcronスケジュールで自動実行し、失敗時のリトライ、コンテナ停止復帰後の30日バックフィル、およびバッチ失敗時のメール通知を実装する。

GBP API連携基盤（`src/lib/gbp/`）は実装済み（`specs/gbp-api-integration.md` COMPLETED）であり、本Specではこれらの既存モジュールをオーケストレーションするワーカープロセスとその周辺機能を対象とする。

要件定義書:
- セクション 3.3.1: 日次バッチ AM 3:00 JST、月次バッチ 毎月8日 AM 3:00 JST、リトライ最大3回指数バックオフ、30日バックフィル
- セクション 5.2: `batch` コンテナとして独立稼働
- セクション 7: 通知手段はメールのみ（確定）

---

## 2. 要件

### 機能要件

#### バッチスケジューリング
- [ ] FR1: 日次バッチを毎日 AM 3:00 JST（UTC 18:00 前日）に自動実行する
- [ ] FR2: 月次バッチを毎月8日 AM 3:00 JST に自動実行する
- [ ] FR3: `node-cron` を使用してcronスケジュールを管理する
- [ ] FR4: スケジュール設定を環境変数で変更可能とする（`BATCH_DAILY_CRON`, `BATCH_MONTHLY_CRON`）

#### 日次バッチジョブ
- [ ] FR5: `locations` テーブルから `gbp_location_id` が設定済みかつ `is_active = true` の全店舗を取得する
- [ ] FR6: 各店舗に対して以下を実行する:
  - a. Performance API v1 で前日の日次パフォーマンス指標（7指標）を取得し `daily_metrics` にUPSERT
  - b. Reviews API v4.9 で評価・レビュー数を取得し `rating_snapshots` にUPSERT
- [ ] FR7: 1店舗の失敗が他店舗の処理に影響しない（エラー分離）
- [ ] FR8: ジョブ完了後に `batch_logs` に実行結果（成功/失敗件数、エラー詳細）を記録する

#### 月次バッチジョブ
- [ ] FR9: 全対象店舗に対して `searchkeywords.impressions.monthly.list` で前月の検索キーワードを取得し `monthly_keywords` にUPSERT する
- [ ] FR10: ページネーション対応で全キーワードを取得する（既存 `fetchMonthlyKeywords` を使用）
- [ ] FR11: ジョブ完了後に `batch_logs` に実行結果を記録する

#### リトライ（ジョブレベル）
- [ ] FR12: 各店舗の処理が失敗した場合、最大3回・指数バックオフ（1s → 2s → 4s）でリトライする
  - 注: API呼び出し単位のリトライは既存 `GbpApiClient` が処理済み。本FR は店舗単位のリトライ
- [ ] FR13: 全リトライ失敗時にエラー詳細を `batch_logs.metadata` に記録する

#### 30日バックフィル
- [ ] FR14: ワーカー起動時に `daily_metrics` と `rating_snapshots` の直近30日間の欠損日を検出する
- [ ] FR15: 欠損日が存在する場合、通常のcronスケジュールより先にバックフィルジョブを実行する
- [ ] FR16: バックフィルは店舗ごと・日付ごとに順次処理し、APIレート制限内で実行する
- [ ] FR17: 30日を超える欠損が検出された場合、アラート（メール通知 + batch_logs）を発行し、手動対応を促す
- [ ] FR18: バックフィル実行結果を `batch_logs` に記録する（`job_type: "backfill_daily"`, `"backfill_rating"`）

#### メール通知
- [ ] FR19: Resend SDK を使用してバッチ失敗時のメール通知を実装する
- [ ] FR20: 通知対象イベント:
  - a. 日次/月次バッチの完了（失敗店舗がある場合のみ）
  - b. 30日超欠損アラート
  - c. OAuthトークン失効（既存 `notifyTokenInvalidation` をメール送信に拡張）
  - d. バッチワーカー起動/停止
- [ ] FR21: 通知先は `users` テーブルの `role = 'admin'` の全ユーザー
- [ ] FR22: メール送信失敗はログに記録し、バッチ処理自体は継続する（通知失敗でバッチが止まらない）
- [ ] FR23: 環境変数 `RESEND_API_KEY` と `BATCH_NOTIFICATION_FROM`（開発: `onboarding@resend.dev`）で設定する

#### Docker・インフラ
- [ ] FR24: `batch` コンテナを `docker-compose.yml` に追加する
- [ ] FR25: `batch/` ディレクトリに独立した TypeScript プロジェクトを構成する
- [ ] FR26: `batch` コンテナの再起動ポリシーは `unless-stopped` とする
- [ ] FR27: ヘルスチェック用の HTTP エンドポイント（ポート 3001）を提供する
- [ ] FR28: グレースフルシャットダウン（SIGTERM/SIGINT）を実装する

#### 手動実行API
- [ ] FR29: `POST /api/batch/trigger` で Admin が手動でバッチを即時実行できる
- [ ] FR30: リクエストパラメータ: `{ jobType: "daily" | "monthly" | "backfill", targetDate?: string }`
- [ ] FR31: 実行中の重複防止（同一ジョブタイプが実行中の場合はエラーを返す）

### 非機能要件

- [ ] NFR1: 100店舗規模のフルバッチ（日次）が30分以内に完了する
- [ ] NFR2: APIレート制限（200 QPM以下）を遵守する（既存 `GbpApiClient` のスロットリング）
- [ ] NFR3: バッチ処理は `service_role` で実行し、RLSをバイパスする
- [ ] NFR4: TypeScript strict mode を遵守する
- [ ] NFR5: ワーカープロセスのメモリ使用量が 512MB 以下で安定動作する

### スコープ外

- GBP API連携の実装（`src/lib/gbp/` 既存モジュール — 実装済み）
- バッチ設定のUI管理画面（環境変数で設定）
- HPB CSVアップロードの自動化（手動アップロードのみ）
- PDF生成のキュー処理（別Spec）
- 分散ワーカー/ジョブキュー（初期は単一コンテナ）

### 権限マトリクス

| 操作 | Admin | Staff | Client |
|------|-------|-------|--------|
| バッチ手動実行 | ✅ | ❌ | ❌ |
| batch_logs 参照 | ✅ | ❌ | ❌ |
| バッチ設定変更 | ✅（環境変数経由） | ❌ | ❌ |

---

## 3. 技術設計

### 使用技術

- **ランタイム**: Node.js 20（TypeScript、tsx で直接実行）
- **cronスケジューラ**: `node-cron`
- **メール送信**: `resend`（Resend SDK）
- **APIクライアント**: 既存 `src/lib/gbp/` モジュールを共有
- **DB**: Supabase（`@supabase/supabase-js`、service_role）
- **ヘルスチェック**: Node.js `http` モジュール（軽量HTTPサーバー）

### 環境変数（追加分）

```env
# Batch Worker
BATCH_DAILY_CRON=0 18 * * *          # UTC 18:00 = JST 3:00
BATCH_MONTHLY_CRON=0 18 8 * *        # UTC 18:00 毎月8日 = JST 3:00
BATCH_BACKFILL_DAYS=30               # バックフィル対象日数
BATCH_HEALTH_PORT=3001               # ヘルスチェックポート

# Email Notification (Resend)
RESEND_API_KEY=re_xxxxxxxxxx
BATCH_NOTIFICATION_FROM=noreply@example.com
```

### アーキテクチャ

```
┌─────────────────────────────────────────────┐
│  batch コンテナ (Node.js)                    │
│                                             │
│  ┌─────────────┐  ┌──────────────────┐      │
│  │ Scheduler   │  │ Health Server    │      │
│  │ (node-cron) │  │ (:3001)          │      │
│  └──────┬──────┘  └──────────────────┘      │
│         │                                   │
│  ┌──────▼──────┐                            │
│  │ Job Runner  │                            │
│  │             │                            │
│  │ ・dailyJob  │──→ src/lib/gbp/            │
│  │ ・monthlyJob│    performance.ts           │
│  │ ・backfill  │    reviews.ts               │
│  └──────┬──────┘    keywords.ts              │
│         │                                   │
│  ┌──────▼──────┐  ┌──────────────────┐      │
│  │ Logger      │  │ Notifier         │      │
│  │ (batch_logs)│  │ (Resend email)   │      │
│  └─────────────┘  └──────────────────┘      │
└─────────────────────────────────────────────┘
        │                     │
        ▼                     ▼
   Supabase DB           Resend API
```

### ファイル構成

```
batch/
├── src/
│   ├── index.ts              # エントリポイント（scheduler + health server + backfill）
│   ├── scheduler.ts          # cron スケジュール登録
│   ├── jobs/
│   │   ├── daily.ts          # 日次バッチジョブ
│   │   ├── monthly.ts        # 月次バッチジョブ
│   │   └── backfill.ts       # バックフィルジョブ
│   ├── services/
│   │   ├── notifier.ts       # メール通知（Resend）
│   │   └── health.ts         # ヘルスチェックHTTPサーバー
│   └── lib/
│       ├── logger.ts         # batch_logs 書き込みヘルパー
│       ├── lock.ts           # ジョブ重複防止（インメモリロック）
│       └── config.ts         # 環境変数読み込み・バリデーション
├── tsconfig.json             # batch用TypeScript設定（paths含む）
├── package.json              # batch用依存関係
└── Dockerfile                # batch コンテナビルド
```

### `src/lib/gbp/` モジュールの共有方法

batchコンテナは `src/lib/` のコードを直接参照する。TypeScript のパスエイリアスを使用:

```json
// batch/tsconfig.json
{
  "compilerOptions": {
    "baseUrl": "..",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

`tsx` (TypeScript execute) を使用してトランスパイル不要で直接実行する。

### ジョブ実行フロー

#### 日次バッチ

```
1. ジョブ開始 → batch_logs に "daily_batch" started を記録
2. locations テーブルから対象店舗を取得
3. GBP アカウント情報を取得
4. 各店舗に対して（順次処理、API レート制限遵守）:
   a. fetchDailyMetrics() → saveDailyMetrics()
   b. fetchRatingSnapshot() → saveRatingSnapshot()
   c. 失敗時: 最大3回リトライ（店舗単位）
   d. 結果を集計
5. batch_logs にジョブ結果を記録
6. 失敗店舗がある場合 → メール通知
```

#### 月次バッチ

```
1. ジョブ開始 → batch_logs に "monthly_batch" started を記録
2. 対象年月を算出（前月）
3. 各店舗に対して:
   a. fetchMonthlyKeywords() → saveMonthlyKeywords()
   b. 失敗時: 最大3回リトライ
4. batch_logs にジョブ結果を記録
5. 失敗店舗がある場合 → メール通知
```

#### バックフィル

```
1. ワーカー起動時に実行
2. 各店舗について:
   a. daily_metrics の直近30日を検索し、データがない日を特定
   b. rating_snapshots の直近30日を検索し、データがない日を特定
3. 欠損日がある場合:
   a. 日付ごとに fetchDailyMetrics + saveDailyMetrics
   b. 日付ごとに fetchRatingSnapshot + saveRatingSnapshot
4. 30日超の欠損を検出した場合:
   a. batch_logs にアラートを記録
   b. Admin にメール通知
5. バックフィル完了を batch_logs に記録
```

### メール通知テンプレート

#### バッチ完了（失敗あり）

```
件名: [GBP Dashboard] 日次バッチ完了（一部失敗）

実行日時: 2026-02-16 03:00 JST
ジョブ: 日次バッチ

結果:
- 成功: 95 店舗
- 失敗: 5 店舗

失敗店舗:
- 店舗A (location_id: xxx): API error 403
- 店舗B (location_id: yyy): Timeout
...

管理画面で詳細を確認してください。
```

#### 30日超欠損アラート

```
件名: [GBP Dashboard] データ欠損アラート（手動対応が必要）

以下の店舗で30日を超えるデータ欠損が検出されました。
手動でのバックフィル実行が必要です。

- 店舗A: 最終取得日 2026-01-10（37日間の欠損）
- 店舗B: 最終取得日 2026-01-05（42日間の欠損）

管理画面 > システム設定 からバッチを手動実行してください。
```

### Docker構成

```yaml
# docker-compose.yml に追加
batch:
  build:
    context: .
    dockerfile: batch/Dockerfile
  restart: unless-stopped
  environment:
    - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
    - NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
    - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
    - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
    - GOOGLE_TOKEN_ENCRYPTION_KEY=${GOOGLE_TOKEN_ENCRYPTION_KEY}
    - RESEND_API_KEY=${RESEND_API_KEY}
    - BATCH_NOTIFICATION_FROM=${BATCH_NOTIFICATION_FROM}
    - BATCH_DAILY_CRON=${BATCH_DAILY_CRON:-0 18 * * *}
    - BATCH_MONTHLY_CRON=${BATCH_MONTHLY_CRON:-0 18 8 * *}
    - BATCH_BACKFILL_DAYS=${BATCH_BACKFILL_DAYS:-30}
    - BATCH_HEALTH_PORT=${BATCH_HEALTH_PORT:-3001}
  healthcheck:
    test: ["CMD", "wget", "--spider", "-q", "http://localhost:3001/health"]
    interval: 30s
    timeout: 10s
    retries: 3
```

```dockerfile
# batch/Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY batch/package.json batch/
RUN cd batch && npm install
COPY src/ src/
COPY batch/ batch/
CMD ["npx", "tsx", "batch/src/index.ts"]
```

### ジョブ重複防止

インメモリロックで同一ジョブの並行実行を防止する:

```typescript
// batch/src/lib/lock.ts
const runningJobs = new Set<string>();

export function acquireLock(jobType: string): boolean {
  if (runningJobs.has(jobType)) return false;
  runningJobs.add(jobType);
  return true;
}

export function releaseLock(jobType: string): void {
  runningJobs.delete(jobType);
}
```

### 手動実行API

```typescript
// src/app/api/batch/trigger/route.ts
// Admin専用。batch コンテナのジョブを直接呼び出すのではなく、
// 同じ GBP API モジュールを使って Next.js プロセス内で実行する。
// 実行状態は batch_logs で追跡する。
```

### 設計判断

| 判断事項 | 選択 | 理由 |
|---------|------|------|
| ワーカー実行方式 | 独立Node.jsプロセス（`tsx` 直接実行） | Next.js API Routes経由だとタイムアウト制限あり。長時間実行に適した独立プロセス |
| cronライブラリ | `node-cron` | シンプル、軽量、実績十分。外部cronサービス不要 |
| メール送信 | Resend | 開発者フレンドリー、無料枠あり、TypeScript SDK充実 |
| 店舗処理順序 | 逐次処理 | APIレート制限遵守のため。並列化は将来最適化で対応 |
| バックフィルトリガー | 起動時のみ | 定期バックフィルは過剰。コンテナ再起動で十分 |
| ジョブキュー | 不使用（インメモリ） | 初期100店舗規模では不要。将来BullMQ等に拡張可能 |
| `src/lib/gbp/` 共有 | TypeScript paths + tsx | ビルド不要、コード重複なし。モノレポ構成を活用 |
| 手動実行 | Next.js API Route 内で実行 | batch コンテナへの通信不要。同じDB・APIモジュールを共有 |

---

## 4. 受入条件

- [ ] AC1: `batch` コンテナが `docker-compose up` で正常に起動し、ヘルスチェックがパスする
- [ ] AC2: 日次バッチが AM 3:00 JST に自動実行され、全対象店舗の `daily_metrics` と `rating_snapshots` が更新される
- [ ] AC3: 月次バッチが毎月8日 AM 3:00 JST に自動実行され、`monthly_keywords` が更新される
- [ ] AC4: 1店舗の API エラーが他店舗の処理をブロックしない
- [ ] AC5: 全リトライ失敗後にエラー詳細が `batch_logs` に記録される
- [ ] AC6: コンテナ再起動後に30日バックフィルが自動実行され、欠損データが補完される
- [ ] AC7: 30日超の欠損検出時に Admin 宛メールが送信される
- [ ] AC8: バッチ失敗時（失敗店舗がある場合）に Admin 宛メールが送信される
- [ ] AC9: `POST /api/batch/trigger` で Admin がバッチを手動実行でき、実行中の重複が防止される
- [ ] AC10: SIGTERM 受信時にグレースフルシャットダウンする（実行中のジョブ完了を待機）
- [ ] AC11: TypeScript strict mode でエラーなし
- [ ] AC12: 100店舗の日次バッチが30分以内に完了する

---

## 5. 未解決の質問

（全て解決済み）

- Q1: Resend の送信元ドメイン → **開発段階は `onboarding@resend.dev` で進行。本番時に独自ドメインを設定**
- Q2: バッチ手動実行の対象 → **全店舗一括でOK。店舗指定は不要**
- Q3: バックフィル対象 → **日次データ（daily_metrics + rating_snapshots）のみ。月次キーワードは対象外**

---

## 6. 参照

- 要件定義書: `docs/GBP_Dashboard_Requirements_v1_7.md` セクション 3.3.1, 5.1, 5.2, 7, 8 Phase 2, 9.2
- GBP API連携Spec: `specs/gbp-api-integration.md` (COMPLETED)
- DBスキーマSpec: `specs/db-schema-rls.md` (COMPLETED)
- 既存コード:
  - `src/lib/gbp/client.ts` — GBP API クライアント（スロットリング + リトライ済み）
  - `src/lib/gbp/performance.ts` — fetchDailyMetrics / saveDailyMetrics
  - `src/lib/gbp/reviews.ts` — fetchRatingSnapshot / saveRatingSnapshot
  - `src/lib/gbp/keywords.ts` — fetchMonthlyKeywords / saveMonthlyKeywords
  - `src/lib/gbp/notification.ts` — 通知ベース（メール送信に拡張予定）
  - `src/lib/supabase/admin.ts` — service_role クライアント
