"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCurrentOwner, isProfileComplete } from "@/lib/data/auth";
import { getPGs, loadDemoPG, deletePG } from "@/lib/data/pgStore";
import { Owner, PGProperty } from "@/lib/types";
import Navbar from "@/components/Navbar";
import EditPGDrawer from "@/components/EditPGDrawer";
import DeletePGModal from "@/components/DeletePGModal";
import {
  Building2,
  Plus,
  Sparkles,
  MapPin,
  BedDouble,
  ArrowRight,
  Trash2,
  Pencil,
  Layers,
  CheckCircle2,
  ArrowRightLeft,
  QrCode,
} from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const [owner, setOwner] = useState<Owner | null>(null);
  const [pgs, setPgs] = useState<PGProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [editingPg, setEditingPg] = useState<PGProperty | null>(null);
  const [deletingPg, setDeletingPg] = useState<PGProperty | null>(null);
  const [toastMessage, setToastMessage] = useState<string>("");
  const [hasTenantStays, setHasTenantStays] = useState(false);
  const [showRoleChoice, setShowRoleChoice] = useState(false);

  useEffect(() => {
    async function loadData() {
      const current = await getCurrentOwner();
      if (!current) {
        router.push("/auth/login");
        return;
      }
      setOwner(current);

      // Parallel: check PGs and tenant stays
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      const [{ data: pgRows }, { data: staysRaw }] = await Promise.all([
        supabase.from("pgs").select("id").eq("owner_id", current.id).limit(1),
        supabase.rpc("get_my_stays"),
      ]);

      const hasOwnerPGs = !!(pgRows && pgRows.length > 0);
      const hasTenantStay = Array.isArray(staysRaw) && staysRaw.length > 0;

      setHasTenantStays(hasTenantStay);

      // ── ROLE ROUTING ──────────────────────────────────────
      // 1. Pure tenant (no PGs owned) → tenant portal
      if (hasTenantStay && !hasOwnerPGs) {
        router.push("/me");
        return;
      }

      // 2. Brand-new user with no role yet → show role-choice screen
      if (!hasTenantStay && !hasOwnerPGs) {
        const profileDone = await isProfileComplete();
        if (!profileDone) {
          setShowRoleChoice(true);
          setLoading(false);
          return;
        }
        // Profile done but no PGs yet → fall through to empty owner dashboard
      } else if (hasOwnerPGs) {
        // 3. Owner (also possibly a tenant) → check profile
        const profileDone = await isProfileComplete();
        if (!profileDone) {
          router.push("/profile");
          return;
        }
      }

      const userPGs = await getPGs(current.id);
      setPgs(userPGs);
      setLoading(false);
    }
    loadData();
  }, [router]);

  const handleLoadDemo = async () => {
    if (!owner) return;
    setActionLoading(true);
    try {
      const demo = await loadDemoPG(owner.id);
      setPgs((prev) => [...prev, demo]);
    } catch (e) {
      console.error(e);
      alert("Failed to create demo PG.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmDelete = async (pgId: string) => {
    if (!owner) return;
    await deletePG(owner.id, pgId);
    setPgs((prev) => prev.filter((p) => p.id !== pgId));
    setToastMessage("Property deleted successfully.");
    setTimeout(() => setToastMessage(""), 4000);
  };

  const handleSavedPG = (updatedPG: PGProperty) => {
    setPgs((prev) =>
      prev.map((p) => (p.id === updatedPG.id ? updatedPG : p))
    );
    setToastMessage(`"${updatedPG.name}" updated successfully!`);
    setTimeout(() => setToastMessage(""), 4000);
  };

  // Helper to count beds in a PG
  const getBedStats = (pg: PGProperty) => {
    let total = 0;
    let vacant = 0;
    let occupied = 0;
    let notice = 0;
    let maintenance = 0;

    for (const f of pg.floors) {
      for (const r of f.rooms) {
        for (const b of r.beds) {
          total++;
          if (b.status === "vacant") vacant++;
          else if (b.status === "occupied") occupied++;
          else if (b.status === "notice") notice++;
          else if (b.status === "maintenance") maintenance++;
        }
      }
    }

    return { total, vacant, occupied, notice, maintenance };
  };

  // ── LOADING SCREEN ─────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-600 font-medium text-sm">Loading your PGDesk dashboard...</p>
      </div>
    );
  }

  // ── ROLE-CHOICE SCREEN (brand-new users) ───────────────────
  if (showRoleChoice) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 shadow-sm p-8 space-y-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-teal-600 text-white mx-auto flex items-center justify-center">
            <Building2 className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 mb-1">Welcome to PGDesk</h1>
            <p className="text-sm text-slate-500">How are you using PGDesk?</p>
          </div>

          <div className="flex flex-col gap-3">
            <Link
              href="/profile"
              className="flex items-center gap-3 p-4 rounded-2xl border-2 border-teal-600 bg-teal-50 hover:bg-teal-100 transition text-left"
            >
              <Building2 className="w-6 h-6 text-teal-600 shrink-0" />
              <div>
                <div className="font-bold text-teal-900 text-sm">I own a PG</div>
                <div className="text-xs text-teal-700">Set up your PG property and manage beds</div>
              </div>
            </Link>

            <div className="flex items-center gap-3 p-4 rounded-2xl border-2 border-slate-200 bg-slate-50 text-left cursor-default">
              <QrCode className="w-6 h-6 text-slate-500 shrink-0" />
              <div>
                <div className="font-bold text-slate-700 text-sm">I&apos;m a tenant</div>
                <div className="text-xs text-slate-500">
                  Ask your PG owner for your invite QR code. Scan it to link your account.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── OWNER DASHBOARD ────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar currentOwner={owner} onLogout={() => router.push("/auth/login")} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Top welcome banner */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              My PG Properties
            </h1>
            <p className="text-slate-600 text-sm mt-1">
              Welcome back, <span className="font-semibold text-slate-800">{owner?.name}</span>. Manage your buildings, rooms, and beds here.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Switch to tenant view — shown only if this owner is also a tenant */}
            {hasTenantStays && (
              <button
                type="button"
                onClick={() => router.push("/me")}
                className="flex items-center gap-1.5 py-2.5 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm transition"
              >
                <ArrowRightLeft className="w-4 h-4 text-teal-600" />
                <span>My Tenant View</span>
              </button>
            )}

            <button
              onClick={handleLoadDemo}
              disabled={actionLoading}
              className="flex items-center gap-2 py-2.5 px-4 rounded-xl border border-teal-300 bg-teal-50 hover:bg-teal-100 text-teal-800 font-semibold text-sm transition shadow-2xs disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-teal-600" />
              <span>{actionLoading ? "Loading..." : "Load Demo PG (20 Rooms)"}</span>
            </button>

            <Link
              href="/wizard"
              className="flex items-center gap-2 py-2.5 px-5 rounded-xl bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-semibold text-sm transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>{pgs.length === 0 ? "Set up your first PG" : "Add another PG"}</span>
            </Link>
          </div>
        </div>

        {/* Empty State */}
        {pgs.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-300 rounded-3xl p-8 sm:p-14 text-center max-w-2xl mx-auto shadow-2xs my-6">
            <div className="w-20 h-20 rounded-2xl bg-teal-50 text-teal-600 mx-auto flex items-center justify-center mb-5">
              <Building2 className="w-10 h-10" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">
              No PG Properties Added Yet
            </h2>
            <p className="text-slate-600 text-sm sm:text-base mb-8 max-w-md mx-auto leading-relaxed">
              Create your PG in less than 3 minutes using our simple 6-step setup wizard, or test instantly with realistic sample data.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5">
              <Link
                href="/wizard"
                className="w-full sm:w-auto flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold shadow-sm transition"
              >
                <Plus className="w-5 h-5" />
                <span>Set up your first PG</span>
              </Link>

              <button
                onClick={handleLoadDemo}
                disabled={actionLoading}
                className="w-full sm:w-auto flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold shadow-2xs transition"
              >
                <Sparkles className="w-5 h-5 text-teal-600" />
                <span>Load Demo PG (Quick Test)</span>
              </button>
            </div>
          </div>
        ) : (
          /* PG Cards Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pgs.map((pg) => {
              const stats = getBedStats(pg);
              const totalRooms = pg.floors.reduce((acc, f) => acc + f.rooms.length, 0);

              return (
                <div
                  key={pg.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition flex flex-col overflow-hidden"
                >
                  {/* Card Header */}
                  <div className="p-5 pb-4 border-b border-slate-100">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span
                            className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                              pg.type === "boys"
                                ? "bg-blue-50 text-blue-700 border border-blue-200"
                                : pg.type === "girls"
                                ? "bg-pink-50 text-pink-700 border border-pink-200"
                                : "bg-purple-50 text-purple-700 border border-purple-200"
                            }`}
                          >
                            {pg.type === "boys" ? "Boys PG" : pg.type === "girls" ? "Girls PG" : "Co-Living"}
                          </span>
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Layers className="w-3.5 h-3.5" />
                            {pg.floors.length} Floors • {totalRooms} Rooms
                          </span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 group-hover:text-teal-600 transition truncate">
                          {pg.name}
                        </h3>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setEditingPg(pg)}
                          className="p-2 text-slate-400 hover:text-teal-600 rounded-lg hover:bg-teal-50 transition"
                          title="Edit Property Details"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeletingPg(pg)}
                          className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"
                          title="Delete Property"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 flex items-center gap-1.5 truncate">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {pg.address}, {pg.city} ({pg.pincode})
                    </p>
                  </div>

                  {/* Bed Stats Pills */}
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                        Live Occupancy Overview
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-2.5">
                          <div className="text-lg font-extrabold text-emerald-700">
                            {stats.vacant}
                          </div>
                          <div className="text-[11px] font-medium text-emerald-800">Vacant</div>
                        </div>

                        <div className="bg-red-50 border border-red-100 rounded-xl p-2.5">
                          <div className="text-lg font-extrabold text-red-700">
                            {stats.occupied}
                          </div>
                          <div className="text-[11px] font-medium text-red-800">Occupied</div>
                        </div>

                        <div className="bg-slate-100 border border-slate-200 rounded-xl p-2.5">
                          <div className="text-lg font-extrabold text-slate-800">
                            {stats.total}
                          </div>
                          <div className="text-[11px] font-medium text-slate-600">Total Beds</div>
                        </div>
                      </div>

                      {(stats.notice > 0 || stats.maintenance > 0) && (
                        <div className="flex items-center gap-3 mt-3 text-xs text-slate-500">
                          {stats.notice > 0 && (
                            <span className="flex items-center gap-1 text-amber-700">
                              <span className="w-2 h-2 rounded-full bg-amber-500" />
                              {stats.notice} Notice
                            </span>
                          )}
                          {stats.maintenance > 0 && (
                            <span className="flex items-center gap-1 text-slate-600">
                              <span className="w-2 h-2 rounded-full bg-slate-500" />
                              {stats.maintenance} Maintenance
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Open Bed Map Button */}
                    <div className="mt-5 pt-4 border-t border-slate-100">
                      <Link
                        href={`/pg/${pg.id}`}
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm transition shadow-xs"
                      >
                        <BedDouble className="w-4 h-4" />
                        <span>Open Bed Map</span>
                        <ArrowRight className="w-4 h-4 ml-0.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating success toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-semibold animate-in slide-in-from-bottom-2 duration-150">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Edit PG Details Drawer */}
      {owner && (
        <EditPGDrawer
          pg={editingPg}
          isOpen={!!editingPg}
          ownerId={owner.id}
          onClose={() => setEditingPg(null)}
          onSaved={handleSavedPG}
        />
      )}

      {/* Safe Delete PG Modal */}
      <DeletePGModal
        pg={deletingPg}
        isOpen={!!deletingPg}
        onClose={() => setDeletingPg(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
