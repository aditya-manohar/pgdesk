"use client";

import React, { useState } from "react";
import { PGProperty } from "@/lib/types";
import { AlertTriangle, Trash2, X } from "lucide-react";

interface DeletePGModalProps {
  pg: PGProperty | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (pgId: string) => Promise<void>;
}

export default function DeletePGModal({
  pg,
  isOpen,
  onClose,
  onConfirm,
}: DeletePGModalProps) {
  const [confirmName, setConfirmName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen || !pg) return null;

  // Calculate rooms, beds, tenants count
  let totalRooms = 0;
  let totalBeds = 0;
  let totalTenants = 0;

  for (const f of pg.floors) {
    totalRooms += f.rooms.length;
    for (const r of f.rooms) {
      totalBeds += r.beds.length;
      for (const b of r.beds) {
        if (b.tenant || b.status === "occupied" || b.status === "notice" || b.status === "reserved") {
          totalTenants++;
        }
      }
    }
  }

  const isMatched = confirmName.trim() === pg.name.trim();

  const handleClose = () => {
    if (loading) return;
    setConfirmName("");
    setError("");
    onClose();
  };

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMatched) {
      setError("The PG name entered does not match.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await onConfirm(pg.id);
      setConfirmName("");
      onClose();
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || "Could not delete property. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="fixed inset-0" onClick={handleClose} />

      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-red-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-red-950">Delete Property</h3>
              <p className="text-xs text-red-700/80">Permanent, irreversible action</p>
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

        <form onSubmit={handleDelete} className="p-5 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Are you sure you want to delete <span className="font-bold text-slate-900">{pg.name}</span>?
            This will permanently remove the property along with all associated data:
          </p>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs text-slate-700">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-600">Floors</span>
              <span className="font-bold text-slate-900">{pg.floors.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-600">Rooms</span>
              <span className="font-bold text-slate-900">{totalRooms}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-600">Beds</span>
              <span className="font-bold text-slate-900">{totalBeds}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-600">Active / Resident Tenants</span>
              <span className="font-bold text-red-600">{totalTenants}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-800">
              Type <span className="font-mono font-bold select-all text-slate-900">"{pg.name}"</span> to confirm:
            </label>
            <input
              type="text"
              autoFocus
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={pg.name}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-500 font-medium"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 font-semibold">{error}</p>
          )}

          <div className="pt-2 flex items-center justify-end gap-2.5">
            {/* Cancel is default button */}
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
              disabled={!isMatched || loading}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white text-xs font-bold transition shadow-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{loading ? "Deleting..." : "Permanently Delete PG"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
