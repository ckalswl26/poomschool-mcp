/**
 * 로그에 절대 남으면 안 되는 필드 경로 목록.
 * Authorization 헤더, JWT, 안내문 원문, 부모 메시지 원문, 아이 이름, 학교명 등을 마스킹한다.
 */
export const PINO_REDACT_PATHS: string[] = [
  'req.headers.authorization',
  'req.headers.cookie',
  '*.authorization',
  '*.token',
  '*.accessToken',
  '*.access_token',
  '*.jwt',
  '*.notice_text',
  '*.noticeText',
  '*.parent_input_text',
  '*.parentInputText',
  '*.child_alias',
  '*.childAlias',
  '*.env.DATABASE_URL',
  '*.env.ANTHROPIC_API_KEY',
];

const MASK = '[REDACTED]';

export function maskSensitiveText(_text: string): string {
  return MASK;
}

/** 문자열 길이만 남기고 내용은 로그에 남기지 않는다 (원문 미노출 확인용). */
export function describeTextForLog(text: string | undefined | null): { length: number } {
  return { length: text ? text.length : 0 };
}
