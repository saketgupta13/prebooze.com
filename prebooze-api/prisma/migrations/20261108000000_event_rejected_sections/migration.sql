-- Which wizard step(s) (basics/media/tickets/rules_lineup/promoters/seo) an
-- admin flagged as the actual problem on a rejected event, so the organizer's
-- wizard can highlight exactly what to fix instead of a bare free-text
-- rejectionReason with no way to tell which section was the issue. Same
-- pattern as KycSubmission.rejectedDocTypes.
ALTER TABLE "Event" ADD COLUMN "rejectedSections" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
