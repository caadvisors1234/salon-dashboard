import { NextResponse } from "next/server";

export function apiSuccess<T>(data: T, options?: { status?: number; headers?: Record<string, string> }) {
  return NextResponse.json(
    { success: true, data },
    { status: options?.status, headers: options?.headers }
  );
}

export function apiError(message: string, status: number, headers?: Record<string, string>) {
  return NextResponse.json(
    { success: false, error: message },
    { status, headers }
  );
}
