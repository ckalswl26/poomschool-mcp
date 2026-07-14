import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type GoogleGenAI } from '@google/genai';
import { AppError } from '../../src/errors/AppError.js';
import { createLogger } from '../../src/config/logger.js';

const generateContentMock = vi.fn();

vi.mock('@google/genai', async (importOriginal) => {
  const actual = await importOriginal<{ ApiError: typeof ApiError; GoogleGenAI: typeof GoogleGenAI }>();
  return {
    ...actual,
    GoogleGenAI: vi.fn().mockImplementation(function GoogleGenAI() {
      return { models: { generateContent: generateContentMock } };
    }),
  };
});

const { GeminiAiProvider } = await import('../../src/services/ai/GeminiAiProvider.js');

const logger = createLogger({ LOG_LEVEL: 'silent', NODE_ENV: 'test' } as never);

const VALID_TERM_JSON = JSON.stringify({
  easyMeaning: '쉬운 뜻입니다',
  practicalExample: null,
  parentChecklist: [],
  parentActions: [],
  commonMisunderstandings: [],
  translatedExplanation: null,
  targetLanguage: null,
  schoolConfirmationNeeded: [],
});

describe('GeminiAiProvider (@google/genai를 모킹하며, 실제 네트워크는 호출하지 않음)', () => {
  beforeEach(() => {
    generateContentMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function buildProvider(timeoutMs = 2500) {
    return new GeminiAiProvider({ apiKey: 'test-key', model: 'gemini-2.5-flash', timeoutMs, logger });
  }

  it('첫 응답이 스키마 검증을 통과하면 그대로 반환한다', async () => {
    generateContentMock.mockResolvedValueOnce({ text: VALID_TERM_JSON });
    const provider = buildProvider();
    const result = await provider.explainSchoolTerm({
      term: '스쿨뱅킹',
      explanationLevel: 'standard',
      explanationMode: 'general',
    });
    expect(result.easyMeaning).toBe('쉬운 뜻입니다');
    expect(generateContentMock).toHaveBeenCalledTimes(1);
  });

  it('첫 응답이 검증에 실패하면 1회 복구를 시도하고 성공하면 반환한다', async () => {
    generateContentMock
      .mockResolvedValueOnce({ text: '이것은 JSON이 아닙니다' })
      .mockResolvedValueOnce({ text: VALID_TERM_JSON });
    const provider = buildProvider();
    const result = await provider.explainSchoolTerm({
      term: '스쿨뱅킹',
      explanationLevel: 'standard',
      explanationMode: 'general',
    });
    expect(result.easyMeaning).toBe('쉬운 뜻입니다');
    expect(generateContentMock).toHaveBeenCalledTimes(2);
  });

  it('복구 시도도 실패하면 AI_VALIDATION_FAILED AppError를 던지고 원본을 노출하지 않는다', async () => {
    generateContentMock
      .mockResolvedValueOnce({ text: '여전히 JSON이 아닙니다' })
      .mockResolvedValueOnce({ text: '두번째도 실패' });
    const provider = buildProvider();
    await expect(
      provider.explainSchoolTerm({ term: '스쿨뱅킹', explanationLevel: 'standard', explanationMode: 'general' }),
    ).rejects.toMatchObject({ code: 'AI_VALIDATION_FAILED' });
    expect(generateContentMock).toHaveBeenCalledTimes(2);
  });

  it('HTTP 오류 응답은 AI_UNAVAILABLE로 변환되고 내부 상태 코드를 노출하지 않는다', async () => {
    generateContentMock.mockRejectedValueOnce(new ApiError({ message: 'server error', status: 500 }));
    const provider = buildProvider();
    const error = await provider
      .explainSchoolTerm({ term: '스쿨뱅킹', explanationLevel: 'standard', explanationMode: 'general' })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('AI_UNAVAILABLE');
  });

  it('429 응답은 RATE_LIMITED AppError와 한국어 안내로 변환된다', async () => {
    generateContentMock.mockRejectedValueOnce(new ApiError({ message: 'rate limited', status: 429 }));
    const provider = buildProvider();
    const error = await provider
      .explainSchoolTerm({ term: '스쿨뱅킹', explanationLevel: 'standard', explanationMode: 'general' })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('RATE_LIMITED');
    expect((error as AppError).userMessage).toContain('잠시 후 다시 시도');
  });

  it('타임아웃 시 AI_TIMEOUT AppError를 던진다', async () => {
    generateContentMock.mockImplementationOnce((params: { config: { abortSignal: AbortSignal } }) => {
      return new Promise((_resolve, reject) => {
        params.config.abortSignal.addEventListener('abort', () => {
          const err = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });
    const provider = buildProvider(50);
    const error = await provider
      .explainSchoolTerm({ term: '스쿨뱅킹', explanationLevel: 'standard', explanationMode: 'general' })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('AI_TIMEOUT');
  });
});
