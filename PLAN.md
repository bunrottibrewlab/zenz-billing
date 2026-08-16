# ZenZ — Multi-Tenant QR Ordering & Loyalty Platform

Any cafe/restaurant registers → gets their own dashboard, menu, loyalty program, and QR codes.
All data isolated per shop using Supabase Row Level Security (RLS).

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | **Next.js 14 (App Router)** |
| Styling | **Tailwind CSS + shadcn/ui** |
| DB | **Supabase** (brand new project, separate from Android app) |
| Admin Auth | **Supabase Auth** (email/password per shop owner) |
| Customer Auth | **Supabase Phone OTP** |
| QR generation | **qrcode.react** (client-side, PNG/SVG export) |
| Real-time | **Supabase Realtime** (live order status) |
| State | **TanStack Query** |
| File uploads | **Supabase Storage** (logo, banner, item images) |

---

## Multi-Tenant Architecture

Each shop owner registers → creates a `shops` row → all their data is scoped to `shop_id`.
Supabase RLS policies enforce: a logged-in owner can only read/write their own shop's data.

**Three user types:**
| Type | Access | Auth |
|---|---|---|
| **Superadmin** | Entire platform — all shops, plans, users, global analytics | Email/password, hidden URL |
| **Shop Owner** | Their own shop only | Email/password, registered via `/register` |
| **Customer** | Public menu + their own loyalty profile | Phone OTP |

### Public URLs (customer-facing)
```
/[shopSlug]                  → Customer menu page
/[shopSlug]/order/[orderId]  → Order tracking
/[shopSlug]/loyalty          → Loyalty stamp card (phone OTP login)
```

### Admin URLs (owner-facing, protected)
```
/register                    → Shop registration / onboarding
/login                       → Owner login
/admin                       → Redirects to /admin/[shopSlug]/dashboard
/admin/[shopSlug]/...        → All admin pages
```

### Superadmin URLs (hidden, not linked anywhere in the UI)
```
/x/login                     → Superadmin-only login (separate from /login)
/x/dashboard                 → Global overview
/x/shops                     → All registered shops
/x/shops/[shopId]            → View/edit any specific shop
/x/plans                     → Create/edit/delete subscription plans
/x/users                     → All registered owners
/x/invoices                  → All payments across all shops
/x/analytics                 → Platform-wide analytics
```
The `/x/` prefix is intentionally obscure — not guessable from the UI.

---

## Subscription & Plan System

### Plan Tiers (example pricing — you set the actual numbers)

| Plan | Trial | Starter | Pro |
|---|---|---|---|
| Duration | 14 days free | Monthly/Yearly | Monthly/Yearly |
| Menu items | Unlimited | 30 | Unlimited |
| Active loyalty customers | Unlimited | 100 | Unlimited |
| QR tables | 3 | 5 | Unlimited |
| Staff accounts | 2 | 3 | Unlimited |
| Loyalty (stamp card) | Yes | Yes | Yes |
| Scratch card | Yes | No | Yes |
| Analytics | Yes | Basic | Full |
| CSV export | Yes | No | Yes |
| WA ordering | Yes | No | Yes |

### How It Works
1. Shop registers → automatically gets a **Trial** subscription (14 days, all limits = unlimited)
2. Settings page shows **Plan & Usage**: plan badge, days left in trial, current usage vs limit
3. When trial expires → shop locked (can view but not create/edit) → prompted to upgrade
4. Upgrade → selects Starter or Pro → pay via Razorpay → subscription becomes active
5. Limits enforced at the API level: before creating an item/customer, check current count vs plan limit

---

## Database Schema

### Superadmin Tables

```sql
-- Marks a user as superadmin (checked before any RLS policy)
-- Created manually via Supabase SQL editor — never exposed via API
superadmins (
  id uuid PK,
  user_id uuid FK → auth.users UNIQUE,
  created_at timestamptz DEFAULT now()
)

-- Superadmin activity log (audit trail)
superadmin_logs (
  id uuid PK,
  superadmin_id uuid FK → superadmins,
  action text,          -- 'plan_updated' | 'shop_suspended' | 'invoice_refunded' | etc.
  target_type text,     -- 'shop' | 'plan' | 'user' | 'invoice'
  target_id uuid,
  details jsonb,        -- before/after snapshot
  performed_at timestamptz DEFAULT now()
)
```

