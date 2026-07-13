import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildTestApp, cleanDatabase } from '../helpers/testApp.js';
import { startRpcClient, type RpcClient } from '../helpers/rpcClient.js';

/**
 * 개발 환경에서의 가벼운 성능 스모크 테스트.
 * 엄격한 벤치마크는 scripts/benchmark.ts에서 별도로 수행하며,
 * 이 테스트는 회귀(regression) 여부만 느슨하게 확인한다.
 */
describe('비AI Tool 성능 스모크 테스트', () => {
  let ctx: Awaited<ReturnType<typeof buildTestApp>>;
  let client: RpcClient;

  beforeAll(async () => {
    await cleanDatabase();
    ctx = buildTestApp({ envOverrides: { DEV_USER_SUB: 'perf-smoke-user' } });
    client = await startRpcClient(ctx.app);
  });

  afterAll(async () => {
    await client.close();
    await ctx.prisma.$disconnect();
  });

  it('list_tasks 20회 평균 응답 시간이 합리적인 범위 내에 있다', async () => {
    const iterations = 20;
    const durations: number[] = [];
    for (let i = 0; i < iterations; i += 1) {
      const started = Date.now();
      await client.callTool('list_tasks', { status: 'all' });
      durations.push(Date.now() - started);
    }
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    // 네트워크 왕복 포함 로컬 테스트 환경 기준 느슨한 상한선
    expect(avg).toBeLessThan(500);
  });

  it('explain_term(용어집 캐시 hit) 20회 평균 응답 시간이 합리적인 범위 내에 있다', async () => {
    const iterations = 20;
    const durations: number[] = [];
    for (let i = 0; i < iterations; i += 1) {
      const started = Date.now();
      await client.callTool('explain_term', { term: '방과후학교' });
      durations.push(Date.now() - started);
    }
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    expect(avg).toBeLessThan(300);
  });
});
