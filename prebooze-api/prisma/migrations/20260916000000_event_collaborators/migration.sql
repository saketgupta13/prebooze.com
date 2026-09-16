-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "collaboratorOrganizerIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
