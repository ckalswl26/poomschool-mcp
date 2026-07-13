import { describe, expect, it } from 'vitest';
import { listGlossaryTerms, lookupGlossaryTerm } from '../../src/services/schoolGlossaryService.js';

describe('schoolGlossaryService', () => {
  it('15개 이상의 초등학교 용어를 포함한다', () => {
    expect(listGlossaryTerms().length).toBeGreaterThanOrEqual(15);
  });

  it('정확한 용어명으로 조회할 수 있다', () => {
    const entry = lookupGlossaryTerm('스쿨뱅킹');
    expect(entry).not.toBeNull();
    expect(entry?.easyMeaning).toContain('계좌');
  });

  it('공백/대소문자 차이를 허용한다', () => {
    expect(lookupGlossaryTerm(' 스쿨뱅킹 ')).not.toBeNull();
  });

  it('존재하지 않는 용어는 null을 반환한다', () => {
    expect(lookupGlossaryTerm('존재하지않는용어')).toBeNull();
  });

  it('각 항목은 사실 왜곡 없이 학교 확인이 필요한 항목을 포함할 수 있다', () => {
    const entry = lookupGlossaryTerm('교육급여');
    expect(entry?.schoolConfirmationNeeded.length).toBeGreaterThan(0);
  });
});
