import type {
  AiProvider,
  AnalyzeNoticeInput,
  DraftTeacherMessageInput,
  ExplainTermInput,
  TranslateNoticeInput,
} from './AiProvider.js';
import type {
  NoticeAnalysisResult,
  TeacherMessageResult,
  TermExplanationResult,
  TranslationResult,
} from './aiSchemas.js';
import { detectLanguageHeuristically, resolveEffectiveLanguage } from '../languageDetectionService.js';
import { extractPreservedEntities, findBilingualSchoolTerms } from '../translationService.js';

const SITUATION_LABELS: Record<string, string> = {
  absence: '결석 안내',
  lateness: '지각 안내',
  early_leave: '조퇴 안내',
  health_notice: '건강 상태 안내',
  allergy_notice: '알레르기 안내',
  schedule_question: '일정 문의',
  material_question: '준비물 문의',
  counseling_request: '상담 요청',
  notice_question: '가정통신문 문의',
  relationship_concern: '교우 관계 관련 문의',
  payment_question: '비용 문의',
  after_school_question: '방과후학교 문의',
  other: '기타 문의',
};

const DEADLINE_HINT_REGEX = /(\d{1,2}월\s?\d{1,2}일|\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2})\s?까지/;

function mockAnnotateBilingualTerms(text: string, targetLanguage: string): string {
  let result = text;
  for (const term of findBilingualSchoolTerms(text)) {
    result = result.split(term).join(`${term}(${targetLanguage} 참고 표기 필요)`);
  }
  return result;
}

/**
 * 오프라인·결정적 Mock AI Provider.
 * 외부 네트워크를 호출하지 않으며 테스트와 로컬 개발 기본값으로 사용된다.
 * 규칙 기반 추출을 사용하므로 실제 서비스 품질을 대표하지 않는다.
 */
export class MockAiProvider implements AiProvider {
  async analyzeNotice(input: AnalyzeNoticeInput): Promise<NoticeAnalysisResult> {
    const text = input.noticeText;
    const heuristic = detectLanguageHeuristically(text);
    const detected = resolveEffectiveLanguage(
      input.sourceLanguage === 'auto' ? undefined : input.sourceLanguage,
      heuristic,
    );

    const hasApplicationForm = /신청서/.test(text);
    const hasConsentForm = /동의서|서명/.test(text);
    const hasPaymentWord = /납부|결제|입금/.test(text);
    const amounts = extractPreservedEntities(text).filter((e) => e.endsWith('원'));
    const deadlineMatch = text.match(DEADLINE_HINT_REGEX);
    const materialsMatch = text.match(/준비물\s*[:：]\s*([^\n]+)/);

    const parentTasks: NoticeAnalysisResult['parentTasks'] = [];
    if (hasApplicationForm) {
      parentTasks.push({
        title: '신청서를 작성합니다.',
        details: null,
        dueAt: null,
        requiresSignature: false,
        requiresPayment: false,
        category: 'application',
      });
    }
    if (hasConsentForm) {
      parentTasks.push({
        title: '동의서에 서명합니다.',
        details: null,
        dueAt: null,
        requiresSignature: true,
        requiresPayment: false,
        category: 'document',
      });
    }
    if (hasPaymentWord && amounts.length > 0) {
      parentTasks.push({
        title: '안내된 비용을 납부합니다.',
        details: amounts.join(', '),
        dueAt: null,
        requiresSignature: false,
        requiresPayment: true,
        category: 'payment',
      });
    }

    const childInformation: NoticeAnalysisResult['childInformation'] = [];
    if (materialsMatch) {
      childInformation.push({
        type: 'child_material',
        content: `아이가 다음 준비물을 챙기도록 알려주세요: ${materialsMatch[1]?.trim()}`,
      });
    }

    const materials = materialsMatch?.[1]
      ? materialsMatch[1]
          .split(/[,、]/)
          .map((m) => m.trim())
          .filter((m) => m.length > 0)
      : [];

    const costStatus: NoticeAnalysisResult['cost']['status'] = amounts.length > 0
      ? 'required'
      : /무료|비용\s*없음/.test(text)
        ? 'not_required'
        : 'unknown';

    const easyKoreanSummary =
      text.length > 120 ? `${text.slice(0, 120).trim()}... (요약)` : text.trim();

    let translatedSummary: string | null = null;
    if (input.includeTranslation && input.parentLanguage !== 'ko') {
      translatedSummary = `[${input.parentLanguage}] ${mockAnnotateBilingualTerms(easyKoreanSummary, input.parentLanguage)}`;
    }

    return {
      detectedLanguage: detected.language,
      languageConfidence: detected.confidence,
      purpose: hasApplicationForm ? '신청 또는 제출을 요청하는 학교 안내문입니다.' : '학교 생활과 관련된 안내문입니다.',
      easyKoreanSummary,
      parentTasks,
      childInformation,
      materials,
      cost: {
        status: costStatus,
        amount: null,
        currency: amounts.length > 0 ? 'KRW' : null,
        paymentMethod: hasPaymentWord ? '학교 안내 방식 확인 필요' : null,
        paymentDate: null,
      },
      submission: {
        recipient: hasApplicationForm || hasConsentForm ? '담임교사' : null,
        method: hasApplicationForm || hasConsentForm ? '서면 제출' : null,
        deadline: deadlineMatch ? deadlineMatch[1] ?? null : null,
      },
      applicationImpact: { status: 'unknown', content: null },
      unknowns: deadlineMatch ? [] : ['정확한 제출 마감일이 안내문에 명확히 표시되지 않았습니다.'],
      questionsForSchool: hasApplicationForm
        ? ['신청서 외에 추가로 제출해야 하는 서류가 있는지 확인 부탁드립니다.']
        : [],
      translatedSummary,
      targetLanguage: translatedSummary ? input.parentLanguage : null,
      confidence: 0.75,
    };
  }

