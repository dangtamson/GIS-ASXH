CREATE TABLE IF NOT EXISTS gisasxh.household_supports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES gisasxh.poor_households(id),
  support_date DATE NOT NULL,
  support_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  amounts JSONB NOT NULL DEFAULT '{}'::jsonb,
  content TEXT,
  supporting_unit TEXT,
  note TEXT,
  created_at TIMESTAMP(6) DEFAULT NOW(),
  updated_at TIMESTAMP(6) DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_household_supports_household_id ON gisasxh.household_supports(household_id);
CREATE INDEX IF NOT EXISTS idx_household_supports_support_date ON gisasxh.household_supports(support_date);
