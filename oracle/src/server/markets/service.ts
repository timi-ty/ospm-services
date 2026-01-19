import { prisma } from "../../shared/database/prisma";

interface GetMarketsParams {
  status?: string;
  category?: string;
  limit: number;
  offset: number;
}

export async function getMarkets(params: GetMarketsParams) {
  const { status, category, limit, offset } = params;

  const where: Record<string, string> = {};
  if (status) where.status = status;
  if (category) where.category = category;

  const [markets, total] = await Promise.all([
    prisma.market.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        question: true,
        description: true,
        category: true,
        sourceUrl: true,
        bettingClosesAt: true,
        resolvesAt: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.market.count({ where }),
  ]);

  return {
    markets,
    total,
    hasMore: offset + markets.length < total,
  };
}

export async function getMarketById(id: string) {
  return prisma.market.findUnique({
    where: { id },
    select: {
      id: true,
      question: true,
      description: true,
      category: true,
      sourceUrl: true,
      bettingClosesAt: true,
      resolvesAt: true,
      status: true,
      createdAt: true,
    },
  });
}

interface MarketProposal {
  question: string;
  description: string;
  source_url: string;
  category: string;
  betting_closes_at: string;
  resolves_at: string;
  resolution_context: string;
}

interface IngestResult {
  created: number;
  duplicates: number;
  errors: number;
}

export async function ingestMarkets(markets: MarketProposal[]): Promise<IngestResult> {
  let created = 0;
  let duplicates = 0;
  let errors = 0;

  for (const market of markets) {
    try {
      await prisma.market.create({
        data: {
          question: market.question,
          description: market.description,
          category: market.category,
          sourceUrl: market.source_url,
          bettingClosesAt: new Date(market.betting_closes_at),
          resolvesAt: new Date(market.resolves_at),
          resolutionContext: market.resolution_context,
          status: "pending",
        },
      });
      created++;
    } catch (error: unknown) {
      const prismaError = error as { code?: string };
      if (prismaError.code === "P2002") {
        duplicates++;
      } else {
        errors++;
        console.error(`[Ingest] Failed to store market: ${market.question}`);
      }
    }
  }

  return { created, duplicates, errors };
}
