/**
 * ============================================================================
 * PG MANAGEMENT DATA LAYER (/lib/data/pgStore.ts)
 * Phase A2 & Tenant Management: Supabase backend with targeted single-table updates
 * ============================================================================
 */

import { createClient } from "@/lib/supabase/client";
import {
  PGProperty,
  Floor,
  Room,
  Bed,
  BedUpdates,
  BedStatus,
  Tenant,
  TenantStatus,
  WizardDraft,
} from "../types";
import { generateDemoPG, DemoTenantRecord } from "./demoData";
import { generateBedLabels } from "../utils";

const WIZARD_DRAFT_KEY = (ownerId: string) => `pgdesk_wizard_draft_${ownerId}`;
const FRIENDLY_SAVE_ERROR = "Could not save. Please check your internet and try again.";
const FRIENDLY_LOAD_ERROR = "Could not load data. Please check your internet and try again.";

// ============================================================
// HELPERS: Tenant normalization & database error mapping
// Converts empty/whitespace-only strings to null for restricted DB columns
// ============================================================

export function cleanEmptyToNull(val?: string | null): string | null {
  if (val === undefined || val === null) return null;
  const trimmed = val.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeGender(val?: string | null): "male" | "female" | "other" | null {
  const cleaned = cleanEmptyToNull(val);
  if (!cleaned) return null;
  const lower = cleaned.toLowerCase();
  if (lower === "male" || lower === "female" || lower === "other") {
    return lower;
  }
  return null;
}

export const VALID_ID_TYPES = [
  "aadhaar",
  "driving_license",
  "passport",
  "voter_id",
  "pan",
  "college_id",
  "company_id",
  "other",
] as const;

export type ValidIdType = (typeof VALID_ID_TYPES)[number];

export function normalizeIdType(val?: string | null): ValidIdType | null {
  const cleaned = cleanEmptyToNull(val);
  if (!cleaned) return null;
  const lower = cleaned.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

  if (lower === "aadhaar" || lower === "aadhaar_card") return "aadhaar";
  if (lower === "pan" || lower === "pan_card") return "pan";
  if (lower === "driving_license" || lower === "driving_licence") return "driving_license";
  if (lower === "voter_id" || lower === "voter") return "voter_id";
  if (lower === "passport") return "passport";
  if (
    lower === "college_id" ||
    lower === "student_id" ||
    lower === "college_student_id" ||
    lower.includes("college")
  ) {
    return "college_id";
  }
  if (
    lower === "company_id" ||
    lower === "work_id" ||
    lower === "employee_id" ||
    lower.includes("company")
  ) {
    return "company_id";
  }
  if (lower === "other" || lower === "other_id") return "other";

  if ((VALID_ID_TYPES as readonly string[]).includes(lower)) {
    return lower as ValidIdType;
  }
  return null;
}

export function normalizeIdLast4(val?: string | null): string | null {
  const cleaned = cleanEmptyToNull(val);
  if (!cleaned) return null;
  if (/^[a-zA-Z0-9]{4}$/.test(cleaned)) {
    return cleaned.toUpperCase();
  }
  return null;
}

export function normalizeAltPhone(val?: string | null): string | null {
  const cleaned = cleanEmptyToNull(val);
  if (!cleaned) return null;
  const digits = cleaned.replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}

export function mapTenantDatabaseError(err: any): string {
  if (!err) return FRIENDLY_SAVE_ERROR;

  const msg = (err.message || "").toLowerCase();
  const details = (err.details || "").toLowerCase();
  const hint = (err.hint || "").toLowerCase();
  const fullError = `${msg} ${details} ${hint} ${err.code || ""}`;

  // Check constraint violations (Postgres 23514)
  if (err.code === "23514" || fullError.includes("check constraint") || fullError.includes("23514")) {
    if (fullError.includes("gender")) {
      return "Please choose a valid gender.";
    }
    if (fullError.includes("id_type") || fullError.includes("idtype")) {
      return "Please choose a valid ID proof type.";
    }
    if (fullError.includes("id_last4") || fullError.includes("idlast4")) {
      return "ID last 4 must be exactly 4 letters or digits.";
    }
    if (fullError.includes("phone")) {
      return "Please enter a valid 10-digit mobile number.";
    }
    if (fullError.includes("status")) {
      return "Invalid tenant status selected.";
    }
    return "Some tenant details did not meet database validation rules. Please check the entered fields.";
  }

  // Unique index collision: active tenant on bed (Postgres 23505)
  if (err.code === "23505" || fullError.includes("unique_active_tenant_per_bed")) {
    return "This bed already has an active tenant. Please mark them as vacated before assigning a new tenant.";
  }

  // Not-null constraint violation (Postgres 23502)
  if (err.code === "23502" || fullError.includes("not-null") || fullError.includes("violates not-null")) {
    if (fullError.includes("full_name")) {
      return "Tenant full name is required.";
    }
    if (fullError.includes("phone")) {
      return "Tenant mobile number is required.";
    }
    if (fullError.includes("bed_id")) {
      return "Bed assignment is missing.";
    }
    return "Please fill in all required tenant details.";
  }

  if (err.code === "23503") {
    return "Invalid property or bed reference. Please refresh and try again.";
  }

  return FRIENDLY_SAVE_ERROR;
}

// ============================================================
// HELPERS: assemble Tenant & nested PGProperty from flat rows
// Converted every null from the database into undefined.
// ============================================================

export function assembleTenant(t: Record<string, unknown>): Tenant {
  return {
    id: t.id as string,
    ownerId: t.owner_id as string,
    bedId: t.bed_id as string,
    fullName: (t.full_name as string) || "",
    phone: (t.phone as string) || "",
    altContactName: (t.alt_contact_name as string | null) ?? undefined,
    altContactRelation: (t.alt_contact_relation as string | null) ?? undefined,
    altPhone: (t.alt_phone as string | null) ?? undefined,
    nativeAddress: (t.native_address as string | null) ?? undefined,
    idType: (t.id_type as string | null) ?? undefined,
    idLast4: (t.id_last4 as string | null) ?? undefined,
    gender: (t.gender as string | null) ?? undefined,
    occupation: (t.occupation as string | null) ?? undefined,
    joinDate: (t.join_date as string) || new Date().toISOString().split("T")[0],
    leaveDate: (t.leave_date as string | null) ?? undefined,
    status: (t.status as TenantStatus) || "active",
    userId: (t.user_id as string | null) ?? undefined,
    consentAt: (t.consent_at as string | null) ?? undefined,
    createdAt: (t.created_at as string | null) ?? undefined,
    updatedAt: (t.updated_at as string | null) ?? undefined,
  };
}

function assembleRows(
  pgRow: Record<string, unknown>,
  floorRows: Record<string, unknown>[],
  roomRows: Record<string, unknown>[],
  bedRows: Record<string, unknown>[],
  tenantRows: Record<string, unknown>[] = []
): PGProperty {
  const beds: Bed[] = bedRows.map((b) => {
    // Find active or notice tenant for this bed (source of truth is tenants table)
    const bedId = b.id as string;
    const matchingTenantRow = tenantRows.find(
      (t) =>
        t.bed_id === bedId &&
        (t.status === "active" || t.status === "notice" || t.status === "reserved")
    );
    const tenant = matchingTenantRow ? assembleTenant(matchingTenantRow) : undefined;

    return {
      id: bedId,
      roomId: b.room_id as string,
      name: (b.name as string) || "",
      status: (b.status as BedStatus) || "vacant",
      customRent:
        b.custom_rent !== null && b.custom_rent !== undefined
          ? Number(b.custom_rent)
          : undefined,
      tenant,
      tenantName: tenant ? tenant.fullName : undefined,
      tenantPhone: tenant ? tenant.phone : undefined,
      notes: (b.notes as string | null) ?? undefined,
      updatedAt:
        (b.updated_at as string) ||
        (b.created_at as string) ||
        new Date().toISOString(),
    };
  });

  const rooms: Room[] = roomRows.map((r) => ({
    id: r.id as string,
    floorId: r.floor_id as string,
    name: (r.name as string) || "",
    sharingType: (r.sharing_type as number) || 2,
    isAc: Boolean(r.is_ac),
    hasAttachedBathroom: Boolean(r.has_attached_bathroom),
    amenities: Array.isArray(r.amenities) ? (r.amenities as string[]) : [],
    customRent:
      r.custom_rent !== null && r.custom_rent !== undefined
        ? Number(r.custom_rent)
        : undefined,
    beds: beds.filter((b) => b.roomId === (r.id as string)),
  }));

  const floors: Floor[] = floorRows
    .sort((a, b) => ((a.order as number) || 0) - ((b.order as number) || 0))
    .map((f) => ({
      id: f.id as string,
      name: (f.name as string) || "",
      order: (f.order as number) || 1,
      rooms: rooms.filter((r) => r.floorId === (f.id as string)),
    }));

  const pricingData = (pgRow.pricing as Record<string, unknown>) || {};

  return {
    id: pgRow.id as string,
    owner_id: pgRow.owner_id as string,
    name: (pgRow.name as string) || "",
    logoUrl: (pgRow.logo_url as string | null) ?? undefined,
    contactPhone: (pgRow.contact_phone as string) || "",
    address: (pgRow.address as string) || "",
    city: (pgRow.city as string) || "Bengaluru",
    pincode: (pgRow.pincode as string) || "",
    type: (pgRow.type as PGProperty["type"]) || "coliving",
    rules: (pgRow.rules as PGProperty["rules"]) || {
      gateTiming: "",
      visitorPolicy: "",
      noticePeriodDays: 30,
      otherRules: "",
    },
    facilities: Array.isArray(pgRow.facilities)
      ? (pgRow.facilities as string[])
      : [],
    pricing: {
      deposit: Number(pricingData.deposit) || 0,
      maintenance: Number(pricingData.maintenance) || 0,
      foodIncluded: Boolean(pricingData.foodIncluded),
      roomTypeRent: (pricingData.roomTypeRent as Record<number, number>) || {},
      acRoomTypeRent:
        pricingData.acRoomTypeRent !== undefined && pricingData.acRoomTypeRent !== null
          ? (pricingData.acRoomTypeRent as Record<number, number>)
          : undefined,
    },
    floors,
    createdAt: (pgRow.created_at as string) || new Date().toISOString(),
    updatedAt:
      (pgRow.updated_at as string) ||
      (pgRow.created_at as string) ||
      new Date().toISOString(),
  };
}

async function fetchFullPG(pgId: string, ownerId: string): Promise<PGProperty | null> {
  const supabase = createClient();

  const [
    { data: pgRow, error: pgError },
    { data: floorRows, error: flError },
    { data: roomRows, error: rmError },
    { data: bedRows, error: bdError },
    { data: tenantRows, error: tnError },
  ] = await Promise.all([
    supabase.from("pgs").select("*").eq("id", pgId).eq("owner_id", ownerId).maybeSingle(),
    supabase.from("floors").select("*").eq("pg_id", pgId).eq("owner_id", ownerId),
    supabase.from("rooms").select("*").eq("pg_id", pgId).eq("owner_id", ownerId),
    supabase.from("beds").select("*").eq("pg_id", pgId).eq("owner_id", ownerId),
    supabase
      .from("tenants")
      .select("*")
      .eq("owner_id", ownerId)
      .in("status", ["active", "notice", "reserved"]),
  ]);

  if (pgError) {
    console.error("Failed to fetch PG:", pgError);
    throw new Error(FRIENDLY_LOAD_ERROR);
  }
  if (flError || rmError || bdError || tnError) {
    console.error("Failed to fetch PG child details:", flError || rmError || bdError || tnError);
    throw new Error(FRIENDLY_LOAD_ERROR);
  }
  if (!pgRow) return null;

  return assembleRows(
    pgRow as Record<string, unknown>,
    (floorRows || []) as Record<string, unknown>[],
    (roomRows || []) as Record<string, unknown>[],
    (bedRows || []) as Record<string, unknown>[],
    (tenantRows || []) as Record<string, unknown>[]
  );
}

// ============================================================
// PUBLIC API: READ OPERATIONS
// ============================================================

export async function getPGs(ownerId: string): Promise<PGProperty[]> {
  const supabase = createClient();
  const { data: pgRows, error: pgError } = await supabase
    .from("pgs")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });

  if (pgError) {
    console.error("Failed to fetch PGs:", pgError);
    throw new Error(FRIENDLY_LOAD_ERROR);
  }

  if (!pgRows || pgRows.length === 0) return [];

  const [
    { data: allFloors, error: flError },
    { data: allRooms, error: rmError },
    { data: allBeds, error: bdError },
    { data: allTenants, error: tnError },
  ] = await Promise.all([
    supabase.from("floors").select("*").eq("owner_id", ownerId),
    supabase.from("rooms").select("*").eq("owner_id", ownerId),
    supabase.from("beds").select("*").eq("owner_id", ownerId),
    supabase
      .from("tenants")
      .select("*")
      .eq("owner_id", ownerId)
      .in("status", ["active", "notice", "reserved"]),
  ]);

  if (flError || rmError || bdError || tnError) {
    console.error("Failed to fetch child data for PGs:", flError || rmError || bdError || tnError);
    throw new Error(FRIENDLY_LOAD_ERROR);
  }

  const tenantList = (allTenants || []) as Record<string, unknown>[];

  return (pgRows as Array<Record<string, unknown>>).map((pgRow) =>
    assembleRows(
      pgRow,
      ((allFloors || []) as Record<string, unknown>[]).filter((f) => f.pg_id === pgRow.id),
      ((allRooms || []) as Record<string, unknown>[]).filter((r) => r.pg_id === pgRow.id),
      ((allBeds || []) as Record<string, unknown>[]).filter((b) => b.pg_id === pgRow.id),
      tenantList
    )
  );
}

