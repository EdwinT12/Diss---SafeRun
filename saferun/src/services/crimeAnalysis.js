import { CRIME_WEIGHTS } from './crimeConstants.js';

// Crime spatial analysis: KDE surface, temporal decay, hotspot detection,
// nearest-neighbour clustering. Used by the routing pipeline to score where
// reported incidents are concentrated.

// KDE: build a Gaussian-kernel density surface over a lat/lng grid.
// Each crime is weighted by its severity (CRIME_WEIGHTS) and an exponential
// temporal decay so older incidents matter less. Bandwidth comes from
// Silverman's rule.
export function computeKDE(crimes, bounds, resolution = 0.001, currentMonth = null) {
  if (!crimes || crimes.length === 0) {
    return { grid: new Map(), bandwidth: 0, stats: { meanDensity: 0, maxDensity: 0 } };
  }

  // 1. Compute weighted crime points
  const weightedPoints = crimes.map((c) => ({
    x: c.longitude,
    y: c.latitude,
    weight: computeCrimeWeight(c.category, c.month, currentMonth),
  }));

  // 2. Compute bandwidth using Silverman's rule of thumb
  //    h = 0.9 * min(std, IQR/1.34) * n^(-1/5)
  const bandwidth = silvermanBandwidth(weightedPoints);

  // 3. Build grid and compute density at each cell
  const grid = new Map();
  let maxDensity = 0;
  let totalDensity = 0;
  let cellCount = 0;

  const { minLat, maxLat, minLng, maxLng } = bounds;

  for (let lat = minLat; lat <= maxLat; lat += resolution) {
    for (let lng = minLng; lng <= maxLng; lng += resolution) {
      const density = kdeAtPoint(lng, lat, weightedPoints, bandwidth);
      const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
      grid.set(key, {
        lat,
        lng,
        density,
        normalisedDensity: 0, // Will be filled after max is known
      });
      if (density > maxDensity) maxDensity = density;
      totalDensity += density;
      cellCount++;
    }
  }

  // 4. Normalise densities to [0, 1]
  if (maxDensity > 0) {
    for (const cell of grid.values()) {
      cell.normalisedDensity = cell.density / maxDensity;
    }
  }

  const stats = {
    meanDensity: cellCount > 0 ? totalDensity / cellCount : 0,
    maxDensity,
    totalWeightedCrimes: weightedPoints.reduce((s, p) => s + p.weight, 0),
    bandwidth,
    gridCells: cellCount,
    resolution,
  };

  return { grid, bandwidth, stats };
}

// Gaussian kernel evaluated at one point; cuts off at 3 bandwidths because
// the kernel is essentially zero past that.
function kdeAtPoint(x, y, points, bandwidth) {
  let density = 0;
  const h2 = bandwidth * bandwidth;
  const norm = 1 / (2 * Math.PI * h2 * points.length);

  for (const p of points) {
    const dx = x - p.x;
    const dy = y - p.y;
    const distSq = dx * dx + dy * dy;
    // Only compute for points within 3*bandwidth (kernel effectively zero beyond)
    if (distSq < 9 * h2) {
      const u = distSq / h2;
      density += p.weight * Math.exp(-0.5 * u);
    }
  }

  return density * norm;
}

// Silverman's rule for bandwidth. Geometric mean of the two axes for 2D.
function silvermanBandwidth(points) {
  if (points.length < 2) return 0.005;

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);

  const hx = silverman1D(xs, points.length);
  const hy = silverman1D(ys, points.length);

  // Geometric mean for 2D
  return Math.sqrt(hx * hy);
}

function silverman1D(values, n) {
  const sorted = [...values].sort((a, b) => a - b);
  const mean = sorted.reduce((s, v) => s + v, 0) / n;
  const variance = sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const sigma = Math.sqrt(variance);

  const q1 = sorted[Math.floor(n * 0.25)];
  const q3 = sorted[Math.floor(n * 0.75)];
  const iqr = q3 - q1;

  const spread = Math.min(sigma, iqr / 1.34);
  // Clamp to a minimum reasonable bandwidth (~100m in degrees)
  return Math.max(0.001, 0.9 * spread * Math.pow(n, -0.2));
}

// Combined per-point weight: severity * temporal decay.
function computeCrimeWeight(category, crimeMonth, currentMonth) {
  const severityWeight = CRIME_WEIGHTS[category] || 1.0;
  const temporalWeight = computeTemporalDecay(crimeMonth, currentMonth);
  return severityWeight * temporalWeight;
}

