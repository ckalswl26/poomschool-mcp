import type {
  AiProvider,
  AnalyzeNoticeInput,
  DraftTeacherMessageInput,
  ExplainTermInput,
  TranslateNoticeInput,
} from '../../src/services/ai/AiProvider.js';
import { MockAiProvider } from '../../src/services/ai/MockAiProvider.js';

/** AI Provider에 실제로 전달되는 입력을 기록해 개인정보 최소화 여부를 검증하기 위한 테스트 더블. */
export class SpyAiProvider implements AiProvider {
  readonly calls: { method: string; input: unknown }[] = [];
  private readonly delegate = new MockAiProvider();

  async analyzeNotice(input: AnalyzeNoticeInput) {
    this.calls.push({ method: 'analyzeNotice', input });
    return this.delegate.analyzeNotice(input);
  }

  async translateNotice(input: TranslateNoticeInput) {
    this.calls.push({ method: 'translateNotice', input });
    return this.delegate.translateNotice(input);
  }

  async explainSchoolTerm(input: ExplainTermInput) {
    this.calls.push({ method: 'explainSchoolTerm', input });
    return this.delegate.explainSchoolTerm(input);
  }

  async draftTeacherMessage(input: DraftTeacherMessageInput) {
    this.calls.push({ method: 'draftTeacherMessage', input });
    return this.delegate.draftTeacherMessage(input);
  }
}