export async function getPGById(ownerId: string, pgId: string): Promise<PGProperty | null> {
  return fetchFullPG(pgId, ownerId);
}

// ============================================================
// PUBLIC API: TENANT OPERATIONS (Single Source of Truth)
// ============================================================

export async function getTenantForBed(
  ownerId: string,
  bedId: string
): Promise<Tenant | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tenants")
    .select("*")
    .eq("bed_id", bedId)
    .eq("owner_id", ownerId)
    .in("status", ["active", "notice", "reserved"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch tenant for bed:", error);
    throw new Error("Could not load tenant details. Please check your internet and try again.");
  }

  if (!data) return null;
  return assembleTenant(data as Record<string, unknown>);
}

export async function saveTenant(
  ownerId: string,
  pgId: string,
  bedId: string,
  tenantData: {
    id?: string;
    fullName: string;
    phone: string;
    altContactName?: string;
    altContactRelation?: string;
    altPhone?: string;
    nativeAddress?: string;
    idType?: string;
    idLast4?: string;
    gender?: string;
    occupation?: string;
    joinDate?: string;
    leaveDate?: string;
    status?: TenantStatus;
  }
): Promise<{ tenant: Tenant; pg: PGProperty }> {
  const supabase = createClient();
  const targetTenantStatus: TenantStatus = tenantData.status || "active";
  const targetBedStatus: BedStatus =
    targetTenantStatus === "notice" ? "notice" : "occupied";

  // Normalize all fields before sending to Supabase
  // Empty or whitespace-only strings are converted to null
  const normalizedGender = normalizeGender(tenantData.gender);
  const normalizedIdType = normalizeIdType(tenantData.idType);
  const normalizedIdLast4 = normalizeIdLast4(tenantData.idLast4);
  const normalizedOccupation = cleanEmptyToNull(tenantData.occupation);
  const normalizedNativeAddress = cleanEmptyToNull(tenantData.nativeAddress);
  const normalizedAltContactName = cleanEmptyToNull(tenantData.altContactName);
  const normalizedAltContactRelation = cleanEmptyToNull(tenantData.altContactRelation);
  const normalizedAltPhone = normalizeAltPhone(tenantData.altPhone);
  const normalizedLeaveDate = cleanEmptyToNull(tenantData.leaveDate);

  if (tenantData.id) {
    // 1. Updating an existing tenant
    const normalizedJoinDate = cleanEmptyToNull(tenantData.joinDate);
    const updatePayload: Record<string, unknown> = {
      full_name: tenantData.fullName.trim(),
      phone: tenantData.phone.replace(/\D/g, ""),
      alt_contact_name: normalizedAltContactName,
      alt_contact_relation: normalizedAltContactRelation,
      alt_phone: normalizedAltPhone,
      native_address: normalizedNativeAddress,
      id_type: normalizedIdType,
      gender: normalizedGender,
      occupation: normalizedOccupation,
      status: targetTenantStatus,
      leave_date: normalizedLeaveDate,
    };
    // id_last4 is set by the secure set_tenant_id_number function.
    // Only overwrite it here if the caller explicitly provided one;
    // otherwise saving a tenant must NOT wipe the stored last-4 digits.
    if (normalizedIdLast4 !== null) {
      updatePayload.id_last4 = normalizedIdLast4;
    }
    if (normalizedJoinDate !== null) {
      updatePayload.join_date = normalizedJoinDate;
    }

    const { data: updatedRow, error: tenantErr } = await supabase
      .from("tenants")
      .update(updatePayload)
      .eq("id", tenantData.id)
      .eq("owner_id", ownerId)
      .select()
      .single();

    if (tenantErr || !updatedRow) {
      console.error("Failed to update tenant:", tenantErr);
      throw new Error(mapTenantDatabaseError(tenantErr));
    }

    // Bed status is synced automatically by DB trigger (trigger_sync_bed_status_from_tenant).
    // No manual bed update needed here.

    const fresh = await fetchFullPG(pgId, ownerId);
    if (!fresh) throw new Error("Could not reload property.");
    return { tenant: assembleTenant(updatedRow as Record<string, unknown>), pg: fresh };
  } else {
    // 2. Assigning a new tenant to a bed
    const tenantId = crypto.randomUUID();
    const normalizedJoinDate =
      cleanEmptyToNull(tenantData.joinDate) ||
      new Date().toISOString().split("T")[0];

    const { data: newTenantRow, error: insertErr } = await supabase
      .from("tenants")
      .insert({
        id: tenantId,
        owner_id: ownerId,
        pg_id: pgId,
        bed_id: bedId,
        full_name: tenantData.fullName.trim(),
        phone: tenantData.phone.replace(/\D/g, ""),
        alt_contact_name: normalizedAltContactName,
        alt_contact_relation: normalizedAltContactRelation,
        alt_phone: normalizedAltPhone,
        native_address: normalizedNativeAddress,
        id_type: normalizedIdType,
        id_last4: normalizedIdLast4,
        gender: normalizedGender,
        occupation: normalizedOccupation,
        join_date: normalizedJoinDate,
        leave_date: normalizedLeaveDate,
        status: targetTenantStatus,
      })
      .select()
      .single();

    if (insertErr || !newTenantRow) {
      console.error("Failed to insert tenant:", insertErr);
      throw new Error(mapTenantDatabaseError(insertErr));
    }

    // Bed status is synced automatically by DB trigger (trigger_sync_bed_status_from_tenant).
    // No manual bed update needed here.

    const fresh = await fetchFullPG(pgId, ownerId);
    if (!fresh) throw new Error("Could not reload property.");
    return { tenant: assembleTenant(newTenantRow as Record<string, unknown>), pg: fresh };
  }
}

