# Prebooze — Backend Build Spec

The frontends (`prebooze-web`, `prebooze-admin`) are feature-complete on mock data and are **already wired for a real backend**:

- `prebooze-web/src/api/client.ts` — fetch wrapper (base URL, bearer token, typed errors). Offline when `VITE_API_URL` is empty.
- `prebooze-web/src/api/index.ts` — **one typed function per endpoint below**. Implement the server to this contract and the app goes live.
- `prebooze-web/src/lib/notify.ts` + `src/config/messaging.ts` — messaging templates + provider config; in backend mode each send POSTs `/notifications/send`.
- `prebooze-web/.env.example` — all environment configuration.

Recommended stack: Node (NestJS/Fastify) + Postgres + Redis (holds/OTP/queues) + Razorpay + AiSensy (WhatsApp, a Meta BSP) + Resend. All money in integer paise server-side.

**Status:** `prebooze-api/` (NestJS) is scaffolded and live locally — Prisma/Postgres + Redis, `/v1/auth/otp` + `/v1/auth/verify` + `/v1/me` working end-to-end with a dev WhatsApp provider (real sends activate once `AISENSY_API_KEY` is set).

## Conventions
- Base URL `/v1`. JSON everywhere. Auth: `Authorization: Bearer <JWT>`; errors `{ code, message }` with proper HTTP status.
- Roles: `guest` (default), plus at most **one** elevated role per phone: `organizer | promoter | lineup | venue` (enforced at onboarding), `admin`, `staff`.
- All discovery endpoints are **city-scoped** via `?city=`.

## Data model (tables)
`users` (phone unique, name, username, email, city, dob, gender, bio, socials, interests[], id_verified, attendance_visibility, auto_renew, role fields), `otp_requests`, `people_follows` (follower_id, followee_key: person/org/promoter/venue/lineup prefixed), `follow_requests`, `events` (organizer_id, venue_id, category, sub_category, status: draft|pending|approved|rejected, date, duration, tags, rules, conditions, lineup[], seo, social_banners, promoter_config), `ticket_tiers` (event_id, name, price, qty, sold, includes[]), `venues`, `organizers`, `promoters` (slug, plan, status, kyc), `lineups`, `bookings` (user_id, event_id, tier summary, qty, amounts, status: confirmed|cancelled|refunded, promoter_ref, wallet_credit_used), `booking_guests`, `holds` (Redis, TTL 8 min), `waitlist_entries` (event_id, user_id, position, status waiting|offered), `carts` (abandoned-cart lifecycle), `wallet_txs` (user_id, type welcome|referral|refund|spend, amount), `pay_methods` (tokenized via Razorpay; never store PAN/CVV), `referrals` (code, referrer_id, referee_id, status joined|qualified), `promoter_guests` (event_id, promoter_slug, sub_promoter, name, phone, age, gender, arrived), `promoter_team`, `featured` (type, ref_id, city, billing, amount, status pending|active|rejected|expired), `featured_rates`, `sub_tiers`, `org_reviews`, `help_tickets`, `career_jobs`, `job_applications`, `career_teams`, `reels`, `locations` (country→state→city, enabled, top, icon), `notifications_outbox`, `admin_ledger`, `testimonials`, `faqs`, `policies`, `banners`, `blogs`, `menus`.

## Endpoints (implement to match `src/api/index.ts`)

### Auth
- `POST /auth/otp` `{phone}` → `{requestId}` — send WhatsApp OTP (template `otp`), rate-limit per phone/IP.
- `POST /auth/verify` `{requestId, code}` → `{token, user, isNew}` — create user on first login (`attendance_visibility='off'`); if a pending referral code cookie/body is present, attribute + credit welcome.
- `GET /me` · `PATCH /me` — profile (enforce one-role rule server-side). `POST /auth/logout`.

### Discovery (public, city-scoped)
- `GET /events?city&cat&sub&search&sort` (approved only, featured-first), `GET /events/:slug`
- `GET /venues?city`, `GET /organizers?city`, `GET /promoters?city`, `GET /lineups?city`, `GET /people?city`
- `GET /featured?city` (active, in-window), `GET /categories` (tree + counts), `GET /cities` (event counts + top flags + icons from locations), `GET /search?q` (typed multi-entity suggestions), `GET /search/trending`

### Bookings, holds, waitlist
- `POST /bookings/hold` `{eventId, qty{tierId:n}}` → `{holdId, expiresAt}` — reserve inventory in Redis, TTL 8 min; release on expiry (mark cart abandoned → recovery flows).
- `POST /bookings` `{holdId, guests, whatsapp, couponCode?, walletCredit?, payMethodId?, promoterRef?}` — verify Razorpay payment, decrement `sold`, debit wallet, mark coupon use, qualify referral (first paid booking → credit referrer), attribute promoter commission, complete cart, send `booking_confirmed`.
- `GET /bookings` · `POST /bookings/:id/cancel` `{refundTo: wallet|source}` — wallet → instant `wallet_txs` credit; source → Razorpay refund; then **offer the freed spot FIFO** to the first `waiting` waitlist entry (send `waitlist_offer`) . `POST /bookings/:id/check-in` (organizer/staff scope).
- `POST /events/:id/waitlist` (join, only when sold out; unique per user) · `GET /events/:id/waitlist`.

