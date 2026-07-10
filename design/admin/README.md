# Handoff: Prebooze — Admin Panel + Guest Booking Site (Phase 1)

## Overview
Prebooze is a ticket-booking platform. Phase 1 covers two apps: the **guest-facing booking site** (browse events, pick tickets, checkout) and the **admin panel** (dashboard, events, bookings, customers, organizers, venues, payments/payouts, promo codes, reports, content/CMS, staff & roles), plus **admin/staff authentication**. Both apps are shown together in one clickable prototype with a mode switcher (Login → Admin ⇄ Guest).

This is the final Phase 1 scope — ready to be rebuilt as a real React application.

## About the Design Files
The files in this bundle are **design references built in HTML** — working, click-through prototypes showing intended layout, navigation, and behavior. They are **not production code to copy directly**. The task is to **recreate this design in a real React codebase** (React + a router such as React Router; component structure, state management, and data-fetching should follow whatever conventions the target project already uses — or, if this is a fresh project, standard modern React with function components + hooks, backed by a real API instead of in-memory mock arrays). Do not literally port the inline-styled markup; rebuild it with the project's actual styling approach (CSS modules / Tailwind / styled-components / whatever the codebase uses).

Two files are included, at different fidelity:
- **`Prebooze Prototype.dc.html`** — HIGH-FIDELITY, interactive. This is the primary source of truth: real navigation, real filtering/search, real form state, live-recalculated numbers. Build from this file first.
- **`Admin Panel Wireframes.dc.html`** — LOW-FIDELITY, sketch-style static reference. Useful only for confirming screen inventory / rough layout intent on screens where the two differ slightly (it also contains a couple of exploratory alternates that were not carried into the final prototype — the prototype wins in case of conflict).

Open either `.dc.html` file directly in a browser to see/interact with it (double-click, or drag into a browser tab).

## Fidelity
**High-fidelity** (from the prototype file). Colors, typography, spacing, and copy should be treated as final. Recreate the UI closely using the project's own component/styling libraries — matching implementation technique (inline styles) is not required, only the resulting look and behavior.

## Design Tokens

**Colors**
- Background (app): `#0b0c07`
- Surface / card: `#14160d`
- Surface (inputs, sidebar): `#0f100a` / `#161810`
- Border (default, subtle): `rgba(139,195,74,.2)` — translucent brand green
- Border (emphasis): `#8bc34a` (solid brand green)
- Text primary: `#f1f3ea`
- Text muted: `#9aa08c` (secondary), `#6b7460` (tertiary/hint)
- Brand green (primary actions, active states, success, approved): `#8bc34a`
- Alert / destructive red (refunds, pending approvals, rejections, errors): `#ff6b5e`
- Button primary: background `#8bc34a`, text `#0b0c07` (dark-on-green for contrast)

**Typography**
- Display / headings: `Space Grotesk`, weights 600–700
- Body / UI: `Manrope`, weights 400–800
- Both loaded from Google Fonts. Base body size ~13–14px in dense admin tables, 14–16px in guest-facing screens, headings 18–34px.

**Spacing / radius**
- Card radius: 10–12px. Pill/chip radius: 999px. Button radius: 8–10px.
- Standard gaps: 8px (tight), 12–16px (section), 20–32px (page padding on desktop, 14–16px on mobile).

**Logo**
- `logo.png` (included) — hand-drawn green bunny mark with red X eyes, transparent background. Used at ~30px height in both app headers and ~46–52px on login, replacing any text wordmark.

## Screens / Views

### 0. Login (entry point)
- **Purpose**: gate admin/staff access; also offers a guest bypass.
- Centered card, logo + "TEAM SIGN IN" label, **Admin login / Staff login** pill-tab switcher, email + password fields, "Remember me" checkbox, "Forgot password?" link (visual only, no flow), inline validation error on empty submit, submit button whose label/subheading/footnote change per tab. A "Not staff? Browse events as a guest →" link skips straight to the guest site.
- Submitting with both fields filled logs in and lands on the admin Dashboard; the top bar's role tag switches between **ADMIN** and **STAFF** depending on which tab was active at submit.
- A "Log out" button in the admin top bar returns here and clears the fields.
- **Backend note**: wire to a real auth endpoint; staff accounts should carry a reduced permission scope (see Staff & roles below) rather than just a cosmetic tag.

