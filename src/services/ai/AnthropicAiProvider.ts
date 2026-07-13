import type { z } from 'zod';
import type {
  AiProvider,
  AnalyzeNoticeInput,
  DraftTeacherMessageInput,
  ExplainTermInput,
  TranslateNoticeInput,
} from './AiProvider.js';
import {
  noticeAnalysisResultSchema,
  teacherMessageResultSchema,
  termExplanationResultSchema,
  translationResultSchema,
  type NoticeAnalysisResult,
  type TeacherMessageResult,
  type TermExplanationResult,
  type TranslationResult,
} from './aiSchemas.js';
import { AppError } from '../../errors/AppError.js';
import type { AppLogger } from '../../config/logger.js';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_API_VERSION = '2023-06-01';
const MAX_OUTPUT_TOKENS = 2000;

/**
 * PoomSchool(품스쿨) AI 시스템 프롬프트 원칙 (섹션 11).
 * 대상은 아이가 아니라 초등학생 자녀를 둔 부모이며, 사실 생성 금지·불확실성 표시·
 * 의무/선택 구분·비용 없음과 미확인 구분 등의 규칙을 명시한다.
 */
const SYSTEM_PRINCIPLES = `당신은 PoomSchool(품스쿨)의 학교 안내 분석 보조자입니다.
대상은 초등학생이 아니라 초등학생 자녀를 둔 부모입니다. 쉬운 한국어를 사용하고,
아이에게 부모 대신 통역이나 행정 처리를 요구하지 않습니다.
다음 규칙을 반드시 지키세요.
- 안내문/입력에 없는 사실을 생성하지 않습니다.
- 날짜, 시간, 금액, 전화번호, URL, 사람 이름, 학교명을 임의로 바꾸지 않습니다.
- 신청 자격이나 지원 결과를 확정하지 않습니다.
- 질병, 장애, 심리상태, 가정환경, 국적, 출신 배경, 북한이탈주민 여부를 추론하지 않습니다.
- 불확실한 내용은 "학교 확인 필요"로 분류합니다.
- 의무사항과 선택사항을 구분합니다.
- 비용 없음(not_required)과 비용 미확인(unknown)을 구분합니다.
- 부모가 해야 할 일과 아이 준비사항을 구분합니다.
- 번역 시 새로운 내용을 추가하지 않고, 날짜/금액/URL/전화번호/한국 학교 고유 제도명(원문 병기)을 보존합니다.
- 번역 신뢰도가 낮으면 확인을 요청합니다.
- 결과는 간결하게 작성하고 빈 항목은 만들지 않습니다.
- 광고나 서비스 홍보 문구를 포함하지 않습니다.
- 반드시 지정된 JSON 스키마 형식으로만 응답하고, 다른 텍스트는 포함하지 않습니다.`;

export interface AnthropicProviderOptions {
  apiKey: string;
  model: string;
  timeoutMs: number;
  logger: AppLogger;
}

async function callAnthropicRaw(
  options: AnthropicProviderOptions,
  userPrompt: string,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': options.apiKey,
        'anthropic-version': ANTHROPIC_API_VERSION,
      },
      body: JSON.stringify({
        model: options.model,
        max_tokens: MAX_OUTPUT_TOKENS,
        temperature: 0,
        system: SYSTEM_PRINCIPLES,
        messages: [{ role: 'user', content: userPrompt }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      options.logger.error({ status: response.status }, 'anthropic_http_error');
      throw new AppError(
        'AI_UNAVAILABLE',
        'AI 서비스에 일시적으로 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.',
      );
    }

    const body = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = body.content?.find((block) => block.type === 'text')?.text;
    if (!text) {
      throw new AppError(
        'AI_VALIDATION_FAILED',
        'AI 응답을 해석할 수 없습니다. 안내문을 조금 줄여 다시 시도해 주세요.',
      );
    }
    return text;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AppError(
        'AI_TIMEOUT',
        '학교 안내를 분석하는 데 시간이 오래 걸리고 있습니다. 안내문을 조금 줄여 다시 시도해 주세요.',
      );
    }
    options.logger.error({ err: error instanceof Error ? error.message : String(error) }, 'anthropic_call_failed');
    throw new AppError(
      'AI_UNAVAILABLE',
      'AI 서비스에 일시적으로 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.',
    );
  } finally {
    clearTimeout(timer);
  }
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  const candidate = start >= 0 && end >= start ? trimmed.slice(start, end + 1) : trimmed;
  return JSON.parse(candidate);
}

/**
 * JSON을 파싱하고 Zod 스키마로 검증한다. 실패 시 최대 1회의 구조 복구 요청만 허용하고,
 * 그래도 실패하면 검증되지 않은 결과를 노출하지 않고 안전한 오류를 던진다.
 */
