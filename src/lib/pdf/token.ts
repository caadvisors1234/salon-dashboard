import { SignJWT, jwtVerify } from "jose";

export type ReportTokenScope = {
  type: "store";
  locationId: string;
} | {
  type: "client";
  orgId: string;
};

type ReportTokenPayload = {
  userId: string;
  scope: ReportTokenScope;
};

function getSecret(): Uint8Array {
  const secret = process.env.REPORT_TOKEN_SECRET;
  if (!secret) {
    throw new Error("REPORT_TOKEN_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(secret);
}

/**
 * レポート生成用の短命内部JWTを生成する。
 * Puppeteerがレポートページにアクセスする際の認証に使用。
 * 有効期限: 5分
 */
export async function createReportToken(
  userId: string,
  scope: ReportTokenScope
): Promise<string> {
  return new SignJWT({ userId, scope })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(getSecret());
}

/**
 * レポート用内部JWTを検証し、ペイロードを返す。
 * 無効なトークンの場合は例外をスローする。
 */
export async function verifyReportToken(
  token: string
): Promise<ReportTokenPayload> {
  const { payload } = await jwtVerify(token, getSecret());
  return {
    userId: payload.userId as string,
    scope: payload.scope as ReportTokenScope,
  };
}
