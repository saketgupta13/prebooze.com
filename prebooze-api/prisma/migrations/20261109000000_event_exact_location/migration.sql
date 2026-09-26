-- Real address + Google Maps link for a private-address event, revealed to
-- confirmed guests via WhatsApp ~3h before the event instead of being public
-- from the start. locationSentAt guards the scheduled bulk send from firing
-- twice for the same event.
ALTER TABLE "Event" ADD COLUMN "exactAddress" TEXT;
ALTER TABLE "Event" ADD COLUMN "mapLink" TEXT;
ALTER TABLE "Event" ADD COLUMN "locationSentAt" TIMESTAMP(3);
