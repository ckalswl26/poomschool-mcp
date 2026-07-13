import type { AiProvider, DraftTeacherMessageInput } from './ai/AiProvider.js';
import type { TeacherMessageResult } from './ai/aiSchemas.js';
import { detectLanguageHeuristically, resolveEffectiveLanguage } from './languageDetectionService.js';

export interface DraftTeacherMessageParams extends DraftTeacherMessageInput {
  includeBackTranslation: boolean;
}

/**
 * 담임교사 메시지 초안 오케스트레이션.
 * 입력 언어를 우선 감지한 뒤 AI Provider를 1회 호출하고, 자동 전송은 하지 않는다.
 */
export async function draftTeacherMessageWithDetection(
  aiProvider: AiProvider,
  params: DraftTeacherMessageParams,
): Promise<TeacherMessageResult> {
  const heuristic = detectLanguageHeuristically(params.parentInputText);
  const resolved = resolveEffectiveLanguage(
    params.inputLanguage === 'auto' ? undefined : params.inputLanguage,
    heuristic,
  );

  const result = await aiProvider.draftTeacherMessage({
    ...params,
    inputLanguage: resolved.language,
    parentLanguage: params.parentLanguage ?? resolved.language,
  });

  return {
    ...result,
    detectedLanguage: resolved.language,
    languageConfidence: resolved.confidence,
    backTranslation: params.includeBackTranslation ? result.backTranslation : null,
  };
}
