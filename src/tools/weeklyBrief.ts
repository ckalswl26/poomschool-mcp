import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { weeklyBriefInputShape } from '../schemas/toolSchemas.js';
import type { ToolDeps } from '../server/toolDeps.js';
import { extractOAuthSubject } from '../auth/bearerAuth.js';
import { buildWeeklyBrief } from '../services/taskService.js';
import { bulletList, renderMarkdown, section } from '../services/markdownRenderer.js';
import { toToolErrorResult } from '../errors/errorHandler.js';
import { recordToolTiming } from '../utils/metrics.js';
import { formatKoreanDate } from '../utils/dates.js';
import type { SchoolTaskRecord } from '../database/repositories/schoolTaskRepository.js';

const TOOL_NAME = 'weekly_brief';

function taskLine(task: SchoolTaskRecord): string {
  const parts = [task.title];
  if (task.childAlias) parts.push(`[${task.childAlias}]`);
  return parts.join(' ');
}

export function registerWeeklyBriefTool(server: McpServer, deps: ToolDeps): void {
  server.registerTool(
    TOOL_NAME,
    {
      title: '이번 주 학부모 브리핑',
      description:
        'Creates a weekly parent school briefing in PoomSchool(품스쿨), organizing overdue and upcoming tasks by date and highlighting signatures, payments, preparation items, school questions, and incomplete high-priority work.',
      inputSchema: weeklyBriefInputShape,
      annotations: {
        title: '이번 주 학부모 브리핑',
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
        const brief = await buildWeeklyBrief(deps.schoolTaskRepo, userId, {
          weekStart: args.week_start,
          includeCompleted: args.include_completed,
          childAlias: args.child_alias,
        });

        const byDateLines: string[] = [];
        for (const [dateKey, tasks] of [...brief.byDateThisWeek.entries()].sort()) {
          const label = formatKoreanDate(new Date(dateKey));
          byDateLines.push(`${label}: ${tasks.map((t) => t.title).join(', ')}`);
        }

        const markdown = renderMarkdown([
          section(
            `${formatKoreanDate(brief.weekStart)} ~ ${formatKoreanDate(brief.weekEnd)} 학부모 브리핑`,
            '이번 주 학교 관련 할 일을 정리했습니다.',
          ),
          section('기한이 지난 일', brief.overdue.length > 0 ? bulletList(brief.overdue.map(taskLine)) : null),
          section('오늘 해야 할 일', brief.dueToday.length > 0 ? bulletList(brief.dueToday.map(taskLine)) : null),
          section('날짜별 예정 업무', byDateLines.length > 0 ? bulletList(byDateLines) : null),
          section('부모님 서명이 필요한 일', brief.needsSignature.length > 0 ? bulletList(brief.needsSignature.map(taskLine)) : null),
          section('납부 전 확인할 일', brief.needsPaymentCheck.length > 0 ? bulletList(brief.needsPaymentCheck.map(taskLine)) : null),
          section('준비물이 필요한 일', brief.needsMaterials.length > 0 ? bulletList(brief.needsMaterials.map(taskLine)) : null),
          section('학교에 문의해야 할 일', brief.needsSchoolContact.length > 0 ? bulletList(brief.needsSchoolContact.map(taskLine)) : null),
          section(
            '완료되지 않은 중요 업무',
            brief.incompleteHighPriority.length > 0 ? bulletList(brief.incompleteHighPriority.map(taskLine)) : null,
          ),
          section('이번 주 완료한 일', brief.completedThisWeek.length > 0 ? bulletList(brief.completedThisWeek.map(taskLine)) : null),
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
