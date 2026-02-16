FROM node:20-alpine

WORKDIR /app

# ルートプロジェクトの依存関係をインストール（src/ の共有コード用）
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# バッチワーカーの依存関係をインストール
COPY batch/package.json batch/package-lock.json batch/
RUN cd batch && npm ci --omit=dev

# ソースコードをコピー（node_modules は .dockerignore で除外）
COPY src/ src/
COPY batch/src/ batch/src/
COPY batch/tsconfig.json batch/

# ヘルスチェックツール
RUN apk add --no-cache wget

# 非rootユーザーで実行
RUN addgroup --system --gid 1001 batch && \
    adduser --system --uid 1001 batch
USER batch

EXPOSE 3001

CMD ["./batch/node_modules/.bin/tsx", "batch/src/index.ts"]
