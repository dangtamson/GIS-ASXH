ALTER TABLE bandoansinhcongdong.social_assistance_public_portals
  ADD COLUMN IF NOT EXISTS allocations_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS bandoansinhcongdong.social_assistance_distribution_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(uuid) ON DELETE CASCADE,
  program_id UUID REFERENCES bandoansinhcongdong.social_assistance_programs(id) ON DELETE RESTRICT,
  supersedes_batch_id UUID REFERENCES bandoansinhcongdong.social_assistance_distribution_batches(id) ON DELETE SET NULL,
  document_number VARCHAR(100) NOT NULL,
  document_date DATE NOT NULL,
  title VARCHAR(255) NOT NULL,
  funding_source_text TEXT NOT NULL,
  support_item_name VARCHAR(255) NOT NULL,
  unit_label VARCHAR(40) NOT NULL,
  unit_amount NUMERIC(14, 2) NOT NULL,
  declared_total_quantity INTEGER NOT NULL,
  declared_total_amount NUMERIC(14, 2) NOT NULL,
  eligibility_summary TEXT NOT NULL,
  eligibility_approval_year INTEGER,
  submission_deadline DATE,
  completion_deadline DATE,
  status VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
  created_by UUID REFERENCES public.accounts(uuid) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.accounts(uuid) ON DELETE SET NULL,
  published_by UUID REFERENCES public.accounts(uuid) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  closed_by UUID REFERENCES public.accounts(uuid) ON DELETE SET NULL,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT social_assistance_distribution_batches_workspace_document_key UNIQUE (workspace_id, document_number),
  CONSTRAINT social_assistance_distribution_batches_status_check CHECK (status IN ('DRAFT', 'PUBLISHED', 'CLOSED')),
  CONSTRAINT social_assistance_distribution_batches_amounts_check CHECK (
    unit_amount > 0 AND declared_total_quantity > 0 AND declared_total_amount > 0
  ),
  CONSTRAINT social_assistance_distribution_batches_deadline_check CHECK (
    submission_deadline IS NULL OR completion_deadline IS NULL OR completion_deadline >= submission_deadline
  )
);

CREATE INDEX IF NOT EXISTS idx_social_assistance_distribution_batches_workspace_status_date
  ON bandoansinhcongdong.social_assistance_distribution_batches(workspace_id, status, document_date);

CREATE INDEX IF NOT EXISTS idx_social_assistance_distribution_batches_program
  ON bandoansinhcongdong.social_assistance_distribution_batches(program_id);

CREATE INDEX IF NOT EXISTS idx_social_assistance_distribution_batches_supersedes
  ON bandoansinhcongdong.social_assistance_distribution_batches(supersedes_batch_id);

CREATE TABLE IF NOT EXISTS bandoansinhcongdong.social_assistance_distribution_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES bandoansinhcongdong.social_assistance_distribution_batches(id) ON DELETE RESTRICT,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(uuid) ON DELETE CASCADE,
  province_code VARCHAR(20) NOT NULL,
  ward_code VARCHAR(20) NOT NULL,
  allocated_quantity INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT social_assistance_distribution_lines_batch_location_key UNIQUE (batch_id, province_code, ward_code),
  CONSTRAINT social_assistance_distribution_lines_quantity_check CHECK (allocated_quantity > 0)
);

CREATE INDEX IF NOT EXISTS idx_social_assistance_distribution_lines_workspace_batch
  ON bandoansinhcongdong.social_assistance_distribution_lines(workspace_id, batch_id);

CREATE INDEX IF NOT EXISTS idx_social_assistance_distribution_lines_location
  ON bandoansinhcongdong.social_assistance_distribution_lines(province_code, ward_code);