ALTER TABLE gisasxh.poor_households
  ADD COLUMN IF NOT EXISTS province_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS ward_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS area_id UUID;

CREATE TABLE IF NOT EXISTS gisasxh.areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  province_code VARCHAR(20) NOT NULL,
  ward_code VARCHAR(20) NOT NULL,
  code TEXT,
  name TEXT NOT NULL,
  secretary_name TEXT,
  secretary_phone TEXT,
  hamlet_head_name TEXT,
  hamlet_head_phone TEXT,
  security_team_leader_name TEXT,
  security_team_leader_phone TEXT,
  natural_area DOUBLE PRECISION,
  description TEXT,
  note TEXT,
  status BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP(6) DEFAULT NOW(),
  updated_at TIMESTAMP(6) DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS areas_ward_code_name_key
  ON gisasxh.areas(ward_code, name);

CREATE INDEX IF NOT EXISTS idx_areas_province_code
  ON gisasxh.areas(province_code);

CREATE INDEX IF NOT EXISTS idx_areas_ward_code
  ON gisasxh.areas(ward_code);

CREATE INDEX IF NOT EXISTS idx_areas_status
  ON gisasxh.areas(status);

ALTER TABLE gisasxh.poor_households
  ADD CONSTRAINT poor_households_area_id_fkey
  FOREIGN KEY (area_id) REFERENCES gisasxh.areas(id);

CREATE TABLE IF NOT EXISTS gisasxh.poverty_ward_overviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  province_code VARCHAR(20) NOT NULL,
  ward_code VARCHAR(20) NOT NULL,
  year INTEGER NOT NULL,
  population INTEGER NOT NULL DEFAULT 0,
  total_households INTEGER NOT NULL DEFAULT 0,
  total_members INTEGER NOT NULL DEFAULT 0,
  natural_area DOUBLE PRECISION NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMP(6) DEFAULT NOW(),
  updated_at TIMESTAMP(6) DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS poverty_ward_overviews_province_ward_year_key
  ON gisasxh.poverty_ward_overviews(province_code, ward_code, year);

CREATE INDEX IF NOT EXISTS idx_poverty_ward_overviews_province_code
  ON gisasxh.poverty_ward_overviews(province_code);

CREATE INDEX IF NOT EXISTS idx_poverty_ward_overviews_ward_code
  ON gisasxh.poverty_ward_overviews(ward_code);

CREATE INDEX IF NOT EXISTS idx_poverty_ward_overviews_province_ward_year
  ON gisasxh.poverty_ward_overviews(province_code, ward_code, year DESC);
