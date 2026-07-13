import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildTestApp, cleanDatabase } from '../helpers/testApp.js';
import { startRpcClient, type RpcClient } from '../helpers/rpcClient.js';
import { startTestJwksServer, signTestToken, type TestJwksContext } from '../helpers/testJwks.js';

const ISSUER = 'https://issuer.test.example.com';
const AUDIENCE = 'https://poomschool.test.example.com/mcp';

describe('OAuth 2.1 Resource Server 인증/인가', () => {
  let ctx: Awaited<ReturnType<typeof buildTestApp>>;
  let client: RpcClient;
  let jwks: TestJwksContext;

  beforeAll(async () => {
    await cleanDatabase();
    jwks = await startTestJwksServer(ISSUER, AUDIENCE);
    ctx = buildTestApp({
      envOverrides: {
        AUTH_DISABLED: 'false',
        OAUTH_ISSUER: ISSUER,
        OAUTH_AUDIENCE: AUDIENCE,
        OAUTH_JWKS_URL: jwks.url,
      },
    });
    client = await startRpcClient(ctx.app);
  });

  afterAll(async () => {
    await client.close();
    await jwks.close();
    await ctx.prisma.$disconnect();
  });

  it('토큰이 없으면 401을 반환한다', async () => {
    const res = await client.rawResponse({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toBeTruthy();
  });

  it('잘못된 토큰은 401을 반환한다', async () => {
    const res = await client.rawResponse(
      { jsonrpc: '2.0', id: 1, method: 'tools/list' },
      { authorization: 'Bearer not-a-real-token' },
    );
    expect(res.status).toBe(401);
  });

  it('만료된 토큰은 401을 반환한다', async () => {
    const expired = await signTestToken(jwks, { sub: 'user-a', expiresInSeconds: -10 });
    const res = await client.rawResponse(
      { jsonrpc: '2.0', id: 1, method: 'tools/list' },
      { authorization: `Bearer ${expired}` },
    );
    expect(res.status).toBe(401);
  });

  it('issuer가 다른 토큰은 401을 반환한다', async () => {
    const wrongIssuer = await signTestToken(jwks, { sub: 'user-a', issuer: 'https://wrong-issuer.example.com' });
    const res = await client.rawResponse(
      { jsonrpc: '2.0', id: 1, method: 'tools/list' },
      { authorization: `Bearer ${wrongIssuer}` },
    );
    expect(res.status).toBe(401);
  });

  it('audience가 다른 토큰은 401을 반환한다', async () => {
    const wrongAudience = await signTestToken(jwks, { sub: 'user-a', audience: 'https://wrong-audience.example.com' });
    const res = await client.rawResponse(
      { jsonrpc: '2.0', id: 1, method: 'tools/list' },
      { authorization: `Bearer ${wrongAudience}` },
    );
    expect(res.status).toBe(401);
  });

  it('read scope가 없으면 read 전용 Tool 호출 시 403을 반환한다', async () => {
    const noReadScope = await signTestToken(jwks, { sub: 'user-a', scope: 'poomschool:write' });
    const { status } = await client.rpc(
      { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'explain_term', arguments: { term: '스쿨뱅킹' } } },
      { authorization: `Bearer ${noReadScope}` },
    );
    expect(status).toBe(403);
  });

  it('write scope가 없으면 write 전용 Tool 호출 시 403을 반환한다', async () => {
    const noWriteScope = await signTestToken(jwks, { sub: 'user-a', scope: 'poomschool:read' });
    const { status } = await client.rpc(
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'set_parent_preferences',
          arguments: {
            preferred_language_code: 'ko',
            explanation_level: 'standard',
            show_easy_korean: true,
            show_original_text: true,
          },
        },
      },
      { authorization: `Bearer ${noWriteScope}` },
    );
    expect(status).toBe(403);
  });

  it('유효한 토큰과 충분한 scope가 있으면 정상 호출된다', async () => {
    const validToken = await signTestToken(jwks, { sub: 'user-a', scope: 'poomschool:read poomschool:write' });
    const { status, result } = await client.callTool(
      'explain_term',
      { term: '스쿨뱅킹' },
      { authorization: `Bearer ${validToken}` },
    );
    expect(status).toBe(200);
    expect(result?.isError).toBeFalsy();
  });

  it('서로 다른 사용자는 서로의 학교 할 일에 접근할 수 없다', async () => {
    const tokenA = await signTestToken(jwks, { sub: 'user-a-isolated' });
    const tokenB = await signTestToken(jwks, { sub: 'user-b-isolated' });

    await client.callTool(
      'save_tasks',
      {
        tasks: [
          { title: 'A의 할 일', category: 'other', priority: 'normal', requires_signature: false, requires_payment: false },
        ],
        idempotency_key: 'isolation-key-1',
      },
      { authorization: `Bearer ${tokenA}` },
    );

    const taskA = await ctx.prisma.schoolTask.findFirst({ where: { title: 'A의 할 일' } });
    expect(taskA).not.toBeNull();

    const completeAsB = await client.callTool(
      'complete_task',
      { task_id: taskA!.id },
      { authorization: `Bearer ${tokenB}` },
    );
    expect(completeAsB.result?.isError).toBe(true);

    const listAsB = await client.callTool('list_tasks', { status: 'all' }, { authorization: `Bearer ${tokenB}` });
    expect(listAsB.result?.content[0]?.text ?? '').not.toContain('A의 할 일');
  });
});
