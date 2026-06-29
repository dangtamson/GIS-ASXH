-- Create role_features table to map roles to accessible features
CREATE TABLE IF NOT EXISTS role_features (
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  feature_id UUID NOT NULL REFERENCES features(uuid) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (role_id, feature_id),
  UNIQUE(role_id, feature_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_role_features_role_id ON role_features(role_id);
CREATE INDEX IF NOT EXISTS idx_role_features_feature_id ON role_features(feature_id);
