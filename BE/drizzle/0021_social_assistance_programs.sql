CREATE TABLE IF NOT EXISTS gisasxh.social_assistance_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(uuid) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  public_description TEXT NOT NULL,
  category VARCHAR(80) NOT NULL,
  eligibility_summary TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  created_by UUID REFERENCES public.accounts(uuid) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.accounts(uuid) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT social_assistance_programs_dates_check CHECK (end_date >= start_date),
  CONSTRAINT social_assistance_programs_status_check CHECK (status IN ('DRAFT', 'PUBLISHED', 'CLOSED'))
);

CREATE INDEX IF NOT EXISTS idx_social_assistance_programs_workspace_status
  ON gisasxh.social_assistance_programs(workspace_id, status);

CREATE INDEX IF NOT EXISTS idx_social_assistance_programs_workspace_dates
  ON gisasxh.social_assistance_programs(workspace_id, start_date, end_date);

CREATE TABLE IF NOT EXISTS gisasxh.social_assistance_pledges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(uuid) ON DELETE CASCADE,
  portal_id UUID NOT NULL REFERENCES gisasxh.social_assistance_public_portals(id) ON DELETE RESTRICT,
  program_id UUID NOT NULL REFERENCES gisasxh.social_assistance_programs(id) ON DELETE RESTRICT,
  idempotency_key_hash VARCHAR(64) NOT NULL,
  donor_type VARCHAR(32) NOT NULL,
  donor_name VARCHAR(255) NOT NULL,
  contact_phone VARCHAR(40) NOT NULL,
  contact_email VARCHAR(255),
  pledge_type VARCHAR(16) NOT NULL,
  pledged_amount NUMERIC(14, 2),
  item_description TEXT,
  received_amount NUMERIC(14, 2),
  received_description TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING_REVIEW',
  consent_at TIMESTAMPTZ NOT NULL,
  reviewed_by UUID REFERENCES public.accounts(uuid) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  internal_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT social_assistance_pledges_portal_idempotency_key UNIQUE (portal_id, idempotency_key_hash),
  CONSTRAINT social_assistance_pledges_value_check CHECK (
    (pledge_type = 'CASH' AND pledged_amount > 0 AND item_description IS NULL)
    OR (pledge_type = 'IN_KIND' AND pledged_amount IS NULL AND NULLIF(BTRIM(item_description), '') IS NOT NULL)
  ),
  CONSTRAINT social_assistance_pledges_status_check CHECK (
    status IN ('PENDING_REVIEW', 'REVIEWED', 'RECEIVED', 'RECONCILED', 'REJECTED')
  ),
  CONSTRAINT social_assistance_pledges_received_amount_check CHECK (received_amount IS NULL OR received_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_social_assistance_pledges_workspace_status
  ON gisasxh.social_assistance_pledges(workspace_id, status);

CREATE INDEX IF NOT EXISTS idx_social_assistance_pledges_program
  ON gisasxh.social_assistance_pledges(program_id);