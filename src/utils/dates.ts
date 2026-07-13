const DAY_MS = 24 * 60 * 60 * 1000;

export function isValidIsoDate(value: string): boolean {
  if (Number.isNaN(Date.parse(value))) return false;
  return true;
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** 월요일을 주의 시작으로 하는 해당 주의 시작일(00:00:00)을 반환한다. */
export function startOfWeek(date: Date): Date {
  const d = startOfDay(date);
  const day = d.getDay(); // 0=Sun .. 6=Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  return d;
}

export function endOfWeek(date: Date): Date {
  const start = startOfWeek(date);
  const end = new Date(start.getTime() + 6 * DAY_MS);
  return endOfDay(end);
}

export type TaskDueBucket = 'overdue' | 'today' | 'this_week' | 'later' | 'no_due_date';

export function classifyDueDate(dueAt: Date | null, now: Date = new Date()): TaskDueBucket {
  if (!dueAt) return 'no_due_date';
  const today0 = startOfDay(now);
  const dueDay = startOfDay(dueAt);
  if (dueDay.getTime() < today0.getTime()) return 'overdue';
  if (dueDay.getTime() === today0.getTime()) return 'today';
  const weekEnd = endOfWeek(now);
  if (dueDay.getTime() <= weekEnd.getTime()) return 'this_week';
  return 'later';
}

export function formatKoreanDate(date: Date): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${y}년 ${m}월 ${d}일`;
}
