"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getCurrentOwner } from "@/lib/data/auth";
import {
  createPG,
  saveWizardDraft,
  getWizardDraft,
  clearWizardDraft,
} from "@/lib/data/pgStore";
import { Owner, PGType, WizardDraft, Floor, Room, Bed } from "@/lib/types";
import {
  formatINR,
  isValidIndianPhone,
  generateBedLabels,
  sanitizeNonNegative,
  formatTime12Hour,
} from "@/lib/utils";
import Navbar from "@/components/Navbar";
import {
  Building2,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Plus,
  Trash2,
  Sparkles,
  Wifi,
  Shirt,
  Utensils,
  Car,
  Zap,
  Video,
  ShieldAlert,
  Layers,
  DoorOpen,
  BedDouble,
  RotateCcw,
  X,
  Clock,
  Sliders,
  Check,
  Tag,
  Snowflake,
  Wind,
  Bath,
  CheckSquare,
  Square,
  Hash,
} from "lucide-react";

const TOTAL_STEPS = 5;

const STANDARD_FACILITIES = [
  { id: "wifi", label: "Wi-Fi Internet", icon: Wifi },
  { id: "laundry", label: "Washing Machine / Laundry", icon: Shirt },
  { id: "food", label: "Homestyle Food (3 Meals)", icon: Utensils },
  { id: "parking", label: "Two/Four Wheeler Parking", icon: Car },
  { id: "powerBackup", label: "24/7 Power Backup", icon: Zap },
  { id: "cctv", label: "CCTV Security", icon: Video },
];

const POPULAR_CUSTOM_FACILITIES = [
  "Gym",
  "Lift / Elevator",
  "RO Drinking Water",
  "Geyser / Hot Water",
  "Daily Housekeeping",
  "Refrigerator",
  "Biometric Entry",
  "Study Lounge",
];

const ROOM_AMENITIES = [
  { id: "cot", label: "Wooden Cot" },
  { id: "mattress", label: "Comfort Mattress" },
  { id: "cupboard", label: "Personal Cupboard" },
  { id: "studyTable", label: "Study Table & Chair" },
  { id: "balcony", label: "Balcony" },
];

