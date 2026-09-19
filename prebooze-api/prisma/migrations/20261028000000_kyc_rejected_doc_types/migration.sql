-- Which specific uploaded document(s) caused a KYC rejection (matching
-- KycSubmission.documents[].type), so the applicant's own app can highlight
-- exactly what needs re-upload instead of a bare free-text reason.
ALTER TABLE "KycSubmission" ADD COLUMN "rejectedDocTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