  async translateNotice(input: TranslateNoticeInput): Promise<TranslationResult> {
    const heuristic = detectLanguageHeuristically(input.noticeText);
    const detected = resolveEffectiveLanguage(
      input.sourceLanguage === 'auto' ? undefined : input.sourceLanguage,
      heuristic,
    );
    const bilingualTerms = findBilingualSchoolTerms(input.noticeText).map((term) => ({
      term,
      note: '한국 학교 고유 제도명이므로 원문을 함께 표시합니다.',
    }));

    const easyKorean = input.includeEasyKorean
      ? mockAnnotateBilingualTerms(input.noticeText, 'ko-easy')
      : null;
    const translatedText = `[${input.targetLanguage}] ${mockAnnotateBilingualTerms(input.noticeText, input.targetLanguage)}`;

    return {
      detectedLanguage: detected.language,
      languageConfidence: detected.confidence,
      targetLanguage: input.targetLanguage,
      easyKorean,
      translatedText,
      originalText: input.noticeText,
      preservedEntities: extractPreservedEntities(input.noticeText),
      bilingualTerms,
      needsReviewPhrases: detected.confidence < 0.6 ? ['입력 언어 감지 신뢰도가 낮습니다.'] : [],
      translationConfidence: Math.min(0.85, detected.confidence + 0.1),
    };
  }

  async explainSchoolTerm(input: ExplainTermInput): Promise<TermExplanationResult> {
    const needsTranslation = !!input.parentLanguage && input.parentLanguage !== 'ko';

    // context가 주어지면(예: 사전 정의된 용어집 설명) 새로운 사실을 만들지 않고 해당 내용을 번역 표기한다.
    if (input.context) {
      return {
        easyMeaning: input.context,
        practicalExample: null,
        parentChecklist: [],
        parentActions: [],
        commonMisunderstandings: [],
        translatedExplanation: needsTranslation
          ? `[${input.parentLanguage}] ${mockAnnotateBilingualTerms(input.context, input.parentLanguage as string)}`
          : null,
        targetLanguage: needsTranslation ? (input.parentLanguage as string) : null,
        schoolConfirmationNeeded: [],
      };
    }

    return {
      easyMeaning: `"${input.term}"에 대한 사전 정보가 없어 정확한 설명을 제공하기 어렵습니다.`,
      practicalExample: null,
      parentChecklist: [],
      parentActions: ['학교(담임교사 또는 행정실)에 직접 문의해 정확한 의미를 확인해 주세요.'],
      commonMisunderstandings: [],
      translatedExplanation: needsTranslation ? `[${input.parentLanguage}] ${input.term}: 학교 확인 필요` : null,
      targetLanguage: needsTranslation ? (input.parentLanguage as string) : null,
      schoolConfirmationNeeded: [`${input.term}의 정확한 의미와 절차`],
    };
  }

  async draftTeacherMessage(input: DraftTeacherMessageInput): Promise<TeacherMessageResult> {
    const heuristic = detectLanguageHeuristically(input.parentInputText);
    const detected = resolveEffectiveLanguage(
      input.inputLanguage === 'auto' ? undefined : input.inputLanguage,
      heuristic,
    );
    const situationLabel = SITUATION_LABELS[input.situation] ?? SITUATION_LABELS.other;
    const childPart = input.childAlias ? `${input.childAlias} 학생과 관련하여 ` : '';

    const teacherMessageKorean = [
      '안녕하세요, 선생님.',
      '',
      `${childPart}${situationLabel}와 관련하여 아래와 같이 전달드립니다.`,
      '',
      `"${input.parentInputText.trim()}"`,
      '',
      '확인 부탁드립니다. 감사합니다.',
    ].join('\n');

    const plainKoreanMeaning = `보호자가 "${situationLabel}" 상황에 대해 전달한 원문입니다: "${input.parentInputText.trim()}"`;

    const ambiguousPoints: string[] = [];
    if (input.parentInputText.trim().length < 5) {
      ambiguousPoints.push('입력 내용이 매우 짧아 정확한 상황 파악이 어렵습니다.');
    }

    return {
      detectedLanguage: detected.language,
      languageConfidence: detected.confidence,
      plainKoreanMeaning,
      teacherMessageKorean,
      backTranslation: input.parentLanguage
        ? `[${input.parentLanguage} back-translation] ${plainKoreanMeaning}`
        : null,
      ambiguousPoints,
      followUpQuestions: [],
    };
  }
}
