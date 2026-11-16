CREATE TABLE IF NOT EXISTS gisasxh.social_assistance_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(uuid) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES gisasxh.social_assistance_programs(id) ON DELETE RESTRICT,
  request_id UUID NOT NULL REFERENCES gisasxh.social_assistance_requests(id) ON DELETE RESTRICT,
  planned_cash_amount NUMERIC(14, 2),
  planned_item_description TEXT,
  delivered_cash_amount NUMERIC(14, 2),
  delivered_item_description TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'PLANNED',
  delivery_date DATE,
  created_by UUID REFERENCES public.accounts(uuid) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.accounts(uuid) ON DELETE SET NULL,
  internal_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT social_assistance_allocations_program_request_key UNIQUE (program_id, request_id),
  CONSTRAINT social_assistance_allocations_status_check CHECK (status IN ('PLANNED', 'APPROVED', 'DELIVERED', 'RECONCILED')),
  CONSTRAINT social_assistance_allocations_plan_value_check CHECK (
    (planned_cash_amount > 0 AND planned_item_description IS NULL)
    OR (planned_cash_amount IS NULL AND NULLIF(BTRIM(planned_item_description), '') IS NOT NULL)
  ),
  CONSTRAINT social_assistance_allocations_delivered_value_check CHECK (
    delivered_cash_amount IS NULL OR delivered_cash_amount >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_social_assistance_allocations_workspace_status
  ON gisasxh.social_assistance_allocations(workspace_id, status);

CREATE INDEX IF NOT EXISTS idx_social_assistance_allocations_program
  ON gisasxh.social_assistance_allocations(program_id);

CREATE INDEX IF NOT EXISTS idx_social_assistance_allocations_request
  ON gisasxh.social_assistance_allocations(request_id);