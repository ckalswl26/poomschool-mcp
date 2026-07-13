import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { explainTermInputShape } from '../schemas/toolSchemas.js';
import type { ToolDeps } from '../server/toolDeps.js';
import { lookupGlossaryTerm } from '../services/schoolGlossaryService.js';
import { bulletList, renderMarkdown, section } from '../services/markdownRenderer.js';
import { toToolErrorResult } from '../errors/errorHandler.js';
import { recordToolTiming } from '../utils/metrics.js';

const TOOL_NAME = 'explain_term';

export function registerExplainTermTool(server: McpServer, deps: ToolDeps): void {
  server.registerTool(
    TOOL_NAME,
    {
      title: '학교 용어 설명',
      description:
        "Explains a Korean elementary school term in PoomSchool(품스쿨) using clear parent-friendly language, practical examples, required parent actions, common misunderstandings, and an optional translation in the parent's preferred language.",
      inputSchema: explainTermInputShape,
      annotations: {
        title: '학교 용어 설명',
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true,
      },
    },
    async (args): Promise<CallToolResult> => {
      const startedAt = Date.now();
      try {
        const needsTranslation = !!args.parent_language && args.parent_language !== 'ko';
        const glossaryEntry = lookupGlossaryTerm(args.term);

        let easyMeaning: string;
        let practicalExample: string | null;
        let parentChecklist: string[];
        let parentActions: string[];
        let commonMisunderstandings: string[];
        let schoolConfirmationNeeded: string[];
        let translatedExplanation: string | null = null;
        let targetLanguage: string | null = null;

        if (glossaryEntry) {
          easyMeaning = glossaryEntry.easyMeaning;
          practicalExample = glossaryEntry.practicalExample;
          parentChecklist = glossaryEntry.parentChecklist;
          parentActions = glossaryEntry.parentActions;
          commonMisunderstandings = glossaryEntry.commonMisunderstandings;
          schoolConfirmationNeeded = glossaryEntry.schoolConfirmationNeeded;

          if (needsTranslation) {
            const aiResult = await deps.aiProvider.explainSchoolTerm({
              term: args.term,
              context: glossaryEntry.easyMeaning,
              parentLanguage: args.parent_language,
              explanationLevel: args.explanation_level,
              explanationMode: args.explanation_mode,
            });
            translatedExplanation = aiResult.translatedExplanation;
            targetLanguage = aiResult.targetLanguage;
          }
        } else {
          const aiResult = await deps.aiProvider.explainSchoolTerm({
            term: args.term,
            context: args.context,
            parentLanguage: args.parent_language,
            explanationLevel: args.explanation_level,
            explanationMode: args.explanation_mode,
          });
          easyMeaning = aiResult.easyMeaning;
          practicalExample = aiResult.practicalExample;
          parentChecklist = aiResult.parentChecklist;
          parentActions = aiResult.parentActions;
          commonMisunderstandings = aiResult.commonMisunderstandings;
          schoolConfirmationNeeded = aiResult.schoolConfirmationNeeded;
          translatedExplanation = aiResult.translatedExplanation;
          targetLanguage = aiResult.targetLanguage;
        }

        const markdown = renderMarkdown([
          section('쉬운 뜻', easyMeaning),
          section('실제 학교생활 예시', practicalExample),
          section('부모님이 확인할 사항', parentChecklist.length > 0 ? bulletList(parentChecklist) : null),
          section('부모님이 해야 할 행동', parentActions.length > 0 ? bulletList(parentActions) : null),
          section('자주 발생하는 오해', commonMisunderstandings.length > 0 ? bulletList(commonMisunderstandings) : null),
          section(`부모님 언어로 보기 (${targetLanguage ?? args.parent_language ?? ''})`, translatedExplanation),
          section('학교에 확인이 필요한 내용', schoolConfirmationNeeded.length > 0 ? bulletList(schoolConfirmationNeeded) : null),
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
