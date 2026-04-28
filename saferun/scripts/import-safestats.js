/**
 * SafeStats Data Import Script
 *
 * One-time script to import London SafeStats environmental data into Supabase.
 *
 * Usage:
 *   1. Download CSV files from data.london.gov.uk:
 *      - Fire incidents by borough
 *      - Ambulance incidents by borough
 *      - Road safety incidents by borough
 *   2. Place CSVs in a ./data/ directory
 *   3. Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables
 *   4. Run: node scripts/import-safestats.js
 *
 * Expected CSV format (each file):
 *   LSOA_code, LSOA_name, Borough, Year, Incident_Count
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// CSV file paths (adjust as needed)
const DATA_DIR = resolve(process.cwd(), 'data');
const FILES = {
  fire: 'fire-incidents.csv',
  ambulance: 'ambulance-incidents.csv',
  road_safety: 'road-safety-incidents.csv',
};

function parseCSV(content) {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''));

  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim().replace(/"/g, ''));
    const row = {};
    headers.forEach((h, i) => {
      row[h] = values[i];
    });
    return row;
  });
}

function normalise(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 50);
  return values.map((v) => ((v - min) / (max - min)) * 100);
}

async function importData() {
  console.log('Starting SafeStats data import...');

  // Aggregate data by LSOA
  const lsoaMap = new Map();

  for (const [type, filename] of Object.entries(FILES)) {
    const filepath = resolve(DATA_DIR, filename);
    if (!existsSync(filepath)) {
      console.warn(`File not found: ${filepath} - skipping ${type}`);
      continue;
    }

    console.log(`Parsing ${filename}...`);
    const content = readFileSync(filepath, 'utf-8');
    const rows = parseCSV(content);

    for (const row of rows) {
      const lsoaCode = row.LSOA_code || row.lsoa_code || row['LSOA Code'];
      const lsoaName = row.LSOA_name || row.lsoa_name || row['LSOA Name'];
      const borough = row.Borough || row.borough;
      const year = row.Year || row.year || row.Data_Year;
      const count = parseInt(row.Incident_Count || row.incident_count || row.Count || '0', 10);

      if (!lsoaCode) continue;

      const key = `${lsoaCode}-${year}`;
      if (!lsoaMap.has(key)) {
        lsoaMap.set(key, {
          lsoa_code: lsoaCode,
          lsoa_name: lsoaName || '',
          borough: borough || '',
          data_year: year || '',
          fire_incidents: 0,
          ambulance_incidents: 0,
          road_safety_incidents: 0,
        });
      }

      const entry = lsoaMap.get(key);
      if (type === 'fire') entry.fire_incidents = count;
      else if (type === 'ambulance') entry.ambulance_incidents = count;
      else if (type === 'road_safety') entry.road_safety_incidents = count;
    }
  }

  // Compute safety scores
  const entries = Array.from(lsoaMap.values());
  const rawScores = entries.map(
    (e) => e.fire_incidents * 0.3 + e.ambulance_incidents * 0.4 + e.road_safety_incidents * 0.3
  );
  const normalisedScores = normalise(rawScores);

  entries.forEach((entry, i) => {
    entry.safety_score = Math.round((100 - normalisedScores[i]) * 100) / 100;
  });

  console.log(`Processed ${entries.length} LSOA entries`);

  // Insert into Supabase in batches
  const BATCH_SIZE = 500;
  let inserted = 0;

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('environmental_data')
      .upsert(batch, { onConflict: 'lsoa_code,data_year' });

    if (error) {
      console.error(`Batch insert error at offset ${i}:`, error);
    } else {
      inserted += batch.length;
      console.log(`Inserted ${inserted}/${entries.length} records`);
    }
  }

  console.log('Import complete!');
}

importData().catch(console.error);
