import { loadEnv, resetEnvCacheForTests, type Env } from '../../src/config/env.js';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  `postgresql://${process.env.USER ?? 'postgres'}@localhost:5432/poomschool_test?schema=public`;

export function buildTestEnv(overrides: Partial<Record<string, string>> = {}): Env {
  resetEnvCacheForTests();
  const source: NodeJS.ProcessEnv = {
    NODE_ENV: 'test',
    PORT: '3000',
    HOST: '127.0.0.1',
    PUBLIC_BASE_URL: 'http://localhost:3000',
    AI_PROVIDER: 'mock',
    AI_TIMEOUT_MS: '2500',
    DATABASE_URL: TEST_DATABASE_URL,
    ANALYSIS_CACHE_ENABLED: 'true',
    ANALYSIS_CACHE_TTL_SECONDS: '900',
    ALLOWED_ORIGINS: 'https://playmcp.kakao.com',
    ALLOW_MISSING_ORIGIN: 'true',
    RATE_LIMIT_WINDOW_MS: '60000',
    RATE_LIMIT_MAX_REQUESTS: '1000',
    AUTH_DISABLED: 'true',
    DEV_USER_SUB: 'test-user-default',
    LOG_LEVEL: 'silent',
    ...overrides,
  };
  const env = loadEnv(source);
  resetEnvCacheForTests();
  return env;
}
