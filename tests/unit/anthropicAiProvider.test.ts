import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnthropicAiProvider } from '../../src/services/ai/AnthropicAiProvider.js';
import { AppError } from '../../src/errors/AppError.js';
import { createLogger } from '../../src/config/logger.js';

const logger = createLogger({ LOG_LEVEL: 'silent', NODE_ENV: 'test' } as never);

function jsonResponse(text: string, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => ({ content: [{ type: 'text', text }] }),
  } as unknown as Response;
}

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

describe('AnthropicAiProvider (fetch를 모킹하며, 실제 네트워크는 호출하지 않음)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function buildProvider(timeoutMs = 2500): AnthropicAiProvider {
    return new AnthropicAiProvider({ apiKey: 'test-key', model: 'test-model', timeoutMs, logger });
  }

  it('첫 응답이 스키마 검증을 통과하면 그대로 반환한다', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(VALID_TERM_JSON));
    const provider = buildProvider();
    const result = await provider.explainSchoolTerm({
      term: '스쿨뱅킹',
      explanationLevel: 'standard',
      explanationMode: 'general',
    });
    expect(result.easyMeaning).toBe('쉬운 뜻입니다');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('첫 응답이 검증에 실패하면 1회 복구를 시도하고 성공하면 반환한다', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse('이것은 JSON이 아닙니다'))
      .mockResolvedValueOnce(jsonResponse(VALID_TERM_JSON));
    const provider = buildProvider();
    const result = await provider.explainSchoolTerm({
      term: '스쿨뱅킹',
      explanationLevel: 'standard',
      explanationMode: 'general',
    });
    expect(result.easyMeaning).toBe('쉬운 뜻입니다');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('복구 시도도 실패하면 AI_VALIDATION_FAILED AppError를 던지고 원본을 노출하지 않는다', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse('여전히 JSON이 아닙니다'))
      .mockResolvedValueOnce(jsonResponse('두번째도 실패'));
    const provider = buildProvider();
    await expect(
      provider.explainSchoolTerm({ term: '스쿨뱅킹', explanationLevel: 'standard', explanationMode: 'general' }),
    ).rejects.toMatchObject({ code: 'AI_VALIDATION_FAILED' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('HTTP 오류 응답은 AI_UNAVAILABLE로 변환되고 내부 상태 코드를 노출하지 않는다', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse('', false, 500));
    const provider = buildProvider();
    const error = await provider
      .explainSchoolTerm({ term: '스쿨뱅킹', explanationLevel: 'standard', explanationMode: 'general' })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('AI_UNAVAILABLE');
  });

  it('타임아웃 시 AI_TIMEOUT AppError를 던진다', async () => {
    fetchMock.mockImplementationOnce((_url: string, init: { signal: AbortSignal }) => {
      return new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
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
