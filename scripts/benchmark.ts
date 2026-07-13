/**
 * PoomSchool(품스쿨) 성능 벤치마크 스크립트 (섹션 19).
 *
 * MockAiProvider와 실제 PostgreSQL(DATABASE_URL)을 사용해 주요 Tool을 각 100회 호출하고
 * 평균/p50/p95/p99/최소/최대/실패율을 측정한다.
 *
 * 주의: 이 스크립트는 MockAiProvider 기준 성능만 측정한다.
 * 실제 Anthropic API를 사용하는 AnthropicAiProvider의 성능은 네트워크/모델 응답 시간에
 * 따라 달라지며 이 스크립트로 대표되지 않는다. Mock 성능을 실제 AI 성능처럼 보고하지 않는다.
 */
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { loadEnv, resetEnvCacheForTests } from '../src/config/env.js';
import { createLogger } from '../src/config/logger.js';
import { PrismaUserProfileRepository } from '../src/database/repositories/userProfileRepository.js';
import { PrismaSchoolTaskRepository } from '../src/database/repositories/schoolTaskRepository.js';
import { PrismaAnalysisCacheRepository } from '../src/database/repositories/analysisCacheRepository.js';
import { MockAiProvider } from '../src/services/ai/MockAiProvider.js';
import { buildExpressApp } from '../src/server/streamableHttp.js';
import type { ToolDeps } from '../src/server/toolDeps.js';
import { computeStats, type TimingStats } from '../src/utils/metrics.js';

const ITERATIONS = 100;
const P99_LIMIT_MS = 3000;
const NON_AI_AVG_TARGET_MS = 100;

async function callTool(
  baseUrl: string,
  name: string,
  args: Record<string, unknown>,
): Promise<{ ok: boolean; ms: number }> {
  const started = Date.now();
  try {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
    });
    const ms = Date.now() - started;
    if (!res.ok) return { ok: false, ms };
    const text = await res.text();
    const dataLine = text.split('\n').find((l) => l.startsWith('data:'));
    const payload = dataLine ? JSON.parse(dataLine.slice(5).trim()) : JSON.parse(text);
    const isError = Boolean(payload?.result?.isError) || Boolean(payload?.error);
    return { ok: !isError, ms };
  } catch {
    return { ok: false, ms: Date.now() - started };
  }
}

async function measure(
  label: string,
  runOnce: () => Promise<{ ok: boolean; ms: number }>,
  isAiTool: boolean,
): Promise<{ label: string; stats: TimingStats; isAiTool: boolean }> {
  const durations: number[] = [];
  let failures = 0;
  for (let i = 0; i < ITERATIONS; i += 1) {
    const { ok, ms } = await runOnce();
    durations.push(ms);
    if (!ok) failures += 1;
  }
  return { label, stats: computeStats(durations, failures), isAiTool };
}

function printRow(label: string, stats: TimingStats, isAiTool: boolean): void {
  const line = [
    label.padEnd(28),
    `avg=${stats.avg.toFixed(1)}ms`,
    `p50=${stats.p50}ms`,
    `p95=${stats.p95}ms`,
    `p99=${stats.p99}ms`,
    `min=${stats.min}ms`,
    `max=${stats.max}ms`,
    `fail=${(stats.failureRate * 100).toFixed(1)}%`,
    isAiTool ? '(AI 경로 - MockAiProvider)' : '(비AI 경로)',
  ].join('  ');
  console.log(line);
}

