export type AppErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'AI_TIMEOUT'
  | 'AI_UNAVAILABLE'
  | 'AI_VALIDATION_FAILED'
  | 'LANGUAGE_UNCERTAIN'
  | 'INTERNAL_ERROR';

/**
 * 사용자에게 그대로 노출해도 안전한 한국어 메시지를 담는 애플리케이션 오류.
 * 내부 스택이나 원인은 로그에만 남기고 응답에는 노출하지 않는다.
 */
export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly userMessage: string;

  constructor(code: AppErrorCode, userMessage: string, options?: { cause?: unknown }) {
    super(userMessage);
    this.name = 'AppError';
    this.code = code;
    this.userMessage = userMessage;
    if (options?.cause) {
      this.cause = options.cause;
    }
  }
}