export async function vacateTenant(
  ownerId: string,
  pgId: string,
  bedId: string,
  tenantId: string
): Promise<PGProperty> {
  const supabase = createClient();
  const today = new Date().toISOString().split("T")[0];

  // 1. Mark tenant status as 'left' with leave_date today
  const { error: tenantErr } = await supabase
    .from("tenants")
    .update({
      status: "left",
      leave_date: today,
    })
    .eq("id", tenantId)
    .eq("owner_id", ownerId);

  if (tenantErr) {
    console.error("Failed to mark tenant as left:", tenantErr);
    throw new Error(mapTenantDatabaseError(tenantErr));
  }

  // Bed status is set to 'vacant' automatically by DB trigger (trigger_sync_bed_status_from_tenant).
  // No manual bed update needed here.

  const fresh = await fetchFullPG(pgId, ownerId);
  if (!fresh) throw new Error("Property not found.");
  return fresh;
}

// ============================================================
// TENANT INVITE & ACCESS OPERATIONS
// ============================================================

export async function getTenantInviteStatus(
  tenantId: string,
  _tenantUserId?: string
): Promise<{ status: "not_invited" | "invited" | "joined" | "expired"; expiresAt?: string }> {
  const supabase = createClient();

  // "Joined" means the tenant is CURRENTLY linked to a Google account.
  // Always read this from the database (the screen's saved copy can be out of date,
  // for example right after "Reset access").
  const { data: tenantRow, error: tenantErr } = await supabase
    .from("tenants")
    .select("user_id")
    .eq("id", tenantId)
    .maybeSingle();

  if (tenantErr) {
    console.error("Failed to read tenant access:", tenantErr);
  }
  if (tenantRow?.user_id) {
    return { status: "joined" };
  }

  const { data: invite, error } = await supabase
    .from("tenant_invites")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Failed to read invite status:", error);
    return { status: "not_invited" };
  }
  if (!invite) {
    return { status: "not_invited" };
  }

  // Works with both layouts: a "status" column, or used_at / revoked_at columns.
  const row = invite as Record<string, unknown>;
  const used = row.status === "claimed" || !!row.used_at || !!row.claimed_at;
  const revoked = row.status === "revoked" || !!row.revoked_at;
  const expiresAtStr = row.expires_at as string;

  // A used invite with no linked account means access was reset or the tenant left.
  if (used || revoked) return { status: "not_invited" };
  if (new Date(expiresAtStr) > new Date()) {
    return { status: "invited", expiresAt: expiresAtStr };
  }
  return { status: "expired" };
}

