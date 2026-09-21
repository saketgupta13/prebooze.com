-- Add seriesEndDate to Event for multi-day series/workshop events
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "seriesEndDate" TIMESTAMP;
