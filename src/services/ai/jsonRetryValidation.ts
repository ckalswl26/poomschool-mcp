import type { z } from 'zod';
import { AppError } from '../../errors/AppError.js';
import type { AppLogger } from '../../config/logger.js';

export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  const candidate = start >= 0 && end >= start ? trimmed.slice(start, end + 1) : trimmed;
  return JSON.parse(candidate);
}

function buildRepairPrompt(firstText: string): string {
  return `이전 응답이 JSON 스키마 검증에 실패했습니다. 다른 설명 없이 유효한 JSON만 다시 출력하세요.\n\n이전 응답:\n${firstText}`;
}

/**
 * JSON을 파싱하고 Zod 스키마로 검증한다. 실패 시 최대 1회의 구조 복구 요청만 허용하고,
 * 그래도 실패하면 검증되지 않은 결과를 노출하지 않고 안전한 오류를 던진다.
 * 모든 AiProvider 구현체가 동일한 복구 로직을 사용하도록 공유한다.
 */
export async function parseWithOneRetry<T>(
  firstText: string,
  schema: z.ZodType<T>,
  logger: AppLogger,
  callAgain: (repairPrompt: string) => Promise<string>,
): Promise<T> {
  try {
    return schema.parse(extractJson(firstText));
  } catch (firstError) {
    logger.warn({ err: String(firstError) }, 'ai_schema_validation_retry');
    const secondText = await callAgain(buildRepairPrompt(firstText));
    try {
      return schema.parse(extractJson(secondText));
    } catch (secondError) {
      logger.error({ err: String(secondError) }, 'ai_schema_validation_failed');
      throw new AppError(
        'AI_VALIDATION_FAILED',
        'AI 응답을 안전하게 검증하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      );
    }
  }
}
