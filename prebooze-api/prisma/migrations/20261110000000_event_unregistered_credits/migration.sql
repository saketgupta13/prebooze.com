-- Third venue mode: a real, publicly-named venue that isn't a Prebooze
-- partner yet, shown openly (unlike private-address mode) but with no
-- venue dashboard/revenue share.
ALTER TABLE "Event" ADD COLUMN "unlistedVenueName" TEXT;
ALTER TABLE "Event" ADD COLUMN "unlistedVenueCity" TEXT;
ALTER TABLE "Event" ADD COLUMN "unlistedVenueAddress" TEXT;
ALTER TABLE "Event" ADD COLUMN "unlistedVenueInstagramUrl" TEXT;

-- Display-only co-host credits — deliberately separate from
-- collaboratorOrganizerIds (the real access-control list), see that
-- field's own schema comment for why.
ALTER TABLE "Event" ADD COLUMN "freeTextCollaborators" JSONB NOT NULL DEFAULT '[]';
