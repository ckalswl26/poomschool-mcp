import { z } from 'zod';

/** 느슨한 BCP-47 언어 태그 검증 (예: ko, vi, zh-CN, zh-TW, en, ru, th, tl, mn, km, uz, ne, si). */
const BCP47_REGEX = /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/;

/**
 * BCP-47 언어 코드 스키마를 생성한다.
 *
 * 반드시 함수로 호출해 매번 새 Zod 인스턴스를 만들어야 한다. 하나의 Tool 안에서 동일한
 * 스키마 객체(참조)를 두 개 이상의 필드에 재사용하면, JSON Schema 변환 시 중복 제거 로직이
 * 두 번째 필드를 `$ref` 포인터로 바꿔버려 일부 클라이언트(PlayMCP 미리보기 등)가 해당 필드를
 * `<object>`로 잘못 렌더링하는 문제가 있었다. (예: translate_notice의 source_language /
 * target_language가 동일 인스턴스를 공유해 target_language가 `$ref`로 치환됨)
 */
export function bcp47LanguageSchema() {
  return z
    .string()
    .trim()
    .min(2)
    .max(35)
    .regex(BCP47_REGEX, 'BCP-47 언어 코드 형식이 올바르지 않습니다. 예: ko, vi, zh-CN, en');
}

/** source_language용 스키마. 호출할 때마다 새 인스턴스를 반환한다 (위 bcp47LanguageSchema 설명 참고). */
export function sourceLanguageSchema() {
  return z.union([z.literal('auto'), bcp47LanguageSchema()]).default('auto');
}

export function explanationLevelSchema() {
  return z.enum(['easy', 'standard']);
}

export function explanationModeSchema() {
  return z.enum(['general', 'multicultural_parent', 'north_korean_parent']).default('general');
}

export type ExplanationLevel = z.infer<ReturnType<typeof explanationLevelSchema>>;
export type ExplanationMode = z.infer<ReturnType<typeof explanationModeSchema>>;
