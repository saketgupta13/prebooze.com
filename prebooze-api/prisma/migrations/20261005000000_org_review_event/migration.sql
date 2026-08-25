-- Nullable: a review written from the organizer's public profile page
-- (not via a review-reminder deep link) has no particular event in
-- context, so existing rows and future organic reviews are unaffected.
ALTER TABLE "OrgReview" ADD COLUMN "eventId" TEXT;
ALTER TABLE "OrgReview" ADD COLUMN "eventTitle" TEXT;
