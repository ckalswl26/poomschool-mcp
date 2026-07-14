import { ApiError, GoogleGenAI } from '@google/genai';
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
import { MAX_OUTPUT_TOKENS, SYSTEM_PRINCIPLES } from './aiPromptConstants.js';
import { parseWithOneRetry } from './jsonRetryValidation.js';

export interface GeminiProviderOptions {
  apiKey: string;
  model: string;
  timeoutMs: number;
  logger: AppLogger;
}

async function callGeminiRaw(options: GeminiProviderOptions, userPrompt: string): Promise<string> {
  const client = new GoogleGenAI({ apiKey: options.apiKey });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const response = await client.models.generateContent({
      model: options.model,
      contents: userPrompt,
      config: {
        systemInstruction: SYSTEM_PRINCIPLES,
        temperature: 0,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        abortSignal: controller.signal,
      },
    });

    const text = response.text;
    if (!text) {
      throw new AppError(
        'AI_VALIDATION_FAILED',
        'AI 응답을 해석할 수 없습니다. 안내문을 조금 줄여 다시 시도해 주세요.',
      );
    }
    return text;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof ApiError && error.status === 429) {
      options.logger.error({ status: error.status }, 'gemini_rate_limited');
      throw new AppError(
        'RATE_LIMITED',
        'AI 서비스 요청이 너무 많아 일시적으로 제한되었습니다. 잠시 후 다시 시도해 주세요.',
      );
    }
    if (error instanceof ApiError) {
      options.logger.error({ status: error.status }, 'gemini_http_error');
      throw new AppError(
        'AI_UNAVAILABLE',
        'AI 서비스에 일시적으로 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.',
      );
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AppError(
        'AI_TIMEOUT',
        '학교 안내를 분석하는 데 시간이 오래 걸리고 있습니다. 안내문을 조금 줄여 다시 시도해 주세요.',
      );
    }
    options.logger.error({ err: error instanceof Error ? error.message : String(error) }, 'gemini_call_failed');
    throw new AppError(
      'AI_UNAVAILABLE',
      'AI 서비스에 일시적으로 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.',
    );
  } finally {
    clearTimeout(timer);
  }
}

async function callAndValidate<T>(
  options: GeminiProviderOptions,
  userPrompt: string,
  schema: z.ZodType<T>,
): Promise<T> {
  const firstText = await callGeminiRaw(options, userPrompt);
  return parseWithOneRetry(firstText, schema, options.logger, (repairPrompt) =>
    callGeminiRaw(options, repairPrompt),
  );
}

export class GeminiAiProvider implements AiProvider {
  constructor(private readonly options: GeminiProviderOptions) {}

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
