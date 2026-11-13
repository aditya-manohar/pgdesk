"use client";

export const dynamic = 'force-dynamic';

import React, { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getCurrentOwner } from "@/lib/data/auth";
import {
  getPGById,
  updateBedStatus,
  updateBedDetails,
  updateRoomDetails,
  renameRoom,
  changeRoomSharing,
  addRoom,
  deleteRoom,
  deleteBed,
  saveTenant,
  vacateTenant,
  renameFloor,
  reorderFloors,
  addFloor,
  deleteFloor,
  moveRoomToFloor,
  bulkUpdateRooms,
  addMultipleRoomsToFloor,
} from "@/lib/data/pgStore";
import { Owner, PGProperty, Floor, Room, Bed, BedUpdates, BedStatus, TenantStatus } from "@/lib/types";
import { formatINR, getBedRent } from "@/lib/utils";
import Navbar from "@/components/Navbar";
import BedDetailsDrawer from "@/components/BedDetailsDrawer";
import EditRoomModal from "@/components/EditRoomModal";
import DeleteFloorModal from "@/components/DeleteFloorModal";
import AddRoomsToFloorModal from "@/components/AddRoomsToFloorModal";
import BulkEditRoomsModal from "@/components/BulkEditRoomsModal";
import {
  ArrowLeft,
  Building2,
  Filter,
  Plus,
  Search,
  Wrench,
  CheckCircle2,
  Clock,
  Bookmark,
  Layers,
  MoreVertical,
  Wind,
  Bath,
  Edit2,
  Users,
  ChevronDown,
  Sliders,
  ChevronUp,
  Trash2,
  CheckSquare,
  Square,
  AlertCircle,
  Settings2,
} from "lucide-react";

