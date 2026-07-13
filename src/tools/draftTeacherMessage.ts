import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { draftTeacherMessageInputShape } from '../schemas/toolSchemas.js';
import type { ToolDeps } from '../server/toolDeps.js';
import { draftTeacherMessageWithDetection } from '../services/teacherMessageService.js';
import { bulletList, renderMarkdown, section } from '../services/markdownRenderer.js';
import { toToolErrorResult } from '../errors/errorHandler.js';
import { recordToolTiming } from '../utils/metrics.js';

const TOOL_NAME = 'draft_teacher_message';

export function registerDraftTeacherMessageTool(server: McpServer, deps: ToolDeps): void {
  server.registerTool(
    TOOL_NAME,
    {
      title: '담임교사 메시지 작성',
      description:
        "Converts a parent's message written in any detected or selected language into a polite Korean teacher-message draft in PoomSchool(품스쿨), with a plain-Korean meaning, an optional back-translation, ambiguity warnings, and no automatic sending.",
      inputSchema: draftTeacherMessageInputShape,
      annotations: {
        title: '담임교사 메시지 작성',
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    async (args): Promise<CallToolResult> => {
      const startedAt = Date.now();
      try {
        const result = await draftTeacherMessageWithDetection(deps.aiProvider, {
          parentInputText: args.parent_input_text,
          inputLanguage: args.input_language,
          parentLanguage: args.parent_language,
          situation: args.situation,
          childAlias: args.child_alias,
          tone: args.tone,
          includeBackTranslation: args.include_back_translation,
        });

        const markdown = renderMarkdown([
          section('입력하신 내용의 뜻', result.plainKoreanMeaning),
          section('선생님께 보낼 한국어 메시지', result.teacherMessageKorean),
          section('부모님 언어로 다시 확인하기', result.backTranslation),
          section('입력에서 모호한 내용', result.ambiguousPoints.length > 0 ? bulletList(result.ambiguousPoints) : null),
          section('추가로 확인이 필요한 질문', result.followUpQuestions.length > 0 ? bulletList(result.followUpQuestions) : null),
          section(
            '확인해 주세요',
            '이 메시지는 자동으로 전송되지 않습니다. 내용을 확인한 뒤 직접 보내 주세요.',
          ),
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
