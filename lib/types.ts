export type PGType = 'boys' | 'girls' | 'coliving';

export type BedStatus = 'vacant' | 'occupied' | 'notice' | 'reserved' | 'maintenance';

export type TenantStatus = 'active' | 'reserved' | 'notice' | 'left';

export interface Tenant {
  id: string;
  ownerId: string;
  bedId: string;
  pgId?: string;
  fullName: string;
  phone: string;
  altContactName?: string;
  altContactRelation?: string;
  altPhone?: string;
  nativeAddress?: string;
  idType?: string; // 'aadhaar' | 'driving_license' | 'passport' | 'voter_id' | 'pan' | 'college_id' | 'company_id' | 'other'
  idLast4?: string; // 4 characters
  gender?: string; // 'male' | 'female' | 'other'
  occupation?: string; // 'Student', 'Working Professional', 'Business', 'Other'
  joinDate: string; // YYYY-MM-DD
  leaveDate?: string; // YYYY-MM-DD
  status: TenantStatus;
  userId?: string;
  consentAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type TenantInviteStatus = "not_invited" | "invited" | "joined" | "expired";

export interface TenantInviteInfo {
  status: TenantInviteStatus;
  expiresAt?: string;
  claimedAt?: string;
}

export interface TenantStay {
  tenant: {
    id: string;
    full_name: string;
    phone: string;
    alt_contact_name?: string;
    alt_contact_relation?: string;
    alt_phone?: string;
    native_address?: string;
    id_type?: string;
    id_last4?: string;
    occupation?: string;
    status: TenantStatus;
  };
  stay: {
    room_name: string;
    bed_name: string;
    floor_name: string;
    is_ac: boolean;
    has_attached_bathroom: boolean;
    join_date: string;
    leave_date?: string;
    rent: number;
    deposit: number;
    maintenance: number;
    food_included: boolean;
  };
  pg: {
    id: string;
    name: string;
    contact_phone: string;
    address: string;
    city: string;
    pincode: string;
    type: PGType;
    gate_timing: string;
    visitor_policy: string;
    other_rules: string;
    facilities: string[];
  };
}

export interface Bed {
  id: string;
  roomId: string;
  name: string; // e.g. "Bed A", "Bed B"
  status: BedStatus;
  customRent?: number;
  tenant?: Tenant;
  tenantName?: string;
  tenantPhone?: string;
  notes?: string;
  updatedAt: string;
}

// Used when saving edits. null means "clear this value in the database";
// undefined means "leave it unchanged".
export type BedUpdates = Omit<Partial<Bed>, "customRent" | "notes"> & {
  customRent?: number | null;
  notes?: string | null;
};

export interface Room {
  id: string;
  floorId: string;
  name: string; // e.g. "101", "G-1", "A-201"
  sharingType: number; // 1 to 8
  isAc: boolean;
  hasAttachedBathroom: boolean;
  amenities: string[]; // e.g. ['cot', 'mattress', 'cupboard', 'balcony', 'studyTable']
  customRent?: number;
  photos?: string[];
  beds: Bed[];
}

export interface Floor {
  id: string;
  name: string; // e.g. "Ground Floor", "1st Floor", "Block A"
  order: number;
  rooms: Room[];
}

export interface PGRules {
  gateTiming: string; // e.g. "10:30 PM"
  visitorPolicy: string; // e.g. "Allowed in common area until 8 PM"
  noticePeriodDays?: number;
  otherRules?: string;
}

export interface PGPricing {
  deposit: number; // In ₹ (e.g. 5000)
  maintenance: number; // In ₹ (e.g. 500)
  foodIncluded: boolean;
  roomTypeRent: Record<number, number>; // sharing count -> monthly rent per bed in ₹ (non-AC / fallback)
  acRoomTypeRent?: Record<number, number>; // sharing count -> monthly rent per bed in ₹ (AC rooms only)
}

export interface PGProperty {
  id: string;
  owner_id: string; // Crucial for multi-tenant isolation
  name: string;
  logoUrl?: string;
  contactPhone: string;
  address: string;
  city: string;
  pincode: string;
  type: PGType;
  rules: PGRules;
  facilities: string[]; // e.g. ['wifi', 'laundry', 'food', 'parking', 'powerBackup', 'cctv']
  pricing: PGPricing;
  floors: Floor[];
  createdAt: string;
  updatedAt: string;
}

export interface Owner {
  id: string;
  name: string;
  phone: string;
  createdAt: string;
}

// Wizard Step state for persistence across page refreshes
export interface WizardDraft {
  step: number;
  step1: {
    name: string;
    logoUrl?: string;
    contactPhone: string;
    address: string;
    city: string;
    pincode: string;
    type: PGType;
    rules: PGRules;
    facilities: string[];
  };
  step2: {
    floors: Array<{ id: string; name: string }>;
  };
  step3: {
    roomsByFloor: Record<
      string,
      Array<{
        id: string;
        name: string;
      }>
    >;
  };
  step4: {
    roomDetails: Record<
      string,
      {
        sharingType: number;
        isAc: boolean;
        hasAttachedBathroom: boolean;
        amenities: string[];
      }
    >;
  };
  step5: {
    pricing: PGPricing;
    roomOverrides: Record<string, number>; // roomId -> custom monthly rent
  };
}