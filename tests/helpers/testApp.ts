import { PrismaClient } from '@prisma/client';
import type { Express } from 'express';
import { createLogger } from '../../src/config/logger.js';
import type { Env } from '../../src/config/env.js';
import { PrismaUserProfileRepository } from '../../src/database/repositories/userProfileRepository.js';
import { PrismaSchoolTaskRepository } from '../../src/database/repositories/schoolTaskRepository.js';
import { PrismaAnalysisCacheRepository } from '../../src/database/repositories/analysisCacheRepository.js';
import { MockAiProvider } from '../../src/services/ai/MockAiProvider.js';
import type { AiProvider } from '../../src/services/ai/AiProvider.js';
import { buildExpressApp } from '../../src/server/streamableHttp.js';
import type { ToolDeps } from '../../src/server/toolDeps.js';
import { buildTestEnv } from './testEnv.js';

let sharedPrisma: PrismaClient | undefined;

export function getTestPrisma(): PrismaClient {
  if (!sharedPrisma) {
    sharedPrisma = new PrismaClient();
  }
  return sharedPrisma;
}

export async function cleanDatabase(): Promise<void> {
  const prisma = getTestPrisma();
  await prisma.schoolTask.deleteMany();
  await prisma.analysisCache.deleteMany();
  await prisma.userProfile.deleteMany();
}

export interface TestAppContext {
  app: Express;
  prisma: PrismaClient;
  deps: ToolDeps;
  env: Env;
}

export function buildTestApp(overrides: {
  envOverrides?: Partial<Record<string, string>>;
  aiProvider?: AiProvider;
} = {}): TestAppContext {
  const env = buildTestEnv(overrides.envOverrides);
  const logger = createLogger(env);
  const prisma = getTestPrisma();

  const deps: ToolDeps = {
    aiProvider: overrides.aiProvider ?? new MockAiProvider(),
    userProfileRepo: new PrismaUserProfileRepository(prisma),
    schoolTaskRepo: new PrismaSchoolTaskRepository(prisma),
    analysisCacheRepo: new PrismaAnalysisCacheRepository(prisma),
    cacheEnabled: env.ANALYSIS_CACHE_ENABLED,
    cacheTtlSeconds: env.ANALYSIS_CACHE_TTL_SECONDS,
    logger,
  };

  const app = buildExpressApp({ env, logger, deps, prismaClient: prisma });
  return { app, prisma, deps, env };
}
