-- Add security tracking columns to accounts table
ALTER TABLE "accounts" ADD COLUMN "password_change_required" boolean NOT NULL DEFAULT false;
ALTER TABLE "accounts" ADD COLUMN "last_password_changed_at" timestamp with time zone;
ALTER TABLE "accounts" ADD COLUMN "is_locked" boolean NOT NULL DEFAULT false;
ALTER TABLE "accounts" ADD COLUMN "locked_until" timestamp with time zone;
ALTER TABLE "accounts" ADD COLUMN "failed_login_attempts" integer NOT NULL DEFAULT 0;
ALTER TABLE "accounts" ADD COLUMN "last_failed_login_at" timestamp with time zone;

-- Create login_attempts table to track login history
CREATE TABLE "login_attempts" (
  "uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "account_id" uuid NOT NULL REFERENCES "accounts"("uuid") ON DELETE CASCADE,
  "email" text NOT NULL,
  "success" boolean NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "reason_code" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Create indexes for efficient lookups
CREATE INDEX "idx_login_attempts_account_id" ON "login_attempts"("account_id");
CREATE INDEX "idx_login_attempts_created_at" ON "login_attempts"("created_at" DESC);
CREATE INDEX "idx_accounts_email" ON "accounts"("email");
CREATE INDEX "idx_accounts_is_locked" ON "accounts"("is_locked");
