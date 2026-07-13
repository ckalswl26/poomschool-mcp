import { createHash } from 'node:crypto';

/**
 * 원문을 저장하지 않고 캐시 키로만 사용하기 위한 SHA-256 해시.
 */
export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}
