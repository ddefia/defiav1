-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('x', 'youtube', 'website');

-- CreateEnum
CREATE TYPE "SourceStatus" AS ENUM ('pending', 'connected', 'error');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('queued', 'running', 'complete', 'error');

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('post', 'image', 'video', 'page');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_sources" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "SourceType" NOT NULL,
    "handleOrUrl" TEXT NOT NULL,
    "oauthAccessToken" TEXT,
    "oauthRefreshToken" TEXT,
    "tokenExpiry" TIMESTAMP(3),
    "status" "SourceStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_jobs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'queued',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_items" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceType" "SourceType" NOT NULL,
    "contentType" "ContentType" NOT NULL,
    "externalId" TEXT,
    "url" TEXT,
    "text" TEXT,
    "timestamp" TIMESTAMP(3),
    "metricsJson" JSONB,
    "mediaJson" JSONB,
    "rawJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "profileJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "brand_sources_userId_type_handleOrUrl_key" ON "brand_sources"("userId", "type", "handleOrUrl");

-- CreateIndex
CREATE INDEX "content_items_userId_sourceType_idx" ON "content_items"("userId", "sourceType");

-- CreateIndex
CREATE INDEX "content_items_userId_createdAt_idx" ON "content_items"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "brand_profiles_userId_createdAt_idx" ON "brand_profiles"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "brand_sources" ADD CONSTRAINT "brand_sources_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_jobs" ADD CONSTRAINT "brand_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_profiles" ADD CONSTRAINT "brand_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
