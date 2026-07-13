import { describe, expect, it } from 'vitest';
import { classifyDueDate, endOfWeek, startOfWeek } from '../../src/utils/dates.js';

describe('classifyDueDate', () => {
  const now = new Date('2026-07-13T09:00:00+09:00'); // 월요일

  it('null이면 no_due_date', () => {
    expect(classifyDueDate(null, now)).toBe('no_due_date');
  });

  it('과거 날짜는 overdue', () => {
    expect(classifyDueDate(new Date('2026-07-10T00:00:00+09:00'), now)).toBe('overdue');
  });

  it('오늘 날짜는 today', () => {
    expect(classifyDueDate(new Date('2026-07-13T23:00:00+09:00'), now)).toBe('today');
  });

  it('이번 주 안의 미래 날짜는 this_week', () => {
    expect(classifyDueDate(new Date('2026-07-16T00:00:00+09:00'), now)).toBe('this_week');
  });

  it('다음 주 이후 날짜는 later', () => {
    expect(classifyDueDate(new Date('2026-07-25T00:00:00+09:00'), now)).toBe('later');
  });
});

describe('startOfWeek / endOfWeek', () => {
  it('월요일을 주의 시작으로 계산한다', () => {
    const wednesday = new Date('2026-07-15T15:00:00+09:00');
    const start = startOfWeek(wednesday);
    expect(start.getDay()).toBe(1);
    const end = endOfWeek(wednesday);
    expect(end.getDay()).toBe(0);
  });
});
