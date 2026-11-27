-- Speeds up CatalogService.events()/event() — every public events-list/
-- detail call filters on status+reviewOnly and orders by date, and joins
-- on venueId/organizerId, with no supporting index until now.
CREATE INDEX IF NOT EXISTS "Event_status_reviewOnly_date_idx" ON "Event"("status", "reviewOnly", "date");
CREATE INDEX IF NOT EXISTS "Event_venueId_idx" ON "Event"("venueId");
CREATE INDEX IF NOT EXISTS "Event_organizerId_idx" ON "Event"("organizerId");
