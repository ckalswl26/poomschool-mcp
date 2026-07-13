import type { PrismaClient } from '@prisma/client';

export type TaskCategory =
  | 'document'
  | 'payment'
  | 'preparation'
  | 'application'
  | 'schedule'
  | 'contact'
  | 'health'
  | 'after_school'
  | 'other';

export type TaskPriority = 'low' | 'normal' | 'high';
export type TaskStatus = 'pending' | 'completed';

export interface SchoolTaskRecord {
  id: string;
  userId: string;
  childAlias: string | null;
  title: string;
  description: string | null;
  category: TaskCategory;
  priority: TaskPriority;
  dueAt: Date | null;
  status: TaskStatus;
  requiresSignature: boolean;
  requiresPayment: boolean;
  sourceSummary: string | null;
  idempotencyKey: string;
  completedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSchoolTaskInput {
  childAlias?: string | null;
  title: string;
  description?: string | null;
  category: TaskCategory;
  priority: TaskPriority;
  dueAt?: Date | null;
  requiresSignature: boolean;
  requiresPayment: boolean;
  sourceSummary?: string | null;
  idempotencyKey: string;
}

export interface ListSchoolTaskFilters {
  status?: TaskStatus | 'all';
  from?: Date;
  to?: Date;
  category?: TaskCategory;
  childAlias?: string;
  limit?: number;
}

export interface SchoolTaskRepository {
  createIfNotExists(userId: string, input: CreateSchoolTaskInput): Promise<SchoolTaskRecord>;
  list(userId: string, filters: ListSchoolTaskFilters): Promise<SchoolTaskRecord[]>;
  findActiveById(userId: string, taskId: string): Promise<SchoolTaskRecord | null>;
  complete(userId: string, taskId: string, completedAt: Date): Promise<SchoolTaskRecord | null>;
  softDelete(userId: string, taskId: string): Promise<SchoolTaskRecord | null>;
}

export class PrismaSchoolTaskRepository implements SchoolTaskRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createIfNotExists(userId: string, input: CreateSchoolTaskInput): Promise<SchoolTaskRecord> {
    const existing = await this.prisma.schoolTask.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey: input.idempotencyKey } },
    });
    if (existing) return existing;

    return this.prisma.schoolTask.create({
      data: {
        userId,
        childAlias: input.childAlias ?? null,
        title: input.title,
        description: input.description ?? null,
        category: input.category,
        priority: input.priority,
        dueAt: input.dueAt ?? null,
        requiresSignature: input.requiresSignature,
        requiresPayment: input.requiresPayment,
        sourceSummary: input.sourceSummary ?? null,
        idempotencyKey: input.idempotencyKey,
      },
    });
  }

  async list(userId: string, filters: ListSchoolTaskFilters): Promise<SchoolTaskRecord[]> {
    const where: Record<string, unknown> = {
      userId,
      deletedAt: null,
    };
    if (filters.status && filters.status !== 'all') {
      where.status = filters.status;
    }
    if (filters.category) {
      where.category = filters.category;
    }
    if (filters.childAlias) {
      where.childAlias = filters.childAlias;
    }
    if (filters.from || filters.to) {
      where.dueAt = {
        ...(filters.from ? { gte: filters.from } : {}),
        ...(filters.to ? { lte: filters.to } : {}),
      };
    }
    return this.prisma.schoolTask.findMany({
      where,
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
      take: filters.limit ?? 20,
    });
  }

  async findActiveById(userId: string, taskId: string): Promise<SchoolTaskRecord | null> {
    return this.prisma.schoolTask.findFirst({
      where: { id: taskId, userId, deletedAt: null },
    });
  }

  async complete(userId: string, taskId: string, completedAt: Date): Promise<SchoolTaskRecord | null> {
    const existing = await this.findActiveById(userId, taskId);
    if (!existing) return null;
    if (existing.status === 'completed') return existing;
    return this.prisma.schoolTask.update({
      where: { id: existing.id },
      data: { status: 'completed', completedAt },
    });
  }

  async softDelete(userId: string, taskId: string): Promise<SchoolTaskRecord | null> {
    const existing = await this.prisma.schoolTask.findFirst({ where: { id: taskId, userId } });
    if (!existing) return null;
    if (existing.deletedAt) return existing;
    return this.prisma.schoolTask.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });
  }
}
