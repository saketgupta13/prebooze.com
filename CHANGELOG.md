# Changelog

Plain-English history of real changes shipped to production, newest first. Every entry here has a matching git commit — use `git log` for the technical detail.

## 2026-08-27 — 2026-08-28

- Booking fee redesigned from a flat ₹5 guess to real cost-recovery math (3% of subtotal, sized to cover Razorpay's real fee + WhatsApp confirmation cost)
- Razorpay commission and WhatsApp message costs now real, visible ledger line items — previously invisible, only implicitly folded into refund math
- Refunds now deduct the real, non-refundable Razorpay/WhatsApp cost from what the guest gets back, instead of Prebooze eating it every time
- New Settlements page (admin) — real Razorpay settlement batches with exact per-payment Razorpay/GST breakdown, matching Razorpay's own dashboard number-for-number, decimal-accurate
- Fixed a real 2-week-old stuck refund (Keerthan Venkata, discovered while reconciling settlement data) and added a daily recurring alert so a failed refund retry can never again sit silently forgotten
- Razorpay webhook made genuinely functional — had been silently receiving zero real traffic since it was first built, weeks earlier
- Fixed the finance report always showing ₹0 expenses in any city-scoped view, regardless of what actually happened in that city
- `Booking.commission` backfilled for all historical bookings that predated the field

## 2026-08-23 — 2026-08-26

- Guest usernames switched from phone-digit placeholders to real name-based ones, all existing guests backfilled
- Fixed a full-site mobile audit finding (promoter console 404 + CSS bugs)
- Fixed 16/20 guests seeing an empty "Going" list because all their bookings were in the past
- Attendance visibility defaulted to public for guests
- SEO meta keywords now drafted alongside title/description as standard practice

## 2026-08-18 — 2026-08-21

- Ad attribution bug fixed (fb_platform param + bookingId join gap)
- Instagram/Meta Marketing API access connected, first real performance data pulled
- Content playbook and SEO playbook built from real audits (multi-city, city-URL-routing gap identified)
- Paid ads launched (Hyderabad-only, ₹10k/mo)

## 2026-08-13 — 2026-08-15

- Organizer onboarding redesigned — identity verification and payment profiles fully decoupled from signup
- Abandoned-cart WhatsApp+email recovery automated (5-min cron)
- Found and removed a mandatory profile-completion wall that was silently killing bookings right after OTP verification (24/28 verified guests never reached checkout)
- Venue/promoter/lineup onboarding matched to organizer's instant-signup pattern

## 2026-08-04 — 2026-08-11

- Deploy verification made a hard rule after a real production outage — always boot + curl-test before/after any API deploy
- Leads pipeline built (multi-source organizer outreach Kanban), extended to venue/promoter/lineup with role-scoped sales access
- Promoter role fully wired to real data (all 9 console pages)
- Venues given self-hosting capability

## 2026-07-28 — 2026-07-31

- Admin panel and guest site made fully real (profile saves, social toggles)
- Organizer team invite + RBAC built
- Venue reviews/gallery wired to real data
- Events real-wired (categories, search, waitlist, coupon limits, approve/reject emails)
- Guest profile (KYC, photo, public profile, followers) wired real
- Finance ledger switched to per-event aggregation
- GTM/GA4 and SEO fundamentals (sitemap, redirects, structured data) shipped

## Earlier

Foundational build — monorepo scaffold, KYC policy decisions, production deploy to the Hostinger VPS, initial real-data wiring across all five roles (guest/organizer/promoter/lineup/venue). See git history from the initial commit for the full detail.
