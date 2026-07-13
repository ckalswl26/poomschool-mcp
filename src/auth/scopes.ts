import { OAUTH_SCOPE_READ, OAUTH_SCOPE_WRITE } from '../config/constants.js';

export { OAUTH_SCOPE_READ, OAUTH_SCOPE_WRITE };

export const READ_SCOPE_TOOLS = [
  'analyze_notice',
  'translate_notice',
  'explain_term',
  'draft_teacher_message',
  'list_tasks',
  'weekly_brief',
] as const;

export const WRITE_SCOPE_TOOLS = [
  'set_parent_preferences',
  'save_tasks',
  'complete_task',
  'delete_task',
] as const;

const TOOL_SCOPE_MAP: Record<string, string> = {};
for (const tool of READ_SCOPE_TOOLS) TOOL_SCOPE_MAP[tool] = OAUTH_SCOPE_READ;
for (const tool of WRITE_SCOPE_TOOLS) TOOL_SCOPE_MAP[tool] = OAUTH_SCOPE_WRITE;

export function requiredScopeForTool(toolName: string): string | undefined {
  return TOOL_SCOPE_MAP[toolName];
}
