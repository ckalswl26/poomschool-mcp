import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, cleanDatabase } from '../helpers/testApp.js';
import { startRpcClient, type RpcClient } from '../helpers/rpcClient.js';

describe('Tool 동작 검증 (MockAiProvider + 실제 PostgreSQL)', () => {
  let ctx: Awaited<ReturnType<typeof buildTestApp>>;
  let client: RpcClient;

  beforeAll(async () => {
    ctx = buildTestApp({ envOverrides: { DEV_USER_SUB: 'tools-test-user' } });
    client = await startRpcClient(ctx.app);
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await client.close();
    await ctx.prisma.$disconnect();
  });

  describe('analyze_notice', () => {
    it('신청서/서명/납부/준비물/마감일을 추출하고 부모 업무와 아이 준비를 구분한다', async () => {
      const { result } = await client.callTool('analyze_notice', {
        notice_text:
          '방과후학교 신청서를 작성하고 동의서에 서명하여 7월 20일까지 제출하세요. 수강료 30,000원을 납부합니다. 준비물: 색연필, 줄넘기',
      });
      expect(result?.isError).toBeFalsy();
      const text = result?.content[0]?.text ?? '';
      expect(text).toContain('부모님이 해야 할 일');
      expect(text).toContain('아이가 챙길 준비물');
      expect(text).toContain('7월 20일');
    });

    it('notice_text가 비어있으면 isError:true (10,000자 제한 검증 포함)', async () => {
      const { result } = await client.callTool('analyze_notice', { notice_text: '' });
      expect(result?.isError).toBe(true);
    });

    it('빈 섹션은 출력하지 않는다', async () => {
      const { result } = await client.callTool('analyze_notice', { notice_text: '알림장을 확인해주세요.' });
      const text = result?.content[0]?.text ?? '';
      expect(text).not.toContain('## 아이가 챙길 준비물');
    });
  });

  describe('translate_notice', () => {
    it('날짜/금액을 유지한 채 부모 언어 번역과 쉬운 한국어를 함께 제공한다', async () => {
      const { result } = await client.callTool('translate_notice', {
        notice_text: '7월 20일까지 30,000원을 스쿨뱅킹으로 납부하세요.',
        target_language: 'vi',
      });
      const text = result?.content[0]?.text ?? '';
      expect(text).toContain('7월 20일');
      expect(text).toContain('30,000원');
      expect(text).toContain('쉬운 한국어');
    });
  });

  describe('explain_term', () => {
    it('사전 정의된 용어는 캐시(용어집)에서 즉시 응답한다', async () => {
      const { result } = await client.callTool('explain_term', { term: '돌봄교실' });
      expect(result?.isError).toBeFalsy();
      expect(result?.content[0]?.text).toContain('돌봄');
    });
  });

  describe('draft_teacher_message', () => {
    it('자동 전송되지 않는다는 안내를 포함한다', async () => {
      const { result } = await client.callTool('draft_teacher_message', {
        parent_input_text: '아이가 오늘 아침부터 기침을 해서 결석합니다.',
        situation: 'absence',
      });
      const text = result?.content[0]?.text ?? '';
      expect(text).toContain('자동으로 전송되지 않습니다');
    });

    it('parent_input_text가 4,000자를 초과하면 isError:true', async () => {
      const { result } = await client.callTool('draft_teacher_message', {
        parent_input_text: 'a'.repeat(4001),
        situation: 'other',
      });
      expect(result?.isError).toBe(true);
    });
  });

  describe('set_parent_preferences → analyze_notice 기본 언어 반영', () => {
    it('저장된 선호 언어가 이후 analyze_notice의 기본 부모 언어로 사용된다', async () => {
      const setResult = await client.callTool('set_parent_preferences', {
        preferred_language_code: 'vi',
        preferred_language_name: 'Tiếng Việt',
        explanation_level: 'easy',
        show_easy_korean: true,
        show_original_text: true,
      });
      expect(setResult.result?.isError).toBeFalsy();

      const analyzeResult = await client.callTool('analyze_notice', {
        notice_text: '스쿨뱅킹으로 납부해주세요.',
        include_translation: true,
      });
      const text = analyzeResult.result?.content[0]?.text ?? '';
      expect(text).toContain('(vi)');
    });
  });

  describe('save_tasks / list_tasks / complete_task / delete_task', () => {
    it('저장 → 조회 → 완료 → 삭제 전체 흐름이 동작한다', async () => {
      const saveResult = await client.callTool('save_tasks', {
        tasks: [
          {
            title: '신청서 제출',
            category: 'application',
            priority: 'high',
            requires_signature: true,
            requires_payment: false,
            due_at: new Date(Date.now() + 86400000).toISOString(),
          },
        ],
        idempotency_key: 'flow-test-1',
      });
      expect(saveResult.result?.isError).toBeFalsy();

      const listResult = await client.callTool('list_tasks', { status: 'pending' });
      const listText = listResult.result?.content[0]?.text ?? '';
      expect(listText).toContain('신청서 제출');

      // task_id를 추출하기 위해 DB에서 직접 조회 (툴 응답은 사람이 읽는 텍스트이므로)
      const savedTask = await ctx.prisma.schoolTask.findFirst({ where: { title: '신청서 제출' } });
      expect(savedTask).not.toBeNull();

      const completeResult = await client.callTool('complete_task', { task_id: savedTask!.id });
      expect(completeResult.result?.isError).toBeFalsy();

      const deleteWithoutConfirm = await client.callTool('delete_task', { task_id: savedTask!.id, confirm: false });
      expect(deleteWithoutConfirm.result?.isError).toBe(true);

      const deleteWithConfirm = await client.callTool('delete_task', { task_id: savedTask!.id, confirm: true });
      expect(deleteWithConfirm.result?.isError).toBeFalsy();

      const afterDelete = await ctx.prisma.schoolTask.findUnique({ where: { id: savedTask!.id } });
      expect(afterDelete?.deletedAt).not.toBeNull();
    });

    it('동일 idempotency_key로 save_tasks를 재호출해도 중복 저장하지 않는다', async () => {
      const args = {
        tasks: [
          {
            title: '중복 방지 테스트',
            category: 'other' as const,
            priority: 'normal' as const,
            requires_signature: false,
            requires_payment: false,
          },
        ],
        idempotency_key: 'dup-key-1',
      };
      await client.callTool('save_tasks', args);
      await client.callTool('save_tasks', args);
      const count = await ctx.prisma.schoolTask.count({ where: { title: '중복 방지 테스트' } });
      expect(count).toBe(1);
    });
  });

  describe('weekly_brief', () => {
    it('서명/납부/준비물이 필요한 업무를 구분해 보여준다', async () => {
      await client.callTool('save_tasks', {
        tasks: [
          {
            title: '동의서 제출',
            category: 'document',
            priority: 'high',
            requires_signature: true,
            requires_payment: false,
            due_at: new Date().toISOString(),
          },
          {
            title: '수강료 납부',
            category: 'payment',
            priority: 'normal',
            requires_signature: false,
            requires_payment: true,
            due_at: new Date().toISOString(),
          },
        ],
        idempotency_key: 'weekly-1',
      });

      const brief = await client.callTool('weekly_brief', {});
      const text = brief.result?.content[0]?.text ?? '';
      expect(text).toContain('서명이 필요한 일');
      expect(text).toContain('납부 전 확인할 일');
    });
  });
});
