# Changelog

Plain-English history of real changes shipped, newest first — from day one. Every version below is a real annotated git tag (`git tag -l -n1`); every entry has a matching commit.

## v1.10.0 — 2026-08-27 → 08-28 (current)

- Booking fee redesigned from a flat ₹5 guess to real cost-recovery math (3% of subtotal, sized to cover Razorpay's real fee + WhatsApp confirmation cost)
- Razorpay commission and WhatsApp message costs now real, visible ledger line items
- Refunds now deduct the real, non-refundable Razorpay/WhatsApp cost from what the guest gets back
- New Settlements page (admin) — real Razorpay settlement batches with exact per-payment Razorpay/GST breakdown, decimal-accurate, matching Razorpay's own dashboard number-for-number
- Fixed a real 2-week-old stuck refund and added a daily recurring alert so a failed retry can never sit silently forgotten again
- Razorpay webhook made genuinely functional — had been silently receiving zero real traffic since it was first built
- Fixed the finance report always showing ₹0 expenses in any city-scoped view
- Version control cleaned up: `main` fast-forwarded to match reality (was 513 commits stale), full history tagged v0.1.0 → v1.10.0

## v1.9.0 — 2026-08-23 → 08-26

- Guest usernames switched from phone-digit placeholders to real name-based ones, all existing guests backfilled
- Full-site mobile audit — fixed promoter console 404 + CSS bugs
- Fixed 16/20 guests seeing an empty "Going" list because all their bookings were in the past
- Attendance visibility defaulted to public for guests

## v1.8.0 — 2026-08-18 → 08-22

- Content playbook and SEO playbook built from real audits (multi-city, city-URL-routing gap identified)
- Instagram/Meta Marketing API connected, first real performance data pulled
- Paid ads launched (Hyderabad-only, ₹10k/mo)
- Ad attribution bug fixed (fb_platform param + bookingId join gap)

## v1.7.0 — 2026-08-13 → 08-17

- Organizer onboarding redesigned — identity verification and payment profiles fully decoupled from signup
- Abandoned-cart WhatsApp+email recovery automated (5-min cron)
- Found and removed a mandatory profile-completion wall silently killing bookings right after OTP verification (24/28 verified guests never reached checkout)
- Venue/promoter/lineup onboarding matched to organizer's instant-signup pattern
- Ticket QR settled on standard black-on-white after repeated real-world scan testing; scanner reliability fixes

## v1.6.0 — 2026-08-09 → 08-12

- Real GTM container installed, conversion events pushed at actual moments
- Schema.org structured data (Event, Organization, BreadcrumbList) + real sitemap.xml
- Referral code collisions fixed (was crashing signup/booking/customer creation)
- Featured auto-recharge built, wired to real data
- Analytics dimensions expanded: revenue, promoter attribution, geography, device/browser/traffic-source

## v1.5.0 — 2026-08-04 → 08-08

- Deploy verification made a hard rule after a real production outage — always boot + curl-test before/after any API deploy
- Leads pipeline built (multi-source organizer outreach Kanban), extended to venue/promoter/lineup
- Promoter role fully wired to real data (all 9 console pages)
- Venues given self-hosting capability

## v1.4.0 — 2026-08-01 → 08-03

- Killed fake auto-payouts (was fabricating UTRs on a schedule)
- Real 2FA + Recent activity wired to backend
- Real invoicing system, DB-backed email templates

## v1.3.0 — 2026-07-28 → 07-31

- Admin panel and guest site made fully real end-to-end (profile saves, social toggles)
- **Production deploy — Prebooze went live** on the Hostinger VPS, real domain/SSL/Razorpay
- Organizer team invite + RBAC, venue reviews/gallery, events fully real (categories, search, waitlist)
- Guest profile (KYC, photo, public profile, followers) wired real
- Finance ledger switched to per-event aggregation

## v1.2.0 — 2026-07-25 → 07-27

- Full-regression fixes across both apps + 6 downloadable feature-doc files
- Venue partner made a full self-serve role (login, onboarding, console)
- Mobile checkout layout fixed for real (was a stray grid-area bug, not the media query everyone assumed)

## v1.1.0 — 2026-07-21 → 07-24

- Home page revamp + city-scoped social directories
- Featured phases 1-4 (organizer/promoter/lineup promote panels, admin approval + billing)
- Wallet + Refer & Earn (Phase 1-2): credits, referral loop, refund-to-wallet
- Admin locations manager, browse by category/sub-category

## v1.0.0-beta — 2026-07-19 → 07-20

**The mock-to-real cutover.** First real backend commit: `prebooze-api` (NestJS + Prisma/Postgres + Redis), real OTP auth. Everything before this point ran on mock data / localStorage; everything after gradually became real.

## v0.4.0 — 2026-07-14 → 07-18

- Who's-going social graph (Phases 1-4): RSVP, event-card badges, Home friends feed, post-booking share
- Profile/People pages redesigned: followers, following, mutuals, shared plans

## v0.3.0 — 2026-07-12 → 07-13

- Line-up (artist) system added
- City-aware platform: sliders, richer dashboards, guest-list details
- Organizer console overhaul (12 items), promoter system Phase 1
- Admin CMS expansion: amenities, testimonials, FAQs, policies, menus

## v0.2.0 — 2026-07-11

- Admin panel app added — all Phase 1 screens
- Fixed a black-screen crash (bad useEffect return values)
- Logo-only header branding

## v0.1.0 — 2026-07-10 (day one)

- Initial commit, Vite + React + TypeScript scaffold
- Design handoff (wireframes, prototypes, logo, spec)
- First guest module (discovery, auth, booking flow, profiles) and organizer module (onboarding, console, event wizard, check-in, coupons, payouts) — both mock/localStorage-backed

---

Tags: `git tag -l -n1` for the full list with real one-line summaries. Full commit-level detail: `git log`.
