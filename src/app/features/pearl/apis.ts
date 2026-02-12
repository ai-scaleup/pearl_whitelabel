import type { CallsResponse, CallsFilters, CallDetails, UserData, CampaignData } from "./types";

const API_BASE = ""; // same-origin

// JSON-serializable type (avoids `any`)
type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json };

export async function apiGetUser(userId: string): Promise<UserData> {
  const res = await fetch(`/api/pearl/user/${encodeURIComponent(userId)}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`getUser failed ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function apiGetCampaignsByEmail(email: string): Promise<CampaignData[]> {
  const res = await fetch(`${API_BASE}/api/pearl/campaigns?email=${encodeURIComponent(email)}`, { cache: "no-store" });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`campaigns failed: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function apiListCalls(args: {
  outboundId: string;
  bearerToken: string;
  filters: CallsFilters;
}): Promise<CallsResponse> {
  const res = await fetch(`${API_BASE}/api/pearl/calls`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      outboundId: args.outboundId,
      bearerToken: args.bearerToken,
      ...args.filters,
    }),
  });
  if (!res.ok) throw new Error(`calls failed: ${res.status}`);
  return res.json();
}

export async function apiGetCallDetails(callId: string, bearerToken: string): Promise<CallDetails> {
  const res = await fetch(`${API_BASE}/api/pearl/call/${encodeURIComponent(callId)}`, {
    headers: { "x-bearer-token": bearerToken },
  });
  if (!res.ok) throw new Error(`call details failed: ${res.status}`);
  return res.json();
}

// ✅ no `any` here; return JSON-serializable shape
export async function apiValidateCredentials(bearerToken: string, outboundId: string): Promise<Json> {
  const res = await fetch(`${API_BASE}/api/pearl/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bearerToken, outboundId }),
  });
  if (!res.ok) throw new Error(`validate failed: ${res.status}`);
  const data = (await res.json()) as Json;
  return data;
}
