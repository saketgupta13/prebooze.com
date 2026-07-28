-- AlterTable
ALTER TABLE "HelpTicket" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "HelpTicket" ADD COLUMN "name" TEXT;
ALTER TABLE "HelpTicket" ADD COLUMN "email" TEXT;
