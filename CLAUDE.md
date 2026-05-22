@AGENTS.md

# PipoTrack — Logistics Management Platform

## Project Overview
Centralized logistics CRM platform for freight operations. Unifies load management, driver coordination, automated bidding, and real-time tracking across 3 integrated systems:
- **CRM Web Platform** (Next.js) — main operational interface
- **Telegram Bot** (Grammy.js) — real-time driver bidding & communication
- **Mobile App** (future phase) — live GPS tracking

---

## Tech Stack

### Frontend
- Next.js 16 (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- React Query (TanStack Query) — server state
- Zustand — client state
- React Hook Form + Zod — forms & validation

### Backend
- Next.js API Routes (Route Handlers)
- Prisma ORM
- NextAuth.js v5 — auth + RBAC

### Database & Services
- PostgreSQL (Supabase)
- Grammy.js — Telegram Bot
- imapflow + nodemailer — email parsing & sending
- geolib or zipcodes — geospatial radius calculation (Door Two)

### Infrastructure
- Vercel (frontend + API)
- Supabase (database + storage)

---

## Project Structure

```
pipotrack/
├── app/
│   ├── (auth)/
│   │   └── login/
│   ├── (dashboard)/
│   │   ├── layout.tsx          ← main nav + role guard
│   │   ├── page.tsx            ← Home/redirect
│   │   ├── users/              ← MODULE 1
│   │   │   └── page.tsx
│   │   ├── recruiting/         ← MODULE 2
│   │   │   ├── units/
│   │   │   ├── drivers/
│   │   │   └── owners/
│   │   ├── dispatch/           ← MODULE 3
│   │   │   ├── bot/
│   │   │   ├── map/
│   │   │   └── availabilities/
│   │   ├── operations/         ← MODULE 4
│   │   │   ├── active/
│   │   │   ├── delivered/
│   │   │   └── loads/
│   │   └── accounting/         ← MODULE 5
│   └── api/
│       ├── auth/
│       ├── users/
│       ├── units/
│       ├── drivers/
│       ├── owners/
│       ├── loads/
│       └── telegram/           ← Bot webhook
├── components/
│   ├── ui/                     ← shadcn/ui primitives
│   ├── layout/
│   │   ├── Navbar.tsx
│   │   └── NavDropdown.tsx
│   ├── users/
│   │   ├── UsersTable.tsx
│   │   └── UserModal.tsx
│   ├── recruiting/
│   │   ├── UnitsTable.tsx
│   │   ├── DriversTable.tsx
│   │   ├── OwnersTable.tsx
│   │   └── [Entity]Modal.tsx
│   ├── dispatch/
│   │   ├── LoadBoard.tsx       ← All/New/Quoted columns
│   │   ├── LoadCard.tsx
│   │   ├── BidModal.tsx
│   │   ├── BookModal.tsx
│   │   └── DriverMap.tsx
│   ├── operations/
│   │   ├── LoadsTable.tsx
│   │   └── AddLoadModal.tsx
│   └── shared/
│       ├── DataTable.tsx       ← reusable table
│       ├── FilterBar.tsx       ← reusable search+filter
│       ├── StatusBadge.tsx     ← reusable role/status badges
│       └── ConfirmModal.tsx
├── lib/
│   ├── prisma.ts
│   ├── auth.ts                 ← NextAuth config
│   ├── rbac.ts                 ← role permission map
│   └── doors/
│       ├── door-one.ts         ← Load Type Recognition
│       ├── door-two.ts         ← Geospatial Radius Check
│       └── door-three.ts       ← Volumetric Freight Fit
├── bot/
│   └── index.ts                ← Grammy.js Telegram bot
├── prisma/
│   └── schema.prisma
└── types/
    └── index.ts
```

---

## Authentication

- **Provider**: Credentials (email + password) — NO registration flow
- **User creation**: Admin-only via the Users module (no self-signup)
- **Password**: Admin sets password when creating a user
- **Session**: JWT-based via NextAuth v5
- **No OAuth providers**

---

## User Roles & Permissions (RBAC)

| Role | Module Access | Permissions |
|------|--------------|-------------|
| **Admin** | ALL | Full read/write everywhere |
| **Recruiting** | Recruiting | Units, Drivers, Owners — R/W |
| **Dispatcher** | Dispatch | Bot, Availabilities, Map — R/W |
| **Operations** | Operations | Active, Delivered, Loads — R/W. ONLY role that can change load logistics status |
| **Accounting** | Accounting + Operations/Loads | Factoring, Payment status — R/W |

### Route Protection
- All `(dashboard)` routes protected via NextAuth middleware
- Role checked in `layout.tsx` per module
- API routes validate role via `lib/rbac.ts` before any mutation

---

## Core Business Logic

### Load Lifecycle (end-to-end)
```
Broker email received
  → Parse email (imapflow)
  → Run 3 Doors validation
  → Create Load record (status: "pending_distribution")
  → Send to matching drivers via Telegram Bot
  → Load appears in Dispatch [ALL] tab
  → Driver bids via Telegram
  → Load moves to Dispatch [NEW] tab
  → Dispatcher reviews, adjusts price
  → Load moves to Dispatch [QUOTED] tab
  → System emails broker with quoted price
  → Broker confirms → Dispatcher clicks [BOOK]
  → Load created in Operations [ACTIVE] (status: "Pending")
  → Operations manages status flow manually
  → Load reaches "Delivered" → moves to Accounting
```

### Load Status Flow (Operations only)
```
Pending → Dispatched to Pickup → OnSite for Pickup
→ Loaded and Delivering → OnSite for Delivery → Delivered
                                    ↓ (any point)
                                 Canceled
```

### Financial Status Flow (Accounting only)
```
Unpaid → Pending → Paid
```

### "3 Doors" Driver Matching Algorithm
Runs automatically after email parse. All 3 must pass:

**Door One — Load Type Recognition**
- Parse "Load Type" / "Vehicle Required" from email
- Match against driver's `vehicle_type`
- Rule: "Sprinter" = "Cargo Van" (interchangeable)
- All others (Small Straight, Large Straight) must be exact match
- Fail → stop, do not show load to driver

**Door Two — Geospatial Radius Check**
- Extract pickup ZIP from email
- Compare to driver's current ZIP + search_radius setting
- Distance (miles) ≤ driver's radius → Pass
- Fail → stop

**Door Three — Volumetric Freight Fit**
- Formula: `floor(vehicle_L / freight_L) × floor(vehicle_W / freight_W) × floor(vehicle_H / freight_H)`
- Always test all rotations (turnable)
- Always assume stackable
- Result ≥ load pieces count → Pass → show load to driver

---

## UI Design Reference

### Navigation (top bar)
```
[N logo] | Home | Dispatch ▾ | Operations ▾ | Recruiting ▾ | Accounting | Users | [⚙] [👤]
```
- Dispatch dropdown: Bot, Map, Availabilities
- Operations dropdown: Active Loads, Delivered, All Loads
- Recruiting dropdown: Units, Drivers, Owners
- Active tab: dark filled pill/badge style

### Design System
- Clean, minimal, white background
- Dark/black primary action buttons ("+ Add User")
- Role badges: Dispatcher = black pill, others = outlined light pill
- Tables: Name+email stacked, subtle row dividers, edit ✏ + delete 🗑 actions
- Filter bar: search input (full width) + type dropdown on right

### Shared Components (reuse everywhere)
- `<DataTable>` — columns config prop, used in ALL modules
- `<FilterBar>` — search + dropdown filter
- `<StatusBadge>` — variant per role/status
- `<EntityModal>` — add/edit pattern used in Users, Units, Drivers, Owners

---

## Prisma Schema (key models)

```prisma
model User {
  id               String   @id @default(cuid())
  name             String
  surname          String
  email            String   @unique
  password         String   // bcrypt hash, set by admin on creation
  idNumber         String   @unique
  role             Role
  phoneNumber      String
  phone2           String?
  address          String?
  emergencyContact String?
  createdAt        DateTime @default(now())
}

enum Role {
  ADMIN
  RECRUITING
  DISPATCHER
  OPERATIONS
  ACCOUNTING
}

model Driver {
  id           String  @id @default(cuid())
  name         String
  vehicleType  String  // Sprinter | Cargo Van | Small Straight | Large Straight
  currentZip   String
  searchRadius Int     // miles
  telegramId   String?
  unitId       String?
  unit         Unit?   @relation(fields: [unitId], references: [id])
}

model Unit {
  id          String   @id @default(cuid())
  unitNumber  String
  type        String
  dimensions  Json     // { length, width, height }
  ownerId     String?
  drivers     Driver[]
}

model Owner {
  id    String @id @default(cuid())
  name  String
  email String
  phone String
}

model Load {
  id              String     @id @default(cuid())
  status          LoadStatus @default(PENDING)
  financialStatus FinStatus  @default(UNPAID)
  broker          String
  pickupZip       String
  pickupAddress   String
  pickupDate      DateTime
  deliveryAddress String
  deliveryDate    DateTime
  rate            Float?
  miles           Float?
  weight          Float?
  dimensions      Json?      // { pieces, L, W, H }
  vehicleRequired String
  rcUploaded      Boolean    @default(false)
  dispatcherId    String?
  driverId        String?
  unitId          String?
  createdAt       DateTime   @default(now())
  bids            Bid[]
}

enum LoadStatus {
  PENDING
  DISPATCHED_TO_PICKUP
  ONSITE_FOR_PICKUP
  LOADED_AND_DELIVERING
  ONSITE_FOR_DELIVERY
  DELIVERED
  CANCELED
}

enum FinStatus {
  UNPAID
  PENDING
  PAID
}

model Bid {
  id        String   @id @default(cuid())
  loadId    String
  driverId  String
  amount    Float
  status    String   // pending | accepted | declined | skipped
  createdAt DateTime @default(now())
  load      Load     @relation(fields: [loadId], references: [id])
}
```

---

## Development Order (Trello → Code)

### Phase 1 — Foundation
1. Project setup (Next.js + Prisma + Supabase + NextAuth)
2. Navbar + layout + RBAC middleware
3. Auth (login page)

### Phase 2 — Users Module (Ticket 1.1, 1.2)
4. Users Management page — table, filters
5. Add/Edit User modal

### Phase 3 — Recruiting Module (Tickets 2.1–2.6)
6. Units — table + modal
7. Drivers — table + modal
8. Owners — table + modal

### Phase 4 — Dispatch/Bot Module (Tickets 3.1–3.8)
9. Load board — All/New/Quoted columns
10. Load cards + Bid modal + Book modal
11. Driver Map page
12. Availabilities page

### Phase 5 — Operations Module (Tickets 4.1–4.5)
13. Active Loads page
14. Delivered Loads page
15. All Loads page
16. Add New Load modal

### Phase 6 — Accounting (Ticket 5.1)
17. Accounting page + payment status

### Phase 7 — Backend & Automation
18. Email parser (imapflow)
19. 3 Doors algorithm
20. Telegram Bot (Grammy.js)

---

## Key Conventions
- All API routes validate session + role before any operation
- `lib/rbac.ts` exports `canAccess(role, module)` and `canMutate(role, module)`
- Shared components live in `components/shared/` — never duplicate table/modal logic
- Every module page follows the same pattern: FilterBar → DataTable → EntityModal
- Load status changes ONLY via Operations API routes (enforced server-side)
- Financial status changes ONLY via Accounting API routes (enforced server-side)