// 0.15 ~ 4.6 month half-life. Profiles can override this via their own lambda.
const TEMPORAL_DECAY_LAMBDA = 0.15;

function computeTemporalDecay(crimeMonth, currentMonth) {
  if (!crimeMonth || !currentMonth) return 1.0;

  const [cy, cm] = currentMonth.split('-').map(Number);
  const [gy, gm] = crimeMonth.split('-').map(Number);
  const deltaMonths = (cy - gy) * 12 + (cm - gm);

  if (deltaMonths <= 0) return 1.0;
  return Math.exp(-TEMPORAL_DECAY_LAMBDA * deltaMonths);
}

// Hotspot detection: pick out cells above a density threshold then merge
// adjacent ones with a quick BFS so we get one cluster per blob rather than
// one per cell.
export function detectHotspots(kdeGrid, threshold = 0.6) {
  const hotCells = [];
  for (const [key, cell] of kdeGrid) {
    if (cell.normalisedDensity >= threshold) {
      hotCells.push({ ...cell, key });
    }
  }

  if (hotCells.length === 0) return [];

  // Simple connected-component clustering via grid adjacency
  const visited = new Set();
  const clusters = [];

  for (const cell of hotCells) {
    if (visited.has(cell.key)) continue;

    const cluster = [];
    const queue = [cell];
    visited.add(cell.key);

    while (queue.length > 0) {
      const current = queue.shift();
      cluster.push(current);

      // Check 8-connected neighbours
      for (const neighbour of hotCells) {
        if (visited.has(neighbour.key)) continue;
        const dLat = Math.abs(current.lat - neighbour.lat);
        const dLng = Math.abs(current.lng - neighbour.lng);
        if (dLat <= 0.0015 && dLng <= 0.0015) {
          visited.add(neighbour.key);
          queue.push(neighbour);
        }
      }
    }

    if (cluster.length >= 2) {
      const centroidLat = cluster.reduce((s, c) => s + c.lat, 0) / cluster.length;
      const centroidLng = cluster.reduce((s, c) => s + c.lng, 0) / cluster.length;
      const peakDensity = Math.max(...cluster.map((c) => c.normalisedDensity));

      clusters.push({
        centroid: { lat: centroidLat, lng: centroidLng },
        peakDensity,
        cellCount: cluster.length,
        radiusKm: estimateClusterRadius(cluster),
      });
    }
  }

  return clusters.sort((a, b) => b.peakDensity - a.peakDensity);
}

function estimateClusterRadius(cells) {
  if (cells.length < 2) return 0.1;
  const centLat = cells.reduce((s, c) => s + c.lat, 0) / cells.length;
  const centLng = cells.reduce((s, c) => s + c.lng, 0) / cells.length;
  let maxDist = 0;
  for (const c of cells) {
    const d = haversineKm(centLat, centLng, c.lat, c.lng);
    if (d > maxDist) maxDist = d;
  }
  return Math.round(maxDist * 100) / 100;
}

// Summary stats shown in the insights panel: mean centre, spread, NNI.
export function computeSpatialStats(crimes) {
  if (!crimes || crimes.length === 0) {
    return { meanCentre: null, standardDistance: 0, nearestNeighbourIndex: null };
  }

  // Mean centre
  const meanLat = crimes.reduce((s, c) => s + c.latitude, 0) / crimes.length;
  const meanLng = crimes.reduce((s, c) => s + c.longitude, 0) / crimes.length;

  // Standard distance (spatial spread)
  const sdLat = Math.sqrt(crimes.reduce((s, c) => s + (c.latitude - meanLat) ** 2, 0) / crimes.length);
  const sdLng = Math.sqrt(crimes.reduce((s, c) => s + (c.longitude - meanLng) ** 2, 0) / crimes.length);
  const standardDistance = Math.sqrt(sdLat ** 2 + sdLng ** 2);

  // Nearest Neighbour Index (Clark & Evans, 1954)
  // NNI < 1 indicates clustering, NNI > 1 indicates dispersion
  const nni = computeNearestNeighbourIndex(crimes, standardDistance);

  // Category distribution
  const categoryDist = {};
  for (const c of crimes) {
    categoryDist[c.category] = (categoryDist[c.category] || 0) + 1;
  }

  return {
    meanCentre: { lat: meanLat, lng: meanLng },
    standardDistance,
    standardDistanceKm: standardDistance * 111,
    nearestNeighbourIndex: nni,
    clusteringInterpretation: nni < 0.5 ? 'Highly clustered' : nni < 1.0 ? 'Moderately clustered' : 'Dispersed',
    totalCrimes: crimes.length,
    categoryDistribution: categoryDist,
  };
}

