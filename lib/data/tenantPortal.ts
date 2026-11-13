/**
 * ============================================================================
 * TENANT DATA ACCESS LAYER (/lib/data/tenantPortal.ts)
 * Reads data ONLY through the secure RPC get_my_stays() and preview_invite().
 * Tenants have NO direct table access to tenants/beds/rooms/pgs.
 * ============================================================================
 */

import { createClient } from "@/lib/supabase/client";
import { TenantStay } from "../types";

/**
 * Preview an invite by token (Public: can be called before sign-in)
 */
export async function previewTenantInvite(token: string): Promise<{
  tenant_name: string;
  pg_name: string;
  room: string;
  bed: string;
}> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("preview_invite", {
    p_token: token,
  });

  if (error || !data) {
    console.error("Preview invite error:", error);
    throw new Error(
      error?.message ||
      "This invite link is invalid or has expired. Please ask your PG owner for a new invite."
    );
  }

  return data as {
    tenant_name: string;
    pg_name: string;
    room: string;
    bed: string;
  };
}

/**
 * Claim an invite with token for currently signed-in user
 */
export async function claimTenantInvite(token: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("claim_invite", {
    p_token: token,
  });

  if (error) {
    console.error("Claim invite error:", error);
    throw new Error(
      error.message ||
      "Could not claim invite. Please verify your internet or ask your PG owner for a fresh invite."
    );
  }
}

/**
 * Fetch all stays for the signed-in tenant via get_my_stays() RPC
 */
export async function getMyStays(): Promise<TenantStay[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_my_stays");

  if (error) {
    console.error("Failed to fetch tenant stays:", error);
    throw new Error("Could not load your stay information. Please try again.");
  }

  const rows = (data as Record<string, unknown>[]) || [];
  return rows.map(normalizeStay);
}

type Obj = Record<string, unknown>;

/**
 * The database function and the page have used slightly different field names
 * (room vs room_name, attached_bathroom vs has_attached_bathroom, etc.).
 * This accepts either and always returns the shape the page expects.
 */
function normalizeStay(raw: Obj): TenantStay {
  const t = (raw.tenant ?? {}) as Obj;
  const s = (raw.stay ?? {}) as Obj;
  const p = (raw.pg ?? {}) as Obj;
  const rules = (p.rules ?? {}) as Obj;

  const num = (v: unknown): number => (v === null || v === undefined || v === "" ? 0 : Number(v));
  const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));

  const monthlyRent = s.monthly_rent ?? s.rent;

  return {
    tenant: {
      ...(t as object),
      id: str(t.id),
      full_name: str(t.full_name),
      phone: str(t.phone),
      status: t.status as TenantStay["tenant"]["status"],
    },
    stay: {
      ...(s as object),
      room_name: str(s.room_name ?? s.room),
      bed_name: str(s.bed_name ?? s.bed),
      floor_name: str(s.floor_name ?? s.floor),
      is_ac: Boolean(s.is_ac),
      has_attached_bathroom: Boolean(s.has_attached_bathroom ?? s.attached_bathroom),
      join_date: str(s.join_date ?? t.join_date),
      leave_date: (s.leave_date ?? t.leave_date ?? undefined) as string | undefined,
      rent: monthlyRent === null || monthlyRent === undefined ? (null as unknown as number) : num(monthlyRent),
      monthly_rent: monthlyRent === null || monthlyRent === undefined ? null : num(monthlyRent),
      deposit: num(s.deposit ?? p.deposit),
      maintenance: num(s.maintenance ?? p.maintenance),
      food_included: Boolean(s.food_included ?? p.food_included),
    } as TenantStay["stay"],
    pg: {
      ...(p as object),
      id: str(p.id),
      name: str(p.name),
      contact_phone: str(p.contact_phone),
      address: str(p.address),
      city: str(p.city),
      pincode: str(p.pincode),
      type: p.type as TenantStay["pg"]["type"],
      gate_timing: str(p.gate_timing ?? rules.gateTiming),
      visitor_policy: str(p.visitor_policy ?? rules.visitorPolicy),
      other_rules: str(p.other_rules ?? rules.otherRules),
      facilities: (p.facilities as string[]) ?? [],
    },
  };
}