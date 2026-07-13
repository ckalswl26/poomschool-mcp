import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildTestApp, cleanDatabase } from '../helpers/testApp.js';
import { startRpcClient, type RpcClient } from '../helpers/rpcClient.js';
import { SpyAiProvider } from '../helpers/spyAiProvider.js';
import { PrismaSchoolTaskRepository } from '../../src/database/repositories/schoolTaskRepository.js';
import { PrismaUserProfileRepository } from '../../src/database/repositories/userProfileRepository.js';

describe('개인정보 최소화 및 사용자 데이터 격리', () => {
  describe('원본 텍스트 미저장', () => {
    let ctx: Awaited<ReturnType<typeof buildTestApp>>;
    let client: RpcClient;

    beforeAll(async () => {
      await cleanDatabase();
      ctx = buildTestApp({ envOverrides: { DEV_USER_SUB: 'privacy-user-1' } });
      client = await startRpcClient(ctx.app);
    });

    afterAll(async () => {
      await client.close();
      await ctx.prisma.$disconnect();
    });

    it('analyze_notice 호출 후 원본 안내문 전체 텍스트가 그대로 저장되지 않는다', async () => {
      const uniqueMarker = `민감정보마커_${Date.now()}`;
      // 마커를 충분히 긴 필러 뒤에 배치해 요약(easyKoreanSummary)의 앞부분 발췌 범위 밖에 위치시킨다.
      const filler = '방과후학교 안내 문구입니다. '.repeat(20);
      const noticeText = `${filler}${uniqueMarker}`;
      await client.callTool('analyze_notice', { notice_text: noticeText });

      const cacheRows = await ctx.prisma.analysisCache.findMany();
      expect(cacheRows.length).toBeGreaterThan(0);
      for (const row of cacheRows) {
        expect(row.resultJson).not.toContain(noticeText);
        expect(row.resultJson).not.toContain(uniqueMarker);
      }
      const schema = readSchemaPrisma();
      expect(schema).not.toMatch(/noticeText|notice_text/);
    });

    it('draft_teacher_message 호출은 어떤 테이블에도 새 행을 만들지 않는다', async () => {
      const before = {
        tasks: await ctx.prisma.schoolTask.count(),
        cache: await ctx.prisma.analysisCache.count(),
        profiles: await ctx.prisma.userProfile.count(),
      };
      await client.callTool('draft_teacher_message', {
        parent_input_text: '아이가 아파서 결석합니다.',
        situation: 'absence',
      });
      const after = {
        tasks: await ctx.prisma.schoolTask.count(),
        cache: await ctx.prisma.analysisCache.count(),
        profiles: await ctx.prisma.userProfile.count(),
      };
      expect(after).toEqual(before);
    });

    it('save_tasks는 원본 안내문 전체가 아니라 구조화된 요약(source_summary)만 저장한다', async () => {
      const longOriginal = '이것은 매우 긴 원본 가정통신문 전체 내용입니다. '.repeat(50);
      await client.callTool('save_tasks', {
        tasks: [
          {
            title: '요약 테스트',
            category: 'other',
            priority: 'normal',
            requires_signature: false,
            requires_payment: false,
            source_summary: '짧은 요약',
          },
        ],
        idempotency_key: 'privacy-save-1',
      });
      const row = await ctx.prisma.schoolTask.findFirst({ where: { title: '요약 테스트' } });
      expect(row?.sourceSummary).toBe('짧은 요약');
      expect(row?.sourceSummary?.length ?? 0).toBeLessThan(longOriginal.length);
    });
  });

  describe('UserProfile 개인정보 최소화', () => {
    it('국적/출신국가/북한이탈주민 여부/자녀실명/주민등록번호 등의 필드를 정의하지 않는다', () => {
      const schema = readSchemaPrisma();
      const forbiddenPatterns = [
        /nationality/i,
        /countryOfOrigin/i,
        /northKorean/i,
        /defector/i,
        /childName/i,
        /realName/i,
        /residentRegistrationNumber/i,
        /주민등록번호/,
        /외국인등록번호/,
        /소득/,
      ];
      for (const pattern of forbiddenPatterns) {
        expect(schema).not.toMatch(pattern);
      }
    });
  });

  describe('사용자 간 데이터 격리 (Repository 계층)', () => {
    let ctx: Awaited<ReturnType<typeof buildTestApp>>;

    beforeAll(async () => {
      ctx = buildTestApp({ envOverrides: { DEV_USER_SUB: 'unused' } });
    });

    beforeEach(async () => {
      await cleanDatabase();
    });

    afterAll(async () => {
      await ctx.prisma.$disconnect();
    });

    it('사용자 A가 저장한 학교 할 일을 사용자 B는 조회할 수 없다', async () => {
      const repo = new PrismaSchoolTaskRepository(ctx.prisma);
      const created = await repo.createIfNotExists('user-a', {
        title: '사용자 A의 할 일',
        category: 'other',
        priority: 'normal',
        requiresSignature: false,
        requiresPayment: false,
        idempotencyKey: 'isolation-repo-1',
      });

      const bLookup = await repo.findActiveById('user-b', created.id);
      expect(bLookup).toBeNull();

      const bList = await repo.list('user-b', { status: 'all', limit: 50 });
      expect(bList.find((t) => t.id === created.id)).toBeUndefined();
    });

    it('사용자 A가 사용자 B의 할 일을 완료/삭제할 수 없다', async () => {
      const repo = new PrismaSchoolTaskRepository(ctx.prisma);
      const created = await repo.createIfNotExists('user-a-2', {
        title: '보호 대상 할 일',
        category: 'other',
        priority: 'normal',
        requiresSignature: false,
        requiresPayment: false,
        idempotencyKey: 'isolation-repo-2',
      });

      const completeAttempt = await repo.complete('user-b-2', created.id, new Date());
      expect(completeAttempt).toBeNull();

      const deleteAttempt = await repo.softDelete('user-b-2', created.id);
      expect(deleteAttempt).toBeNull();
    });

    it('사용자 A가 사용자 B의 프로필을 수정할 수 없다 (oauthSubject로 격리)', async () => {
      const repo = new PrismaUserProfileRepository(ctx.prisma);
      await repo.upsert('user-a-3', {
        preferredLanguageCode: 'vi',
        explanationLevel: 'standard',
        showEasyKorean: true,
        showOriginalText: true,
      });
      await repo.upsert('user-b-3', {
        preferredLanguageCode: 'ru',
        explanationLevel: 'easy',
        showEasyKorean: false,
        showOriginalText: false,
      });

      const profileA = await repo.findBySubject('user-a-3');
      const profileB = await repo.findBySubject('user-b-3');
      expect(profileA?.preferredLanguageCode).toBe('vi');
      expect(profileB?.preferredLanguageCode).toBe('ru');
    });

    it('soft delete된 task는 기본 조회에서 제외된다', async () => {
      const repo = new PrismaSchoolTaskRepository(ctx.prisma);
      const created = await repo.createIfNotExists('user-a-4', {
        title: '삭제될 할 일',
        category: 'other',
        priority: 'normal',
        requiresSignature: false,
        requiresPayment: false,
        idempotencyKey: 'isolation-repo-4',
      });
      await repo.softDelete('user-a-4', created.id);
      const list = await repo.list('user-a-4', { status: 'all', limit: 50 });
      expect(list.find((t) => t.id === created.id)).toBeUndefined();
    });
  });

  describe('AI Provider에 전달되는 데이터 최소화', () => {
    let ctx: Awaited<ReturnType<typeof buildTestApp>>;
    let client: RpcClient;
    let spy: SpyAiProvider;

    beforeAll(async () => {
      await cleanDatabase();
      spy = new SpyAiProvider();
      ctx = buildTestApp({ envOverrides: { DEV_USER_SUB: 'ai-privacy-user' }, aiProvider: spy });
      client = await startRpcClient(ctx.app);
    });

    afterAll(async () => {
      await client.close();
      await ctx.prisma.$disconnect();
    });

    it('AI Provider에 OAuth subject나 데이터베이스 ID를 전달하지 않는다', async () => {
      await client.callTool('analyze_notice', { notice_text: '준비물을 챙겨주세요.' });
      const call = spy.calls.find((c) => c.method === 'analyzeNotice');
      expect(call).toBeDefined();
      const inputKeys = Object.keys(call!.input as object);
      expect(inputKeys).not.toContain('userId');
      expect(inputKeys).not.toContain('oauthSubject');
      expect(inputKeys).not.toContain('sub');
      expect(JSON.stringify(call!.input)).not.toContain('ai-privacy-user');
    });

    it('AI Provider에 다른 할 일(task) 정보를 전달하지 않는다', async () => {
      await client.callTool('save_tasks', {
        tasks: [
          { title: '비공개 업무', category: 'other', priority: 'normal', requires_signature: false, requires_payment: false },
        ],
        idempotency_key: 'ai-privacy-task-1',
      });
      spy.calls.length = 0;
      await client.callTool('draft_teacher_message', {
        parent_input_text: '문의드립니다.',
        situation: 'other',
      });
      const call = spy.calls.find((c) => c.method === 'draftTeacherMessage');
      expect(JSON.stringify(call!.input)).not.toContain('비공개 업무');
    });
  });
});

function readSchemaPrisma(): string {
  const path = fileURLToPath(new URL('../../prisma/schema.prisma', import.meta.url));
  return readFileSync(path, 'utf8');
}
