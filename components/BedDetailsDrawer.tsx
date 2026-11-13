"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Bed, BedUpdates, Room, Floor, TenantStatus, PGProperty } from "@/lib/types";
import {
  formatINR,
  formatDate,
  sanitizeNonNegative,
  isValidAadhaar,
  formatAadhaar,
  getBedRent,
  getRentSourceLabel,
} from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  getTenantInviteStatus,
  createTenantInviteToken,
  resetTenantAccess,
} from "@/lib/data/pgStore";
import TenantInviteModal from "@/components/TenantInviteModal";
import {
  X,
  Wrench,
  CheckCircle2,
  Trash2,
  User,
  Phone,
  BedDouble,
  ShieldAlert,
  Save,
  UserPlus,
  Calendar,
  CreditCard,
  MapPin,
  Briefcase,
  AlertCircle,
  LogOut,
  Eye,
  EyeOff,
  RotateCcw,
  QrCode,
  ChevronDown,
  ChevronUp,
  Smartphone,
  KeyRound,
} from "lucide-react";

// ──────────────────────────────────────────────
// Constants & Helpers
// ──────────────────────────────────────────────

const ID_TYPE_OPTIONS = [
  { value: "", label: "Not specified" },
  { value: "aadhaar", label: "Aadhaar Card" },
  { value: "driving_license", label: "Driving License" },
  { value: "passport", label: "Passport" },
  { value: "voter_id", label: "Voter ID" },
  { value: "pan", label: "PAN Card" },
  { value: "college_id", label: "College / Student ID" },
  { value: "company_id", label: "Company / Work ID" },
  { value: "other", label: "Other ID" },
];

