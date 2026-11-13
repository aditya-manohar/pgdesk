"use client";

import React, { useState } from "react";
import { X, Sliders, CheckCircle2, AlertCircle } from "lucide-react";

interface BulkEditRoomsModalProps {
  isOpen: boolean;
  selectedRoomIds: string[];
  totalRoomsSelected: number;
  onClose: () => void;
  onConfirm: (updates: {
    isAc?: boolean;
    hasAttachedBathroom?: boolean;
    amenities?: string[];
    customRent?: number | null;
  }) => Promise<void>;
}

const AMENITIES_OPTIONS = [
  "Wooden Cot",
  "Comfort Mattress",
  "Personal Cupboard",
  "Study Table & Chair",
  "Balcony",
  "Hot Water / Geyser",
];

export default function BulkEditRoomsModal({
  isOpen,
  selectedRoomIds,
  totalRoomsSelected,
  onClose,
  onConfirm,
}: BulkEditRoomsModalProps) {
  const [modifyAc, setModifyAc] = useState(false);
  const [isAc, setIsAc] = useState(true);

  const [modifyBathroom, setModifyBathroom] = useState(false);
  const [hasAttached, setHasAttached] = useState(true);

  const [modifyRent, setModifyRent] = useState(false);
  const [customRent, setCustomRent] = useState("");

  const [modifyAmenities, setModifyAmenities] = useState(false);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([
    "Wooden Cot",
    "Comfort Mattress",
    "Personal Cupboard",
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen || totalRoomsSelected === 0) return null;

  const toggleAmenity = (name: string) => {
    setSelectedAmenities((prev) =>
      prev.includes(name) ? prev.filter((a) => a !== name) : [...prev, name]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modifyAc && !modifyBathroom && !modifyRent && !modifyAmenities) {
      setError("Please check at least one attribute to update.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const updates: {
        isAc?: boolean;
        hasAttachedBathroom?: boolean;
        amenities?: string[];
        customRent?: number | null;
      } = {};

      if (modifyAc) updates.isAc = isAc;
      if (modifyBathroom) updates.hasAttachedBathroom = hasAttached;
      if (modifyRent) {
        updates.customRent = customRent.trim()
          ? Math.max(0, Number(customRent))
          : null;
      }
      if (modifyAmenities) updates.amenities = selectedAmenities;

      await onConfirm(updates);
      onClose();
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || "Failed to bulk update rooms.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150 my-6">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Bulk Edit Rooms
              </h3>
              <p className="text-xs text-teal-700 font-semibold">
                {totalRoomsSelected} room{totalRoomsSelected > 1 ? "s" : ""} selected to change
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <p className="text-xs text-slate-500">
            Select the properties you want to update across all {totalRoomsSelected} selected rooms:
          </p>

          {/* AC / Non-AC */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={modifyAc}
                onChange={(e) => setModifyAc(e.target.checked)}
                className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
              />
              <span className="text-xs font-bold text-slate-800">
                Update AC / Non-AC Setting
              </span>
            </label>

            {modifyAc && (
              <div className="grid grid-cols-2 gap-2 pt-1 pl-6">
                <button
                  type="button"
                  onClick={() => setIsAc(true)}
                  className={`py-2 px-3 rounded-lg text-xs font-bold border transition ${
                    isAc
                      ? "bg-teal-600 text-white border-teal-600"
                      : "bg-white text-slate-600 border-slate-200"
                  }`}
                >
                  AC Room
                </button>
                <button
                  type="button"
                  onClick={() => setIsAc(false)}
                  className={`py-2 px-3 rounded-lg text-xs font-bold border transition ${
                    !isAc
                      ? "bg-teal-600 text-white border-teal-600"
                      : "bg-white text-slate-600 border-slate-200"
                  }`}
                >
                  Non-AC Room
                </button>
              </div>
            )}
          </div>

          {/* Bathroom */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={modifyBathroom}
                onChange={(e) => setModifyBathroom(e.target.checked)}
                className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
              />
              <span className="text-xs font-bold text-slate-800">
                Update Bathroom Type
              </span>
            </label>

            {modifyBathroom && (
              <div className="grid grid-cols-2 gap-2 pt-1 pl-6">
                <button
                  type="button"
                  onClick={() => setHasAttached(true)}
                  className={`py-2 px-3 rounded-lg text-xs font-bold border transition ${
                    hasAttached
                      ? "bg-teal-600 text-white border-teal-600"
                      : "bg-white text-slate-600 border-slate-200"
                  }`}
                >
                  Attached Bathroom
                </button>
                <button
                  type="button"
                  onClick={() => setHasAttached(false)}
                  className={`py-2 px-3 rounded-lg text-xs font-bold border transition ${
                    !hasAttached
                      ? "bg-teal-600 text-white border-teal-600"
                      : "bg-white text-slate-600 border-slate-200"
                  }`}
                >
                  Common Bathroom
                </button>
              </div>
            )}
          </div>

          {/* Custom Rent */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={modifyRent}
                onChange={(e) => setModifyRent(e.target.checked)}
                className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
              />
              <span className="text-xs font-bold text-slate-800">
                Update Custom Rent
              </span>
            </label>

            {modifyRent && (
              <div className="pt-1 pl-6">
                <div className="flex items-center rounded-xl border border-slate-300 bg-white overflow-hidden max-w-xs">
                  <span className="px-3 text-xs font-bold text-slate-500">₹</span>
                  <input
                    type="number"
                    min="0"
                    step={500}
                    value={customRent}
                    onChange={(e) => setCustomRent(e.target.value)}
                    placeholder="Clear for standard PG rent"
                    className="w-full px-2 py-2 text-xs font-bold focus:outline-none"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Leave empty to reset these rooms to the PG default pricing.
                </p>
              </div>
            )}
          </div>

          {/* Amenities */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={modifyAmenities}
                onChange={(e) => setModifyAmenities(e.target.checked)}
                className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
              />
              <span className="text-xs font-bold text-slate-800">
                Update Room Amenities
              </span>
            </label>

            {modifyAmenities && (
              <div className="grid grid-cols-2 gap-1.5 pt-1 pl-6">
                {AMENITIES_OPTIONS.map((item) => {
                  const checked = selectedAmenities.includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggleAmenity(item)}
                      className={`flex items-center gap-1.5 p-2 rounded-lg border text-left text-xs font-medium transition ${
                        checked
                          ? "bg-teal-50 border-teal-300 text-teal-900 font-bold"
                          : "bg-white border-slate-200 text-slate-600"
                      }`}
                    >
                      <span className="text-[10px]">{checked ? "✓" : "○"}</span>
                      <span className="truncate">{item}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Confirmation Notice */}
          <div className="p-3 bg-teal-50/60 border border-teal-200 rounded-xl text-xs text-teal-900">
            <span className="font-bold">Summary:</span> This will update{" "}
            <span className="font-bold underline">{totalRoomsSelected} rooms</span> in one targeted save.
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold transition shadow-xs"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{loading ? "Updating..." : `Save Changes to ${totalRoomsSelected} Rooms`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
