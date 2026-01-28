-- AlterTable
ALTER TABLE "brand_profiles" ADD COLUMN     "brandHandle" TEXT,
ADD COLUMN     "isExternal" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "brand_profiles_userId_brandHandle_idx" ON "brand_profiles"("userId", "brandHandle");

-- CreateIndex
CREATE INDEX "brand_profiles_brandHandle_idx" ON "brand_profiles"("brandHandle");