export default function BedMapPage() {
  const params = useParams();
  const router = useRouter();
  const pgId = params?.id as string;

  const [owner, setOwner] = useState<Owner | null>(null);
  const [pg, setPg] = useState<PGProperty | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit Layout Mode toggle
  const [isEditMode, setIsEditMode] = useState<boolean>(false);

  // Filters
  const [selectedFloorId, setSelectedFloorId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all"); // 'all' | 'vacant' | 'occupied' | 'notice' | 'maintenance'
  const [sharingFilter, setSharingFilter] = useState<string | number>("all"); // 'all' | 1 | 2 | 3 | 4 | 5
  const [acOnly, setAcOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Bulk Selection state for rooms (in edit mode)
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);

  // Floor inline editing state
  const [editingFloorId, setEditingFloorId] = useState<string | null>(null);
  const [editingFloorName, setEditingFloorName] = useState<string>("");

  // Modals state
  const [activeBed, setActiveBed] = useState<{
    bed: Bed;
    room: Room;
    floor: Floor;
  } | null>(null);

  const [editRoomModal, setEditRoomModal] = useState<{
    isOpen: boolean;
    room: Room | null;
    floor: Floor | null;
  }>({
    isOpen: false,
    room: null,
    floor: null,
  });

  const [deleteFloorModal, setDeleteFloorModal] = useState<{
    isOpen: boolean;
    floor: Floor | null;
  }>({
    isOpen: false,
    floor: null,
  });

  const [addRoomsModal, setAddRoomsModal] = useState<{
    isOpen: boolean;
    floor: Floor | null;
  }>({
    isOpen: false,
    floor: null,
  });

  const [bulkEditModalOpen, setBulkEditModalOpen] = useState(false);

  // Inline "Add Floor" prompt state
  const [isAddingFloor, setIsAddingFloor] = useState(false);
  const [newFloorName, setNewFloorName] = useState("");

  // Toast / feedback message
  const [toastMessage, setToastMessage] = useState<string>("");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

  const loadData = async () => {
    const current = await getCurrentOwner();
    if (!current) {
      router.push("/auth/login");
      return;
    }
    setOwner(current);

    const property = await getPGById(current.id, pgId);
    if (!property) {
      router.push("/");
      return;
    }
    setPg(property);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [pgId]);

  // Keep activeBed in sync if pg changes
  const refreshActiveBed = (freshPg: PGProperty, bedId: string) => {
    for (const f of freshPg.floors) {
      for (const r of f.rooms) {
        const foundBed = r.beds.find((b) => b.id === bedId);
        if (foundBed) {
          setActiveBed({ bed: foundBed, room: r, floor: f });
          return;
        }
      }
    }
  };

  // ──────────────────────────────────────────────
  // Bed details handlers
  // ──────────────────────────────────────────────
  const handleUpdateBedDetails = async (bedId: string, updates: BedUpdates) => {
    if (!owner || !pg) return;
    const updated = await updateBedDetails(owner.id, pg.id, bedId, updates);
    setPg(updated);
    refreshActiveBed(updated, bedId);
    showToast("Bed details updated!");
  };

  const handleDeleteBed = async (bedId: string) => {
    if (!owner || !pg) return;
    const updated = await deleteBed(owner.id, pg.id, bedId);
    setPg(updated);
    setActiveBed(null);
    showToast("Bed removed from room.");
  };

  const handleAssignOrUpdateTenant = async (
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
  ): Promise<string | undefined> => {
    if (!owner || !pg) return undefined;
    const res = await saveTenant(owner.id, pg.id, bedId, tenantData);
    setPg(res.pg);
    refreshActiveBed(res.pg, bedId);
    return res.tenant.id;
  };

  const handleVacateTenant = async (bedId: string, tenantId: string) => {
    if (!owner || !pg) return;
    const updated = await vacateTenant(owner.id, pg.id, bedId, tenantId);
    setPg(updated);
    refreshActiveBed(updated, bedId);
  };

  // ──────────────────────────────────────────────
  // Floor operations
  // ──────────────────────────────────────────────
  const handleStartRenameFloor = (floor: Floor) => {
    setEditingFloorId(floor.id);
    setEditingFloorName(floor.name);
  };

  const handleSaveFloorName = async (floorId: string) => {
    if (!owner || !pg) return;
    const trimmed = editingFloorName.trim();
    if (!trimmed) {
      setEditingFloorId(null);
      return;
    }
    try {
      const updated = await renameFloor(owner.id, pg.id, floorId, trimmed);
      setPg(updated);
      setEditingFloorId(null);
      showToast(`Renamed to "${trimmed}"`);
    } catch (e: unknown) {
      alert((e as Error).message || "Could not rename floor.");
    }
  };

  const handleReorderFloor = async (floorIndex: number, direction: "up" | "down") => {
    if (!owner || !pg) return;
    const sortedFloors = [...pg.floors].sort((a, b) => a.order - b.order);
    const targetIndex = direction === "up" ? floorIndex - 1 : floorIndex + 1;
    if (targetIndex < 0 || targetIndex >= sortedFloors.length) return;

    const currentFloor = sortedFloors[floorIndex];
    const targetFloor = sortedFloors[targetIndex];

    const currentOrder = currentFloor.order;
    const targetOrder = targetFloor.order;

    try {
      const updated = await reorderFloors(owner.id, pg.id, [
        { id: currentFloor.id, order: targetOrder },
        { id: targetFloor.id, order: currentOrder },
      ]);
      setPg(updated);
      showToast("Floor order updated.");
    } catch (e: unknown) {
      alert((e as Error).message || "Could not reorder floors.");
    }
  };

  const handleCreateFloor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!owner || !pg) return;
    const trimmed = newFloorName.trim();
    if (!trimmed) return;

    try {
      const updated = await addFloor(owner.id, pg.id, trimmed);
      setPg(updated);
      setNewFloorName("");
      setIsAddingFloor(false);
      showToast(`Added floor "${trimmed}"`);
    } catch (e: unknown) {
      alert((e as Error).message || "Could not add floor.");
    }
  };

  const handleConfirmDeleteFloor = async (floorId: string) => {
    if (!owner || !pg) return;
    const updated = await deleteFloor(owner.id, pg.id, floorId);
    setPg(updated);
    showToast("Floor deleted.");
  };

  // ──────────────────────────────────────────────
  // Room operations
  // ──────────────────────────────────────────────
  const handleSaveRoomDetails = async (
    roomId: string,
    updates: {
      name: string;
      sharingType: number;
      isAc: boolean;
      hasAttachedBathroom: boolean;
      amenities: string[];
      customRent?: number | null;
    }
  ) => {
    if (!owner || !pg) return;
    const updated = await updateRoomDetails(owner.id, pg.id, roomId, updates);
    setPg(updated);
    showToast(`Room ${updates.name} saved!`);
  };

  const handleMoveRoom = async (roomId: string, targetFloorId: string) => {
    if (!owner || !pg) return;
    const updated = await moveRoomToFloor(owner.id, pg.id, roomId, targetFloorId);
    setPg(updated);
    showToast("Room moved to new floor!");
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (!owner || !pg) return;
    const updated = await deleteRoom(owner.id, pg.id, roomId);
    setPg(updated);
    setSelectedRoomIds((prev) => prev.filter((id) => id !== roomId));
    showToast("Room deleted.");
  };

  const handleAddMultipleRooms = async (
    floorId: string,
    roomsData: Array<{
      name: string;
      sharingType: number;
      isAc: boolean;
      hasAttachedBathroom: boolean;
      amenities?: string[];
      customRent?: number;
    }>
  ) => {
    if (!owner || !pg) return { skippedNames: [] };
    const res = await addMultipleRoomsToFloor(owner.id, pg.id, floorId, roomsData);
    setPg(res.pg);
    showToast(`Rooms created on floor!`);
    return { skippedNames: res.skippedNames };
  };

  // ──────────────────────────────────────────────
  // Bulk Selection operations
  // ──────────────────────────────────────────────
  const toggleSelectRoom = (roomId: string) => {
    setSelectedRoomIds((prev) =>
      prev.includes(roomId) ? prev.filter((id) => id !== roomId) : [...prev, roomId]
    );
  };

  const handleSelectAllOnFloor = (floor: Floor) => {
    const roomIdsOnFloor = floor.rooms.map((r) => r.id);
    const allSelected = roomIdsOnFloor.every((id) => selectedRoomIds.includes(id));
    if (allSelected) {
      setSelectedRoomIds((prev) => prev.filter((id) => !roomIdsOnFloor.includes(id)));
    } else {
      setSelectedRoomIds((prev) => Array.from(new Set([...prev, ...roomIdsOnFloor])));
    }
  };

  const handleBulkUpdateConfirm = async (updates: {
    isAc?: boolean;
    hasAttachedBathroom?: boolean;
    amenities?: string[];
    customRent?: number | null;
  }) => {
    if (!owner || !pg || selectedRoomIds.length === 0) return;
    const updated = await bulkUpdateRooms(owner.id, pg.id, selectedRoomIds, updates);
    setPg(updated);
    showToast(`Updated ${selectedRoomIds.length} rooms!`);
    setSelectedRoomIds([]);
  };

  // ──────────────────────────────────────────────
  // Live stats calculation
  // ──────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!pg) return { total: 0, vacant: 0, occupied: 0, notice: 0, reserved: 0, maintenance: 0 };
    let total = 0,
      vacant = 0,
      occupied = 0,
      notice = 0,
      reserved = 0,
      maintenance = 0;

    for (const f of pg.floors) {
      for (const r of f.rooms) {
        for (const b of r.beds) {
          total++;
          if (b.status === "vacant") vacant++;
          else if (b.status === "occupied") occupied++;
          else if (b.status === "notice") notice++;
          else if (b.status === "reserved") reserved++;
          else if (b.status === "maintenance") maintenance++;
        }
      }
    }
    return { total, vacant, occupied, notice, reserved, maintenance };
  }, [pg]);

  // All rooms flattened for uniqueness checks
  const allRoomsList = useMemo(() => {
    if (!pg) return [];
    return pg.floors.flatMap((f) => f.rooms);
  }, [pg]);

  // Filtered floors
  const filteredFloors = useMemo(() => {
    if (!pg) return [];

    const sortedFloors = [...pg.floors].sort((a, b) => a.order - b.order);

    return sortedFloors
      .map((floor) => {
        if (selectedFloorId !== "all" && floor.id !== selectedFloorId) {
          return null;
        }

        const matchingRooms = floor.rooms.filter((room) => {
          if (sharingFilter !== "all") {
            const numFilter = Number(sharingFilter);
            if (numFilter === 5) {
              if (room.sharingType < 5) return false;
            } else if (room.sharingType !== numFilter) {
              return false;
            }
          }

          if (acOnly && !room.isAc) {
            return false;
          }

          if (statusFilter !== "all") {
            const hasStatus = room.beds.some((b) => b.status === statusFilter);
            if (!hasStatus) return false;
          }

          if (searchQuery.trim()) {
            const rawQ = searchQuery.trim();
            const q = rawQ.toLowerCase();
            const phoneDigits = rawQ.replace(/\D/g, "");

            const roomMatches = room.name.toLowerCase().includes(q);
            const tenantMatches = room.beds.some((b) => {
              // Name match
              const fullName = (b.tenant?.fullName || b.tenantName || "").toLowerCase();
              if (fullName.includes(q)) return true;

              // Phone number match: check both full string and cleaned digits
              const rawPhone = b.tenant?.phone || b.tenantPhone || "";
              const cleanBedPhone = rawPhone.replace(/\D/g, "");

              if (phoneDigits && cleanBedPhone && cleanBedPhone.includes(phoneDigits)) {
                return true;
              }
              if (rawPhone && rawPhone.toLowerCase().includes(q)) {
                return true;
              }

              // Emergency contact name/phone match as well
              if (b.tenant?.altContactName && b.tenant.altContactName.toLowerCase().includes(q)) {
                return true;
              }
              if (b.tenant?.altPhone && phoneDigits && b.tenant.altPhone.replace(/\D/g, "").includes(phoneDigits)) {
                return true;
              }

              return false;
            });

            if (!roomMatches && !tenantMatches) return false;
          }

          return true;
        });

        return {
          ...floor,
          rooms: matchingRooms,
        };
      })
      .filter((floor): floor is Floor => floor !== null && (floor.rooms.length > 0 || isEditMode || selectedFloorId === floor.id));
  }, [pg, selectedFloorId, statusFilter, sharingFilter, acOnly, searchQuery, isEditMode]);

  if (loading || !pg) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-20">
      <Navbar currentOwner={owner} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Top Header & Property Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 transition shadow-2xs shrink-0"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  {pg.name}
                </h1>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200 capitalize">
                  {pg.type === "coliving" ? "Co-Living" : `${pg.type} PG`}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                {pg.address}, {pg.city} ({pg.pincode})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Edit Layout Toggle Button */}
            <button
              onClick={() => {
                setIsEditMode(!isEditMode);
                setSelectedRoomIds([]);
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm border transition shadow-xs ${isEditMode
                ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-600 ring-2 ring-amber-300"
                : "bg-white hover:bg-slate-50 text-slate-700 border-slate-300"
                }`}
            >
              <Settings2 className="w-4 h-4" />
              <span>{isEditMode ? "Exit Edit Layout" : "Edit Layout"}</span>
            </button>

            {/* Quick Bed Status Counters */}
            <div className="flex items-center gap-2 flex-wrap text-xs font-semibold">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>{stats.vacant} Vacant</span>
              </div>

              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 text-red-800 border border-red-200">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span>{stats.occupied} Occupied</span>
              </div>

              {stats.notice > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span>{stats.notice} Notice</span>
                </div>
              )}

              {stats.maintenance > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 border border-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                  <span>{stats.maintenance} Repair</span>
                </div>
              )}

              <div className="px-3 py-1.5 rounded-xl bg-slate-200/80 text-slate-800 font-bold">
                Total {stats.total} Beds
              </div>
            </div>
          </div>
        </div>

        {/* Edit Layout Mode Active Banner */}
        {isEditMode && (
          <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 animate-in fade-in duration-150">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-200 text-amber-800 flex items-center justify-center font-bold">
                <Settings2 className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-amber-950">
                  Edit Layout Mode is ON
                </p>
                <p className="text-[11px] text-amber-800">
                  Rename floors, reorder with arrows, add/delete floors, edit or move rooms, and select rooms for bulk edits.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {selectedRoomIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setBulkEditModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Bulk Edit ({selectedRoomIds.length})</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsAddingFloor(true)}
                className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition shadow-xs flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Floor</span>
              </button>
            </div>
          </div>
        )}

        {/* Add Floor Prompt Drawer / Box */}
        {isEditMode && isAddingFloor && (
          <form
            onSubmit={handleCreateFloor}
            className="p-4 bg-white border border-teal-300 rounded-2xl shadow-sm flex flex-col sm:flex-row items-center gap-3 animate-in fade-in"
          >
            <div className="flex-1 w-full">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                New Floor Name:
              </label>
              <input
                type="text"
                autoFocus
                required
                value={newFloorName}
                onChange={(e) => setNewFloorName(e.target.value)}
                placeholder="e.g. 3rd Floor, Terrace Block, Basement"
                className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div className="flex items-center gap-2 pt-2 sm:pt-4 self-end">
              <button
                type="button"
                onClick={() => {
                  setIsAddingFloor(false);
                  setNewFloorName("");
                }}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition shadow-xs"
              >
                Create Floor
              </button>
            </div>
          </form>
        )}

        {/* Filters and Search Bar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
          {/* Floor tabs */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            <button
              onClick={() => setSelectedFloorId("all")}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold shrink-0 transition ${selectedFloorId === "all"
                ? "bg-teal-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
            >
              All Floors ({pg.floors.length})
            </button>
            {pg.floors.map((floor) => (
              <button
                key={floor.id}
                onClick={() => setSelectedFloorId(floor.id)}
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold shrink-0 transition ${selectedFloorId === floor.id
                  ? "bg-teal-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
              >
                {floor.name} ({floor.rooms.length} rooms)
              </button>
            ))}
          </div>

          {/* Status filters and Search inputs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
            {/* Status pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {[
                { id: "all", label: "All Statuses" },
                { id: "vacant", label: "Vacant Only" },
                { id: "occupied", label: "Occupied" },
                { id: "notice", label: "Notice" },
                { id: "maintenance", label: "Maintenance" },
              ].map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setStatusFilter(filter.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 border transition ${statusFilter === filter.id
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                >
                  {filter.label}
                </button>
              ))}

              <button
                onClick={() => setAcOnly(!acOnly)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 border transition flex items-center gap-1 ${acOnly
                  ? "bg-teal-50 text-teal-800 border-teal-300 font-bold"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
              >
                <Wind className="w-3.5 h-3.5" />
                <span>AC Only</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search room, tenant name, or phone..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50"
              />
            </div>
          </div>

          {/* Sharing / Bed count filter row */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-2 border-t border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
              <Users className="w-3 h-3 text-teal-600" />
              <span>Beds:</span>
            </span>
            {[
              { id: "all", label: "All Sharing" },
              { id: 1, label: "1-Bed (Single)" },
              { id: 2, label: "2-Bed (Double)" },
              { id: 3, label: "3-Bed (Triple)" },
              { id: 4, label: "4-Bed" },
              { id: 5, label: "5+ Bed" },
            ].map((sh) => (
              <button
                key={sh.id}
                onClick={() => setSharingFilter(sh.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 border transition ${sharingFilter === sh.id
                  ? "bg-teal-600 text-white border-teal-600 shadow-2xs"
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
              >
                {sh.label}
              </button>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-[11px] sm:text-xs text-slate-600 font-medium px-1 flex-wrap">
          <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
            Color Guide:
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-emerald-600" /> Vacant
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-red-600" /> Occupied
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-amber-500" /> Notice Period
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-blue-600" /> Reserved
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-slate-500" /> Maintenance
          </span>
        </div>

        {/* Bed Map Floors Section */}
        {filteredFloors.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">No rooms match your filter</h3>
            <p className="text-xs text-slate-500 mt-1">
              Try clearing filters or search queries to see all rooms.
            </p>
            <button
              onClick={() => {
                setSelectedFloorId("all");
                setStatusFilter("all");
                setAcOnly(false);
                setSearchQuery("");
              }}
              className="mt-4 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {filteredFloors.map((floor, fIdx) => {
              const sortedFloorsList = [...pg.floors].sort((a, b) => a.order - b.order);
              const actualFloorIndex = sortedFloorsList.findIndex((f) => f.id === floor.id);

              return (
                <section key={floor.id} className="space-y-4">
                  {/* Floor Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-200 gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="w-8 h-8 rounded-xl bg-teal-600 text-white font-extrabold text-sm flex items-center justify-center shadow-2xs">
                        {floor.order}
                      </span>

                      {/* Floor Name: Display or Inline Edit */}
                      {isEditMode && editingFloorId === floor.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            autoFocus
                            value={editingFloorName}
                            onChange={(e) => setEditingFloorName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveFloorName(floor.id);
                              if (e.key === "Escape") setEditingFloorId(null);
                            }}
                            className="px-2.5 py-1 text-sm font-bold border border-teal-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveFloorName(floor.id)}
                            className="px-2.5 py-1 rounded-lg bg-teal-600 text-white text-xs font-bold hover:bg-teal-700"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingFloorId(null)}
                            className="px-2 py-1 text-xs text-slate-500 hover:text-slate-800"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <h2
                          onClick={() => {
                            if (isEditMode) handleStartRenameFloor(floor);
                          }}
                          className={`text-lg font-bold text-slate-900 ${isEditMode
                            ? "cursor-pointer hover:text-teal-700 underline decoration-dashed decoration-slate-400"
                            : ""
                            }`}
                          title={isEditMode ? "Click to rename floor inline" : undefined}
                        >
                          {floor.name}
                        </h2>
                      )}

                      <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        {floor.rooms.length} Rooms
                      </span>

                      {/* Edit Mode Floor Controls: Reorder Up/Down & Delete */}
                      {isEditMode && (
                        <div className="flex items-center gap-1 ml-2">
                          <button
                            type="button"
                            disabled={actualFloorIndex === 0}
                            onClick={() => handleReorderFloor(actualFloorIndex, "up")}
                            className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 text-slate-700 transition"
                            title="Move floor up"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            disabled={actualFloorIndex === sortedFloorsList.length - 1}
                            onClick={() => handleReorderFloor(actualFloorIndex, "down")}
                            className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 text-slate-700 transition"
                            title="Move floor down"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeleteFloorModal({ isOpen: true, floor })}
                            className="p-1 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-600 transition ml-1"
                            title="Delete this floor"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {isEditMode && floor.rooms.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleSelectAllOnFloor(floor)}
                          className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition"
                        >
                          <CheckSquare className="w-3.5 h-3.5 text-teal-600" />
                          <span>Select Floor Rooms</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setAddRoomsModal({
                            isOpen: true,
                            floor,
                          });
                        }}
                        className="flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-800 px-3 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 border border-teal-200 transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Rooms to {floor.name}</span>
                      </button>
                    </div>
                  </div>

                  {/* Empty Floor Helper */}
                  {floor.rooms.length === 0 && (
                    <div className="p-8 border-2 border-dashed border-slate-200 rounded-2xl bg-white text-center">
                      <p className="text-xs font-bold text-slate-600">No rooms on this floor yet</p>
                      <button
                        type="button"
                        onClick={() => setAddRoomsModal({ isOpen: true, floor })}
                        className="mt-2 text-xs text-teal-600 font-bold hover:underline"
                      >
                        + Add rooms to {floor.name} now
                      </button>
                    </div>
                  )}

                  {/* Rooms Grid for this floor */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {floor.rooms.map((room) => {
                      const isSelected = selectedRoomIds.includes(room.id);

                      return (
                        <div
                          key={room.id}
                          className={`bg-white rounded-2xl border transition p-4 flex flex-col justify-between ${isSelected
                            ? "border-teal-500 ring-2 ring-teal-200 shadow-sm"
                            : "border-slate-200 shadow-xs hover:shadow-md"
                            }`}
                        >
                          {/* Room Header with Info & Actions */}
                          <div className="pb-3 border-b border-slate-100">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2">
                                {isEditMode && (
                                  <button
                                    type="button"
                                    onClick={() => toggleSelectRoom(room.id)}
                                    className="mt-0.5 text-slate-400 hover:text-teal-600 transition"
                                  >
                                    {isSelected ? (
                                      <CheckSquare className="w-4 h-4 text-teal-600" />
                                    ) : (
                                      <Square className="w-4 h-4" />
                                    )}
                                  </button>
                                )}

                                <div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <h3 className="font-extrabold text-slate-900 text-base">
                                      Room {room.name}
                                    </h3>
                                    <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                                      {room.sharingType}-Sharing
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                                    <span className="flex items-center gap-0.5">
                                      <Wind className="w-3 h-3 text-teal-600" />
                                      {room.isAc ? "AC" : "Non-AC"}
                                    </span>
                                    <span>•</span>
                                    <span className="flex items-center gap-0.5">
                                      <Bath className="w-3 h-3 text-teal-600" />
                                      {room.hasAttachedBathroom ? "Attached Bath" : "Common"}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Room Actions - Customize Room */}
                              <div className="flex items-center gap-1.5">
                                {room.customRent && (
                                  <span className="text-[11px] font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                                    {formatINR(room.customRent)}/mo
                                  </span>
                                )}

                                <button
                                  onClick={() => {
                                    setEditRoomModal({
                                      isOpen: true,
                                      room,
                                      floor,
                                    });
                                  }}
                                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-teal-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                                  title="Edit Room Details, Move Floor or Delete"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">Edit</span>
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Beds in Room */}
                          <div className="pt-3.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                              Beds (Tap any bed to customize)
                            </span>

                            <div className="grid grid-cols-2 gap-2">
                              {room.beds.map((bed) => {
                                // Status styles
                                let bgClass = "bg-emerald-50 border-emerald-300 text-emerald-900";
                                let dotClass = "bg-emerald-600";
                                let statusText = "Vacant";

                                if (bed.status === "occupied") {
                                  bgClass = "bg-red-50 border-red-300 text-red-900";
                                  dotClass = "bg-red-600";
                                  statusText = bed.tenantName || "Occupied";
                                } else if (bed.status === "notice") {
                                  bgClass = "bg-amber-50 border-amber-300 text-amber-900";
                                  dotClass = "bg-amber-500";
                                  statusText = "Notice Period";
                                } else if (bed.status === "reserved") {
                                  bgClass = "bg-blue-50 border-blue-300 text-blue-900";
                                  dotClass = "bg-blue-600";
                                  statusText = "Reserved";
                                } else if (bed.status === "maintenance") {
                                  bgClass = "bg-slate-100 border-slate-300 text-slate-700";
                                  dotClass = "bg-slate-500";
                                  statusText = "Maintenance";
                                }

                                const hasLiveTenant =
                                  (bed.status === "occupied" || bed.status === "notice") &&
                                  Boolean(bed.tenant?.fullName || bed.tenantName);
                                const liveTenantName = bed.tenant?.fullName || bed.tenantName;
                                const liveTenantPhone = bed.tenant?.phone || bed.tenantPhone;

                                return (
                                  <button
                                    key={bed.id}
                                    onClick={() => setActiveBed({ bed, room, floor })}
                                    className={`p-2.5 rounded-xl border text-left transition hover:scale-[1.02] active:scale-[0.98] ${bgClass} shadow-2xs group flex flex-col justify-between min-h-[76px]`}
                                  >
                                    <div className="flex items-center justify-between w-full">
                                      <span className="font-bold text-xs">{bed.name}</span>
                                      <span className={`w-2.5 h-2.5 rounded-full ${dotClass}`} />
                                    </div>

                                    <div className="mt-1">
                                      {hasLiveTenant ? (
                                        <>
                                          <p className="text-[11px] font-bold truncate leading-tight text-slate-900">
                                            {liveTenantName}
                                          </p>
                                          {liveTenantPhone && (
                                            <p className="text-[10px] text-slate-600 mt-0.5 truncate font-semibold">
                                              +91 {liveTenantPhone}
                                            </p>
                                          )}
                                        </>
                                      ) : (
                                        <>
                                          <p className="text-[11px] font-semibold truncate leading-tight">
                                            {statusText}
                                          </p>
                                          {(() => {
                                            const { amount } = getBedRent(pg, room, bed);
                                            return amount !== null ? (
                                              <p className="text-[10px] font-bold text-teal-800 mt-0.5">
                                                {formatINR(amount)}
                                              </p>
                                            ) : bed.status === "vacant" ? (
                                              <p className="text-[10px] text-emerald-700 font-medium">
                                                Ready
                                              </p>
                                            ) : null;
                                          })()}
                                        </>
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-semibold animate-in slide-in-from-bottom-2 duration-150">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Bed Details Drawer (Bottom sheet / Right side panel) */}
      <BedDetailsDrawer
        bed={activeBed?.bed || null}
        room={activeBed?.room || null}
        floor={activeBed?.floor || null}
        pg={pg}
        onClose={() => setActiveBed(null)}
        onUpdateBedDetails={handleUpdateBedDetails}
        onDeleteBed={handleDeleteBed}
        onOpenEditRoom={(r, f) =>
          setEditRoomModal({
            isOpen: true,
            room: r,
            floor: f,
          })
        }
        onAssignOrUpdateTenant={handleAssignOrUpdateTenant}
        onVacateTenant={handleVacateTenant}
      />

      {/* Edit Room Modal (with Move to another floor, delete room, unique validation) */}
      {editRoomModal.isOpen && (
        <EditRoomModal
          room={editRoomModal.room}
          floor={editRoomModal.floor}
          allFloors={pg.floors}
          allRooms={allRoomsList}
          isOpen={editRoomModal.isOpen}
          onClose={() =>
            setEditRoomModal({
              isOpen: false,
              room: null,
              floor: null,
            })
          }
          onSaveRoom={handleSaveRoomDetails}
          onMoveRoom={handleMoveRoom}
          onDeleteRoom={handleDeleteRoom}
        />
      )}

      {/* Add Rooms to Floor Modal */}
      {addRoomsModal.isOpen && (
        <AddRoomsToFloorModal
          floor={addRoomsModal.floor}
          isOpen={addRoomsModal.isOpen}
          onClose={() =>
            setAddRoomsModal({
              isOpen: false,
              floor: null,
            })
          }
          onAddRooms={handleAddMultipleRooms}
        />
      )}

      {/* Delete Floor Modal */}
      {deleteFloorModal.isOpen && (
        <DeleteFloorModal
          floor={deleteFloorModal.floor}
          isOpen={deleteFloorModal.isOpen}
          onClose={() =>
            setDeleteFloorModal({
              isOpen: false,
              floor: null,
            })
          }
          onConfirm={handleConfirmDeleteFloor}
        />
      )}

      {/* Bulk Edit Rooms Modal */}
      {bulkEditModalOpen && (
        <BulkEditRoomsModal
          isOpen={bulkEditModalOpen}
          selectedRoomIds={selectedRoomIds}
          totalRoomsSelected={selectedRoomIds.length}
          onClose={() => setBulkEditModalOpen(false)}
          onConfirm={handleBulkUpdateConfirm}
        />
      )}
    </div>
  );
}