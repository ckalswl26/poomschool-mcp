import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { listTasksInputShape } from '../schemas/toolSchemas.js';
import type { ToolDeps } from '../server/toolDeps.js';
import { extractOAuthSubject } from '../auth/bearerAuth.js';
import { listTasksForParent } from '../services/taskService.js';
import { bulletList, renderMarkdown, section } from '../services/markdownRenderer.js';
import { toToolErrorResult } from '../errors/errorHandler.js';
import { recordToolTiming } from '../utils/metrics.js';
import type { SchoolTaskRecord } from '../database/repositories/schoolTaskRepository.js';
import { AppError } from '../errors/AppError.js';

const TOOL_NAME = 'list_tasks';

function taskLine(task: SchoolTaskRecord): string {
  const parts = [task.title];
  if (task.dueAt) parts.push(`(기한: ${task.dueAt.toISOString().slice(0, 10)})`);
  if (task.childAlias) parts.push(`[${task.childAlias}]`);
  if (task.requiresSignature) parts.push('서명 필요');
  if (task.requiresPayment) parts.push('비용 발생');
  return parts.join(' ');
}

export function registerListTasksTool(server: McpServer, deps: ToolDeps): void {
  server.registerTool(
    TOOL_NAME,
    {
      title: '학교 할 일 조회',
      description:
        'Retrieves a parent\'s saved school tasks from PoomSchool(품스쿨) and groups them into overdue, due today, due this week, later, and completed sections with optional date, category, child-alias, and status filters.',
      inputSchema: listTasksInputShape,
      annotations: {
        title: '학교 할 일 조회',
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true,
      },
    },
    async (args, extra): Promise<CallToolResult> => {
      const startedAt = Date.now();
      try {
        const userId = extractOAuthSubject(extra.authInfo);
        if ((args.from && Number.isNaN(Date.parse(args.from))) || (args.to && Number.isNaN(Date.parse(args.to)))) {
          throw new AppError('VALIDATION_ERROR', 'from/to 값은 유효한 날짜 형식이어야 합니다.');
        }

        const grouped = await listTasksForParent(deps.schoolTaskRepo, userId, {
          status: args.status,
          from: args.from ? new Date(args.from) : undefined,
          to: args.to ? new Date(args.to) : undefined,
          category: args.category,
          childAlias: args.child_alias,
          limit: args.limit,
        });

        const markdown = renderMarkdown([
          section('기한이 지난 일', grouped.overdue.length > 0 ? bulletList(grouped.overdue.map(taskLine)) : null),
          section('오늘까지 해야 할 일', grouped.today.length > 0 ? bulletList(grouped.today.map(taskLine)) : null),
          section('이번 주에 해야 할 일', grouped.thisWeek.length > 0 ? bulletList(grouped.thisWeek.map(taskLine)) : null),
          section('이후 일정', grouped.later.length > 0 ? bulletList(grouped.later.map(taskLine)) : null),
          section('기한 없는 할 일', grouped.noDueDate.length > 0 ? bulletList(grouped.noDueDate.map(taskLine)) : null),
          section('완료된 일', grouped.completed.length > 0 ? bulletList(grouped.completed.map(taskLine)) : null),
        ]);

        const isEmpty =
          grouped.overdue.length +
            grouped.today.length +
            grouped.thisWeek.length +
            grouped.later.length +
            grouped.noDueDate.length +
            grouped.completed.length ===
          0;

        recordToolTiming({ toolName: TOOL_NAME, durationMs: Date.now() - startedAt, success: true, timestamp: Date.now() });
        return {
          content: [{ type: 'text', text: isEmpty ? '저장된 학교 할 일이 없습니다.' : markdown }],
          isError: false,
        };
      } catch (error) {
        recordToolTiming({ toolName: TOOL_NAME, durationMs: Date.now() - startedAt, success: false, timestamp: Date.now() });
        return toToolErrorResult(error, deps.logger, TOOL_NAME);
      }
    },
  );
}
