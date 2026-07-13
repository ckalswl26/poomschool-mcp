import type {
  NoticeAnalysisResult,
  TeacherMessageResult,
  TermExplanationResult,
  TranslationResult,
} from './aiSchemas.js';

export type ExplanationMode = 'general' | 'multicultural_parent' | 'north_korean_parent';
export type ExplanationLevel = 'easy' | 'standard';

export interface AnalyzeNoticeInput {
  noticeText: string;
  childGrade?: number;
  parentLanguage: string;
  sourceLanguage: string; // BCP-47 or 'auto'
  explanationLevel: ExplanationLevel;
  explanationMode: ExplanationMode;
  includeTranslation: boolean;
}

export interface TranslateNoticeInput {
  noticeText: string;
  sourceLanguage: string;
  targetLanguage: string;
  includeEasyKorean: boolean;
  explanationMode: ExplanationMode;
}

export interface ExplainTermInput {
  term: string;
  context?: string;
  parentLanguage?: string;
  explanationLevel: ExplanationLevel;
  explanationMode: ExplanationMode;
}

export interface DraftTeacherMessageInput {
  parentInputText: string;
  inputLanguage: string;
  parentLanguage?: string;
  situation: string;
  childAlias?: string;
  tone: 'polite' | 'concise' | 'warm';
}

/**
 * AI Provider 추상화. 특정 모델에 종속되지 않도록 서비스 계층은 이 인터페이스만 사용한다.
 * 모든 구현체는 자유 형식 문자열이 아니라 검증된 구조화 결과를 반환해야 한다.
 */
export interface AiProvider {
  analyzeNotice(input: AnalyzeNoticeInput): Promise<NoticeAnalysisResult>;
  translateNotice(input: TranslateNoticeInput): Promise<TranslationResult>;
  explainSchoolTerm(input: ExplainTermInput): Promise<TermExplanationResult>;
  draftTeacherMessage(input: DraftTeacherMessageInput): Promise<TeacherMessageResult>;
}
