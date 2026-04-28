import { supabase } from './supabaseClient.js';

const POLICE_API_BASE = 'https://data.police.uk/api';

export async function getAvailableDates() {
  const res = await fetch(`${POLICE_API_BASE}/crimes-street-dates`);
  if (!res.ok) throw new Error('Failed to fetch available dates');
  return res.json();
}

export async function getCrimeCategories(date) {
  const res = await fetch(`${POLICE_API_BASE}/crime-categories?date=${date}`);
  if (!res.ok) throw new Error('Failed to fetch crime categories');
  return res.json();
}

export async function fetchCrimesForArea(lat, lng, date) {
  // Check cache first
  const cached = await getCachedCrimes(lat, lng, date);
  if (cached && cached.length > 0) {
    return cached;
  }

  // Fetch from the UK Police API
  const url = `${POLICE_API_BASE}/crimes-street/all-crime?lat=${lat}&lng=${lng}&date=${date}`;
  const res = await fetchWithRetry(url);

  if (res.status === 503) {
    // Too many crimes in the area, try a smaller request
    console.warn('Too many crimes for this area, data may be incomplete');
    return [];
  }

  if (!res.ok) throw new Error(`Crime API error: ${res.status}`);

  const crimes = await res.json();

  // Cache in Supabase (fire-and-forget)
  cacheCrimes(crimes, date).catch(console.error);

  return crimes.map(normaliseCrime);
}

export async function fetchCrimesForPoly(polyCoords, date) {
  const polyString = polyCoords.map((c) => `${c[0]},${c[1]}`).join(':');
  const url = `${POLICE_API_BASE}/crimes-street/all-crime?poly=${polyString}&date=${date}`;
  const res = await fetchWithRetry(url);

  if (res.status === 503) {
    console.warn('Too many crimes for this polygon');
    return [];
  }

  if (!res.ok) throw new Error(`Crime API error: ${res.status}`);

  const crimes = await res.json();
  cacheCrimes(crimes, date).catch(console.error);

  return crimes.map(normaliseCrime);
}

export async function getLatestMonth() {
  const dates = await getAvailableDates();
  if (dates.length === 0) return null;
  return dates[0].date;
}

// --- Internal helpers ---

function normaliseCrime(crime) {
  return {
    category: crime.category,
    latitude: parseFloat(crime.location.latitude),
    longitude: parseFloat(crime.location.longitude),
    streetName: crime.location.street?.name || '',
    month: crime.month,
    crimeId: crime.persistent_id || null,
  };
}

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url);
    if (res.status === 429) {
      // Rate limited - wait and retry
      const wait = Math.pow(2, i) * 1000;
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    return res;
  }
  throw new Error('Crime API rate limit exceeded after retries');
}

async function getCachedCrimes(lat, lng, date) {
  // Check for crimes within ~1km of the point for this month
  const delta = 0.009; // ~1km in degrees
  const { data, error } = await supabase
    .from('crime_data')
    .select('*')
    .gte('latitude', lat - delta)
    .lte('latitude', lat + delta)
    .gte('longitude', lng - delta)
    .lte('longitude', lng + delta)
    .eq('month', date)
    .limit(5000);

  if (error) {
    console.error('Cache lookup failed:', error);
    return null;
  }

  // Only use cache if we have a reasonable number of results
  return data && data.length > 10 ? data : null;
}

async function cacheCrimes(crimes, date) {
  if (!crimes || crimes.length === 0) return;

  try {
    const rows = crimes.map((c) => ({
      category: c.category,
      latitude: parseFloat(c.location.latitude),
      longitude: parseFloat(c.location.longitude),
      street_name: c.location.street?.name || null,
      month: c.month || date,
      crime_id: c.persistent_id || null,
    }));

    // Insert in batches of 500
    for (let i = 0; i < rows.length; i += 500) {
      const batch = rows.slice(i, i + 500);
      const { error } = await supabase
        .from('crime_data')
        .upsert(batch, { onConflict: 'id', ignoreDuplicates: true });

      if (error) {
        // RLS policy may block inserts - this is non-critical
        // The app works fine without caching (just slightly slower)
        if (error.code === '42501') {
          console.warn('Crime cache: RLS policy blocks insert. Add INSERT policy on crime_data table in Supabase.');
          return; // Stop trying for this batch
        }
        console.error('Cache write error:', error);
      }
    }
  } catch {
    // Caching is best-effort; failures don't affect route generation
  }
}
