import { z } from 'zod';

/** 느슨한 BCP-47 언어 태그 검증 (예: ko, vi, zh-CN, zh-TW, en, ru, th, tl, mn, km, uz, ne, si). */
const BCP47_REGEX = /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/;

export const bcp47LanguageSchema = z
  .string()
  .trim()
  .min(2)
  .max(35)
  .regex(BCP47_REGEX, 'BCP-47 언어 코드 형식이 올바르지 않습니다. 예: ko, vi, zh-CN, en');

export const sourceLanguageSchema = z
  .union([z.literal('auto'), bcp47LanguageSchema])
  .default('auto');

export const explanationLevelSchema = z.enum(['easy', 'standard']);

export const explanationModeSchema = z
  .enum(['general', 'multicultural_parent', 'north_korean_parent'])
  .default('general');

export type ExplanationLevel = z.infer<typeof explanationLevelSchema>;
export type ExplanationMode = z.infer<typeof explanationModeSchema>;
