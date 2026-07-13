import { randomUUID } from 'node:crypto';
import type {
  CreateSchoolTaskInput,
  ListSchoolTaskFilters,
  SchoolTaskRecord,
  SchoolTaskRepository,
} from '../../src/database/repositories/schoolTaskRepository.js';

/** 순수 단위 테스트를 위한 인메모리 SchoolTaskRepository 구현체 (Prisma/DB 미사용). */
export class InMemorySchoolTaskRepository implements SchoolTaskRepository {
  private readonly rows: SchoolTaskRecord[] = [];

  async createIfNotExists(userId: string, input: CreateSchoolTaskInput): Promise<SchoolTaskRecord> {
    const existing = this.rows.find((r) => r.userId === userId && r.idempotencyKey === input.idempotencyKey);
    if (existing) return existing;
    const now = new Date();
    const record: SchoolTaskRecord = {
      id: randomUUID(),
      userId,
      childAlias: input.childAlias ?? null,
      title: input.title,
      description: input.description ?? null,
      category: input.category,
      priority: input.priority,
      dueAt: input.dueAt ?? null,
      status: 'pending',
      requiresSignature: input.requiresSignature,
      requiresPayment: input.requiresPayment,
      sourceSummary: input.sourceSummary ?? null,
      idempotencyKey: input.idempotencyKey,
      completedAt: null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.push(record);
    return record;
  }

  async list(userId: string, filters: ListSchoolTaskFilters): Promise<SchoolTaskRecord[]> {
    let results = this.rows.filter((r) => r.userId === userId && !r.deletedAt);
    if (filters.status && filters.status !== 'all') results = results.filter((r) => r.status === filters.status);
    if (filters.category) results = results.filter((r) => r.category === filters.category);
    if (filters.childAlias) results = results.filter((r) => r.childAlias === filters.childAlias);
    if (filters.from) results = results.filter((r) => r.dueAt && r.dueAt >= filters.from!);
    if (filters.to) results = results.filter((r) => r.dueAt && r.dueAt <= filters.to!);
    return results.slice(0, filters.limit ?? 20);
  }

  async findActiveById(userId: string, taskId: string): Promise<SchoolTaskRecord | null> {
    return this.rows.find((r) => r.id === taskId && r.userId === userId && !r.deletedAt) ?? null;
  }

  async complete(userId: string, taskId: string, completedAt: Date): Promise<SchoolTaskRecord | null> {
    const record = await this.findActiveById(userId, taskId);
    if (!record) return null;
    if (record.status === 'completed') return record;
    record.status = 'completed';
    record.completedAt = completedAt;
    return record;
  }

  async softDelete(userId: string, taskId: string): Promise<SchoolTaskRecord | null> {
    const record = this.rows.find((r) => r.id === taskId && r.userId === userId);
    if (!record) return null;
    if (record.deletedAt) return record;
    record.deletedAt = new Date();
    return record;
  }
}
