import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  analyzeNoticeInputShape,
  deleteTaskInputShape,
  draftTeacherMessageInputShape,
  saveTasksInputShape,
  translateNoticeInputShape,
} from '../../src/schemas/toolSchemas.js';
import { bcp47LanguageSchema, sourceLanguageSchema } from '../../src/schemas/languageSchemas.js';
import { NOTICE_TEXT_MAX_LENGTH, PARENT_INPUT_MAX_LENGTH } from '../../src/config/constants.js';

describe('bcp47LanguageSchema', () => {
  it('유효한 BCP-47 코드를 허용한다', () => {
    for (const code of ['ko', 'vi', 'zh-CN', 'zh-TW', 'en', 'ru', 'th', 'tl', 'mn', 'km', 'uz', 'ne', 'si']) {
      expect(bcp47LanguageSchema().safeParse(code).success).toBe(true);
    }
  });

  it('잘못된 형식은 거부한다', () => {
    for (const code of ['', '1', 'toolongtoolongtoolongtoolongtoolongtoolong', 'ko_KR!']) {
      expect(bcp47LanguageSchema().safeParse(code).success).toBe(false);
    }
  });

  it('호출할 때마다 독립적인 스키마 인스턴스를 반환한다 (JSON Schema $ref 중복참조 방지)', () => {
    expect(bcp47LanguageSchema()).not.toBe(bcp47LanguageSchema());
  });
});

describe('sourceLanguageSchema (auto 처리)', () => {
  it('auto를 허용한다', () => {
    expect(sourceLanguageSchema().parse('auto')).toBe('auto');
  });

  it('값이 없으면 기본값 auto를 사용한다', () => {
    expect(sourceLanguageSchema().parse(undefined)).toBe('auto');
  });

  it('BCP-47 코드도 허용한다', () => {
    expect(sourceLanguageSchema().parse('vi')).toBe('vi');
  });
});

describe('analyzeNoticeInputShape', () => {
  const schema = z.object(analyzeNoticeInputShape);

  it('최소 필드만으로도 통과한다', () => {
    const result = schema.safeParse({ notice_text: '안내문 내용' });
    expect(result.success).toBe(true);
  });

  it('notice_text 최대 길이를 초과하면 거부한다', () => {
    const tooLong = 'a'.repeat(NOTICE_TEXT_MAX_LENGTH + 1);
    expect(schema.safeParse({ notice_text: tooLong }).success).toBe(false);
  });

  it('notice_text가 비어있으면 거부한다', () => {
    expect(schema.safeParse({ notice_text: '' }).success).toBe(false);
  });

  it('child_grade는 1~6 범위만 허용한다', () => {
    expect(schema.safeParse({ notice_text: 'x', child_grade: 0 }).success).toBe(false);
    expect(schema.safeParse({ notice_text: 'x', child_grade: 7 }).success).toBe(false);
    expect(schema.safeParse({ notice_text: 'x', child_grade: 3 }).success).toBe(true);
  });
});

describe('translateNoticeInputShape', () => {
  const schema = z.object(translateNoticeInputShape);

  it('target_language는 고정 enum이 아니라 임의의 BCP-47 코드를 허용한다', () => {
    for (const lang of ['vi', 'zh-CN', 'mn', 'km', 'uz', 'ne', 'si']) {
      expect(schema.safeParse({ notice_text: 'x', target_language: lang }).success).toBe(true);
    }
  });

  it('target_language가 없으면 거부한다', () => {
    expect(schema.safeParse({ notice_text: 'x' }).success).toBe(false);
  });
});

describe('draftTeacherMessageInputShape', () => {
  const schema = z.object(draftTeacherMessageInputShape);

  it('parent_input_text 최대 길이를 초과하면 거부한다', () => {
    const tooLong = 'a'.repeat(PARENT_INPUT_MAX_LENGTH + 1);
    expect(schema.safeParse({ parent_input_text: tooLong, situation: 'other' }).success).toBe(false);
  });

  it('situation이 허용된 값이 아니면 거부한다', () => {
    expect(schema.safeParse({ parent_input_text: 'x', situation: 'invalid' }).success).toBe(false);
  });
});

describe('saveTasksInputShape', () => {
  const schema = z.object(saveTasksInputShape);

  it('tasks는 최대 10개까지만 허용한다', () => {
    const tasks = Array.from({ length: 11 }, (_, i) => ({
      title: `할 일 ${i}`,
      category: 'other' as const,
      priority: 'normal' as const,
      requires_signature: false,
      requires_payment: false,
    }));
    expect(schema.safeParse({ tasks, idempotency_key: 'batch-1' }).success).toBe(false);
  });

  it('idempotency_key가 없으면 거부한다', () => {
    const tasks = [
      { title: '할 일', category: 'other' as const, priority: 'normal' as const, requires_signature: false, requires_payment: false },
    ];
    expect(schema.safeParse({ tasks }).success).toBe(false);
  });
});

describe('deleteTaskInputShape', () => {
  const schema = z.object(deleteTaskInputShape);

  it('confirm 필드가 필수다', () => {
    expect(schema.safeParse({ task_id: 'abc' }).success).toBe(false);
    expect(schema.safeParse({ task_id: 'abc', confirm: false }).success).toBe(true);
  });
});
