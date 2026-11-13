"use client";

import React, { useState, useEffect, useRef } from "react";
import { Room, Floor } from "@/lib/types";
import { sanitizeNonNegative } from "@/lib/utils";
import {
  X,
  Edit3,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Save,
  ArrowRightLeft,
} from "lucide-react";

interface EditRoomModalProps {
  room: Room | null;
  floor: Floor | null;
  allFloors: Floor[];
  allRooms: Room[];
  isOpen: boolean;
  onClose: () => void;
  onSaveRoom: (
    roomId: string,
    updates: {
      name: string;
      sharingType: number;
      isAc: boolean;
      hasAttachedBathroom: boolean;
      amenities: string[];
      customRent?: number | null;
    }
  ) => Promise<void>;
  onMoveRoom: (roomId: string, targetFloorId: string) => Promise<void>;
  onDeleteRoom: (roomId: string) => Promise<void>;
}

const AMENITY_OPTIONS = [
  "Wooden Cot",
  "Comfort Mattress",
  "Personal Cupboard",
  "Study Table & Chair",
  "Balcony",
  "Hot Water / Geyser",
];

export default function EditRoomModal({
  room,
  floor,
  allFloors,
  allRooms,
  isOpen,
  onClose,
  onSaveRoom,
  onMoveRoom,
  onDeleteRoom,
}: EditRoomModalProps) {
  const formRef = useRef<HTMLFormElement>(null);

  const [name, setName] = useState("");
  const [sharingCount, setSharingCount] = useState<number>(2);
  const [isAc, setIsAc] = useState<boolean>(false);
  const [hasAttached, setHasAttached] = useState<boolean>(true);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [customRent, setCustomRent] = useState<string>("");

  const [targetFloorId, setTargetFloorId] = useState<string>("");

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [moveLoading, setMoveLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (room && floor) {
      setName(room.name || "");
      setSharingCount(room.sharingType || 2);
      setIsAc(room.isAc ?? false);
      setHasAttached(room.hasAttachedBathroom ?? true);
      setAmenities(
        room.amenities || [
          "Wooden Cot",
          "Comfort Mattress",
          "Personal Cupboard",
        ]
      );
      setCustomRent(
        room.customRent !== undefined && room.customRent !== null
          ? String(room.customRent)
          : ""
      );
      setTargetFloorId(floor.id);
      setTouched({});
      setError("");
      setSuccess("");
    }
  }, [room, floor]);

  if (!isOpen || !room || !floor) return null;

  // Validation
  const validateName = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) return "Room name / number is required.";
    // Duplicate check within PG (excluding current room itself)
    const isDuplicate = allRooms.some(
      (r) =>
        r.id !== room.id &&
        r.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (isDuplicate) {
      return `A room named "${trimmed}" already exists in this PG. Room names must be unique.`;
    }
    return "";
  };

  const nameError = validateName(name);

  const toggleAmenity = (item: string) => {
    setAmenities((prev) =>
      prev.includes(item) ? prev.filter((a) => a !== item) : [...prev, item]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ name: true });

    if (nameError) {
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await onSaveRoom(room.id, {
        name: name.trim(),
        sharingType: sharingCount,
        isAc,
        hasAttachedBathroom: hasAttached,
        amenities,
        customRent: customRent.trim()
          ? sanitizeNonNegative(customRent, 0)
          : null,
      });

      setSuccess("Room updated successfully!");
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || "Failed to update room details.");
    } finally {
      setLoading(false);
    }
  };

  const handleMoveFloor = async () => {
    if (!targetFloorId || targetFloorId === floor.id) return;
    setMoveLoading(true);
    setError("");
    try {
      await onMoveRoom(room.id, targetFloorId);
      setSuccess("Room moved to new floor!");
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || "Could not move room.");
    } finally {
      setMoveLoading(false);
    }
  };

  const handleDelete = async () => {
    // Check if room beds have active tenants
    const hasActiveTenant = room.beds.some(
      (b) =>
        b.status === "occupied" ||
        b.status === "notice" ||
        b.status === "reserved" ||
        b.tenant
    );

    if (hasActiveTenant) {
      setError(
        "Cannot delete this room: one or more beds currently have active residents or notice tenants. Vacate all beds first."
      );
      return;
    }

    if (
      !confirm(
        `Are you sure you want to delete Room "${room.name}" and all its beds? This cannot be undone.`
      )
    ) {
      return;
    }

    setDeleteLoading(true);
    setError("");
    try {
      await onDeleteRoom(room.id);
      onClose();
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || "Could not delete room.");
    } finally {
      setDeleteLoading(false);
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
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Edit Room {room.name}
              </h3>
              <p className="text-xs text-slate-500">
                Floor: {floor.name} • {room.sharingType}-Sharing
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading || moveLoading || deleteLoading}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form ref={formRef} onSubmit={handleSave} className="p-5 space-y-4" noValidate>
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Room Name with inline unique validation */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Room Number / Name *
              {touched.name && !nameError && (
                <CheckCircle2 className="inline w-3 h-3 text-emerald-500 ml-1" />
              )}
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setTouched((p) => ({ ...p, name: true }))}
              placeholder="e.g. 101, 102-A"
              className={`w-full px-3 py-2 text-xs font-bold rounded-xl border bg-white focus:outline-none focus:ring-2 transition ${touched.name && nameError
                ? "border-red-400 focus:ring-red-400"
                : "border-slate-300 focus:ring-teal-500"
                }`}
            />
            {touched.name && nameError && (
              <p className="mt-1 text-[10px] text-red-600 font-semibold flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                {nameError}
              </p>
            )}
          </div>

          {/* Sharing Count */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
              Sharing Count (Beds)
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
              {[1, 2, 3, 4, 5, 6].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setSharingCount(num)}
                  className={`py-1.5 rounded-lg text-xs font-bold border transition ${sharingCount === num
                    ? "bg-teal-600 text-white border-teal-600"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                >
                  {num} Beds
                </button>
              ))}
            </div>
            {sharingCount < room.sharingType && (
              <p className="text-[10px] text-amber-700 mt-1 font-medium">
                Note: Reducing sharing count will delete the extra beds from Supabase.
              </p>
            )}
          </div>

          {/* AC & Attached Bathroom Toggles */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setIsAc(!isAc)}
              className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${isAc
                ? "bg-teal-50 text-teal-800 border-teal-300"
                : "bg-white text-slate-600 border-slate-200"
                }`}
            >
              {isAc ? "✓ AC Room" : "+ Non-AC"}
            </button>

            <button
              type="button"
              onClick={() => setHasAttached(!hasAttached)}
              className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${hasAttached
                ? "bg-teal-50 text-teal-800 border-teal-300"
                : "bg-white text-slate-600 border-slate-200"
                }`}
            >
              {hasAttached ? "✓ Attached Bath" : "+ Common Bath"}
            </button>
          </div>

          {/* Amenities */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
              Room Amenities
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {AMENITY_OPTIONS.map((item) => {
                const checked = amenities.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleAmenity(item)}
                    className={`flex items-center gap-1.5 p-2 rounded-lg border text-left text-xs font-medium transition ${checked
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
          </div>

          {/* Custom Rent */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Custom Monthly Rent (₹ / Bed) (Optional)
            </label>
            <div className="flex items-center rounded-xl border border-slate-300 bg-white overflow-hidden max-w-xs focus-within:ring-2 focus-within:ring-teal-500">
              <span className="px-3 text-xs font-bold text-slate-500">₹</span>
              <input
                type="number"
                min="0"
                step={500}
                value={customRent}
                onChange={(e) => setCustomRent(e.target.value)}
                placeholder="Standard rent applies"
                className="w-full px-2 py-2 text-xs font-bold focus:outline-none"
              />
            </div>
          </div>

          {/* Move to another floor section */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <label className="block text-[11px] font-bold text-slate-700 flex items-center gap-1">
              <ArrowRightLeft className="w-3.5 h-3.5 text-teal-600" />
              Move this room to another floor
            </label>
            <div className="flex gap-2">
              <select
                value={targetFloorId}
                onChange={(e) => setTargetFloorId(e.target.value)}
                className="flex-1 px-3 py-2 text-xs font-medium rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {allFloors.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} {f.id === floor.id ? "(Current)" : ""}
                  </option>
                ))}
              </select>

              <button
                type="button"
                disabled={moveLoading || targetFloorId === floor.id}
                onClick={handleMoveFloor}
                className="px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 text-xs font-bold text-slate-700 transition"
              >
                {moveLoading ? "Moving..." : "Move"}
              </button>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteLoading}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{deleteLoading ? "Deleting..." : "Delete Room"}</span>
            </button>

            <div className="flex items-center gap-2">
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
                <Save className="w-3.5 h-3.5" />
                <span>{loading ? "Saving..." : "Save Room"}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}