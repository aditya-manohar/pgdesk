"use client";

import React, { useState, useEffect } from "react";
import { Room, Floor } from "@/lib/types";
import { formatINR, sanitizeNonNegative } from "@/lib/utils";
import {
  X,
  Edit3,
  Users,
  Plus,
  Trash2,
  ShieldAlert,
  Wind,
  Bath,
  Check,
  IndianRupee,
} from "lucide-react";

type ModalMode = "edit_room" | "rename" | "sharing" | "add_room";

interface RoomActionsModalProps {
  mode: ModalMode;
  room?: Room | null;
  floor?: Floor | null;
  onClose: () => void;
  onUpdateRoomDetails?: (
    roomId: string,
    updates: {
      name?: string;
      sharingType?: number;
      isAc?: boolean;
      hasAttachedBathroom?: boolean;
      amenities?: string[];
      customRent?: number;
    }
  ) => Promise<void>;
  onRename?: (roomId: string, newName: string) => Promise<void>;
  onChangeSharing?: (roomId: string, newSharing: number) => Promise<void>;
  onAddRoom?: (
    floorId: string,
    roomData: {
      name: string;
      sharingType: number;
      isAc: boolean;
      hasAttachedBathroom: boolean;
      customRent?: number;
    }
  ) => Promise<void>;
  onDeleteRoom?: (roomId: string) => Promise<void>;
}

const AMENITY_OPTIONS = [
  "Wooden Cot",
  "Comfort Mattress",
  "Personal Cupboard",
  "Study Table & Chair",
  "Balcony",
  "Hot Water / Geyser",
];

