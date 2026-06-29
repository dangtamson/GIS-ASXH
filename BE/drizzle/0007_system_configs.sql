CREATE TABLE IF NOT EXISTS "system_configs" (
  "uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" uuid NOT NULL,
  "general" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "sso" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "email" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "updated_by" uuid,
  "created_at" timestamp(6) with time zone DEFAULT now(),
  "updated_at" timestamp(6) with time zone DEFAULT now(),
  CONSTRAINT "system_configs_workspace_id_unique" UNIQUE("workspace_id")
);

DO $$ BEGIN
  ALTER TABLE "system_configs"
    ADD CONSTRAINT "system_configs_workspace_id_workspaces_uuid_fk"
      FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("uuid")
      ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "system_configs"
    ADD CONSTRAINT "system_configs_updated_by_accounts_uuid_fk"
      FOREIGN KEY ("updated_by") REFERENCES "public"."accounts"("uuid")
      ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "idx_system_configs_workspace" ON "system_configs" USING btree ("workspace_id");
