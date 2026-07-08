CREATE TABLE IF NOT EXISTS gisasxh.household_context_histories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES gisasxh.poor_households(id),
  recorded_at DATE NOT NULL,
  family_situation TEXT,
  current_status TEXT,
  note TEXT,
  created_at TIMESTAMP(6) DEFAULT NOW(),
  updated_at TIMESTAMP(6) DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_household_context_histories_household_id
  ON gisasxh.household_context_histories(household_id);

CREATE INDEX IF NOT EXISTS idx_household_context_histories_recorded_at
  ON gisasxh.household_context_histories(recorded_at DESC, created_at DESC);