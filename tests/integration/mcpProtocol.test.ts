import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildTestApp, cleanDatabase } from '../helpers/testApp.js';
import { startRpcClient, type RpcClient } from '../helpers/rpcClient.js';
import { SERVICE_NAME_BILINGUAL } from '../../src/config/constants.js';

const FORBIDDEN_SUBSTRING = 'kakao';
const TOOL_NAME_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

describe('MCP 프로토콜 준수 (Streamable HTTP)', () => {
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

  it.each(['2025-03-26', '2025-06-18', '2025-11-25'])('initialize가 protocolVersion %s를 지원한다', async (version) => {
    const { status, result, error } = await client.initialize(version);
    expect(status).toBe(200);
    expect(error).toBeUndefined();
    expect((result as { protocolVersion: string }).protocolVersion).toBe(version);
  });

  it('지원 범위를 벗어난 protocolVersion은 오류로 처리한다', async () => {
    const { error } = await client.initialize('2024-10-07');
    expect(error).toBeDefined();
  });

  it('tools/list가 정확히 10개의 Tool을 반환한다', async () => {
    const { tools } = await client.listTools();
    expect(tools).toHaveLength(10);
  });

  it('Tool 이름이 중복되지 않는다', async () => {
    const { tools } = await client.listTools();
    const names = (tools as Array<{ name: string }>).map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('모든 Tool 이름이 명명 규칙을 지키고 kakao 문자열을 포함하지 않는다', async () => {
    const { tools } = await client.listTools();
    for (const tool of tools as Array<{ name: string }>) {
      expect(tool.name).toMatch(TOOL_NAME_REGEX);
      expect(tool.name.toLowerCase()).not.toContain(FORBIDDEN_SUBSTRING);
    }
  });

  it('모든 Tool에 5가지 annotations가 명시적으로 존재한다', async () => {
    const { tools } = await client.listTools();
    for (const tool of tools as Array<{ name: string; annotations?: Record<string, unknown> }>) {
      expect(tool.annotations, `${tool.name} annotations 누락`).toBeDefined();
      expect(tool.annotations).toHaveProperty('title');
      expect(tool.annotations).toHaveProperty('readOnlyHint');
      expect(tool.annotations).toHaveProperty('destructiveHint');
      expect(tool.annotations).toHaveProperty('openWorldHint');
      expect(tool.annotations).toHaveProperty('idempotentHint');
    }
  });

  it('모든 description이 PoomSchool(품스쿨)을 포함하고 1024자 이하다', async () => {
    const { tools } = await client.listTools();
    for (const tool of tools as Array<{ name: string; description: string }>) {
      expect(tool.description).toContain(SERVICE_NAME_BILINGUAL);
      expect(tool.description.length).toBeLessThanOrEqual(1024);
    }
  });

  it('MCP Server Name(poomschool)에도 kakao 문자열이 없다', async () => {
    const { result } = await client.initialize('2025-06-18');
    const serverInfo = (result as { serverInfo: { name: string } }).serverInfo;
    expect(serverInfo.name.toLowerCase()).not.toContain(FORBIDDEN_SUBSTRING);
    expect(serverInfo.name).toBe('poomschool');
  });

  it('모든 Tool의 inputSchema는 $ref를 포함하지 않는다 (스키마 객체 재사용으로 인한 $ref 치환 방지)', async () => {
    const { tools } = await client.listTools();
    function findRefPaths(node: unknown, path: string): string[] {
      if (node === null || typeof node !== 'object') return [];
      const found: string[] = [];
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        if (key === '$ref') found.push(path);
        found.push(...findRefPaths(value, `${path}.${key}`));
      }
      return found;
    }
    for (const tool of tools as Array<{ name: string; inputSchema: unknown }>) {
      const refs = findRefPaths(tool.inputSchema, tool.name);
      expect(refs, `${tool.name} inputSchema에 $ref가 있으면 안 됨: ${refs.join(', ')}`).toEqual([]);
    }
  });

  it('tools/call 성공 시 한국어 Markdown 결과를 반환한다', async () => {
    const { status, result } = await client.callTool('explain_term', { term: '스쿨뱅킹' });
    expect(status).toBe(200);
    expect(result?.isError).toBeFalsy();
    expect(result?.content[0]?.text).toContain('계좌');
  });

  it('잘못된 입력은 isError:true를 반환한다', async () => {
    const { result } = await client.callTool('analyze_notice', { notice_text: '' });
    expect(result?.isError).toBe(true);
  });

  it('AI Provider 원본 응답 형식을 그대로 노출하지 않는다 (JSON 원본 미노출)', async () => {
    const { result } = await client.callTool('explain_term', { term: '방과후학교' });
    const text = result?.content[0]?.text ?? '';
    expect(text.trim().startsWith('{')).toBe(false);
  });
});