**RLS approach for superadmin:**
Supabase RLS policies include an `OR is_superadmin()` check using a DB function:
```sql
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM superadmins WHERE user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER;
```
This means superadmin bypasses all shop-scoped filters without needing the Supabase service role key in the browser.

---

### Subscription & Billing Tables

```sql
-- Plan definitions (you manage these as admin)
plans (
  id uuid PK,
  name text,                        -- 'trial' | 'starter' | 'pro'
  display_name text,                -- "Starter Plan"
  price_monthly numeric,            -- 0 for trial
  price_yearly numeric,
  currency text DEFAULT 'INR',

  -- Usage limits (NULL = unlimited)
  menu_items_limit int,             -- NULL = unlimited
  loyalty_customers_limit int,
  qr_tables_limit int,
  staff_limit int,

  -- Feature flags
  loyalty_enabled bool DEFAULT true,
  scratch_card_enabled bool DEFAULT false,
  analytics_enabled bool DEFAULT true,
  export_enabled bool DEFAULT false,
  whatsapp_ordering_enabled bool DEFAULT false,
  full_analytics bool DEFAULT false,

  is_trial bool DEFAULT false,
  trial_days int DEFAULT 14,
  active bool DEFAULT true,
  sort_order int
)

-- One active subscription per shop
shop_subscriptions (
  id uuid PK,
  shop_id uuid FK → shops UNIQUE,   -- one subscription per shop at a time
  plan_id uuid FK → plans,

  status text DEFAULT 'trial',      -- 'trial' | 'active' | 'expired' | 'cancelled'

  -- Trial window
  trial_starts_at timestamptz,
  trial_ends_at timestamptz,

  -- Paid period (null during trial)
  current_period_start timestamptz,
  current_period_end timestamptz,
  billing_cycle text,               -- 'monthly' | 'yearly'

  -- Payment gateway
  payment_provider text,            -- 'razorpay' | 'manual'
  external_subscription_id text,    -- Razorpay subscription id

  cancelled_at timestamptz,
  created_at timestamptz DEFAULT now()
)

-- Payment history / invoices
subscription_invoices (
  id uuid PK,
  shop_id uuid FK → shops,
  subscription_id uuid FK → shop_subscriptions,
  plan_id uuid FK → plans,
  amount numeric,
  currency text DEFAULT 'INR',
  status text DEFAULT 'pending',    -- 'pending' | 'paid' | 'failed' | 'refunded'
  payment_provider text,
  provider_payment_id text,         -- Razorpay payment id
  paid_at timestamptz,
  invoice_url text,
  created_at timestamptz DEFAULT now()
)
```

### How Limits Are Enforced

```
Before creating a menu item:
  SELECT COUNT(*) FROM products WHERE shop_id = $1 AND is_available = true
  Compare against plan.menu_items_limit (skip if NULL)

Before approving a loyalty customer:
  SELECT COUNT(*) FROM customers WHERE shop_id = $1 AND loyalty_active = true
  Compare against plan.loyalty_customers_limit

Before adding a table:
  SELECT COUNT(*) FROM cafe_tables WHERE shop_id = $1
  Compare against plan.qr_tables_limit
```

Enforced via a Supabase **database function** (`check_plan_limit`) called in API routes — not just frontend checks.

---

### Admin Settings — Plan & Usage Section

```
PLAN & USAGE                              [Trial]  ← badge
3 days left in your trial.

Menu items              1 / 30  (or "1 (unlimited)" during trial)
Active loyalty customers 1 / 100
QR Tables               1 / 3

[Upgrade Plan →]
```

After trial expires, banner at top of every admin page:
```
⚠ Your trial has ended. Upgrade to keep using your cafe dashboard.  [Upgrade Now]
```

---

### Core Multi-Tenant Tables (new)

