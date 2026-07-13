import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { MCP_SERVER_ID, MCP_SERVER_VERSION } from '../config/constants.js';
import type { ToolDeps } from './toolDeps.js';
import { registerAnalyzeNoticeTool } from '../tools/analyzeNotice.js';
import { registerTranslateNoticeTool } from '../tools/translateNotice.js';
import { registerExplainTermTool } from '../tools/explainTerm.js';
import { registerDraftTeacherMessageTool } from '../tools/draftTeacherMessage.js';
import { registerSetParentPreferencesTool } from '../tools/setParentPreferences.js';
import { registerSaveTasksTool } from '../tools/saveTasks.js';
import { registerListTasksTool } from '../tools/listTasks.js';
import { registerCompleteTaskTool } from '../tools/completeTask.js';
import { registerDeleteTaskTool } from '../tools/deleteTask.js';
import { registerWeeklyBriefTool } from '../tools/weeklyBrief.js';

/**
 * 요청마다 새로운 Stateless McpServer 인스턴스를 생성한다.
 * MCP 세션에 사용자 데이터를 저장하지 않으며, 사용자별 데이터는 OAuth subject와 DB로 관리한다.
 */
export function createMcpServer(deps: ToolDeps): McpServer {
  const server = new McpServer(
    { name: MCP_SERVER_ID, version: MCP_SERVER_VERSION },
    { capabilities: { tools: {} } },
  );

  registerAnalyzeNoticeTool(server, deps);
  registerTranslateNoticeTool(server, deps);
  registerExplainTermTool(server, deps);
  registerDraftTeacherMessageTool(server, deps);
  registerSetParentPreferencesTool(server, deps);
  registerSaveTasksTool(server, deps);
  registerListTasksTool(server, deps);
  registerCompleteTaskTool(server, deps);
  registerDeleteTaskTool(server, deps);
  registerWeeklyBriefTool(server, deps);

  return server;
}