const GENDER_OPTIONS = [
  { value: "", label: "Not specified" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

const OCCUPATION_OPTIONS = [
  { value: "", label: "Not specified" },
  { value: "Working Professional", label: "Working Professional" },
  { value: "Student", label: "Student" },
  { value: "Self-employed / Business", label: "Self-employed / Business" },
  { value: "Intern", label: "Intern" },
  { value: "Other", label: "Other" },
];

const RELATION_OPTIONS = [
  { value: "", label: "Not specified" },
  { value: "Father", label: "Father" },
  { value: "Mother", label: "Mother" },
  { value: "Guardian", label: "Guardian" },
  { value: "Sibling", label: "Sibling" },
  { value: "Spouse", label: "Spouse" },
  { value: "Friend", label: "Friend" },
  { value: "Colleague", label: "Colleague" },
  { value: "Other", label: "Other" },
];

function labelForIdType(val?: string): string {
  if (!val) return "Not specified";
  return ID_TYPE_OPTIONS.find((o) => o.value === val.toLowerCase())?.label ?? val;
}

function labelForGender(val?: string): string {
  if (!val) return "Not specified";
  return GENDER_OPTIONS.find((o) => o.value === val.toLowerCase())?.label ?? val;
}

/** Map user-visible status label → tenant status string for DB */
type FormStatus = "staying" | "joining_later" | "giving_notice";

function formStatusToTenantStatus(fs: FormStatus): TenantStatus {
  if (fs === "joining_later") return "reserved";
  if (fs === "giving_notice") return "notice";
  return "active";
}

function tenantStatusToFormStatus(ts?: TenantStatus): FormStatus {
  if (ts === "reserved") return "joining_later";
  if (ts === "notice") return "giving_notice";
  return "staying";
}

// ──────────────────────────────────────────────
// Inline validation helpers
// ──────────────────────────────────────────────

function validateName(v: string): string {
  if (!v.trim()) return "Full name is required.";
  if (v.trim().replace(/[^a-zA-Z ]/g, "").length < 2)
    return "Please enter at least 2 letters.";
  return "";
}

function validatePhone(v: string): string {
  const d = v.replace(/\D/g, "");
  if (!d) return "Mobile number is required.";
  if (!/^[6-9]\d{9}$/.test(d)) return "Must be 10 digits starting with 6–9.";
  return "";
}

function validateAltPhone(v: string): string {
  if (!v.trim()) return "";
  const d = v.replace(/\D/g, "");
  if (!/^[6-9]\d{9}$/.test(d)) return "Must be 10 digits starting with 6–9.";
  return "";
}

function validateIdNumber(idType: string, v: string): string {
  if (!v.trim()) return ""; // optional
  if (idType === "aadhaar") {
    const res = isValidAadhaar(v);
    if (!res.valid) return res.error ?? "Invalid Aadhaar.";
    return "";
  }
  // Other types: 4–20 alphanumeric
  const clean = v.replace(/\s/g, "");
  if (!/^[a-zA-Z0-9]{4,20}$/.test(clean))
    return "ID number must be 4–20 letters or digits.";
  return "";
}

function validateJoinDate(v: string): string {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "Please enter a valid date.";
  return "";
}

// ──────────────────────────────────────────────
// FieldWrapper: shows label + red error / green tick
// ──────────────────────────────────────────────

function FieldWrapper({
  label,
  error,
  touched,
  required,
  children,
  hint,
}: {
  label: string;
  error: string;
  touched: boolean;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}) {
  const showError = touched && !!error;
  const showTick = touched && !error;
  return (
    <div>
      <label className="block text-[11px] font-bold text-slate-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
        {showTick && <CheckCircle2 className="inline w-3 h-3 text-emerald-500 ml-1" />}
      </label>
      {children}
      {showError && (
        <p className="mt-0.5 text-[10px] text-red-600 font-semibold flex items-center gap-1">
          <AlertCircle className="w-3 h-3 shrink-0" />
          {error}
        </p>
      )}
      {hint && !showError && (
        <p className="mt-0.5 text-[10px] text-slate-400">{hint}</p>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Main Component Props
// ──────────────────────────────────────────────

interface BedDetailsDrawerProps {
  bed: Bed | null;
  room: Room | null;
  floor: Floor | null;
  pg?: PGProperty | null;
  onClose: () => void;
  onUpdateBedDetails: (bedId: string, updates: BedUpdates) => Promise<void>;
  onDeleteBed: (bedId: string) => Promise<void>;
  onOpenEditRoom?: (room: Room, floor: Floor) => void;
  onAssignOrUpdateTenant?: (
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
      status?: TenantStatus;
    }
  ) => Promise<string | void | undefined>;
  onVacateTenant?: (bedId: string, tenantId: string) => Promise<void>;
}

// ──────────────────────────────────────────────
// Default input class
// ──────────────────────────────────────────────

const inputCls =
  "w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition";
const selectCls =
  "w-full px-2 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition";

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export default function BedDetailsDrawer({
  bed,
  room,
  floor,
  pg,
  onClose,
  onUpdateBedDetails,
  onDeleteBed,
  onOpenEditRoom,
  onAssignOrUpdateTenant,
  onVacateTenant,
}: BedDetailsDrawerProps) {
  // ── Form state ──
  const [formStatus, setFormStatus] = useState<FormStatus>("staying");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [altContactName, setAltContactName] = useState("");
  const [altContactRelation, setAltContactRelation] = useState("");
  const [altPhone, setAltPhone] = useState("");
  const [nativeAddress, setNativeAddress] = useState("");
  const [idType, setIdType] = useState("");
  const [idNumber, setIdNumber] = useState(""); // full number while editing
  const [gender, setGender] = useState("");
  const [occupation, setOccupation] = useState("");
  const [joinDate, setJoinDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  // Bed extras
  const [bedName, setBedName] = useState("");
  const [customRent, setCustomRent] = useState("");
  const [notes, setNotes] = useState("");

  // ── ID reveal state ──
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [revealCountdown, setRevealCountdown] = useState(0);
  const [changingId, setChangingId] = useState(false);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Touched (blur tracking) ──
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const touch = (field: string) =>
    setTouched((p) => ({ ...p, [field]: true }));
  const touchAll = () =>
    setTouched({
      fullName: true,
      phone: true,
      altPhone: true,
      idNumber: true,
      joinDate: true,
    });

  // ── Loading / feedback ──
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // ── Mode: form is open (has tenant or explicitly opened for empty bed) ──
  const [formOpen, setFormOpen] = useState(false);

  // ── Tenant app access state ──
  const [inviteSectionOpen, setInviteSectionOpen] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<"not_invited" | "invited" | "joined" | "expired">("not_invited");
  const [inviteExpiresAt, setInviteExpiresAt] = useState<string | undefined>(undefined);
  const [inviteTokenForModal, setInviteTokenForModal] = useState<string | null>(null);
  const [inviteActionLoading, setInviteActionLoading] = useState(false);

  const formRef = useRef<HTMLDivElement>(null);

  // ── Derived ──
  const currentTenant = bed?.tenant;
  const hasTenant = !!currentTenant;
  const isEmptyBed =
    !hasTenant &&
    (bed?.status === "vacant" ||
      bed?.status === "maintenance" ||
      !bed?.status);

  // Computed errors
  const nameErr = validateName(fullName);
  const phoneErr = validatePhone(phone);
  const altPhoneErr = validateAltPhone(altPhone);
  const idNumberErr = validateIdNumber(idType, idNumber);
  const joinDateErr = validateJoinDate(joinDate);

  const hasErrors =
    !!nameErr || !!phoneErr || !!altPhoneErr || !!idNumberErr || !!joinDateErr;

  const loadInviteStatus = useCallback(async (tenantId: string, tenantUserId?: string) => {
    try {
      const res = await getTenantInviteStatus(tenantId, tenantUserId);
      setInviteStatus(res.status);
      setInviteExpiresAt(res.expiresAt);
    } catch (e) {
      console.error("Could not load invite status:", e);
    }
  }, []);

  // ── Sync state when bed changes ──
  useEffect(() => {
    if (!bed) return;
    setBedName(bed.name);
    setCustomRent(bed.customRent !== undefined ? String(bed.customRent) : "");
    setNotes(bed.notes || "");
    setError("");
    setSuccessMsg("");
    setTouched({});
    setChangingId(false);
    setRevealedId(null);
    clearRevealTimers();
    setInviteTokenForModal(null);

    if (bed.tenant) {
      setFullName(bed.tenant.fullName || "");
      setPhone(bed.tenant.phone || "");
      setAltContactName(bed.tenant.altContactName || "");
      setAltContactRelation(bed.tenant.altContactRelation || "");
      setAltPhone(bed.tenant.altPhone || "");
      setNativeAddress(bed.tenant.nativeAddress || "");
      setIdType(bed.tenant.idType ? bed.tenant.idType.toLowerCase() : "");
      setIdNumber(""); // never pre-fill full ID — show XXXX XXXX 1234 via idLast4
      setGender(bed.tenant.gender ? bed.tenant.gender.toLowerCase() : "");
      setOccupation(bed.tenant.occupation || "");
      setJoinDate(
        bed.tenant.joinDate || new Date().toISOString().split("T")[0]
      );
      setFormStatus(tenantStatusToFormStatus(bed.tenant.status));
      setFormOpen(true); // always open when there is a tenant

      loadInviteStatus(bed.tenant.id, bed.tenant.userId);
    } else {
      resetTenantForm();
      setFormOpen(false);
      setInviteStatus("not_invited");
      setInviteExpiresAt(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bed?.id]);

  const handleSendInvite = async () => {
    if (!currentTenant) return;
    setInviteActionLoading(true);
    setError("");
    try {
      const token = await createTenantInviteToken(currentTenant.id);
      setInviteTokenForModal(token);
      await loadInviteStatus(currentTenant.id);
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || "Could not generate invite. Please try again.");
    } finally {
      setInviteActionLoading(false);
    }
  };

  const handleResetTenantAccess = async () => {
    if (!currentTenant) return;
    const ok = window.confirm(
      `Reset app access for ${currentTenant.fullName}? This will revoke any active invite and remove their tenant login access.`
    );
    if (!ok) return;

    setInviteActionLoading(true);
    setError("");
    try {
      await resetTenantAccess(currentTenant.id);
      await loadInviteStatus(currentTenant.id);
      setSuccessMsg("Tenant app access has been reset.");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || "Could not reset access.");
    } finally {
      setInviteActionLoading(false);
    }
  };

  function resetTenantForm() {
    setFullName("");
    setPhone("");
    setAltContactName("");
    setAltContactRelation("");
    setAltPhone("");
    setNativeAddress("");
    setIdType("");
    setIdNumber("");
    setGender("");
    setOccupation("");
    setJoinDate(new Date().toISOString().split("T")[0]);
    setFormStatus("staying");
    setTouched({});
  }

  // ── Reveal ID helpers ──
  const clearRevealTimers = useCallback(() => {
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    if (revealIntervalRef.current) clearInterval(revealIntervalRef.current);
    revealTimerRef.current = null;
    revealIntervalRef.current = null;
  }, []);

  const handleRevealId = async () => {
    if (!currentTenant) return;
    setError("");
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error: rpcErr } = await supabase.rpc(
        "reveal_tenant_id_number",
        { p_tenant_id: currentTenant.id }
      );
      if (rpcErr || !data) {
        throw new Error("Could not retrieve ID number. Please try again.");
      }
      setRevealedId(data as string);
      setRevealCountdown(30);
      clearRevealTimers();
      revealIntervalRef.current = setInterval(() => {
        setRevealCountdown((c) => {
          if (c <= 1) {
            clearRevealTimers();
            setRevealedId(null);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || "Could not retrieve ID number.");
    } finally {
      setLoading(false);
    }
  };

  const handleHideId = () => {
    clearRevealTimers();
    setRevealedId(null);
    setRevealCountdown(0);
  };

  // ── Mark as vacated ──
  const handleMarkVacated = async () => {
    if (!bed || !currentTenant) return;
    const ok = window.confirm(
      `Mark ${currentTenant.fullName} as vacated? Today will be recorded as their check-out date and ${bed.name} will be freed.`
    );
    if (!ok) return;
    setLoading(true);
    setError("");
    try {
      if (onVacateTenant) await onVacateTenant(bed.id, currentTenant.id);
      setSuccessMsg("Tenant checked out. Bed is now vacant.");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || "Could not mark as vacated. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Block for maintenance ──
  const handleBlockMaintenance = async () => {
    if (!bed) return;
    const ok = window.confirm(
      `Mark ${bed.name} as under maintenance? It will be unavailable until you change its status.`
    );
    if (!ok) return;
    setLoading(true);
    setError("");
    try {
      await onUpdateBedDetails(bed.id, { status: "maintenance" });
      setSuccessMsg("Bed is now blocked for maintenance.");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || "Could not update bed status. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Delete bed ──
  const handleDelete = async () => {
    if (!bed || !room) return;
    if (
      !confirm(
        `Remove ${bed.name} from Room ${room.name}? This cannot be undone.`
      )
    )
      return;
    setLoading(true);
    setError("");
    try {
      await onDeleteBed(bed.id);
      onClose();
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || "Could not delete bed.");
    } finally {
      setLoading(false);
    }
  };

  // ── Unified Save ──
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    touchAll();

    if (hasErrors) {
      // Scroll to first field with error
      const firstErr = formRef.current?.querySelector(
        "[data-haserror='true']"
      ) as HTMLElement | null;
      firstErr?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      // 1. Save tenant
      let savedTenantId: string | undefined = currentTenant?.id;

      let idSaveFailed = false;

      if (onAssignOrUpdateTenant) {
        const returnedId = await onAssignOrUpdateTenant(bed!.id, {
          id: currentTenant?.id,
          fullName: fullName.trim(),
          phone: phone.replace(/\D/g, ""),
          altContactName: altContactName.trim() || undefined,
          altContactRelation: altContactRelation.trim() || undefined,
          altPhone: altPhone.replace(/\D/g, "") || undefined,
          nativeAddress: nativeAddress.trim() || undefined,
          idType: idType || undefined,
          // idLast4 is now derived by the RPC from the full number – don't send it here
          gender: gender || undefined,
          occupation: occupation.trim() || undefined,
          joinDate: joinDate || undefined,
          status: formStatusToTenantStatus(formStatus),
        });
        if (typeof returnedId === "string" && returnedId) {
          savedTenantId = returnedId;
        }
      }

      // 2. Save ID number via RPC (after tenant is saved)
      const cleanIdNumber = idNumber.replace(/\s/g, "");
      if (cleanIdNumber && onAssignOrUpdateTenant) {
        // We need the tenant ID returned from onAssignOrUpdateTenant.
        // Since the prop doesn't return it, we retrieve the bed's current tenant from state.
        // The page refreshes activeBed after save, so we wait and get it from bed.tenant.id.
        // For now, store the ID number and call RPC with whatever tenantId we know.
        // If it's a new tenant, savedTenantId is undefined — we skip (a minor UX tradeoff).
        // If editing, savedTenantId = currentTenant.id.
        if (savedTenantId) {
          const supabase = createClient();
          const { error: rpcErr } = await supabase.rpc(
            "set_tenant_id_number",
            {
              p_tenant_id: savedTenantId,
              p_number: cleanIdNumber,
            }
          );
          if (rpcErr) {
            // Non-fatal: tenant is saved, just couldn't set ID
            console.error("set_tenant_id_number failed:", rpcErr);
            idSaveFailed = true;
            const m = (rpcErr.message || "").toLowerCase();
            if (m.includes("already has this id number")) {
              setError(
                "Tenant saved, but this ID number already belongs to another tenant in your PG."
              );
            } else if (m.includes("aadhaar number must be") || m.includes("id number must be")) {
              setError("Tenant saved, but the ID number is not valid. Please check the digits.");
            } else {
              setError(
                "Tenant saved, but could not save the ID number. Please try again."
              );
            }
          }
        } else {
          idSaveFailed = true;
          setError("Tenant saved, but the ID number could not be saved. Please try again.");
        }
      }

      // 3. Save bed extras (name, custom rent, notes)
      if (bed) {
        const bedUpdates: BedUpdates = {};
        if (bedName.trim() && bedName.trim() !== bed.name)
          bedUpdates.name = bedName.trim();
        // Empty box = null = "clear it in the database"
        const rentVal: number | null = customRent.trim()
          ? sanitizeNonNegative(customRent, 0)
          : null;
        if (rentVal !== (bed.customRent ?? null)) bedUpdates.customRent = rentVal;
        const notesVal: string | null = notes.trim() || null;
        if (notesVal !== (bed.notes ?? null)) bedUpdates.notes = notesVal;

        if (Object.keys(bedUpdates).length > 0) {
          await onUpdateBedDetails(bed.id, bedUpdates);
        }
      }

      if (!idSaveFailed) {
        setChangingId(false);
        setIdNumber("");
        setSuccessMsg(
          hasTenant ? "Details updated successfully!" : "Tenant assigned!"
        );
        setTimeout(() => setSuccessMsg(""), 3000);
      }
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || "Could not save. Please check your internet and try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!bed || !room || !floor) return null;

  // ──────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex justify-end">
      {/* Backdrop */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Drawer panel */}
      <div className="relative w-full max-w-lg bg-white h-full sm:min-h-full overflow-y-auto shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200">
        {/* ── Header ── */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur z-20">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
              <BedDouble className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">{bed.name}</h2>
              <p className="text-xs text-slate-500">
                Room {room.name} • {floor.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="p-5 space-y-5 flex-1" ref={formRef}>
          {/* Feedback banners */}
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span>{error}</span>
            </div>
          )}
          {successMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ── Empty bed prompt ── */}
          {!formOpen && (
            <div className="border border-dashed border-slate-300 rounded-2xl p-6 bg-slate-50 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-teal-50 text-teal-600 mx-auto flex items-center justify-center">
                <UserPlus className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">No Tenant Assigned</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  This bed is{" "}
                  {bed.status === "maintenance"
                    ? "under maintenance"
                    : "vacant and ready for a new resident."}
                </p>
              </div>
              {bed.status !== "maintenance" && (
                <button
                  type="button"
                  onClick={() => setFormOpen(true)}
                  className="w-full py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition"
                >
                  <UserPlus className="w-4 h-4" />
                  Assign Tenant to {bed.name}
                </button>
              )}
              {/* Block for maintenance */}
              {(bed.status === "vacant" || !bed.status) && (
                <button
                  type="button"
                  onClick={handleBlockMaintenance}
                  disabled={loading}
                  className="text-xs text-slate-400 hover:text-slate-700 underline transition mt-1"
                >
                  Block for maintenance
                </button>
              )}
            </div>
          )}

          {/* ── Main unified form ── */}
          {formOpen && (
            <form onSubmit={handleSave} className="space-y-5" noValidate>

              {/* Status pills */}
              <div>
                <p className="text-[11px] font-bold text-slate-700 mb-2">
                  Occupancy Status
                </p>
                <div className="flex gap-2 flex-wrap">
                  {(
                    [
                      { val: "staying", label: "Staying", color: "emerald" },
                      { val: "joining_later", label: "Joining Later", color: "blue" },
                      { val: "giving_notice", label: "Giving Notice", color: "amber" },
                    ] as { val: FormStatus; label: string; color: string }[]
                  ).map(({ val, label, color }) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setFormStatus(val)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition ${formStatus === val
                        ? color === "emerald"
                          ? "bg-emerald-100 border-emerald-400 text-emerald-800"
                          : color === "blue"
                            ? "bg-blue-100 border-blue-400 text-blue-800"
                            : "bg-amber-100 border-amber-400 text-amber-800"
                        : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                        }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Section: Tenant Details ── */}
              <div className="space-y-3.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Tenant Details
                </p>

                {/* Full Name */}
                <div data-haserror={touched.fullName && !!nameErr ? "true" : "false"}>
                  <FieldWrapper
                    label="Full Name"
                    error={nameErr}
                    touched={!!touched.fullName}
                    required
                  >
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      onBlur={() => touch("fullName")}
                      placeholder="e.g. Rahul Sharma"
                      className={inputCls}
                    />
                  </FieldWrapper>
                </div>

                {/* Mobile */}
                <div data-haserror={touched.phone && !!phoneErr ? "true" : "false"}>
                  <FieldWrapper
                    label="Mobile Number (WhatsApp)"
                    error={phoneErr}
                    touched={!!touched.phone}
                    required
                    hint="10 digits starting with 6, 7, 8, or 9"
                  >
                    <div className="flex rounded-lg border border-slate-300 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-teal-500">
                      <span className="px-2.5 py-2 bg-slate-100 text-slate-600 text-xs font-bold border-r border-slate-300">
                        +91
                      </span>
                      <input
                        type="tel"
                        maxLength={10}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                        onBlur={() => touch("phone")}
                        placeholder="9876543210"
                        className="w-full px-2.5 py-2 text-xs font-bold focus:outline-none"
                      />
                    </div>
                  </FieldWrapper>
                </div>

                {/* Gender & Occupation */}
                <div className="grid grid-cols-2 gap-2">
                  <FieldWrapper label="Gender" error="" touched={false}>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className={selectCls}
                    >
                      {GENDER_OPTIONS.map((g) => (
                        <option key={g.value} value={g.value}>
                          {g.label}
                        </option>
                      ))}
                    </select>
                  </FieldWrapper>

                  <FieldWrapper label="Occupation" error="" touched={false}>
                    <select
                      value={occupation}
                      onChange={(e) => setOccupation(e.target.value)}
                      className={selectCls}
                    >
                      {OCCUPATION_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </FieldWrapper>
                </div>

                {/* Join Date */}
                <div data-haserror={touched.joinDate && !!joinDateErr ? "true" : "false"}>
                  <FieldWrapper
                    label="Check-In Date"
                    error={joinDateErr}
                    touched={!!touched.joinDate}
                  >
                    <input
                      type="date"
                      value={joinDate}
                      onChange={(e) => setJoinDate(e.target.value)}
                      onBlur={() => touch("joinDate")}
                      className={inputCls}
                    />
                  </FieldWrapper>
                </div>
              </div>

              {/* ── Section: ID Proof ── */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5" /> ID Proof
                </p>

                <FieldWrapper label="ID Type" error="" touched={false}>
                  <select
                    value={idType}
                    onChange={(e) => {
                      setIdType(e.target.value);
                      setIdNumber("");
                      setChangingId(false);
                      setRevealedId(null);
                      clearRevealTimers();
                    }}
                    className={selectCls}
                  >
                    {ID_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </FieldWrapper>

                {idType && (
                  <div data-haserror={touched.idNumber && !!idNumberErr ? "true" : "false"}>
                    {/* View mode: show masked + reveal/change buttons */}
                    {hasTenant && currentTenant.idLast4 && !changingId ? (
                      <div className="space-y-2">
                        <p className="text-[11px] font-bold text-slate-700 mb-1">
                          ID Number
                        </p>
                        {revealedId ? (
                          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                            <span className="font-mono text-sm font-bold text-amber-900 tracking-widest flex-1">
                              {revealedId}
                            </span>
                            <span className="text-[10px] text-amber-700 font-semibold">
                              {revealCountdown}s
                            </span>
                            <button
                              type="button"
                              onClick={handleHideId}
                              className="text-amber-600 hover:text-amber-900"
                            >
                              <EyeOff className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                            <span className="font-mono text-sm font-bold text-slate-500 tracking-widest flex-1">
                              XXXX XXXX {currentTenant.idLast4}
                            </span>
                            <button
                              type="button"
                              onClick={handleRevealId}
                              disabled={loading}
                              className="flex items-center gap-1 text-[11px] text-teal-700 font-bold hover:underline disabled:opacity-50"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Show
                            </button>
                            <span className="text-slate-300">|</span>
                            <button
                              type="button"
                              onClick={() => setChangingId(true)}
                              className="flex items-center gap-1 text-[11px] text-slate-600 font-bold hover:underline"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Change
                            </button>
                          </div>
                        )}
                        <p className="text-[10px] text-slate-400 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-teal-500 shrink-0" />
                          Shown for 30 seconds only. Never stored in your browser.
                        </p>
                      </div>
                    ) : (
                      /* Input mode: new tenant or clicking Change */
                      <FieldWrapper
                        label="ID Number"
                        error={idNumberErr}
                        touched={!!touched.idNumber}
                        hint={
                          idType === "aadhaar"
                            ? "12 digits, first digit 2–9 (e.g. 2345 6789 0124)"
                            : "4–20 letters or digits"
                        }
                      >
                        <input
                          type="text"
                          inputMode="numeric"
                          value={
                            idType === "aadhaar"
                              ? formatAadhaar(idNumber)
                              : idNumber
                          }
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\s/g, "");
                            if (idType === "aadhaar") {
                              setIdNumber(raw.replace(/\D/g, "").slice(0, 12));
                            } else {
                              setIdNumber(raw.slice(0, 20));
                            }
                          }}
                          onBlur={() => touch("idNumber")}
                          placeholder={
                            idType === "aadhaar"
                              ? "2345 6789 0124"
                              : "Enter ID number"
                          }
                          className={`${inputCls} font-mono tracking-widest`}
                          maxLength={idType === "aadhaar" ? 14 : 20}
                        />
                        {changingId && (
                          <button
                            type="button"
                            onClick={() => {
                              setChangingId(false);
                              setIdNumber("");
                            }}
                            className="mt-1 text-[11px] text-slate-400 hover:text-slate-700 underline"
                          >
                            Cancel change
                          </button>
                        )}
                      </FieldWrapper>
                    )}
                  </div>
                )}
              </div>

              {/* ── Section: Alternate Contact ── */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" /> Emergency Contact
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <FieldWrapper label="Name" error="" touched={false}>
                    <input
                      type="text"
                      value={altContactName}
                      onChange={(e) => setAltContactName(e.target.value)}
                      placeholder="e.g. Ramesh Sharma"
                      className={inputCls}
                    />
                  </FieldWrapper>

                  <FieldWrapper label="Relationship" error="" touched={false}>
                    <select
                      value={altContactRelation}
                      onChange={(e) => setAltContactRelation(e.target.value)}
                      className={selectCls}
                    >
                      {RELATION_OPTIONS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </FieldWrapper>
                </div>

                <div data-haserror={touched.altPhone && !!altPhoneErr ? "true" : "false"}>
                  <FieldWrapper
                    label="Emergency Phone"
                    error={altPhoneErr}
                    touched={!!touched.altPhone}
                    hint="Optional — same format as primary"
                  >
                    <div className="flex rounded-lg border border-slate-300 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-teal-500">
                      <span className="px-2.5 py-2 bg-slate-100 text-slate-500 text-xs font-semibold border-r border-slate-300">
                        +91
                      </span>
                      <input
                        type="tel"
                        maxLength={10}
                        value={altPhone}
                        onChange={(e) => setAltPhone(e.target.value.replace(/\D/g, ""))}
                        onBlur={() => touch("altPhone")}
                        placeholder="Optional"
                        className="w-full px-2.5 py-2 text-xs focus:outline-none"
                      />
                    </div>
                  </FieldWrapper>
                </div>
              </div>

              {/* ── Section: Native Address ── */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-2">
                  <MapPin className="w-3.5 h-3.5" /> Native Address
                </p>
                <textarea
                  rows={2}
                  value={nativeAddress}
                  onChange={(e) => setNativeAddress(e.target.value)}
                  placeholder="e.g. H.No 14-2, Temple Road, Mysuru, Karnataka"
                  className={inputCls}
                />
              </div>

              {/* ── Section: Tenant App Access (Collapsed Section) ── */}
              {hasTenant && currentTenant && (
                <div className="pt-2 border-t border-slate-100">
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/60">
                    <button
                      type="button"
                      onClick={() => setInviteSectionOpen(!inviteSectionOpen)}
                      className="w-full p-3 flex items-center justify-between text-left hover:bg-slate-100/70 transition"
                    >
                      <div className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-teal-600" />
                        <div>
                          <span className="text-xs font-bold text-slate-800 block">
                            Tenant App Access
                          </span>
                          <span className="text-[10px] text-slate-500">
                            Invite {currentTenant.fullName} to view their stay & details
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Status pill */}
                        {inviteStatus === "joined" && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            Joined
                          </span>
                        )}
                        {inviteStatus === "invited" && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                            Invited {inviteExpiresAt ? `(expires ${formatDate(inviteExpiresAt)})` : ""}
                          </span>
                        )}
                        {inviteStatus === "expired" && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            Expired
                          </span>
                        )}
                        {inviteStatus === "not_invited" && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                            Not invited
                          </span>
                        )}

                        {inviteSectionOpen ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </button>

                    {inviteSectionOpen && (
                      <div className="p-3 pt-0 border-t border-slate-100 space-y-2.5 mt-1 bg-white">
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          Tenants can view room info, pricing, house rules, and emergency owner contact via their own private portal.
                        </p>

                        <div className="flex items-center gap-2 flex-wrap pt-1">
                          {/* Invite or Send new invite button */}
                          <button
                            type="button"
                            onClick={handleSendInvite}
                            disabled={inviteActionLoading}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition shadow-xs disabled:opacity-50"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            <span>
                              {inviteActionLoading
                                ? "Generating..."
                                : inviteStatus === "not_invited"
                                  ? "Invite Tenant"
                                  : "Send New Invite"}
                            </span>
                          </button>

                          {/* Reset access button */}
                          {(inviteStatus === "joined" || inviteStatus === "invited") && (
                            <button
                              type="button"
                              onClick={handleResetTenantAccess}
                              disabled={inviteActionLoading}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs transition disabled:opacity-50"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              <span>Reset Access</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Section: Bed Extras ── */}
              <div className="space-y-3 pt-1 border-t border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <BedDouble className="w-3.5 h-3.5" /> Bed Settings
                </p>

                <FieldWrapper label="Bed Label / Name" error="" touched={false}>
                  <input
                    type="text"
                    value={bedName}
                    onChange={(e) => setBedName(e.target.value)}
                    placeholder="e.g. Bed A, Window Bed"
                    className={inputCls}
                  />
                </FieldWrapper>

                <FieldWrapper
                  label="Custom Rent (₹ / month)"
                  error=""
                  touched={false}
                  hint={
                    pg && bed && room
                      ? (() => {
                          const { amount, source } = getBedRent(pg, room, bed);
                          if (source === "not_set") return "Leave empty to use the standard room rent";
                          const label = getRentSourceLabel(source, room);
                          return amount !== null
                            ? `Effective rent: ${formatINR(amount)}${label ? ` (${label})` : ""}`
                            : "Leave empty to use the standard room rent";
                        })()
                      : "Leave empty to use the standard room rent"
                  }
                >
                  <div className="flex items-center rounded-lg border border-slate-300 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-teal-500">
                    <span className="px-3 text-sm font-bold text-slate-500">₹</span>
                    <input
                      type="number"
                      min="0"
                      step={500}
                      onKeyDown={(e) => {
                        if (e.key === "-" || e.key === "e") e.preventDefault();
                      }}
                      value={customRent}
                      onChange={(e) => setCustomRent(e.target.value)}
                      placeholder="e.g. 8500"
                      className="w-full px-2 py-2 text-sm font-bold text-slate-900 focus:outline-none"
                    />
                  </div>
                </FieldWrapper>

                <FieldWrapper label="Notes" error="" touched={false}>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Near window, noisy fan"
                    className={inputCls}
                  />
                </FieldWrapper>
              </div>

              {/* ── Room info ── */}
              <div className="p-3.5 bg-teal-50/60 border border-teal-200 rounded-xl flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-teal-900 block">
                    Room {room.name} ({room.sharingType}-Sharing)
                  </span>
                  <p className="text-[11px] text-teal-700 mt-0.5">
                    {room.isAc ? "AC" : "Non-AC"} •{" "}
                    {room.hasAttachedBathroom ? "Attached Bath" : "Common Bath"}
                  </p>
                </div>
                {onOpenEditRoom && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenEditRoom(room, floor);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-white border border-teal-300 text-teal-800 text-xs font-bold hover:bg-teal-100 transition"
                  >
                    Edit Room
                  </button>
                )}
              </div>

              {/* ── Save button ── */}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm transition shadow-sm disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{loading ? "Saving…" : "Save"}</span>
              </button>

              {/* ── Secondary actions ── */}
              <div className="space-y-2">
                {hasTenant && (
                  <button
                    type="button"
                    onClick={handleMarkVacated}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-red-300 bg-red-50 hover:bg-red-100 text-red-800 text-xs font-bold transition"
                  >
                    <LogOut className="w-3.5 h-3.5 text-red-600" />
                    Mark as Vacated (Check-Out)
                  </button>
                )}

                {!hasTenant && bed.status === "vacant" && (
                  <button
                    type="button"
                    onClick={handleBlockMaintenance}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-slate-500 hover:bg-slate-50 text-xs font-semibold transition border border-slate-200"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    Block for Maintenance
                  </button>
                )}

                {bed.status === "vacant" && room.beds.length > 1 && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl text-red-500 hover:bg-red-50 text-xs font-semibold transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove this Bed from Room
                  </button>
                )}
              </div>
            </form>
          )}

          {/* ── Maintenance bed: show unblock option ── */}
          {bed.status === "maintenance" && !formOpen && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={async () => {
                  setLoading(true);
                  setError("");
                  try {
                    await onUpdateBedDetails(bed.id, { status: "vacant" });
                    setSuccessMsg("Bed is now available.");
                    setTimeout(() => setSuccessMsg(""), 3000);
                  } catch (err: unknown) {
                    const e = err as Error;
                    setError(e.message || "Could not update bed.");
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-teal-300 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold transition"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Mark as Available (End Maintenance)
              </button>
              {room.beds.length > 1 && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl text-red-500 hover:bg-red-50 text-xs font-semibold transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove this Bed from Room
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tenant Invite Modal (shows one-time QR code & WhatsApp share) */}
      {currentTenant && (
        <TenantInviteModal
          isOpen={Boolean(inviteTokenForModal)}
          token={inviteTokenForModal}
          tenantName={currentTenant.fullName}
          pgName={bed.name ? `${room.name} (${floor.name})` : "PG Property"}
          onClose={() => setInviteTokenForModal(null)}
        />
      )}
    </div>
  );
}