```sql
-- One row per registered shop
shops (
  id uuid PK,
  owner_id uuid FK → auth.users,
  name text,
  slug text UNIQUE,          -- used in all URLs, e.g. "bunrotti-cafe"
  category text,             -- 'cafe' | 'restaurant' | 'bakery' | 'food_truck' | 'bar' | 'other'
  tagline text,
  logo_url text,
  banner_url text,
  banner_height_px int DEFAULT 160,
  primary_color text DEFAULT '#F97316',
  currency text DEFAULT 'INR',
  ordering_enabled bool DEFAULT true,
  created_at timestamptz
)
```

### Existing Tables (from Android app) — add `shop_id`

```sql
-- Already exist, just add shop_id column + RLS
categories    → + shop_id
products      → + shop_id
product_variants → (linked via product, no change needed)
orders        → + shop_id
order_items   → (linked via order)
payments      → (linked via order)
customers     → + shop_id  (same phone can be customer at multiple shops)
staff         → + shop_id
expenses      → + shop_id
inventory     → + shop_id
```

### New Tables (web-specific)

```sql
-- Per-shop tables
cafe_tables (
  id, shop_id, table_number text, label text, active bool
)

-- Loyalty program config (one per shop for now)
loyalty_programs (
  id, shop_id,
  type text DEFAULT 'stamp_card',
  active bool DEFAULT false,
  stamps_per_visit int DEFAULT 1,
  checkins_per_day int DEFAULT 1,
  no_daily_limit bool DEFAULT false,
  min_gap_minutes int DEFAULT 0
)

-- Reward tiers for stamp card
loyalty_rewards (
  id, program_id, shop_id,
  stamps_required int,
  reward_name text,
  reward_description text,
  expiry_days int,
  active bool DEFAULT true,
  image_url text,
  sort_order int
)

-- Each customer check-in event
loyalty_checkins (
  id, shop_id, customer_id,
  checked_in_at timestamptz,
  status text DEFAULT 'pending',  -- pending | approved | rejected
  approved_by uuid,               -- staff/owner user id
  table_id uuid nullable
)

-- Stamps earned per customer
customer_stamps (
  id, shop_id, customer_id, checkin_id, earned_at timestamptz
)

-- Combo offers
combo_offers (
  id, shop_id, name, description, combo_price numeric, active bool, image_url text
)
combo_items (
  id, combo_id, product_id, quantity int
)

-- QR scan analytics
qr_scans (
  id, shop_id, table_id nullable, scanned_at timestamptz,
  source text  -- 'menu' | 'loyalty'
)

-- Custom profile form fields per shop
profile_form_fields (
  id, shop_id, field_key text, label text, field_type text,
  required bool, active bool, sort_order int
)
```

---

## Public Landing Page (`/`)

For anyone visiting the root URL:
- Hero: "QR ordering & loyalty for your cafe — free to start"
- Feature highlights: QR menu, loyalty stamps, order tracking
- "Register your cafe" CTA → `/register`
- "Already have an account? Log in" → `/login`

---

## Shop Registration & Onboarding (`/register`)

**Step 1 — Account**
- Business email + password
- Full name (owner)

**Step 2 — Shop Details**
- Shop name
- Slug (auto-suggested from name, editable) — this becomes the URL e.g. `yourapp.com/bunrotti-cafe`
- **Shop category** (required, shown as icon grid):
  - ☕ Cafe
  - 🍽 Restaurant
  - 🥐 Bakery
  - 🚚 Food Truck
  - 🍺 Bar / Pub
  - 🧃 Juice / Beverages
  - 🍦 Desserts / Ice Cream
  - 📦 Other
- Currency (INR default, dropdown)

**Step 3 — Branding**
- Logo upload
- Primary color picker (orange default)
- Tagline

→ Creates `shops` row + initializes default `loyalty_programs` row
→ Redirects to `/admin/[slug]/dashboard`

---

## Admin Panel Pages

All at `/admin/[shopSlug]/...`, protected by auth middleware.

