# Changelog

All notable changes to PGDesk will be documented here in simple words.

## [AC / Non-AC Rent Pricing] - 2026-10-24
### Added
- **AC & Non-AC default rents**: `PGPricing` now has an optional `acRoomTypeRent` field (same shape as `roomTypeRent`). No DB migration — pricing lives in the existing `pgs.pricing` JSONB column.
- **Two-column rent table**: Setup wizard (Step 4) and PG edit panel now show a row per sharing type with separate "Non-AC rent" and "AC rent" inputs. Negative values are blocked.
- **`getBedRent(pg, room, bed)` helper** (`lib/utils.ts`): Single source of truth for effective rent. Priority: bed custom → room custom → AC default (AC rooms only) → regular default → null. Returns `{ amount, source }`.
- **`getRentSourceLabel(source, room)`** helper: Human-readable label for each source (e.g. "Default for 2-sharing AC", "Custom rent for this bed").
- **Rent source label in bed drawer**: Small grey hint below the Custom Rent input shows the current effective rent and its source (e.g. "Effective rent: ₹10,000 (Default for 2-sharing AC)").
- **Yellow warning banner**: Shown in the pricing screen (wizard & edit panel) whenever an AC room's sharing type has no AC rent set; tells the owner which sharing sizes are falling back to the non-AC price.
- **Bed map card**: Vacant beds now display the fully resolved effective rent (using `getBedRent`) rather than only `bed.customRent`.
- **Demo data**: Added `acRoomTypeRent: { 1: 15500, 2: 10000, 3: 8000, 4: 6500 }` to the demo PG pricing.

## [Tenant Login via QR Invite & Dedicated Tenant Portal] - 2026-10-11
### Added & Improved
- **Tenant QR Invite Flow**:
  - **Owner Bed Side Panel**: Added a collapsed "Tenant App Access" section showing real-time status: *Not invited*, *Invited (expires DD/MM/YYYY)*, *Joined*, or *Expired*.
  - **Single-use Invite Generation**: Dedicated "Invite" / "Send New Invite" button generates a secure token with a 7-day expiry via PostgreSQL RPC `create_tenant_invite`.
  - **Invite Modal**: Renders client-side QR code via `qrcode`, instant copy-link, direct WhatsApp sharing with pre-formatted message (`wa.me`), and PNG QR download.
  - **Strict Security & Privacy**: Invite tokens are shown exactly once, never stored in localStorage, database logs, or analytics, and cleared immediately when the modal closes.
  - **Reset Access**: Owners can revoke pending invites or unlink a tenant's account via a confirmation dialog calling `reset_tenant_access`.
- **Public Join Page (`/join/[token]`)**:
  - Deferred invite RPC checks until authentication completes with session-aware Supabase client, added owner-account recovery sign-out, and sanitized error disclosures.
  - Added to middleware public route allowlist.
  - **Unauthenticated Visitors**: Welcoming invite screen showing PG name and invited resident name, with "Continue with Google". Safe `next` parameter redirects back to `/join/[token]` after Google OAuth while preventing open redirect exploits.
  - **Authenticated Confirmation**: Calls `preview_invite` to display the PG name, resident name, room, and bed with an "Is this you?" check.
  - **Consent Checkbox**: Explicit consent acknowledgement (`"I agree to PGDesk and my PG storing my details for stay management..."`) required before joining.
  - **Claim & Auto-route**: Calls `claim_invite` to bind the tenant record to the user's Supabase auth ID, then smoothly redirects to `/me`.
  - **Human-friendly Errors**: Clear notices for expired, revoked, or non-existent invites without technical database jargon.
- **Dedicated Tenant App (`/me`)**:
  - **Zero Direct Table Access**: Tenants interact strictly through the `get_my_stays()` database RPC; no direct table querying or Aadhaar unmasking.
  - **Mobile-first Big-card Interface**:
    - **"My stay"**: Room, bed name, floor, AC/non-AC, bathroom type, monthly rent, security deposit, maintenance, and food inclusion.
    - **"My details"**: Resident name, mobile, masked ID (`XXXX XXXX 1234`), occupation, emergency contact, and permanent address.
    - **"My PG"**: Full address, gate timings, visitor policies, house rules, facilities chips, and a prominent 1-tap "Call Owner" button (`tel:`).
    - Clear notice: *"To change any detail, please contact your PG owner."*
  - **Graceful Offboarding**: Shows a friendly *"Your access to this PG has ended"* screen if a tenant has vacated.
  - **Multi-stay Switcher**: Smooth carousel toggle for residents staying across multiple rooms or PGs.
