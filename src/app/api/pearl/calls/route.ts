// ./src/app/api/pearl/calls/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ENV ${name}`);
  return v;
}

// Strict JSON type to avoid `any`
type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json };

// Client request body (what your UI sends)
interface CallsPostBody {
  outboundId: string;
  bearerToken: string;
  skip?: number;
  limit?: number;
  sortProp?: string;
  isAscending?: boolean;
  fromDate?: string;
  toDate?: string;

  statuses?: Array<number | string>;
  conversationStatuses?: Array<number | string>;
  searchInput?: string;
}

// Upstream payload (what NLPearl v2 expects)
// Based on: POST /v2/Pearl/{pearlId}/Calls
// Only these fields are supported: fromDate, toDate, skip, limit, statuses, search
interface UpstreamPayload {
  fromDate: string;
  toDate: string;
  skip: number;
  limit: number;
  statuses?: number[];
  search: string;
}

const toNumArray = (value: unknown): number[] =>
  Array.isArray(value)
    ? value
      .map((v) => (typeof v === "number" ? v : Number(v)))
      .filter((v) => Number.isFinite(v))
    : [];

/** Default date range: last 30 days */
function getDefaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  return { from: fmt(from), to: fmt(to) };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const raw = (await req.json()) as unknown;
    const body: Partial<CallsPostBody> =
      typeof raw === "object" && raw !== null ? (raw as Partial<CallsPostBody>) : {};

    const {
      outboundId,
      bearerToken,
      skip = 0,
      limit = 100,
      fromDate,
      toDate,
      statuses = [],
    } = body;

    if (!outboundId || !bearerToken) {
      return NextResponse.json(
        { error: "Missing outboundId or bearerToken" },
        { status: 400 },
      );
    }

    const base = requireEnv("NLPEARL_API_BASE_URL");
    const url = `${base}/Pearl/${encodeURIComponent(outboundId)}/Calls`;

    const statusArr = toNumArray(statuses);

    /** Normalize date to YYYY-MM-DD format */
    const normDate = (d: string): string => d.split("T")[0];

    // fromDate and toDate are REQUIRED by NLPearl v2
    const defaults = getDefaultDateRange();
    const payload: UpstreamPayload = {
      fromDate: normDate(fromDate || defaults.from),
      toDate: normDate(toDate || defaults.to),
      skip,
      limit,
      search: "",
    };

    if (statusArr.length > 0) payload.statuses = statusArr;

    console.log("[/api/pearl/calls] upstream URL:", url);
    console.log("[/api/pearl/calls] upstream payload:", JSON.stringify(payload));

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${String(bearerToken).replace(/^Bearer\s+/i, "")}`,
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const text = await res.text();

    console.log("[/api/pearl/calls] response status:", res.status, "body preview:", text.substring(0, 300));

    if (!res.ok) {
      console.error("[/api/pearl/calls] upstream error:", res.status, "body:", text);
    }

    let data: Json | { raw: string };
    try {
      data = JSON.parse(text) as Json;
    } catch {
      data = { raw: text };
    }

    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Proxy error";
    console.error("[/api/pearl/calls] proxy error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
