# Handoff: Prebooze — Ticket Booking Platform (Events & Concerts)

## Overview
Prebooze is a two-sided ticket booking platform for events/concerts (indie gigs, festivals, comedy, warehouse parties, etc.) connecting **guests** who discover and book tickets with **organizers/venues** who list and manage events. Core differentiators in this design: WhatsApp-OTP-only auth (no passwords), Aadhaar+selfie identity verification for both guests and organizers, group QR tickets (one QR per booking covering all attendees), Razorpay checkout, and an organizer console with approval workflow, payouts, and coupons.

## About the Design Files
The files in this bundle are **design references built in HTML** (a design-prototyping tool's output) — they show intended layout, copy, states, and click-through flow. They are **not production code** and should not be copied verbatim into the app. Your task is to **recreate these designs in React Native**, using React Native's own component and styling conventions (e.g. `View`/`Text`/`Pressable`, StyleSheet or a styling library like NativeWind/Tamagui, a navigation library), and wire them to a real backend and real integrations (WhatsApp OTP, Razorpay, QR, maps).

## Fidelity
**Low-to-mid fidelity wireframes**, not pixel-perfect final UI. Treat the HTML as a strong structural and content guide — screen composition, information hierarchy, copy, states, and navigation flow are intentional and should be preserved — but exact spacing/typography should be adapted to React Native's layout system and a proper design system (spacing scale, type scale) rather than copied pixel-for-pixel. The dark theme color palette (below) IS intended as final brand direction and should be used as-is.

## Files In This Bundle
- `Ticket Booking Wireframes (standalone).html` — the full wireframe library. Open in any browser. Contains ~100 screens/screen-states organized by section (each has an id like `1a`, `1f`, `1bl` — referenced below). Use browser "Find" (Cmd/Ctrl+F) to jump to an id's `id="1a"` anchor in dev tools, or just scroll — sections are labeled.
- `Prebooze Web Prototype (standalone).html` — clickable prototype linking ~31 of the web screens together (navigation, footer links, organizer sidebar) so you can click through the actual flow instead of reading static frames.
- `Prebooze Interactive Prototype (mobile).html` — a phone-frame (390×844) clickable prototype of the **core guest flow only**: Home → Event Details → Checkout → Confirmation → My Bookings → Profile, with real tap-through state (qty stepper, live totals).
- `assets/prebooze-logo.png` — the brand logo, transparent PNG. Use as-is in the app (app icon, splash, headers).

## Design Tokens

### Colors (dark theme)
- Background (page): `#1a1c17` (dark olive-black)
- Surface / card background: `#20221a`
- Border (subtle): `rgba(255,255,255,0.09)` / `#2c2e24` / `#34362a`
- Border (dashed/divider): `rgba(255,255,255,0.14)` / `#3a3d30`
- Primary text: `#EDEFE6`
- Secondary/muted text: `#9a9d8c`, `#b3b6a3`, `#7d8070`, `#83866f` (varying muted shades used contextually — consolidate to 2 muted tones in implementation, e.g. `#9a9d8c` secondary and `#7d8070` tertiary)
- **Primary accent (brand green, from logo)**: `#9BE13D` — used for primary CTAs, links, selected/active states, progress bars, verified checkmarks accents
- Primary accent text-on-fill: `#14150f` (near-black, for text on green buttons/chips)
- **Danger/error/reject accent (from logo's red eyes)**: `#ff5c49` — cancel, reject, refund, sold-out states
- Success (confirmed/verified): `#1f8a5b` (green, distinct from brand accent — used for checkmarks/confirmed states)
- WhatsApp green (OTP CTA only): `#1f8a5b` background — consider using official WhatsApp brand green `#25D366` in production

### Typography
- Font family: **Manrope** (400/500/600/700/800 weights) — clean modern sans, loaded from Google Fonts in the wireframes
- Headings: 600–700 weight, sizes roughly 16–22px (wireframe scale; increase for production mobile screen mins — body text should never render below ~14px on mobile, per platform accessibility norms)
- Body: 400–500 weight, ~12–14px in wireframes (bump to 14–16px minimum in production)

### Spacing & Shape
- Border radius: 6–10px on buttons/inputs/chips, 8–14px on cards, 50% (pill/circle) on avatars and icon buttons
- Card shadow: soft, dark — `0 4px 18px rgba(0,0,0,.45)` equivalent
- Chips/pills: fully rounded, 1.5px border, transparent fill unless "selected" (then filled brand green)

## Screens / Views

Screens are grouped below by flow. The bracketed id (e.g. `[1a]`) is the anchor id in `Ticket Booking Wireframes (standalone).html` — search the HTML source for `id="1a"` to jump straight to it.

### 1. Guest — Discovery
- **Home `[1a]`** (also full marketing home page): header (logo, search, city selector, user name when logged in), hero banner, category filter chips, 2-col (mobile) / 4-col (web) event card grid (portrait 3:4 poster, title, date/venue, price, "Book now"), "Things happening at events" reels slider (9:16 video tiles, 4 visible + swipe), intro/About teaser, "Host with us" banner, Trending Venues, Trending Organizers, "Why book with us" trust points, "How it works" tabs (Guest / Organizer), FAQ accordion, full footer.
- **Browse/Search results `[1b]` web, `[1m]` mobile**: header with city selector, filter chip row (date/category/price/sort), same card grid as home, footer.
- **Venues list `[1aw]` web, `[1ay]` mobile**: locality + venue-type + capacity filters, venue card grid (photo, name, type, locality, event count).
- **Venue details `[1ax]` web, `[1az]` mobile**: image slider (multi-photo), venue logo/name/type/locality, social links, Follow button (guests AND organizers can follow a venue), stats (upcoming events / capacity / rating), embedded map + address + directions link, amenities, "Events happening here" grid, about text.

### 2. Guest — Auth & Identity
- **Login `[1d]` mobile, `[1q]` web**: phone number input (+91), Terms & Privacy checkbox, single CTA "Get OTP on WhatsApp" (no password, no SMS fallback, no guest checkout).
- **OTP verify `[1e]` mobile, `[1r]` web**: 4-digit code input, resend timer, "new number → profile completion".
- **Profile completion `[1s]` web, `[1w]` mobile**: shown once after first login. Progress bar. Fields: profile photo, full name, username, DOB, gender, email, city, profession, languages, bio, social links, interest tag chips (multi-select).
- **ID verification `[1t]` web, `[1x]` mobile**: 2-step — Aadhaar upload + Aadhaar-number field + UIDAI OTP confirmation, then selfie capture with live face-match indicator. Produces the "Verified ✓" badge.

### 3. Guest — Booking Flow
- **Event details `[1f]` web, `[1n]` mobile**: portrait banner ABOVE title (mobile) / beside title (web), title/date/venue/tags, "About this event" text + Read more, "Hosted by" organizer card (icon, ✓, rating, event count, "View organizer profile" button), Event conditions (bulleted list), Party rules (4 accordions), Line-up & partners (DJ/artist/sponsor/promoter chips with photos), Organizer rating & reviews block, sticky ticket-selector (tier name, price, qty stepper, running total, "Book N tickets"), Recommended events in city at the bottom. Mobile has a sticky bottom bar with price + "Select tickets" instead of the inline box.
- **Checkout `[1g]` mobile, `[1o]` web**: order summary, Attendee details (main attendee name/gender/WhatsApp number, checkbox to add details for all guests on the booking), coupon code field + Apply, payment method selection (Razorpay primary, card/wallet alternates), Pay button, security/cancellation microcopy.
- **Confirmation / e-ticket `[1h]` mobile, `[1p]` web**: success state, ticket summary card with a single QR code (valid for all guests on that booking), "Download QR" action, Add to calendar / View booking / Browse more actions.
- **Downloaded QR ticket (PDF) `[1y]`**: what the downloaded file looks like — event details, ONE QR that covers the whole group, a guest-name table (main attendee marked, others listed), entry rules, payment reference. This is a generated PDF/image, not an in-app screen — but its content/layout is specified here for whoever builds the QR/PDF generation.

### 4. Guest — Account
- **My Bookings `[1i]` web, `[1u]` mobile**: Upcoming/Past tabs, booking list, selected booking shows full detail + the same group QR + Download QR + Resend-to-WhatsApp + Cancel booking.
- **Profile `[1j]` web, `[1v]` mobile**: avatar, name/username/city, social icons, Share-profile action, verification-status card (phone ✓, government ID ✓, profile-completion %, joined date), stats (parties attended / parties hosted / following count), "Following" list (organizers/venues followed, with Following✓ buttons), Upcoming events grid, Past/attended events grid (with star ratings), Show-all-past-events link.
- **Edit profile `[1z]` web, `[1aa]` mobile**: same fields as profile completion, pre-filled; phone & Aadhaar shown as locked/verified (not editable inline — route through support).

### 5. Organizer — Onboarding
- **Business profile `[1ab]` web, part of `[1aq]` mobile**: brand logo upload, organizer/brand name, username, contact person, email, alternate phone, WhatsApp number, city, event types hosted, about-brand text, website/social links, GSTIN, PAN.
- **KYC `[1ac]` web, part of `[1aq]` mobile**: Aadhaar + selfie (same pattern as guest verification) plus bank account number + IFSC for payouts (penny-drop verification). Submitting sets status to admin-review, ~24h.

### 6. Organizer — Console (persistent left sidebar nav on web: Dashboard / Events / Attendees / Coupons / Payouts / Settings; bottom tab bar on mobile)
- **Dashboard `[1k]` web, `[1ak]` mobile**: KPI cards (tickets sold 30d, revenue, live events count), sales-over-time chart, upcoming-events list with sold/capacity progress bars, "+ Create event" CTA.
- **Create event — multi-step**:
  - Step 1 Basics `[1ad]` web, `[1al]` mobile: portrait banner upload (3:4, min 900px), title, description, category, age limit, date/time/duration, venue picker.
  - Step 2 Tickets `[1as]`: ticket tiers (name, price, quantity), per-tier "what's included" chips (entry/drinks/lounge/meet&greet/custom), + early-bird window, + guest-list cap per booking.
  - Step 3+4 Rules & SEO `[1ae]`: event conditions, party-rule accordions, line-up/partners chips, SEO title/meta description/URL slug/keywords with a live Google-style search-result preview.
  - Preview & submit `[1af]`: exact guest-facing preview of the event page, "Submit for approval" → status becomes Pending.
- **My Events `[1ag]` web, `[1am]` mobile**: filterable list by status — **Approved/Live**, **Pending review**, **Rejected** (with rejection reason + "fix & resubmit"), **Draft**.
- **Attendees & check-in `[1l]` web, `[1ar]` mobile**: searchable attendee table (name, phone, tickets, status: checked-in/confirmed/refunded), Export CSV, "Scan QR" entry point.
- **QR Scanner `[1at]`**: full-screen camera view with scan frame + torch + manual booking-number fallback + running checked-in count.
- **Scan result `[1au]`**: valid-ticket confirmation showing booking #, main guest name, ticket count, all guest names, a check-in quantity stepper for **partial check-in** (not all guests must arrive together), "Check in N guests" action. (Invalid/already-used QR should show a red ✕ error state with reason — not fully mocked, described only.)
- **Coupons `[1av]`**: create-coupon form (code, %-off or flat, max discount cap, usage limit, per-user limit, event scope, validity date, first-time-user-only toggle), active/paused coupon list with usage counters.
- **Payouts `[1ah]` web, `[1an]` mobile**: available balance + Withdraw, pending (settles after event) balance, lifetime paid out, linked bank account, payout history table, download statements.
- **Settings `[1ai]` web, `[1ao]` mobile**: brand profile edit, KYC & bank management, team members (invite + door-scan access toggle per member), notification preferences, refund-policy defaults, deactivate account.
- **Organizer public profile `[1aj]` web, `[1ap]` mobile**: same pattern as guest profile but for a brand — logo, verified badge, followers/following/events-hosted stats, upcoming + past events grids, aggregate rating & reviews, Follow/Share buttons (visible to guests browsing organizers).

### 7. Company / Static Pages
- **About Us `[1ba]` web, `[1bb]` mobile**: mission statement, founding stats, values, Host-with-us CTA.
- **Contact Us `[1bc]` web, `[1bd]` mobile**: contact form (name/email/role/message) + WhatsApp/email/office/organizer-support contact cards.
- **Host/Organizer landing `[1bl]` web, `[1bm]` mobile**: marketing page for prospective organizers/venues — earnings stats, 4-step "how you earn," benefits grid, testimonial, "Join as Organizer" / "Join as Venue" CTAs (→ routes into organizer onboarding `1ab`).
- **Legal pages `[1bf]` T&C, `[1bg]` Privacy, `[1bh]` Organizer Policy, `[1bi]` Guest Policy, `[1bj]` Refund Policy, `[1bk]` Disclaimer**: all share one layout (sidebar table-of-contents + document body). **Content is placeholder only — real legal copy must be drafted/reviewed by counsel before shipping.**

## Interactions & Behavior (as designed, to implement for real)
- **Auth**: WhatsApp-OTP-only, no password, no email/social login, no anonymous/guest checkout. First-time numbers are routed to profile completion then ID verification (both skippable, but presumably gate certain actions — decide policy, e.g. require ID verification before first booking or before organizer payouts).
- **Booking**: quantity-based (no seat maps) selection per ticket tier → checkout collects attendee info for the main booker (optionally all attendees) → Razorpay payment → confirmation generates ONE QR per booking valid for the whole party.
- **Check-in**: organizer scans the group QR once; app shows all guest names and lets the door staff check in fewer than the full party (partial check-in) if some guests arrive later/separately.
- **Coupons**: percentage or flat discount, capped, scoped to specific events or all events, usage + per-user limits, time-bound.
- **Organizer approval workflow**: every new event is Pending until an admin (not shown in these wireframes — implies an internal admin tool is needed) approves or rejects it with a reason.
- **Follow**: both guests and organizers can follow venues; guests can follow organizers. Used to drive the "Following" list on guest profiles and follower counts on organizer/venue profiles.

## State Management (high-level, for planning your store/queries)
- Auth/session (phone number, verified status, profile completion %, ID-verification status)
- Current city (drives all discovery — home, browse, venues filters)
- Cart/selection state during booking (event id, tier, qty) → carried into checkout → cleared on payment success
- Bookings list (per user) with nested QR/attendee data
- Organizer-scoped: draft event under construction (multi-step form state), events list with status, attendees per event, coupons, payouts

## Data Model (suggested starting point)
- `users` (id, phone, whatsapp_verified, name, username, dob, gender, email, city, profession, languages[], bio, social_links, interests[], id_verification_status, created_at)
- `organizers` (id, user_id or standalone auth, brand_name, username, logo_url, about, city, event_types[], website, social_links, gstin, pan, kyc_status, bank_account_last4, ifsc, verified_at)
- `venues` (id, name, type, locality, city, address, lat, lng, photos[], amenities[], social_links, capacity, owner_organizer_id nullable)
- `events` (id, organizer_id, venue_id, title, description, banner_url, category, age_limit, starts_at, duration_mins, status[draft/pending/approved/rejected/live/past], rejection_reason, seo_title, seo_description, seo_slug, seo_keywords[])
- `ticket_tiers` (id, event_id, name, price, quantity_total, quantity_sold, includes[], early_bird_window)
- `bookings` (id, user_id, event_id, status, total_amount, payment_ref, qr_code_token, created_at)
- `booking_attendees` (id, booking_id, name, gender, phone, ticket_tier_id, checked_in_at nullable)
- `coupons` (id, organizer_id, code, type[percent/flat], value, max_discount, usage_limit, per_user_limit, event_scope[], valid_until, first_time_only, status)
- `follows` (follower_type[user/organizer], follower_id, followed_type[organizer/venue], followed_id)
- `reviews` (id, event_id or organizer_id, user_id, rating, text, created_at)
- `payouts` (id, organizer_id, amount, status, event_id, paid_at)

## Assets
- `assets/prebooze-logo.png` — primary logo (green spray-paint bunny mark), used at small sizes (~1.15–1.7em) in every header/footer throughout the design. Transparent background.
- All event/venue photos, avatars, and posters in the wireframes are **gray placeholder blocks** labeled with their intended content (e.g. "portrait banner 3:4") — no real imagery is included; source real photography/artwork before shipping.
- QR codes in the wireframes are static striped placeholders, not real QR data — implement real QR generation (e.g. a booking-id-encoded token) and a scanning library.

## Suggested Tech Stack (recommendation, since backend preference wasn't fully specified)
- **App**: React Native + Expo (fastest path to iOS/Android from one codebase), TypeScript, React Navigation.
- **Backend**: **Supabase** recommended — Postgres database (maps directly to the data model above), built-in auth (can custom-wire WhatsApp OTP via a serverless function + WhatsApp Business API), storage for photos/banners, row-level security for organizer/guest data separation. Firebase or a custom Node/Postgres API are valid alternatives if you have existing infra preferences.
- **Payments**: Razorpay React Native SDK.
- **OTP delivery**: WhatsApp Business API (Cloud API) — requires a Meta Business/WhatsApp Business account; SMS-only fallback is explicitly excluded from this design's product decision, but reconsider for markets/users without WhatsApp.
- **QR**: generate a signed token per booking server-side; render with a QR library (e.g. `react-native-qrcode-svg`); scan with `react-native-vision-camera` + a barcode-scanning plugin.
- **Maps**: Google Maps SDK for the venue-details map embed.

## Suggested Build Order
1. Auth (WhatsApp OTP) + profile completion + ID verification (guest side)
2. Home/browse/event details (read-only, seeded data)
3. Booking → checkout → Razorpay → confirmation → QR generation
4. My Bookings + Profile
5. Organizer onboarding + create-event flow + admin approval (you'll need a minimal internal admin tool/dashboard not covered in these wireframes)
6. Organizer console: events list, attendees, QR scanner + check-in, coupons, payouts
7. Venues, organizer public profiles, follow system
8. Static/marketing pages (About, Contact, Host-with-us, legal — get real legal copy before launch)
