import { describe, expect, it } from 'vitest';
import { sha256Hex } from '../../src/utils/hashing.js';
import { PINO_REDACT_PATHS } from '../../src/security/redaction.js';

describe('sha256Hex', () => {
  it('동일 입력에 대해 동일한 해시를 생성한다', () => {
    expect(sha256Hex('안내문 원문')).toBe(sha256Hex('안내문 원문'));
  });

  it('다른 입력은 다른 해시를 생성한다', () => {
    expect(sha256Hex('A')).not.toBe(sha256Hex('B'));
  });

  it('원문을 그대로 노출하지 않는 16진수 해시를 생성한다', () => {
    const hash = sha256Hex('민감한 안내문 내용');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain('민감한');
  });
});

describe('PINO_REDACT_PATHS', () => {
  it('Authorization 헤더와 원문 필드를 마스킹 대상에 포함한다', () => {
    expect(PINO_REDACT_PATHS).toContain('req.headers.authorization');
    expect(PINO_REDACT_PATHS.some((p) => p.includes('notice_text') || p.includes('noticeText'))).toBe(true);
    expect(PINO_REDACT_PATHS.some((p) => p.includes('parent_input_text') || p.includes('parentInputText'))).toBe(true);
  });
});
