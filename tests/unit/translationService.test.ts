import { describe, expect, it } from 'vitest';
import { extractPreservedEntities, findBilingualSchoolTerms, translateNoticeWithSafetyNet } from '../../src/services/translationService.js';
import { MockAiProvider } from '../../src/services/ai/MockAiProvider.js';

describe('extractPreservedEntities', () => {
  it('날짜, 금액, 전화번호, URL을 추출한다', () => {
    const text = '7월 20일까지 30,000원을 010-1234-5678로 문의하거나 https://school.example.com 참고';
    const entities = extractPreservedEntities(text);
    expect(entities).toContain('7월 20일');
    expect(entities).toContain('30,000원');
    expect(entities).toContain('010-1234-5678');
    expect(entities).toContain('https://school.example.com');
  });

  it('보존할 요소가 없으면 빈 배열을 반환한다', () => {
    expect(extractPreservedEntities('안내문입니다')).toEqual([]);
  });
});

describe('findBilingualSchoolTerms', () => {
  it('한국 학교 고유 제도명을 찾는다', () => {
    const terms = findBilingualSchoolTerms('스쿨뱅킹으로 방과후학교 수강료를 납부하세요');
    expect(terms).toContain('스쿨뱅킹');
    expect(terms).toContain('방과후학교');
  });
});

describe('translateNoticeWithSafetyNet', () => {
  const aiProvider = new MockAiProvider();

  it('날짜/금액이 번역 결과에서 유지되는지 검증하고 preservedEntities를 채운다', async () => {
    const result = await translateNoticeWithSafetyNet(aiProvider, {
      noticeText: '7월 20일까지 30,000원을 납부하세요.',
      sourceLanguage: 'ko',
      targetLanguage: 'vi',
      includeEasyKorean: true,
      explanationMode: 'general',
    });
    expect(result.preservedEntities).toContain('7월 20일');
    expect(result.preservedEntities).toContain('30,000원');
    expect(result.translatedText).toContain('7월 20일');
    expect(result.translatedText).toContain('30,000원');
  });

  it('언어 자동 감지 신뢰도가 낮으면 확인 요청 문구를 추가한다', async () => {
    const result = await translateNoticeWithSafetyNet(aiProvider, {
      noticeText: 'hello there teacher',
      sourceLanguage: 'auto',
      targetLanguage: 'en',
      includeEasyKorean: false,
      explanationMode: 'general',
    });
    expect(result.needsReviewPhrases.some((p) => p.includes('신뢰도'))).toBe(true);
  });
});
