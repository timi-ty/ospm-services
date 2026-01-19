import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

const OSPM_MARKET = {
  question: "Will OSPM hit 1M trades?",
  description:
    "Meta-market tracking platform adoption. Resolves YES if total platform trades reach 1,000,000.",
  category: "meta",
  sourceUrl: "https://ospm.waterleaf.ai/",
  bettingClosesAt: addMonths(new Date(), 8), // 8 months from seed
  resolvesAt: addMonths(new Date(), 14), // 14 months from seed
  status: "open",
  b: 100, // LMSR liquidity parameter
  qYes: 0,
  qNo: 0,
};

async function main() {
  // Check if OSPM market exists (idempotent)
  const existing = await prisma.market.findFirst({
    where: { question: { contains: "OSPM" } },
  });

  if (existing) {
    console.log("OSPM market already exists:", existing.id);
    return;
  }

  const market = await prisma.market.create({
    data: OSPM_MARKET,
  });

  console.log("Created OSPM market:", market.id);
  console.log("  Question:", market.question);
  console.log("  Betting closes:", market.bettingClosesAt.toISOString());
  console.log("  Resolves at:", market.resolvesAt.toISOString());
  console.log("  LMSR b:", market.b);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
