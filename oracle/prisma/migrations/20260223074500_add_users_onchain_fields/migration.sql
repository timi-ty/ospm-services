-- AlterTable: Add on-chain and lifecycle columns to Market
ALTER TABLE "Market" ADD COLUMN "contractAddress" TEXT;
ALTER TABLE "Market" ADD COLUMN "deployedAt" TIMESTAMP(3);
ALTER TABLE "Market" ADD COLUMN "resolvedAt" TIMESTAMP(3);
ALTER TABLE "Market" ADD COLUMN "proposedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Market_contractAddress_key" ON "Market"("contractAddress");

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "privyUserId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_privyUserId_key" ON "User"("privyUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_address_key" ON "User"("address");

-- AlterTable: Add userId and claimed to Bet
ALTER TABLE "Bet" ADD COLUMN "userId" TEXT;
ALTER TABLE "Bet" ADD COLUMN "claimed" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Bet_userId_idx" ON "Bet"("userId");

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
