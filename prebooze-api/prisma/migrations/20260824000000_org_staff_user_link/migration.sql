-- AlterTable
ALTER TABLE "OrgStaff" ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE INDEX "OrgStaff_userId_idx" ON "OrgStaff"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgStaff_organizerId_phone_key" ON "OrgStaff"("organizerId", "phone");

-- AddForeignKey
ALTER TABLE "OrgStaff" ADD CONSTRAINT "OrgStaff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
