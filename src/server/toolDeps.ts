import type { AiProvider } from '../services/ai/AiProvider.js';
import type { UserProfileRepository } from '../database/repositories/userProfileRepository.js';
import type { SchoolTaskRepository } from '../database/repositories/schoolTaskRepository.js';
import type { AnalysisCacheRepository } from '../database/repositories/analysisCacheRepository.js';
import type { AppLogger } from '../config/logger.js';

export interface ToolDeps {
  aiProvider: AiProvider;
  userProfileRepo: UserProfileRepository;
  schoolTaskRepo: SchoolTaskRepository;
  analysisCacheRepo: AnalysisCacheRepository;
  cacheEnabled: boolean;
  cacheTtlSeconds: number;
  logger: AppLogger;
}
