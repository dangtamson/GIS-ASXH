CREATE TABLE IF NOT EXISTS gisasxh.poverty_ward_public_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(uuid),
  province_code VARCHAR(20) NOT NULL,
  ward_code VARCHAR(20) NOT NULL,
  public_slug VARCHAR(120) NOT NULL,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.accounts(uuid),
  updated_by UUID REFERENCES public.accounts(uuid),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS poverty_ward_public_links_workspace_ward_key
  ON gisasxh.poverty_ward_public_links(workspace_id, province_code, ward_code);

CREATE UNIQUE INDEX IF NOT EXISTS poverty_ward_public_links_slug_key
  ON gisasxh.poverty_ward_public_links(public_slug);

CREATE INDEX IF NOT EXISTS idx_poverty_ward_public_links_workspace
  ON gisasxh.poverty_ward_public_links(workspace_id);

CREATE INDEX IF NOT EXISTS idx_poverty_ward_public_links_slug
  ON gisasxh.poverty_ward_public_links(public_slug);