export async function createTenantInviteToken(tenantId: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("create_tenant_invite", {
    p_tenant_id: tenantId,
  });

  if (error || !data) {
    console.error("Failed to create tenant invite:", error);
    throw new Error(error?.message || "Could not generate invite code. Please try again.");
  }

  return data as string;
}

export async function resetTenantAccess(tenantId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("reset_tenant_access", {
    p_tenant_id: tenantId,
  });

  if (error) {
    console.error("Failed to reset tenant access:", error);
    throw new Error(error.message || "Could not reset tenant access. Please try again.");
  }
}


// ============================================================
// PUBLIC API: PROPERTY-LEVEL WRITE OPERATIONS
// ============================================================

export async function createPG(
  ownerId: string,
  pgData: Omit<PGProperty, "id" | "owner_id" | "createdAt" | "updatedAt">
): Promise<PGProperty> {
  const supabase = createClient();
  const pgId = crypto.randomUUID();

  // 1. Insert PG property row
  const { error: pgError } = await supabase.from("pgs").insert({
    id: pgId,
    owner_id: ownerId,
    name: pgData.name,
    logo_url: pgData.logoUrl ?? null,
    contact_phone: pgData.contactPhone,
    address: pgData.address,
    city: pgData.city,
    pincode: pgData.pincode,
    type: pgData.type,
    rules: pgData.rules,
    facilities: pgData.facilities,
    pricing: pgData.pricing,
  });
  if (pgError) {
    console.error("Failed to insert PG:", pgError);
    throw new Error(FRIENDLY_SAVE_ERROR);
  }

  // 2. Insert floors, rooms, and beds
  for (const floor of pgData.floors) {
    const floorId = floor.id && floor.id.includes("-") ? floor.id : crypto.randomUUID();
    const { error: floorError } = await supabase.from("floors").insert({
      id: floorId,
      pg_id: pgId,
      owner_id: ownerId,
      name: floor.name,
      order: floor.order,
    });
    if (floorError) {
      console.error("Failed to insert floor:", floorError);
      throw new Error(FRIENDLY_SAVE_ERROR);
    }

    for (const room of floor.rooms) {
      const roomId = room.id && room.id.includes("-") ? room.id : crypto.randomUUID();
      const { error: roomError } = await supabase.from("rooms").insert({
        id: roomId,
        pg_id: pgId,
        floor_id: floorId,
        owner_id: ownerId,
        name: room.name,
        sharing_type: room.sharingType,
        is_ac: room.isAc,
        has_attached_bathroom: room.hasAttachedBathroom,
        amenities: room.amenities,
        custom_rent:
          room.customRent !== undefined && room.customRent !== null
            ? Math.max(0, room.customRent)
            : null,
      });
      if (roomError) {
        console.error("Failed to insert room:", roomError);
        throw new Error(FRIENDLY_SAVE_ERROR);
      }

      if (room.beds.length > 0) {
        // Stop writing tenant_name and tenant_phone to beds table!
        const bedsToInsert = room.beds.map((bed) => ({
          id: bed.id && bed.id.includes("-") ? bed.id : crypto.randomUUID(),
          pg_id: pgId,
          floor_id: floorId,
          room_id: roomId,
          owner_id: ownerId,
          name: bed.name,
          status: bed.status || "vacant",
          custom_rent:
            bed.customRent !== undefined && bed.customRent !== null
              ? Math.max(0, bed.customRent)
              : null,
          notes: bed.notes || null,
        }));

        const { error: bedError } = await supabase.from("beds").insert(bedsToInsert);
        if (bedError) {
          console.error("Failed to insert beds:", bedError);
          throw new Error(FRIENDLY_SAVE_ERROR);
        }
      }
    }
  }

  const fresh = await fetchFullPG(pgId, ownerId);
  if (!fresh) throw new Error("Could not load newly created property.");
  return fresh;
}

export async function updatePG(ownerId: string, pg: PGProperty): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("pgs")
    .update({
      name: pg.name,
      logo_url: pg.logoUrl ?? null,
      contact_phone: pg.contactPhone,
      address: pg.address,
      city: pg.city,
      pincode: pg.pincode,
      type: pg.type,
      rules: pg.rules,
      facilities: pg.facilities,
      pricing: pg.pricing,
    })
    .eq("id", pg.id)
    .eq("owner_id", ownerId);

  if (error) {
    console.error("Failed to update PG details:", error);
    throw new Error(FRIENDLY_SAVE_ERROR);
  }
}

export async function deletePG(ownerId: string, pgId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("pgs")
    .delete()
    .eq("id", pgId)
    .eq("owner_id", ownerId);

  if (error) {
    console.error("Failed to delete PG:", error);
    throw new Error("Could not delete property. Please check your internet and try again.");
  }
}

