import { PGProperty, Floor, Room, Bed, BedStatus } from "../types";

export interface DemoTenantRecord {
  id: string;
  owner_id: string;
  bed_id: string;
  full_name: string;
  phone: string;
  alt_contact_name: string;
  alt_contact_relation: string;
  alt_phone: string;
  native_address: string;
  id_type: string;
  id_last4: string;
  gender: string;
  occupation: string;
  join_date: string;
  status: "active" | "notice";
}

/**
 * Generate a rich, realistic Indian PG demo dataset (3 floors, 20 rooms, ~45 beds)
 * and corresponding live tenants for the public.tenants table.
 */
export function generateDemoPG(ownerId: string): {
  pg: PGProperty;
  tenants: DemoTenantRecord[];
} {
  const pgId = crypto.randomUUID();

  const floorConfigs = [
    {
      name: "Ground Floor",
      prefix: "G",
      roomCount: 6,
      startNum: 1,
    },
    {
      name: "1st Floor",
      prefix: "10",
      roomCount: 7,
      startNum: 1,
    },
    {
      name: "2nd Floor",
      prefix: "20",
      roomCount: 7,
      startNum: 1,
    },
  ];

  const sampleTenants = [
    {
      name: "Rahul Sharma",
      phone: "9876543210",
      altName: "Ramesh Sharma",
      altRelation: "Father",
      altPhone: "9876543211",
      address: "Flat 302, Green Glen Layout, Bellandur, Bengaluru",
      gender: "male",
      occupation: "Software Engineer",
      idLast4: "4521",
    },
    {
      name: "Pooja Verma",
      phone: "9812345678",
      altName: "Sunita Verma",
      altRelation: "Mother",
      altPhone: "9812345670",
      address: "H.No 12, Civil Lines, Jaipur, Rajasthan",
      gender: "female",
      occupation: "Product Designer",
      idLast4: "8912",
    },
    {
      name: "Karthik Raja",
      phone: "9789012345",
      altName: "Raja Manickam",
      altRelation: "Father",
      altPhone: "9789012340",
      address: "15/B Cross, Anna Nagar, Chennai, Tamil Nadu",
      gender: "male",
      occupation: "Data Analyst",
      idLast4: "1934",
    },
    {
      name: "Sneha Reddy",
      phone: "9654321098",
      altName: "Venkat Reddy",
      altRelation: "Father",
      altPhone: "9654321090",
      address: "Plot 88, Madhapur, Hyderabad, Telangana",
      gender: "female",
      occupation: "Chartered Accountant",
      idLast4: "6723",
    },
    {
      name: "Vikram Malhotra",
      phone: "9543210987",
      altName: "Ashok Malhotra",
      altRelation: "Father",
      altPhone: "9543210980",
      address: "Sector 14, Chandigarh",
      gender: "male",
      occupation: "Consultant",
      idLast4: "3389",
    },
    {
      name: "Ananya Iyer",
      phone: "9432109876",
      altName: "Sankaran Iyer",
      altRelation: "Father",
      altPhone: "9432109870",
      address: "Matunga East, Mumbai, Maharashtra",
      gender: "female",
      occupation: "Content Strategist",
      idLast4: "9120",
    },
    {
      name: "Rohan Gupta",
      phone: "9321098765",
      altName: "Sanjay Gupta",
      altRelation: "Father",
      altPhone: "9321098760",
      address: "Aliganj, Lucknow, Uttar Pradesh",
      gender: "male",
      occupation: "Graduate Student",
      idLast4: "7741",
    },
    {
      name: "Meera Nair",
      phone: "9210987654",
      altName: "Gopinath Nair",
      altRelation: "Father",
      altPhone: "9210987650",
      address: "Panampilly Nagar, Kochi, Kerala",
      gender: "female",
      occupation: "UI/UX Engineer",
      idLast4: "2845",
    },
    {
      name: "Amitabh Sen",
      phone: "9109876543",
      altName: "Debashis Sen",
      altRelation: "Father",
      altPhone: "9109876540",
      address: "Salt Lake Sector 1, Kolkata, West Bengal",
      gender: "male",
      occupation: "DevOps Engineer",
      idLast4: "5512",
    },
    {
      name: "Divya Joshi",
      phone: "9988776655",
      altName: "Kamlesh Joshi",
      altRelation: "Father",
      altPhone: "9988776650",
      address: "Kothrud, Pune, Maharashtra",
      gender: "female",
      occupation: "Teacher",
      idLast4: "4490",
    },
    {
      name: "Harish Kumar",
      phone: "9877665544",
      altName: "Mohan Kumar",
      altRelation: "Father",
      altPhone: "9877665540",
      address: "Rajendra Nagar, Patna, Bihar",
      gender: "male",
      occupation: "Bank Officer",
      idLast4: "6618",
    },
    {
      name: "Priya Sundaram",
      phone: "9766554433",
      altName: "Sundaramurthy K",
      altRelation: "Father",
      altPhone: "9766554430",
      address: "RS Puram, Coimbatore, Tamil Nadu",
      gender: "female",
      occupation: "Medical Intern",
      idLast4: "3027",
    },
  ];

  let tenantIndex = 0;
  let bedCounter = 0;
  const demoTenants: DemoTenantRecord[] = [];

  const floors: Floor[] = floorConfigs.map((fc, floorIndex) => {
    const floorId = crypto.randomUUID();
    const rooms: Room[] = [];

    for (let i = 0; i < fc.roomCount; i++) {
      const roomNum = fc.startNum + i;
      const roomName = `${fc.prefix}${roomNum < 10 && fc.prefix === "G" ? "0" : ""}${roomNum}`;
      const roomId = crypto.randomUUID();

      // Alternate sharing types: 1, 2, 3, or 2
      const sharingType = (i % 3 === 0) ? 1 : (i % 3 === 1) ? 2 : 3;
      const isAc = i % 2 === 0;
      const hasAttachedBathroom = i !== 1;

      const beds: Bed[] = [];
      const charCodes = ["A", "B", "C", "D"];

      for (let b = 0; b < sharingType; b++) {
        bedCounter++;
        const bedId = crypto.randomUUID();
        const bedLetter = charCodes[b];

        let status: BedStatus = "vacant";
        let notes: string | undefined = undefined;

        if (bedCounter === 3) {
          status = "maintenance";
          notes = "AC gas refill & electrical switch repair in progress.";
        } else if (bedCounter === 7) {
          status = "notice";
          const t = sampleTenants[tenantIndex % sampleTenants.length];
          tenantIndex++;
          notes = "Serving notice period. Vacating on 31st of this month.";

          demoTenants.push({
            id: crypto.randomUUID(),
            owner_id: ownerId,
            bed_id: bedId,
            full_name: t.name,
            phone: t.phone,
            alt_contact_name: t.altName,
            alt_contact_relation: t.altRelation,
            alt_phone: t.altPhone,
            native_address: t.address,
            id_type: "aadhaar",
            id_last4: t.idLast4,
            gender: t.gender,
            occupation: t.occupation,
            join_date: "2026-08-01",
            status: "notice",
          });
        } else if (bedCounter === 11) {
          status = "reserved";
          notes = "Reserved by college student joining next Monday. Advance ₹2,000 paid.";
        } else if (bedCounter % 2 === 0 && tenantIndex < sampleTenants.length) {
          status = "occupied";
          const t = sampleTenants[tenantIndex % sampleTenants.length];
          tenantIndex++;

          demoTenants.push({
            id: crypto.randomUUID(),
            owner_id: ownerId,
            bed_id: bedId,
            full_name: t.name,
            phone: t.phone,
            alt_contact_name: t.altName,
            alt_contact_relation: t.altRelation,
            alt_phone: t.altPhone,
            native_address: t.address,
            id_type: "aadhaar",
            id_last4: t.idLast4,
            gender: t.gender,
            occupation: t.occupation,
            join_date: "2026-09-15",
            status: "active",
          });
        } else {
          status = "vacant";
        }

        beds.push({
          id: bedId,
          roomId,
          name: `Bed ${bedLetter}`,
          status,
          notes,
          updatedAt: new Date().toISOString(),
        });
      }

      rooms.push({
        id: roomId,
        floorId,
        name: roomName,
        sharingType,
        isAc,
        hasAttachedBathroom,
        amenities: ["cot", "mattress", "cupboard", "studyTable"],
        beds,
      });
    }

    return {
      id: floorId,
      name: fc.name,
      order: floorIndex + 1,
      rooms,
    };
  });

  const pg: PGProperty = {
    id: pgId,
    owner_id: ownerId,
    name: "Sri Balaji Executive PG",
    logoUrl: "",
    contactPhone: "9876543210",
    address: "Plot 42, Outer Ring Road, Near EcoSpace, Bellandur",
    city: "Bengaluru",
    pincode: "560103",
    type: "coliving",
    rules: {
      gateTiming: "11:00 PM",
      visitorPolicy: "Guests allowed in reception lounge until 8:30 PM",
      noticePeriodDays: 30,
      otherRules: "Strictly non-smoking property. Keep common areas clean.",
    },
    facilities: [
      "wifi",
      "laundry",
      "food",
      "parking",
      "powerBackup",
      "cctv",
      "housekeeping",
    ],
    pricing: {
      deposit: 6000,
      maintenance: 500,
      foodIncluded: true,
      roomTypeRent: {
        1: 13500,
        2: 8500,
        3: 6500,
        4: 5000,
      },
      acRoomTypeRent: {
        1: 15500,
        2: 10000,
        3: 8000,
        4: 6500,
      },
    },
    floors,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return { pg, tenants: demoTenants };
}
