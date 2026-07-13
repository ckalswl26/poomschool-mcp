import { describe, expect, it } from 'vitest';
import { Writable } from 'node:stream';
import pino from 'pino';
import { PINO_REDACT_PATHS } from '../../src/security/redaction.js';

function createCapturingLogger(): { logger: pino.Logger; getOutput: () => string } {
  let buffer = '';
  const stream = new Writable({
    write(chunk, _enc, callback) {
      buffer += chunk.toString();
      callback();
    },
  });
  const logger = pino({ redact: { paths: PINO_REDACT_PATHS, censor: '[REDACTED]' } }, stream);
  return { logger, getOutput: () => buffer };
}

describe('로그 마스킹', () => {
  it('Authorization 헤더 값이 로그에 남지 않는다', () => {
    const { logger, getOutput } = createCapturingLogger();
    logger.info({ req: { headers: { authorization: 'Bearer super-secret-token' } } }, 'test');
    const output = getOutput();
    expect(output).not.toContain('super-secret-token');
    expect(output).toContain('[REDACTED]');
  });

  it('안내문 원문(notice_text)이 로그에 남지 않는다', () => {
    const { logger, getOutput } = createCapturingLogger();
    logger.info({ args: { notice_text: '매우 민감한 가정통신문 원문 내용입니다' } }, 'test');
    const output = getOutput();
    expect(output).not.toContain('매우 민감한 가정통신문');
  });

  it('부모 메시지 원문(parent_input_text)이 로그에 남지 않는다', () => {
    const { logger, getOutput } = createCapturingLogger();
    logger.info({ args: { parent_input_text: '아이가 아파서 결석한다는 매우 사적인 내용' } }, 'test');
    const output = getOutput();
    expect(output).not.toContain('아이가 아파서 결석한다는');
  });

  it('아이 별칭(child_alias)이 로그에 남지 않는다', () => {
    const { logger, getOutput } = createCapturingLogger();
    logger.info({ args: { child_alias: '민감한별칭' } }, 'test');
    const output = getOutput();
    expect(output).not.toContain('민감한별칭');
  });
});
