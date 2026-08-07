-- Fix a migration-history/schema drift left over from the earlier
-- venue-hosting migration: Event.organizerId went from required to
-- optional there (column-level DROP NOT NULL only), but its FK constraint
-- was never updated from the original ON DELETE RESTRICT to match an
-- optional relation's default ON DELETE SET NULL. RESTRICT was never wrong
-- in practice (Organizer rows are never hard-deleted), just inconsistent
-- with schema.prisma — this brings the two back in sync.
ALTER TABLE "Event" DROP CONSTRAINT "Event_organizerId_fkey";
ALTER TABLE "Event" ADD CONSTRAINT "Event_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "Organizer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Lead: generalize from organizer-only to a role-scoped multi-pipeline lead
-- (organizer | venue | promoter | lineup). role defaults to 'organizer' so
-- every existing row keeps behaving exactly as it did.
ALTER TABLE "Lead" ADD COLUMN     "lineupId" TEXT,
ADD COLUMN     "promoterId" TEXT,
ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'organizer',
ADD COLUMN     "venueId" TEXT;

CREATE UNIQUE INDEX "Lead_venueId_key" ON "Lead"("venueId");
CREATE UNIQUE INDEX "Lead_promoterId_key" ON "Lead"("promoterId");
CREATE UNIQUE INDEX "Lead_lineupId_key" ON "Lead"("lineupId");

ALTER TABLE "Lead" ADD CONSTRAINT "Lead_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_promoterId_fkey" FOREIGN KEY ("promoterId") REFERENCES "Promoter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_lineupId_fkey" FOREIGN KEY ("lineupId") REFERENCES "Lineup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Staff: role-scoped visibility into the Leads pipeline (empty = unrestricted).
ALTER TABLE "Staff" ADD COLUMN     "leadRoleScope" TEXT[] DEFAULT ARRAY[]::TEXT[];
