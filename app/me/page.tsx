"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getMyStays } from "@/lib/data/tenantPortal";
import { TenantStay } from "@/lib/types";
import { formatINR, formatDate } from "@/lib/utils";
import {
  Building2,
  BedDouble,
  User,
  Phone,
  MapPin,
  Calendar,
  LogOut,
  Shield,
  CreditCard,
  Utensils,
  Wind,
  Bath,
  ArrowRightLeft,
  Briefcase,
  AlertCircle,
  HelpCircle,
  Users,
} from "lucide-react";

export default function TenantMePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stays, setStays] = useState<TenantStay[]>([]);
  const [selectedStayIndex, setSelectedStayIndex] = useState(0);
  const [isOwnerAlso, setIsOwnerAlso] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth/login");
        return;
      }

      // Check if user is also an owner of PGs
      try {
        const { data: pgs } = await supabase
          .from("pgs")
          .select("id")
          .eq("owner_id", user.id)
          .limit(1);
        if (pgs && pgs.length > 0) {
          setIsOwnerAlso(true);
        }
      } catch (e) {
        // Ignored — tenant RLS might simply return empty
      }

      // Load stays through get_my_stays() RPC
      try {
        const myStays = await getMyStays();
        setStays(myStays);
      } catch (err: unknown) {
        const e = err as Error;
        setError(e.message || "Failed to load stay details.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-slate-600 font-semibold text-xs">Loading your PGDesk stay...</p>
      </div>
    );
  }

  // If no active stays found: Show ended access screen
  if (stays.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-sm text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-500 mx-auto flex items-center justify-center">
            <Building2 className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            Your access to this PG has ended.
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            You currently do not have any active stays linked to your account. If you have moved or joined a new PG, please ask your PG owner for a fresh invite QR code.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
            {isOwnerAlso && (
              <button
                type="button"
                onClick={() => router.push("/")}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs"
              >
                Go to Owner Dashboard
              </button>
            )}
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentStay = stays[selectedStayIndex] || stays[0];
  const { tenant, stay, pg } = currentStay;
  const stayRecord = stay as unknown as Record<string, unknown>;
  const monthlyRent = (stayRecord.monthly_rent ?? stay.rent) as number | null | undefined;
  const sharingType = (stayRecord.sharing_type ?? stayRecord.sharing) as number | undefined;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Mobile-First App Header */}
      <header className="sticky top-0 bg-white/95 backdrop-blur z-30 border-b border-slate-200 px-4 py-3 sm:px-6">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold shadow-2xs">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-slate-900 leading-tight">
                {pg.name}
              </h1>
              <p className="text-[11px] text-teal-700 font-bold">
                Room {stay.room_name} • {stay.bed_name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isOwnerAlso && (
              <button
                type="button"
                onClick={() => router.push("/")}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
                title="Switch to PG Owner Dashboard"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-teal-600" />
                <span className="hidden sm:inline">Owner view</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSignOut}
              className="p-2 text-slate-400 hover:text-red-600 rounded-xl hover:bg-red-50 transition"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content (Mobile-First Big Cards) */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-5 space-y-4">
        {/* Multi-Stay Switcher if user has more than 1 stay */}
        {stays.length > 1 && (
          <div className="p-3 bg-white border border-teal-200 rounded-2xl shadow-2xs space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800 block">
              Switch PG Stay
            </span>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {stays.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedStayIndex(idx)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold shrink-0 border transition ${
                    selectedStayIndex === idx
                      ? "bg-teal-600 text-white border-teal-600 shadow-2xs"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {s.pg.name} (Room {s.stay.room_name})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* CARD 1: My Stay */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
              <BedDouble className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">My Stay</h2>
              <p className="text-[11px] text-slate-500">Room details & monthly charges</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="text-slate-400 font-semibold block text-[10px] uppercase">Room, Bed & Floor</span>
              <span className="text-sm font-extrabold text-slate-900 block mt-0.5">
                Room {stay.room_name}
              </span>
              <span className="text-[11px] font-bold text-teal-700">
                {stay.bed_name} • {stay.floor_name}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="text-slate-400 font-semibold block text-[10px] uppercase">Monthly rent</span>
              {monthlyRent !== null && monthlyRent !== undefined ? (
                <>
                  <span className="text-sm font-extrabold text-slate-900 block mt-0.5">
                    {formatINR(monthlyRent)}
                  </span>
                  <span className="text-[11px] text-slate-500">Per month</span>
                </>
              ) : (
                <span className="text-xs font-semibold text-amber-700 block mt-1 leading-snug">
                  Rent not set yet. Please contact your PG owner
                </span>
              )}
            </div>
          </div>

          {/* Room Specs & Features */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {sharingType && (
              <span className="px-3 py-1 rounded-xl bg-slate-100 text-slate-800 font-semibold border border-slate-200 flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-slate-500" />
                {sharingType === 1 ? "1 Sharing (Private Room)" : `${sharingType} Sharing`}
              </span>
            )}

            <span className="px-3 py-1 rounded-xl bg-teal-50 text-teal-800 font-semibold border border-teal-200 flex items-center gap-1">
              <Wind className="w-3.5 h-3.5" />
              {stay.is_ac ? "AC Room" : "Non-AC"}
            </span>

            <span className="px-3 py-1 rounded-xl bg-teal-50 text-teal-800 font-semibold border border-teal-200 flex items-center gap-1">
              <Bath className="w-3.5 h-3.5" />
              {stay.has_attached_bathroom ? "Attached Bathroom" : "Common Bathroom"}
            </span>

            {stay.food_included && (
              <span className="px-3 py-1 rounded-xl bg-amber-50 text-amber-800 font-semibold border border-amber-200 flex items-center gap-1">
                <Utensils className="w-3.5 h-3.5" />
                Food Included
              </span>
            )}
          </div>

          {/* Pricing specifics */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5 text-xs text-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Security Deposit</span>
              <span className="font-bold text-slate-900">{formatINR(stay.deposit)}</span>
            </div>
            {stay.maintenance > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Maintenance</span>
                <span className="font-bold text-slate-900">{formatINR(stay.maintenance)}/mo</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-[11px]">
              <span className="text-slate-500">Joining Date</span>
              <span className="font-semibold text-slate-800">{formatDate(stay.join_date)}</span>
            </div>
          </div>
        </div>

        {/* CARD 2: My Details */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">My Details</h2>
              <p className="text-[11px] text-slate-500">Your profile registered with the PG</p>
            </div>
          </div>

          <div className="space-y-2.5 text-xs text-slate-800">
            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Full Name</span>
              <span className="font-bold text-slate-900">{tenant.full_name}</span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Primary Mobile</span>
              <span className="font-bold font-mono text-slate-900">+91 {tenant.phone}</span>
            </div>

            {tenant.id_type && (
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 capitalize">{tenant.id_type.replace(/_/g, " ")}</span>
                <span className="font-bold font-mono text-slate-900">
                  {tenant.id_last4 ? `XXXX XXXX ${tenant.id_last4}` : "XXXX XXXX 1234"}
                </span>
              </div>
            )}

            {tenant.occupation && (
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Occupation</span>
                <span className="font-semibold text-slate-900">{tenant.occupation}</span>
              </div>
            )}

            {tenant.alt_contact_name && (
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Emergency Contact</span>
                <span className="font-semibold text-slate-900">
                  {tenant.alt_contact_name} {tenant.alt_phone ? `(+91 ${tenant.alt_phone})` : ""}
                </span>
              </div>
            )}

            {tenant.native_address && (
              <div className="py-1">
                <span className="text-slate-500 block mb-0.5">Permanent Address</span>
                <span className="font-medium text-slate-800 leading-relaxed">{tenant.native_address}</span>
              </div>
            )}
          </div>
        </div>

        {/* CARD 3: My PG */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">{pg.name}</h2>
              <p className="text-[11px] text-slate-500">Address & house policies</p>
            </div>
          </div>

          <div className="space-y-3 text-xs text-slate-700">
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-2">
              <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                {pg.address}, {pg.city} ({pg.pincode})
              </p>
            </div>

            {/* Gate Timing & Visitor Policy */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {pg.gate_timing && (
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Gate Timing</span>
                  <span className="font-bold text-slate-900">{pg.gate_timing}</span>
                </div>
              )}
              {pg.visitor_policy && (
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Visitor Policy</span>
                  <span className="font-bold text-slate-900">{pg.visitor_policy}</span>
                </div>
              )}
            </div>

            {/* Other Rules */}
            {pg.other_rules && (
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">House Rules</span>
                <p className="text-slate-800 leading-relaxed">{pg.other_rules}</p>
              </div>
            )}

            {/* Facilities */}
            {pg.facilities && pg.facilities.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Facilities Included</span>
                <div className="flex flex-wrap gap-1.5">
                  {pg.facilities.map((f, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 text-[11px] font-semibold"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Call Owner Button */}
            {pg.contact_phone && (
              <div className="pt-2">
                <a
                  href={`tel:${pg.contact_phone}`}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm transition shadow-xs"
                >
                  <Phone className="w-4 h-4" />
                  <span>Call Owner (+91 {pg.contact_phone})</span>
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Required Owner Contact Notice Line */}
        <p className="text-center text-xs text-slate-500 font-medium py-2">
          To change any detail, please contact your PG owner.
        </p>

        {/* Sign Out Button */}
        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={handleSignOut}
            className="text-xs text-slate-500 hover:text-red-600 font-semibold transition"
          >
            Sign out of PGDesk
          </button>
        </div>
      </main>
    </div>
  );
}