async function callAndValidate<T>(
  options: AnthropicProviderOptions,
  userPrompt: string,
  schema: z.ZodType<T>,
): Promise<T> {
  const firstText = await callAnthropicRaw(options, userPrompt);
  try {
    return schema.parse(extractJson(firstText));
  } catch (firstError) {
    options.logger.warn({ err: String(firstError) }, 'ai_schema_validation_retry');
    const repairPrompt = `이전 응답이 JSON 스키마 검증에 실패했습니다. 다른 설명 없이 유효한 JSON만 다시 출력하세요.\n\n이전 응답:\n${firstText}`;
    const secondText = await callAnthropicRaw(options, repairPrompt);
    try {
      return schema.parse(extractJson(secondText));
    } catch (secondError) {
      options.logger.error({ err: String(secondError) }, 'ai_schema_validation_failed');
      throw new AppError(
        'AI_VALIDATION_FAILED',
        'AI 응답을 안전하게 검증하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      );
    }
  }
}

export class AnthropicAiProvider implements AiProvider {
  constructor(private readonly options: AnthropicProviderOptions) {}

  async analyzeNotice(input: AnalyzeNoticeInput): Promise<NoticeAnalysisResult> {
    const prompt = `다음 한국 초등학교 가정통신문을 분석해 지정된 JSON 스키마로만 응답하세요.

[스키마 필드]
detectedLanguage, languageConfidence(0~1), purpose, easyKoreanSummary,
parentTasks[{title, details, dueAt, requiresSignature, requiresPayment, category}],
childInformation[{type: tell_child|prepare_for_child|child_material, content}],
materials[], cost{status: required|not_required|unknown, amount, currency, paymentMethod, paymentDate},
submission{recipient, method, deadline}, applicationImpact{status: stated|unknown, content},
unknowns[], questionsForSchool[], translatedSummary, targetLanguage, confidence(0~1)

[설명 모드] ${input.explanationMode}
[학년] ${input.childGrade ?? '알 수 없음'}
[부모 언어] ${input.parentLanguage}
[번역 포함 여부] ${input.includeTranslation}

[안내문 원문]
${input.noticeText}`;
    return callAndValidate(this.options, prompt, noticeAnalysisResultSchema);
  }

  async translateNotice(input: TranslateNoticeInput): Promise<TranslationResult> {
    const prompt = `다음 한국 초등학교 안내문을 번역하세요. 지정된 JSON 스키마로만 응답하세요.

[스키마 필드]
detectedLanguage, languageConfidence(0~1), targetLanguage, easyKorean, translatedText,
originalText, preservedEntities[], bilingualTerms[{term, note}], needsReviewPhrases[], translationConfidence(0~1)

[목표 언어] ${input.targetLanguage}
[쉬운 한국어 포함] ${input.includeEasyKorean}
[설명 모드] ${input.explanationMode}

[원문]
${input.noticeText}`;
    const result = await callAndValidate(this.options, prompt, translationResultSchema);
    return { ...result, originalText: input.noticeText };
  }

  async explainSchoolTerm(input: ExplainTermInput): Promise<TermExplanationResult> {
    const prompt = `한국 초등학교 용어 "${input.term}"을 부모에게 설명하세요. 지정된 JSON 스키마로만 응답하세요.

[스키마 필드]
easyMeaning, practicalExample, parentChecklist[], parentActions[], commonMisunderstandings[],
translatedExplanation, targetLanguage, schoolConfirmationNeeded[]

[문맥] ${input.context ?? '없음'}
[설명 수준] ${input.explanationLevel}
[설명 모드] ${input.explanationMode}
[부모 언어] ${input.parentLanguage ?? 'ko'}`;
    return callAndValidate(this.options, prompt, termExplanationResultSchema);
  }

  async draftTeacherMessage(input: DraftTeacherMessageInput): Promise<TeacherMessageResult> {
    const prompt = `보호자가 입력한 내용을 담임교사에게 보낼 정중한 한국어 메시지로 변환하세요.
입력에 없는 사실을 추가하지 마세요. 지정된 JSON 스키마로만 응답하세요.

[스키마 필드]
detectedLanguage, languageConfidence(0~1), plainKoreanMeaning, teacherMessageKorean,
backTranslation, ambiguousPoints[], followUpQuestions[]

[상황] ${input.situation}
[어조] ${input.tone}
[아이 별칭] ${input.childAlias ?? '없음'}
[역번역 대상 언어] ${input.parentLanguage ?? '입력 언어와 동일'}

[보호자 입력]
${input.parentInputText}`;
    return callAndValidate(this.options, prompt, teacherMessageResultSchema);
  }
}
