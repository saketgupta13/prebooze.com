-- Default flips to public for new signups — always safe unconditionally,
-- since role is only ever set later by an admin approving a KYC submission
-- (KycService.approve*), never at row creation, so every brand-new User is
-- a plain guest at the moment this default applies.
ALTER TABLE "User" ALTER COLUMN "attendanceVisibility" SET DEFAULT 'public';

-- Existing users sitting at the old default ('off', never explicitly
-- changed by anyone in prod — 69/69 were still at it) move to public too —
-- but only plain guests, not organizer/promoter/lineup/venue accounts
-- (role IS NOT NULL only ever gets set by an admin KYC approval, never on
-- a guest). Their own personal attendanceVisibility stays exactly as it
-- was; this is a guest-only default change, not a platform-wide one.
UPDATE "User" SET "attendanceVisibility" = 'public' WHERE "attendanceVisibility" = 'off' AND "role" IS NULL;