async function main(): Promise<void> {
  resetEnvCacheForTests();
  const env = loadEnv({
    NODE_ENV: 'development',
    PORT: '3000',
    PUBLIC_BASE_URL: 'http://localhost:3000',
    AI_PROVIDER: 'mock',
    DATABASE_URL:
      process.env.DATABASE_URL ??
      `postgresql://${process.env.USER ?? 'postgres'}@localhost:5432/poomschool_test?schema=public`,
    ANALYSIS_CACHE_ENABLED: 'true',
    ANALYSIS_CACHE_TTL_SECONDS: '900',
    ALLOWED_ORIGINS: '',
    ALLOW_MISSING_ORIGIN: 'true',
    RATE_LIMIT_WINDOW_MS: '60000',
    RATE_LIMIT_MAX_REQUESTS: '100000',
    AUTH_DISABLED: 'true',
    DEV_USER_SUB: `benchmark-user-${randomUUID()}`,
    LOG_LEVEL: 'silent',
  });
  resetEnvCacheForTests();

  const logger = createLogger(env);
  const prisma = new PrismaClient();

  const deps: ToolDeps = {
    aiProvider: new MockAiProvider(),
    userProfileRepo: new PrismaUserProfileRepository(prisma),
    schoolTaskRepo: new PrismaSchoolTaskRepository(prisma),
    analysisCacheRepo: new PrismaAnalysisCacheRepository(prisma),
    cacheEnabled: env.ANALYSIS_CACHE_ENABLED,
    cacheTtlSeconds: env.ANALYSIS_CACHE_TTL_SECONDS,
    logger,
  };

  const app = buildExpressApp({ env, logger, deps, prismaClient: prisma });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;

  // complete_task 측정을 위한 사전 데이터 준비
  await callTool(baseUrl, 'save_tasks', {
    tasks: [
      { title: '벤치마크용 할 일', category: 'other', priority: 'normal', requires_signature: false, requires_payment: false },
    ],
    idempotency_key: `benchmark-seed-${randomUUID()}`,
  });
  const seededTask = await prisma.schoolTask.findFirst({ where: { title: '벤치마크용 할 일' } });

  const results: Array<{ label: string; stats: TimingStats; isAiTool: boolean }> = [];

  results.push(
    await measure('list_tasks', () => callTool(baseUrl, 'list_tasks', { status: 'all' }), false),
  );

  results.push(
    await measure(
      'complete_task',
      () => callTool(baseUrl, 'complete_task', { task_id: seededTask?.id ?? 'missing' }),
      false,
    ),
  );

  results.push(
    await measure('explain_term (cache hit)', () => callTool(baseUrl, 'explain_term', { term: '스쿨뱅킹' }), false),
  );

  results.push(
    await measure(
      'set_parent_preferences',
      () =>
        callTool(baseUrl, 'set_parent_preferences', {
          preferred_language_code: 'ko',
          explanation_level: 'standard',
          show_easy_korean: true,
          show_original_text: true,
        }),
      false,
    ),
  );

  let counter = 0;
  results.push(
    await measure(
      'analyze_notice (MockAiProvider)',
      () => {
        counter += 1;
        return callTool(baseUrl, 'analyze_notice', {
          notice_text: `방과후학교 신청서를 제출하세요. 벤치마크 반복 ${counter}`,
        });
      },
      true,
    ),
  );

  results.push(
    await measure(
      'translate_notice (MockAiProvider)',
      () => {
        counter += 1;
        return callTool(baseUrl, 'translate_notice', {
          notice_text: `스쿨뱅킹으로 납부하세요. 벤치마크 반복 ${counter}`,
          target_language: 'vi',
        });
      },
      true,
    ),
  );

  results.push(await measure('weekly_brief', () => callTool(baseUrl, 'weekly_brief', {}), false));

  console.log('\n=== PoomSchool(품스쿨) 성능 벤치마크 결과 (각 100회) ===\n');
  for (const r of results) printRow(r.label, r.stats, r.isAiTool);

  let hasFailure = false;
  for (const r of results) {
    if (r.stats.p99 > P99_LIMIT_MS) {
      console.error(`\n[실패] ${r.label} p99(${r.stats.p99}ms)가 목표(${P99_LIMIT_MS}ms)를 초과했습니다.`);
      hasFailure = true;
    }
    if (!r.isAiTool && r.stats.avg > NON_AI_AVG_TARGET_MS) {
      console.warn(
        `[경고] ${r.label} 평균(${r.stats.avg.toFixed(1)}ms)이 비AI 목표(${NON_AI_AVG_TARGET_MS}ms)를 초과했습니다.`,
      );
    }
  }

  server.close();
  await prisma.$disconnect();

  if (hasFailure) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error('벤치마크 실행 실패:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