- **Role-based Login Routing**:
  - Eliminates forced owner profile setups for tenants.
  - **Pure Tenants** (has active stays, owns 0 PGs): Directed automatically to `/me`.
  - **PG Owners**: Directed to owner dashboard with a "Switch to tenant view" link if they also have a resident stay.
  - **Dual View**: `/me` displays a "Owner view" switch button if the user also owns PG properties.
  - **Brand New Users**: Welcoming choice screen offering "I own a PG" (proceeds to profile setup) and "I'm a tenant" (guides them to ask their PG owner for a QR code).
- **Database Migrations**: Created `/supabase/migrations/20261011_tenant_invites_and_portal.sql` containing table `tenant_invites` with RLS, plus security definer RPCs `create_tenant_invite`, `reset_tenant_access`, `preview_invite`, `claim_invite`, and `get_my_stays`.
### Added & Improved
- **Graceful Floor Deletion with Active Tenants**:
  - Floors can now be deleted with caution even when tenants are residing on the floor.
  - Caution dialog lists all resident tenants on that floor with their names, contact phone numbers, room, and bed numbers.
  - Requires typing the exact floor name into an input box to confirm deletion with caution.
  - Seamlessly records check-out (`status = 'left'` with today's date) for all affected tenants so historical records are cleanly maintained without orphan data.
  - Automatic Serial Number Adjustment: When a floor is deleted, all remaining floors in the PG are automatically renumbered (1, 2, 3...) in sequential order with zero gaps or order conflicts.
- **Search by Phone Number & Name**:
  - Enhanced search bar on the Bed Map to search by 10-digit mobile number (or partial digits) alongside tenant name and room number.
  - Works with raw digits, formatted numbers, or international codes.

## [Full Bed Map Layout Editing & Floor Management] - 2026-10-11
### Added & Improved
- **Edit Layout Mode Toggle**: Added an "Edit Layout" toggle button at the top of the Bed Map. All layout editing controls remain neatly hidden during normal everyday operations and only appear when edit mode is switched on.
- **Floor Management (Edit Mode)**:
  - **Inline Floor Rename**: Tap any floor name to edit and save inline with instant updates.
  - **Floor Reordering**: Up/Down arrow buttons adjust floor display order via targeted updates to the `order` column in Supabase.
  - **Add Floor**: Create a new floor with custom naming and auto-calculated order.
  - **Safe Delete Floor**: Blocks deletion if any beds on the floor are occupied, notice, or reserved with a friendly notice (e.g. *"2 beds on this floor have tenants. Vacate them first."*). If empty, displays a confirmation dialog summarizing the rooms and beds being deleted.
  - **Add Rooms to Floor**: Batch room generator supporting sequence generation (prefix + starting number + count) or custom name lists, auto-generating beds based on sharing type and skipping already existing room names with clear notifications.
- **Room Editing & Relocation**:
  - **Unified Edit Room Form**: Single modal form with one "Save Room" button to update room name, sharing count, AC/Non-AC, attached/common bathroom, amenities, and custom rent.
  - **Tenant Protection**: Reducing sharing count is safely prevented if the removed beds currently hold tenants; removed beds are deleted in Supabase.
  - **Unique Room Names**: Real-time inline validation enforces that room names are unique within the PG, showing an inline red warning if duplicated.
  - **Move Room to Another Floor**: Dropdown selector calling the `move_room_to_floor` PostgreSQL RPC function, updating both the room and all its child beds in a single secure operation.
  - **Delete Room**: Safely permitted only when all beds in the room are vacant.
  - **Bulk Room Editing**: Select rooms across floors with checkboxes and open "Bulk Edit" to update AC, bathroom type, custom rent, or amenities across all selected rooms in one click with live summary counts.
- **Bed Management**:
  - Rename bed, set custom rent, block/unblock maintenance, and delete bed (if empty and room has more than 1 bed) directly from the bed drawer.
  - Never permits setting an occupied or notice bed to maintenance or leaving a tenant without a bed.
- **Database Migration**: Created `/supabase/migrations/20261011_move_room_to_floor.sql` implementing the `move_room_to_floor(p_room_id, p_floor_id)` RPC with owner verification.
- **Targeted Updates & Instant UI**: Every change updates only the affected database rows in Supabase and refreshes the UI immediately without full-page reloads.

## [Dashboard Inline PG Editing & Safe Delete] - 2026-10-11
### Added & Improved
- **Inline PG Editing on Dashboard**:
  - Added an "Edit" (pencil) button to each PG card on the dashboard.
  - Opens a clean side panel (responsive bottom sheet on mobile) prefilled with the PG's current data: name, logo URL (optional), contact phone, full street address, city, pincode, PG type (boys/girls/coliving), house rules (gate timing, visitor policy, notice period, other rules), facilities list (standard facilities, popular chips, and custom additions), and default pricing (deposit, maintenance charge, food included, default rent per sharing type).
  - Uses the same inline validation system: red error messages under each field on blur and submit, green ticks when valid, automatic scrolling to the first invalid field, and clear human-friendly error messages (name required, 10-digit Indian phone starting with 6–9, 6-digit pincode, city and address required).
  - Targeted update: updates ONLY the PG's own database row in Supabase without modifying rooms, beds, or tenants.
  - Non-destructive default pricing note: displays "This changes the default rent. Rooms or beds with their own custom rent will keep it."
  - Instant UI update: after saving, the dashboard card updates immediately without a page refresh, followed by a friendly success toast notification.
- **Safer PG Deletion Dialog**:
  - Replaced the browser `window.confirm` popup with an informative modal dialog.
  - Summarizes the total counts of floors, rooms, beds, and active/resident tenants that will be deleted.
  - Requires typing the exact PG name into an input box to enable the delete button.
  - "Cancel" is the default focused button to prevent accidental clicks.
- **Login Page Improvements**:
  - Main action button prominently says "Continue with Google".
  - Added helpful guidance note directly beneath the button: *"New here? Your account is created automatically on first sign-in."*

## [Tenant Field Normalization & Constraint Bugfix] - 2026-10-11
### Fixed
- **Resolved Postgres Check Constraint Error (23514)**: Fixed bug where saving a tenant with empty strings or capitalized values triggered `violates check constraint tenants_gender_check`.
- **Automatic Field Normalization**:
  - All empty or whitespace-only strings are automatically converted to `null` before sending to Supabase for: `gender`, `id_type`, `id_last4`, `occupation`, `native_address`, `alt_contact_name`, `alt_contact_relation`, `alt_phone`, `join_date`, `leave_date`.
  - `gender` is strictly normalized to lowercase (`"male"`, `"female"`, `"other"`, or `null`).
  - `id_type` is strictly normalized to allowed lowercase values (`aadhaar`, `driving_license`, `passport`, `voter_id`, `pan`, `college_id`, `company_id`, `other`, or `null`).
  - `id_last4` is strictly normalized to 4 alphanumeric characters (uppercase) or `null`.
- **Form Dropdown Updates**:
  - Updated Gender, ID Type, Occupation, and Relationship dropdowns to use lowercase values internally with user-friendly labels.
  - Added a "Not specified" option across dropdowns that safely maps to `null`.
- **Null-to-Undefined Safety**: In `assembleTenant` and form state, database `null` values are cleanly converted to `undefined` and empty strings for form inputs.
- **Friendly Field-Specific Database Error Messages**: Replaced raw database constraint error messages with clear, friendly user notifications (e.g. "Please choose a valid gender", "Please choose a valid ID proof type", "ID last 4 must be exactly 4 letters or digits").
- **Demo Data Updated**: Updated demo tenant records in `demoData.ts` to use lowercase `gender` and `id_type` values.

## [Tenant Management & Public Tenants Table] - 2026-10-11
### Added & Improved
- **Tenants Table (`public.tenants`)**: Created a new database migration file at `/supabase/migrations/20261011_create_tenants.sql` for tenant records (`full_name`, `phone`, `alt_contact_name`, `alt_contact_relation`, `alt_phone`, `native_address`, `id_type`, `id_last4`, `gender`, `occupation`, `join_date`, `leave_date`, `status`, `bed_id`, `owner_id`).
- **Database Double-Booking Prevention**: Added a partial unique index on `tenants (bed_id)` where `status IN ('active', 'notice')` to enforce at the database level that a bed cannot have two live tenants at the same time.
- **Tenant Data Layer (`/lib/data/pgStore.ts`)**: Added `getTenantForBed`, `saveTenant`, and `vacateTenant`. Tenant records are the single source of truth. Assigning a tenant or vacating synchronizes both the tenant row and the bed status together with rollback on failure.
- **Clean Bed Cards**: Bed cards on the live Bed Map now show only the assigned tenant's name and mobile number when occupied or serving notice.
- **Comprehensive Bed Side Panel**: Expanded `BedDetailsDrawer` to show full tenant details in view mode (full name, phone, emergency contact name/relation/phone, native address, masked ID `XXXX XXXX 1234`, gender, occupation, and joining date in DD/MM/YYYY).
- **Edit & Save/Cancel Mode**: Added an "Edit Profile" button with form validation (required name, 10-digit Indian phone starting with 6-9, optional valid alternate phone, exactly 4-character ID last 4). Full Aadhaar numbers are never collected or stored.
- **"+ Assign Tenant" & "Mark Vacated"**: Added 1-click tenant assignment on vacant/reserved beds, and a "Mark Vacated" checkout button that records today's date as `leave_date`, sets status to `left`, and frees the bed.
- **Demo Data with Real Tenants**: Updated `loadDemoPG` so demo occupied and notice beds automatically insert realistic Indian tenant profiles directly into `public.tenants`.
- **Separation of Bed and Tenant Columns**: Stopped reading and writing `tenant_name` and `tenant_phone` on the `beds` table, relying purely on the `public.tenants` table.

## [Phase A2 - Supabase Backend & Targeted Data Layer] - 2026-10-11
### Added & Improved
- **Real Supabase Backend**: Migrated from local browser storage to a live Supabase PostgreSQL backend. Data is now securely stored in the cloud under strict multi-tenant isolation.
- **Targeted Single-Row Updates**: Rewrote `/lib/data/pgStore.ts` so small actions (`updateBedStatus`, `updateBedDetails`, `updateRoomDetails`, `renameRoom`, `changeRoomSharing`, `addRoom`, `deleteRoom`, `deleteBed`) update only their specific row in Supabase instead of writing the whole property. Fresh data is re-fetched and returned immediately.
- **Removed Beds Deleted on Sharing Reduction**: When a room's sharing count is reduced (e.g. from 3-bed to 2-bed), the unneeded bed is deleted from the database in Supabase, only after confirming it is vacant (never deleting occupied/notice/reserved beds).
- **Null-to-Undefined Safety**: In `assembleRows`, database `null` values (custom rent, tenant name, phone, notes, logo) are converted to `undefined` so all existing screens, drawers, and calculations continue working with zero disruptions.
- **Standard UUIDs Everywhere**: All IDs for PGs, floors, rooms, and beds now use native `crypto.randomUUID()`. Updated the wizard, demo PG generator, and database schema to match.
- **Database-Driven Timestamps & Triggers**: Removed reliance on the device/browser clock. The database now assigns `created_at` defaults and updates `updated_at` automatically using a Postgres trigger function.
- **Clean Owner Type**: Removed the legacy `password` field from the `Owner` type since authentication is managed through Supabase and Google OAuth.
- **Row Level Security (RLS)**: Enforced database-level security policies on every table (`profiles`, `pgs`, `floors`, `rooms`, `beds`) so each owner can only access their own property data.

## [Phase A - 5-Step Wizard] - 2026-10-11
### Changed
- **Removed Step 4 (AC/Non-AC Checklist)**: The old Step 4 checklist is fully removed. Since Step 3 now lets owners configure the room name, number of beds, AC/Non-AC, and bathroom type inline for every room as soon as it is generated, Step 4 was just a duplicate — it did nothing new. The wizard is now a clean **5-step flow**: 1. PG Details → 2. Floors → 3. Rooms (with inline config) → 4. Pricing → 5. Review & Go Live.
- Step navigation pills, progress bar, step titles, and all review jump buttons updated from 6 to 5 steps.

## [Phase A - Step 3 Inline Room Config] - 2026-10-11

### Added & Improved
- **Inline Room Editing in Step 3**: After generating rooms (with any method), every room card now shows 4 editable fields right there — **Room Name/Number**, **No. of Beds (1 to 8)**, **AC / Non-AC** toggle button, and **Attached / Common Bathroom** toggle button. Owners no longer need to go to Step 4 just to configure individual rooms. Everything can be done in one place during room setup.
- **Empty-state helper text**: If a floor has no rooms yet, it shows a helpful message instead of a blank section.


### Added & Improved
- **Start Room to End Room Range Generator**: In Step 3, owners can now simply enter an optional prefix (e.g. `10`, `G-`, `A-`), a Start Room No. (e.g. `101`), and an End Room No. (e.g. `115`). The app calculates the exact room count and generates the entire sequence with auto-created beds in 1 second.
- **Interactive Multi-Select Checklist for AC/Non-AC & Sharing**: In Step 4, owners can select rooms with checkboxes or tap "Select All" to bulk-assign AC/Non-AC, attached washrooms, and sharing counts with 1 single click instead of modifying each room individually.
- **1-Click Toggles on Room Cards**: In Step 4, every room card features instant 1-click pills to toggle AC/Non-AC and attached/common washrooms directly without opening any menus.
- **Complete "Back in Steps" Navigation in Setup Wizard**:
  - **Top Header Back Button**: Prominently shows `← Back (Step X)` beside the title to quickly retreat one step.
  - **Clickable Step Navigation Pills**: Click any previously completed step (1 through 6) at the top of the screen to jump directly back to that step without losing any filled data.
  - **Sticky Floating Bottom Bar**: An ever-present navigation bar at the bottom with a clear `← Back to Step X` button and `Next Step →` button.
  - **Direct Step Jump Buttons in Step 6 Review**: In Step 6, each section card features an `Edit Step X` button that takes the owner straight to that step for instant corrections.
- **Beds / Sharing Filter on Bed Map**: Added a dedicated bed count filter (`All Sharing`, `1-Bed`, `2-Bed`, `3-Bed`, `4-Bed`, `5+ Bed`) to the live Bed Map so owners can immediately see only single, double, or triple rooms.

## [Phase A - Enhancements & Refinements] - 2026-10-11
### Added & Improved
- **Customized Facilities**: Added support for adding any custom facility in Step 1 (e.g. Gym, Lift, RO Water, Solar Heater, Geyser, Fridge), along with quick-add chips and remove buttons.
- **Timer Gate Closing Input (Non-Mandatory)**: Changed gate timing from a mandatory text field with a default to an optional timer (`input type="time"`) with no default value. If left blank, it indicates 24/7 open gate.
- **Custom Room Numbers & Names**: Owners can type and customize room numbers/names directly at any time during wizard setup or later from the Bed Map.
- **Zero Negative Values Enforced**: Negative numbers are strictly blocked across all money and rent inputs (deposit, maintenance, sharing rent, room overrides, bed overrides) using `min="0"`, key blocking, and sanitization functions.
- **Full Customization of Every Bed**: In the Bed Map drawer, owners can now edit bed name/label, toggle between all statuses (Vacant, Occupied, Notice, Reserved, Maintenance), update tenant names and phone numbers, add maintenance notes, set bed-specific custom rents, or jump straight to editing the parent room.
- **Full Customization of Every Room**: In the Bed Map, clicking "Edit" on any room opens a comprehensive customizer for room name/number, sharing count (1 to 8), AC/Non-AC, attached washroom, amenities checklist, and room rent override.

## [Phase A Completed] - 2026-10-11
### Added
- **Project Foundation**: Next.js 14 + TypeScript + Tailwind CSS with a clean, calm teal brand color palette, touch-friendly buttons, and mobile-first PWA manifest.
- **Data Layer Architecture**: Created `/lib/data/auth.ts` and `/lib/data/pgStore.ts` storing data in browser storage with strict multi-tenant `owner_id` isolation, with clear comments marking where Supabase will plug in.
- **Owner Authentication**: Created simple sign-up and login screens for PG owners with Indian phone validation (+91) and a 1-click test login button for instant demo access.
- **Owner Dashboard**: Built a responsive property dashboard showing PG cards, occupancy summary (vacant, occupied, notice, maintenance counts), and a welcoming empty state.
- **6-Step PG Setup Wizard**: Steps 1 to 6 with auto-save draft persistence on page refresh.
- **Live Bed Map**: Visual grid grouped by floor with color-coded bed tiles, filters, search, and slide-over panel.
- **Demo PG Generator**: Added "Load Demo PG" button to generate a sample 3-floor, 20-room property in 1 second.
