-- CreateEnum
CREATE TYPE "ExplanationLevel" AS ENUM ('easy', 'standard');

-- CreateEnum
CREATE TYPE "TaskCategory" AS ENUM ('document', 'payment', 'preparation', 'application', 'schedule', 'contact', 'health', 'after_school', 'other');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('low', 'normal', 'high');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('pending', 'completed');

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL,
    "oauthSubject" TEXT NOT NULL,
    "preferredLanguageCode" TEXT NOT NULL DEFAULT 'ko',
    "preferredLanguageName" TEXT,
    "explanationLevel" "ExplanationLevel" NOT NULL DEFAULT 'standard',
    "showEasyKorean" BOOLEAN NOT NULL DEFAULT true,
    "showOriginalText" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "school_tasks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "childAlias" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "TaskCategory" NOT NULL DEFAULT 'other',
    "priority" "TaskPriority" NOT NULL DEFAULT 'normal',
    "dueAt" TIMESTAMP(3),
    "status" "TaskStatus" NOT NULL DEFAULT 'pending',
    "requiresSignature" BOOLEAN NOT NULL DEFAULT false,
    "requiresPayment" BOOLEAN NOT NULL DEFAULT false,
    "sourceSummary" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_cache" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "targetLanguage" TEXT NOT NULL,
    "explanationLevel" TEXT NOT NULL,
    "resultJson" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analysis_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_oauthSubject_key" ON "user_profiles"("oauthSubject");

-- CreateIndex
CREATE INDEX "school_tasks_userId_status_dueAt_idx" ON "school_tasks"("userId", "status", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "school_tasks_userId_idempotencyKey_key" ON "school_tasks"("userId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "analysis_cache_expiresAt_idx" ON "analysis_cache"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "analysis_cache_userId_contentHash_targetLanguage_explanatio_key" ON "analysis_cache"("userId", "contentHash", "targetLanguage", "explanationLevel");
