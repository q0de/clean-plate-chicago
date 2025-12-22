-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Table: neighborhoods
CREATE TABLE IF NOT EXISTS neighborhoods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  community_area_number INTEGER,
  boundary GEOGRAPHY(Polygon, 4326),
  total_establishments INTEGER DEFAULT 0,
  pass_rate DECIMAL(5, 2),
  avg_score DECIMAL(5, 2),
  recent_failures INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: establishments
CREATE TABLE IF NOT EXISTS establishments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_number TEXT UNIQUE NOT NULL,
  dba_name TEXT NOT NULL,
  aka_name TEXT,
  facility_type TEXT NOT NULL,
  risk_level INTEGER CHECK (risk_level IN (1, 2, 3)),
  address TEXT NOT NULL,
  city TEXT DEFAULT 'Chicago',
  state TEXT DEFAULT 'IL',
  zip TEXT,
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  location GEOGRAPHY(Point, 4326),
  neighborhood_id UUID REFERENCES neighborhoods(id),
  cleanplate_score INTEGER CHECK (cleanplate_score BETWEEN 0 AND 100),
  latest_result TEXT,
  latest_inspection_date DATE,
  total_inspections INTEGER DEFAULT 0,
  pass_streak INTEGER DEFAULT 0,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: inspections
CREATE TABLE IF NOT EXISTS inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  inspection_id TEXT UNIQUE NOT NULL,
  inspection_date DATE NOT NULL,
  inspection_type TEXT NOT NULL,
  results TEXT NOT NULL,
  raw_violations TEXT,
  violation_count INTEGER DEFAULT 0,
  critical_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: violations
CREATE TABLE IF NOT EXISTS violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  violation_code TEXT NOT NULL,
  violation_description TEXT NOT NULL,
  violation_comment TEXT,
  is_critical BOOLEAN DEFAULT FALSE,
  plain_english TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: sync_logs
CREATE TABLE IF NOT EXISTS sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  records_fetched INTEGER,
  records_inserted INTEGER,
  records_updated INTEGER,
  errors JSONB,
  status TEXT CHECK (status IN ('running', 'completed', 'failed'))
);

-- Indexes for establishments
CREATE INDEX IF NOT EXISTS idx_establishments_search ON establishments 
  USING GIN (to_tsvector('english', dba_name || ' ' || COALESCE(aka_name, '') || ' ' || address));
CREATE INDEX IF NOT EXISTS idx_establishments_location ON establishments USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_establishments_score ON establishments (cleanplate_score DESC);
CREATE INDEX IF NOT EXISTS idx_establishments_date ON establishments (latest_inspection_date DESC);
CREATE INDEX IF NOT EXISTS idx_establishments_zip ON establishments (zip);
CREATE INDEX IF NOT EXISTS idx_establishments_neighborhood ON establishments (neighborhood_id);
CREATE INDEX IF NOT EXISTS idx_establishments_slug ON establishments (slug);

-- Indexes for inspections
CREATE INDEX IF NOT EXISTS idx_inspections_establishment ON inspections (establishment_id);
CREATE INDEX IF NOT EXISTS idx_inspections_date ON inspections (inspection_date DESC);
CREATE INDEX IF NOT EXISTS idx_inspections_results ON inspections (results);
CREATE INDEX IF NOT EXISTS idx_inspections_inspection_id ON inspections (inspection_id);

-- Indexes for violations
CREATE INDEX IF NOT EXISTS idx_violations_inspection ON violations (inspection_id);
CREATE INDEX IF NOT EXISTS idx_violations_critical ON violations (is_critical) WHERE is_critical = TRUE;

-- Row Level Security Policies
ALTER TABLE establishments ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE neighborhoods ENABLE ROW LEVEL SECURITY;

-- Public read access for all tables
CREATE POLICY "Public read establishments" ON establishments FOR SELECT USING (true);
CREATE POLICY "Public read inspections" ON inspections FOR SELECT USING (true);
CREATE POLICY "Public read violations" ON violations FOR SELECT USING (true);
CREATE POLICY "Public read neighborhoods" ON neighborhoods FOR SELECT USING (true);

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update updated_at on establishments
CREATE TRIGGER update_establishments_updated_at
  BEFORE UPDATE ON establishments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function: Search establishments (full-text search)
CREATE OR REPLACE FUNCTION search_establishments(query TEXT, lim INT DEFAULT 20)
RETURNS SETOF establishments AS $$
  SELECT * FROM establishments
  WHERE to_tsvector('english', dba_name || ' ' || COALESCE(aka_name, '') || ' ' || address) 
        @@ plainto_tsquery('english', query)
  ORDER BY cleanplate_score DESC
  LIMIT lim;
$$ LANGUAGE SQL STABLE;

-- Function: Find nearby establishments
CREATE OR REPLACE FUNCTION nearby_establishments(
  lat FLOAT, 
  lng FLOAT, 
  radius_miles FLOAT DEFAULT 1
)
RETURNS SETOF establishments AS $$
  SELECT * FROM establishments
  WHERE ST_DWithin(
    location,
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
    radius_miles * 1609.34
  )
  ORDER BY location <-> ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography;
$$ LANGUAGE SQL STABLE;







