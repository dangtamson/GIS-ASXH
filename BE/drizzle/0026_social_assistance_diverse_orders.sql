ALTER TABLE bandoansinhcongdong.organizations
  ADD CONSTRAINT sa_organizations_id_workspace_key UNIQUE (uuid, workspace_id);
ALTER TABLE bandoansinhcongdong.social_assistance_programs
  ADD CONSTRAINT sa_programs_id_workspace_key UNIQUE (id, workspace_id);
ALTER TABLE bandoansinhcongdong.social_assistance_distribution_batches
  ADD CONSTRAINT sa_batches_id_workspace_key UNIQUE (id, workspace_id);

CREATE TABLE bandoansinhcongdong.social_assistance_distribution_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES bandoansinhcongdong.workspaces(uuid) ON DELETE CASCADE,
  legacy_batch_id UUID,
  program_id UUID,
  supersedes_order_id UUID,
  document_number VARCHAR(100) NOT NULL,
  document_date DATE NOT NULL,
  title VARCHAR(255) NOT NULL,
  funding_source_text TEXT NOT NULL,
  submission_deadline DATE,
  submission_deadline_exclusive BOOLEAN NOT NULL DEFAULT FALSE,
  completion_deadline DATE,
  completion_deadline_exclusive BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
  created_by UUID REFERENCES bandoansinhcongdong.accounts(uuid) ON DELETE SET NULL,
  updated_by UUID REFERENCES bandoansinhcongdong.accounts(uuid) ON DELETE SET NULL,
  published_by UUID REFERENCES bandoansinhcongdong.accounts(uuid) ON DELETE SET NULL,
  published_at TIMESTAMPTZ(6),
  closed_by UUID REFERENCES bandoansinhcongdong.accounts(uuid) ON DELETE SET NULL,
  closed_at TIMESTAMPTZ(6),
  created_at TIMESTAMPTZ(6) DEFAULT NOW(),
  updated_at TIMESTAMPTZ(6) DEFAULT NOW(),
  CONSTRAINT sa_orders_workspace_document_key UNIQUE (workspace_id, document_number),
  CONSTRAINT sa_orders_id_workspace_key UNIQUE (id, workspace_id),
  CONSTRAINT sa_orders_legacy_batch_key UNIQUE (legacy_batch_id),
  CONSTRAINT sa_orders_legacy_batch_workspace_fk FOREIGN KEY (legacy_batch_id, workspace_id)
    REFERENCES bandoansinhcongdong.social_assistance_distribution_batches(id, workspace_id) ON DELETE RESTRICT,
  CONSTRAINT sa_orders_program_workspace_fk FOREIGN KEY (program_id, workspace_id)
    REFERENCES bandoansinhcongdong.social_assistance_programs(id, workspace_id) ON DELETE RESTRICT,
  CONSTRAINT sa_orders_supersedes_workspace_fk FOREIGN KEY (supersedes_order_id, workspace_id)
    REFERENCES bandoansinhcongdong.social_assistance_distribution_orders(id, workspace_id) ON DELETE RESTRICT,
  CONSTRAINT sa_orders_status_check CHECK (status IN ('DRAFT', 'PUBLISHED', 'CLOSED')),
  CONSTRAINT sa_orders_deadlines_check CHECK (
    (NOT submission_deadline_exclusive OR submission_deadline IS NOT NULL)
    AND (NOT completion_deadline_exclusive OR completion_deadline IS NOT NULL)
    AND (submission_deadline IS NULL OR completion_deadline IS NULL OR completion_deadline >= submission_deadline)
  )
);

CREATE INDEX sa_orders_workspace_status_idx
  ON bandoansinhcongdong.social_assistance_distribution_orders(workspace_id, status);

CREATE TABLE bandoansinhcongdong.social_assistance_distribution_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES bandoansinhcongdong.workspaces(uuid) ON DELETE CASCADE,
  order_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  unit_label VARCHAR(40) NOT NULL,
  unit_amount NUMERIC(14, 2) NOT NULL,
  period VARCHAR(16) NOT NULL,
  period_count INTEGER NOT NULL,
  period_start DATE,
  period_end DATE,
  declared_total_quantity INTEGER NOT NULL,
  declared_total_amount NUMERIC(14, 2),
  eligibility_summary TEXT NOT NULL,
  created_at TIMESTAMPTZ(6) DEFAULT NOW(),
  updated_at TIMESTAMPTZ(6) DEFAULT NOW(),
  CONSTRAINT sa_components_id_order_workspace_key UNIQUE (id, order_id, workspace_id),
  CONSTRAINT sa_components_order_workspace_fk FOREIGN KEY (order_id, workspace_id)
    REFERENCES bandoansinhcongdong.social_assistance_distribution_orders(id, workspace_id) ON DELETE RESTRICT,
  CONSTRAINT sa_components_amounts_check CHECK (unit_amount > 0 AND declared_total_quantity > 0 AND (declared_total_amount IS NULL OR declared_total_amount > 0)),
  CONSTRAINT sa_components_period_check CHECK ((period = 'ONCE' AND period_count = 1) OR (period = 'MONTHLY' AND period_count BETWEEN 1 AND 120)),
  CONSTRAINT sa_components_dates_check CHECK (period_start IS NULL OR period_end IS NULL OR period_end >= period_start)
);

