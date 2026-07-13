import type { AiProvider, AnalyzeNoticeInput } from './ai/AiProvider.js';
import type { NoticeAnalysisResult } from './ai/aiSchemas.js';
import { noticeAnalysisResultSchema } from './ai/aiSchemas.js';
import type { AnalysisCacheRepository } from '../database/repositories/analysisCacheRepository.js';
import { sha256Hex } from '../utils/hashing.js';

export interface AnalyzeNoticeServiceParams extends AnalyzeNoticeInput {
  userId: string;
}

export interface AnalyzeNoticeServiceDeps {
  aiProvider: AiProvider;
  cacheRepository: AnalysisCacheRepository;
  cacheEnabled: boolean;
  cacheTtlSeconds: number;
}

function buildContentHash(params: AnalyzeNoticeServiceParams): string {
  const key = JSON.stringify({
    text: params.noticeText,
    grade: params.childGrade ?? null,
    level: params.explanationLevel,
    mode: params.explanationMode,
    includeTranslation: params.includeTranslation,
    sourceLanguage: params.sourceLanguage,
  });
  return sha256Hex(key);
}

/**
 * 안내문 분석 오케스트레이션: 사용자 단위 캐시 확인 → 캐시 미스 시 AI 호출(1회) → 캐시 저장.
 * 캐시에는 원문(notice_text)을 저장하지 않고 해시와 결과만 저장한다.
 */
export async function analyzeNoticeWithCache(
  deps: AnalyzeNoticeServiceDeps,
  params: AnalyzeNoticeServiceParams,
): Promise<NoticeAnalysisResult> {
  const contentHash = buildContentHash(params);
  const targetLanguage = params.parentLanguage;
  const explanationLevel = params.explanationLevel ?? 'standard';

  if (deps.cacheEnabled) {
    const cached = await deps.cacheRepository.get({
      userId: params.userId,
      contentHash,
      targetLanguage,
      explanationLevel,
    });
    if (cached) {
      const parsed = noticeAnalysisResultSchema.safeParse(JSON.parse(cached));
      if (parsed.success) return parsed.data;
    }
  }

  // userId는 캐시 격리에만 사용하고 AI Provider에는 전달하지 않는다.
  const { userId: _userId, ...aiInput } = params;
  const result = await deps.aiProvider.analyzeNotice(aiInput);

  if (deps.cacheEnabled) {
    await deps.cacheRepository.set({
      userId: params.userId,
      contentHash,
      targetLanguage,
      explanationLevel,
      resultJson: JSON.stringify(result),
      expiresAt: new Date(Date.now() + deps.cacheTtlSeconds * 1000),
    });
  }

  return result;
}
