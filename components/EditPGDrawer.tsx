"use client";

import React, { useState, useEffect, useRef } from "react";
import { PGProperty, PGType, PGRules, PGPricing } from "@/lib/types";
import { updatePG } from "@/lib/data/pgStore";
import { sanitizeNonNegative } from "@/lib/utils";
import {
  X,
  Building2,
  Save,
  CheckCircle2,
  AlertCircle,
  Phone,
  MapPin,
  Shield,
  CreditCard,
  Utensils,
  Plus,
  Trash2,
} from "lucide-react";

interface EditPGDrawerProps {
  pg: PGProperty | null;
  isOpen: boolean;
  ownerId: string;
  onClose: () => void;
  onSaved: (updatedPG: PGProperty) => void;
}

const PG_TYPES: { value: PGType; label: string }[] = [
  { value: "boys", label: "Boys PG" },
  { value: "girls", label: "Girls PG" },
  { value: "coliving", label: "Co-Living" },
];

const STANDARD_FACILITIES = [
  { id: "wifi", label: "Wi-Fi Internet" },
  { id: "laundry", label: "Washing Machine / Laundry" },
  { id: "food", label: "Homestyle Food (3 Meals)" },
  { id: "parking", label: "Parking" },
  { id: "powerBackup", label: "24/7 Power Backup" },
  { id: "cctv", label: "CCTV Security" },
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

const inputCls =
  "w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition";
const selectCls =
  "w-full px-2.5 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition";

function FieldWrapper({
  label,
  error,
  touched,
  required,
  children,
  hint,
}: {
  label: string;
  error: string;
  touched: boolean;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}) {
  const showError = touched && !!error;
  const showTick = touched && !error;
  return (
    <div>
      <label className="block text-[11px] font-bold text-slate-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
        {showTick && <CheckCircle2 className="inline w-3 h-3 text-emerald-500 ml-1" />}
      </label>
      {children}
      {showError && (
        <p className="mt-1 text-[10px] text-red-600 font-semibold flex items-center gap-1">
          <AlertCircle className="w-3 h-3 shrink-0" />
          {error}
        </p>
      )}
      {hint && !showError && (
        <p className="mt-1 text-[10px] text-slate-400">{hint}</p>
      )}
    </div>
  );
}

export default function EditPGDrawer({
  pg,
  isOpen,
  ownerId,
  onClose,
  onSaved,
}: EditPGDrawerProps) {
  const formRef = useRef<HTMLDivElement>(null);

  // Basic Info
  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Bengaluru");
  const [pincode, setPincode] = useState("");
  const [type, setType] = useState<PGType>("coliving");

  // Rules
  const [gateTiming, setGateTiming] = useState("");
  const [visitorPolicy, setVisitorPolicy] = useState("");
  const [noticePeriodDays, setNoticePeriodDays] = useState<number>(30);
  const [otherRules, setOtherRules] = useState("");

  // Facilities
  const [facilities, setFacilities] = useState<string[]>([]);
  const [customFacilityInput, setCustomFacilityInput] = useState("");

  // Pricing Defaults
  const [deposit, setDeposit] = useState<string>("");
  const [maintenance, setMaintenance] = useState<string>("");
  const [foodIncluded, setFoodIncluded] = useState<boolean>(false);
  const [roomTypeRent, setRoomTypeRent] = useState<Record<number, string>>({
    1: "",
    2: "",
    3: "",
    4: "",
  });
  const [acRoomTypeRent, setAcRoomTypeRent] = useState<Record<number, string>>({
    1: "",
    2: "",
    3: "",
    4: "",
  });

  // Validation & status
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState("");

  // Touch helper
  const touch = (field: string) => setTouched((p) => ({ ...p, [field]: true }));
  const touchAll = () =>
    setTouched({
      name: true,
      contactPhone: true,
      address: true,
      city: true,
      pincode: true,
    });

  // Populate state whenever pg changes
  useEffect(() => {
    if (!pg) return;
    setName(pg.name || "");
    setLogoUrl(pg.logoUrl || "");
    setContactPhone(pg.contactPhone || "");
    setAddress(pg.address || "");
    setCity(pg.city || "Bengaluru");
    setPincode(pg.pincode || "");
    setType(pg.type || "coliving");

    setGateTiming(pg.rules?.gateTiming || "");
    setVisitorPolicy(pg.rules?.visitorPolicy || "");
    setNoticePeriodDays(
      pg.rules?.noticePeriodDays !== undefined ? pg.rules.noticePeriodDays : 30
    );
    setOtherRules(pg.rules?.otherRules || "");

    setFacilities(Array.isArray(pg.facilities) ? [...pg.facilities] : []);

    setDeposit(pg.pricing?.deposit !== undefined ? String(pg.pricing.deposit) : "");
    setMaintenance(
      pg.pricing?.maintenance !== undefined ? String(pg.pricing.maintenance) : ""
    );
    setFoodIncluded(!!pg.pricing?.foodIncluded);

    const initialRentMap: Record<number, string> = {
      1: "",
      2: "",
      3: "",
      4: "",
    };
    if (pg.pricing?.roomTypeRent) {
      for (let s = 1; s <= 6; s++) {
        if (pg.pricing.roomTypeRent[s] !== undefined) {
          initialRentMap[s] = String(pg.pricing.roomTypeRent[s]);
        }
      }
    }
    setRoomTypeRent(initialRentMap);

    const initialAcRentMap: Record<number, string> = {
      1: "",
      2: "",
      3: "",
      4: "",
    };
    if (pg.pricing?.acRoomTypeRent) {
      for (let s = 1; s <= 6; s++) {
        if (pg.pricing.acRoomTypeRent[s] !== undefined) {
          initialAcRentMap[s] = String(pg.pricing.acRoomTypeRent[s]);
        }
      }
    }
    setAcRoomTypeRent(initialAcRentMap);

    setTouched({});
    setErrorBanner("");
  }, [pg]);

  if (!isOpen || !pg) return null;

  // Validation rules
  const validateName = (v: string) => (!v.trim() ? "PG Name is required." : "");
  const validatePhone = (v: string) => {
    const clean = v.replace(/\D/g, "");
    if (!clean) return "Contact phone is required.";
    if (!/^[6-9]\d{9}$/.test(clean)) return "Must be 10 digits starting with 6-9.";
    return "";
  };
  const validateAddress = (v: string) => (!v.trim() ? "Address is required." : "");
  const validateCity = (v: string) => (!v.trim() ? "City is required." : "");
  const validatePincode = (v: string) => {
    const clean = v.replace(/\D/g, "");
    if (!clean) return "Pincode is required.";
    if (!/^\d{6}$/.test(clean)) return "Pincode must be exactly 6 digits.";
    return "";
  };

  const nameError = validateName(name);
  const phoneError = validatePhone(contactPhone);
  const addressError = validateAddress(address);
  const cityError = validateCity(city);
  const pincodeError = validatePincode(pincode);

  const hasErrors =
    !!nameError || !!phoneError || !!addressError || !!cityError || !!pincodeError;

  const toggleFacility = (facilityId: string) => {
    setFacilities((prev) =>
      prev.includes(facilityId)
        ? prev.filter((f) => f !== facilityId)
        : [...prev, facilityId]
    );
  };

  const handleAddCustomFacility = () => {
    const trimmed = customFacilityInput.trim();
    if (trimmed && !facilities.includes(trimmed)) {
      setFacilities((prev) => [...prev, trimmed]);
      setCustomFacilityInput("");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    touchAll();

    if (hasErrors) {
      const firstErrorEl = formRef.current?.querySelector(
        "[data-haserror='true']"
      ) as HTMLElement | null;
      firstErrorEl?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setLoading(true);
    setErrorBanner("");

    try {
      const parsedRoomRent: Record<number, number> = {};
      Object.entries(roomTypeRent).forEach(([sharing, val]) => {
        if (val.trim()) {
          parsedRoomRent[Number(sharing)] = sanitizeNonNegative(val, 0);
        }
      });

      const parsedAcRoomRent: Record<number, number> = {};
      Object.entries(acRoomTypeRent).forEach(([sharing, val]) => {
        if (val.trim()) {
          parsedAcRoomRent[Number(sharing)] = sanitizeNonNegative(val, 0);
        }
      });

      const updatedPricing: PGPricing = {
        deposit: sanitizeNonNegative(deposit, 0),
        maintenance: sanitizeNonNegative(maintenance, 0),
        foodIncluded,
        roomTypeRent: parsedRoomRent,
        acRoomTypeRent: Object.keys(parsedAcRoomRent).length > 0 ? parsedAcRoomRent : undefined,
      };

      const updatedRules: PGRules = {
        gateTiming: gateTiming.trim(),
        visitorPolicy: visitorPolicy.trim(),
        noticePeriodDays: Number(noticePeriodDays) || 30,
        otherRules: otherRules.trim(),
      };

      const updatedPG: PGProperty = {
        ...pg,
        name: name.trim(),
        logoUrl: logoUrl.trim() || undefined,
        contactPhone: contactPhone.replace(/\D/g, ""),
        address: address.trim(),
        city: city.trim(),
        pincode: pincode.trim(),
        type,
        rules: updatedRules,
        facilities,
        pricing: updatedPricing,
        updatedAt: new Date().toISOString(),
      };

      await updatePG(ownerId, updatedPG);

      onSaved(updatedPG);
      onClose();
    } catch (err: unknown) {
      const e = err as Error;
      setErrorBanner(e.message || "Could not save. Please check your internet and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex justify-end">
      {/* Backdrop */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Drawer panel: side panel on desktop, bottom sheet style / full on mobile */}
      <div className="relative w-full max-w-xl bg-white h-full overflow-y-auto shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur z-20">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Edit Property Details</h2>
              <p className="text-xs text-slate-500">Update general details, rules & pricing</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-6 flex-1" ref={formRef}>
          {errorBanner && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span>{errorBanner}</span>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-6" noValidate>
            {/* Section 1: Basic Information */}
            <div className="space-y-3.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" /> Basic Information
              </p>

              {/* PG Name */}
              <div data-haserror={touched.name && !!nameError ? "true" : "false"}>
                <FieldWrapper
                  label="PG Name"
                  error={nameError}
                  touched={!!touched.name}
                  required
                >
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={() => touch("name")}
                    placeholder="e.g. Stanza Living - Serenity House"
                    className={inputCls}
                  />
                </FieldWrapper>
              </div>

              {/* PG Type & Logo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FieldWrapper label="PG Type" error="" touched={false} required>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as PGType)}
                    className={selectCls}
                  >
                    {PG_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </FieldWrapper>

                <FieldWrapper
                  label="Logo Image URL (Optional)"
                  error=""
                  touched={false}
                  hint="Web link to your PG's logo"
                >
                  <input
                    type="url"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://example.com/logo.png"
                    className={inputCls}
                  />
                </FieldWrapper>
              </div>

              {/* Contact Phone */}
              <div data-haserror={touched.contactPhone && !!phoneError ? "true" : "false"}>
                <FieldWrapper
                  label="Primary Contact Phone"
                  error={phoneError}
                  touched={!!touched.contactPhone}
                  required
                  hint="10-digit Indian phone number"
                >
                  <div className="flex rounded-xl border border-slate-300 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-teal-500">
                    <span className="px-3 py-2 bg-slate-100 text-slate-600 text-xs font-bold border-r border-slate-300">
                      +91
                    </span>
                    <input
                      type="tel"
                      maxLength={10}
                      value={contactPhone}
                      onChange={(e) =>
                        setContactPhone(e.target.value.replace(/\D/g, ""))
                      }
                      onBlur={() => touch("contactPhone")}
                      placeholder="9876543210"
                      className="w-full px-2.5 py-2 text-xs font-bold focus:outline-none"
                    />
                  </div>
                </FieldWrapper>
              </div>
            </div>

            {/* Section 2: Address & Location */}
            <div className="space-y-3.5 pt-4 border-t border-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> Address & Location
              </p>

              <div data-haserror={touched.address && !!addressError ? "true" : "false"}>
                <FieldWrapper
                  label="Full Street Address"
                  error={addressError}
                  touched={!!touched.address}
                  required
                >
                  <textarea
                    rows={2}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    onBlur={() => touch("address")}
                    placeholder="e.g. #14, 5th Cross, Koramangala 4th Block"
                    className={inputCls}
                  />
                </FieldWrapper>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div data-haserror={touched.city && !!cityError ? "true" : "false"}>
                  <FieldWrapper
                    label="City"
                    error={cityError}
                    touched={!!touched.city}
                    required
                  >
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      onBlur={() => touch("city")}
                      placeholder="e.g. Bengaluru"
                      className={inputCls}
                    />
                  </FieldWrapper>
                </div>

                <div data-haserror={touched.pincode && !!pincodeError ? "true" : "false"}>
                  <FieldWrapper
                    label="Pincode"
                    error={pincodeError}
                    touched={!!touched.pincode}
                    required
                    hint="6 digits"
                  >
                    <input
                      type="text"
                      maxLength={6}
                      value={pincode}
                      onChange={(e) =>
                        setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      onBlur={() => touch("pincode")}
                      placeholder="560034"
                      className={inputCls}
                    />
                  </FieldWrapper>
                </div>
              </div>
            </div>

            {/* Section 3: House Rules */}
            <div className="space-y-3.5 pt-4 border-t border-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" /> House Rules & Policies
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FieldWrapper
                  label="Gate Closing Timing"
                  error=""
                  touched={false}
                  hint="e.g. 10:30 PM or leave empty for 24/7 open"
                >
                  <input
                    type="text"
                    value={gateTiming}
                    onChange={(e) => setGateTiming(e.target.value)}
                    placeholder="e.g. 10:30 PM"
                    className={inputCls}
                  />
                </FieldWrapper>

                <FieldWrapper
                  label="Notice Period (Days)"
                  error=""
                  touched={false}
                  hint="Default notice required to vacate"
                >
                  <input
                    type="number"
                    min="0"
                    max="180"
                    value={noticePeriodDays}
                    onChange={(e) =>
                      setNoticePeriodDays(Math.max(0, parseInt(e.target.value) || 0))
                    }
                    className={inputCls}
                  />
                </FieldWrapper>
              </div>

              <FieldWrapper
                label="Visitor Policy"
                error=""
                touched={false}
                hint="Rules for guests and visitors"
              >
                <input
                  type="text"
                  value={visitorPolicy}
                  onChange={(e) => setVisitorPolicy(e.target.value)}
                  placeholder="e.g. Allowed in common area until 8:30 PM"
                  className={inputCls}
                />
              </FieldWrapper>

              <FieldWrapper
                label="Other House Rules"
                error=""
                touched={false}
                hint="Smoking, alcohol, quiet hours, etc."
              >
                <textarea
                  rows={2}
                  value={otherRules}
                  onChange={(e) => setOtherRules(e.target.value)}
                  placeholder="e.g. No loud music after 10 PM. Clean common kitchen after use."
                  className={inputCls}
                />
              </FieldWrapper>
            </div>

            {/* Section 4: Facilities & Amenities */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                Facilities & Amenities
              </p>

              <div className="grid grid-cols-2 gap-2">
                {STANDARD_FACILITIES.map((fac) => {
                  const checked = facilities.includes(fac.id);
                  return (
                    <button
                      key={fac.id}
                      type="button"
                      onClick={() => toggleFacility(fac.id)}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border text-left text-xs font-semibold transition ${
                        checked
                          ? "bg-teal-50 border-teal-300 text-teal-900"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center text-[10px] ${
                          checked
                            ? "bg-teal-600 text-white"
                            : "border border-slate-300"
                        }`}
                      >
                        {checked && "✓"}
                      </div>
                      <span className="truncate">{fac.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Popular custom tags */}
              <div className="pt-2">
                <span className="text-[11px] font-semibold text-slate-600 block mb-1.5">
                  Popular additional amenities:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_CUSTOM_FACILITIES.map((name) => {
                    const checked = facilities.includes(name);
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => toggleFacility(name)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition ${
                          checked
                            ? "bg-teal-100 border-teal-300 text-teal-800"
                            : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {checked ? `✓ ${name}` : `+ ${name}`}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Add other facility */}
              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={customFacilityInput}
                  onChange={(e) => setCustomFacilityInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCustomFacility();
                    }
                  }}
                  placeholder="Add custom facility (e.g. EV Charging)"
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={handleAddCustomFacility}
                  className="px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition shrink-0"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Section 5: Pricing Defaults */}
            <div className="space-y-3.5 pt-4 border-t border-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5" /> Pricing Defaults
              </p>

              {/* Note about default rent */}
              <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <span>
                  This changes the default rent. Rooms or beds with their own custom rent will keep it.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FieldWrapper
                  label="Security Deposit (₹)"
                  error=""
                  touched={false}
                  hint="Standard refundable deposit"
                >
                  <div className="flex items-center rounded-xl border border-slate-300 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-teal-500">
                    <span className="px-3 text-xs font-bold text-slate-500">₹</span>
                    <input
                      type="number"
                      min="0"
                      step={500}
                      value={deposit}
                      onChange={(e) => setDeposit(e.target.value)}
                      placeholder="e.g. 5000"
                      className="w-full px-2 py-2 text-xs font-bold focus:outline-none"
                    />
                  </div>
                </FieldWrapper>

                <FieldWrapper
                  label="Maintenance (₹ / month)"
                  error=""
                  touched={false}
                  hint="Monthly upkeep or utilities"
                >
                  <div className="flex items-center rounded-xl border border-slate-300 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-teal-500">
                    <span className="px-3 text-xs font-bold text-slate-500">₹</span>
                    <input
                      type="number"
                      min="0"
                      step={100}
                      value={maintenance}
                      onChange={(e) => setMaintenance(e.target.value)}
                      placeholder="e.g. 500"
                      className="w-full px-2 py-2 text-xs font-bold focus:outline-none"
                    />
                  </div>
                </FieldWrapper>
              </div>

              {/* Food Included */}
              <div className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50">
                <input
                  type="checkbox"
                  id="foodIncludedCheck"
                  checked={foodIncluded}
                  onChange={(e) => setFoodIncluded(e.target.checked)}
                  className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500 border-slate-300"
                />
                <label
                  htmlFor="foodIncludedCheck"
                  className="text-xs font-semibold text-slate-800 cursor-pointer flex items-center gap-1.5"
                >
                  <Utensils className="w-3.5 h-3.5 text-slate-500" />
                  Food is included in the standard rent
                </label>
              </div>

              {/* Rent per sharing type */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-2">
                  Default Rent per Sharing Type (₹ / month)
                </label>

                {/* AC rent warning: any AC room whose sharing type has no AC rent */}
                {(() => {
                  const acSharings = new Set<number>();
                  pg.floors.forEach((fl) =>
                    fl.rooms.forEach((rm) => {
                      if (rm.isAc) acSharings.add(rm.sharingType);
                    })
                  );
                  const missing = Array.from(acSharings).filter(
                    (s) => !acRoomTypeRent[s]?.trim()
                  );
                  if (missing.length === 0) return null;
                  return (
                    <div className="mb-2 p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-800 text-[11px] font-semibold flex items-start gap-2">
                      <span className="mt-0.5">⚠️</span>
                      <span>
                        AC rooms exist for {missing.map((s) => `${s}-sharing`).join(", ")} but no AC rent is set. Beds in these rooms will use the Non-AC price as fallback.
                      </span>
                    </div>
                  );
                })()}

                {/* Table: one row per sharing type, two columns */}
                <div className="space-y-2">
                  {/* Header */}
                  <div className="grid grid-cols-[80px_1fr_1fr] gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1">
                    <span></span>
                    <span>Non-AC rent</span>
                    <span>AC rent</span>
                  </div>
                  {[1, 2, 3, 4].map((sharing) => (
                    <div
                      key={sharing}
                      className="grid grid-cols-[80px_1fr_1fr] gap-2 items-center"
                    >
                      <span className="text-[11px] font-bold text-slate-700">
                        {sharing}-Sharing
                      </span>
                      {/* Non-AC input */}
                      <div className="flex items-center rounded-lg border border-slate-300 bg-white overflow-hidden focus-within:ring-1 focus-within:ring-teal-500">
                        <span className="px-2 text-xs text-slate-400 font-medium">₹</span>
                        <input
                          type="number"
                          min="0"
                          step={500}
                          value={roomTypeRent[sharing] || ""}
                          onChange={(e) =>
                            setRoomTypeRent((prev) => ({
                              ...prev,
                              [sharing]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "-" || e.key === "e") e.preventDefault();
                          }}
                          placeholder="e.g. 8500"
                          className="w-full px-1.5 py-1 text-xs font-bold focus:outline-none"
                        />
                      </div>
                      {/* AC input */}
                      <div className="flex items-center rounded-lg border border-slate-300 bg-white overflow-hidden focus-within:ring-1 focus-within:ring-teal-500">
                        <span className="px-2 text-xs text-slate-400 font-medium">₹</span>
                        <input
                          type="number"
                          min="0"
                          step={500}
                          value={acRoomTypeRent[sharing] || ""}
                          onChange={(e) =>
                            setAcRoomTypeRent((prev) => ({
                              ...prev,
                              [sharing]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "-" || e.key === "e") e.preventDefault();
                          }}
                          placeholder="e.g. 10000"
                          className="w-full px-1.5 py-1 text-xs font-bold focus:outline-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-2 sticky bottom-0 bg-white/95 pb-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm transition shadow-sm disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{loading ? "Saving..." : "Save Changes"}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