### Wallet & payments
- `GET /wallet` → balance + ledger. Credits are spend-only.
- `GET/POST/DELETE /pay-methods`, `POST /pay-methods/:id/default` — Razorpay tokenization; storing holder/expiry ok, **never CVV**. Paying with a saved method sets it default.
- `POST /me/auto-renew` — with a cron that renews promoter subscriptions/featured monthly from the default method (send `auto_renew_on` / `subscription_receipt`).

### Referrals
- `GET /referrals` → `{code, referrals[]}` (code deterministic per user); `POST /referrals/claim` `{code}` pre-signup. Guards: self-referral, one reward per phone, reward only on first **paid** booking. Amounts from admin `referral_rates`.

### Social
- `POST/DELETE /follows` `{key}` (prefixed keys: `person:`, `promoter:`, `lineup:`, venue/org ids)
- `GET /me/followers`, `GET /me/follow-requests`, `POST /me/follow-requests/:personId` `{accept}`
- `POST /me/attendance-visibility` — gates who's-going visibility (off | followers | public)
- `POST /events/:id/interested`, `POST /events/:id/wishlist`, `POST /venues/:id/favourite`
- `POST /organizers/:id/reviews` `{rating, text}`
- Who's-going derivation: attendance = confirmed bookings + promoter-guest arrivals + interested, filtered by each attendee's visibility relative to the viewer.

### Promoter
- `GET /promoter/promotions` (allow-listed approved events), `GET /promoter/events/:id/guests`
- `POST /p/:eventSlug/:promoterSlug` — public guest capture. Guards: allow-list, cap, monthly plan quota, one pass per phone per event (return existing), 3+ no-show phone block. Returns pass id (rotating QR seed = `${id}-${floor(now/5s)}` validated server-side).
- `POST /promoter/guests/:id/check-in` (promoter/organizer/scanner scopes all hit this)
- `GET /promoter/earnings` (per-head on arrivals + gate commission on attributed bookings — **organizer-funded**), `POST /promoter/withdraw` (min ₹500)
- `GET/POST /promoter/team` (sub-promoter links `?via=handle`), `POST /promoter/subscription` `{planId}`

### Organizer
- `GET/POST /organizer/events` (create/edit → status `pending` for admin review), `GET /organizer/events/:id/attendees`
- `GET/POST /organizer/coupons`, `GET /organizer/payouts`, `POST /organizer/withdraw` (send `organizer_payout`)
- `GET /organizer/carts` (abandoned for their events) · `POST /organizer/carts/:id/remind` (WhatsApp deep-link nudge, no discount)

### Venue partner
- `POST /venue/onboard` — create listing (name, type, location, address, capacity, amenities, about, photos) + license & address-proof docs → status `pending` for admin review; sets the user's `venue` role (one-role rule applies).
- `GET /venue/listing` · `PATCH /venue/listing` — the owner's listing (city changes admin-gated).
- `GET /venue/events` — approved events booked at this venue (drives the venue console's events + stats).

### Featured
- `POST /featured/request` — charge via Razorpay → `pending`; admin approves → `active` (city-scoped, capped, labeled). `GET /featured/rates`.

### Support, careers, notifications
- `GET/POST /support/tickets` (role recorded; send `help_ticket`)
- `GET /careers/jobs` (open only) · `POST /careers/apply`
- `POST /notifications/send` `{channel, to, template, data}` — internal fan-out to WhatsApp (Meta Cloud) + email (Resend). Templates already defined in `src/lib/notify.ts` (welcome, otp, booking_confirmed, refund_wallet/source, subscription_receipt, auto_renew_on, waitlist_offer, referral_welcome/reward, featured_submitted, help_ticket, organizer_payout) — mirror them as approved WhatsApp HSM templates.

### Admin API (serves `prebooze-admin`; role `admin|staff` + permission matrix)
Everything the admin panel does today against its seed: events approve/reject, bookings + refunds, customers, organizers/promoters/lineups CRUD + KYC status, promoter sub-tiers, featured queue + rates, referral rates + analytics, locations CRUD (enable cascade, top-12 star, icons), careers (jobs/teams/applicants), reels, abandoned carts + bulk remind, banners/blogs/pages/faqs/policies/menus/testimonials, staff & roles, settings, finance ledger, reports.

## Payments (Razorpay)
Order create server-side → frontend checkout with `VITE_RAZORPAY_KEY_ID` → webhook verifies signature → booking finalize. Refunds via API. Subscriptions for promoter plans + monthly featured (auto-renew cron). Webhooks: `payment.captured`, `refund.processed`, `subscription.charged`.

## Real QR
Replace the deterministic placeholder with a signed token QR: `qr = JWT{bookingId, eventId, qty, exp}`; scanner posts the token to `/bookings/check-in`. Promoter passes: short-lived rotating token (5 s window) validated server-side.

## Cron / jobs
Hold expiry sweep, abandoned-cart marker, waitlist FIFO offers with 15-min claim windows, weekly organizer payouts (Mon), monthly promoter quota reset, auto-renew billing, featured expiry.

## Env (server)
`DATABASE_URL, REDIS_URL, JWT_SECRET, RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET, AISENSY_API_KEY, RESEND_API_KEY, GEOCODER_URL`.