### Dashboard (`/admin/[shopSlug]`)
- Greeting + today's date
- Stats: Today's revenue, order count, active items, QR scans (30d)
- Live menu QR + copy URL + Download Print File
- Quick actions: Manage Menu, Change Style, QR Codes, WA Ordering toggle

### Menu (`/admin/[shopSlug]/menu`)
- Collapsible category sections (drag to reorder)
- Items per category: Veg/Non-veg icon, name, price, Visible toggle, edit/delete
- Toolbar: Select, Tags, Concepts, New Category, Create Combo, Add Item
- Combo Offers section (yellow highlight): create combos, link products

### Import (`/admin/[shopSlug]/import`)
- Upload CSV or PDF to bulk-add menu items
- Column mapping UI

### Customize (`/admin/[shopSlug]/customize`)
- **Branding tab**: name, tagline, logo, banner, banner height slider
- **Ordering tab**: enable ordering, table management
- **Social & Reviews tab**: links, review prompts
- Live mobile preview panel on the right (updates as you type)

### QR Codes (`/admin/[shopSlug]/qr`)
- Common QR (all tables — customer picks table at order time)
- Per-Table QR (one per table, no selection needed)
- Add/manage tables (table number + label)
- Download PNG / Download SVG per QR

### Loyalty — Stamp Card (`/admin/[shopSlug]/loyalty/stamp-card`)
- Active toggle
- Daily check-in limit: count stepper + "No daily limit" toggle
- Minimum gap: No gap / 1hr / 4hr / 8hr / custom minutes
- Add Reward tiers: stamps required → reward name, expiry days, image
- Customer preview panel (live mobile mockup on the right)

### Loyalty — Scratch Card (`/admin/[shopSlug]/loyalty/scratch-card`)
- Active toggle
- Prize configuration (name, probability %)
- Customer preview

### Customers (`/admin/[shopSlug]/customers`)
- Pending check-ins banner: name, phone, time ago → Approve / Reject buttons
- Customer list (expandable rows):
  - Avatar, name, phone, status badge (Active/Pending/Completed), stamp count
  - Expanded: Total Visits, Last Visit, Date of Birth
  - WhatsApp Chat button → opens `https://wa.me/<phone>` in a new tab (pre-fills recipient, shop owner types the message)
  - Scan History: #1, date/time, APPROVED/REJECTED/PENDING badge
- Search by phone or name
- Date range filter (from / to)
- Filter tabs: All / Active / Pending / Completed
- Export CSV button

### Profile Form (`/admin/[shopSlug]/loyalty/profile-form`)
- **Always Asked**: Name (toggle required), Date of Birth (toggle required), Email (toggle)
- **Your Own Questions**: Add Field (text, select, number, date types)
- Each field: label, required toggle, delete

### Program QR (`/admin/[shopSlug]/loyalty/program-qr`)
- Loyalty check-in QR code (separate from menu QR)
- Check-in URL shown below QR
- Download PNG / Download SVG

### Settings (`/admin/[shopSlug]/settings`)
- **Account section**: Email (read-only), Full name (editable), Save button
- **Currency section**: Display currency dropdown (INR, USD, EUR, GBP, AED…)
- **Security section**: New password + confirm password, Update password button
- **Plan & Usage section**:
  - Plan badge (Trial / Starter / Pro)
  - Days left in trial (if on trial)
  - Usage meters: Menu items used / limit, Active loyalty customers used / limit
  - "Upgrade Plan" button → `/admin/[shopSlug]/billing`
- **Danger Zone**: Delete shop (with confirmation)

### Billing / Upgrade (`/admin/[shopSlug]/billing`)
- Current plan card
- Plan comparison table (Trial / Starter / Pro)
- Monthly / Yearly toggle (yearly discount)
- "Choose Plan" → Razorpay checkout
- Invoice history table: date, plan, amount, status, download link

---

---

## Superadmin Panel (`/x/*`)

Completely separate layout from the shop admin. Only accessible if the logged-in user has a row in `superadmins`.

### Login (`/x/login`)
- Same email/password form as shop login but hits a different auth check
- On success: redirects to `/x/dashboard`
- If non-superadmin tries to access any `/x/*` route: 404 (not a redirect — gives nothing away)

