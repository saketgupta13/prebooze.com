-- DropForeignKey
ALTER TABLE "HelpTicket" DROP CONSTRAINT "HelpTicket_userId_fkey";

-- AddForeignKey
ALTER TABLE "HelpTicket" ADD CONSTRAINT "HelpTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
