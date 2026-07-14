import { describe, expect, it } from 'vitest';
import { loadEnv, resetEnvCacheForTests } from '../../src/config/env.js';

describe('loadEnv', () => {
  it('production에서 AUTH_DISABLED=true이면 검증에 실패한다', () => {
    resetEnvCacheForTests();
    expect(() =>
      loadEnv({
        NODE_ENV: 'production',
        AUTH_DISABLED: 'true',
        DATABASE_URL: 'postgresql://localhost/db',
        PUBLIC_BASE_URL: 'https://example.com',
      }),
    ).toThrow(/AUTH_DISABLED/);
    resetEnvCacheForTests();
  });

  it('AUTH_DISABLED=false인데 OAUTH_ISSUER가 없으면 검증에 실패한다', () => {
    resetEnvCacheForTests();
    expect(() =>
      loadEnv({
        NODE_ENV: 'development',
        AUTH_DISABLED: 'false',
        DATABASE_URL: 'postgresql://localhost/db',
        PUBLIC_BASE_URL: 'https://example.com',
      }),
    ).toThrow(/OAUTH_ISSUER/);
    resetEnvCacheForTests();
  });

  it('개발 환경에서 AUTH_DISABLED=true는 허용된다', () => {
    resetEnvCacheForTests();
    const env = loadEnv({
      NODE_ENV: 'development',
      AUTH_DISABLED: 'true',
      DATABASE_URL: 'postgresql://localhost/db',
      PUBLIC_BASE_URL: 'https://example.com',
    });
    expect(env.AUTH_DISABLED).toBe(true);
    resetEnvCacheForTests();
  });

  it('DATABASE_URL이 없으면 검증에 실패한다', () => {
    resetEnvCacheForTests();
    expect(() =>
      loadEnv({ NODE_ENV: 'development', AUTH_DISABLED: 'true', PUBLIC_BASE_URL: 'https://example.com' }),
    ).toThrow();
    resetEnvCacheForTests();
  });

  it('AI_PROVIDER=gemini인데 GEMINI_API_KEY가 없으면 검증에 실패한다', () => {
    resetEnvCacheForTests();
    expect(() =>
      loadEnv({
        NODE_ENV: 'development',
        AUTH_DISABLED: 'true',
        DATABASE_URL: 'postgresql://localhost/db',
        PUBLIC_BASE_URL: 'https://example.com',
        AI_PROVIDER: 'gemini',
      }),
    ).toThrow(/GEMINI_API_KEY/);
    resetEnvCacheForTests();
  });

  it('AI_PROVIDER=gemini이고 GEMINI_API_KEY가 있으면 GEMINI_MODEL 기본값이 gemini-2.5-flash이다', () => {
    resetEnvCacheForTests();
    const env = loadEnv({
      NODE_ENV: 'development',
      AUTH_DISABLED: 'true',
      DATABASE_URL: 'postgresql://localhost/db',
      PUBLIC_BASE_URL: 'https://example.com',
      AI_PROVIDER: 'gemini',
      GEMINI_API_KEY: 'test-gemini-key',
    });
    expect(env.GEMINI_MODEL).toBe('gemini-2.5-flash');
    resetEnvCacheForTests();
  });
});
