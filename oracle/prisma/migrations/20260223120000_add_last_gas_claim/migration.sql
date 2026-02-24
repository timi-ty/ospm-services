-- AlterTable: Add lastGasClaimAt to User
ALTER TABLE "User" ADD COLUMN "lastGasClaimAt" TIMESTAMP(3);
