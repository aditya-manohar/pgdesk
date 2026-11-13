"use client";

import React, { useState } from "react";
import { Floor } from "@/lib/types";
import { X, Plus, AlertCircle, CheckCircle2, Sparkles } from "lucide-react";

interface AddRoomsToFloorModalProps {
  floor: Floor | null;
  isOpen: boolean;
  onClose: () => void;
  onAddRooms: (
    floorId: string,
    roomsData: Array<{
      name: string;
      sharingType: number;
      isAc: boolean;
      hasAttachedBathroom: boolean;
      amenities?: string[];
      customRent?: number;
    }>
  ) => Promise<{ skippedNames: string[] }>;
}

export default function AddRoomsToFloorModal({
  floor,
  isOpen,
  onClose,
  onAddRooms,
}: AddRoomsToFloorModalProps) {
  const [method, setMethod] = useState<"quick" | "custom">("quick");

  // Quick generate state
  const [roomCount, setRoomCount] = useState<number>(4);
  const [startNumber, setStartNumber] = useState<number>(101);
  const [prefix, setPrefix] = useState<string>("");

  // Custom names state
  const [customNamesText, setCustomNamesText] = useState<string>("");

  // Common room config
  const [sharingType, setSharingType] = useState<number>(2);
  const [isAc, setIsAc] = useState<boolean>(false);
  const [hasAttached, setHasAttached] = useState<boolean>(true);

  // Status
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [successInfo, setSuccessInfo] = useState<{
    added: number;
    skipped: string[];
  } | null>(null);

  if (!isOpen || !floor) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessInfo(null);

    const generatedNames: string[] = [];
    if (method === "quick") {
      if (roomCount < 1 || roomCount > 50) {
        setError("Please generate between 1 and 50 rooms at a time.");
        return;
      }
      for (let i = 0; i < roomCount; i++) {
        const num = startNumber + i;
        generatedNames.push(prefix ? `${prefix}${num}` : String(num));
      }
    } else {
      const parsed = customNamesText
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (parsed.length === 0) {
        setError("Please enter at least one room name.");
        return;
      }
      generatedNames.push(...parsed);
    }

    const payload = generatedNames.map((name) => ({
      name,
      sharingType,
      isAc,
      hasAttachedBathroom: hasAttached,
      amenities: ["cot", "mattress", "cupboard"],
    }));

    setLoading(true);
    try {
      const res = await onAddRooms(floor.id, payload);
      const addedCount = generatedNames.length - (res.skippedNames?.length || 0);

      setSuccessInfo({
        added: addedCount,
        skipped: res.skippedNames || [],
      });

      if (addedCount > 0 && (!res.skippedNames || res.skippedNames.length === 0)) {
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || "Failed to add rooms to floor.");
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
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Plus className="w-5 h-5 text-teal-600" />
              <span>Add Rooms to {floor.name}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Quickly create multiple rooms with auto-created beds
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successInfo && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                Successfully added {successInfo.added} room(s)!
              </p>
              {successInfo.skipped.length > 0 && (
                <p className="text-[11px] text-amber-800 font-medium">
                  Skipped existing rooms: {successInfo.skipped.join(", ")}
                </p>
              )}
            </div>
          )}

          {/* Mode Tabs */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl gap-1">
            <button
              type="button"
              onClick={() => setMethod("quick")}
              className={`py-2 text-xs font-bold rounded-lg transition ${
                method === "quick"
                  ? "bg-white text-teal-800 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Sequence Generator
            </button>
            <button
              type="button"
              onClick={() => setMethod("custom")}
              className={`py-2 text-xs font-bold rounded-lg transition ${
                method === "custom"
                  ? "bg-white text-teal-800 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Custom Names / List
            </button>
          </div>

          {/* Method: Quick Sequence */}
          {method === "quick" ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Prefix (Opt.)
                  </label>
                  <input
                    type="text"
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value)}
                    placeholder="e.g. 10 or G-"
                    className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Start Number *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={startNumber}
                    onChange={(e) => setStartNumber(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Count *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="50"
                    value={roomCount}
                    onChange={(e) => setRoomCount(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <p className="text-[11px] text-slate-500 font-medium">
                Preview: {prefix}{startNumber}, {prefix}{startNumber + 1}... up to{" "}
                {prefix}{startNumber + roomCount - 1} ({roomCount} rooms total)
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Room Names (comma or new-line separated) *
              </label>
              <textarea
                rows={3}
                required
                value={customNamesText}
                onChange={(e) => setCustomNamesText(e.target.value)}
                placeholder="e.g. 101, 102, 103, Suite A"
                className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          )}

          {/* Room configuration for new rooms */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Room Defaults (Applied to all created rooms)
            </p>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                Sharing Count (Beds per Room)
              </label>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                {[1, 2, 3, 4, 5, 6].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setSharingType(count)}
                    className={`py-1.5 rounded-lg text-xs font-bold border transition ${
                      sharingType === count
                        ? "bg-teal-600 text-white border-teal-600"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {count} Beds
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsAc(!isAc)}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                  isAc
                    ? "bg-teal-50 text-teal-800 border-teal-300"
                    : "bg-white text-slate-600 border-slate-200"
                }`}
              >
                {isAc ? "✓ AC Room" : "+ Non-AC"}
              </button>

              <button
                type="button"
                onClick={() => setHasAttached(!hasAttached)}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                  hasAttached
                    ? "bg-teal-50 text-teal-800 border-teal-300"
                    : "bg-white text-slate-600 border-slate-200"
                }`}
              >
                {hasAttached ? "✓ Attached Bath" : "+ Common Bath"}
              </button>
            </div>
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
              <Sparkles className="w-3.5 h-3.5" />
              <span>{loading ? "Creating..." : "Generate Rooms & Beds"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