// NNI < 1 means clustered, > 1 means dispersed. We sample at most 500 points
// because the inner loop is O(n^2) and Police-API responses can run into the
// thousands.
function computeNearestNeighbourIndex(crimes, standardDistance) {
  if (crimes.length < 3) return null;

  // Sample up to 500 points for performance
  const sample = crimes.length > 500
    ? crimes.filter((_, i) => i % Math.ceil(crimes.length / 500) === 0)
    : crimes;

  let totalMinDist = 0;
  for (let i = 0; i < sample.length; i++) {
    let minDist = Infinity;
    for (let j = 0; j < sample.length; j++) {
      if (i === j) continue;
      const d = haversineKm(sample[i].latitude, sample[i].longitude, sample[j].latitude, sample[j].longitude);
      if (d < minDist) minDist = d;
    }
    totalMinDist += minDist;
  }

  const observedMean = totalMinDist / sample.length;

  // Estimate area as circle with radius = 2 * standard distance
  const areaKm2 = Math.PI * (standardDistance * 111 * 2) ** 2;
  const density = crimes.length / Math.max(areaKm2, 0.01);
  const expectedMean = 1 / (2 * Math.sqrt(density));

  return Math.round((observedMean / expectedMean) * 100) / 100;
}

// Pull crime data for a window of months. Concurrency is capped at 2 because
// the Police API rate-limits on bursty traffic.
export async function fetchMultiMonthCrimes(fetchFn, lat, lng, latestMonth, monthsBack = 6) {
  const months = generateMonthRange(latestMonth, monthsBack);
  const allCrimes = [];
  const fetchedMonths = [];

  // Fetch in parallel but with concurrency limit to avoid rate limiting
  const batchSize = 2;
  for (let i = 0; i < months.length; i += batchSize) {
    const batch = months.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map((month) => fetchFn(lat, lng, month))
    );

    for (let j = 0; j < results.length; j++) {
      if (results[j].status === 'fulfilled' && results[j].value) {
        allCrimes.push(...results[j].value);
        fetchedMonths.push(batch[j]);
      }
    }
  }

  return { crimes: allCrimes, months: fetchedMonths };
}

function generateMonthRange(latestMonth, count) {
  if (!latestMonth) return [];
  const [year, month] = latestMonth.split('-').map(Number);
  const months = [];
  for (let i = 0; i < count; i++) {
    let m = month - i;
    let y = year;
    while (m < 1) { m += 12; y--; }
    months.push(`${y}-${String(m).padStart(2, '0')}`);
  }
  return months;
}

// Haversine distance in km. Used everywhere, kept here so the spatial module
// has no external dependencies.
export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Look up KDE density at an arbitrary point. Tries an exact key first, then a
// snapped key, then bilinear interpolation across the four neighbouring cells.
export function getDensityAtPoint(lat, lng, kdeGrid, resolution = 0.001) {
  const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  const cell = kdeGrid.get(key);
  if (cell) return cell.normalisedDensity;

  // Snap to nearest grid cell
  const snappedLat = Math.round(lat / resolution) * resolution;
  const snappedLng = Math.round(lng / resolution) * resolution;
  const snappedKey = `${snappedLat.toFixed(5)},${snappedLng.toFixed(5)}`;
  const snappedCell = kdeGrid.get(snappedKey);
  if (snappedCell) return snappedCell.normalisedDensity;

  // Bilinear interpolation from 4 nearest cells
  const latLo = Math.floor(lat / resolution) * resolution;
  const latHi = latLo + resolution;
  const lngLo = Math.floor(lng / resolution) * resolution;
  const lngHi = lngLo + resolution;

  const c00 = kdeGrid.get(`${latLo.toFixed(5)},${lngLo.toFixed(5)}`);
  const c01 = kdeGrid.get(`${latLo.toFixed(5)},${lngHi.toFixed(5)}`);
  const c10 = kdeGrid.get(`${latHi.toFixed(5)},${lngLo.toFixed(5)}`);
  const c11 = kdeGrid.get(`${latHi.toFixed(5)},${lngHi.toFixed(5)}`);

  const values = [c00, c01, c10, c11].filter(Boolean).map((c) => c.normalisedDensity);
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}
