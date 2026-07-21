# Prebooze — Backend Build Spec

The frontends (`prebooze-web`, `prebooze-admin`) are feature-complete on mock data and are **already wired for a real backend**:

- `prebooze-web/src/api/client.ts` — fetch wrapper (base URL, bearer token, typed errors). Offline when `VITE_API_URL` is empty.
- `prebooze-web/src/api/index.ts` — **one typed function per endpoint below**. Implement the server to this contract and the app goes live.
- `prebooze-web/src/lib/notify.ts` + `src/config/messaging.ts` — messaging templates + provider config; in backend mode each send POSTs `/notifications/send`.
- `prebooze-web/.env.example` — all environment configuration.

Recommended stack: Node (NestJS/Fastify) + Postgres + Redis (holds/OTP/queues) + Razorpay + AiSensy (WhatsApp, a Meta BSP) + Resend. All money in integer paise server-side.

**Status:** `prebooze-api/` (NestJS) is scaffolded and live locally — Prisma/Postgres + Redis. Working end-to-end and curl-verified:
- **Auth**: `/v1/auth/otp` + `/v1/auth/verify` + `/v1/me` (dev WhatsApp provider; real sends activate once `AISENSY_API_KEY` is set)
- **Identity & KYC**: guest auto-verify, role manual-submit, admin review queue — see that section for the policy and endpoints
- **Catalog** (Phase 2): all of Discovery below is live against seeded Postgres data — `prisma/seed.ts` ports `prebooze-web/src/data/mock.ts` 1:1 (same ids/slugs, so existing frontend links resolve unchanged); run `npm run seed` after any migration. Not yet wired into the frontend (still mock-mode by default) — flip `VITE_API_URL` when ready.
- **Bookings, holds, waitlist** (Phase 3): the full lifecycle is live and curl-verified — hold → quote (Razorpay order with the final amount) → create (atomic overselling guard, coupon, wallet credit, referral qualification, signed-QR ticket) → list → cancel (refund + inventory restore + FIFO waitlist offer) → check-in. `RazorpayService` follows the same dev-stub pattern as WhatsApp/KYC: unset `RAZORPAY_KEY_ID`/`SECRET` and the whole flow (orders, signature "verification", refunds) simulates instantly — no live gateway needed to test or develop against.
- **Wallet & payments, Referrals** (Phase 4): `GET /wallet`, Pay Methods CRUD + set-default (paying with a saved method at checkout also sets it default — wired into `POST /bookings`), `POST /me/auto-renew`, `GET /referrals` + `POST /referrals/claim` — all live and curl-verified, including the full loop: claim credits the referee's welcome bonus instantly, then the referee's first paid booking (already built in Phase 3) qualifies the referral and credits the referrer. `User.referralCode` is generated deterministically at signup (same `"PB" + base36(phone)` scheme as the frontend) so claim resolves a code to its owner without scanning every user.
- **Social** (Phase 5): follows/unfollows, followers, the (always-empty, honestly-so) follow-requests stub, attendance-visibility, interested/wishlist/venue-favourite toggles, organizer reviews — all live and curl-verified. Every follow is instant/accepted; there's no private-account approval flow in this product, see below.
- Not yet started: Promoter/Organizer/Venue-partner write-side console actions (their *data* is seeded and readable via Catalog), Featured request/approval actions, Support/careers, Admin API (beyond `/admin/kyc`), Cron jobs (hold-expiry → abandoned-cart marking doesn't exist yet — Redis just silently drops expired holds today).

## Conventions
- Base URL `/v1`. JSON everywhere. Auth: `Authorization: Bearer <JWT>`; errors `{ code, message }` with proper HTTP status.
- Roles: `guest` (default), plus at most **one** elevated role per phone: `organizer | promoter | lineup | venue` (enforced at onboarding), `admin`, `staff`.
- All discovery endpoints are **city-scoped** via `?city=`.

## Data model (tables)
`users` (phone unique, name, username, email, city, dob, gender, bio, socials, interests[], id_verified, role, role_status: null|pending|approved|rejected, attendance_visibility, auto_renew, role-specific display fields), `otp_requests`, `kyc_submissions` (user_id, kind: guest|organizer|promoter|lineup|venue, status: pending|approved|rejected, payload json, documents json, auto_score, reviewed_by, review_note, reviewed_at), `people_follows` (follower_id, followee_key: person/org/promoter/venue/lineup prefixed), `follow_requests`, `events` (organizer_id, venue_id, category, sub_category, status: draft|pending|approved|rejected, date, duration, tags, rules, conditions, lineup[], seo, social_banners, promoter_config), `ticket_tiers` (event_id, name, price, qty, sold, includes[]), `venues`, `organizers`, `promoters` (slug, plan, status, kyc), `lineups`, `bookings` (user_id, event_id, tier summary, qty, amounts, status: confirmed|cancelled|refunded, promoter_ref, wallet_credit_used), `booking_guests`, `holds` (Redis, TTL 8 min), `waitlist_entries` (event_id, user_id, position, status waiting|offered), `carts` (abandoned-cart lifecycle), `wallet_txs` (user_id, type welcome|referral|refund|spend, amount), `pay_methods` (tokenized via Razorpay; never store PAN/CVV), `referrals` (code, referrer_id, referee_id, status joined|qualified), `promoter_guests` (event_id, promoter_slug, sub_promoter, name, phone, age, gender, arrived), `promoter_team`, `featured` (type, ref_id, city, billing, amount, status pending|active|rejected|expired), `featured_rates`, `sub_tiers`, `org_reviews`, `help_tickets`, `career_jobs`, `job_applications`, `career_teams`, `reels`, `locations` (country→state→city, enabled, top, icon), `notifications_outbox`, `admin_ledger`, `testimonials`, `faqs`, `policies`, `banners`, `blogs`, `menus`.

## Endpoints (implement to match `src/api/index.ts`)

### Auth
- `POST /auth/otp` `{phone}` → `{requestId}` — send WhatsApp OTP (template `otp`), rate-limit per phone/IP.
- `POST /auth/verify` `{requestId, code}` → `{token, user, isNew}` — create user on first login (`attendance_visibility='off'`); if a pending referral code cookie/body is present, attribute + credit welcome.
- `GET /me` · `PATCH /me` — plain profile fields only (name, username, email, city, dob, gender, profession, languages, bio, socials, interests, attendance_visibility, auto_renew). `id_verified` and `role`/`role_status` **cannot** be set here — see below. `POST /auth/logout`.

### Identity & KYC
**Policy: guest verification is automatic; every elevated role (organizer/promoter/lineup/venue) is manual-only, reviewed by a human on the team.** This was a deliberate Phase-1 scope decision — automating the high-stakes roles before there's real fraud-pattern data to tune against risks false approvals of bad actors (fake organizers, scam venues) that cost real money and brand trust; guest verification is low-stakes (worst case, an unwarranted checkmark) and high-volume, so it's automated from day one. The data model (`role_status`, `kyc_submissions.kind`) is deliberately generic so any role can flip to automatic later without a schema change — see "Future" below.

- `POST /kyc/guest` `multipart: idDoc, selfie` — runs the pluggable KYC vendor check (OCR + face-match); dev/no-vendor-configured stub does basic file sanity checks. On pass: sets `id_verified=true`, `profile_pct=100` immediately, no human involved. On fail: rejected, user can retry. Always logs a `kyc_submissions` row (`kind='guest'`) for audit, even though it's fully automatic.
- `POST /kyc/role` `multipart: kind, payload (json: brand/username/gstin/bank details/etc), documents[]` — creates a `kyc_submissions` row (`status='pending'`) and stores the self-reported profile fields (orgBrand, promoterBrand, venueName, etc.) immediately for display, but **never** sets `role` or flips `role_status` to `approved` — that only happens via admin action below. Guards: one active application at a time (`role_status='pending'` blocks a second submission, for the same or a different role — one number, one role, enforced even mid-review); a `rejected` status does **not** block reapplying.
- `GET /kyc/me` — the caller's submission history (for showing "pending"/"rejected + reason" states client-side).
- `GET /admin/kyc?status=` · `POST /admin/kyc/:id/approve` · `POST /admin/kyc/:id/reject {reason}` — admin/staff only (see Admin API). Approve sets `role=kind`, `role_status='approved'` — this is the **only** code path that ever grants an elevated role. Reject sets `role_status='rejected'` with the reason stored, `role` stays null so the user can fix the issue and resubmit. Both should notify the applicant on WhatsApp.
- **Bank account verification (penny-drop)** for organizer/promoter payouts: deferred out of this manual-review flow — bundle it into the Wallet & payments / payout work instead, since it's an objective account-exists check, not a trust judgment, and doesn't need to block on human review.
- **Future**: once there's enough approved/rejected history to trust the vendor's accuracy on real traffic, organizer/promoter/lineup/venue can flip to auto-approve above a confidence threshold — same endpoints, just changing whether `/admin/kyc/:id/approve` fires automatically post-vendor-check instead of waiting on a human. No new endpoints needed.

### Discovery (public, city-scoped)
- `GET /events?city&cat&sub&search&sort` (approved only, featured-first), `GET /events/:slug`
- `GET /venues?city`, `GET /organizers?city`, `GET /promoters?city`, `GET /lineups?city`, `GET /people?city`
- `GET /featured?city` (active, in-window), `GET /categories` (tree + counts), `GET /cities` (event counts + top flags + icons from locations), `GET /search?q` (typed multi-entity suggestions), `GET /search/trending`

### Bookings, holds, waitlist — ✅ live (Phase 3), curl-verified end-to-end
- `POST /bookings/hold` `{eventId, qty:{tierId:n}}` → `{holdId, expiresAt}` — Redis-only, TTL 8 min (`HoldsService`). Validates tier existence + current availability at hold time as a soft check; the **hard** overselling guard is the atomic `tier.sold` update inside the booking transaction below, not the hold itself — two people can hold the same last ticket, only one will win at confirm time.
- `POST /bookings/quote` `{holdId, couponCode?, walletCredit?}` → `{subtotal, fee, discount, walletCreditUsed, total, razorpayOrderId?, razorpayKeyId?}` — call this before showing the Razorpay checkout widget; creates the Razorpay order with the **final** post-coupon/post-wallet-credit amount (Razorpay requires the order amount to match what's charged). Read-only — doesn't touch the hold or DB.
- `POST /bookings` `{holdId, mainGuest, whatsapp, guests?, couponCode?, walletCredit?, promoterRef?, razorpay?:{orderId,paymentId,signature}}` — re-derives pricing server-side (never trusts client amounts, same logic as `quote`), verifies the Razorpay signature, atomically guards + increments `sold` per tier, writes the booking (with a signed QR JWT, `tierBreakdown` for later inventory restoration), debits wallet, bumps coupon `used`, qualifies a pending referral on the buyer's first paid booking (credits the referrer, see Identity note below — this is real money, not KYC), sends `booking_confirmed`. `payMethodId` (saved cards/UPI) isn't wired yet — Pay Methods CRUD is still spec-only, see Wallet & payments below.
- `GET /bookings` · `POST /bookings/:id/cancel` `{refundTo: wallet|source}` — sets `refunded`, **restores tier.sold** per `tierBreakdown` (the freed spot is real inventory, not cosmetic), wallet → instant `wallet_txs` credit; source → `RazorpayService.refund`; then **offers the freed spot FIFO** to the first `waiting` waitlist entry (flips it to `offered`, sends `waitlist_offer`).
- `POST /bookings/check-in` `{token}` — verifies the booking's signed QR JWT, rejects if not `confirmed` or already checked in, marks `checkedIn`+`checkedInAt`. One QR per booking (covers every guest on it), not per-guest — matches the ticket design.
- `POST /events/:id/waitlist` (auth required; dedupes per user via a DB unique constraint) · `GET /events/:id/waitlist` (**public** — the event page shows the waiting count to logged-out guests too).
- Not yet built: abandoned-cart marking on hold expiry (Redis TTL just silently expires the hold today — no `carts` row or recovery notification yet), promoter-commission ledger entries (`promoterRef` is stored on the booking but nothing reads it yet), `GET /wallet` and referral-claim endpoints (see Wallet & payments / Referrals below).

### Wallet & payments — ✅ live (Phase 4), curl-verified
- `GET /wallet` → `{balance, txs}`. Credits are spend-only; `balance` is just `sum(WalletTx.amount)`, no separate ledger table to keep in sync.
- `GET/POST/DELETE /pay-methods`, `POST /pay-methods/:id/default` — no CVV/CVV-token field exists anywhere in the input type, by design, not just convention — it never reaches the server. First saved method becomes default automatically; paying with a saved method at checkout (`POST /bookings {payMethodId}`) also sets it default.
- `POST /me/auto-renew` `{on}` — flips `User.autoRenew`. The cron that actually renews promoter subscriptions/featured monthly from the default method isn't built yet (see Cron / jobs) — this endpoint just records intent.

### Referrals — ✅ live (Phase 4), curl-verified end to end
- `GET /referrals` → `{code, referrals[]}` — `code` is `User.referralCode` (deterministic, set at signup). `POST /referrals/claim {code}` — requires auth (the referee must already have a user record from completing OTP login; the frontend stores the code pre-login via `/r/:code` and calls claim right after). Guards: self-referral rejected, one claim per phone ever (`Referral.refereeId` is `@unique`) — a `rejected`-style "already used" error, not silent success. Credits the referee's welcome bonus **immediately** on claim (`referral_welcome` wallet tx + WhatsApp); the referrer's reward (`referral_reward`) is credited later by `BookingsService.create` when the referee's first paid booking lands, qualifying the referral from `joined` → `qualified`. Amounts (`REFERRAL_REFEREE_WELCOME`, `REFERRAL_REFERRER_REWARD`, both ₹100 today) live in `src/referrals/referral.constants.ts`, shared with the bookings module so they can't drift — not yet admin-editable (`referral_rates` config table is future Admin API work).

### Social — ✅ live (Phase 5), curl-verified end-to-end
- `POST/DELETE /follows` `{key}` (prefixed keys: `person:`, `promoter:`, `lineup:`, venue/org ids) — every follow is instant/accepted (an upsert, so re-following is a no-op, not an error). **Design decision**: this product has no private-account approval flow — the frontend's followers/follow-requests split (built ahead of any real trigger for it, seeded with decorative ids that nothing ever populated) is served faithfully but honestly: `GET /me/follow-requests` always returns `[]` and `POST /me/follow-requests/:personId` is a harmless no-op, rather than being backed by a table nothing writes to. If private accounts become a real feature later, this is the seam to extend, not rebuild.
- `GET /me/followers` — who follows me, projected into the frontend's `Person` shape (`avatarHue` derived deterministically from the user id, matching the seeded catalog's cosmetic-only field). In practice this is empty today: there's no "discover other guests as a public profile" feature yet, so nobody can reach a `person:<userId>` follow target — this stays correct once that exists.
- `POST /me/attendance-visibility` `{v}` — gates who's-going visibility (`off | followers | public`), rejects anything else with 400.
- `POST /events/:id/interested` `{on}`, `POST /events/:id/wishlist` `{on}`, `POST /venues/:id/favourite` `{on}` — idempotent toggles (upsert on, delete on off).
- `GET /me/social` — **NEW, not in the original endpoint list**: closes a real gap — the toggles above have no accessor anywhere in `src/api/index.ts` or the `User` type, so a freshly logged-in client on a real backend would have no way to know what's already followed/interested/wishlisted/favourited. One bundled call (`{following, interested, wishlist, favouriteVenues}`) hydrates all of it at once, mirroring how `AppContext` currently boots the same state from localStorage together.
- `GET /organizers/:id/reviews` (public) — **NEW**, closes the read-side of the same gap: `POST /organizers/:id/reviews {rating, text}` was specced but nothing let a client fetch existing reviews (the mock kept them purely client-side, never fetched). Validates `rating` is an integer 1–5 and `text` is non-empty; the review's `date` is formatted server-side to match the mock's exact display format (`"21 Jul"`).
- Who's-going derivation (confirmed bookings + promoter-guest arrivals + interested, filtered by each attendee's visibility relative to the viewer): not built as a dedicated endpoint — nothing in `src/api/index.ts` calls for one today, and `goingCount`/`myStatus`/`friendsGoing` in `src/lib/social.ts` are all client-computed from data already fetched elsewhere (event tiers, `GET /bookings`, the new `GET /me/social`). Revisit if/when the frontend needs "friends going" social proof on a *real* social graph instead of the seeded `Person.follows` array.

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
Everything the admin panel does today against its seed: **the manual verification queue** (`/admin/kyc` — approve/reject organizer/promoter/lineup/venue applications, the only path that grants an elevated role; guest verification never appears here, it's automatic), events approve/reject, bookings + refunds, customers, organizers/promoters/lineups CRUD, promoter sub-tiers, featured queue + rates, referral rates + analytics, locations CRUD (enable cascade, top-12 star, icons), careers (jobs/teams/applicants), reels, abandoned carts + bulk remind, banners/blogs/pages/faqs/policies/menus/testimonials, staff & roles, settings, finance ledger, reports.

`prebooze-api`'s admin endpoints currently gate on a placeholder shared-secret header (`x-admin-secret` = `ADMIN_API_SECRET`) rather than real staff accounts — swap for proper admin/staff auth + the permission matrix when the admin-panel API phase starts; every admin action already records who acted (`reviewed_by`) so the audit trail carries over unchanged.

## Payments (Razorpay) — ✅ order + client-verified signature live; webhooks not yet built
`RazorpayService` (`src/payments/razorpay.service.ts`): order create server-side (`POST /bookings/quote`) → frontend checkout with `VITE_RAZORPAY_KEY_ID` → client posts back `{orderId, paymentId, signature}` on `POST /bookings`, verified synchronously via HMAC-SHA256(orderId|paymentId, key_secret) before the booking is written. Refunds via `RazorpayService.refund`. **Gap to close before real money**: this trusts the client's checkout-success callback; add the `payment.captured` webhook (Razorpay → our server, independent of the client finishing the round trip) so a payment that succeeds but never makes it back to the browser (closed tab, crash) still finalizes the booking, and add `refund.processed` to reconcile refund state. Subscriptions for promoter plans + monthly featured (auto-renew cron) — not built yet.

## Real QR — ✅ live
Every booking gets a signed `qrToken` at creation: `JWT { bookingId }`, 30-day expiry, one per booking (covers every guest on it — matches the ticket design, not per-guest). `POST /bookings/check-in {token}` verifies the signature, confirms the booking is `confirmed` and not already checked in, then marks it. Promoter guest-pass rotating tokens (5 s window) — not built yet, that's promoter console write-side work.

## Cron / jobs
Hold expiry sweep, abandoned-cart marker, waitlist FIFO offers with 15-min claim windows, weekly organizer payouts (Mon), monthly promoter quota reset, auto-renew billing, featured expiry.

## Env (server)
`DATABASE_URL, REDIS_URL, JWT_SECRET, RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET` (unset = dev stub — orders/signature-check/refunds simulate instantly, no live gateway needed; `RAZORPAY_WEBHOOK_SECRET` reserved for when the webhook above is built), `AISENSY_API_KEY, RESEND_API_KEY, GEOCODER_URL, ADMIN_API_SECRET` (placeholder admin gate — see Admin API), `KYC_VENDOR_API_KEY` (unset = dev stub; guest-only checks — see Identity & KYC), `WEB_APP_URL` (used to build the waitlist-offer WhatsApp link).
