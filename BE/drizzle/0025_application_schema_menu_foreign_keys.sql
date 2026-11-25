CREATE SEQUENCE IF NOT EXISTS bandoansinhcongdong.permissions_id_seq;

ALTER SEQUENCE bandoansinhcongdong.permissions_id_seq
  OWNED BY bandoansinhcongdong.permissions.id;

SELECT setval(
  'bandoansinhcongdong.permissions_id_seq'::regclass,
  COALESCE((SELECT MAX(id) + 1 FROM bandoansinhcongdong.permissions), 1),
  FALSE
);

ALTER TABLE bandoansinhcongdong.permissions
  ALTER COLUMN id SET DEFAULT nextval('bandoansinhcongdong.permissions_id_seq'::regclass);

ALTER TABLE bandoansinhcongdong.features
  DROP CONSTRAINT IF EXISTS features_workspace_id_fkey,
  DROP CONSTRAINT IF EXISTS features_created_by_fkey,
  DROP CONSTRAINT IF EXISTS features_updated_by_fkey;

ALTER TABLE bandoansinhcongdong.features
  ADD CONSTRAINT features_workspace_id_fkey
    FOREIGN KEY (workspace_id) REFERENCES bandoansinhcongdong.workspaces(uuid) ON DELETE CASCADE,
  ADD CONSTRAINT features_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES bandoansinhcongdong.accounts(uuid),
  ADD CONSTRAINT features_updated_by_fkey
    FOREIGN KEY (updated_by) REFERENCES bandoansinhcongdong.accounts(uuid);

ALTER TABLE bandoansinhcongdong.feature_sub_items
  DROP CONSTRAINT IF EXISTS feature_sub_items_feature_id_fkey;

ALTER TABLE bandoansinhcongdong.feature_sub_items
  ADD CONSTRAINT feature_sub_items_feature_id_fkey
    FOREIGN KEY (feature_id) REFERENCES bandoansinhcongdong.features(uuid) ON DELETE CASCADE;

ALTER TABLE bandoansinhcongdong.roles
  DROP CONSTRAINT IF EXISTS roles_workspace_id_fkey;

ALTER TABLE bandoansinhcongdong.roles
  ADD CONSTRAINT roles_workspace_id_fkey
    FOREIGN KEY (workspace_id) REFERENCES bandoansinhcongdong.workspaces(uuid) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE bandoansinhcongdong.workspace_features
  DROP CONSTRAINT IF EXISTS workspace_features_feature_id_fkey,
  DROP CONSTRAINT IF EXISTS workspace_features_workspace_id_fkey;

ALTER TABLE bandoansinhcongdong.workspace_features
  ADD CONSTRAINT workspace_features_feature_id_fkey
    FOREIGN KEY (feature_id) REFERENCES bandoansinhcongdong.features(uuid) ON UPDATE RESTRICT ON DELETE RESTRICT,
  ADD CONSTRAINT workspace_features_workspace_id_fkey
    FOREIGN KEY (workspace_id) REFERENCES bandoansinhcongdong.workspaces(uuid) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE bandoansinhcongdong.role_features
  DROP CONSTRAINT IF EXISTS role_features_role_id_fkey,
  DROP CONSTRAINT IF EXISTS role_features_feature_id_fkey;

ALTER TABLE bandoansinhcongdong.role_features
  ADD CONSTRAINT role_features_role_id_fkey
    FOREIGN KEY (role_id) REFERENCES bandoansinhcongdong.roles(id) ON DELETE CASCADE,
  ADD CONSTRAINT role_features_feature_id_fkey
    FOREIGN KEY (feature_id) REFERENCES bandoansinhcongdong.features(uuid) ON DELETE CASCADE;

ALTER TABLE bandoansinhcongdong.role_permissions
  DROP CONSTRAINT IF EXISTS role_permissions_role_id_fkey,
  DROP CONSTRAINT IF EXISTS role_permissions_permission_id_fkey;

ALTER TABLE bandoansinhcongdong.role_permissions
  ADD CONSTRAINT role_permissions_role_id_fkey
    FOREIGN KEY (role_id) REFERENCES bandoansinhcongdong.roles(id) ON DELETE CASCADE,
  ADD CONSTRAINT role_permissions_permission_id_fkey
    FOREIGN KEY (permission_id) REFERENCES bandoansinhcongdong.permissions(id) ON DELETE CASCADE;