# Prebooze Admin — Control Center

Vite + React + TypeScript implementation of the admin panel handoff in
`../design/admin/` (near-black theme, brand green `#8bc34a`, Space Grotesk +
Manrope). Runs separately from the guest site (`../prebooze-web`).

## Run it

```bash
npm install
npm run dev       # http://localhost:5174  (guest site runs on :5173)
npm run build     # type-check + production build
```

**Demo login:** any email + any password. The *Admin login / Staff login* tab
picked at sign-in drives the role tag in the top bar.

## Screens

| Screen | Route |
| --- | --- |
| Admin / Staff login (validation, guest bypass) | `/login` |
| Dashboard (KPIs, sales trend, clickable Needs-attention, events table) | `/` |
| Events (status tabs, search, per-event commission column) | `/events` |
| Event editor (Basics / Tickets / Commission + live fee preview, Approve/Reject) | `/events/:id` |
| Bookings (filters, slide-over with fee breakdown, refund Approve/Decline) | `/bookings` |
| Customers (Guests/Organizers toggle, gender column, drawer, Block/Unblock) | `/customers` |
| Organizers (inline Approve/Reject on pending) | `/organizers` |
| Organizer detail (KPIs, income chart, income-by-event → event editor) | `/organizers/:id` |
| Add organizer (full page → lands as Pending review) | `/organizers/new` |
| Venues / venue detail / add venue (Docs pending until reviewed) | `/venues`, `/venues/:id`, `/venues/new` |
| Payments & payouts (commission per row from each event's own rate) | `/payments` |
| Promo codes (gender-audience targeting: All/Women/Men/Other) | `/promos` |
| Reports (metric chips, chart placeholders, top events) | `/reports` |
| Banners · Categories · Blogs · Pages (each with inline + Add form) | `/banners` … `/pages` |
| Staff & roles (member list + permission matrix) | `/staff` |

## Behavior notes

- All data is **mock + localStorage** (`pba_*` keys) — clearing site data
  resets the demo. `src/store/AdminContext.tsx` is the single integration
  point for the future API.
- Commission is set **per event** (no global rate); the rate set in the event
  editor is what Payments uses for every payout row.
- Approving a pending event/organizer updates dashboard counts, list rows and
  payouts immediately. Toasts confirm actions.
- Responsive breakpoint at 820px: sidebar collapses to a bottom tab bar.
