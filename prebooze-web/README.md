# Prebooze — Ticket Booking Platform (Web)

Vite + React + TypeScript implementation of the Prebooze designs in `../design/`
(dark olive theme, brand green `#9BE13D`, Manrope).

## Run it

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # type-check + production build to dist/
npm run preview   # serve the production build
```

## What's implemented

All screens run on **mock data + localStorage** — there is no backend yet.
Auth, payments (Razorpay), WhatsApp OTP, UIDAI KYC and QR generation are
mocked at clearly marked integration points.

### Guest module
| Screen | Route |
| --- | --- |
| Home (hero, categories, reels, trending venues/organizers, trust, how-it-works, FAQs) | `/` |
| Browse / search with filters & sort | `/browse` |
| Event details + sticky ticket selector | `/events/:slug` |
| WhatsApp OTP login → OTP → profile completion → Aadhaar+selfie ID verification | `/login` → `/verify-otp` → `/complete-profile` → `/verify-id` |
| Checkout (attendees, coupons, payment methods) | `/checkout` |
| Confirmation with group QR | `/confirmation/:id` |
| My Bookings (upcoming/past, QR, cancel, resend) | `/bookings` |
| Guest profile / edit profile | `/profile`, `/profile/edit` |
| Venues list + venue details | `/venues`, `/venues/:id` |
| Organizer public profile | `/organizers/:id` |
| Host landing, About, Contact, 6 legal pages | `/host`, `/about`, `/contact`, `/legal/:page` |

### Organizer module
| Screen | Route |
| --- | --- |
| Onboarding (business profile → KYC + bank) | `/organizer/onboarding` |
| Dashboard (KPIs, sales chart, sold/capacity bars) | `/organizer` |
| My events (Approved / Pending / Rejected / Drafts) | `/organizer/events` |
| Create event — 4-step wizard + guest preview + submit for approval | `/organizer/events/create` |
| Attendees & check-in (search, CSV export) | `/organizer/attendees` |
| QR scanner + scan result with partial check-in | `/organizer/scanner` |
| Coupons (create & manage) | `/organizer/coupons` |
| Payouts (balances, history) | `/organizer/payouts` |
| Settings | `/organizer/settings` |

## Demo walkthrough

1. Pick an event → select tickets → **Book** → login with any 10-digit number,
   any 4-digit OTP.
2. Complete (or skip) profile & ID verification → checkout → try coupon
   `FIRST50` → Pay (mocked) → confirmation QR.
3. **Host with us** → Join as Organizer → fill onboarding → console unlocks.
4. Create an event through the wizard → it appears under *Pending review*.
5. Attendees → **Scan QR** → tap the frame to simulate scanning your own
   booking → partial check-in.

## Next steps (backend)

The design README suggests Supabase/Postgres per the data model in
`../design/README.md`; the state layer (`src/store/AppContext.tsx`) is the
single integration point to swap localStorage for real APIs.
