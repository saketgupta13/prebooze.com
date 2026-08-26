-- Nullable, no default — every existing guest is unaffected until their
-- next booking (checkout age gate) or their next real dob save
-- (auto-computed) sets it.
ALTER TABLE "User" ADD COLUMN "age" INTEGER;