export async function loadDemoPG(ownerId: string): Promise<PGProperty> {
  const { pg: demo, tenants: demoTenants } = generateDemoPG(ownerId);
  const created = await createPG(ownerId, demo);

  // Insert demo tenants directly into the public.tenants table
  if (demoTenants.length > 0) {
    const supabase = createClient();
    const normalizedDemoTenants = demoTenants.map((t) => ({
      ...t,
      gender: normalizeGender(t.gender),
      id_type: normalizeIdType(t.id_type),
      id_last4: normalizeIdLast4(t.id_last4),
      occupation: cleanEmptyToNull(t.occupation),
      native_address: cleanEmptyToNull(t.native_address),
      alt_contact_name: cleanEmptyToNull(t.alt_contact_name),
      alt_contact_relation: cleanEmptyToNull(t.alt_contact_relation),
      alt_phone: normalizeAltPhone(t.alt_phone),
    }));
    const { error: tenantInsertErr } = await supabase
      .from("tenants")
      .insert(normalizedDemoTenants);

    if (tenantInsertErr) {
      console.error("Failed to insert demo tenants into tenants table:", tenantInsertErr);
    }
  }

  const fresh = await fetchFullPG(created.id, ownerId);
  return fresh || created;
}

// ============================================================
// PUBLIC API: TARGETED BED OPERATIONS (Single-Row Updates)
// ============================================================

export async function updateBedStatus(
  ownerId: string,
  pgId: string,
  bedId: string,
  status: BedStatus,
  notes?: string
): Promise<PGProperty> {
  const supabase = createClient();

  // If status is changed to vacant, also vacate any active/notice tenant
  if (status === "vacant") {
    const existingTenant = await getTenantForBed(ownerId, bedId);
    if (existingTenant) {
      return vacateTenant(ownerId, pgId, bedId, existingTenant.id);
    }
  }

  // If status changed to notice or occupied, keep tenant status in sync
  if (status === "notice" || status === "occupied") {
    const existingTenant = await getTenantForBed(ownerId, bedId);
    if (existingTenant) {
      const newTenantStatus: TenantStatus = status === "notice" ? "notice" : "active";
      const { error: syncErr } = await supabase
        .from("tenants")
        .update({ status: newTenantStatus })
        .eq("id", existingTenant.id)
        .eq("owner_id", ownerId);

      if (syncErr) {
        console.error("Failed to sync tenant status with bed status:", syncErr);
        throw new Error(mapTenantDatabaseError(syncErr));
      }
    }
  }

  const updatePayload: Record<string, unknown> = { status };
  if (notes !== undefined) {
    updatePayload.notes = notes.trim() || null;
  }

  const { error } = await supabase
    .from("beds")
    .update(updatePayload)
    .eq("id", bedId)
    .eq("owner_id", ownerId);

  if (error) {
    console.error("Failed to update bed status:", error);
    throw new Error(FRIENDLY_SAVE_ERROR);
  }

  const fresh = await fetchFullPG(pgId, ownerId);
  if (!fresh) throw new Error("Property not found.");
  return fresh;
}

export async function updateBedDetails(
  ownerId: string,
  pgId: string,
  bedId: string,
  updates: BedUpdates
): Promise<PGProperty> {
  const supabase = createClient();

  const updatePayload: Record<string, unknown> = {};
  if (updates.name !== undefined && updates.name.trim()) {
    updatePayload.name = updates.name.trim();
  }
  if (updates.status !== undefined) {
    updatePayload.status = updates.status;
  }
  if (updates.customRent !== undefined) {
    updatePayload.custom_rent =
      updates.customRent !== null && updates.customRent !== undefined
        ? Math.max(0, updates.customRent)
        : null;
  }
  if (updates.notes !== undefined) {
    updatePayload.notes =
      updates.notes === null ? null : updates.notes.trim() || null;
  }

  if (Object.keys(updatePayload).length > 0) {
    const { error } = await supabase
      .from("beds")
      .update(updatePayload)
      .eq("id", bedId)
      .eq("owner_id", ownerId);

    if (error) {
      console.error("Failed to update bed details:", error);
      throw new Error(FRIENDLY_SAVE_ERROR);
    }
  }

  const fresh = await fetchFullPG(pgId, ownerId);
  if (!fresh) throw new Error("Property not found.");
  return fresh;
}

export async function deleteBed(
  ownerId: string,
  pgId: string,
  bedId: string
): Promise<PGProperty> {
  const supabase = createClient();

  const { data: bed, error: bedError } = await supabase
    .from("beds")
    .select("*")
    .eq("id", bedId)
    .eq("owner_id", ownerId)
    .single();

  if (bedError || !bed) {
    console.error("Failed to find bed for deletion:", bedError);
    throw new Error("Bed not found or could not be verified.");
  }

  if (
    bed.status === "occupied" ||
    bed.status === "notice" ||
    bed.status === "reserved"
  ) {
    throw new Error("Cannot delete bed while it has an active tenant or reservation.");
  }

  const { data: roomBeds, error: roomBedsErr } = await supabase
    .from("beds")
    .select("id")
    .eq("room_id", bed.room_id)
    .eq("owner_id", ownerId);

  if (roomBedsErr || !roomBeds) {
    console.error("Failed to count room beds:", roomBedsErr);
    throw new Error("Could not verify room capacity.");
  }

  if (roomBeds.length <= 1) {
    throw new Error("A room must have at least one bed. Delete the whole room instead.");
  }

  const { error: delBedErr } = await supabase
    .from("beds")
    .delete()
    .eq("id", bedId)
    .eq("owner_id", ownerId);

  if (delBedErr) {
    console.error("Failed to delete bed:", delBedErr);
    throw new Error(FRIENDLY_SAVE_ERROR);
  }

  const newSharingCount = roomBeds.length - 1;
  const { error: updateRoomErr } = await supabase
    .from("rooms")
    .update({ sharing_type: newSharingCount })
    .eq("id", bed.room_id)
    .eq("owner_id", ownerId);

  if (updateRoomErr) {
    console.error("Failed to update room sharing count after bed deletion:", updateRoomErr);
    throw new Error("Could not update room sharing count.");
  }

  const fresh = await fetchFullPG(pgId, ownerId);
  if (!fresh) throw new Error("Property not found.");
  return fresh;
}

// ============================================================
// PUBLIC API: TARGETED ROOM OPERATIONS (Single-Room Updates)
// ============================================================

