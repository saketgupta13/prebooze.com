-- CreateTable
CREATE TABLE "OrgNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "to" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgNotification_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "OrgNotification" ADD CONSTRAINT "OrgNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