### Admin panel (sidebar shell, persists across all admin screens)
- **Shell**: left sidebar (desktop, 210px) grouped as Main (Dashboard, Events, Bookings, Customers, Organizers, Venues, Payments, Promo codes, Reports), Content (Banners, Categories, Blogs, Pages), System (Staff & roles). Active item: green-tinted background, green left border, green text. Top bar: logo + role tag, global search, notification bell, "View guest site" switch button, Log out, avatar.
- **Mobile (≤820px)**: sidebar hidden; bottom tab bar (Home/Events/Bookings/Money/More) instead. Search + notification bell hidden from top bar to save space.

1. **Dashboard** — greeting, "+ Add organizer" quick action, 4 KPI cards (gross sales, tickets sold, commission earned, refunds), sales trend chart placeholder, "Needs attention" panel (pending approvals, refunds — clickable, navigates to filtered Events/Bookings), live/upcoming events table (click row → event editor).
2. **Events** — status tabs (All/Pending/Live/Draft, counts computed live), search box, table with a per-event commission column. Click a row → Event editor.
3. **Event editor** — tabs Basics / Tickets / Commission. Commission tab has an **editable per-event commission input** (no global commission setting — each event carries its own rate) plus a live fee-math preview (guest pays / platform keeps / organizer nets) that recalculates as you type. Pending events show Approve/Reject buttons in the header.
4. **Bookings** — search + status filter chips (All/Refunds/Paid/Checked in). Click a row → right-side slide-over with booking detail; refund requests show Approve refund / Decline buttons that update status live.
5. **Customers** — Guests/Organizers segment toggle, search, table including a **Gender** column. Click a row → profile drawer with Block/Unblock action.
6. **Organizers** — table of all organizers (name, contact, city, event count, KYC state, status) with a "pending review" count badge and a **"+ Add organizer"** button. Pending rows show inline **Approve / Reject** buttons that update status live without leaving the list (click stops propagation so it doesn't also open the detail page). Clicking a row (outside the buttons) opens:
   - **Organizer detail** — header with name + status; KPI row (lifetime revenue, commission paid, net payouts, events run); a **bar chart** of income over the last 6 months; an **income-by-event table** (event, sold, gross, commission amount + %, net) where each row navigates to that event's editor.
   - **Add organizer** (full page, from the "+ Add organizer" button) — name, contact email, city, commission-rate hint field, KYC-docs upload placeholder; submitting adds the organizer with status "Pending review" and returns to the list.
7. **Venues** — table (capacity, events, license status) with a **"+ Add venue"** button. Click a row to open:
   - **Venue detail** — photo placeholder, status, KPI row (capacity, events hosted, license), and a list of events held at that venue.
   - **Add venue** (full page) — photo-upload placeholder, name, address, capacity, license-docs upload placeholder; submitting appends the venue as "Docs pending" and returns to the list.
8. **Payments** — KPI row (collected, commission kept, GST, due-Friday), payouts table where each row's commission % is pulled from that event's own rate (Event editor is the single source of truth for commission). "Run payout batch" gives a toast confirmation.
9. **Promo codes** — table of existing codes (each shows its audience). "New promo code" form includes a **gender-targeting selector (All / Women / Men / Other)** as pill buttons, plus code/value fields; submitting adds the code to the top of the table.
10. **Reports** — metric chip selector (Sales/Commission by event/GST/Refunds/Attendance/Promos), chart placeholders, top-events list.
11. **Banners, Categories, Blogs, Pages, Staff & roles** — each is its own dedicated screen (intentionally *not* combined) with a list/table and a "+ Add" action revealing an inline mini-form; submitting appends a new item to that list.

### Guest booking site
1. **Home** — hero, category filter chips (All/Concerts/Comedy/Festivals — filters the grid live), responsive event grid (click a card → event detail).
2. **Event detail** — poster, event info, selectable ticket tiers (radio-style cards showing remaining inventory), quantity stepper, running total, "Proceed to checkout".
3. **Checkout** — order summary, name/phone fields, promo code input with **Apply** (validates against the admin's live promo list, shows success/error message and recalculates the total live), price breakdown (subtotal, fees, discount, total), Pay button.
4. **Confirmation** — success state with QR-ticket placeholder and a "Back to home" action.

## Interactions & Behavior implemented in the prototype
- Login gates entry; role tab (Admin/Staff) drives the post-login role tag; validation blocks empty submits; guest bypass skips auth entirely; Log out returns to a cleared login screen.
- Sidebar / bottom-nav / tab navigation is real client-side state, not just visual.
- Live search + filtering on Events, Bookings, Customers tables (no page reload).
- Status/segment filter chips with active-state styling.
- Editable per-event commission field with live-recalculated fee preview.
- Approve/Reject on pending events and on pending organizers; Approve/Decline on refund requests — all mutate the underlying record and reflect immediately across the app (e.g. dashboard counts, table rows, payouts).
- Organizer detail computes its KPIs, chart, and event-income table from that organizer's own event records (not hardcoded).
- "+ Add" flows: inline mini-forms on Banners/Categories/Blogs/Pages/Staff; **full dedicated pages** for Add venue and Add organizer (these are multi-field, higher-stakes creation flows and were intentionally given their own screen rather than an inline form).
- Promo code creation with gender-audience targeting; created codes are immediately usable at guest checkout.
- Guest checkout promo-apply flow cross-checks against the live admin promo list.
- Toast notifications (bottom-center, auto-dismiss ~2.2s) for confirmation-style actions (export, run payout, save, approve, login, etc).
- Responsive breakpoint at 820px: admin sidebar ↔ bottom nav, content padding shrinks, grids reflow to single column (`data-stack-mobile` marks grid containers that should collapse to 1 column under the breakpoint — re-implement as a real media query in CSS).

## State Management
Recreate with a small global/app-level store (Context, Zustand, Redux — whatever the codebase prefers) holding:
- `mode`: 'login' | 'admin' | 'guest'; `userRole`: 'admin' | 'staff'
- `adminView` / `guestView`: current screen key (drive routing — map 1:1 to routes, including `organizerDetail`, `addOrganizer`, `venueDetail`, `addVenue`)
- Entity collections: `events`, `bookings`, `customers`, `organizers`, `venues`, `banners`, `categories`, `blogs`, `pages`, `staff`, `promoCodes` — each with the fields shown in the tables above (see prototype source for exact shape, e.g. organizer: `{id, name, contact, city, events, kyc, status}`; event carries its own `commission` field — there is no global commission setting)
- Per-screen local UI state: search/filter query strings, selected-tab keys, selected-row id (for drawers/detail pages), inline "show add form" booleans, new-record draft fields
- Guest checkout state: selected event id, selected ticket tier index, quantity, applied promo code

In a real build this should be backed by an API (events/bookings/customers/organizers/venues/etc. as real backend resources) rather than in-memory arrays — the prototype uses hardcoded mock data for demonstration only. Organizer/venue "add" forms should call a create-record endpoint and the resulting record's id should come from the backend, not be client-generated.

## Assets
- `logo.png` — brand mark, transparent PNG. Copy into the target project's asset pipeline (e.g. `src/assets/logo.png`).
- No other external images; content-area imagery (posters, banners, charts) are placeholder blocks (diagonal-stripe pattern) or simple CSS bar charts — replace with real photography/charting library output (e.g. Recharts, Chart.js) for the income-over-time and sales-trend charts.

## Files
- `Prebooze Prototype.dc.html` — the full interactive, high-fidelity prototype (open directly in a browser). Contains the admin panel, guest site, and login behind the mode switcher. **Primary reference.**
- `Admin Panel Wireframes.dc.html` — low-fidelity static wireframe reference (screen inventory / rough layout only; defer to the prototype where they differ).
- `logo.png` — brand logo asset used in all headers and the login screen.