export async function updateRoomDetails(
  ownerId: string,
  pgId: string,
  roomId: string,
  updates: {
    name?: string;
    sharingType?: number;
    isAc?: boolean;
    hasAttachedBathroom?: boolean;
    amenities?: string[];
    customRent?: number | null;
  }
): Promise<PGProperty> {
  const supabase = createClient();

  const [
    { data: roomRow, error: roomFetchErr },
    { data: existingBeds, error: bedsFetchErr },
  ] = await Promise.all([
    supabase
      .from("rooms")
      .select("*")
      .eq("id", roomId)
      .eq("owner_id", ownerId)
      .single(),
    supabase
      .from("beds")
      .select("*")
      .eq("room_id", roomId)
      .eq("owner_id", ownerId)
      .order("name", { ascending: true }),
  ]);

  if (roomFetchErr || !roomRow) {
    console.error("Room fetch failed:", roomFetchErr);
    throw new Error("Could not find room. Please check your internet and try again.");
  }
  if (bedsFetchErr) {
    console.error("Beds fetch failed:", bedsFetchErr);
    throw new Error("Could not verify room beds. Please check your internet and try again.");
  }

  const roomPayload: Record<string, unknown> = {};
  if (updates.name !== undefined && updates.name.trim()) {
    roomPayload.name = updates.name.trim();
  }
  if (updates.isAc !== undefined) {
    roomPayload.is_ac = updates.isAc;
  }
  if (updates.hasAttachedBathroom !== undefined) {
    roomPayload.has_attached_bathroom = updates.hasAttachedBathroom;
  }
  if (updates.amenities !== undefined) {
    roomPayload.amenities = updates.amenities;
  }
  if (updates.customRent !== undefined) {
    roomPayload.custom_rent =
      updates.customRent !== null && updates.customRent !== undefined
        ? Math.max(0, updates.customRent)
        : null;
  }

  if (
    updates.sharingType !== undefined &&
    updates.sharingType !== roomRow.sharing_type
  ) {
    const newCount = updates.sharingType;
    if (newCount < 1 || newCount > 8) {
      throw new Error("Sharing count must be between 1 and 8 beds.");
    }
    const currentCount = existingBeds ? existingBeds.length : 0;

    if (newCount > currentCount) {
      const labels = generateBedLabels(newCount);
      const newBedsToInsert = [];
      for (let i = currentCount; i < newCount; i++) {
        newBedsToInsert.push({
          id: crypto.randomUUID(),
          pg_id: pgId,
          floor_id: roomRow.floor_id,
          room_id: roomId,
          owner_id: ownerId,
          name: labels[i] || `Bed ${i + 1}`,
          status: "vacant",
        });
      }
      const { error: insertBedsError } = await supabase
        .from("beds")
        .insert(newBedsToInsert);
      if (insertBedsError) {
        console.error("Failed to insert new beds:", insertBedsError);
        throw new Error(FRIENDLY_SAVE_ERROR);
      }
    } else if (newCount < currentCount && existingBeds) {
      const bedsToRemove = (existingBeds as Array<Record<string, unknown>>).slice(newCount);
      const hasActive = bedsToRemove.some(
        (b) =>
          b.status === "occupied" ||
          b.status === "notice" ||
          b.status === "reserved"
      );
      if (hasActive) {
        throw new Error(
          "Cannot reduce sharing because an extra bed currently has an active tenant or reservation."
        );
      }

      const idsToDelete = bedsToRemove.map((b) => b.id as string);
      const { error: deleteBedsError } = await supabase
        .from("beds")
        .delete()
        .in("id", idsToDelete)
        .eq("owner_id", ownerId);

      if (deleteBedsError) {
        console.error("Failed to delete extra beds from database:", deleteBedsError);
        throw new Error(FRIENDLY_SAVE_ERROR);
      }
    }

    roomPayload.sharing_type = newCount;
  }

  if (Object.keys(roomPayload).length > 0) {
    const { error: updateRoomErr } = await supabase
      .from("rooms")
      .update(roomPayload)
      .eq("id", roomId)
      .eq("owner_id", ownerId);

    if (updateRoomErr) {
      console.error("Failed to update room:", updateRoomErr);
      throw new Error(FRIENDLY_SAVE_ERROR);
    }
  }

  const fresh = await fetchFullPG(pgId, ownerId);
  if (!fresh) throw new Error("Property not found.");
  return fresh;
}

export async function renameRoom(
  ownerId: string,
  pgId: string,
  roomId: string,
  newName: string
): Promise<PGProperty> {
  const supabase = createClient();
  const { error } = await supabase
    .from("rooms")
    .update({ name: newName.trim() })
    .eq("id", roomId)
    .eq("owner_id", ownerId);

  if (error) {
    console.error("Failed to rename room:", error);
    throw new Error(FRIENDLY_SAVE_ERROR);
  }

  const fresh = await fetchFullPG(pgId, ownerId);
  if (!fresh) throw new Error("Property not found.");
  return fresh;
}

export async function changeRoomSharing(
  ownerId: string,
  pgId: string,
  roomId: string,
  newSharingCount: number
): Promise<PGProperty> {
  return updateRoomDetails(ownerId, pgId, roomId, { sharingType: newSharingCount });
}

export async function addRoom(
  ownerId: string,
  pgId: string,
  floorId: string,
  roomData: {
    name: string;
    sharingType: number;
    isAc: boolean;
    hasAttachedBathroom: boolean;
    amenities?: string[];
    customRent?: number;
  }
): Promise<PGProperty> {
  const supabase = createClient();
  const roomId = crypto.randomUUID();

  const { error: roomError } = await supabase.from("rooms").insert({
    id: roomId,
    pg_id: pgId,
    floor_id: floorId,
    owner_id: ownerId,
    name: roomData.name.trim(),
    sharing_type: roomData.sharingType,
    is_ac: roomData.isAc,
    has_attached_bathroom: roomData.hasAttachedBathroom,
    amenities: roomData.amenities || ["cot", "mattress", "cupboard"],
    custom_rent:
      roomData.customRent !== undefined && roomData.customRent !== null
        ? Math.max(0, roomData.customRent)
        : null,
  });

  if (roomError) {
    console.error("Failed to add room:", roomError);
    throw new Error(FRIENDLY_SAVE_ERROR);
  }

  const labels = generateBedLabels(roomData.sharingType);
  const bedsToInsert = labels.map((label) => ({
    id: crypto.randomUUID(),
    pg_id: pgId,
    floor_id: floorId,
    room_id: roomId,
    owner_id: ownerId,
    name: label,
    status: "vacant",
  }));

  const { error: bedsError } = await supabase.from("beds").insert(bedsToInsert);
  if (bedsError) {
    console.error("Failed to insert beds for new room:", bedsError);
    throw new Error(FRIENDLY_SAVE_ERROR);
  }

  const fresh = await fetchFullPG(pgId, ownerId);
  if (!fresh) throw new Error("Property not found.");
  return fresh;
}

