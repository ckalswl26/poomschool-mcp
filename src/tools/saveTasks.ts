import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { saveTasksInputShape } from '../schemas/toolSchemas.js';
import type { ToolDeps } from '../server/toolDeps.js';
import { extractOAuthSubject } from '../auth/bearerAuth.js';
import { saveTasksBatch } from '../services/taskService.js';
import { numberedList, renderMarkdown, section } from '../services/markdownRenderer.js';
import { toToolErrorResult } from '../errors/errorHandler.js';
import { recordToolTiming } from '../utils/metrics.js';

const TOOL_NAME = 'save_tasks';

export function registerSaveTasksTool(server: McpServer, deps: ToolDeps): void {
  server.registerTool(
    TOOL_NAME,
    {
      title: '학교 할 일 저장',
      description:
        'Saves structured parent school tasks in PoomSchool(품스쿨), including deadlines, payments, signatures, preparation items, and optional child aliases while preventing duplicates with an idempotency key and avoiding storage of the full original notice.',
      inputSchema: saveTasksInputShape,
      annotations: {
        title: '학교 할 일 저장',
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
        const saved = await saveTasksBatch(
          deps.schoolTaskRepo,
          userId,
          args.tasks.map((t) => ({
            title: t.title,
            description: t.description,
            dueAt: t.due_at,
            category: t.category,
            childAlias: t.child_alias,
            priority: t.priority,
            requiresSignature: t.requires_signature,
            requiresPayment: t.requires_payment,
            sourceSummary: t.source_summary,
          })),
          args.idempotency_key,
        );

        const lines = saved.map((t) => {
          const parts = [t.title];
          if (t.dueAt) parts.push(`(기한: ${t.dueAt.toISOString().slice(0, 10)})`);
          return parts.join(' ');
        });

        const markdown = renderMarkdown([
          section(`학교 할 일 ${saved.length}건이 저장되었습니다`, numberedList(lines)),
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
