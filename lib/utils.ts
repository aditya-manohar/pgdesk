import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { PGProperty, Room, Bed } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number into Indian Rupees with Indian numbering system commas.
 * Example: 8500 -> "₹8,500", 125000 -> "₹1,25,000"
 */
export function formatINR(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return "₹0";
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format date to standard Indian format: DD/MM/YYYY
 */
export function formatDate(dateStringOrTimestamp: string | number | Date): string {
  try {
    const d = new Date(dateStringOrTimestamp);
    if (isNaN(d.getTime())) return "-";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return "-";
  }
}

/**
 * Validate 10-digit Indian mobile number
 */
export function isValidIndianPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, "");
  // Accepts 10 digits, or 12 digits starting with 91, or 11 starting with 0
  if (cleaned.length === 10) return /^[6-9]\d{9}$/.test(cleaned);
  if (cleaned.length === 12 && cleaned.startsWith("91")) return /^[6-9]\d{9}$/.test(cleaned.slice(2));
  if (cleaned.length === 11 && cleaned.startsWith("0")) return /^[6-9]\d{9}$/.test(cleaned.slice(1));
  return false;
}

/**
 * Clean phone number to standard 10 digits
 */
export function cleanIndianPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 12 && cleaned.startsWith("91")) return cleaned.slice(2);
  if (cleaned.length === 11 && cleaned.startsWith("0")) return cleaned.slice(1);
  return cleaned;
}

/**
 * Generate bed labels given a sharing count.
 * Example: sharingCount 3 -> ["Bed A", "Bed B", "Bed C"]
 */
export function generateBedLabels(count: number): string[] {
  const labels: string[] = [];
  for (let i = 0; i < count; i++) {
    // A, B, C... Z, AA, AB...
    const char = String.fromCharCode(65 + i);
    labels.push(`Bed ${char}`);
  }
  return labels;
}

/**
 * Safely parse and sanitize any input to guarantee it is >= 0 (no negative values).
 */
export function sanitizeNonNegative(val: any, fallback = 0): number {
  if (val === undefined || val === null || val === "") return fallback;
  const num = Number(val);
  if (isNaN(num)) return fallback;
  return Math.max(0, num);
}

/**
 * Format 24-hour time "HH:MM" (e.g. "22:30") to friendly 12-hour AM/PM format (e.g. "10:30 PM").
 */
export function formatTime12Hour(timeStr?: string): string {
  if (!timeStr || !timeStr.trim()) return "No gate restriction (24/7 Open)";
  try {
    const [hoursStr, minsStr] = timeStr.split(":");
    let hours = parseInt(hoursStr, 10);
    const mins = minsStr ? minsStr.padStart(2, "0") : "00";
    if (isNaN(hours)) return timeStr;
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 is 12 AM
    return `${hours}:${mins} ${ampm}`;
  } catch {
    return timeStr;
  }
}

// ============================================================
// VERHOEFF CHECKSUM ALGORITHM & AADHAAR FORMATTING
// ============================================================

const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

export function validateVerhoeff(str: string): boolean {
  const clean = str.replace(/\D/g, "");
  if (!clean) return false;
  let c = 0;
  const digits = clean.split("").map(Number).reverse();
  for (let i = 0; i < digits.length; i++) {
    c = VERHOEFF_D[c][VERHOEFF_P[i % 8][digits[i]]];
  }
  return c === 0;
}

export function isValidAadhaar(str: string): { valid: boolean; error?: string } {
  const clean = str.replace(/\D/g, "");
  if (clean.length !== 12) {
    return { valid: false, error: "Aadhaar must be 12 digits starting with 2-9." };
  }
  if (!/^[2-9]\d{11}$/.test(clean)) {
    return { valid: false, error: "Aadhaar must start with a digit between 2 and 9." };
  }
  if (!validateVerhoeff(clean)) {
    return { valid: false, error: "Invalid Aadhaar number (checksum failed). Please check the digits." };
  }
  return { valid: true };
}

export function formatAadhaar(str: string): string {
  const digits = str.replace(/\D/g, "").slice(0, 12);
  const parts: string[] = [];
  for (let i = 0; i < digits.length; i += 4) {
    parts.push(digits.slice(i, i + 4));
  }
  return parts.join(" ");
}

// ============================================================
// BED RENT HELPER
// ============================================================

export type RentSource =
  | "bed_custom"         // bed has its own custom_rent
  | "room_custom"        // room has its own custom_rent, bed has none
  | "ac_default"         // room is AC and pg.pricing.acRoomTypeRent has this sharing type
  | "regular_default"    // non-AC room (or AC room used as fallback) matched roomTypeRent
  | "ac_fallback_regular"// room is AC but no AC price set; using the regular price as fallback
  | "not_set";           // no price found anywhere

/**
 * Resolve the effective monthly rent for a bed.
 *
 * Priority order:
 *  1. bed.customRent  (bed-level override)
 *  2. room.customRent (room-level override)
 *  3. pg.pricing.acRoomTypeRent[room.sharingType]  (only when room.isAc)
 *  4. pg.pricing.roomTypeRent[room.sharingType]     (regular/non-AC default)
 *     → source is "ac_fallback_regular" if room.isAc, otherwise "regular_default"
 *  5. null / "not_set"
 */
export function getBedRent(
  pg: PGProperty,
  room: Room,
  bed: Bed
): { amount: number | null; source: RentSource } {
  // 1. Bed custom rent
  if (bed.customRent !== undefined && bed.customRent !== null) {
    return { amount: bed.customRent, source: "bed_custom" };
  }

  // 2. Room custom rent
  if (room.customRent !== undefined && room.customRent !== null) {
    return { amount: room.customRent, source: "room_custom" };
  }

  const sharing = room.sharingType;

  // 3. AC default rent (only for AC rooms)
  if (room.isAc) {
    const acRent = pg.pricing.acRoomTypeRent?.[sharing];
    if (acRent !== undefined && acRent !== null) {
      return { amount: acRent, source: "ac_default" };
    }
  }

  // 4. Regular default rent
  const regularRent = pg.pricing.roomTypeRent[sharing];
  if (regularRent !== undefined && regularRent !== null) {
    return {
      amount: regularRent,
      source: room.isAc ? "ac_fallback_regular" : "regular_default",
    };
  }

  // 5. Nothing found
  return { amount: null, source: "not_set" };
}

/**
 * Returns a human-readable label for a rent source, given the room context.
 */
export function getRentSourceLabel(source: RentSource, room: Room): string {
  switch (source) {
    case "bed_custom":
      return "Custom rent for this bed";
    case "room_custom":
      return "Custom rent for this room";
    case "ac_default":
      return `Default for ${room.sharingType}-sharing AC`;
    case "regular_default":
      return `Default for ${room.sharingType}-sharing`;
    case "ac_fallback_regular":
      return `Default for ${room.sharingType}-sharing (no AC price set)`;
    case "not_set":
      return "";
  }
}

