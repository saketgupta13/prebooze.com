-- DropTable
DROP TABLE "Category";

-- AlterTable
ALTER TABLE "EventCategory" ADD COLUMN     "subs" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "sort" INTEGER NOT NULL DEFAULT 0;
