CREATE TABLE IF NOT EXISTS gisasxh.social_assistance_public_portals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(uuid) ON DELETE CASCADE,
  public_slug VARCHAR(120) NOT NULL,
  intake_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  programs_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  results_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES public.accounts(uuid) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.accounts(uuid) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT social_assistance_public_portals_workspace_key UNIQUE (workspace_id),
  CONSTRAINT social_assistance_public_portals_slug_key UNIQUE (public_slug)
);

CREATE INDEX IF NOT EXISTS idx_social_assistance_portals_workspace
  ON gisasxh.social_assistance_public_portals(workspace_id);

CREATE TABLE IF NOT EXISTS gisasxh.social_assistance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(uuid) ON DELETE CASCADE,
  portal_id UUID NOT NULL REFERENCES gisasxh.social_assistance_public_portals(id) ON DELETE RESTRICT,
  receipt_code VARCHAR(40) NOT NULL,
  idempotency_key_hash VARCHAR(64) NOT NULL,
  source VARCHAR(32) NOT NULL,
  contact_name VARCHAR(255) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  need_category VARCHAR(80) NOT NULL,
  need_description TEXT NOT NULL,
  address TEXT NOT NULL,
  province_code VARCHAR(20) NOT NULL,
  ward_code VARCHAR(20) NOT NULL,
  area_id UUID REFERENCES gisasxh.areas(id) ON DELETE SET NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  consent_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'RECEIVED',
  matched_household_id UUID REFERENCES gisasxh.poor_households(id) ON DELETE SET NULL,
  verified_by UUID REFERENCES public.accounts(uuid) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  internal_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT social_assistance_requests_receipt_code_key UNIQUE (receipt_code),
  CONSTRAINT social_assistance_requests_portal_idempotency_key UNIQUE (portal_id, idempotency_key_hash)
);

CREATE INDEX IF NOT EXISTS idx_social_assistance_requests_workspace_status
  ON gisasxh.social_assistance_requests(workspace_id, status);

CREATE INDEX IF NOT EXISTS idx_social_assistance_requests_workspace_ward
  ON gisasxh.social_assistance_requests(workspace_id, ward_code);

CREATE INDEX IF NOT EXISTS idx_social_assistance_requests_area
  ON gisasxh.social_assistance_requests(area_id);

CREATE INDEX IF NOT EXISTS idx_social_assistance_requests_portal
  ON gisasxh.social_assistance_requests(portal_id);

CREATE INDEX IF NOT EXISTS idx_social_assistance_requests_household
  ON gisasxh.social_assistance_requests(matched_household_id);