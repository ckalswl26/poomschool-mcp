import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { translateNoticeInputShape } from '../schemas/toolSchemas.js';
import type { ToolDeps } from '../server/toolDeps.js';
import { translateNoticeWithSafetyNet } from '../services/translationService.js';
import { bulletList, renderMarkdown, section } from '../services/markdownRenderer.js';
import { toToolErrorResult } from '../errors/errorHandler.js';
import { recordToolTiming } from '../utils/metrics.js';
import { LOW_CONFIDENCE_THRESHOLD } from '../config/constants.js';

const TOOL_NAME = 'translate_notice';

export function registerTranslateNoticeTool(server: McpServer, deps: ToolDeps): void {
  server.registerTool(
    TOOL_NAME,
    {
      title: '학교 안내 번역',
      description:
        "Translates a school notice in PoomSchool(품스쿨) into easy Korean and a parent-selected language while preserving dates, amounts, contact details, URLs, names, and Korean school-system terms that require the original wording.",
      inputSchema: translateNoticeInputShape,
      annotations: {
        title: '학교 안내 번역',
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    async (args): Promise<CallToolResult> => {
      const startedAt = Date.now();
      try {
        const result = await translateNoticeWithSafetyNet(deps.aiProvider, {
          noticeText: args.notice_text,
          sourceLanguage: args.source_language,
          targetLanguage: args.target_language,
          includeEasyKorean: args.include_easy_korean,
          explanationMode: args.explanation_mode,
        });

        const bilingualLines = result.bilingualTerms.map((t) => `${t.term} — ${t.note}`);
        const languageWarning =
          args.source_language === 'auto' && result.languageConfidence < LOW_CONFIDENCE_THRESHOLD
            ? '> 입력 언어 감지 신뢰도가 낮습니다. 사용하신 언어를 직접 선택해 주세요.'
            : null;
        const lowTranslationWarning =
          result.translationConfidence < LOW_CONFIDENCE_THRESHOLD
            ? '> 번역 신뢰도가 낮아 원문을 함께 확인하는 것을 권장합니다. (확인 필요)'
            : null;

        const markdown = renderMarkdown([
          languageWarning,
          section('쉬운 한국어', result.easyKorean),
          section(`부모님 언어 번역 (${result.targetLanguage})`, result.translatedText),
          args.include_original ? section('원문', result.originalText) : null,
          section('원문 그대로 유지된 표현', result.preservedEntities.length > 0 ? bulletList(result.preservedEntities) : null),
          section('원문을 함께 표시한 학교 제도명', bilingualLines.length > 0 ? bulletList(bilingualLines) : null),
          section('번역 확인이 필요한 표현', result.needsReviewPhrases.length > 0 ? bulletList(result.needsReviewPhrases) : null),
          lowTranslationWarning,
        ]);

        recordToolTiming({ toolName: TOOL_NAME, durationMs: Date.now() - startedAt, success: true, timestamp: Date.now() });
        return { content: [{ type: 'text', text: markdown }], isError: false };
      } catch (error) {
        recordToolTiming({ toolName: TOOL_NAME, durationMs: Date.now() - startedAt, success: false, timestamp: Date.now() });
        return toToolErrorResult(error, deps.logger, TOOL_NAME);
      }
    },
  );
}
