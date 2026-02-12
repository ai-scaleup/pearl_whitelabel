// ./src/app/api/pearl/user/[userId]/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ENV ${name}`);
  return v;
}

/** JSON-serializable type */
type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json };

function parseJsonSafe(text: string): Json {
  try {
    return JSON.parse(text) as Json;
  } catch {
    return { raw: text };
  }
}

/** Normalize "api/v1" (remove leading/trailing slashes) */
function cleanPrefix(p: string): string {
  return p.replace(/^\/+|\/+$/g, "");
}

export async function GET(
  _req: NextRequest,
  // Note: in recent Next.js types, `params` is a Promise you must await.
  context: { params: Promise<{ userId: string }> },
): Promise<NextResponse> {
  try {
    const { userId } = await context.params;

    if (!userId) {
      return NextResponse.json<{ error: string }>(
        { error: "Missing userId" },
        { status: 400 },
      );
    }

    const base = requireEnv("WHITE_LABEL_API_BASE_URL");
    // Use the new endpoint implemented in the backend: /users/oauth/:oauthId
    // We bypass the prefix since the backend controller has no global prefix
    const url = `${base}/users/oauth/${encodeURIComponent(userId)}`;

    const res = await fetch(url, {
      headers: { "Cache-Control": "no-cache" },
      cache: "no-store",
    });

    const text = await res.text();
    const data: Json = parseJsonSafe(text);

    return NextResponse.json<Json>(data, { status: res.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Proxy error";
    console.error("[/api/pearl/user/:userId] proxy error:", err);
    return NextResponse.json<{ error: string }>(
      { error: message },
      { status: 500 },
    );
  }
}