export async function deleteRoom(
  ownerId: string,
  pgId: string,
  roomId: string
): Promise<PGProperty> {
  const supabase = createClient();

  const { data: beds, error: bedsError } = await supabase
    .from("beds")
    .select("status")
    .eq("room_id", roomId)
    .eq("owner_id", ownerId);

  if (bedsError) {
    console.error("Failed to check room beds:", bedsError);
    throw new Error("Could not verify room. Please check your internet and try again.");
  }

  const hasActive = ((beds as Array<Record<string, unknown>>) || []).some(
    (b) =>
      b.status === "occupied" ||
      b.status === "notice" ||
      b.status === "reserved"
  );
  if (hasActive) {
    throw new Error(
      "Cannot delete room: this room currently has active tenants or reservations. Please relocate or check them out first."
    );
  }

  const { error: delBedsErr } = await supabase
    .from("beds")
    .delete()
    .eq("room_id", roomId)
    .eq("owner_id", ownerId);

  if (delBedsErr) {
    console.error("Failed to delete room beds:", delBedsErr);
    throw new Error(FRIENDLY_SAVE_ERROR);
  }

  const { error: delRoomErr } = await supabase
    .from("rooms")
    .delete()
    .eq("id", roomId)
    .eq("owner_id", ownerId);

  if (delRoomErr) {
    console.error("Failed to delete room:", delRoomErr);
    throw new Error(FRIENDLY_SAVE_ERROR);
  }

  const fresh = await fetchFullPG(pgId, ownerId);
  if (!fresh) throw new Error("Property not found.");
  return fresh;
}

// ============================================================
// PUBLIC API: FLOOR OPERATIONS
// ============================================================

export async function renameFloor(
  ownerId: string,
  pgId: string,
  floorId: string,
  newName: string
): Promise<PGProperty> {
  const supabase = createClient();
  const trimmed = newName.trim();
  if (!trimmed) {
    throw new Error("Floor name cannot be empty.");
  }

  const { error } = await supabase
    .from("floors")
    .update({ name: trimmed })
    .eq("id", floorId)
    .eq("owner_id", ownerId);

  if (error) {
    console.error("Failed to rename floor:", error);
    throw new Error(FRIENDLY_SAVE_ERROR);
  }

  const fresh = await fetchFullPG(pgId, ownerId);
  if (!fresh) throw new Error("Property not found.");
  return fresh;
}

export async function reorderFloors(
  ownerId: string,
  pgId: string,
  floorUpdates: Array<{ id: string; order: number }>
): Promise<PGProperty> {
  const supabase = createClient();

  for (const item of floorUpdates) {
    const { error } = await supabase
      .from("floors")
      .update({ order: item.order })
      .eq("id", item.id)
      .eq("owner_id", ownerId);

    if (error) {
      console.error("Failed to update floor order:", error);
      throw new Error("Could not save new floor order. Please try again.");
    }
  }

  const fresh = await fetchFullPG(pgId, ownerId);
  if (!fresh) throw new Error("Property not found.");
  return fresh;
}

export async function addFloor(
  ownerId: string,
  pgId: string,
  name: string,
  order?: number
): Promise<PGProperty> {
  const supabase = createClient();
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Floor name cannot be empty.");
  }

  let finalOrder = order;
  if (finalOrder === undefined) {
    const { data: floors } = await supabase
      .from("floors")
      .select("order")
      .eq("pg_id", pgId)
      .eq("owner_id", ownerId);
    const maxOrder = floors && floors.length > 0
      ? Math.max(...floors.map((f) => (f.order as number) || 0))
      : 0;
    finalOrder = maxOrder + 1;
  }

  const floorId = crypto.randomUUID();
  const { error } = await supabase.from("floors").insert({
    id: floorId,
    pg_id: pgId,
    owner_id: ownerId,
    name: trimmed,
    order: finalOrder,
  });

  if (error) {
    console.error("Failed to create floor:", error);
    throw new Error(FRIENDLY_SAVE_ERROR);
  }

  const fresh = await fetchFullPG(pgId, ownerId);
  if (!fresh) throw new Error("Property not found.");
  return fresh;
}

export async function deleteFloor(
  ownerId: string,
  pgId: string,
  floorId: string
): Promise<PGProperty> {
  const supabase = createClient();

  // 1. Fetch beds and tenants belonging to this floor to check if any active tenants exist
  const { data: floorBeds, error: bedsErr } = await supabase
    .from("beds")
    .select("id")
    .eq("floor_id", floorId)
    .eq("owner_id", ownerId);

  if (bedsErr) {
    console.error("Failed to check floor beds:", bedsErr);
    throw new Error("Could not verify floor beds. Please check your internet connection.");
  }

  const bedIds = (floorBeds || []).map((b) => b.id as string);

  if (bedIds.length > 0) {
    // If beds have tenants, mark active/notice/reserved tenants as 'left' with leave_date = today
    // before beds are deleted (or delete them cleanly so no orphaned foreign key issues arise)
    const today = new Date().toISOString().split("T")[0];
    const { error: vacateErr } = await supabase
      .from("tenants")
      .update({
        status: "left",
        leave_date: today,
        updated_at: new Date().toISOString(),
      })
      .in("bed_id", bedIds)
      .eq("owner_id", ownerId)
      .in("status", ["active", "notice", "reserved"]);

    if (vacateErr) {
      console.warn("Could not mark tenants as left prior to floor bed deletion, attempting bed cascade:", vacateErr);
    }

    // Delete all beds on this floor
    const { error: delBedsErr } = await supabase
      .from("beds")
      .delete()
      .eq("floor_id", floorId)
      .eq("owner_id", ownerId);

    if (delBedsErr) {
      console.error("Failed to delete floor beds:", delBedsErr);
      throw new Error(FRIENDLY_SAVE_ERROR);
    }
  }

  // 2. Delete all rooms on this floor
  const { error: delRoomsErr } = await supabase
    .from("rooms")
    .delete()
    .eq("floor_id", floorId)
    .eq("owner_id", ownerId);

  if (delRoomsErr) {
    console.error("Failed to delete floor rooms:", delRoomsErr);
    throw new Error(FRIENDLY_SAVE_ERROR);
  }

  // 3. Delete the floor itself
  const { error: floorErr } = await supabase
    .from("floors")
    .delete()
    .eq("id", floorId)
    .eq("owner_id", ownerId);

  if (floorErr) {
    console.error("Failed to delete floor:", floorErr);
    throw new Error(FRIENDLY_SAVE_ERROR);
  }

  // 4. Adjust serial numbers / order of all remaining floors for this PG (1, 2, 3...)
  const { data: remainingFloors, error: remErr } = await supabase
    .from("floors")
    .select("id, order, created_at")
    .eq("pg_id", pgId)
    .eq("owner_id", ownerId)
    .order("order", { ascending: true })
    .order("created_at", { ascending: true });

  if (!remErr && remainingFloors && remainingFloors.length > 0) {
    for (let i = 0; i < remainingFloors.length; i++) {
      const targetOrder = i + 1;
      if (remainingFloors[i].order !== targetOrder) {
        await supabase
          .from("floors")
          .update({ order: targetOrder })
          .eq("id", remainingFloors[i].id)
          .eq("owner_id", ownerId);
      }
    }
  }

  const fresh = await fetchFullPG(pgId, ownerId);
  if (!fresh) throw new Error("Property not found.");
  return fresh;
}

