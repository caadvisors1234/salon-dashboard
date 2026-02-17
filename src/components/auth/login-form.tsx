"use client";

import { useActionState } from "react";
import Image from "next/image";
import Link from "next/link";
import { login, type ActionResult } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const initialState: ActionResult = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="flex justify-center mb-2">
          <Image src="/logo.png" alt="Logo" width={64} height={64} className="h-16 w-16" />
        </div>
        <CardTitle className="text-2xl">GBP Performance Dashboard</CardTitle>
        <CardDescription>
          メールアドレスとパスワードでログイン
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          {state.error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {state.error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">メールアドレス</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="mail@example.com"
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">パスワード</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "ログイン中..." : "ログイン"}
          </Button>
          <div className="text-center">
            <Link
              href="/auth/reset-password"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              パスワードを忘れた方
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
