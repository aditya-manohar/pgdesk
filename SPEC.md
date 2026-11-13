# PGDesk - Master Specification

## Product Overview
- **Name**: PGDesk (placeholder)
- **Goal**: The easiest PG management software for Indian PG owners. Very simple UX, mobile-first, usable by a non-technical owner with zero training. Must start at zero running cost (free tiers only).

## Users & Roles
1. **Owner**: Signs up, creates one or more PGs, manages everything.
2. **Tenant**: Sees own rent, pays, raises complaints, reads notices.
3. **Staff (warden/cook)**: Limited access to assigned tasks.
*Strict data isolation*: One owner must NEVER see another owner's data.

## Data Hierarchy
```
Owner -> PG (property) -> Floor/Block -> Room -> Bed -> Tenant assignment
```

## PG Setup Wizard
- **Step 1 - PG details**: Name, logo (optional), contact number, full address, city, pincode, type (boys / girls / co-living), rules (gate timing, visitor policy), facilities (Wi-Fi, laundry, food, parking, power backup, CCTV).
- **Step 2 - Floors/blocks**: Owner chooses how many and names them freely (Ground, 1st, Block A, Terrace).
- **Step 3 - Rooms (two ways)**:
  - **(a) Quick generate**: "Floor 1 has 10 rooms starting at 101" creates 101-110.
  - **(b) Custom naming**: Any name allowed (G-1, 201A, Big Hall). Every room can be renamed later.
- **Step 4 - Room details**: Sharing type (single/double/triple/custom up to 8), AC or non-AC, attached bathroom or common, amenities (cot, mattress, cupboard, balcony, study table), optional photos. Beds are auto-created from sharing type (e.g., triple = beds A, B, C).
- **Step 5 - Pricing**: Rent per bed by room type, with override for any single room or bed. Security deposit, maintenance charge, food included yes/no.
- **Step 6 - Review & go live**: Review all setup details and activate, then transition directly to the Bed Map.

## Bed Map (Main Screen)
Visual grid grouped by floor.
- **Color Coding**:
  - Green: Vacant
  - Red: Occupied
  - Yellow: Notice period
  - Blue: Reserved
  - Grey: Under maintenance
- **Interactions**: Tap a bed to view details and take actions.
- **Filters**: Vacant only, AC only, floor, boys/girls.
- **Actions**: Block bed for maintenance, change a room's sharing count, add/remove rooms or beds later without disturbing existing tenants.

## Future Phases (Do NOT build yet)
- **Phase B**: Tenant onboarding via shareable link (ID upload, photo, emergency contact), assign beds, check-in/check-out, deposit refund.
- **Phase C**: Monthly rent generation, UPI payment links, receipts, reminders, late fees, add-ons (electricity/food/laundry), complaints with photos.
- **Phase D**: Reports (income, dues, occupancy, expenses, profit), notices, visitor log, expense tracker.
- **Phase E**: Enquiry/lead page, food/mess module, multi-language (English, Hindi, Telugu), Form-C / police verification support.

## Technical Architecture & Rules
- **Framework & Styling**: Next.js (App Router) + TypeScript + Tailwind CSS.
- **Platform**: Mobile-first and installable as a Progressive Web App (PWA).
- **Data Layer Architecture**:
  - Put ALL data reading/writing inside `/lib/data` behind simple functions.
  - Allows starting with local browser storage and seamlessly switching to Supabase later without rewriting UI screens.
- **Multi-Tenancy & Data Isolation**:
  - Design every entity/table with an `owner_id` so strict multi-tenant isolation is maintained.
- **Indian Localization**:
  - Currency: Indian Rupees (₹) with Indian number formatting (e.g., ₹1,50,000).
  - Phone Numbers: +91 standard with Indian validation.
  - Dates: DD/MM/YYYY.
- **UX Guidelines**: Big tap targets, simple everyday language, zero technical jargon, helpful empty states, clear error messages.
- **Process**: Maintain a `CHANGELOG.md` file and update it after every task in plain, simple words.