CREATE INDEX sa_components_order_idx
  ON bandoansinhcongdong.social_assistance_distribution_components(order_id, workspace_id);

CREATE TABLE bandoansinhcongdong.social_assistance_distribution_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES bandoansinhcongdong.workspaces(uuid) ON DELETE CASCADE,
  order_id UUID NOT NULL,
  component_id UUID NOT NULL,
  type VARCHAR(16) NOT NULL,
  province_code VARCHAR(20),
  ward_code VARCHAR(20),
  organization_id UUID,
  allocated_quantity INTEGER NOT NULL,
  created_at TIMESTAMPTZ(6) DEFAULT NOW(),
  updated_at TIMESTAMPTZ(6) DEFAULT NOW(),
  CONSTRAINT sa_targets_id_component_order_workspace_key UNIQUE (id, component_id, order_id, workspace_id),
  CONSTRAINT sa_targets_component_order_workspace_fk FOREIGN KEY (component_id, order_id, workspace_id)
    REFERENCES bandoansinhcongdong.social_assistance_distribution_components(id, order_id, workspace_id) ON DELETE RESTRICT,
  CONSTRAINT sa_targets_organization_workspace_fk FOREIGN KEY (organization_id, workspace_id)
    REFERENCES bandoansinhcongdong.organizations(uuid, workspace_id) ON DELETE RESTRICT,
  CONSTRAINT sa_targets_component_location_key UNIQUE (component_id, province_code, ward_code),
  CONSTRAINT sa_targets_component_organization_key UNIQUE (component_id, organization_id),
  CONSTRAINT sa_targets_type_check CHECK (
    (type = 'LOCALITY' AND province_code IS NOT NULL AND ward_code IS NOT NULL AND organization_id IS NULL)
    OR (type = 'ORGANIZATION' AND organization_id IS NOT NULL AND province_code IS NULL AND ward_code IS NULL)
  ),
  CONSTRAINT sa_targets_quantity_check CHECK (allocated_quantity > 0)
);

CREATE TABLE bandoansinhcongdong.social_assistance_distribution_beneficiaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES bandoansinhcongdong.workspaces(uuid) ON DELETE CASCADE,
  order_id UUID NOT NULL,
  component_id UUID NOT NULL,
  target_id UUID NOT NULL,
  household_id UUID REFERENCES bandoansinhcongdong.poor_households(id) ON DELETE RESTRICT,
  full_name VARCHAR(255) NOT NULL,
  birth_year INTEGER,
  locality_details TEXT,
  eligibility_details TEXT,
  notes TEXT,
  status VARCHAR(16) NOT NULL DEFAULT 'PROPOSED',
  created_by UUID REFERENCES bandoansinhcongdong.accounts(uuid) ON DELETE SET NULL,
  updated_by UUID REFERENCES bandoansinhcongdong.accounts(uuid) ON DELETE SET NULL,
  created_at TIMESTAMPTZ(6) DEFAULT NOW(),
  updated_at TIMESTAMPTZ(6) DEFAULT NOW(),
  CONSTRAINT sa_beneficiaries_target_component_order_workspace_fk FOREIGN KEY (target_id, component_id, order_id, workspace_id)
    REFERENCES bandoansinhcongdong.social_assistance_distribution_targets(id, component_id, order_id, workspace_id) ON DELETE RESTRICT,
  CONSTRAINT sa_beneficiaries_status_check CHECK (status IN ('PROPOSED', 'APPROVED', 'REJECTED')),
  CONSTRAINT sa_beneficiaries_birth_year_check CHECK (birth_year IS NULL OR birth_year BETWEEN 1900 AND 2200)
);

CREATE INDEX sa_beneficiaries_target_idx
  ON bandoansinhcongdong.social_assistance_distribution_beneficiaries(workspace_id, target_id);