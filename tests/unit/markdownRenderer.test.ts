import { describe, expect, it } from 'vitest';
import { bulletList, numberedList, renderMarkdown, section } from '../../src/services/markdownRenderer.js';
import { MAX_TOOL_RESULT_LENGTH } from '../../src/config/constants.js';

describe('markdownRenderer', () => {
  it('section은 내용이 없으면 null을 반환한다 (빈 섹션 생략)', () => {
    expect(section('제목', '')).toBeNull();
    expect(section('제목', null)).toBeNull();
    expect(section('제목', undefined)).toBeNull();
    expect(section('제목', '   ')).toBeNull();
  });

  it('section은 내용이 있으면 heading을 포함한다', () => {
    expect(section('제목', '내용')).toBe('## 제목\n\n내용');
  });

  it('renderMarkdown은 null/빈 섹션을 제거한다', () => {
    const result = renderMarkdown([null, section('A', '내용1'), undefined, section('B', '')]);
    expect(result).toBe('## A\n\n내용1');
    expect(result).not.toContain('## B');
  });

  it('bulletList와 numberedList가 올바른 형식을 생성한다', () => {
    expect(bulletList(['a', 'b'])).toBe('- a\n- b');
    expect(numberedList(['a', 'b'])).toBe('1. a\n2. b');
  });

  it('최대 길이를 초과하면 잘라내고 안내 문구를 붙인다', () => {
    const longText = 'a'.repeat(MAX_TOOL_RESULT_LENGTH + 500);
    const result = renderMarkdown([longText]);
    expect(result.length).toBeLessThan(longText.length);
    expect(result).toContain('생략되었습니다');
  });
});
