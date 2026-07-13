import { describe, expect, it } from 'vitest';
import { InMemorySchoolTaskRepository } from '../helpers/inMemorySchoolTaskRepository.js';
import {
  completeParentTask,
  deleteParentTask,
  groupTasksForDisplay,
  saveTasksBatch,
} from '../../src/services/taskService.js';
import { AppError } from '../../src/errors/AppError.js';
import type { SchoolTaskRecord } from '../../src/database/repositories/schoolTaskRepository.js';

function baseTask(overrides: Partial<SchoolTaskRecord>): SchoolTaskRecord {
  const now = new Date();
  return {
    id: 'id',
    userId: 'user-1',
    childAlias: null,
    title: '제목',
    description: null,
    category: 'other',
    priority: 'normal',
    dueAt: null,
    status: 'pending',
    requiresSignature: false,
    requiresPayment: false,
    sourceSummary: null,
    idempotencyKey: 'key',
    completedAt: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('saveTasksBatch (idempotency)', () => {
  it('동일 idempotency_key로 재호출해도 중복 저장하지 않는다', async () => {
    const repo = new InMemorySchoolTaskRepository();
    const items = [
      {
        title: '신청서 제출',
        category: 'application' as const,
        priority: 'normal' as const,
        requiresSignature: false,
        requiresPayment: false,
      },
    ];
    const first = await saveTasksBatch(repo, 'user-1', items, 'batch-key');
    const second = await saveTasksBatch(repo, 'user-1', items, 'batch-key');
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
    expect(first[0]?.id).toBe(second[0]?.id);

    const all = await repo.list('user-1', { status: 'all', limit: 50 });
    expect(all).toHaveLength(1);
  });

  it('배치 내 서로 다른 항목은 각각 저장된다', async () => {
    const repo = new InMemorySchoolTaskRepository();
    const items = [
      { title: '할일 1', category: 'other' as const, priority: 'normal' as const, requiresSignature: false, requiresPayment: false },
      { title: '할일 2', category: 'other' as const, priority: 'normal' as const, requiresSignature: false, requiresPayment: false },
    ];
    const result = await saveTasksBatch(repo, 'user-1', items, 'batch-key-2');
    expect(result).toHaveLength(2);
    expect(result[0]?.id).not.toBe(result[1]?.id);
  });
});

describe('groupTasksForDisplay', () => {
  it('상태와 기한에 따라 올바른 버킷으로 분류한다', () => {
    const now = new Date('2026-07-13T09:00:00+09:00');
    const tasks = [
      baseTask({ id: '1', dueAt: new Date('2026-07-10T00:00:00+09:00') }), // overdue
      baseTask({ id: '2', dueAt: new Date('2026-07-13T20:00:00+09:00') }), // today
      baseTask({ id: '3', dueAt: new Date('2026-07-16T00:00:00+09:00') }), // this_week
      baseTask({ id: '4', dueAt: new Date('2026-08-01T00:00:00+09:00') }), // later
      baseTask({ id: '5', dueAt: null }), // noDueDate
      baseTask({ id: '6', status: 'completed' }), // completed
    ];
    const grouped = groupTasksForDisplay(tasks, now);
    expect(grouped.overdue.map((t) => t.id)).toEqual(['1']);
    expect(grouped.today.map((t) => t.id)).toEqual(['2']);
    expect(grouped.thisWeek.map((t) => t.id)).toEqual(['3']);
    expect(grouped.later.map((t) => t.id)).toEqual(['4']);
    expect(grouped.noDueDate.map((t) => t.id)).toEqual(['5']);
    expect(grouped.completed.map((t) => t.id)).toEqual(['6']);
  });
});

describe('completeParentTask', () => {
  it('이미 완료된 업무를 다시 완료해도 동일한 상태를 반환한다', async () => {
    const repo = new InMemorySchoolTaskRepository();
    const created = await repo.createIfNotExists('user-1', {
      title: '할일',
      category: 'other',
      priority: 'normal',
      requiresSignature: false,
      requiresPayment: false,
      idempotencyKey: 'k1',
    });
    const first = await completeParentTask(repo, 'user-1', created.id);
    const second = await completeParentTask(repo, 'user-1', created.id);
    expect(first.status).toBe('completed');
    expect(second.status).toBe('completed');
  });

  it('존재하지 않는 업무는 AppError(NOT_FOUND)를 던진다', async () => {
    const repo = new InMemorySchoolTaskRepository();
    await expect(completeParentTask(repo, 'user-1', 'missing-id')).rejects.toBeInstanceOf(AppError);
  });
});

describe('deleteParentTask', () => {
  it('confirm이 false면 삭제하지 않고 오류를 던진다', async () => {
    const repo = new InMemorySchoolTaskRepository();
    const created = await repo.createIfNotExists('user-1', {
      title: '할일',
      category: 'other',
      priority: 'normal',
      requiresSignature: false,
      requiresPayment: false,
      idempotencyKey: 'k1',
    });
    await expect(deleteParentTask(repo, 'user-1', created.id, false)).rejects.toBeInstanceOf(AppError);
    const stillActive = await repo.findActiveById('user-1', created.id);
    expect(stillActive).not.toBeNull();
  });

  it('confirm이 true면 soft delete하고, 재삭제도 안전하게 처리한다', async () => {
    const repo = new InMemorySchoolTaskRepository();
    const created = await repo.createIfNotExists('user-1', {
      title: '할일',
      category: 'other',
      priority: 'normal',
      requiresSignature: false,
      requiresPayment: false,
      idempotencyKey: 'k1',
    });
    const first = await deleteParentTask(repo, 'user-1', created.id, true);
    expect(first.deleted).toBe(true);
    expect(first.alreadyDeleted).toBe(false);

    const second = await deleteParentTask(repo, 'user-1', created.id, true);
    expect(second.alreadyDeleted).toBe(true);

    const activeLookup = await repo.findActiveById('user-1', created.id);
    expect(activeLookup).toBeNull();
  });
});
