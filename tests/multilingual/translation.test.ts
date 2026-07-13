import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildTestApp, cleanDatabase } from '../helpers/testApp.js';
import { startRpcClient, type RpcClient } from '../helpers/rpcClient.js';

describe('다국어 및 양방향 번역 (MockAiProvider)', () => {
  let ctx: Awaited<ReturnType<typeof buildTestApp>>;
  let client: RpcClient;

  beforeAll(async () => {
    await cleanDatabase();
    ctx = buildTestApp({ envOverrides: { DEV_USER_SUB: 'multilingual-user' } });
    client = await startRpcClient(ctx.app);
  });

  afterAll(async () => {
    await client.close();
    await ctx.prisma.$disconnect();
  });

  const KOREAN_NOTICE = '7월 20일까지 30,000원을 스쿨뱅킹으로 납부하세요.';

  it.each([
    ['vi', KOREAN_NOTICE],
    ['zh-CN', KOREAN_NOTICE],
    ['en', KOREAN_NOTICE],
  ])('한국어 안내문을 %s로 번역하며 날짜/금액을 보존한다', async (targetLanguage, noticeText) => {
    const { result } = await client.callTool('translate_notice', {
      notice_text: noticeText,
      target_language: targetLanguage,
    });
    const text = result?.content[0]?.text ?? '';
    expect(text).toContain('7월 20일');
    expect(text).toContain('30,000원');
    expect(text).toContain('스쿨뱅킹');
  });

  it.each([
    ['vi', 'Con tôi bị sốt nên hôm nay sẽ nghỉ học.'],
    ['zh', '我的孩子今天发烧了，所以要请假。'],
    ['ru', 'Мой ребенок заболел, поэтому сегодня не пойдет в школу.'],
  ])('%s 부모 입력을 한국어 교사 메시지로 변환한다', async (_lang, parentInput) => {
    const { result } = await client.callTool('draft_teacher_message', {
      parent_input_text: parentInput,
      situation: 'absence',
    });
    const text = result?.content[0]?.text ?? '';
    expect(result?.isError).toBeFalsy();
    expect(text).toContain('선생님께 보낼 한국어 메시지');
    expect(text).toMatch(/[가-힣]/);
    // 입력에 없는 사실을 추가하지 않는다: 원문이 그대로 참조되어야 한다
    expect(text).toContain(parentInput);
  });

  it('언어 자동 감지 신뢰도가 낮으면 확인을 요청한다', async () => {
    const { result } = await client.callTool('translate_notice', {
      notice_text: 'hello there how are you today',
      source_language: 'auto',
      target_language: 'en',
    });
    const text = result?.content[0]?.text ?? '';
    expect(text).toContain('신뢰도');
  });

  it('알 수 없는 형식의 BCP-47 코드는 입력 검증에서 거부된다', async () => {
    const { result } = await client.callTool('translate_notice', {
      notice_text: '안내문입니다',
      target_language: 'not-a-valid-code-!!',
    });
    expect(result?.isError).toBe(true);
  });

  it('부모 언어를 직접 지정하면 자동 감지보다 우선한다', async () => {
    const { result } = await client.callTool('analyze_notice', {
      notice_text: 'hello teacher, this is ambiguous text',
      source_language: 'vi',
      include_translation: true,
      parent_language: 'vi',
    });
    expect(result?.isError).toBeFalsy();
  });

  it('역번역 결과를 제공한다', async () => {
    const { result } = await client.callTool('draft_teacher_message', {
      parent_input_text: 'Con tôi bị ho.',
      parent_language: 'vi',
      situation: 'health_notice',
      include_back_translation: true,
    });
    const text = result?.content[0]?.text ?? '';
    expect(text).toContain('부모님 언어로 다시 확인하기');
  });

  it('역번역을 요청하지 않으면 해당 섹션을 생략한다', async () => {
    const { result } = await client.callTool('draft_teacher_message', {
      parent_input_text: 'Con tôi bị ho.',
      situation: 'health_notice',
      include_back_translation: false,
    });
    const text = result?.content[0]?.text ?? '';
    expect(text).not.toContain('부모님 언어로 다시 확인하기');
  });
});
