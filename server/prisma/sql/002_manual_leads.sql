-- 002: manually added leads (crm.ManualLead) with their channel (Instagram, WhatsApp, ...).
-- Additive only, inside the crm schema. Reviewed: no DROP/TRUNCATE.
-- Apply with: npx prisma db execute --file prisma/sql/002_manual_leads.sql --schema prisma/schema.prisma
BEGIN;

-- CreateEnum
CREATE TYPE "crm"."LeadChannel" AS ENUM ('INSTAGRAM', 'WHATSAPP', 'FACEBOOK', 'LINKEDIN', 'GOOGLE_ADS', 'WEBSITE', 'REFERRAL', 'WALK_IN', 'PHONE_CALL', 'EMAIL', 'EVENT', 'OTHER');

-- CreateTable
CREATE TABLE "crm"."ManualLead" (
    "id" SERIAL NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "channel" "crm"."LeadChannel" NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "city" TEXT,
    "company" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManualLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ManualLead_workspaceId_createdAt_idx" ON "crm"."ManualLead"("workspaceId", "createdAt");

-- AddForeignKey
ALTER TABLE "crm"."ManualLead" ADD CONSTRAINT "ManualLead_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "crm"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm"."ManualLead" ADD CONSTRAINT "ManualLead_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "crm"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


COMMIT;
