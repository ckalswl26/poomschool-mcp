import { z } from 'zod';
import {
  NOTICE_TEXT_MAX_LENGTH,
  PARENT_INPUT_MAX_LENGTH,
  CONTEXT_MAX_LENGTH,
  TERM_MAX_LENGTH,
  SOURCE_SUMMARY_MAX_LENGTH,
  CHILD_ALIAS_MAX_LENGTH,
} from '../config/constants.js';

export const noticeTextSchema = z.string().trim().min(1).max(NOTICE_TEXT_MAX_LENGTH);
export const parentInputTextSchema = z.string().trim().min(1).max(PARENT_INPUT_MAX_LENGTH);
export const contextTextSchema = z.string().trim().max(CONTEXT_MAX_LENGTH).optional();
export const termSchema = z.string().trim().min(1).max(TERM_MAX_LENGTH);
export const sourceSummarySchema = z.string().trim().max(SOURCE_SUMMARY_MAX_LENGTH).optional();
export const childAliasSchema = z.string().trim().max(CHILD_ALIAS_MAX_LENGTH).optional();
export const childGradeSchema = z.number().int().min(1).max(6).optional();

export const isoDateTimeSchema = z.string().refine((v) => !Number.isNaN(Date.parse(v)), {
  message: '유효한 ISO 8601 날짜/시간 형식이어야 합니다.',
});