export default function SetupWizardPage() {
  const router = useRouter();
  const [owner, setOwner] = useState<Owner | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [errorMsg, setErrorMsg] = useState("");

  // Step 1: PG Details
  const [pgName, setPgName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Bengaluru");
  const [pincode, setPincode] = useState("");
  const [pgType, setPgType] = useState<PGType>("coliving");
  const [gateTiming, setGateTiming] = useState<string>(""); // Optional, empty by default, timer input
  const [visitorPolicy, setVisitorPolicy] = useState("Allowed in common lounge until 8:30 PM");
  const [noticePeriod, setNoticePeriod] = useState<number>(30);
  const [otherRules, setOtherRules] = useState("");
  const [selectedFacilities, setSelectedFacilities] = useState<string[]>([
    "wifi",
    "laundry",
    "food",
    "powerBackup",
    "cctv",
  ]);
  const [customFacilityInput, setCustomFacilityInput] = useState("");

  // Step 2: Floors
  const [floors, setFloors] = useState<Array<{ id: string; name: string }>>(() => {
    return [
      { id: crypto.randomUUID(), name: "Ground Floor" },
      { id: crypto.randomUUID(), name: "1st Floor" },
      { id: crypto.randomUUID(), name: "2nd Floor" },
    ];
  });

  // Step 3: Rooms per floor
  // Mapping of floorId -> list of { id, name }
  const [roomsByFloor, setRoomsByFloor] = useState<
    Record<string, Array<{ id: string; name: string }>>
  >({});

  // Ensure initial rooms match initial floors
  useEffect(() => {
    setRoomsByFloor((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      if (floors.length < 3) return prev;
      return {
        [floors[0].id]: [
          { id: crypto.randomUUID(), name: "G-01" },
          { id: crypto.randomUUID(), name: "G-02" },
          { id: crypto.randomUUID(), name: "G-03" },
        ],
        [floors[1].id]: [
          { id: crypto.randomUUID(), name: "101" },
          { id: crypto.randomUUID(), name: "102" },
          { id: crypto.randomUUID(), name: "103" },
        ],
        [floors[2].id]: [
          { id: crypto.randomUUID(), name: "201" },
          { id: crypto.randomUUID(), name: "202" },
          { id: crypto.randomUUID(), name: "203" },
        ],
      };
    });
  }, [floors]);

  // Generator mode per floor: 'range' (Start to End Room) vs 'segregate' (counts by sharing)
  const [generatorMode, setGeneratorMode] = useState<Record<string, "range" | "segregate">>({});

  // Range generator config per floor (Item 1: Start Room & End Room Range)
  const [rangeConfigs, setRangeConfigs] = useState<
    Record<
      string,
      {
        prefix: string;
        startNum: number;
        endNum: number;
        sharingType: number;
        isAc: boolean;
        hasAttachedBathroom: boolean;
      }
    >
  >({});

  // Segregation generation helper state per floor (1 to 5 sharing counts)
  const [segregationConfig, setSegregationConfig] = useState<
    Record<
      string,
      {
        startNum: number;
        prefix: string;
        sharing1: number;
        sharing2: number;
        sharing3: number;
        sharing4: number;
        sharing5: number;
      }
    >
  >({});

  // Step 4: Room Details (sharing, AC, attached bath, amenities, custom rent)
  const [roomDetails, setRoomDetails] = useState<
    Record<
      string,
      {
        sharingType: number;
        isAc: boolean;
        hasAttachedBathroom: boolean;
        amenities: string[];
        customRent?: number;
      }
    >
  >({});
  const [step4FilterSharing, setStep4FilterSharing] = useState<number | "all">("all");

  // Step 4 Checklist Multi-Select State (Item 2: Check rooms to set AC/Non-AC & sharing all at once)
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);

  // Step 5: Pricing
  const [deposit, setDeposit] = useState<number>(5000);
  const [maintenance, setMaintenance] = useState<number>(500);
  const [foodIncluded, setFoodIncluded] = useState<boolean>(true);
  const [rentBySharing, setRentBySharing] = useState<Record<number, number>>({
    1: 12000,
    2: 8500,
    3: 6500,
    4: 5500,
    5: 4800,
  });
  const [acRentBySharing, setAcRentBySharing] = useState<Record<number, number>>({});
  const [roomRentOverrides, setRoomRentOverrides] = useState<Record<string, number>>({});

  // Initialize and load owner & draft state
  useEffect(() => {
    async function init() {
      const current = await getCurrentOwner();
      if (!current) {
        router.push("/auth/login");
        return;
      }
      setOwner(current);
      setContactPhone(current.phone);

      // Restore saved draft if available
      const draft = getWizardDraft(current.id);
      if (draft) {
        if (draft.step) setCurrentStep(draft.step);
        if (draft.step1) {
          setPgName(draft.step1.name || "");
          setContactPhone(draft.step1.contactPhone || current.phone);
          setAddress(draft.step1.address || "");
          setCity(draft.step1.city || "Bengaluru");
          setPincode(draft.step1.pincode || "");
          setPgType(draft.step1.type || "coliving");
          setGateTiming(draft.step1.rules?.gateTiming || "");
          setVisitorPolicy(draft.step1.rules?.visitorPolicy || "");
          setNoticePeriod(draft.step1.rules?.noticePeriodDays || 30);
          setOtherRules(draft.step1.rules?.otherRules || "");
          if (draft.step1.facilities) setSelectedFacilities(draft.step1.facilities);
        }
        if (draft.step2?.floors?.length) {
          setFloors(draft.step2.floors);
        }
        if (draft.step3?.roomsByFloor) {
          setRoomsByFloor(draft.step3.roomsByFloor);
        }
        if (draft.step4?.roomDetails) {
          setRoomDetails(draft.step4.roomDetails);
        }
        if (draft.step5?.pricing) {
          setDeposit(sanitizeNonNegative(draft.step5.pricing.deposit, 5000));
          setMaintenance(sanitizeNonNegative(draft.step5.pricing.maintenance, 500));
          setFoodIncluded(draft.step5.pricing.foodIncluded ?? true);
          if (draft.step5.pricing.roomTypeRent) {
            setRentBySharing(draft.step5.pricing.roomTypeRent);
          }
          if (draft.step5.pricing.acRoomTypeRent) {
            setAcRentBySharing(draft.step5.pricing.acRoomTypeRent);
          }
          if (draft.step5.roomOverrides) {
            setRoomRentOverrides(draft.step5.roomOverrides);
          }
        }
      }

      setLoading(false);
    }
    init();
  }, [router]);

  // Auto-save draft whenever inputs change
  useEffect(() => {
    if (!owner || loading) return;

    const draft: WizardDraft = {
      step: currentStep,
      step1: {
        name: pgName,
        contactPhone,
        address,
        city,
        pincode,
        type: pgType,
        rules: {
          gateTiming,
          visitorPolicy,
          noticePeriodDays: noticePeriod,
          otherRules,
        },
        facilities: selectedFacilities,
      },
      step2: { floors },
      step3: { roomsByFloor },
      step4: { roomDetails },
      step5: {
        pricing: {
          deposit: sanitizeNonNegative(deposit, 0),
          maintenance: sanitizeNonNegative(maintenance, 0),
          foodIncluded,
          roomTypeRent: rentBySharing,
          acRoomTypeRent: Object.keys(acRentBySharing).length > 0 ? acRentBySharing : undefined,
        },
        roomOverrides: roomRentOverrides,
      },
    };

    saveWizardDraft(owner.id, draft);
  }, [
    owner,
    loading,
    currentStep,
    pgName,
    contactPhone,
    address,
    city,
    pincode,
    pgType,
    gateTiming,
    visitorPolicy,
    noticePeriod,
    otherRules,
    selectedFacilities,
    floors,
    roomsByFloor,
    roomDetails,
    deposit,
    maintenance,
    foodIncluded,
    rentBySharing,
    acRentBySharing,
    roomRentOverrides,
  ]);

  // Ensure default room details for any newly created room
  useEffect(() => {
    const updated = { ...roomDetails };
    let hasChanges = false;

    Object.values(roomsByFloor).forEach((roomList) => {
      roomList.forEach((r) => {
        if (!updated[r.id]) {
          updated[r.id] = {
            sharingType: 2,
            isAc: false,
            hasAttachedBathroom: true,
            amenities: ["cot", "mattress", "cupboard"],
          };
          hasChanges = true;
        }
      });
    });

    if (hasChanges) {
      setRoomDetails(updated);
    }
  }, [roomsByFloor]);

  // Facilities handlers
  const handleAddCustomFacility = () => {
    const trimmed = customFacilityInput.trim();
    if (!trimmed) return;
    if (!selectedFacilities.includes(trimmed)) {
      setSelectedFacilities((prev) => [...prev, trimmed]);
    }
    setCustomFacilityInput("");
  };

  const handleTogglePopularFacility = (facilityName: string) => {
    if (selectedFacilities.includes(facilityName)) {
      setSelectedFacilities((prev) => prev.filter((f) => f !== facilityName));
    } else {
      setSelectedFacilities((prev) => [...prev, facilityName]);
    }
  };

  const handleRemoveFacility = (facilityIdOrName: string) => {
    setSelectedFacilities((prev) => prev.filter((f) => f !== facilityIdOrName));
  };

  // Step 1 Validation
  const validateStep1 = () => {
    if (!pgName.trim()) {
      setErrorMsg("Please enter the name of your PG or Hostel.");
      return false;
    }
    if (!contactPhone.trim() || !isValidIndianPhone(contactPhone)) {
      setErrorMsg("Please enter a valid 10-digit Indian contact phone number.");
      return false;
    }
    if (!address.trim()) {
      setErrorMsg("Please enter the property street address / area.");
      return false;
    }
    if (!pincode.trim() || pincode.replace(/\D/g, "").length !== 6) {
      setErrorMsg("Please enter a 6-digit Indian PIN code.");
      return false;
    }
    return true;
  };

  // Step 2 Validation
  const validateStep2 = () => {
    if (floors.length === 0) {
      setErrorMsg("Please add at least one floor or block.");
      return false;
    }
    const emptyName = floors.find((f) => !f.name.trim());
    if (emptyName) {
      setErrorMsg("Please make sure every floor has a name (e.g. Ground Floor, 1st Floor).");
      return false;
    }
    return true;
  };

  // Step 3 Validation
  const validateStep3 = () => {
    let totalRooms = 0;
    for (const f of floors) {
      const rms = roomsByFloor[f.id] || [];
      if (rms.length === 0) {
        setErrorMsg(`Please add at least one room on "${f.name}".`);
        return false;
      }
      totalRooms += rms.length;
    }
    if (totalRooms === 0) {
      setErrorMsg("Please add rooms to your property.");
      return false;
    }
    return true;
  };

  const handleNext = () => {
    setErrorMsg("");
    if (currentStep === 1 && !validateStep1()) return;
    if (currentStep === 2 && !validateStep2()) return;
    if (currentStep === 3 && !validateStep3()) return;

    if (currentStep < TOTAL_STEPS) {
      setCurrentStep((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleBack = () => {
    setErrorMsg("");
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Generator Mode 1: Start Room to End Room Range (Item 1)
  const handleGenerateRangeRooms = (floorId: string, floorIndex: number) => {
    const defaultStart = floorIndex === 0 ? 1 : floorIndex * 100 + 1;
    const defaultEnd = defaultStart + 9;
    const config = rangeConfigs[floorId] || {
      prefix: floorIndex === 0 ? "G-" : "",
      startNum: defaultStart,
      endNum: defaultEnd,
      sharingType: 2,
      isAc: false,
      hasAttachedBathroom: true,
    };

    const start = sanitizeNonNegative(config.startNum, 1);
    const end = sanitizeNonNegative(config.endNum, start);

    if (end < start) {
      setErrorMsg(`End Room Number (${end}) cannot be smaller than Start Room Number (${start}).`);
      return;
    }

    const count = end - start + 1;
    if (count > 80) {
      setErrorMsg("You can generate up to 80 rooms at a time per floor.");
      return;
    }

    const newRooms: Array<{ id: string; name: string }> = [];
    const newDetails = { ...roomDetails };
    const prefix = config.prefix || "";

    for (let num = start; num <= end; num++) {
      const numStr = num < 10 && prefix.includes("G") ? `0${num}` : `${num}`;
      const roomName = `${prefix}${numStr}`;
      const roomId = crypto.randomUUID();

      newRooms.push({ id: roomId, name: roomName });
      newDetails[roomId] = {
        sharingType: config.sharingType || 2,
        isAc: config.isAc ?? false,
        hasAttachedBathroom: config.hasAttachedBathroom ?? true,
        amenities: ["cot", "mattress", "cupboard"],
      };
    }

    setRoomsByFloor((prev) => ({
      ...prev,
      [floorId]: newRooms,
    }));
    setRoomDetails(newDetails);
    setErrorMsg("");
  };

  // Generator Mode 2: Segregate rooms by sharing counts
  const handleGenerateSegregatedRooms = (floorId: string, floorIndex: number) => {
    const config = segregationConfig[floorId] || {
      startNum: floorIndex === 0 ? 1 : floorIndex * 100 + 1,
      prefix: floorIndex === 0 ? "G-" : "",
      sharing1: 1,
      sharing2: 3,
      sharing3: 2,
      sharing4: 0,
      sharing5: 0,
    };

    const newRooms: Array<{ id: string; name: string }> = [];
    const newDetails = { ...roomDetails };
    let currentNumber = sanitizeNonNegative(config.startNum, 1);
    const prefix = config.prefix || "";

    const generateBatch = (count: number, sharingCount: number) => {
      const sanitizedCount = sanitizeNonNegative(count, 0);
      for (let i = 0; i < sanitizedCount; i++) {
        const numStr =
          currentNumber < 10 && prefix.includes("G") ? `0${currentNumber}` : `${currentNumber}`;
        const roomName = `${prefix}${numStr}`;
        const roomId = crypto.randomUUID();

        newRooms.push({ id: roomId, name: roomName });
        newDetails[roomId] = {
          sharingType: sharingCount,
          isAc: false,
          hasAttachedBathroom: true,
          amenities: ["cot", "mattress", "cupboard"],
        };
        currentNumber++;
      }
    };

    generateBatch(config.sharing1, 1);
    generateBatch(config.sharing2, 2);
    generateBatch(config.sharing3, 3);
    generateBatch(config.sharing4, 4);
    generateBatch(config.sharing5, 5);

    if (newRooms.length === 0) {
      setErrorMsg("Please specify at least 1 room to generate.");
      return;
    }

    setRoomsByFloor((prev) => ({
      ...prev,
      [floorId]: newRooms,
    }));
    setRoomDetails(newDetails);
    setErrorMsg("");
  };

  // Add individual custom room
  const handleAddCustomRoom = (floorId: string) => {
    const existing = roomsByFloor[floorId] || [];
    const newRoom = {
      id: crypto.randomUUID(),
      name: `Room ${existing.length + 1}`,
    };
    setRoomsByFloor((prev) => ({
      ...prev,
      [floorId]: [...existing, newRoom],
    }));
  };

  const handleRemoveRoom = (floorId: string, roomId: string) => {
    setRoomsByFloor((prev) => ({
      ...prev,
      [floorId]: (prev[floorId] || []).filter((r) => r.id !== roomId),
    }));
    setSelectedRoomIds((prev) => prev.filter((id) => id !== roomId));
  };

  // Step 4 Multi-Room Checklist Batch Actions (Item 2)
  const handleToggleRoomSelection = (roomId: string) => {
    setSelectedRoomIds((prev) =>
      prev.includes(roomId) ? prev.filter((id) => id !== roomId) : [...prev, roomId]
    );
  };

  const handleSelectAllRooms = () => {
    const allIds: string[] = [];
    Object.values(roomsByFloor).forEach((list) => {
      list.forEach((r) => allIds.push(r.id));
    });
    setSelectedRoomIds(allIds);
  };

  const handleDeselectAllRooms = () => {
    setSelectedRoomIds([]);
  };

  const handleBatchUpdateAc = (isAc: boolean) => {
    if (selectedRoomIds.length === 0) return;
    const updated = { ...roomDetails };
    selectedRoomIds.forEach((id) => {
      if (updated[id]) updated[id].isAc = isAc;
    });
    setRoomDetails(updated);
  };

  const handleBatchUpdateBathroom = (hasAttached: boolean) => {
    if (selectedRoomIds.length === 0) return;
    const updated = { ...roomDetails };
    selectedRoomIds.forEach((id) => {
      if (updated[id]) updated[id].hasAttachedBathroom = hasAttached;
    });
    setRoomDetails(updated);
  };

  const handleBatchUpdateSharing = (sharing: number) => {
    if (selectedRoomIds.length === 0) return;
    const updated = { ...roomDetails };
    selectedRoomIds.forEach((id) => {
      if (updated[id]) updated[id].sharingType = sharing;
    });
    setRoomDetails(updated);
  };

  // Final Step 6: Create PG and redirect to Bed Map
  const handleFinalSubmit = async () => {
    if (!owner) return;
    setSaving(true);
    setErrorMsg("");

    try {
      const constructedFloors: Floor[] = floors.map((f, fIdx) => {
        const floorRooms = roomsByFloor[f.id] || [];
        const rooms: Room[] = floorRooms.map((r) => {
          const detail = roomDetails[r.id] || {
            sharingType: 2,
            isAc: false,
            hasAttachedBathroom: true,
            amenities: ["cot", "mattress", "cupboard"],
          };

          const bedLabels = generateBedLabels(detail.sharingType);
          const beds: Bed[] = bedLabels.map((label) => ({
            id: crypto.randomUUID(),
            roomId: r.id,
            name: label,
            status: "vacant",
            updatedAt: new Date().toISOString(),
          }));

          return {
            id: r.id,
            floorId: f.id,
            name: r.name,
            sharingType: detail.sharingType,
            isAc: detail.isAc,
            hasAttachedBathroom: detail.hasAttachedBathroom,
            amenities: detail.amenities,
            customRent: detail.customRent ? sanitizeNonNegative(detail.customRent, 0) : undefined,
            beds,
          };
        });

        return {
          id: f.id,
          name: f.name,
          order: fIdx + 1,
          rooms,
        };
      });

      const newPG = await createPG(owner.id, {
        name: pgName.trim(),
        contactPhone: contactPhone.trim(),
        address: address.trim(),
        city: city.trim(),
        pincode: pincode.trim(),
        type: pgType,
        rules: {
          gateTiming: gateTiming ? formatTime12Hour(gateTiming) : "",
          visitorPolicy,
          noticePeriodDays: sanitizeNonNegative(noticePeriod, 30),
          otherRules,
        },
        facilities: selectedFacilities,
        pricing: {
          deposit: sanitizeNonNegative(deposit, 0),
          maintenance: sanitizeNonNegative(maintenance, 0),
          foodIncluded,
          roomTypeRent: rentBySharing,
          acRoomTypeRent: Object.keys(acRentBySharing).length > 0 ? acRentBySharing : undefined,
        },
        floors: constructedFloors,
      });

      clearWizardDraft(owner.id);
      router.push(`/pg/${newPG.id}`);
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || "Failed to create PG. Please check details.");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Count total rooms & beds in draft for summary
  const totalDraftRooms = Object.values(roomsByFloor).reduce((acc, rms) => acc + rms.length, 0);
  const totalDraftBeds = Object.values(roomsByFloor).reduce((acc, rms) => {
    return (
      acc +
      rms.reduce((rAcc, r) => {
        const sharing = roomDetails[r.id]?.sharingType || 2;
        return rAcc + sharing;
      }, 0)
    );
  }, 0);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar currentOwner={owner} />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Wizard Header & Progress Bar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 mb-6 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-start sm:items-center gap-3">
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-800 font-bold text-xs shadow-2xs transition shrink-0 mt-1 sm:mt-0"
                  title={`Go back to Step ${currentStep - 1}`}
                >
                  <ArrowLeft className="w-4 h-4 text-teal-700" />
                  <span>Back (Step {currentStep - 1})</span>
                </button>
              )}

              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-teal-600">
                  PG Setup Wizard • Step {currentStep} of {TOTAL_STEPS}
                </span>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
                  {currentStep === 1 && "Step 1: Basic PG Details & Facilities"}
                  {currentStep === 2 && "Step 2: Floors & Blocks"}
                  {currentStep === 3 && "Step 3: Setup Rooms"}
                  {currentStep === 4 && "Step 4: Rent & Pricing"}
                  {currentStep === 5 && "Step 5: Review & Go Live"}

                </h1>
              </div>
            </div>

            <button
              onClick={() => {
                if (confirm("Reset setup wizard progress?")) {
                  clearWizardDraft(owner?.id || "");
                  window.location.reload();
                }
              }}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-700 py-1 px-2.5 rounded-lg border border-slate-200 self-start sm:self-center"
              title="Reset progress"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Wizard</span>
            </button>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-teal-600 h-full transition-all duration-300 rounded-full"
              style={{ width: `${(currentStep / TOTAL_STEPS) * 100}%` }}
            />
          </div>

          {/* Clickable Step Navigation Pills (Jump back to any completed step anytime) */}
          <div className="grid grid-cols-5 gap-1 mt-3 text-center text-[11px] sm:text-xs font-semibold">
            {[
              { num: 1, label: "1. Details" },
              { num: 2, label: "2. Floors" },
              { num: 3, label: "3. Rooms" },
              { num: 4, label: "4. Pricing" },
              { num: 5, label: "5. Review" },
            ].map((s) => {
              const isCurrent = currentStep === s.num;
              const isPast = currentStep > s.num;
              return (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => {
                    if (s.num <= currentStep) {
                      setCurrentStep(s.num);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }
                  }}
                  disabled={s.num > currentStep}
                  className={`py-1.5 px-1 rounded-lg transition text-center truncate ${
                    isCurrent
                      ? "bg-teal-50 text-teal-800 font-extrabold border border-teal-300 shadow-2xs"
                      : isPast
                      ? "text-teal-700 hover:bg-teal-50 cursor-pointer font-bold hover:underline"
                      : "text-slate-400 cursor-not-allowed"
                  }`}
                  title={isPast ? `Click to jump back to Step ${s.num}: ${s.label}` : undefined}
                >
                  {isPast ? `✓ ${s.label.slice(3)}` : s.label}
                </button>
              );
            })}
          </div>

        </div>

        {/* Friendly Error Banner */}
        {errorMsg && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* STEP 1: PG Details & Custom Facilities & Optional Gate Timer */}
        {currentStep === 1 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-1">
                PG / Hostel Name *
              </label>
              <input
                type="text"
                value={pgName}
                onChange={(e) => setPgName(e.target.value)}
                placeholder="e.g. Sri Balaji Luxury PG, Green Nest Coliving"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-base"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-1">
                  Owner / Caretaker Contact Number *
                </label>
                <div className="flex rounded-xl border border-slate-300 focus-within:ring-2 focus-within:ring-teal-500 overflow-hidden">
                  <span className="inline-flex items-center px-3 bg-slate-100 text-slate-600 text-sm font-medium border-r border-slate-300">
                    +91
                  </span>
                  <input
                    type="tel"
                    maxLength={10}
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value.replace(/\D/g, ""))}
                    placeholder="9876543210"
                    className="w-full px-4 py-3 text-base focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-1">
                  PG Type *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["boys", "girls", "coliving"] as PGType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setPgType(t)}
                      className={`py-3 px-2 rounded-xl text-xs sm:text-sm font-semibold border capitalize transition ${
                        pgType === t
                          ? "bg-teal-600 text-white border-teal-600 shadow-xs"
                          : "bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100"
                      }`}
                    >
                      {t === "coliving" ? "Co-Living" : `${t} PG`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-1">
                Property Address (Building & Street) *
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Plot 12, 4th Cross, Green Glen Layout, Bellandur"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-base"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-1">City *</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Bengaluru, Hyderabad, Pune"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-1">
                  PIN Code (6 digits) *
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
                  placeholder="e.g. 560103"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-base"
                />
              </div>
            </div>

            {/* Included & Custom Facilities (Item 1) */}
            <div className="pt-2 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-semibold text-slate-900">
                    Included Facilities
                  </label>
                  <p className="text-xs text-slate-500">
                    Select standard facilities or add customized ones below.
                  </p>
                </div>
                <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                  {selectedFacilities.length} Selected
                </span>
              </div>

              {/* Standard presets */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {STANDARD_FACILITIES.map((fac) => {
                  const isSelected = selectedFacilities.includes(fac.id);
                  const Icon = fac.icon;
                  return (
                    <button
                      key={fac.id}
                      type="button"
                      onClick={() => {
                        setSelectedFacilities((prev) =>
                          isSelected ? prev.filter((id) => id !== fac.id) : [...prev, fac.id]
                        );
                      }}
                      className={`flex items-center gap-2.5 p-3 rounded-xl text-xs sm:text-sm font-medium border text-left transition ${
                        isSelected
                          ? "bg-teal-50 text-teal-800 border-teal-300 font-semibold"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isSelected ? "text-teal-600" : "text-slate-400"}`} />
                      <span>{fac.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Popular custom suggestions */}
              <div className="pt-2">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1.5 uppercase tracking-wider">
                  Quick Add Popular Indian PG Facilities:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_CUSTOM_FACILITIES.map((item) => {
                    const isSelected = selectedFacilities.includes(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => handleTogglePopularFacility(item)}
                        className={`text-xs px-2.5 py-1 rounded-lg border transition flex items-center gap-1 ${
                          isSelected
                            ? "bg-teal-600 text-white border-teal-600 font-semibold"
                            : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {isSelected ? <Check className="w-3 h-3" /> : "+"}
                        <span>{item}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Add Custom Facility Input */}
              <div className="pt-2 flex gap-2">
                <input
                  type="text"
                  placeholder="Type any customized facility (e.g. Solar Heater, TT Table, Library...)"
                  value={customFacilityInput}
                  onChange={(e) => setCustomFacilityInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCustomFacility();
                    }
                  }}
                  className="flex-1 px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                />
                <button
                  type="button"
                  onClick={handleAddCustomFacility}
                  className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-semibold text-sm rounded-xl transition shadow-xs"
                >
                  + Add Facility
                </button>
              </div>

              {/* Active custom facilities chips list */}
              {selectedFacilities.some(
                (f) => !STANDARD_FACILITIES.some((sf) => sf.id === f)
              ) && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                    Active Custom Facilities:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedFacilities
                      .filter((f) => !STANDARD_FACILITIES.some((sf) => sf.id === f))
                      .map((customF) => (
                        <span
                          key={customF}
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-teal-300 text-teal-800 text-xs font-semibold rounded-lg shadow-2xs"
                        >
                          <Tag className="w-3 h-3 text-teal-600" />
                          <span>{customF}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveFacility(customF)}
                            className="p-0.5 text-slate-400 hover:text-red-500 transition"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {/* House Rules & Timer Input for Gate Closing */}
            <div className="pt-4 border-t border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">House Rules</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Gate Closing Time (Timer)</span>
                    <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                  </label>
                  <div className="relative">
                    <input
                      type="time"
                      value={gateTiming}
                      onChange={(e) => setGateTiming(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {gateTiming ? (
                      <span className="text-teal-700 font-semibold">
                        Closes at {formatTime12Hour(gateTiming)}
                      </span>
                    ) : (
                      "Leave empty for 24/7 open gate"
                    )}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Visitor Policy
                  </label>
                  <input
                    type="text"
                    value={visitorPolicy}
                    onChange={(e) => setVisitorPolicy(e.target.value)}
                    placeholder="e.g. Allowed in common area till 8:30 PM"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Notice Period (Days)
                  </label>
                  <input
                    type="number"
                    min="0"
                    onKeyDown={(e) => {
                      if (e.key === "-" || e.key === "e") e.preventDefault();
                    }}
                    value={noticePeriod}
                    onChange={(e) => setNoticePeriod(sanitizeNonNegative(e.target.value, 30))}
                    placeholder="30"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Floors / Blocks */}
        {currentStep === 2 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">How many floors or blocks do you have?</h2>
              <p className="text-sm text-slate-500 mt-1">
                You can freely name your floors (e.g. Ground Floor, 1st Floor, Block A, Terrace).
              </p>
            </div>

            <div className="space-y-3">
              {floors.map((floor, index) => (
                <div
                  key={floor.id}
                  className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <span className="w-8 h-8 rounded-lg bg-teal-100 text-teal-800 font-bold text-sm flex items-center justify-center shrink-0">
                    {index + 1}
                  </span>

                  <input
                    type="text"
                    value={floor.name}
                    onChange={(e) => {
                      const updated = [...floors];
                      updated[index].name = e.target.value;
                      setFloors(updated);
                    }}
                    placeholder={`e.g. ${index === 0 ? "Ground Floor" : `${index}st Floor`}`}
                    className="flex-1 px-4 py-2.5 bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 text-base font-medium"
                  />

                  {floors.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setFloors(floors.filter((_, i) => i !== index));
                      }}
                      className="p-2.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"
                      title="Remove floor"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                const newFloorNum = floors.length;
                const newFloor = {
                  id: crypto.randomUUID(),
                  name: `${newFloorNum === 0 ? "Ground Floor" : `${newFloorNum}th Floor`}`,
                };
                setFloors([...floors, newFloor]);
              }}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 border-dashed border-teal-400 bg-teal-50/50 hover:bg-teal-50 text-teal-700 font-semibold text-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add Another Floor / Block</span>
            </button>
          </div>
        )}

        {/* STEP 3: Setup Rooms with Start Room to End Room Range Generator (Item 1) */}
        {currentStep === 3 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-8">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Setup Rooms with Start & End Range
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Enter an optional prefix (e.g. <code>G-</code> or <code>10</code>), a <strong>Start Room</strong> (e.g. 101), and an <strong>End Room</strong> (e.g. 115) to auto-generate the whole range in 1 second!
              </p>
            </div>

            {floors.map((floor, floorIndex) => {
              const currentFloorRooms = roomsByFloor[floor.id] || [];
              const defaultStartNum = floorIndex === 0 ? 1 : floorIndex * 100 + 1;
              const defaultEndNum = defaultStartNum + 9;
              const defaultPrefix = floorIndex === 0 ? "G-" : "";

              const activeTab = generatorMode[floor.id] || "range";

              // Range generator config
              const rConfig = rangeConfigs[floor.id] || {
                prefix: defaultPrefix,
                startNum: defaultStartNum,
                endNum: defaultEndNum,
                sharingType: 2,
                isAc: false,
                hasAttachedBathroom: true,
              };

              const calculatedRangeCount = Math.max(
                0,
                sanitizeNonNegative(rConfig.endNum, rConfig.startNum) -
                  sanitizeNonNegative(rConfig.startNum, 1) +
                  1
              );

              // Segregation generator config
              const sConfig = segregationConfig[floor.id] || {
                startNum: defaultStartNum,
                prefix: defaultPrefix,
                sharing1: 1,
                sharing2: 3,
                sharing3: 2,
                sharing4: 0,
                sharing5: 0,
              };

              return (
                <div
                  key={floor.id}
                  className="border border-slate-200 rounded-2xl p-5 bg-slate-50/60 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-teal-600 text-white font-bold text-xs flex items-center justify-center">
                        {floorIndex + 1}
                      </span>
                      <h3 className="font-bold text-slate-900 text-base">{floor.name}</h3>
                      <span className="text-xs text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                        {currentFloorRooms.length} rooms configured
                      </span>
                    </div>

                    {/* Mode switcher tabs: Start/End Range vs Segregation */}
                    <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200">
                      <button
                        type="button"
                        onClick={() =>
                          setGeneratorMode({ ...generatorMode, [floor.id]: "range" })
                        }
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                          activeTab === "range"
                            ? "bg-teal-600 text-white shadow-2xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        Start & End Range
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setGeneratorMode({ ...generatorMode, [floor.id]: "segregate" })
                        }
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                          activeTab === "segregate"
                            ? "bg-teal-600 text-white shadow-2xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        By Sharing Counts
                      </button>
                    </div>
                  </div>

                  {/* TAB 1: Start Room to End Room Range Generator (User Request 1) */}
                  {activeTab === "range" && (
                    <div className="p-4 bg-white rounded-xl border border-teal-200 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-teal-800 flex items-center gap-1.5">
                          <Hash className="w-4 h-4 text-teal-600" />
                          <span>Range Generator for {floor.name}</span>
                        </span>

                        <span className="text-xs font-extrabold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                          {calculatedRangeCount} Rooms Will Be Created
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                        {/* Prefix */}
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Optional Prefix
                          </label>
                          <input
                            type="text"
                            value={rConfig.prefix}
                            placeholder="e.g. G-, 10, Block A"
                            onChange={(e) => {
                              setRangeConfigs({
                                ...rangeConfigs,
                                [floor.id]: {
                                  ...rConfig,
                                  prefix: e.target.value,
                                },
                              });
                            }}
                            className="w-full px-2.5 py-2 text-xs font-bold rounded-lg border border-slate-300 bg-white"
                          />
                        </div>

                        {/* Start Room */}
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Start Room No. *
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={rConfig.startNum}
                            onChange={(e) => {
                              setRangeConfigs({
                                ...rangeConfigs,
                                [floor.id]: {
                                  ...rConfig,
                                  startNum: sanitizeNonNegative(e.target.value, 1),
                                },
                              });
                            }}
                            className="w-full px-2.5 py-2 text-xs font-bold rounded-lg border border-slate-300 bg-white"
                          />
                        </div>

                        {/* End Room */}
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            End Room No. *
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={rConfig.endNum}
                            onChange={(e) => {
                              setRangeConfigs({
                                ...rangeConfigs,
                                [floor.id]: {
                                  ...rConfig,
                                  endNum: sanitizeNonNegative(e.target.value, rConfig.startNum),
                                },
                              });
                            }}
                            className="w-full px-2.5 py-2 text-xs font-bold rounded-lg border border-slate-300 bg-white"
                          />
                        </div>

                        {/* Sharing Type for this range */}
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Sharing Type
                          </label>
                          <select
                            value={rConfig.sharingType}
                            onChange={(e) => {
                              setRangeConfigs({
                                ...rangeConfigs,
                                [floor.id]: {
                                  ...rConfig,
                                  sharingType: Number(e.target.value),
                                },
                              });
                            }}
                            className="w-full px-2.5 py-2 text-xs font-bold rounded-lg border border-slate-300 bg-white"
                          >
                            <option value={1}>1-Sharing (Single)</option>
                            <option value={2}>2-Sharing (Double)</option>
                            <option value={3}>3-Sharing (Triple)</option>
                            <option value={4}>4-Sharing (Four)</option>
                            <option value={5}>5-Sharing (Five)</option>
                          </select>
                        </div>
                      </div>

                      {/* AC and Attached Washroom for this range */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setRangeConfigs({
                                ...rangeConfigs,
                                [floor.id]: { ...rConfig, isAc: !rConfig.isAc },
                              })
                            }
                            className={`px-2.5 py-1 text-xs rounded-lg font-bold border transition ${
                              rConfig.isAc
                                ? "bg-teal-50 text-teal-800 border-teal-300"
                                : "bg-slate-50 text-slate-600 border-slate-200"
                            }`}
                          >
                            {rConfig.isAc ? "✓ AC Rooms" : "+ Non-AC Rooms"}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setRangeConfigs({
                                ...rangeConfigs,
                                [floor.id]: {
                                  ...rConfig,
                                  hasAttachedBathroom: !rConfig.hasAttachedBathroom,
                                },
                              })
                            }
                            className={`px-2.5 py-1 text-xs rounded-lg font-bold border transition ${
                              rConfig.hasAttachedBathroom
                                ? "bg-teal-50 text-teal-800 border-teal-300"
                                : "bg-slate-50 text-slate-600 border-slate-200"
                            }`}
                          >
                            {rConfig.hasAttachedBathroom ? "✓ Attached Bath" : "+ Common Bath"}
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleGenerateRangeRooms(floor.id, floorIndex)}
                          className="py-2 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-2xs ml-auto"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>
                            Generate {calculatedRangeCount} Rooms ({rConfig.prefix}
                            {rConfig.startNum} to {rConfig.prefix}
                            {rConfig.endNum})
                          </span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: Segregation Generator Box */}
                  {activeTab === "segregate" && (
                    <div className="p-4 bg-white rounded-xl border border-teal-200 shadow-2xs space-y-3">
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-teal-800">
                        <Sliders className="w-4 h-4 text-teal-600" />
                        <span>Segregate by Sharing Counts for {floor.name}</span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Start Room No.
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={sConfig.startNum}
                            onChange={(e) => {
                              setSegregationConfig({
                                ...segregationConfig,
                                [floor.id]: {
                                  ...sConfig,
                                  startNum: sanitizeNonNegative(e.target.value, 1),
                                },
                              });
                            }}
                            className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-300"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Prefix (Optional)
                          </label>
                          <input
                            type="text"
                            value={sConfig.prefix}
                            placeholder="e.g. G-, A-, 10"
                            onChange={(e) => {
                              setSegregationConfig({
                                ...segregationConfig,
                                [floor.id]: {
                                  ...sConfig,
                                  prefix: e.target.value,
                                },
                              });
                            }}
                            className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-300"
                          />
                        </div>
                      </div>

                      {/* Counts for 1, 2, 3, 4, 5 sharing */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                        {[1, 2, 3, 4, 5].map((sh) => {
                          const key = `sharing${sh}` as keyof typeof sConfig;
                          return (
                            <div key={sh} className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-center">
                              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                                {sh}-Sharing Rooms
                              </span>
                              <input
                                type="number"
                                min="0"
                                onKeyDown={(e) => {
                                  if (e.key === "-" || e.key === "e") e.preventDefault();
                                }}
                                value={sConfig[key] as number}
                                onChange={(e) => {
                                  setSegregationConfig({
                                    ...segregationConfig,
                                    [floor.id]: {
                                      ...sConfig,
                                      [key]: sanitizeNonNegative(e.target.value, 0),
                                    },
                                  });
                                }}
                                className="w-full mt-1 px-2 py-1 text-center font-extrabold text-sm rounded border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                              />
                            </div>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleGenerateSegregatedRooms(floor.id, floorIndex)}
                        className="w-full py-2.5 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-2xs"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>Generate Segregated Rooms & Auto-Create Beds</span>
                      </button>
                    </div>
                  )}

                  {/* List of configured rooms on this floor — inline edit: name, beds, AC/Non-AC, bathroom */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        {currentFloorRooms.length} Rooms on {floor.name} — Edit inline below:
                      </span>
                      {currentFloorRooms.length > 0 && (
                        <span className="text-[11px] text-slate-400 italic">
                          Name · Beds · AC/Non-AC · Bath
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      {currentFloorRooms.map((room, rIdx) => {
                        const detail = roomDetails[room.id] || {
                          sharingType: 2,
                          isAc: false,
                          hasAttachedBathroom: true,
                          amenities: ["cot", "mattress", "cupboard"],
                        };

                        const updateDetail = (patch: Partial<typeof detail>) => {
                          setRoomDetails({
                            ...roomDetails,
                            [room.id]: { ...detail, ...patch },
                          });
                        };

                        return (
                          <div
                            key={room.id}
                            className="flex flex-wrap sm:flex-nowrap items-center gap-2 p-3 bg-white border border-slate-200 rounded-xl shadow-2xs hover:border-teal-200 transition"
                          >
                            {/* Room number badge */}
                            <span className="w-6 h-6 rounded-md bg-slate-100 text-slate-600 font-bold text-[11px] flex items-center justify-center shrink-0">
                              {rIdx + 1}
                            </span>

                            {/* Room Name */}
                            <input
                              type="text"
                              value={room.name}
                              onChange={(e) => {
                                const updated = [...currentFloorRooms];
                                updated[rIdx] = { ...updated[rIdx], name: e.target.value };
                                setRoomsByFloor({
                                  ...roomsByFloor,
                                  [floor.id]: updated,
                                });
                              }}
                              className="w-24 sm:w-28 px-2 py-1.5 text-sm font-bold text-slate-800 rounded-lg border border-slate-200 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-400 bg-slate-50"
                              placeholder="Room No."
                              title="Edit room name/number"
                            />

                            {/* Beds / Sharing Count */}
                            <select
                              value={detail.sharingType}
                              onChange={(e) => updateDetail({ sharingType: Number(e.target.value) })}
                              className="px-2 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-teal-400 focus:border-teal-500"
                              title="Number of beds in this room"
                            >
                              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                                <option key={n} value={n}>
                                  {n}-Bed
                                </option>
                              ))}
                            </select>

                            {/* AC / Non-AC Toggle */}
                            <button
                              type="button"
                              onClick={() => updateDetail({ isAc: !detail.isAc })}
                              className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border flex items-center gap-1 transition ${
                                detail.isAc
                                  ? "bg-teal-600 text-white border-teal-600"
                                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                              }`}
                              title="Toggle AC / Non-AC"
                            >
                              {detail.isAc ? (
                                <>
                                  <Snowflake className="w-3 h-3" />
                                  <span>AC</span>
                                </>
                              ) : (
                                <>
                                  <Wind className="w-3 h-3" />
                                  <span>Non-AC</span>
                                </>
                              )}
                            </button>

                            {/* Attached / Common Bathroom Toggle */}
                            <button
                              type="button"
                              onClick={() =>
                                updateDetail({ hasAttachedBathroom: !detail.hasAttachedBathroom })
                              }
                              className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border flex items-center gap-1 transition ${
                                detail.hasAttachedBathroom
                                  ? "bg-blue-50 text-blue-700 border-blue-300"
                                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                              }`}
                              title="Toggle attached / common bathroom"
                            >
                              <Bath className="w-3 h-3" />
                              <span>{detail.hasAttachedBathroom ? "Attached" : "Common"}</span>
                            </button>

                            {/* Delete */}
                            <button
                              type="button"
                              onClick={() => handleRemoveRoom(floor.id, room.id)}
                              className="ml-auto p-1.5 text-slate-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition"
                              title="Remove this room"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {currentFloorRooms.length === 0 && (
                      <div className="py-6 text-center text-slate-400 text-sm bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        No rooms yet. Use the generator above or add a custom room below.
                      </div>
                    )}

                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => handleAddCustomRoom(floor.id)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:text-teal-800 px-3 py-2 rounded-lg bg-white border border-teal-200 hover:bg-teal-50 transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Add individual room to {floor.name}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}


        {/* STEP 4: Pricing (was Step 5) */}
        {currentStep === 4 && (

          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Monthly Rent & Deposits</h2>
              <p className="text-sm text-slate-500 mt-1">
                Set standard rent per bed by sharing type. Zero negative values are permitted.
              </p>
            </div>

            {/* Standard rent by sharing (1 to 5 sharing) */}
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-3">
                Monthly Rent Per Bed (by Room Type)
              </label>

              {/* Column headers */}
              <div className="grid grid-cols-[100px_1fr_1fr] gap-3 mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 px-1">
                <span></span>
                <span>Non-AC rent</span>
                <span>AC rent</span>
              </div>

              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((sharing) => (
                  <div
                    key={sharing}
                    className="grid grid-cols-[100px_1fr_1fr] gap-3 items-center"
                  >
                    <span className="text-xs font-semibold text-slate-600">
                      {sharing}-Sharing
                    </span>
                    {/* Non-AC input */}
                    <div className="flex items-center rounded-lg border border-slate-300 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-teal-500">
                      <span className="px-2.5 text-sm font-semibold text-slate-500">₹</span>
                      <input
                        type="number"
                        min="0"
                        onKeyDown={(e) => {
                          if (e.key === "-" || e.key === "e") e.preventDefault();
                        }}
                        step={500}
                        value={rentBySharing[sharing] ?? ""}
                        onChange={(e) => {
                          setRentBySharing({
                            ...rentBySharing,
                            [sharing]: sanitizeNonNegative(e.target.value, 0),
                          });
                        }}
                        placeholder="e.g. 8500"
                        className="w-full px-2 py-2 text-sm font-bold text-slate-900 focus:outline-none"
                      />
                    </div>
                    {/* AC input */}
                    <div className="flex items-center rounded-lg border border-slate-300 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-teal-500">
                      <span className="px-2.5 text-sm font-semibold text-slate-500">₹</span>
                      <input
                        type="number"
                        min="0"
                        onKeyDown={(e) => {
                          if (e.key === "-" || e.key === "e") e.preventDefault();
                        }}
                        step={500}
                        value={acRentBySharing[sharing] ?? ""}
                        onChange={(e) => {
                          const val = e.target.value.trim();
                          setAcRentBySharing((prev) => {
                            if (!val) {
                              const next = { ...prev };
                              delete next[sharing];
                              return next;
                            }
                            return { ...prev, [sharing]: sanitizeNonNegative(val, 0) };
                          });
                        }}
                        placeholder="e.g. 10000"
                        className="w-full px-2 py-2 text-sm font-bold text-slate-900 focus:outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* AC rent warning: any AC room type has no AC price */}
              {(() => {
                const acSharings = new Set<number>();
                Object.values(roomDetails).forEach((rd) => {
                  if (rd.isAc) acSharings.add(rd.sharingType);
                });
                const missing = Array.from(acSharings).filter((s) => acRentBySharing[s] === undefined);
                if (missing.length === 0) return null;
                return (
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-800 text-xs font-semibold flex items-start gap-2">
                    <span className="mt-0.5">⚠️</span>
                    <span>
                      You have AC rooms for {missing.map((s) => `${s}-sharing`).join(", ")} but no AC rent set. Beds in those rooms will use the Non-AC price as a fallback.
                    </span>
                  </div>
                );
              })()}
            </div>

            {/* Deposit & Maintenance (Zero Negatives) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-1">
                  Security Deposit (Refundable)
                </label>
                <div className="flex items-center rounded-xl border border-slate-300 bg-white overflow-hidden">
                  <span className="px-3.5 text-base font-semibold text-slate-500">₹</span>
                  <input
                    type="number"
                    min="0"
                    onKeyDown={(e) => {
                      if (e.key === "-" || e.key === "e") e.preventDefault();
                    }}
                    step={500}
                    value={deposit}
                    onChange={(e) => setDeposit(sanitizeNonNegative(e.target.value, 0))}
                    className="w-full px-3 py-3 text-base font-bold text-slate-900 focus:outline-none"
                    placeholder="5000"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-1">
                  Monthly Maintenance Charge
                </label>
                <div className="flex items-center rounded-xl border border-slate-300 bg-white overflow-hidden">
                  <span className="px-3.5 text-base font-semibold text-slate-500">₹</span>
                  <input
                    type="number"
                    min="0"
                    onKeyDown={(e) => {
                      if (e.key === "-" || e.key === "e") e.preventDefault();
                    }}
                    step={100}
                    value={maintenance}
                    onChange={(e) => setMaintenance(sanitizeNonNegative(e.target.value, 0))}
                    className="w-full px-3 py-3 text-base font-bold text-slate-900 focus:outline-none"
                    placeholder="500"
                  />
                </div>
              </div>
            </div>

            {/* Food Included Toggle */}
            <div className="pt-2">
              <label className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={foodIncluded}
                  onChange={(e) => setFoodIncluded(e.target.checked)}
                  className="w-5 h-5 text-teal-600 rounded focus:ring-teal-500 border-slate-300"
                />
                <div>
                  <span className="text-sm font-bold text-slate-900">Food Included in Rent</span>
                  <p className="text-xs text-slate-500">
                    Check this if monthly rent covers daily 3 meals / mess food
                  </p>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* STEP 5: Review & Go Live */}
        {currentStep === 5 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Ready to Go Live!</h2>
              <p className="text-sm text-slate-600 mt-1">
                Please double-check your PG details below before activating your Bed Map.
              </p>
            </div>

            {/* Review Cards */}
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">{pgName}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {address}, {city} - {pincode}
                  </p>
                  <p className="text-xs text-slate-600 mt-1 font-medium">
                    Contact: +91 {contactPhone} • Type:{" "}
                    <span className="capitalize font-semibold text-teal-700">{pgType} PG</span>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="px-2.5 py-1 text-xs font-bold text-teal-700 bg-white border border-teal-200 rounded-lg hover:bg-teal-50 transition"
                >
                  Edit Step 1
                </button>
              </div>

              {/* Counts summary */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Property Capacity Overview
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="px-2.5 py-1 text-xs font-bold text-teal-700 bg-white border border-teal-200 rounded-lg hover:bg-teal-50 transition"
                  >
                    Edit Rooms (Step 3)
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 bg-white border border-teal-200 rounded-xl">
                    <div className="text-xl font-extrabold text-teal-800">{floors.length}</div>
                    <div className="text-xs font-semibold text-teal-700">Floors</div>
                  </div>

                  <div className="p-3 bg-white border border-teal-200 rounded-xl">
                    <div className="text-xl font-extrabold text-teal-800">{totalDraftRooms}</div>
                    <div className="text-xs font-semibold text-teal-700">Rooms</div>
                  </div>

                  <div className="p-3 bg-white border border-teal-200 rounded-xl">
                    <div className="text-xl font-extrabold text-teal-800">{totalDraftBeds}</div>
                    <div className="text-xs font-semibold text-teal-700">Total Beds</div>
                  </div>
                </div>
              </div>

              {/* Facilities Summary */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                    Included Facilities ({selectedFacilities.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="px-2.5 py-1 text-xs font-bold text-teal-700 bg-white border border-teal-200 rounded-lg hover:bg-teal-50 transition"
                  >
                    Edit Facilities
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {selectedFacilities.map((f) => (
                    <span
                      key={f}
                      className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 capitalize"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>

              {/* Pricing Overview */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Pricing & Rules Summary
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(4)}
                    className="px-2.5 py-1 text-xs font-bold text-teal-700 bg-white border border-teal-200 rounded-lg hover:bg-teal-50 transition"
                  >
                    Edit Pricing (Step 4)
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm pt-1">
                  <div>
                    <span className="text-xs text-slate-500 block">Security Deposit</span>
                    <span className="font-bold text-slate-800">{formatINR(deposit)}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Maintenance</span>
                    <span className="font-bold text-slate-800">{formatINR(maintenance)}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Food</span>
                    <span className="font-bold text-slate-800">
                      {foodIncluded ? "Included" : "Not included"}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Gate Closes</span>
                    <span className="font-bold text-slate-800">
                      {gateTiming ? formatTime12Hour(gateTiming) : "24/7 Open"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Go Live Big Button */}
            <div className="pt-4">
              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-4 px-6 rounded-2xl bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-bold text-base shadow-md transition disabled:opacity-50"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>{saving ? "Activating your PG..." : "Save & Open Live Bed Map"}</span>
              </button>
            </div>
          </div>
        )}

        {/* Sticky Floating Wizard Navigation Bar (Always visible on mobile & desktop) */}
        <div className="sticky bottom-4 z-40 bg-white/95 backdrop-blur-md border border-slate-300 shadow-xl rounded-2xl p-3 sm:p-4 flex items-center justify-between gap-4 mt-8">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-2 py-2.5 sm:py-3 px-4 sm:px-5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs sm:text-sm transition shadow-2xs"
            >
              <ArrowLeft className="w-4 h-4 text-teal-700" />
              <span>Back to Step {currentStep - 1}</span>
            </button>
          ) : (
            <Link
              href="/"
              className="flex items-center gap-1.5 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 text-xs sm:text-sm font-semibold transition"
            >
              Cancel Setup
            </Link>
          )}

          {currentStep < TOTAL_STEPS && (
            <button
              type="button"
              onClick={handleNext}
              className="flex items-center gap-2 py-2.5 sm:py-3 px-5 sm:px-6 rounded-xl bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-bold text-xs sm:text-sm transition shadow-xs ml-auto"
            >
              <span>Next Step ({currentStep + 1} of {TOTAL_STEPS})</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
