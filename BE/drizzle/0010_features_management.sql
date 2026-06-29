-- Create features table for managing dynamic menus
CREATE TABLE features (
  uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(uuid) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  code VARCHAR(100) NOT NULL,
  icon VARCHAR(255),
  "path" VARCHAR(255) NOT NULL,
  group_name VARCHAR(100) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  requires_super_admin BOOLEAN DEFAULT false,
  requires_workspace_admin BOOLEAN DEFAULT false,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES accounts(uuid),
  updated_by UUID REFERENCES accounts(uuid),
  CONSTRAINT unique_workspace_feature_code UNIQUE(workspace_id, code)
);

-- Create feature sub-items table for nested menus
CREATE TABLE feature_sub_items (
  uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id UUID NOT NULL REFERENCES features(uuid) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  "path" VARCHAR(255) NOT NULL,
  order_index INTEGER DEFAULT 0,
  is_new BOOLEAN DEFAULT false,
  is_pro BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_features_workspace_id ON features(workspace_id);
CREATE INDEX idx_features_group_name ON features(group_name);
CREATE INDEX idx_features_enabled ON features(enabled);
CREATE INDEX idx_features_workspace_enabled ON features(workspace_id, enabled);
CREATE INDEX idx_feature_sub_items_feature_id ON feature_sub_items(feature_id);

-- Seed default features for new workspaces
-- Main menu features
INSERT INTO features (workspace_id, name, description, code, path, group_name, enabled, order_index, requires_super_admin, requires_workspace_admin)
SELECT 
  w.uuid,
  'Tổng quan',
  'Dashboard overview',
  'dashboard',
  '/',
  'main',
  true,
  1,
  false,
  false
FROM workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM features f WHERE f.workspace_id = w.uuid AND f.code = 'dashboard'
);

INSERT INTO features (workspace_id, name, description, code, path, group_name, enabled, order_index, requires_super_admin, requires_workspace_admin)
SELECT 
  w.uuid,
  'Nhiệm vụ đã giao',
  'Assigned tasks management',
  'assigned_tasks',
  '/nhiem-vu-da-giao',
  'main',
  true,
  2,
  false,
  false
FROM workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM features f WHERE f.workspace_id = w.uuid AND f.code = 'assigned_tasks'
);

INSERT INTO features (workspace_id, name, description, code, path, group_name, enabled, order_index, requires_super_admin, requires_workspace_admin)
SELECT 
  w.uuid,
  'Nhiệm vụ được giao',
  'Received tasks management',
  'received_tasks',
  '/nhiem-vu-duoc-giao',
  'main',
  true,
  3,
  false,
  false
FROM workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM features f WHERE f.workspace_id = w.uuid AND f.code = 'received_tasks'
);

INSERT INTO features (workspace_id, name, description, code, path, group_name, enabled, order_index, requires_super_admin, requires_workspace_admin)
SELECT 
  w.uuid,
  'Đánh giá',
  'Evaluations',
  'evaluations',
  '/danh-gia',
  'main',
  true,
  4,
  false,
  false
FROM workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM features f WHERE f.workspace_id = w.uuid AND f.code = 'evaluations'
);

INSERT INTO features (workspace_id, name, description, code, path, group_name, enabled, order_index, requires_super_admin, requires_workspace_admin)
SELECT 
  w.uuid,
  'Văn bản',
  'Documents management',
  'documents',
  '/van-ban',
  'main',
  true,
  5,
  false,
  false
FROM workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM features f WHERE f.workspace_id = w.uuid AND f.code = 'documents'
);

INSERT INTO features (workspace_id, name, description, code, path, group_name, enabled, order_index, requires_super_admin, requires_workspace_admin)
SELECT 
  w.uuid,
  'Báo cáo',
  'Reports and analytics',
  'reports',
  '/bao-cao',
  'main',
  true,
  6,
  false,
  false
FROM workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM features f WHERE f.workspace_id = w.uuid AND f.code = 'reports'
);

-- System menu feature for feature management
INSERT INTO features (workspace_id, name, description, code, path, group_name, enabled, order_index, requires_super_admin, requires_workspace_admin)
SELECT 
  w.uuid,
  'Quản lý chức năng',
  'Manage system features and menus',
  'features_management',
  '/quan-tri/quan-ly-chuc-nang',
  'system',
  true,
  7,
  true,
  false
FROM workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM features f WHERE f.workspace_id = w.uuid AND f.code = 'features_management'
);
