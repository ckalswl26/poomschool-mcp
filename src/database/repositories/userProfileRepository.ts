import type { PrismaClient } from '@prisma/client';

export type ExplanationLevel = 'easy' | 'standard';

export interface UserProfileRecord {
  id: string;
  oauthSubject: string;
  preferredLanguageCode: string;
  preferredLanguageName: string | null;
  explanationLevel: ExplanationLevel;
  showEasyKorean: boolean;
  showOriginalText: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertUserProfileInput {
  preferredLanguageCode: string;
  preferredLanguageName?: string | null;
  explanationLevel: ExplanationLevel;
  showEasyKorean: boolean;
  showOriginalText: boolean;
}

export interface UserProfileRepository {
  findBySubject(oauthSubject: string): Promise<UserProfileRecord | null>;
  upsert(oauthSubject: string, input: UpsertUserProfileInput): Promise<UserProfileRecord>;
}

export class PrismaUserProfileRepository implements UserProfileRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findBySubject(oauthSubject: string): Promise<UserProfileRecord | null> {
    return this.prisma.userProfile.findUnique({ where: { oauthSubject } });
  }

  async upsert(oauthSubject: string, input: UpsertUserProfileInput): Promise<UserProfileRecord> {
    return this.prisma.userProfile.upsert({
      where: { oauthSubject },
      create: { oauthSubject, ...input },
      update: { ...input },
    });
  }
}
