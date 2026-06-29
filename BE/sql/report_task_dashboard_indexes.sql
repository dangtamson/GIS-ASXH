-- Run manually on PostgreSQL.
-- Recommended: execute each statement separately in a maintenance window.

create index concurrently if not exists idx_tasks_dashboard_workspace_active
  on tasks (workspace_id, created_at desc)
  where deleted_at is null;

create index concurrently if not exists idx_tasks_dashboard_workspace_org_active
  on tasks (workspace_id, organization_id, created_at desc)
  where deleted_at is null;

create index concurrently if not exists idx_tasks_dashboard_workspace_status_active
  on tasks (workspace_id, status, created_at desc)
  where deleted_at is null;

create index concurrently if not exists idx_tasks_dashboard_workspace_start_date_active
  on tasks (workspace_id, start_date)
  where deleted_at is null;

create index concurrently if not exists idx_documents_dashboard_workspace_active
  on documents (workspace_id, issued_date desc)
  where deleted_at is null;

create index concurrently if not exists idx_task_assignments_dashboard_task_org
  on task_assignments (task_id, assigned_to_org_id);

create index concurrently if not exists idx_task_assignments_dashboard_assigned_at
  on task_assignments (assigned_at desc, task_id);

create index concurrently if not exists idx_task_progress_dashboard_task
  on task_progress (task_id);
