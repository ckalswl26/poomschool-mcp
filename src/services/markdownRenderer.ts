import { MAX_TOOL_RESULT_LENGTH } from '../config/constants.js';

export function bulletList(items: string[]): string {
  return items.map((item) => `- ${item}`).join('\n');
}

export function numberedList(items: string[]): string {
  return items.map((item, i) => `${i + 1}. ${item}`).join('\n');
}

/** heading과 content가 비어있으면 섹션 자체를 생략한다 (section 16 규칙). */
export function section(heading: string, content: string | null | undefined): string | null {
  if (!content || content.trim().length === 0) return null;
  return `## ${heading}\n\n${content.trim()}`;
}

export function renderMarkdown(sections: Array<string | null | undefined>): string {
  const nonEmpty = sections.filter((s): s is string => !!s && s.trim().length > 0);
  const joined = nonEmpty.join('\n\n');
  if (joined.length <= MAX_TOOL_RESULT_LENGTH) return joined;
  return `${joined.slice(0, MAX_TOOL_RESULT_LENGTH).trim()}\n\n> 내용이 길어 일부가 생략되었습니다.`;
}
