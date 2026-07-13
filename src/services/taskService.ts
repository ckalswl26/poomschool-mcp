import type {
  CreateSchoolTaskInput,
  ListSchoolTaskFilters,
  SchoolTaskRecord,
  SchoolTaskRepository,
} from '../database/repositories/schoolTaskRepository.js';
import { classifyDueDate, endOfWeek, startOfWeek } from '../utils/dates.js';
import { AppError } from '../errors/AppError.js';

export interface SaveTaskItemInput {
  title: string;
  description?: string;
  dueAt?: string;
  category: CreateSchoolTaskInput['category'];
  childAlias?: string;
  priority: CreateSchoolTaskInput['priority'];
  requiresSignature: boolean;
  requiresPayment: boolean;
  sourceSummary?: string;
}

export async function saveTasksBatch(
  repo: SchoolTaskRepository,
  userId: string,
  items: SaveTaskItemInput[],
  batchIdempotencyKey: string,
): Promise<SchoolTaskRecord[]> {
  const results: SchoolTaskRecord[] = [];
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (!item) continue;
    const rowKey = `${batchIdempotencyKey}::${i}`;
    const created = await repo.createIfNotExists(userId, {
      title: item.title,
      description: item.description ?? null,
      dueAt: item.dueAt ? new Date(item.dueAt) : null,
      category: item.category,
      childAlias: item.childAlias ?? null,
      priority: item.priority,
      requiresSignature: item.requiresSignature,
      requiresPayment: item.requiresPayment,
      sourceSummary: item.sourceSummary ?? null,
      idempotencyKey: rowKey,
    });
    results.push(created);
  }
  return results;
}

export interface GroupedTasks {
  overdue: SchoolTaskRecord[];
  today: SchoolTaskRecord[];
  thisWeek: SchoolTaskRecord[];
  later: SchoolTaskRecord[];
  noDueDate: SchoolTaskRecord[];
  completed: SchoolTaskRecord[];
}

export function groupTasksForDisplay(tasks: SchoolTaskRecord[], now: Date = new Date()): GroupedTasks {
  const grouped: GroupedTasks = {
    overdue: [],
    today: [],
    thisWeek: [],
    later: [],
    noDueDate: [],
    completed: [],
  };
  for (const task of tasks) {
    if (task.status === 'completed') {
      grouped.completed.push(task);
      continue;
    }
    const bucket = classifyDueDate(task.dueAt, now);
    if (bucket === 'overdue') grouped.overdue.push(task);
    else if (bucket === 'today') grouped.today.push(task);
    else if (bucket === 'this_week') grouped.thisWeek.push(task);
    else if (bucket === 'later') grouped.later.push(task);
    else grouped.noDueDate.push(task);
  }
  return grouped;
}

export async function listTasksForParent(
  repo: SchoolTaskRepository,
  userId: string,
  filters: ListSchoolTaskFilters,
): Promise<GroupedTasks> {
  const tasks = await repo.list(userId, filters);
  return groupTasksForDisplay(tasks);
}

export async function completeParentTask(
  repo: SchoolTaskRepository,
  userId: string,
  taskId: string,
  completedAt?: string,
): Promise<SchoolTaskRecord> {
  const result = await repo.complete(userId, taskId, completedAt ? new Date(completedAt) : new Date());
  if (!result) {
    throw new AppError('NOT_FOUND', '해당 학교 할 일을 찾을 수 없습니다. 이미 삭제되었거나 존재하지 않는 항목입니다.');
  }
  return result;
}

export async function deleteParentTask(
  repo: SchoolTaskRepository,
  userId: string,
  taskId: string,
  confirm: boolean,
): Promise<{ deleted: boolean; alreadyDeleted: boolean }> {
  if (!confirm) {
    throw new AppError('VALIDATION_ERROR', '삭제를 진행하려면 confirm 값을 true로 지정해 주세요.');
  }
  const before = await repo.findActiveById(userId, taskId);
  const result = await repo.softDelete(userId, taskId);
  if (!result) {
    throw new AppError('NOT_FOUND', '해당 학교 할 일을 찾을 수 없습니다.');
  }
  return { deleted: true, alreadyDeleted: before === null };
}

export interface WeeklyBriefData {
  weekStart: Date;
  weekEnd: Date;
  overdue: SchoolTaskRecord[];
  dueToday: SchoolTaskRecord[];
  byDateThisWeek: Map<string, SchoolTaskRecord[]>;
  needsSignature: SchoolTaskRecord[];
  needsPaymentCheck: SchoolTaskRecord[];
  needsMaterials: SchoolTaskRecord[];
  needsSchoolContact: SchoolTaskRecord[];
  incompleteHighPriority: SchoolTaskRecord[];
  completedThisWeek: SchoolTaskRecord[];
}

export async function buildWeeklyBrief(
  repo: SchoolTaskRepository,
  userId: string,
  params: { weekStart?: string; includeCompleted: boolean; childAlias?: string },
  now: Date = new Date(),
): Promise<WeeklyBriefData> {
  const weekStart = params.weekStart ? startOfWeek(new Date(params.weekStart)) : startOfWeek(now);
  const weekEnd = endOfWeek(weekStart);

  const pendingTasks = await repo.list(userId, {
    status: 'pending',
    childAlias: params.childAlias,
    limit: 100,
  });

  const today0 = new Date(now);
  today0.setHours(0, 0, 0, 0);

  const overdue = pendingTasks.filter((t) => t.dueAt && t.dueAt.getTime() < today0.getTime());
  const dueToday = pendingTasks.filter(
    (t) => t.dueAt && t.dueAt.getTime() >= today0.getTime() && t.dueAt.getTime() < today0.getTime() + 86_400_000,
  );

  const byDateThisWeek = new Map<string, SchoolTaskRecord[]>();
  for (const task of pendingTasks) {
    if (!task.dueAt) continue;
    if (task.dueAt.getTime() < weekStart.getTime() || task.dueAt.getTime() > weekEnd.getTime()) continue;
    if (overdue.includes(task) || dueToday.includes(task)) continue;
    const key = task.dueAt.toISOString().slice(0, 10);
    const list = byDateThisWeek.get(key) ?? [];
    list.push(task);
    byDateThisWeek.set(key, list);
  }

  const relevantTasks = [...overdue, ...dueToday, ...[...byDateThisWeek.values()].flat()];

  let completedThisWeek: SchoolTaskRecord[] = [];
  if (params.includeCompleted) {
    const completed = await repo.list(userId, {
      status: 'completed',
      childAlias: params.childAlias,
      limit: 50,
    });
    completedThisWeek = completed.filter(
      (t) => t.completedAt && t.completedAt.getTime() >= weekStart.getTime() && t.completedAt.getTime() <= weekEnd.getTime(),
    );
  }

  return {
    weekStart,
    weekEnd,
    overdue,
    dueToday,
    byDateThisWeek,
    needsSignature: relevantTasks.filter((t) => t.requiresSignature),
    needsPaymentCheck: relevantTasks.filter((t) => t.requiresPayment),
    needsMaterials: relevantTasks.filter((t) => t.category === 'preparation'),
    needsSchoolContact: relevantTasks.filter((t) => t.category === 'contact'),
    incompleteHighPriority: pendingTasks.filter((t) => t.priority === 'high'),
    completedThisWeek,
  };
}
