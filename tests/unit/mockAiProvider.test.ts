import { describe, expect, it } from 'vitest';
import { MockAiProvider } from '../../src/services/ai/MockAiProvider.js';
import {
  noticeAnalysisResultSchema,
  teacherMessageResultSchema,
  termExplanationResultSchema,
  translationResultSchema,
} from '../../src/services/ai/aiSchemas.js';

describe('MockAiProvider', () => {
  const provider = new MockAiProvider();

  it('analyzeNotice 결과가 스키마를 통과하고 날짜를 보존한다', async () => {
    const result = await provider.analyzeNotice({
      noticeText: '방과후학교 신청서를 7월 20일까지 제출하세요. 동의서에 서명해주세요.',
      parentLanguage: 'ko',
      sourceLanguage: 'auto',
      explanationLevel: 'standard',
      explanationMode: 'general',
      includeTranslation: false,
    });
    expect(() => noticeAnalysisResultSchema.parse(result)).not.toThrow();
    expect(result.submission.deadline).toContain('7월 20일');
    expect(result.parentTasks.some((t) => t.requiresSignature)).toBe(true);
  });

  it('비용 없음과 비용 미확인을 구분한다', async () => {
    const unknownCost = await provider.analyzeNotice({
      noticeText: '알림장을 확인해주세요.',
      parentLanguage: 'ko',
      sourceLanguage: 'auto',
      explanationLevel: 'standard',
      explanationMode: 'general',
      includeTranslation: false,
    });
    expect(unknownCost.cost.status).toBe('unknown');

    const notRequired = await provider.analyzeNotice({
      noticeText: '이번 체험학습은 비용 없음으로 진행됩니다.',
      parentLanguage: 'ko',
      sourceLanguage: 'auto',
      explanationLevel: 'standard',
      explanationMode: 'general',
      includeTranslation: false,
    });
    expect(notRequired.cost.status).toBe('not_required');
  });

  it('translateNotice 결과가 스키마를 통과한다', async () => {
    const result = await provider.translateNotice({
      noticeText: '스쿨뱅킹으로 30,000원을 납부하세요.',
      sourceLanguage: 'ko',
      targetLanguage: 'vi',
      includeEasyKorean: true,
      explanationMode: 'general',
    });
    expect(() => translationResultSchema.parse(result)).not.toThrow();
    expect(result.bilingualTerms.some((t) => t.term === '스쿨뱅킹')).toBe(true);
  });

  it('explainSchoolTerm은 정보가 없는 임의 용어에 대해 사실을 지어내지 않는다', async () => {
    const result = await provider.explainSchoolTerm({
      term: '존재하지않는용어XYZ',
      explanationLevel: 'standard',
      explanationMode: 'general',
    });
    expect(() => termExplanationResultSchema.parse(result)).not.toThrow();
    expect(result.easyMeaning).toContain('정보가 없어');
    expect(result.schoolConfirmationNeeded.length).toBeGreaterThan(0);
  });

  it('draftTeacherMessage는 부모 입력에 없는 사실을 추가하지 않고 자동 전송 문구가 없다', async () => {
    const parentInput = '아이가 어제부터 열이 나서 오늘 결석합니다.';
    const result = await provider.draftTeacherMessage({
      parentInputText: parentInput,
      inputLanguage: 'ko',
      situation: 'absence',
      tone: 'polite',
    });
    expect(() => teacherMessageResultSchema.parse(result)).not.toThrow();
    expect(result.teacherMessageKorean).toContain(parentInput);
    expect(result.plainKoreanMeaning).toContain(parentInput);
  });
});
