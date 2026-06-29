ALTER TABLE "categories" ALTER COLUMN "workspace_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "workspace_id" SET NOT NULL;
