import { loadEnv } from './config/env.js';
import { createLogger } from './config/logger.js';
import { getPrismaClient, disconnectPrisma } from './database/prisma.js';
import { PrismaUserProfileRepository } from './database/repositories/userProfileRepository.js';
import { PrismaSchoolTaskRepository } from './database/repositories/schoolTaskRepository.js';
import { PrismaAnalysisCacheRepository } from './database/repositories/analysisCacheRepository.js';
import { AnthropicAiProvider } from './services/ai/AnthropicAiProvider.js';
import { GeminiAiProvider } from './services/ai/GeminiAiProvider.js';
import { MockAiProvider } from './services/ai/MockAiProvider.js';
import type { AiProvider } from './services/ai/AiProvider.js';
import { buildExpressApp } from './server/streamableHttp.js';
import type { ToolDeps } from './server/toolDeps.js';

function buildAiProvider(env: ReturnType<typeof loadEnv>, logger: ReturnType<typeof createLogger>): AiProvider {
  if (env.AI_PROVIDER === 'anthropic') {
    return new AnthropicAiProvider({
      apiKey: env.ANTHROPIC_API_KEY,
      model: env.ANTHROPIC_MODEL,
      timeoutMs: env.AI_TIMEOUT_MS,
      logger,
    });
  }
  if (env.AI_PROVIDER === 'gemini') {
    return new GeminiAiProvider({
      apiKey: env.GEMINI_API_KEY,
      model: env.GEMINI_MODEL,
      timeoutMs: env.AI_TIMEOUT_MS,
      logger,
    });
  }
  return new MockAiProvider();
}

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env);
  const prisma = getPrismaClient();

  const deps: ToolDeps = {
    aiProvider: buildAiProvider(env, logger),
    userProfileRepo: new PrismaUserProfileRepository(prisma),
    schoolTaskRepo: new PrismaSchoolTaskRepository(prisma),
    analysisCacheRepo: new PrismaAnalysisCacheRepository(prisma),
    cacheEnabled: env.ANALYSIS_CACHE_ENABLED,
    cacheTtlSeconds: env.ANALYSIS_CACHE_TTL_SECONDS,
    logger,
  };

  const app = buildExpressApp({ env, logger, deps, prismaClient: prisma });

  const httpServer = app.listen(env.PORT, env.HOST, () => {
    logger.info({ port: env.PORT, host: env.HOST }, 'poomschool_mcp_server_started');
  });

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutdown_initiated');
    httpServer.close(() => {
      logger.info('http_server_closed');
    });
    await disconnectPrisma();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((error: unknown) => {
   
  console.error('poomschool-mcp 서버 시작에 실패했습니다:', error instanceof Error ? error.message : error);
  process.exit(1);
});
