import { z } from 'zod';

/** 안내문 분석에 사용되는 카테고리. Prisma의 TaskCategory와 값이 일치해야 한다. */
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

export const parentTaskSchema = z.object({
  title: z.string().min(1),
  details: z.string().nullable(),
  dueAt: z.string().nullable(),
  requiresSignature: z.boolean(),
  requiresPayment: z.boolean(),
  category: taskCategorySchema,
});

export const childInformationSchema = z.object({
  type: z.enum(['tell_child', 'prepare_for_child', 'child_material']),
  content: z.string().min(1),
});

export const costInfoSchema = z.object({
  status: z.enum(['required', 'not_required', 'unknown']),
  amount: z.number().nullable(),
  currency: z.literal('KRW').nullable(),
  paymentMethod: z.string().nullable(),
  paymentDate: z.string().nullable(),
});

export const submissionInfoSchema = z.object({
  recipient: z.string().nullable(),
  method: z.string().nullable(),
  deadline: z.string().nullable(),
});

export const applicationImpactSchema = z.object({
  status: z.enum(['stated', 'unknown']),
  content: z.string().nullable(),
});

export const noticeAnalysisResultSchema = z.object({
  detectedLanguage: z.string().min(2),
  languageConfidence: z.number().min(0).max(1),
  purpose: z.string().min(1),
  easyKoreanSummary: z.string().min(1),
  parentTasks: z.array(parentTaskSchema).max(20),
  childInformation: z.array(childInformationSchema).max(20),
  materials: z.array(z.string().min(1)).max(20),
  cost: costInfoSchema,
  submission: submissionInfoSchema,
  applicationImpact: applicationImpactSchema,
  unknowns: z.array(z.string().min(1)).max(20),
  questionsForSchool: z.array(z.string().min(1)).max(10),
  translatedSummary: z.string().nullable(),
  targetLanguage: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});
export type NoticeAnalysisResult = z.infer<typeof noticeAnalysisResultSchema>;

export const translationResultSchema = z.object({
  detectedLanguage: z.string().min(2),
  languageConfidence: z.number().min(0).max(1),
  targetLanguage: z.string().min(2),
  easyKorean: z.string().nullable(),
  translatedText: z.string().nullable(),
  originalText: z.string(),
  preservedEntities: z.array(z.string()).max(50),
  bilingualTerms: z.array(z.object({ term: z.string(), note: z.string() })).max(20),
  needsReviewPhrases: z.array(z.string()).max(20),
  translationConfidence: z.number().min(0).max(1),
});
export type TranslationResult = z.infer<typeof translationResultSchema>;

export const termExplanationResultSchema = z.object({
  easyMeaning: z.string().min(1),
  practicalExample: z.string().nullable(),
  parentChecklist: z.array(z.string()).max(10),
  parentActions: z.array(z.string()).max(10),
  commonMisunderstandings: z.array(z.string()).max(10),
  translatedExplanation: z.string().nullable(),
  targetLanguage: z.string().nullable(),
  schoolConfirmationNeeded: z.array(z.string()).max(10),
});
export type TermExplanationResult = z.infer<typeof termExplanationResultSchema>;

export const teacherMessageResultSchema = z.object({
  detectedLanguage: z.string().min(2),
  languageConfidence: z.number().min(0).max(1),
  plainKoreanMeaning: z.string().min(1),
  teacherMessageKorean: z.string().min(1),
  backTranslation: z.string().nullable(),
  ambiguousPoints: z.array(z.string()).max(10),
  followUpQuestions: z.array(z.string()).max(10),
});
export type TeacherMessageResult = z.infer<typeof teacherMessageResultSchema>;
