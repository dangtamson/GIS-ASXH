CREATE TABLE IF NOT EXISTS gisasxh.social_assistance_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_batch_id UUID NOT NULL,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(uuid) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  program_id UUID NOT NULL REFERENCES gisasxh.social_assistance_programs(id) ON DELETE RESTRICT,
  province_code VARCHAR(20) NOT NULL,
  ward_code VARCHAR(20) NOT NULL,
  area_id UUID REFERENCES gisasxh.areas(id) ON DELETE SET NULL,
  recipient_count INTEGER NOT NULL CHECK (recipient_count > 0),
  delivered_cash_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (delivered_cash_amount >= 0),
  delivered_item_count INTEGER NOT NULL DEFAULT 0 CHECK (delivered_item_count >= 0),
  status VARCHAR(16) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'SUPERSEDED')),
  created_by UUID REFERENCES public.accounts(uuid) ON DELETE SET NULL,
  approved_by UUID REFERENCES public.accounts(uuid) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT social_assistance_publications_period_check CHECK (period_end >= period_start)
);

CREATE INDEX IF NOT EXISTS idx_social_assistance_publications_batch
  ON gisasxh.social_assistance_publications(publication_batch_id);

CREATE INDEX IF NOT EXISTS idx_social_assistance_publications_workspace_status
  ON gisasxh.social_assistance_publications(workspace_id, status, period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_social_assistance_publications_program
  ON gisasxh.social_assistance_publications(program_id);