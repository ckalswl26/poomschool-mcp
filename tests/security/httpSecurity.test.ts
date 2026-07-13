import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildTestApp, cleanDatabase } from '../helpers/testApp.js';
import { startRpcClient, type RpcClient } from '../helpers/rpcClient.js';
import { NOTICE_TEXT_MAX_LENGTH, PARENT_INPUT_MAX_LENGTH } from '../../src/config/constants.js';

describe('HTTP 보안 정책', () => {
  describe('Origin allowlist', () => {
    let ctx: Awaited<ReturnType<typeof buildTestApp>>;
    let client: RpcClient;

    beforeAll(async () => {
      await cleanDatabase();
      ctx = buildTestApp({
        envOverrides: { ALLOWED_ORIGINS: 'https://playmcp.kakao.com', ALLOW_MISSING_ORIGIN: 'true' },
      });
      client = await startRpcClient(ctx.app);
    });

    afterAll(async () => {
      await client.close();
      await ctx.prisma.$disconnect();
    });

    it('허용되지 않은 Origin은 403을 반환한다', async () => {
      const res = await client.rawResponse(
        { jsonrpc: '2.0', id: 1, method: 'tools/list' },
        { origin: 'https://evil.example.com' },
      );
      expect(res.status).toBe(403);
    });

    it('허용된 Origin은 통과한다', async () => {
      const res = await client.rawResponse(
        { jsonrpc: '2.0', id: 1, method: 'tools/list' },
        { origin: 'https://playmcp.kakao.com' },
      );
      expect(res.status).toBe(200);
    });

    it('Origin이 없는 요청은 ALLOW_MISSING_ORIGIN 정책에 따라 허용된다', async () => {
      const res = await client.rawResponse({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
      expect(res.status).toBe(200);
    });
  });

  describe('요청 크기 제한', () => {
    let ctx: Awaited<ReturnType<typeof buildTestApp>>;
    let client: RpcClient;

    beforeAll(async () => {
      await cleanDatabase();
      ctx = buildTestApp();
      client = await startRpcClient(ctx.app);
    });

    afterAll(async () => {
      await client.close();
      await ctx.prisma.$disconnect();
    });

    it('notice_text가 10,000자를 초과하면 거부한다', async () => {
      const { result } = await client.callTool('analyze_notice', {
        notice_text: 'a'.repeat(NOTICE_TEXT_MAX_LENGTH + 1),
      });
      expect(result?.isError).toBe(true);
    });

    it('parent_input_text가 4,000자를 초과하면 거부한다', async () => {
      const { result } = await client.callTool('draft_teacher_message', {
        parent_input_text: 'a'.repeat(PARENT_INPUT_MAX_LENGTH + 1),
        situation: 'other',
      });
      expect(result?.isError).toBe(true);
    });

    it('비정상적으로 큰 요청 본문은 500이 아닌 안전한 4xx로 처리된다', async () => {
      const res = await client.rawResponse({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'analyze_notice', arguments: { notice_text: 'a'.repeat(700_000) } },
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    it('HTML/script가 포함된 입력도 오류 없이 안전하게 텍스트로 처리한다', async () => {
      const { result } = await client.callTool('draft_teacher_message', {
        parent_input_text: '<script>alert(1)</script> 아이가 아파서 결석합니다.',
        situation: 'absence',
      });
      expect(result?.isError).toBeFalsy();
      expect(typeof result?.content[0]?.text).toBe('string');
    });
  });

  describe('delete_task confirm 정책', () => {
    let ctx: Awaited<ReturnType<typeof buildTestApp>>;
    let client: RpcClient;

    beforeAll(async () => {
      await cleanDatabase();
      ctx = buildTestApp({ envOverrides: { DEV_USER_SUB: 'confirm-test-user' } });
      client = await startRpcClient(ctx.app);
    });

    afterAll(async () => {
      await client.close();
      await ctx.prisma.$disconnect();
    });

    it('confirm=false이면 삭제되지 않는다', async () => {
      await client.callTool('save_tasks', {
        tasks: [{ title: '삭제 방지 테스트', category: 'other', priority: 'normal', requires_signature: false, requires_payment: false }],
        idempotency_key: 'confirm-key-1',
      });
      const task = await ctx.prisma.schoolTask.findFirst({ where: { title: '삭제 방지 테스트' } });
      const { result } = await client.callTool('delete_task', { task_id: task!.id, confirm: false });
      expect(result?.isError).toBe(true);
      const stillThere = await ctx.prisma.schoolTask.findUnique({ where: { id: task!.id } });
      expect(stillThere?.deletedAt).toBeNull();
    });
  });

  describe('Rate limit', () => {
    it('사용자별 요청이 제한을 초과하면 429를 반환한다', async () => {
      const ctx = buildTestApp({
        envOverrides: { RATE_LIMIT_MAX_REQUESTS: '3', RATE_LIMIT_WINDOW_MS: '60000', DEV_USER_SUB: 'rate-limit-user' },
      });
      const client = await startRpcClient(ctx.app);
      try {
        const statuses: number[] = [];
        for (let i = 0; i < 5; i += 1) {
          const res = await client.rawResponse({ jsonrpc: '2.0', id: i, method: 'tools/list' });
          statuses.push(res.status);
        }
        expect(statuses).toContain(429);
      } finally {
        await client.close();
        await ctx.prisma.$disconnect();
      }
    });
  });
});
