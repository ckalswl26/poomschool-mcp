import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { deleteTaskInputShape } from '../schemas/toolSchemas.js';
import type { ToolDeps } from '../server/toolDeps.js';
import { extractOAuthSubject } from '../auth/bearerAuth.js';
import { deleteParentTask } from '../services/taskService.js';
import { renderMarkdown, section } from '../services/markdownRenderer.js';
import { toToolErrorResult } from '../errors/errorHandler.js';
import { recordToolTiming } from '../utils/metrics.js';

const TOOL_NAME = 'delete_task';

export function registerDeleteTaskTool(server: McpServer, deps: ToolDeps): void {
  server.registerTool(
    TOOL_NAME,
    {
      title: '학교 할 일 삭제',
      description:
        'Soft-deletes one confirmed parent school task in PoomSchool(품스쿨), enforces user ownership, does not expose deleted content, and safely handles repeated deletion requests.',
      inputSchema: deleteTaskInputShape,
      annotations: {
        title: '학교 할 일 삭제',
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: false,
        idempotentHint: true,
      },
    },
    async (args, extra): Promise<CallToolResult> => {
      const startedAt = Date.now();
      try {
        const userId = extractOAuthSubject(extra.authInfo);
        const result = await deleteParentTask(deps.schoolTaskRepo, userId, args.task_id, args.confirm);

        const markdown = renderMarkdown([
          section(
            '삭제되었습니다',
            result.alreadyDeleted ? '해당 항목은 이미 삭제된 상태입니다.' : '요청하신 학교 할 일을 삭제했습니다.',
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
