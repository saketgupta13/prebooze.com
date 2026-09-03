ALTER TABLE "Venue" ADD COLUMN "timingsByDay" JSONB;

CREATE TABLE "Amenity" (
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Amenity_pkey" PRIMARY KEY ("name")
);

-- Seed with the union of both apps' previously-hardcoded amenity lists so
-- the new admin-managed vocabulary doesn't start empty.
INSERT INTO "Amenity" ("name", "sort") VALUES
    ('Parking', 0),
    ('Accessible', 1),
    ('In-house bar', 2),
    ('Food trucks', 3),
    ('Rooftop', 4),
    ('Open-air', 5),
    ('Coat check', 6),
    ('Smoking area', 7),
    ('VIP lounge', 8),
    ('ATM', 9),
    ('Prayer room', 10),
    ('Valet', 11),
    ('Dance floor', 12),
    ('Live sound rig', 13),
    ('VIP tables', 14),
    ('Outdoor seating', 15),
    ('Food & kitchen', 16),
    ('Full bar', 17),
    ('Wheelchair access', 18)
ON CONFLICT ("name") DO NOTHING;
