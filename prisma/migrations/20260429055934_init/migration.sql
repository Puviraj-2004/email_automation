-- CreateEnum
CREATE TYPE "EmailType" AS ENUM ('PV_EXPERTISE', 'LETTRE', 'PEC', 'OTHER');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "email_accounts" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "imapHost" TEXT NOT NULL,
    "imapPort" INTEGER NOT NULL DEFAULT 993,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emails" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "fromName" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "emailType" "EmailType" NOT NULL DEFAULT 'OTHER',
    "expertRef" TEXT,
    "sinistreRef" TEXT,
    "immatriculation" TEXT,
    "insuredName" TEXT,
    "companyName" TEXT,
    "expertFirm" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_attachments" (
    "id" TEXT NOT NULL,
    "emailId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "robot_runs" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" "RunStatus" NOT NULL DEFAULT 'RUNNING',
    "emailsFetched" INTEGER NOT NULL DEFAULT 0,
    "emailsSkipped" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "fetchFrom" TIMESTAMP(3) NOT NULL,
    "fetchTo" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "robot_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_accounts_email_key" ON "email_accounts"("email");

-- CreateIndex
CREATE UNIQUE INDEX "emails_messageId_key" ON "emails"("messageId");

-- CreateIndex
CREATE INDEX "emails_accountId_idx" ON "emails"("accountId");

-- CreateIndex
CREATE INDEX "emails_receivedAt_idx" ON "emails"("receivedAt");

-- CreateIndex
CREATE INDEX "emails_sinistreRef_idx" ON "emails"("sinistreRef");

-- CreateIndex
CREATE INDEX "emails_immatriculation_idx" ON "emails"("immatriculation");

-- CreateIndex
CREATE INDEX "email_attachments_emailId_idx" ON "email_attachments"("emailId");

-- CreateIndex
CREATE INDEX "robot_runs_accountId_idx" ON "robot_runs"("accountId");

-- CreateIndex
CREATE INDEX "robot_runs_startedAt_idx" ON "robot_runs"("startedAt");

-- AddForeignKey
ALTER TABLE "emails" ADD CONSTRAINT "emails_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "email_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_attachments" ADD CONSTRAINT "email_attachments_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "emails"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "robot_runs" ADD CONSTRAINT "robot_runs_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "email_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