### Global Dashboard (`/x/dashboard`)
- Platform stats: Total shops, Active shops, Trial shops, Expired shops
- Revenue this month (sum of all paid invoices)
- New signups (last 7 / 30 days)
- Recent sign-ups list (shop name, category, plan, joined date)

### All Shops (`/x/shops`)
- Table: Shop name, Category, Owner email, Plan, Status (Trial/Active/Expired/Suspended), Created date
- Search by name or owner email
- Filter by plan, category, status
- Actions per row: View Details, Suspend, Delete
- Suspended shop: owner sees a "Your account has been suspended" page

### Shop Detail (`/x/shops/[shopId]`)
- Full shop info (editable): name, slug, category, owner, currency
- Subscription section: current plan, trial end date, override plan (superadmin can force-assign any plan)
- Extend trial: set new trial_ends_at
- Usage: menu item count, loyalty customer count
- All orders (read-only view)
- All loyalty customers
- Invoice history

### Plans Management (`/x/plans`)
- Table of all plans with all limits and feature flags
- Add Plan modal: name, price monthly/yearly, all limits, all feature flags
- Edit Plan: inline editing of any field
- Deactivate Plan (shops on that plan keep it, new signups can't pick it)

### Users (`/x/users`)
- All registered shop owners: email, name, shop name, plan, joined date
- Search by email or name
- Reset password (send reset email)
- Delete user (with confirmation — also deletes their shop + data)

### Invoices (`/x/invoices`)
- All invoices across all shops: shop, plan, amount, status, date
- Filter by status (paid / failed / refunded)
- Mark as paid (for manual payments)
- Issue refund action (updates status, logs to superadmin_logs)

### Platform Analytics (`/x/analytics`)
- MRR (Monthly Recurring Revenue) trend chart
- Signups per day/week chart
- Churn: shops that let trial expire without upgrading
- Most popular plan
- Shops by category breakdown

---

## Customer-Facing Pages

### Menu Page (`/[shopSlug]` or `/[shopSlug]/table/[tableId]`)
- Header: cafe banner, logo, name, tagline
- Search bar
- Veg / Non-veg filter toggles + category filter chips
- Items grouped by category (sticky category tabs)
- Item card: image, name, price, add to cart button
- Floating cart bar at bottom: "X items · ₹Y — View Cart"
- Cart drawer: items, quantities, subtotal, place order

### Order Tracking (`/[shopSlug]/order/[orderId]`)
- Real-time status bar: Pending → Preparing → Ready → Completed
- Order items list with prices
- Total and payment summary

### Customer Loyalty Page (`/[shopSlug]/loyalty`)
- Phone OTP login (if not logged in)
- Profile setup (name, DOB per Profile Form config)
- Stamp card visual: "X of N stamps" progress bar
- Dashed stamp circles (filled = earned)
- Reward tier cards: reward name, stamps needed, expiry tag
- "Check In" button → creates pending checkin
- Visit history

---

## Build Order (Phases)

| Phase | What | Deliverable |
|---|---|---|
| 1 | Next.js setup, Supabase client, RLS, auth middleware | Working auth + multi-tenant routing |
| 2 | Landing + Register + Login + Onboarding flow | Any shop can sign up |
| 3 | Plan/subscription system: DB tables, trial auto-start, limit checks | Billing foundation |
| 4 | Admin: Menu CRUD (categories, items, variants, combos) | Full menu management |
| 5 | Admin: QR Codes + Customize/Branding | QR generation + live preview |
| 6 | Customer: Public menu page + cart + place order | QR → order flow works |
| 7 | Customer: Order tracking (real-time) | Live status page |
| 8 | Admin: Loyalty stamp card config + Program QR | Loyalty setup |
| 9 | Customer: Loyalty page (phone OTP, check-in, stamps) | Customer loyalty flow |
| 10 | Admin: Customers page (list, expand, approve/reject) | Full customer management |
| 11 | Admin: Settings + Billing/Upgrade page + Razorpay integration | Paid subscriptions work |
| 12 | Superadmin panel (`/x/*`): all shops, plans, users, invoices, analytics | Full platform control |
| 13 | Analytics, CSV export, trial-expired banners, mobile polish | Production-ready |

---

## Folder Structure

```
cafe_billing_web/
├── app/
│   ├── page.tsx                        # Landing page
│   ├── register/page.tsx               # Shop onboarding (3-step)
│   ├── login/page.tsx                  # Owner login
│   ├── admin/
│   │   └── [shopSlug]/
│   │       ├── page.tsx                # Dashboard
│   │       ├── menu/page.tsx
│   │       ├── import/page.tsx
│   │       ├── customize/page.tsx
│   │       ├── qr/page.tsx
│   │       ├── customers/page.tsx
│   │       ├── billing/page.tsx        # Upgrade / invoices
│   │       ├── settings/page.tsx
│   │       └── loyalty/
│   │           ├── stamp-card/page.tsx
│   │           ├── scratch-card/page.tsx
│   │           ├── profile-form/page.tsx
│   │           └── program-qr/page.tsx
│   ├── x/                              # Superadmin — hidden prefix
│   │   ├── login/page.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── shops/
│   │   │   ├── page.tsx
│   │   │   └── [shopId]/page.tsx
│   │   ├── plans/page.tsx
│   │   ├── users/page.tsx
│   │   ├── invoices/page.tsx
│   │   └── analytics/page.tsx
│   ├── [shopSlug]/
│   │   ├── page.tsx                    # Customer menu
│   │   ├── table/[tableId]/page.tsx    # Table-specific menu
│   │   ├── order/[orderId]/page.tsx    # Order tracking
│   │   └── loyalty/page.tsx           # Customer loyalty
│   └── api/
│       ├── shops/route.ts
│       ├── orders/route.ts
│       ├── loyalty/route.ts
│       └── billing/route.ts            # Razorpay webhooks
├── components/
│   ├── superadmin/
│   │   ├── SuperSidebar.tsx
│   │   ├── ShopsTable.tsx
│   │   ├── PlansEditor.tsx
│   │   └── GlobalStats.tsx
│   ├── admin/
│   │   ├── Sidebar.tsx
│   │   ├── DashboardStats.tsx
│   │   ├── MenuEditor.tsx
│   │   ├── QRDisplay.tsx
│   │   ├── CustomerRow.tsx
│   │   ├── StampCardConfig.tsx
│   │   ├── PlanUsageMeter.tsx          # Plan & Usage section
│   │   └── LivePreview.tsx             # Mobile mockup preview
│   ├── customer/
│   │   ├── MenuPage.tsx
│   │   ├── CartDrawer.tsx
│   │   ├── OrderTracker.tsx
│   │   └── StampCard.tsx
│   └── shared/
│       ├── PhoneOTPModal.tsx
│       └── QRCode.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts                   # Browser client
│   │   └── server.ts                   # Server client (RSC)
│   ├── hooks/
│   │   ├── useShop.ts
│   │   ├── useMenu.ts
│   │   ├── useOrders.ts
│   │   ├── useLoyalty.ts
│   │   └── usePlan.ts                  # Plan limits + usage
│   └── utils/
│       ├── currency.ts
│       ├── planLimits.ts               # checkLimit() helper
│       └── qr.ts
└── middleware.ts                        # /admin/* → owner auth, /x/* → superadmin check
```

---

## All Decisions Confirmed

| Decision | Choice |
|---|---|
| **Platform name** | **ZenZ** |
| **Hosting** | **Vercel** |
| **Supabase** | Brand new project (separate from Android app) |
| **Android app** | Completely separate — no shared DB |
| **WhatsApp** | `wa.me/` deep link — opens WhatsApp with the customer's phone pre-filled, sends message directly. No WhatsApp Business API account needed. |
| **Scratch card** | Included in v1 (Phase 8 alongside stamp card) |
| **Payments** | **Razorpay** for subscription billing |
| **Shop category** | Collected at onboarding step 2 |
