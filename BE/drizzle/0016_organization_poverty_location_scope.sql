ALTER TABLE organizations
  ADD COLUMN province_code varchar(20),
  ADD COLUMN ward_code varchar(20),
  ADD COLUMN area_id uuid;

CREATE INDEX IF NOT EXISTS idx_org_province_code ON organizations (province_code);
CREATE INDEX IF NOT EXISTS idx_org_ward_code ON organizations (ward_code);
CREATE INDEX IF NOT EXISTS idx_org_area_id ON organizations (area_id);
