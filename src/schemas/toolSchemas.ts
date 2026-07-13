import { z } from 'zod';
import {
  childAliasSchema,
  childGradeSchema,
  contextTextSchema,
  isoDateTimeSchema,
  noticeTextSchema,
  parentInputTextSchema,
  sourceSummarySchema,
  termSchema,
} from './commonSchemas.js';
import { bcp47LanguageSchema, explanationLevelSchema, explanationModeSchema, sourceLanguageSchema } from './languageSchemas.js';

export const analyzeNoticeInputShape = {
  notice_text: noticeTextSchema,
  child_grade: childGradeSchema,
  parent_language: bcp47LanguageSchema().optional(),
  source_language: sourceLanguageSchema(),
  explanation_level: explanationLevelSchema().optional(),
  explanation_mode: explanationModeSchema(),
  include_translation: z.boolean().default(true),
};

export const translateNoticeInputShape = {
  notice_text: noticeTextSchema,
  source_language: sourceLanguageSchema(),
  target_language: bcp47LanguageSchema(),
  include_original: z.boolean().default(true),
  include_easy_korean: z.boolean().default(true),
  explanation_mode: explanationModeSchema(),
};

export const explainTermInputShape = {
  term: termSchema,
  context: contextTextSchema,
  parent_language: bcp47LanguageSchema().optional(),
  explanation_level: explanationLevelSchema().default('standard'),
  explanation_mode: explanationModeSchema(),
};

export const situationSchema = z.enum([
  'absence',
  'lateness',
  'early_leave',
  'health_notice',
  'allergy_notice',
  'schedule_question',
  'material_question',
  'counseling_request',
  'notice_question',
  'relationship_concern',
  'payment_question',
  'after_school_question',
  'other',
]);

export const draftTeacherMessageInputShape = {
  parent_input_text: parentInputTextSchema,
  input_language: sourceLanguageSchema(),
  parent_language: bcp47LanguageSchema().optional(),
  situation: situationSchema,
  child_alias: childAliasSchema,
  tone: z.enum(['polite', 'concise', 'warm']).default('polite'),
  include_back_translation: z.boolean().default(true),
};

export const setParentPreferencesInputShape = {
  preferred_language_code: bcp47LanguageSchema(),
  preferred_language_name: z.string().trim().max(100).optional(),
  explanation_level: explanationLevelSchema(),
  show_easy_korean: z.boolean(),
  show_original_text: z.boolean(),
};

export const taskCategorySchema = z.enum([
  'document',
  'payment',
  'preparation',
  'application',
  'schedule',
  'contact',
  'health',
  'after_school',
  'other',
]);

export const taskPrioritySchema = z.enum(['low', 'normal', 'high']);

export const saveTaskItemSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional(),
  due_at: isoDateTimeSchema.optional(),
  category: taskCategorySchema,
  child_alias: childAliasSchema,
  priority: taskPrioritySchema,
  requires_signature: z.boolean(),
  requires_payment: z.boolean(),
  source_summary: sourceSummarySchema,
});

export const saveTasksInputShape = {
  tasks: z.array(saveTaskItemSchema).min(1).max(10),
  idempotency_key: z.string().trim().min(1).max(200),
};

export const listTasksInputShape = {
  status: z.enum(['pending', 'completed', 'all']).default('pending'),
  from: z.string().optional(),
  to: z.string().optional(),
  category: taskCategorySchema.optional(),
  child_alias: childAliasSchema,
  limit: z.number().int().min(1).max(50).default(20),
};

export const completeTaskInputShape = {
  task_id: z.string().trim().min(1),
  completed_at: isoDateTimeSchema.optional(),
};

export const deleteTaskInputShape = {
  task_id: z.string().trim().min(1),
  confirm: z.boolean(),
};

export const weeklyBriefInputShape = {
  week_start: z.string().optional(),
  include_completed: z.boolean().default(false),
  child_alias: childAliasSchema,
};
