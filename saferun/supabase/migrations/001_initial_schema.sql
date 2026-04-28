-- SafeRun Database Schema
-- Run this in your Supabase SQL Editor

-- User profiles (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  display_name TEXT,
  preferences JSONB DEFAULT '{
    "max_distance_km": 5,
    "avoid_parks": false,
    "avoid_narrow_paths": false,
    "prefer_lit_areas": true,
    "safety_priority": "balanced"
  }',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Cached crime data from UK Police API
CREATE TABLE crime_data (
  id BIGSERIAL PRIMARY KEY,
  category TEXT NOT NULL,
  latitude DECIMAL(9,6) NOT NULL,
  longitude DECIMAL(9,6) NOT NULL,
  street_name TEXT,
  month TEXT NOT NULL,
  crime_id TEXT,
  fetched_at TIMESTAMPTZ DEFAULT now()
);

-- Environmental safety data from London SafeStats (imported from CSV)
CREATE TABLE environmental_data (
  id SERIAL PRIMARY KEY,
  lsoa_code TEXT NOT NULL,
  lsoa_name TEXT,
  borough TEXT,
  fire_incidents INTEGER DEFAULT 0,
  ambulance_incidents INTEGER DEFAULT 0,
  road_safety_incidents INTEGER DEFAULT 0,
  data_year TEXT,
  safety_score DECIMAL(5,2),
  UNIQUE(lsoa_code, data_year)
);

-- Pre-computed grid safety scores (200m x 200m grid cells)
CREATE TABLE grid_safety (
  id SERIAL PRIMARY KEY,
  grid_lat DECIMAL(9,6) NOT NULL,
  grid_lng DECIMAL(9,6) NOT NULL,
  crime_count INTEGER DEFAULT 0,
  crime_score DECIMAL(5,2),
  environmental_score DECIMAL(5,2),
  composite_score DECIMAL(5,2),
  month TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(grid_lat, grid_lng, month)
);

-- Saved routes for logged-in users
CREATE TABLE saved_routes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  start_lat DECIMAL(9,6) NOT NULL,
  start_lng DECIMAL(9,6) NOT NULL,
  distance_km DECIMAL(5,2),
  route_geojson JSONB NOT NULL,
  safety_score DECIMAL(5,2),
  explanation JSONB,
  preferences JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_crime_data_coords ON crime_data (latitude, longitude);
CREATE INDEX idx_crime_data_month ON crime_data (month);
CREATE INDEX idx_grid_safety_coords ON grid_safety (grid_lat, grid_lng);
CREATE INDEX idx_grid_safety_month ON grid_safety (month);
CREATE INDEX idx_saved_routes_user ON saved_routes (user_id);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE crime_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE grid_safety ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users read own routes" ON saved_routes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own routes" ON saved_routes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own routes" ON saved_routes FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Anyone can read crime data" ON crime_data FOR SELECT USING (true);
CREATE POLICY "Anyone can read grid safety" ON grid_safety FOR SELECT USING (true);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'display_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
