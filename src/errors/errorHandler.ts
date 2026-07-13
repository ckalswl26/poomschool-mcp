import type { Logger } from 'pino';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { AppError } from './AppError.js';

const GENERIC_MESSAGE =
  '요청을 처리하는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.';

/**
 * 어떤 오류든 사용자에게 안전한 한국어 메시지로 변환한다.
 * 내부 스택, 원인, 환경변수, 토큰 등은 로그에만 기록하고 응답에는 절대 포함하지 않는다.
 */
export function toToolErrorResult(error: unknown, logger: Logger, toolName: string): CallToolResult {
  if (error instanceof AppError) {
    logger.warn({ toolName, code: error.code, err: error.message }, 'tool_app_error');
    return {
      content: [{ type: 'text', text: error.userMessage }],
      isError: true,
    };
  }

  logger.error({ toolName, err: error instanceof Error ? error.message : String(error) }, 'tool_unhandled_error');
  return {
    content: [{ type: 'text', text: GENERIC_MESSAGE }],
    isError: true,
  };
}
