import type { PrismaClient } from '@prisma/client';

export interface AnalysisCacheKey {
  userId: string;
  contentHash: string;
  targetLanguage: string;
  explanationLevel: string;
}

export interface AnalysisCacheEntry extends AnalysisCacheKey {
  resultJson: string;
  expiresAt: Date;
}

export interface AnalysisCacheRepository {
  get(key: AnalysisCacheKey): Promise<string | null>;
  set(entry: AnalysisCacheEntry): Promise<void>;
  purgeExpired(now?: Date): Promise<number>;
}

export class PrismaAnalysisCacheRepository implements AnalysisCacheRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async get(key: AnalysisCacheKey): Promise<string | null> {
    const row = await this.prisma.analysisCache.findUnique({
      where: {
        cache_lookup_key: {
          userId: key.userId,
          contentHash: key.contentHash,
          targetLanguage: key.targetLanguage,
          explanationLevel: key.explanationLevel,
        },
      },
    });
    if (!row) return null;
    if (row.expiresAt.getTime() < Date.now()) return null;
    return row.resultJson;
  }

  async set(entry: AnalysisCacheEntry): Promise<void> {
    await this.prisma.analysisCache.upsert({
      where: {
        cache_lookup_key: {
          userId: entry.userId,
          contentHash: entry.contentHash,
          targetLanguage: entry.targetLanguage,
          explanationLevel: entry.explanationLevel,
        },
      },
      create: { ...entry },
      update: { resultJson: entry.resultJson, expiresAt: entry.expiresAt },
    });
  }

  async purgeExpired(now: Date = new Date()): Promise<number> {
    const result = await this.prisma.analysisCache.deleteMany({
      where: { expiresAt: { lt: now } },
    });
    return result.count;
  }
}