// ============================================================
// PUBLIC API: ADVANCED ROOM OPERATIONS (Move, Bulk, Batch Add)
// ============================================================

export async function moveRoomToFloor(
  ownerId: string,
  pgId: string,
  roomId: string,
  targetFloorId: string
): Promise<PGProperty> {
  const supabase = createClient();

  const { error } = await supabase.rpc("move_room_to_floor", {
    p_room_id: roomId,
    p_floor_id: targetFloorId,
  });

  if (error) {
    console.error("Failed to move room to floor:", error);
    throw new Error(
      error.message && error.message.includes("Cannot move room")
        ? error.message
        : FRIENDLY_SAVE_ERROR
    );
  }

  const fresh = await fetchFullPG(pgId, ownerId);
  if (!fresh) throw new Error("Property not found.");
  return fresh;
}

export async function bulkUpdateRooms(
  ownerId: string,
  pgId: string,
  roomIds: string[],
  updates: {
    isAc?: boolean;
    hasAttachedBathroom?: boolean;
    amenities?: string[];
    customRent?: number | null;
  }
): Promise<PGProperty> {
  const supabase = createClient();

  const payload: Record<string, unknown> = {};
  if (updates.isAc !== undefined) payload.is_ac = updates.isAc;
  if (updates.hasAttachedBathroom !== undefined) payload.has_attached_bathroom = updates.hasAttachedBathroom;
  if (updates.amenities !== undefined) payload.amenities = updates.amenities;
  if (updates.customRent !== undefined) {
    payload.custom_rent = updates.customRent !== null && updates.customRent !== undefined
      ? Math.max(0, updates.customRent)
      : null;
  }

  if (Object.keys(payload).length > 0 && roomIds.length > 0) {
    const { error } = await supabase
      .from("rooms")
      .update(payload)
      .in("id", roomIds)
      .eq("owner_id", ownerId);

    if (error) {
      console.error("Failed to bulk update rooms:", error);
      throw new Error(FRIENDLY_SAVE_ERROR);
    }
  }

  const fresh = await fetchFullPG(pgId, ownerId);
  if (!fresh) throw new Error("Property not found.");
  return fresh;
}

export async function addMultipleRoomsToFloor(
  ownerId: string,
  pgId: string,
  floorId: string,
  roomsData: Array<{
    name: string;
    sharingType: number;
    isAc: boolean;
    hasAttachedBathroom: boolean;
    amenities?: string[];
    customRent?: number;
  }>
): Promise<{ pg: PGProperty; skippedNames: string[] }> {
  const supabase = createClient();

  // 1. Fetch all existing room names in this PG to avoid duplicates
  const { data: existingRooms, error: existingErr } = await supabase
    .from("rooms")
    .select("name, floor_id")
    .eq("pg_id", pgId)
    .eq("owner_id", ownerId);

  if (existingErr) {
    console.error("Failed to fetch existing rooms:", existingErr);
    throw new Error(FRIENDLY_SAVE_ERROR);
  }

  const existingNameSet = new Set(
    (existingRooms || []).map((r) => ((r.name as string) || "").trim().toLowerCase())
  );

  const skippedNames: string[] = [];
  const roomsToInsert: Array<{
    name: string;
    sharingType: number;
    isAc: boolean;
    hasAttachedBathroom: boolean;
    amenities?: string[];
    customRent?: number;
  }> = [];

  for (const r of roomsData) {
    const norm = r.name.trim().toLowerCase();
    if (existingNameSet.has(norm)) {
      skippedNames.push(r.name.trim());
    } else {
      existingNameSet.add(norm);
      roomsToInsert.push(r);
    }
  }

  for (const roomItem of roomsToInsert) {
    const roomId = crypto.randomUUID();
    const { error: roomErr } = await supabase.from("rooms").insert({
      id: roomId,
      pg_id: pgId,
      floor_id: floorId,
      owner_id: ownerId,
      name: roomItem.name.trim(),
      sharing_type: roomItem.sharingType,
      is_ac: roomItem.isAc,
      has_attached_bathroom: roomItem.hasAttachedBathroom,
      amenities: roomItem.amenities || ["cot", "mattress", "cupboard"],
      custom_rent:
        roomItem.customRent !== undefined && roomItem.customRent !== null
          ? Math.max(0, roomItem.customRent)
          : null,
    });

    if (roomErr) {
      console.error("Failed to insert room batch item:", roomErr);
      throw new Error(FRIENDLY_SAVE_ERROR);
    }

    const labels = generateBedLabels(roomItem.sharingType);
    const bedsToInsert = labels.map((label) => ({
      id: crypto.randomUUID(),
      pg_id: pgId,
      floor_id: floorId,
      room_id: roomId,
      owner_id: ownerId,
      name: label,
      status: "vacant",
    }));

    const { error: bedsErr } = await supabase.from("beds").insert(bedsToInsert);
    if (bedsErr) {
      console.error("Failed to insert beds batch item:", bedsErr);
      throw new Error(FRIENDLY_SAVE_ERROR);
    }
  }

  const fresh = await fetchFullPG(pgId, ownerId);
  if (!fresh) throw new Error("Property not found.");
  return { pg: fresh, skippedNames };
}

// ============================================================
// WIZARD DRAFT PERSISTENCE (LocalStorage)
// Kept in browser storage so owners don't lose work on refresh.
// ============================================================

export function saveWizardDraft(ownerId: string, draft: WizardDraft): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(WIZARD_DRAFT_KEY(ownerId), JSON.stringify(draft));
  } catch (e) {
    console.error("Failed to save wizard draft:", e);
  }
}

export function getWizardDraft(ownerId: string): WizardDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(WIZARD_DRAFT_KEY(ownerId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearWizardDraft(ownerId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(WIZARD_DRAFT_KEY(ownerId));
  } catch (e) {
    console.error("Failed to clear wizard draft:", e);
  }
}