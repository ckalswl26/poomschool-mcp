import type { AiProvider, ExplanationMode } from './ai/AiProvider.js';
import type { TranslationResult } from './ai/aiSchemas.js';
import { detectLanguageHeuristically, resolveEffectiveLanguage } from './languageDetectionService.js';
import { listGlossaryTerms } from './schoolGlossaryService.js';
import { LOW_CONFIDENCE_THRESHOLD } from '../config/constants.js';

const DATE_REGEX = /\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}|\d{1,2}월\s?\d{1,2}일/g;
const AMOUNT_REGEX = /\d{1,3}(,\d{3})*원|\d+원/g;
const PHONE_REGEX = /0\d{1,2}-\d{3,4}-\d{4}/g;
const URL_REGEX = /https?:\/\/[^\s)]+/g;

export function extractPreservedEntities(text: string): string[] {
  const found = new Set<string>();
  for (const regex of [DATE_REGEX, AMOUNT_REGEX, PHONE_REGEX, URL_REGEX]) {
    const matches = text.match(regex) ?? [];
    matches.forEach((m) => found.add(m));
  }
  return [...found];
}

export function findBilingualSchoolTerms(text: string): string[] {
  return listGlossaryTerms().filter((term) => text.includes(term));
}

export interface TranslateNoticeParams {
  noticeText: string;
  sourceLanguage: string; // BCP-47 or 'auto'
  targetLanguage: string;
  includeEasyKorean: boolean;
  explanationMode: ExplanationMode;
}

/**
 * 번역 오케스트레이션: 언어 감지 → AI 번역 → 원문 보존 요소 검증.
 * AI 결과가 날짜/금액/URL/전화번호를 훼손했다면 신뢰도를 낮추고 확인 문구를 추가한다.
 */
export async function translateNoticeWithSafetyNet(
  aiProvider: AiProvider,
  params: TranslateNoticeParams,
): Promise<TranslationResult> {
  const heuristic = detectLanguageHeuristically(params.noticeText);
  const resolved = resolveEffectiveLanguage(
    params.sourceLanguage === 'auto' ? undefined : params.sourceLanguage,
    heuristic,
  );

  const result = await aiProvider.translateNotice({
    noticeText: params.noticeText,
    sourceLanguage: resolved.language,
    targetLanguage: params.targetLanguage,
    includeEasyKorean: params.includeEasyKorean,
    explanationMode: params.explanationMode,
  });

  const requiredEntities = extractPreservedEntities(params.noticeText);
  const missingEntities = requiredEntities.filter(
    (entity) => !(result.translatedText ?? '').includes(entity) && !(result.easyKorean ?? '').includes(entity),
  );

  const needsReview = [...result.needsReviewPhrases];
  let confidence = result.translationConfidence;

  if (missingEntities.length > 0) {
    needsReview.push('원문의 날짜/금액/연락처 일부가 번역문에서 확인되지 않아 원문을 함께 확인해야 합니다.');
    confidence = Math.min(confidence, LOW_CONFIDENCE_THRESHOLD - 0.01);
  }
  if (resolved.confidence < LOW_CONFIDENCE_THRESHOLD && params.sourceLanguage === 'auto') {
    needsReview.push('입력 언어 감지 신뢰도가 낮습니다. 사용하신 언어를 직접 선택해 주세요.');
  }

  return {
    ...result,
    detectedLanguage: resolved.language,
    languageConfidence: resolved.confidence,
    preservedEntities: requiredEntities,
    needsReviewPhrases: [...new Set(needsReview)],
    translationConfidence: confidence,
  };
}
