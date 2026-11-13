"use client";

import React, { useState } from "react";
import { Floor } from "@/lib/types";
import { AlertCircle, Trash2, X, AlertTriangle, Users } from "lucide-react";

interface DeleteFloorModalProps {
  floor: Floor | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (floorId: string) => Promise<void>;
}

export default function DeleteFloorModal({
  floor,
  isOpen,
  onClose,
  onConfirm,
}: DeleteFloorModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [typedConfirm, setTypedConfirm] = useState("");

  if (!isOpen || !floor) return null;

  const totalRooms = floor.rooms.length;
  const totalBeds = floor.rooms.reduce((acc, r) => acc + r.beds.length, 0);

  // Identify tenants residing on this floor
  const residentTenants: Array<{ bedName: string; roomName: string; tenantName: string; phone?: string }> = [];

  for (const r of floor.rooms) {
    for (const b of r.beds) {
      if (b.status === "occupied" || b.status === "notice" || b.status === "reserved" || b.tenant) {
        residentTenants.push({
          bedName: b.name,
          roomName: r.name,
          tenantName: b.tenant?.fullName || b.tenantName || "Resident Tenant",
          phone: b.tenant?.phone || b.tenantPhone,
        });
      }
    }
  }

  const hasTenants = residentTenants.length > 0;
  const isNameMatched = typedConfirm.trim().toLowerCase() === floor.name.trim().toLowerCase();

  const handleClose = () => {
    if (loading) return;
    setTypedConfirm("");
    setError("");
    onClose();
  };

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasTenants && !isNameMatched) {
      setError(`Please type "${floor.name}" exactly to confirm floor deletion.`);
      return;
    }

    setLoading(true);
    setError("");
    try {
      await onConfirm(floor.id);
      setTypedConfirm("");
      onClose();
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || "Could not delete floor. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="fixed inset-0" onClick={handleClose} />

      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150 my-6">
        {/* Header */}
        <div
          className={`p-5 border-b flex items-center justify-between ${
            hasTenants ? "bg-amber-50/80 border-amber-200" : "bg-red-50/70 border-red-100"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                hasTenants ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-600"
              }`}
            >
              {hasTenants ? <AlertTriangle className="w-5 h-5" /> : <Trash2 className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {hasTenants ? "Caution: Delete Floor with Active Tenants" : "Delete Floor"}
              </h3>
              <p className="text-xs text-slate-500">
                {floor.name} • Floor order serial numbers will adjust automatically
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content & Form */}
        <form onSubmit={handleDelete} className="p-5 space-y-4">
          {/* Warning banner when tenants exist on the floor */}
          {hasTenants ? (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-xs text-amber-900">
              <div className="flex items-start gap-2 font-bold text-amber-950">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Caution: {residentTenants.length} active tenant{residentTenants.length > 1 ? "s exist" : " exists"} on this floor!
                </span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Deleting this floor will safely record check-out (vacate status) for these tenants and remove their room & bed records. The remaining floors will be smoothly renumbered (1, 2, 3...) with zero gaps.
              </p>
              {/* Tenant preview list */}
              <div className="max-h-28 overflow-y-auto bg-white/80 p-2 rounded-lg border border-amber-200/80 space-y-1">
                {residentTenants.map((t, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[11px] text-slate-700">
                    <span className="font-semibold text-slate-900">
                      {t.tenantName} {t.phone ? `(+91 ${t.phone})` : ""}
                    </span>
                    <span className="text-slate-500 font-mono text-[10px]">
                      Room {t.roomName} • {t.bedName}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete <span className="font-bold text-slate-900">{floor.name}</span>?
              Remaining floors will be adjusted in order automatically.
            </p>
          )}

          {/* Counts summary */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs text-slate-700">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-600">Rooms on this floor</span>
              <span className="font-bold text-slate-900">{totalRooms}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-600">Total beds</span>
              <span className="font-bold text-slate-900">{totalBeds}</span>
            </div>
            {hasTenants && (
              <div className="flex items-center justify-between text-amber-900">
                <span className="font-semibold">Tenants to be marked as checked out</span>
                <span className="font-extrabold text-amber-700">{residentTenants.length}</span>
              </div>
            )}
          </div>

          {/* Require typing floor name when tenants exist */}
          {hasTenants && (
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-800">
                To confirm deletion with caution, type <span className="font-mono font-bold select-all text-slate-900">"{floor.name}"</span> below:
              </label>
              <input
                type="text"
                autoFocus
                value={typedConfirm}
                onChange={(e) => setTypedConfirm(e.target.value)}
                placeholder={floor.name}
                className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading || (hasTenants && !isNameMatched)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-white text-xs font-bold transition shadow-xs disabled:opacity-40 ${
                hasTenants
                  ? "bg-amber-600 hover:bg-amber-700"
                  : "bg-red-600 hover:bg-red-700"
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>
                {loading
                  ? "Deleting Floor..."
                  : hasTenants
                  ? "Delete Floor & Vacate Tenants"
                  : "Delete Floor"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
