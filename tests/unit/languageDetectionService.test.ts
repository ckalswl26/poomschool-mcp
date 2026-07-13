import { describe, expect, it } from 'vitest';
import { detectLanguageHeuristically, resolveEffectiveLanguage } from '../../src/services/languageDetectionService.js';
import { LOW_CONFIDENCE_THRESHOLD } from '../../src/config/constants.js';

describe('detectLanguageHeuristically', () => {
  it('한글 텍스트를 ko로 높은 신뢰도로 감지한다', () => {
    const result = detectLanguageHeuristically('안녕하세요 학부모님께 안내드립니다');
    expect(result.language).toBe('ko');
    expect(result.confidence).toBeGreaterThan(LOW_CONFIDENCE_THRESHOLD);
  });

  it('러시아어(키릴 문자)를 ru로 감지한다', () => {
    const result = detectLanguageHeuristically('Здравствуйте, уважаемые родители');
    expect(result.language).toBe('ru');
    expect(result.confidence).toBeGreaterThan(LOW_CONFIDENCE_THRESHOLD);
  });

  it('중국어(한자)를 zh-CN으로 감지한다', () => {
    const result = detectLanguageHeuristically('您好，我是学生的家长');
    expect(result.language).toBe('zh-CN');
  });

  it('라틴 문자만 있는 모호한 텍스트는 낮은 신뢰도를 반환한다', () => {
    const result = detectLanguageHeuristically('hello teacher how are you');
    expect(result.confidence).toBeLessThan(LOW_CONFIDENCE_THRESHOLD);
  });

  it('빈 문자열은 신뢰도 0을 반환한다', () => {
    const result = detectLanguageHeuristically('');
    expect(result.confidence).toBe(0);
  });
});

describe('resolveEffectiveLanguage', () => {
  it('사용자가 언어를 지정하면 감지 결과보다 우선한다', () => {
    const detected = { language: 'en', confidence: 0.4 };
    const resolved = resolveEffectiveLanguage('vi', detected);
    expect(resolved.language).toBe('vi');
    expect(resolved.confidence).toBe(1);
  });

  it('사용자가 지정하지 않으면 감지 결과를 사용한다', () => {
    const detected = { language: 'ko', confidence: 0.9 };
    const resolved = resolveEffectiveLanguage(undefined, detected);
    expect(resolved).toEqual(detected);
  });
});
