"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type OAuthStatus = {
  status: "connected" | "disconnected" | "invalid";
  email?: string;
};

type GbpAccount = {
  gbpAccountId: string;
  accountName: string | null;
};

export function GoogleOAuthCard() {
  const searchParams = useSearchParams();
  const [oauthStatus, setOauthStatus] = useState<OAuthStatus | null>(null);
  const [accounts, setAccounts] = useState<GbpAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const [statusRes, accountsRes] = await Promise.all([
        fetch("/api/oauth/google/status"),
        fetch("/api/gbp/accounts"),
      ]);
      const statusData = await statusRes.json();
      const accountsData = await accountsRes.json();
      setOauthStatus(statusData.data ?? { status: "disconnected" });
      setAccounts(accountsData.data?.accounts || []);
    } catch {
      setOauthStatus({ status: "disconnected" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (searchParams.get("oauth_success") === "true") {
      toast.success("Google アカウントを接続しました");
    }
    const error = searchParams.get("oauth_error");
    if (error) {
      const messages: Record<string, string> = {
        state_mismatch: "認証の検証に失敗しました。もう一度お試しください。",
        token_exchange_failed: "トークンの取得に失敗しました。",
        no_refresh_token: "リフレッシュトークンが取得できませんでした。",
      };
      toast.error(messages[error] || `OAuth エラー: ${error}`);
    }
  }, [searchParams]);

  const handleConnect = () => {
    window.location.href = "/api/oauth/google";
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/oauth/google/disconnect", {
        method: "POST",
      });
      if (res.ok) {
        toast.success("Google アカウントの接続を解除しました");
        await fetchStatus();
      } else {
        toast.error("接続解除に失敗しました");
      }
    } catch {
      toast.error("接続解除に失敗しました");
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Google Business Profile 連携</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          読み込み中...
        </CardContent>
      </Card>
    );
  }

  const isConnected = oauthStatus?.status === "connected";
  const isInvalid = oauthStatus?.status === "invalid";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Google Business Profile 連携</CardTitle>
        <CardDescription>
          Google アカウントを接続して、GBP のパフォーマンスデータやレビュー情報を自動取得します。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">ステータス:</span>
          {isConnected && (
            <Badge variant="default" className="bg-green-600">
              接続済み
            </Badge>
          )}
          {isInvalid && (
            <Badge variant="destructive">要再認証</Badge>
          )}
          {!isConnected && !isInvalid && (
            <Badge variant="secondary">未接続</Badge>
          )}
        </div>

        {isConnected && oauthStatus.email && (
          <p className="text-sm text-muted-foreground">
            接続アカウント: {oauthStatus.email}
          </p>
        )}

        {isConnected && accounts.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium">GBP アカウント:</p>
            <ul className="list-disc pl-5 text-sm text-muted-foreground">
              {accounts.map((a, i) => (
                <li key={a.gbpAccountId ?? i}>
                  {a.accountName || a.gbpAccountId}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-2">
          {isConnected ? (
            <>
              <Button variant="outline" onClick={handleConnect}>
                再接続
              </Button>
              <Button
                variant="destructive"
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                {disconnecting ? "解除中..." : "接続を解除"}
              </Button>
            </>
          ) : (
            <Button onClick={handleConnect}>
              Google アカウントを接続
            </Button>
          )}
        </div>

        {isInvalid && (
          <p className="text-sm text-destructive">
            トークンが無効です。「Google アカウントを接続」ボタンから再認証してください。
          </p>
        )}
      </CardContent>
    </Card>
  );
}
