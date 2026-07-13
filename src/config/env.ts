import { z } from 'zod';

const boolFromString = z.preprocess((v) => v === 'true', z.boolean());

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    HOST: z.string().default('0.0.0.0'),
    PUBLIC_BASE_URL: z.string().url().default('http://localhost:3000'),

    AI_PROVIDER: z.enum(['anthropic', 'mock']).default('mock'),
    ANTHROPIC_API_KEY: z.string().optional().default(''),
    ANTHROPIC_MODEL: z.string().optional().default(''),
    AI_TIMEOUT_MS: z.coerce.number().int().positive().default(2500),

    DATABASE_URL: z.string().min(1, 'DATABASE_URL은 필수입니다.'),
    ANALYSIS_CACHE_ENABLED: boolFromString,
    ANALYSIS_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(900),

    OAUTH_ISSUER: z.string().optional().default(''),
    OAUTH_AUDIENCE: z.string().optional().default(''),
    OAUTH_JWKS_URL: z.string().optional().default(''),

    ALLOWED_ORIGINS: z.string().optional().default(''),
    ALLOW_MISSING_ORIGIN: boolFromString,
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(60),

    AUTH_DISABLED: boolFromString,
    DEV_USER_SUB: z.string().optional().default('local-test-user'),

    LOG_LEVEL: z.string().optional().default('info'),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production' && data.AUTH_DISABLED) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'NODE_ENV=production 에서는 AUTH_DISABLED=true를 사용할 수 없습니다.',
        path: ['AUTH_DISABLED'],
      });
    }
    if (!data.AUTH_DISABLED) {
      if (!data.OAUTH_ISSUER) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'AUTH_DISABLED=false 인 경우 OAUTH_ISSUER가 필요합니다.',
          path: ['OAUTH_ISSUER'],
        });
      }
      if (!data.OAUTH_AUDIENCE) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'AUTH_DISABLED=false 인 경우 OAUTH_AUDIENCE가 필요합니다.',
          path: ['OAUTH_AUDIENCE'],
        });
      }
      if (!data.OAUTH_JWKS_URL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'AUTH_DISABLED=false 인 경우 OAUTH_JWKS_URL이 필요합니다.',
          path: ['OAUTH_JWKS_URL'],
        });
      }
    }
    if (data.AI_PROVIDER === 'anthropic' && !data.ANTHROPIC_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'AI_PROVIDER=anthropic 인 경우 ANTHROPIC_API_KEY가 필요합니다.',
        path: ['ANTHROPIC_API_KEY'],
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | undefined;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cachedEnv) return cachedEnv;
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `- ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`환경변수 검증에 실패했습니다:\n${details}`);
  }
  cachedEnv = parsed.data;
  return cachedEnv;
}

export function resetEnvCacheForTests(): void {
  cachedEnv = undefined;
}

export function allowedOriginsList(env: Env): string[] {
  return env.ALLOWED_ORIGINS.split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}
