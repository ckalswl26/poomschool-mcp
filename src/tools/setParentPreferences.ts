import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { setParentPreferencesInputShape } from '../schemas/toolSchemas.js';
import type { ToolDeps } from '../server/toolDeps.js';
import { extractOAuthSubject } from '../auth/bearerAuth.js';
import { renderMarkdown, section } from '../services/markdownRenderer.js';
import { toToolErrorResult } from '../errors/errorHandler.js';
import { recordToolTiming } from '../utils/metrics.js';

const TOOL_NAME = 'set_parent_preferences';

const LEVEL_LABEL: Record<string, string> = { easy: '쉬운 설명', standard: '표준 설명' };

export function registerSetParentPreferencesTool(server: McpServer, deps: ToolDeps): void {
  server.registerTool(
    TOOL_NAME,
    {
      title: '학부모 언어 설정',
      description:
        'Stores or updates a parent\'s language and explanation preferences in PoomSchool(품스쿨), including the BCP-47 language code, easy-Korean display preference, and original-text display preference without requiring nationality or family-background data.',
      inputSchema: setParentPreferencesInputShape,
      annotations: {
        title: '학부모 언어 설정',
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true,
      },
    },
    async (args, extra): Promise<CallToolResult> => {
      const startedAt = Date.now();
      try {
        const userId = extractOAuthSubject(extra.authInfo);
        const profile = await deps.userProfileRepo.upsert(userId, {
          preferredLanguageCode: args.preferred_language_code,
          preferredLanguageName: args.preferred_language_name ?? null,
          explanationLevel: args.explanation_level,
          showEasyKorean: args.show_easy_korean,
          showOriginalText: args.show_original_text,
        });

        const markdown = renderMarkdown([
          section(
            '설정이 저장되었습니다',
            [
              `선호 언어: ${profile.preferredLanguageName ?? profile.preferredLanguageCode} (${profile.preferredLanguageCode})`,
              `설명 방식: ${LEVEL_LABEL[profile.explanationLevel] ?? profile.explanationLevel}`,
              `쉬운 한국어 표시: ${profile.showEasyKorean ? '켜짐' : '꺼짐'}`,
              `원문 표시: ${profile.showOriginalText ? '켜짐' : '꺼짐'}`,
            ].join('\n'),
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
