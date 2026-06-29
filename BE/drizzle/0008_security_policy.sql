-- Add security_policy column to system_configs table
ALTER TABLE "system_configs" ADD COLUMN "security_policy" jsonb NOT NULL DEFAULT '{}'::jsonb;
