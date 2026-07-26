-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "galleryUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "teaserVideoUrl" TEXT;
