CREATE TABLE IF NOT EXISTS gisasxh.poverty_year_overviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    year integer NOT NULL,
    population integer NOT NULL DEFAULT 0,
    total_households integer NOT NULL DEFAULT 0,
    total_members integer NOT NULL DEFAULT 0,
    note text,
    created_at timestamp(6) DEFAULT now(),
    updated_at timestamp(6) DEFAULT now(),
    CONSTRAINT poverty_year_overviews_year_key UNIQUE (year)
);