export default function RoomActionsModal({
  mode,
  room,
  floor,
  onClose,
  onUpdateRoomDetails,
  onRename,
  onChangeSharing,
  onAddRoom,
  onDeleteRoom,
}: RoomActionsModalProps) {
  // State for room edits
  const [name, setName] = useState(room?.name || "");
  const [sharingCount, setSharingCount] = useState<number>(room?.sharingType || 2);
  const [isAc, setIsAc] = useState<boolean>(room?.isAc ?? false);
  const [hasAttached, setHasAttached] = useState<boolean>(room?.hasAttachedBathroom ?? true);
  const [amenities, setAmenities] = useState<string[]>(
    room?.amenities || ["Wooden Cot", "Comfort Mattress", "Personal Cupboard"]
  );
  const [customRent, setCustomRent] = useState<string>(
    room?.customRent !== undefined ? String(room.customRent) : ""
  );

  // Add room state
  const [addName, setAddName] = useState("");
  const [addSharing, setAddSharing] = useState<number>(2);
  const [addIsAc, setAddIsAc] = useState<boolean>(false);
  const [addHasAttached, setAddHasAttached] = useState<boolean>(true);
  const [addCustomRent, setAddCustomRent] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (room) {
      setName(room.name);
      setSharingCount(room.sharingType);
      setIsAc(room.isAc);
      setHasAttached(room.hasAttachedBathroom);
      setAmenities(room.amenities || ["Wooden Cot", "Comfort Mattress", "Personal Cupboard"]);
      setCustomRent(room.customRent !== undefined ? String(room.customRent) : "");
    }
  }, [room]);

  const toggleAmenity = (item: string) => {
    if (amenities.includes(item)) {
      setAmenities(amenities.filter((a) => a !== item));
    } else {
      setAmenities([...amenities, item]);
    }
  };

  // Full Room Update Submit
  const handleFullRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!room || !onUpdateRoomDetails) return;
    if (!name.trim()) {
      setError("Please enter a room name / number.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await onUpdateRoomDetails(room.id, {
        name: name.trim(),
        sharingType: sharingCount,
        isAc,
        hasAttachedBathroom: hasAttached,
        amenities,
        customRent: customRent.trim() ? sanitizeNonNegative(customRent, 0) : undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to update room.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!floor || !onAddRoom) return;
    if (!addName.trim()) {
      setError("Please enter a room name / number.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await onAddRoom(floor.id, {
        name: addName.trim(),
        sharingType: addSharing,
        isAc: addIsAc,
        hasAttachedBathroom: addHasAttached,
        customRent: addCustomRent.trim() ? sanitizeNonNegative(addCustomRent, 0) : undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to add room.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRoom = async () => {
    if (!room || !onDeleteRoom) return;
    if (!confirm(`Are you sure you want to delete Room "${room.name}"?`)) return;

    setLoading(true);
    setError("");
    try {
      await onDeleteRoom(room.id);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to delete room.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-200 my-8">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              {mode === "add_room" ? (
                <>
                  <Plus className="w-5 h-5 text-teal-600" />
                  <span>Add Room to {floor?.name}</span>
                </>
              ) : (
                <>
                  <Edit3 className="w-5 h-5 text-teal-600" />
                  <span>Customize Room {room?.name}</span>
                </>
              )}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {floor?.name} • Configure sharing, amenities & pricing
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="m-5 mb-0 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* MODE: EDIT FULL ROOM */}
        {(mode === "edit_room" || mode === "rename" || mode === "sharing") && (
          <form onSubmit={handleFullRoomSubmit} className="p-6 space-y-5">
            {/* Room Name */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Room Number / Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. 101, 101-A, Deluxe Master"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm font-bold text-slate-900"
              />
            </div>

            {/* Sharing Count (1 to 8) */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                Sharing Count (Beds in Room)
              </label>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {[1, 2, 3, 4, 5, 6].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setSharingCount(num)}
                    className={`py-2 rounded-xl text-xs font-bold border transition ${
                      sharingCount === num
                        ? "bg-teal-600 text-white border-teal-600 shadow-xs"
                        : "bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    {num}-Bed
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Changing sharing will automatically add beds or safely reduce empty beds.
              </p>
            </div>

            {/* AC & Attached Bath */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => setIsAc(!isAc)}
                className={`py-3 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 transition ${
                  isAc
                    ? "bg-teal-50 text-teal-800 border-teal-300 shadow-2xs"
                    : "bg-slate-50 text-slate-600 border-slate-200"
                }`}
              >
                <Wind className="w-4 h-4 text-teal-600" />
                <span>{isAc ? "✓ AC Room" : "Non-AC"}</span>
              </button>

              <button
                type="button"
                onClick={() => setHasAttached(!hasAttached)}
                className={`py-3 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 transition ${
                  hasAttached
                    ? "bg-teal-50 text-teal-800 border-teal-300 shadow-2xs"
                    : "bg-slate-50 text-slate-600 border-slate-200"
                }`}
              >
                <Bath className="w-4 h-4 text-teal-600" />
                <span>{hasAttached ? "✓ Attached Washroom" : "Common Washroom"}</span>
              </button>
            </div>

            {/* Amenities Checklist */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Room Amenities
              </label>
              <div className="grid grid-cols-2 gap-2">
                {AMENITY_OPTIONS.map((item) => {
                  const isChecked = amenities.includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggleAmenity(item)}
                      className={`p-2 rounded-xl text-xs font-medium border text-left flex items-center justify-between transition ${
                        isChecked
                          ? "bg-teal-50 text-teal-800 border-teal-300 font-semibold"
                          : "bg-white text-slate-600 border-slate-200"
                      }`}
                    >
                      <span>{item}</span>
                      {isChecked && <Check className="w-3.5 h-3.5 text-teal-600" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Rent Override (No Negatives Allowed) */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Room Rent Override (₹ / Bed / Month)
                <span className="text-[10px] text-slate-400 font-normal ml-1">
                  (Optional - Leave blank to use PG default)
                </span>
              </label>
              <div className="flex items-center rounded-xl border border-slate-300 bg-white overflow-hidden">
                <span className="px-3 text-sm font-bold text-slate-500">₹</span>
                <input
                  type="number"
                  min="0"
                  onKeyDown={(e) => {
                    if (e.key === "-" || e.key === "e") e.preventDefault();
                  }}
                  step={500}
                  value={customRent}
                  onChange={(e) => setCustomRent(e.target.value)}
                  placeholder="e.g. 9000"
                  className="w-full px-2 py-2 text-sm font-bold text-slate-900 focus:outline-none"
                />
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm transition shadow-xs"
              >
                {loading ? "Saving Changes..." : "Save Room Details"}
              </button>

              {onDeleteRoom && (
                <button
                  type="button"
                  onClick={handleDeleteRoom}
                  disabled={loading}
                  className="p-3 text-red-600 hover:bg-red-50 rounded-xl border border-red-200 transition"
                  title="Delete Room"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>
          </form>
        )}

        {/* MODE: ADD ROOM */}
        {mode === "add_room" && (
          <form onSubmit={handleAddRoomSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Room Name or Number *
              </label>
              <input
                type="text"
                required
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="e.g. 104, Suite 2"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Sharing Count (Beds)
              </label>
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setAddSharing(num)}
                    className={`py-2 rounded-xl text-xs font-bold border transition ${
                      addSharing === num
                        ? "bg-teal-600 text-white border-teal-600"
                        : "bg-slate-50 text-slate-700 border-slate-300"
                    }`}
                  >
                    {num} Beds
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setAddIsAc(!addIsAc)}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition ${
                  addIsAc
                    ? "bg-teal-50 text-teal-800 border-teal-300"
                    : "bg-white text-slate-600 border-slate-200"
                }`}
              >
                {addIsAc ? "✓ AC Room" : "+ Non-AC"}
              </button>

              <button
                type="button"
                onClick={() => setAddHasAttached(!addHasAttached)}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition ${
                  addHasAttached
                    ? "bg-teal-50 text-teal-800 border-teal-300"
                    : "bg-white text-slate-600 border-slate-200"
                }`}
              >
                {addHasAttached ? "✓ Attached Bath" : "+ Common Bath"}
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Custom Rent (₹ / Bed) (Optional)
              </label>
              <div className="flex items-center rounded-xl border border-slate-300 bg-white overflow-hidden">
                <span className="px-3 text-sm font-bold text-slate-500">₹</span>
                <input
                  type="number"
                  min="0"
                  onKeyDown={(e) => {
                    if (e.key === "-" || e.key === "e") e.preventDefault();
                  }}
                  value={addCustomRent}
                  onChange={(e) => setAddCustomRent(e.target.value)}
                  placeholder="Leave empty for standard rent"
                  className="w-full px-2 py-2 text-sm font-bold focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm transition"
            >
              {loading ? "Adding Room..." : "Create Room & Auto-Add Beds"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
