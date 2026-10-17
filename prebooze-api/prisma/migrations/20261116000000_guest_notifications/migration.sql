-- CreateTable
CREATE TABLE "GuestNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "to" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestNotification_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "GuestNotification" ADD CONSTRAINT "GuestNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
